from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_session import Session
import psycopg2
from psycopg2 import sql
from db_handler import get_pg_connection, create_users_table
from auth import auth_bp
import os
from dotenv import load_dotenv
import json
import re
import logging
from voice_processor import process_text_response, get_openai_client
from random import shuffle

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def execute_db_query(query, params=None, fetch_one=False, fetch_all=False):
    """Utility function to execute database queries and reduce code duplication."""
    try:
        conn = get_pg_connection()
        with conn.cursor() as cursor:
            cursor.execute(query, params)
            
            if fetch_one:
                return cursor.fetchone(), None
            elif fetch_all:
                return cursor.fetchall(), None
            else:
                conn.commit()
                return True, None
                
    except Exception as e:
        return None, str(e)
    finally:
        if 'conn' in locals():
            conn.close()

app = Flask(__name__)
load_dotenv()

# Configure Flask session
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-change-this-in-production')
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_PERMANENT'] = False
app.config['SESSION_USE_SIGNER'] = True
app.config['SESSION_KEY_PREFIX'] = 'practice2panel:'
app.config['PERMANENT_SESSION_LIFETIME'] = 2592000  # 30 days in seconds

# Initialize Flask-Session
Session(app)

# Enable CORS for frontend communication with credentials support
# Get frontend URL from environment variable
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
allowed_origins = [
    FRONTEND_URL.rstrip('/'),
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://practice2panel-frontend.onrender.com'  # Production frontend URL
]

CORS(app, 
     supports_credentials=True, 
     resources={r"/api/*": {
         "origins": allowed_origins,
         "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         "allow_headers": ["Content-Type", "Authorization", "Accept"],
         "expose_headers": ["Content-Type"]
     }})

# Register auth blueprint
app.register_blueprint(auth_bp)

# Root route
@app.route('/', methods=['GET'])
def root():
    return jsonify({
        'message': 'Practice2Panel API is running',
        'status': 'active',
        'endpoints': {
            'health': '/api/health',
            'questions': '/api/questions/<interview_type>/<skill>',
            'chatbot': '/api/chatbot',
            'auth': '/api/auth/*'
        }
    }), 200

# Initialize users table on startup
try:
    create_users_table()
    print("✓ Users table initialized")
except Exception as e:
    print(f"⚠ Warning: Failed to initialize users table: {e}")

def get_questions_from_table(table_name):
    """Fetch questions from database table by table name"""
    # Check if table exists
    table_check_query = """
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = %s
        );
    """
    
    result, error = execute_db_query(table_check_query, (table_name,), fetch_one=True)
    if error:
        return None, error
    
    table_exists = result[0]
    if not table_exists:
        return None, "Table does not exist"
    
    # Fetch questions from the table
    query = sql.SQL("SELECT question FROM {} ORDER BY id").format(sql.Identifier(table_name))
    questions_result, error = execute_db_query(query, fetch_all=True)
    
    if error:
        return None, error
    
    questions = [row[0] for row in questions_result]
    return questions, None

def get_question_with_reference(table_name, question_text):
    """Fetch question with its reference answer from database table"""
    # Check if table exists
    table_check_query = """
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = %s
        );
    """
    
    result, error = execute_db_query(table_check_query, (table_name,), fetch_one=True)
    if error:
        return None, error
    
    table_exists = result[0]
    if not table_exists:
        return None, "Table does not exist"
    
    # First try exact match
    query = sql.SQL("SELECT question, explanation FROM {} WHERE question = %s").format(sql.Identifier(table_name))
    result, error = execute_db_query(query, (question_text,), fetch_one=True)
    
    if error:
        return None, error
    
    if result:
        return {
            'question': result[0],
            'reference_answer': result[1] or "No reference answer available"
        }, None
    
    # If exact match fails, try partial match (remove numbers and extra spaces)
    clean_question = question_text.strip()
    # Remove leading numbers and dots (e.g., "1. " or "2. ")
    import re
    clean_question = re.sub(r'^\d+\.\s*', '', clean_question)
    
    # Try partial match using ILIKE for case-insensitive search
    query = sql.SQL("SELECT question, explanation FROM {} WHERE question ILIKE %s").format(sql.Identifier(table_name))
    result, error = execute_db_query(query, (f'%{clean_question}%',), fetch_one=True)
    
    if error:
        return None, error
    
    if result:
        return {
            'question': result[0],
            'reference_answer': result[1] or "No reference answer available"
        }, None
    
    # If still no match, try to find any question that contains the main keywords
    keywords = clean_question.split()[:3]  # Take first 3 words as keywords
    if keywords:
        keyword_pattern = '%'.join(keywords)
        query = sql.SQL("SELECT question, explanation FROM {} WHERE question ILIKE %s LIMIT 1").format(sql.Identifier(table_name))
        result, error = execute_db_query(query, (f'%{keyword_pattern}%',), fetch_one=True)
        
        if error:
            return None, error
        
        if result:
            return {
                'question': result[0],
                'reference_answer': result[1] or "No reference answer available"
            }, None
    
    return None, "Question not found"

