"""
PayFine - Global Government Digital Payments Platform
Flask Application Factory with Multi-Tenant Support

Production-ready initialization with:
- Multi-tenant middleware
- Government context injection
- Operator panel support
- Azure/DreamHost compatibility
"""

from flask import Flask, g, request
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from datetime import timedelta
import os
import logging
from dotenv import load_dotenv

# Initialize extensions
db = SQLAlchemy()
jwt = JWTManager()

def create_app():
    """
    Application factory for PayFine Flask application.
    Supports multiple deployment platforms: Azure, DreamHost, local dev.
    
    Returns:
        Flask: Configured Flask application instance
    """
    app = Flask(__name__)
    
    # =============================================================================
    # LOAD CONFIGURATION
    # =============================================================================
    
    # Load .env from the application directory
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    if os.path.exists(env_path):
        load_dotenv(env_path)
    
    # Import and apply configuration
    from .config import Config
    app.config.from_object(Config)
    
    # =============================================================================
    # CONFIGURE LOGGING
    # =============================================================================
    
    # Set log level
    log_level = os.getenv('LOG_LEVEL', 'INFO')
    app.logger.setLevel(getattr(logging, log_level))
    
    # Azure-specific configuration
    if os.getenv('ENVIRONMENT') in ['production', 'staging']:
        try:
            from .azure_config import init_azure_services
            init_azure_services(app)
            app.logger.info("Azure services initialized")
        except ImportError:
            app.logger.warning("Azure config not available, skipping Azure services")
    
    # =============================================================================
    # INITIALIZE EXTENSIONS
    # =============================================================================
    
    db.init_app(app)
    jwt.init_app(app)
    
    # Initialize Redis cache
    from .cache import init_redis
    init_redis(app)
    
    # =============================================================================
    # CORS CONFIGURATION
    # =============================================================================
    
    cors_origins = getattr(Config, 'CORS_ORIGINS', [])
    if cors_origins:
        CORS(app, resources={
            r"/api/*": {
                "origins": cors_origins,
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization", "x-government-id"],
                "supports_credentials": True
            }
        })
    else:
        # Development mode - allow all origins
        CORS(app, resources={
            r"/api/*": {
                "origins": "*",
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization", "x-government-id"],
                "supports_credentials": False
            }
        })
    
    # =============================================================================
    # REGISTER MULTI-TENANT MIDDLEWARE
    # =============================================================================
    
    from .middleware import register_middleware
    register_middleware(app)
    app.logger.info("Multi-tenant middleware registered")
    
    # =============================================================================
    # CONFIGURE JWT WITH GOVERNMENT CONTEXT
    # =============================================================================
    
    @jwt.additional_claims_loader
    def add_claims_to_jwt(identity):
        """
        Add government_id to JWT claims for multi-tenant support
        
        This is called during token creation to inject government context.
        The identity is the user_id or operator_id.
        
        IMPORTANT: Check User table FIRST, then OperatorUser table.
        This prevents ID collision between regular users and operators.
        """
        from .models import User, OperatorUser
        
        # Check regular user FIRST (wardens, admins, citizens)
        user = User.query.get(identity)
        if user:
            return {
                'user_type': 'user',
                'government_id': user.government_id,
                'role': user.role,
                'is_admin': user.is_admin
            }
        
        # If not a regular user, check if this is an operator
        operator = OperatorUser.query.get(identity)
        if operator:
            return {
                'user_type': 'operator',
                'role': operator.role
            }
        
        return {}
    
    # =============================================================================
    # REGISTER BLUEPRINTS
    # =============================================================================
    
    from .routes import api_bp
    from .admin_routes import admin_bp
    from .operator_routes import operator_bp
    from .ai_routes import ai_bp
    from .gamification_routes import gamification_bp
    from .admin_gamification_routes import admin_gamification_bp
    from .points_routes import points_bp
    
    # API blueprint with /api prefix
    app.register_blueprint(api_bp, url_prefix='/api')
    
    # Admin blueprint (already has /api/admin prefix internally)
    app.register_blueprint(admin_bp)
    
    # Operator blueprint (has /api/operator prefix internally)
    app.register_blueprint(operator_bp)
    
    # AI blueprint (has /api/ai prefix internally)
    app.register_blueprint(ai_bp)
    
    # Gamification blueprint (has /api/gamification prefix internally)
    app.register_blueprint(gamification_bp)
    
    # Admin Gamification blueprint (has /api/admin/gamification prefix internally)
    app.register_blueprint(admin_gamification_bp)
    
    # Points (Merit/Demerit) blueprint (has /api/points prefix internally)
    app.register_blueprint(points_bp)
    
    app.logger.info("Blueprints registered: api, admin, operator, ai, gamification, admin_gamification, points")
    
    # =============================================================================
    # CREATE DATABASE TABLES
    # =============================================================================
    
    with app.app_context():
        db.create_all()
        app.logger.info("Database tables created/verified")
    
    # =============================================================================
    # INITIALIZE BACKGROUND SCHEDULER (Late Fees)
    # =============================================================================
    
    # Only initialize scheduler in production/staging or if explicitly enabled
    enable_scheduler = os.getenv('ENABLE_SCHEDULER', 'true').lower() == 'true'
    
    # CRITICAL FIX: Don't initialize scheduler in Flask reloader process
    # When debug=True, Flask spawns a parent process and a child process
    # The scheduler should only run in the child process (werkzeug.serving.is_running_from_reloader)
    is_reloader_process = os.environ.get('WERKZEUG_RUN_MAIN') != 'true'
    
    if enable_scheduler and not is_reloader_process:
        try:
            from .scheduler import init_scheduler
            init_scheduler(app)
            app.logger.info("Background scheduler initialized for late fee processing")
        except Exception as e:
            app.logger.error(f"Failed to initialize scheduler: {e}")
            # Don't fail app startup if scheduler fails
    else:
        if is_reloader_process:
            app.logger.info("Background scheduler skipped (reloader process)")
        else:
            app.logger.info("Background scheduler disabled (ENABLE_SCHEDULER=false)")
    
    # =============================================================================
    # SECURITY & AUDIT MIDDLEWARE
    # =============================================================================
    
    from .security import add_security_headers
    import time
    
    @app.before_request
    def log_request():
        """Log all requests for audit trail and track timing"""
        g.start_time = time.time()
        
        # Log admin actions
        if request.path.startswith('/api/admin'):
            app.logger.info("Admin request", extra={
                'method': request.method,
                'path': request.path,
                'remote_addr': request.remote_addr,
                'user_agent': request.headers.get('User-Agent')
            })
    
    @app.after_request
    def log_response(response):
        """Log response for audit trail and add security headers"""
        # Calculate response time
        if hasattr(g, 'start_time'):
            duration = time.time() - g.start_time
            
            # Log slow requests
            if duration > 2.0:
                app.logger.warning("Slow request", extra={
                    'method': request.method,
                    'path': request.path,
                    'duration': duration,
                    'status_code': response.status_code
                })
            
            # Add response time header
            response.headers['X-Response-Time'] = f"{duration:.3f}s"
        
        # Add security headers
        response = add_security_headers(response)
        
        return response
    
    # =============================================================================
    # HEALTH CHECK ENDPOINTS
    # =============================================================================
    
    @app.route('/health')
    def health_check():
        """Health check endpoint for load balancers and monitoring."""
        from .cache import cache_health_check
        
        cache_status = cache_health_check()
        
        return {
            'status': 'healthy',
            'service': 'PayFine Platform',
            'version': '2.0.0',
            'environment': os.getenv('ENVIRONMENT', 'unknown'),
            'cache': cache_status
        }, 200
    
    @app.route('/ready')
    def readiness_check():
        """Readiness check - verifies database and cache connectivity."""
        from .cache import is_cache_available
        
        try:
            # Test database connection
            db.session.execute(db.text('SELECT 1'))
            
            # Test cache connection (non-blocking)
            cache_ready = is_cache_available()
            
            return {
                'status': 'ready',
                'database': 'connected',
                'cache': 'connected' if cache_ready else 'unavailable'
            }, 200
        except Exception as e:
            app.logger.error(f"Readiness check failed: {e}")
            return {
                'status': 'not ready',
                'database': 'disconnected',
                'error': str(e)
            }, 503
    
    # =============================================================================
    # ROOT ENDPOINT
    # =============================================================================
    
    @app.route('/')
    def root():
        """Root endpoint returning API information."""
        return {
            'service': 'PayFine - Global Government Digital Payments Platform',
            'version': '2.0.0',
            'status': 'running',
            'environment': os.getenv('ENVIRONMENT', 'unknown'),
            'architecture': 'multi-tenant',
            'endpoints': {
                'health': '/health',
                'ready': '/ready',
                'api': '/api',
                'admin': '/api/admin',
                'operator': '/api/operator'
            }
        }, 200
    
    # =============================================================================
    # ERROR HANDLERS
    # =============================================================================
    
    @app.errorhandler(404)
    def not_found(error):
        return {
            'error': 'Not Found',
            'message': 'The requested resource was not found'
        }, 404
    
    @app.errorhandler(500)
    def internal_error(error):
        app.logger.error(f"Internal server error: {error}")
        db.session.rollback()
        return {
            'error': 'Internal Server Error',
            'message': 'An unexpected error occurred'
        }, 500
    
    return app
