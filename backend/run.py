"""
PayFine Platform - Backend Run Script
"""
from app import create_app
import os

app = create_app()

if __name__ == '__main__':
    # Disable debug mode to avoid Flask reloader issues with APScheduler
    # The reloader spawns multiple processes which causes the scheduler to deadlock
    debug_mode = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(host='0.0.0.0', port=5000, debug=debug_mode)