@app.route('/api/questions/<interview_type>/<skill>', methods=['GET'])
def get_questions(interview_type, skill):
    """Get questions for a specific interview type and skill"""
    try:
        # Special case: behavioral questions come from 'behavioralquestions' table
        if interview_type.lower() == 'behavioral':
            table_name = 'behavioralquestions'
        else:
            # Convert skill to lowercase and remove spaces for table name
            skill_lower = skill.lower().replace(' ', '')
            table_name = f"{interview_type}_{skill_lower}"
        
        questions, error = get_questions_from_table(table_name)
        
        if error:
            if "Table does not exist" in error:
                return jsonify({
                    'success': False,
                    'message': 'UnAvailable Questions',
                    'questions': []
                }), 404
            else:
                return jsonify({
                    'success': False,
                    'message': f'Database error: {error}',
                    'questions': []
                }), 500
        
        if not questions:
            return jsonify({
                'success': False,
                'message': 'UnAvailable Questions',
                'questions': []
            }), 404
        
        return jsonify({
            'success': True,
            'message': f'Found {len(questions)} questions',
            'questions': questions
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Server error: {str(e)}',
            'questions': []
        }), 500


# Evaluation endpoints removed per requirements

@app.route('/api/process-voice', methods=['POST'])
def process_voice():
    """Process voice recording and return transcript"""
    try:
        from voice_processor import process_voice_response
        
        # Check if audio file is present
        if 'audio' not in request.files:
            return jsonify({
                'success': False,
                'message': 'No audio file provided'
            }), 400
        
        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({
                'success': False,
                'message': 'No audio file selected'
            }), 400
        
        # Get question from form data
        question = request.form.get('question', 'Practice question')
        
        # Process the voice response
        result = process_voice_response(audio_file, question)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Server error during voice processing: {str(e)}'
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'success': True,
        'message': 'API is running',
        'status': 'healthy'
    })

def build_context_info(context):
    """Build context information string from context dict."""
    context_info = ""
    if context.get('currentQuestion'):
        context_info += f"\n\nCurrent Question Being Practiced: {context['currentQuestion']}"
    if context.get('skill'):
        context_info += f"\nSkill Area: {context['skill']}"
    if context.get('role'):
        context_info += f"\nTarget Role: {context['role']}"
    if context.get('interviewType'):
        context_info += f"\nInterview Type: {context['interviewType']}"
    return context_info

def build_conversation_history(conversation_history):
    """Build conversation history messages from history array."""
    history_messages = []
    for msg in conversation_history[-10:]:
        if not (msg.get('role') and msg.get('content')):
            continue
        
        # Skip file previews in history to avoid large payloads
        if msg.get('file') and msg['file'].get('preview'):
            history_messages.append({
                "role": msg['role'],
                "content": msg.get('content', '[File attached]')
            })
        else:
            history_messages.append({
                "role": msg['role'],
                "content": msg['content']
            })
    return history_messages

