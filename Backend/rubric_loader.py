import os
from functools import lru_cache
from typing import Optional, Tuple
from docx import Document

RUBRICS_DOCX = os.path.join(os.path.dirname(__file__), "Rubrics", "Rubrics.docx")
# Criteria headings to include (must match exactly, case-sensitive as per python-docx output)
CRITERIA_HEADINGS = [
    "1. KNOWLEDGE ACCURACY (Weight: 35%)",
    "2. COMPLETENESS (Weight: 30%)",
    "3. COMMUNICATION CLARITY (Weight: 15%)"
]
# Section marks to ignore
IGNORE_HEADINGS = [
    "4. OVERALL SCORING SUMMARY",
    "5. WEIGHT CALCULATION",
    "6. FEEDBACK TEMPLATE"
]

@lru_cache(maxsize=1)
def extract_general_rubrics_docx() -> Optional[str]:
    """
    Extract rubric text for each required section heading based on exact-match from the docx structure.
    """
    if not os.path.isfile(RUBRICS_DOCX):
        return None
    doc = Document(RUBRICS_DOCX)
    # Find start indices for each criteria and for ignore marks
    para_texts = [p.text.strip() for p in doc.paragraphs]
    rubric_sections = []
    for idx, heading in enumerate(CRITERIA_HEADINGS):
        try:
            start = para_texts.index(heading)
        except ValueError:
            continue
        # Stop at next rubric or next section/ignore heading or end of doc
        next_starts = []
        for h2 in CRITERIA_HEADINGS[idx+1:] + IGNORE_HEADINGS:
            try:
                next_start = para_texts.index(h2)
                if next_start > start:
                    next_starts.append(next_start)
            except ValueError:
                continue
        stop = min(next_starts) if next_starts else len(para_texts)
        content_lines = para_texts[start:stop]
        if content_lines:
            rubric_sections.append("\n".join(content_lines))
    if rubric_sections:
        return "\n\n".join(rubric_sections)
    return None

@lru_cache(maxsize=8)
def load_rubric_text(skill: str = "") -> Tuple[Optional[str], Optional[str]]:
    rubric_text = extract_general_rubrics_docx()
    if rubric_text:
        return rubric_text, "Rubrics.docx"
    return None, None

if __name__ == "__main__":
    print("[Rubric Extraction Debug]")
    text = extract_general_rubrics_docx()
    if not text:
        print("No rubric sections extracted from Rubrics.docx!")
    else:
        print("Rubric extraction result:\n---------------------")
        for section in text.split('\n\n'):
            heading = section.split('\n')[0][:50] if '\n' in section else section[:50]
            content_len = len(section)
            print(f"Section: {heading!r}  (len={content_len})\n---\n{section[:256]}\n...")
        print("---- \nEnd of rubric extraction output\n---")


