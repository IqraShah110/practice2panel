"""
Configuration file for the Mock Interview application.
"""
import os
from dotenv import load_dotenv

# Load environment variables from .env file
# Load from backend directory first, then parent directory
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)
load_dotenv()  # Also try loading from current directory

# OpenAI Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Debug: Check if API key is loaded (remove in production)
if not OPENAI_API_KEY:
    print("WARNING: OPENAI_API_KEY not found in environment variables!")
else:
    print(f"OpenAI API Key loaded successfully (length: {len(OPENAI_API_KEY)})")

# Server Configuration
SERVER_HOST = "127.0.0.1"
SERVER_PORT = 5000

# Job Role Skill Mappings
JOB_ROLE_SKILLS = {
    "AI Engineer": ["Machine Learning", "Python", "PyTorch", "TensorFlow", "Deep Learning"],
    "Python Developer": ["Python", "AWS", "Kubernetes", "Docker", "Lambda"],
    "Data Scientist": ["Python", "Machine Learning", "R", "SQL", "Data Analysis"]
}

# Interview Types
INTERVIEW_TYPES = ["Conceptual", "Behavioral", "Technical"]