def process_image_file(file_data, user_message):
    """Process image file and return user content array."""
    file_type = file_data.get('type', '')
    file_content = file_data.get('content', '')
    file_name = file_data.get('name', 'file')
    
    logger.info(f"Processing image: {file_name}, content length: {len(file_content) if file_content else 0}")
    
    # Prepare image URL
    image_url = file_content if file_content and file_content.startswith('data:') else None
    if not image_url and file_content:
        image_url = f"data:{file_type};base64,{file_content}"
    
    if not image_url:
        logger.error(f"Empty file content for image: {file_name}")
        return [{
            "type": "text",
            "text": f"I received an image file '{file_name}', but there was an error processing it. Please try uploading again."
        }]
    
    logger.info(f"Adding image to message, URL prefix: {image_url[:50]}...")
    
    # Build prompt text
    prompt_text = user_message if user_message else "Analyze this image in detail. Describe everything you see including any text, logos, diagrams, colors, layout, and other visual elements. Be thorough and specific."
    
    return [
        {"type": "text", "text": prompt_text},
        {"type": "image_url", "image_url": {"url": image_url}}
    ]

def process_text_file(file_data, user_message):
    """Process text file and return user content array."""
    file_type = file_data.get('type', '')
    file_content = file_data.get('content', '')
    file_name = file_data.get('name', 'file')
    
    text_extensions = ('.txt', '.md', '.py', '.js', '.java', '.cpp', '.c', '.html', '.css', '.json')
    is_text_file = file_type.startswith('text/') or file_name.endswith(text_extensions)
    
    if not is_text_file:
        return [{
            "type": "text",
            "text": f"I received a file '{file_name}' of type '{file_type}'. However, I can only analyze text files and images. Please describe what you need help with regarding this file."
        }]
    
    text_content = f"Here is the content of the file '{file_name}':\n\n{file_content}\n\n"
    if user_message:
        text_content += f"\n\n{user_message}"
    else:
        text_content += "Please analyze this file and help me understand it. Answer any questions I have about it."
    
    return [{"type": "text", "text": text_content}]

def build_user_content(file_data, user_message):
    """Build user content array from file data and user message."""
    if not file_data:
        return [{"type": "text", "text": user_message}] if user_message else []
    
    file_type = file_data.get('type', '')
    file_name = file_data.get('name', 'file')
    
    logger.info(f"Processing file: {file_name}, type: {file_type}")
    
    if file_type.startswith('image/'):
        return process_image_file(file_data, user_message)
    
    return process_text_file(file_data, user_message)

def select_model(file_data, default_model):
    """Select appropriate OpenAI model based on file type."""
    model = os.getenv("OPENAI_MODEL", default_model)
    
    has_image = file_data and file_data.get('type', '').startswith('image/')
    if not has_image:
        return model
    
    vision_models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-vision-preview', 'gpt-4-turbo']
    if model not in vision_models:
        model = "gpt-4o"
        logger.info(f"Switching to vision-capable model: {model} for image analysis")
    else:
        logger.info(f"Using vision-capable model: {model} for image analysis")
    
    return model

def add_user_message(messages, user_content):
    """Add user message to messages array."""
    if not user_content:
        logger.warning("Empty user_content, this should not happen")
        return False
    
    # Simple text message
    if len(user_content) == 1 and user_content[0].get('type') == 'text':
        messages.append({
            "role": "user",
            "content": user_content[0]['text']
        })
        logger.info(f"Added simple text message: {user_content[0]['text'][:100]}...")
        return True
    
    # Multi-modal message (text + image or multiple parts)
    messages.append({
        "role": "user",
        "content": user_content
    })
    logger.info(f"Added multi-modal message with {len(user_content)} parts")
    return True

