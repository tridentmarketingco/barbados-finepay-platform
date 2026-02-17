"""
WSGI Entry Point for PayFine Platform
Production deployment with Gunicorn
"""

import os
import sys
from app import create_app

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

# Create Flask application
# Both 'app' and 'application' are exported for compatibility
# Procfile uses 'wsgi:app', but some configs expect 'wsgi:application'
application = create_app()
app = application  # Alias for Gunicorn

if __name__ == "__main__":
    application.run()
