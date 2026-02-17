"""
PayFine Multi-Tenant Middleware

Handles tenant resolution and government context injection for all requests.
Ensures complete data isolation between governments.

Tenant Resolution Strategies:
1. Subdomain: barbados.payfine.com → government with subdomain='barbados'
2. Header: X-Government-ID → government by ID
3. JWT Claim: government_id in token → government by ID
4. Default: First active government (development only)

CRITICAL: All requests must have a government context before accessing data.
"""

from flask import request, g, jsonify
from functools import wraps
from .models import Government
import re


class TenantResolutionError(Exception):
    """Raised when tenant cannot be resolved"""
    pass


def resolve_government_from_subdomain():
    """
    Resolve government from subdomain
    
    Examples:
    - barbados.payfine.com → subdomain='barbados'
    - trinidad.payfine.com → subdomain='trinidad'
    - localhost:3000 → None (no subdomain)
    
    Returns:
        Government or None
    """
    host = request.host.lower()
    
    # Extract subdomain
    # Pattern: subdomain.domain.tld or subdomain.localhost
    parts = host.split('.')
    
    # Check if we have a subdomain (more than 2 parts, or localhost with subdomain)
    if len(parts) >= 3 or (len(parts) == 2 and 'localhost' in parts):
        subdomain = parts[0]
        
        # Ignore common non-tenant subdomains
        if subdomain in ['www', 'api', 'admin', 'operator']:
            return None
        
        # Look up government by subdomain
        government = Government.query.filter_by(
            subdomain=subdomain,
            status='active'
        ).first()
        
        return government
    
    return None


def resolve_government_from_header():
    """
    Resolve government from X-Government-ID header
    
    Used for:
    - API clients
    - Mobile apps
    - Testing
    
    Returns:
        Government or None
    """
    government_id = request.headers.get('X-Government-ID')
    
    if not government_id:
        return None
    
    government = Government.query.filter_by(
        id=government_id,
        status='active'
    ).first()
    
    return government


def resolve_government_from_jwt():
    """
    Resolve government from JWT token claim
    
    The JWT token should contain a 'government_id' claim.
    This is set during login based on the user's government.
    
    Returns:
        Government or None
    """
    try:
        from flask_jwt_extended import get_jwt
        
        jwt_data = get_jwt()
        government_id = jwt_data.get('government_id')
        
        if not government_id:
            return None
        
        government = Government.query.filter_by(
            id=government_id,
            status='active'
        ).first()
        
        return government
    
    except Exception:
        # JWT not available or invalid
        return None


def resolve_government_default():
    """
    Resolve to default government (development only)
    
    WARNING: This should NEVER be used in production.
    It's only for local development convenience.
    
    Returns:
        Government or None
    """
    import os
    
    # Only allow in development
    if os.getenv('FLASK_ENV') != 'development':
        return None
    
    # Get first active government
    government = Government.query.filter_by(status='active').first()
    
    return government


def resolve_government():
    """
    Resolve government using multiple strategies
    
    Resolution order:
    1. JWT claim (most secure, user-specific)
    2. Subdomain (user-friendly, public-facing)
    3. Header (API clients, testing)
    4. Default (development only)
    
    Returns:
        Government
    
    Raises:
        TenantResolutionError: If government cannot be resolved
    """
    # Try JWT first (most secure)
    government = resolve_government_from_jwt()
    if government:
        return government
    
    # Try subdomain (public-facing)
    government = resolve_government_from_subdomain()
    if government:
        return government
    
    # Try header (API clients)
    government = resolve_government_from_header()
    if government:
        return government
    
    # Try default (development only)
    government = resolve_government_default()
    if government:
        return government
    
    # No government found
    raise TenantResolutionError("Could not resolve government for this request")


def inject_government_context():
    """
    Middleware to inject government context into Flask's g object
    
    This runs before every request and sets:
    - g.current_government: The resolved Government object
    - g.government_id: The government ID (for convenience)
    
    If government cannot be resolved, returns 400 error.
    """
    # Skip for certain paths that don't need government context
    exempt_paths = [
        '/api/operator/',  # Operator panel (cross-government)
        '/api/login',      # Login endpoint (no JWT yet)
        '/api/register',   # Registration endpoint (no JWT yet)
        '/api/refresh',    # Token refresh (no valid JWT)
        '/api/lookup/',    # Public ticket lookup (government resolved in endpoint)
        '/api/branding',   # Public branding endpoint
        '/health',         # Health check
        '/ready',          # Readiness check
        '/static/',        # Static files
    ]
    
    # Check if path is exempt
    for exempt_path in exempt_paths:
        if request.path.startswith(exempt_path):
            return None
    
    try:
        # Resolve government
        government = resolve_government()
        
        # Inject into Flask g object
        g.current_government = government
        g.government_id = government.id
        
        # Log for debugging (remove in production)
        import logging
        logging.debug(f"Request for government: {government.government_name} ({government.id})")
    
    except TenantResolutionError as e:
        # Could not resolve government
        return jsonify({
            'error': 'Government context required',
            'message': str(e),
            'hint': 'Provide government via subdomain, X-Government-ID header, or JWT token'
        }), 400


def get_current_government():
    """
    Get the current government from Flask g object
    
    Returns:
        Government
    
    Raises:
        RuntimeError: If called outside request context or government not set
    """
    if not hasattr(g, 'current_government'):
        raise RuntimeError("Government context not available. Ensure middleware is registered.")
    
    return g.current_government


def get_government_id():
    """
    Get the current government ID from Flask g object
    
    Returns:
        str: Government ID
    
    Raises:
        RuntimeError: If called outside request context or government not set
    """
    if not hasattr(g, 'government_id'):
        raise RuntimeError("Government context not available. Ensure middleware is registered.")
    
    return g.government_id


def require_government(f):
    """
    Decorator to require government context for a route
    
    Usage:
        @app.route('/api/tickets')
        @require_government
        def get_tickets():
            government = get_current_government()
            # ... use government
    
    This is redundant if middleware is properly configured,
    but provides explicit documentation and safety.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            get_current_government()
        except RuntimeError:
            return jsonify({
                'error': 'Government context required',
                'message': 'This endpoint requires government context'
            }), 400
        
        return f(*args, **kwargs)
    
    return decorated_function


def register_middleware(app):
    """
    Register multi-tenant middleware with Flask app
    
    Usage:
        from app.middleware import register_middleware
        
        app = Flask(__name__)
        register_middleware(app)
    """
    app.before_request(inject_government_context)
    
    print("✓ Multi-tenant middleware registered")