@app.route('/api/chatbot', methods=['POST', 'OPTIONS'])
def chatbot():
    """Chatbot endpoint for interview preparation assistance.
    Handles technical, conceptual, behavioral, problem-solving questions and tips.
    """
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
    
    try:
        data = request.json
        user_message = data.get('message', '').strip()
        context = data.get('context', {})
        conversation_history = data.get('conversationHistory', [])
        file_data = data.get('file', None)

        # Log received data for debugging
        logger.info(f"Received chatbot request - message: {user_message[:50] if user_message else 'None'}, has_file: {file_data is not None}")
        if file_data:
            logger.info(f"File data - name: {file_data.get('name', 'unknown')}, type: {file_data.get('type', 'unknown')}")

        # Validate input
        if not user_message and not file_data:
            response = jsonify({
                'success': False,
                'message': 'Message or file is required'
            })
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response, 400

        # Build system prompt
        system_prompt = """You are an expert Interview Preparation Assistant helping candidates prepare for technical interviews. 
Your role is to provide clear, helpful, and actionable guidance on:

1. **Technical Questions**: Explain technical concepts, programming languages, frameworks, algorithms, data structures, system design
2. **Conceptual Questions**: Clarify theoretical concepts, best practices, design patterns, architecture principles
3. **Behavioral Questions**: Provide tips for answering behavioral questions, STAR method, examples, common questions
4. **Problem Solving**: Help with problem-solving approaches, algorithm strategies, coding interview tips
5. **Interview Tips**: General interview preparation advice, what to expect, how to prepare, common mistakes to avoid
6. **Image/File Analysis**: When users upload images or files, you CAN and MUST analyze them. You have vision capabilities and can see images directly.

IMPORTANT - Image Analysis:
- You CAN see and analyze images directly - use your vision capabilities
- When an image is provided, describe everything you see in detail
- Identify text, logos, diagrams, code, UI elements, colors, layout, etc.
- Answer questions about the image based on what you actually see
- Be thorough and specific - describe what's in the image, don't say you can't see it

You can analyze:
- Images: Code screenshots, diagrams, whiteboard solutions, technical drawings, resume screenshots, logos, UI mockups, etc.
- Text files: Code files, documentation, notes, etc.

Always be:
- Clear and concise
- Encouraging and supportive
- Practical with examples when relevant
- Context-aware based on the candidate's current question/skill/role
- Detailed when analyzing images - describe what you actually see in the image

If the user asks about a specific question they're practicing, provide targeted help for that question.
When analyzing images, describe what you see in detail and provide actionable feedback for interview preparation."""

        # Build messages
        context_info = build_context_info(context)
        messages = [{"role": "system", "content": system_prompt + context_info}]
        messages.extend(build_conversation_history(conversation_history))

        # Build user content
        user_content = build_user_content(file_data, user_message)
        if not add_user_message(messages, user_content):
            response = jsonify({
                'success': False,
                'message': 'No content to send. Please provide a message or file.'
            })
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response, 400

        # Get OpenAI client and generate response
        try:
            client = get_openai_client()
            default_model = "gpt-4o-mini"
            model = select_model(file_data, default_model)
            
            logger.info(f"Calling OpenAI API with model: {model}, message count: {len(messages)}")
            if file_data and file_data.get('type', '').startswith('image/'):
                import json
                logger.info(f"Message contains image, content structure: {type(messages[-1].get('content'))}")
                logger.info(f"Last message content preview: {str(messages[-1].get('content'))[:200] if isinstance(messages[-1].get('content'), list) else str(messages[-1].get('content'))[:200]}")
                logger.info(f"Full last message: {json.dumps(messages[-1], indent=2)[:500]}")
            
            completion = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.7,
                max_tokens=2000
            )
            
            logger.info(f"OpenAI API response received successfully")
            assistant_response = completion.choices[0].message.content

            response = jsonify({
                'success': True,
                'response': assistant_response
            })
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response
        except Exception as openai_error:
            logger.error(f"OpenAI API error: {str(openai_error)}")
            # Check if it's an API key issue
            if "api key" in str(openai_error).lower() or "authentication" in str(openai_error).lower():
                response = jsonify({
                    'success': False,
                    'message': 'OpenAI API key not configured. Please set OPENAI_API_KEY in your .env file.'
                })
                response.headers.add('Access-Control-Allow-Origin', '*')
                return response, 500
            else:
                response = jsonify({
                    'success': False,
                    'message': f'Error calling OpenAI API: {str(openai_error)}'
                })
                response.headers.add('Access-Control-Allow-Origin', '*')
                return response, 500

    except Exception as e:
        logger.error(f"Chatbot error: {str(e)}")
        response = jsonify({
            'success': False,
            'message': f'Error processing chatbot request: {str(e)}'
        })
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response, 500

