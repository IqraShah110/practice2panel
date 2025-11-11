#!/usr/bin/env python3
"""
Start the Flask API server for the Practice2Panel AI backend.
"""
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    
    print(f"🚀 Starting Practice2Panel API server...")
    print(f"📍 Server will run on: http://localhost:{port}")
    print(f"🔧 Debug mode: {debug}")
    print(f"📊 Health check: http://localhost:{port}/api/health")
    print(f"❓ Questions API: http://localhost:{port}/api/questions/<interview_type>/<skill>")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=port, debug=debug, use_reloader=False)