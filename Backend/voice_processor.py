import os
import tempfile
import re
from dotenv import load_dotenv
import logging
from typing import Optional

from rubric_loader import load_rubric_text
from openai import OpenAI

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global whisper model instance
whisper_model = None
openai_client: Optional[OpenAI] = None

def get_whisper_model():
    """Get or initialize the Whisper model"""
    global whisper_model
    if whisper_model is None:
        try:
            # Lazy import so backend can start without whisper installed
            import whisper  # type: ignore
        except ImportError as e:
            logger.error("Whisper is not installed. Install 'openai-whisper' to enable voice features.")
            raise
        logger.info("Loading Whisper model...")
        whisper_model = whisper.load_model("base")
    return whisper_model


def get_openai_client() -> OpenAI:
    global openai_client
    if openai_client is None:
        openai_client = OpenAI()
    return openai_client

def transcribe_audio(audio_file_path):
    """Transcribe audio using local Whisper; on failure, fall back to OpenAI API if available."""
    # First: local whisper
    try:
        model = get_whisper_model()
        result = model.transcribe(audio_file_path)
        return result["text"]
    except Exception as e:
        logger.error(f"Local Whisper transcription error: {e}")

    # Fallback: OpenAI Whisper API
    try:
        api_key_present = bool(os.getenv("OPENAI_API_KEY"))
        if not api_key_present:
            logger.error("OPENAI_API_KEY not set; cannot use OpenAI Whisper fallback.")
            return None
        client = get_openai_client()
        with open(audio_file_path, "rb") as f:
            tr = client.audio.transcriptions.create(
                model=os.getenv("OPENAI_STT_MODEL", "whisper-1"),
                file=f
            )
        text = getattr(tr, "text", None) or (tr.get("text") if isinstance(tr, dict) else None)
        if not text:
            logger.error("OpenAI Whisper API returned no text.")
            return None
        return text
    except Exception as e:
        logger.error(f"OpenAI Whisper API transcription error: {e}")
        return None

def process_text_response(text_response, question, job_title="Software Engineer", skills="Python, React"):
    """Process text response using LLM and rubric-derived criteria."""
    try:
        # Infer a primary skill to find a rubric
        primary_skill = (skills.split(',')[0] if isinstance(skills, str) and skills else "").strip()
        rubric_text, rubric_source = load_rubric_text(primary_skill) if primary_skill else (None, None)

        prompt_system = (
            "You are an expert interview coach. Evaluate answers based on clear, specific rubrics. "
            "Be constructive, concise, and actionable. Provide a score and reasons."
        )
        prompt_user = (
            f"Question: {question}\n\n"
            f"Candidate Answer: {text_response}\n\n"
            f"Role: {job_title}\nSkills Context: {skills}\n\n"
            + (f"Rubric (from {rubric_source}):\n{rubric_text}\n\n" if rubric_text else "")
            + "Evaluate the answer strictly against the rubric and context. "
              "Return JSON with fields: score (0-10), strengths (array), improvements (array), summary (string)."
        )

        client = get_openai_client()
        completion = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            temperature=0.2,
            messages=[
                {"role": "system", "content": prompt_system},
                {"role": "user", "content": prompt_user},
            ],
            response_format={"type": "json_object"}
        )
        content = completion.choices[0].message.content
        return {
            'success': True,
            'evaluation': content,
            'rubric_used': bool(rubric_text),
            'rubric_source': rubric_source,
        }
    except Exception as e:
        logger.error(f"Error processing text response: {e}")
        return {
            'success': False,
            'message': f'Error processing text response: {str(e)}'
        }

def process_voice_response(audio_file, question, job_title="Software Engineer", skills="Python, React", with_feedback: bool = True):
    """Process voice recording and return transcript with evaluation"""
    try:
        # Save uploaded file temporarily
        # Determine appropriate extension based on uploaded file metadata
        filename = getattr(audio_file, 'filename', '') or ''
        mimetype = getattr(audio_file, 'mimetype', '') or ''
        ext = '.wav'
        lower_name = filename.lower()
        if lower_name.endswith('.webm') or 'webm' in mimetype:
            ext = '.webm'
        elif lower_name.endswith('.ogg') or 'ogg' in mimetype:
            ext = '.ogg'
        elif lower_name.endswith('.mp3') or 'mp3' in mimetype:
            ext = '.mp3'
        elif lower_name.endswith('.m4a') or 'mp4' in mimetype or 'm4a' in mimetype:
            ext = '.m4a'

        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
            audio_file.save(temp_file.name)
            temp_file_path = temp_file.name
        
        try:
            # Transcribe audio
            logger.info(f"Starting audio transcription... (ext={ext}, mimetype={mimetype})")
            transcript = transcribe_audio(temp_file_path)
            
            # Clean and validate transcript
            if transcript:
                transcript_clean = transcript.strip() if transcript else ''
                # Check if transcript is meaningful (more strict validation)
                words = transcript_clean.split() if transcript_clean else []
                word_count = len([w for w in words if re.search(r'\w', w)])
                
                is_meaningful = (
                    len(transcript_clean) >= 10 and  # At least 10 characters
                    word_count >= 2 and  # At least 2 words
                    bool(re.search(r'\w', transcript_clean)) and  # Contains word characters
                    not re.match(r'^(uh+|um+|er+|ah+|hmm+|\.{2,}|\s+|[\.\s\-_]+)$', transcript_clean, re.IGNORECASE) and
                    not re.match(r'^[^\w\s]+$', transcript_clean)  # Not just punctuation
                )
                
                if is_meaningful:
                    logger.info(f"Transcription successful: {transcript_clean[:100]}...")
                    if with_feedback:
                        eval_result = process_text_response(transcript_clean, question, job_title=job_title, skills=skills)
                    else:
                        eval_result = None
                    return {
                        'success': True,
                        'transcript': transcript_clean,
                        'question': question,
                        'message': 'Voice response processed successfully',
                        'evaluation': (eval_result.get('evaluation') if eval_result and eval_result.get('success') else None),
                        'rubric_used': (eval_result.get('rubric_used') if eval_result else False),
                        'rubric_source': (eval_result.get('rubric_source') if eval_result else None),
                    }
                else:
                    logger.warning(f"Transcript detected but not meaningful: '{transcript_clean}' (length: {len(transcript_clean)})")
                    return {
                        'success': False,
                        'message': 'No meaningful speech detected. Please try again.',
                        'transcript': transcript_clean  # Include for debugging
                    }
            else:
                logger.error("Transcription failed - no transcript returned")
                return {
                    'success': False,
                    'message': 'Failed to transcribe audio. Please try again.'
                }
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                
    except Exception as e:
        logger.error(f"Error processing voice response: {e}")
        return {
            'success': False,
            'message': f'Server error during voice processing: {str(e)}'
        }