@app.route('/api/next-question', methods=['POST'])
def generate_next_question():
    """Generate a follow-up question based on user's last answer and current context.
    Body: { last_question: str, last_answer: str, role?: str, interview_type?: str, conversation?: [ {role, content} ] }
    Returns: { success, question, intent }
    """
    try:
        data = request.get_json(force=True)
        last_question = (data or {}).get('last_question', '')
        last_answer = (data or {}).get('last_answer', '')
        role = (data or {}).get('role', 'AI Interviewer')
        interview_type = (data or {}).get('interview_type', 'conceptual')
        conversation = (data or {}).get('conversation') or []

        # Simple intent heuristics
        text_low = (last_answer or '').lower().strip()
        # Check if answer is empty or too short to be meaningful
        if not text_low or len(text_low) < 3:
            return jsonify({ 'success': False, 'intent': 'silence', 'message': 'Answer too short or empty' })
        # Check for common filler/noise patterns
        if re.match(r'^(uh+|um+|er+|ah+|hmm+|\.{3,}|\s+)$', text_low):
            return jsonify({ 'success': False, 'intent': 'noise', 'message': 'Answer contains only filler words' })
        if any(p in text_low for p in ['give me a moment', 'one minute', 'wait a second', 'need time']):
            return jsonify({ 'success': True, 'intent': 'ask_time', 'question': 'Sure, I will give you a moment. Ready when you are.' })

        # Use LLM to craft a targeted follow-up grounded in the user answer
        try:
            from openai import OpenAI
            client = OpenAI()
            system_msg = (
                "You are an HR-friendly interviewer. Based on the candidate's answer, "
                "generate ONE concise, relevant follow-up question that probes depth, examples, or trade-offs. "
                "Keep it under 20 words. Do not add commentary."
            )
            messages = [{ 'role': 'system', 'content': system_msg }]
            for m in conversation[-6:]:
                if isinstance(m, dict) and m.get('role') and m.get('content'):
                    messages.append({ 'role': m['role'], 'content': m['content'] })
            user_prompt = (
                f"Interview type: {interview_type}\n"
                f"Previous question: {last_question}\n"
                f"Candidate answer: {last_answer}\n\n"
                "Now produce only the follow-up question:"
            )
            messages.append({ 'role': 'user', 'content': user_prompt })
            comp = client.chat.completions.create(
                model=os.getenv('OPENAI_MODEL', 'gpt-4o-mini'),
                temperature=0.7,
                messages=messages
            )
            q = comp.choices[0].message.content.strip()
            return jsonify({ 'success': True, 'intent': 'follow_up', 'question': q })
        except Exception as e:
            # Fallback: generic probing question
            fallback = 'Could you share a concrete example or metrics to support that?'
            return jsonify({ 'success': True, 'intent': 'follow_up', 'question': fallback, 'message': str(e) })
    except Exception as e:
        return jsonify({ 'success': False, 'message': f'Error generating next question: {e}' }), 500


@app.route('/api/evaluate', methods=['POST'])
def evaluate_answer():
    """Evaluate a text answer against rubric using LLM.
    Expected JSON: { question, answer, job_title?, skills? }
    """
    try:
        data = request.get_json(force=True, silent=False)
        question = data.get('question')
        answer = data.get('answer')
        job_title = data.get('job_title', 'Software Engineer')
        skills = data.get('skills', '')

        if not question or not answer:
            return jsonify({
                'success': False,
                'message': 'Both question and answer are required.'
            }), 400

        result = process_text_response(answer, question, job_title=job_title, skills=skills)
        return jsonify(result), (200 if result.get('success') else 500)

    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Server error during evaluation: {str(e)}'
        }), 500

# Mock Interview endpoints
try:
    from mock_interview_session_manager import session_manager
    from mock_interview_agents import (
        QuestionAgent, EvaluatorAgent, FollowUpAgent, 
        HintAgent, RecruiterAgent, IntentDetectorAgent, ImprovementAgent
    )
    from mock_interview_config import JOB_ROLE_SKILLS, INTERVIEW_TYPES
    MOCK_INTERVIEW_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Mock interview modules not available: {e}")
    MOCK_INTERVIEW_AVAILABLE = False
    session_manager = None

if MOCK_INTERVIEW_AVAILABLE:
    @app.route('/api/mock-interview/start-interview', methods=['POST'])
    def start_interview():
        """Start a new interview session."""
        try:
            data = request.get_json()
            name = data.get('name', '').strip()
            job_role = data.get('job_role', '').strip()
            interview_type = data.get('interview_type', '').strip()
            
            # Validation
            if not name:
                return jsonify({"error": "Name is required"}), 400
            if job_role not in JOB_ROLE_SKILLS:
                return jsonify({"error": f"Invalid job role. Must be one of: {list(JOB_ROLE_SKILLS.keys())}"}), 400
            if interview_type not in INTERVIEW_TYPES:
                return jsonify({"error": f"Invalid interview type. Must be one of: {INTERVIEW_TYPES}"}), 400
            
            # Create session
            session = session_manager.create_session(name, job_role, interview_type)
            
            # Generate questions
            questions = QuestionAgent.generate_questions(job_role, interview_type, num_questions=5)
            session.questions = questions
            
            # Set first question
            if questions:
                session.current_question_index = 0
                session.last_question = questions[0]
            
            # Generate welcome message only for behavioral interviews
            welcome_message = None
            if interview_type.lower() == "behavioral":
                welcome_message = RecruiterAgent.get_welcome_message(name, interview_type)
            
            response_data = {
                "session_id": session.session_id,
                "name": session.name,
                "job_role": session.job_role,
                "interview_type": session.interview_type,
                "first_question": questions[0] if questions else "No questions generated",
                "total_questions": len(questions)
            }
            
            # Only include welcome_message if it exists (behavioral interviews only)
            if welcome_message:
                response_data["welcome_message"] = welcome_message
            
            return jsonify(response_data), 200
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route('/api/mock-interview/interact', methods=['POST'])
    def interact():
        """Handle interview interactions with automatic intent detection."""
        try:
            data = request.get_json()
            session_id = data.get('session_id', '').strip()
            user_input = data.get('user_input', '').strip()
            
            if not session_id:
                return jsonify({"error": "session_id is required"}), 400
            
            if not user_input:
                return jsonify({"error": "user_input is required"}), 400
            
            session = session_manager.get_session(session_id)
            if not session:
                return jsonify({"error": "Invalid session_id"}), 404
            
            # Get current question for context
            current_question = session.last_question or ""
            if session.current_question_index < len(session.questions):
                if not current_question:
                    current_question = session.questions[session.current_question_index]
            
            # Detect intent from natural language
            try:
                intent = IntentDetectorAgent.detect_intent(
                    user_input=user_input,
                    current_question=current_question,
                    conversation_state=""
                )
            except Exception as e:
                print(f"Intent detection error: {e}")
                # Default to normal_answer if intent detection fails
                intent = "normal_answer"
            
            # Handle detected intent
            if intent == 'repeat_question':
                return jsonify({
                    "message": RecruiterAgent.get_polite_message("repeat"),
                    "question": session.last_question,
                    "session_id": session_id,
                    "intent": "repeat_question"
                }), 200
            
            elif intent == 'hint_request':
                if not session.last_question:
                    return jsonify({"error": "No question available for hint"}), 400
                
                hint = HintAgent.provide_hint(
                    session.last_question,
                    session.job_role,
                    session.interview_type
                )
                return jsonify({
                    "hint": hint,
                    "message": "Here's a hint to help guide your thinking:",
                    "session_id": session_id,
                    "intent": "hint_request"
                }), 200
            
            elif intent == 'need_time':
                return jsonify({
                    "message": RecruiterAgent.get_polite_message("pause"),
                    "session_id": session_id,
                    "intent": "need_time",
                    "pause_seconds": 10
                }), 200
            
            elif intent == 'normal_answer':
                # Check if we're answering a follow-up or main question
                is_followup = (session.current_follow_up_index < len(session.follow_up_questions))
                
                if is_followup:
                    # Answering a follow-up question
                    current_followup = session.follow_up_questions[session.current_follow_up_index]
                    
                    # Evaluate the answer
                    evaluation = EvaluatorAgent.evaluate_answer(
                        current_followup,
                        user_input,
                        session.job_role,
                        session.interview_type
                    )
                    
                    # Store in session
                    session.answers.append({
                        "question": current_followup,
                        "answer": user_input,
                        "is_followup": True,
                        "parent_question_index": session.current_question_index - 1,
                        "feedback": evaluation["short_feedback"],
                        "detailed_evaluation": evaluation["detailed_evaluation"]
                    })
                    session.detailed_evaluations.append({
                        "question": current_followup,
                        "evaluation": evaluation
                    })
                    
                    # Move to next follow-up
                    session.current_follow_up_index += 1
                    
                    # Check if more follow-ups exist
                    if session.current_follow_up_index < len(session.follow_up_questions):
                        next_followup = session.follow_up_questions[session.current_follow_up_index]
                        session.last_question = next_followup
                        return jsonify({
                            "feedback": evaluation["short_feedback"],
                            "next_question": next_followup,
                            "is_followup": True,
                            "session_id": session_id,
                            "intent": "normal_answer"
                        }), 200
                    else:
                        # Follow-ups exhausted, move to next main question
                        # Get the last evaluation feedback before clearing
                        last_feedback = evaluation["short_feedback"] if evaluation else None
                        session.follow_up_questions = []
                        session.current_follow_up_index = 0
                        return handle_next_main_question(session, session_id, last_feedback)
                
                else:
                    # Answering a main question
                    current_question = session.questions[session.current_question_index]
                    
                    # Evaluate the answer
                    evaluation = EvaluatorAgent.evaluate_answer(
                        current_question,
                        user_input,
                        session.job_role,
                        session.interview_type
                    )
                    
                    # Store in session
                    session.answers.append({
                        "question": current_question,
                        "answer": user_input,
                        "is_followup": False,
                        "feedback": evaluation["short_feedback"],
                        "detailed_evaluation": evaluation["detailed_evaluation"]
                    })
                    session.detailed_evaluations.append({
                        "question": current_question,
                        "evaluation": evaluation
                    })
                    
                    # Decide whether to ask a follow-up: for first question, then every 5–6 questions
                    ask_followup_now = False
                    try:
                        # next_followup_after stores a 1-based question number
                        if (session.current_question_index + 1) == getattr(session, 'next_followup_after', 1):
                            ask_followup_now = True
                    except Exception:
                        ask_followup_now = False

                    if ask_followup_now:
                        # Generate follow-up questions
                        follow_ups = FollowUpAgent.generate_follow_ups(
                            current_question,
                            user_input,
                            session.job_role,
                            session.interview_type
                        )

                        if follow_ups:
                            # Store follow-ups and ask first one
                            session.follow_up_questions = follow_ups
                            session.current_follow_up_index = 0
                            session.last_question = follow_ups[0]

                            # Schedule next follow-up after 5–6 more questions
                            try:
                                import random
                                increment = random.choice([5, 6])
                                session.next_followup_after = (session.current_question_index + 1) + increment
                            except Exception:
                                pass

                            return jsonify({
                                "feedback": evaluation["short_feedback"],
                                "follow_up_question": follow_ups[0],
                                "is_followup": True,
                                "session_id": session_id,
                                "intent": "normal_answer"
                            }), 200

                    # No (scheduled) follow-up right now, move to next main question
                    # But first return feedback with the next question
                    return handle_next_main_question(session, session_id, evaluation["short_feedback"])
            
            else:
                # Unknown intent - default to normal_answer
                return jsonify({
                    "error": "Unable to determine intent, please try again",
                    "session_id": session_id
                }), 400
                
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    def handle_next_main_question(session, session_id, feedback=None):
        """Handle moving to the next main question."""
        session.current_question_index += 1
        
        if session.current_question_index < len(session.questions):
            next_question = session.questions[session.current_question_index]
            session.last_question = next_question
            response_data = {
                "message": RecruiterAgent.get_polite_message("next"),
                "next_question": next_question,
                "is_followup": False,
                "session_id": session_id,
                "intent": "normal_answer",
                "question_number": session.current_question_index + 1,
                "total_questions": len(session.questions)
            }
            # Include feedback if provided
            if feedback:
                response_data["feedback"] = feedback
            return jsonify(response_data), 200
        else:
            # Interview completed
            session.completed = True
            response_data = {
                "message": RecruiterAgent.get_polite_message("complete"),
                "completed": True,
                "session_id": session_id,
                "intent": "normal_answer"
            }
            # Include feedback if provided
            if feedback:
                response_data["feedback"] = feedback
            return jsonify(response_data), 200

    @app.route('/api/mock-interview/end-interview', methods=['POST'])
    def end_interview():
        """End interview and return detailed summary."""
        try:
            data = request.get_json()
            session_id = data.get('session_id', '').strip()
            
            if not session_id:
                return jsonify({"error": "session_id is required"}), 400
            
            session = session_manager.get_session(session_id)
            if not session:
                return jsonify({"error": "Invalid session_id"}), 404
            
            # Aggregate scores for overall summary - use STAR rubrics for behavioral, regular for others
            if session.interview_type.lower() == "behavioral":
                all_scores = {
                    "Situation Clarity": [],
                    "Task Definition": [],
                    "Action Effectiveness": [],
                    "Result Impact": [],
                    "Communication Skill": []
                }
            else:
                all_scores = {
                    "Technical Accuracy": [],
                    "Clarity of Communication": [],
                    "Depth of Understanding": [],
                    "Relevance to Role": [],
                    "Overall Quality": []
                }
            
            for eval_data in session.detailed_evaluations:
                evaluation = eval_data.get("evaluation", {})
                rubric = evaluation.get("rubric_scores", {})
                
                # Extract scores for aggregation
                for metric in all_scores.keys():
                    if metric in rubric:
                        score_str = rubric[metric]
                        # Try to extract numeric score
                        try:
                            score = float(score_str.split('/')[0].strip())
                            all_scores[metric].append(score)
                        except:
                            pass
            
            # Calculate overall scores in format "Score: X/10"
            overall_scores = {}
            for metric, scores in all_scores.items():
                if scores:
                    avg_score = round(sum(scores) / len(scores), 1)
                    overall_scores[metric] = f"Score: {avg_score}/10"
                else:
                    overall_scores[metric] = "Score: 0/10"
            
            # Generate areas of improvement
            improvements = ImprovementAgent.generate_improvements(
                session.detailed_evaluations,
                session.job_role,
                session.interview_type
            )
            
            # Generate closing message for behavioral interviews
            closing_message = RecruiterAgent.get_closing_message(
                session.name,
                session.interview_type,
                overall_scores
            )
            
            # Compile summary without detailed per-question evaluations
            summary = {
                "session_id": session_id,
                "name": session.name,
                "job_role": session.job_role,
                "interview_type": session.interview_type,
                "total_questions": len(session.questions),
                "total_answers": len(session.answers),
                "overall_scores": overall_scores,
                "areas_of_improvement": improvements,
                "closing_message": closing_message
            }
            
            # Mark as completed
            session.completed = True
            
            return jsonify(summary), 200
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route('/api/mock-interview/next-question', methods=['POST'])
    def next_question():
        """Advance to the next main question explicitly (no answer evaluation)."""
        try:
            data = request.get_json()
            session_id = data.get('session_id', '').strip()
            if not session_id:
                return jsonify({"error": "session_id is required"}), 400

            session = session_manager.get_session(session_id)
            if not session:
                return jsonify({"error": "Invalid session_id"}), 404

            # When follow-ups are in progress, clear them and move on
            session.follow_up_questions = []
            session.current_follow_up_index = 0

            return handle_next_main_question(session, session_id, None)

        except Exception as e:
            return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    load_dotenv()
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    app.run(host='0.0.0.0', port=port, debug=debug)