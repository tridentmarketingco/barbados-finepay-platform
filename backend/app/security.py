"""
PayFine Platform - Security Utilities
Rate limiting, input validation, and security headers
"""

from flask import request, jsonify, current_app
from functools import wraps
from datetime import datetime, timedelta
import re
import hashlib
from .cache import cache_increment, cache_get, cache_set, is_cache_available


# ============================================================================
# RATE LIMITING
# ============================================================================

class RateLimitExceeded(Exception):
    """Exception raised when rate limit is exceeded"""
    pass


def get_rate_limit_key(identifier, endpoint):
    """
    Generate rate limit key
    Format: ratelimit:{endpoint}:{identifier}
    """
    return f"ratelimit:{endpoint}:{identifier}"


def get_client_identifier():
    """
    Get unique identifier for the client
    Uses IP address, or user ID if authenticated
    """
    # Try to get user ID from JWT if authenticated
    try:
        from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
        verify_jwt_in_request(optional=True)
        user_id = get_jwt_identity()
        if user_id:
            return f"user:{user_id}"
    except:
        pass
    
    # Fall back to IP address
    # Check for proxy headers
    if request.headers.get('X-Forwarded-For'):
        ip = request.headers.get('X-Forwarded-For').split(',')[0].strip()
    elif request.headers.get('X-Real-IP'):
        ip = request.headers.get('X-Real-IP')
    else:
        ip = request.remote_addr
    
    return f"ip:{ip}"


def check_rate_limit(endpoint, limit=100, window=3600):
    """
    Check if rate limit is exceeded
    
    Args:
        endpoint: Endpoint identifier (e.g., 'ticket_lookup')
        limit: Maximum requests allowed
        window: Time window in seconds (default 1 hour)
    
    Returns:
        tuple: (allowed: bool, current_count: int, reset_time: datetime)
    
    Raises:
        RateLimitExceeded: If limit is exceeded
    """
    if not is_cache_available():
        # If cache not available, allow request but log warning
        current_app.logger.warning("Rate limiting disabled - cache not available")
        return True, 0, None
    
    identifier = get_client_identifier()
    key = get_rate_limit_key(identifier, endpoint)
    
    # Increment counter
    current_count = cache_increment(key, amount=1, ttl=window)
    
    if current_count is None:
        # Cache error - allow request
        return True, 0, None
    
    # Calculate reset time
    reset_time = datetime.utcnow() + timedelta(seconds=window)
    
    # Check if limit exceeded
    if current_count > limit:
        current_app.logger.warning(
            f"Rate limit exceeded for {identifier} on {endpoint}: "
            f"{current_count}/{limit} requests"
        )
        raise RateLimitExceeded(
            f"Rate limit exceeded. Maximum {limit} requests per hour. "
            f"Try again after {reset_time.strftime('%H:%M:%S UTC')}"
        )
    
    return True, current_count, reset_time


def rate_limit(limit=100, window=3600, endpoint=None):
    """
    Decorator for rate limiting endpoints
    
    Usage:
        @rate_limit(limit=20, window=3600, endpoint='ticket_lookup')
        def lookup_ticket(serial_number):
            ...
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            endpoint_name = endpoint or func.__name__
            
            try:
                allowed, count, reset_time = check_rate_limit(
                    endpoint_name, limit, window
                )
                
                # Add rate limit headers to response
                response = func(*args, **kwargs)
                
                if isinstance(response, tuple):
                    data, status_code = response[0], response[1]
                else:
                    data, status_code = response, 200
                
                # Add rate limit info to headers
                if hasattr(data, 'headers'):
                    data.headers['X-RateLimit-Limit'] = str(limit)
                    data.headers['X-RateLimit-Remaining'] = str(max(0, limit - count))
                    if reset_time:
                        data.headers['X-RateLimit-Reset'] = reset_time.isoformat()
                
                return data, status_code
                
            except RateLimitExceeded as e:
                return jsonify({
                    'error': 'Rate limit exceeded',
                    'message': str(e),
                    'retry_after': reset_time.isoformat() if reset_time else None
                }), 429
        
        return wrapper
    return decorator


# ============================================================================
# FAILED ATTEMPT TRACKING
# ============================================================================

def track_failed_lookup(serial_number, identifier=None):
    """
    Track failed ticket lookup attempts
    Used to detect brute force attacks or scanning
    """
    if not is_cache_available():
        return
    
    if identifier is None:
        identifier = get_client_identifier()
    
    # Track by identifier
    key = f"failed_lookup:{identifier}"
    count = cache_increment(key, amount=1, ttl=600)  # 10 minute window
    
    # Track by serial number (detect if specific ticket is being targeted)
    serial_key = f"failed_lookup:serial:{serial_number.upper()}"
    serial_count = cache_increment(serial_key, amount=1, ttl=600)
    
    # Alert if threshold exceeded
    if count and count >= 10:
        current_app.logger.warning(
            f"⚠️ Multiple failed lookups from {identifier}: {count} attempts"
        )
    
    if serial_count and serial_count >= 5:
        current_app.logger.warning(
            f"⚠️ Multiple failed lookups for ticket {serial_number}: {serial_count} attempts"
        )
    
    return count


def get_failed_lookup_count(identifier=None):
    """
    Get count of failed lookup attempts
    """
    if not is_cache_available():
        return 0
    
    if identifier is None:
        identifier = get_client_identifier()
    
    key = f"failed_lookup:{identifier}"
    count = cache_get(key)
    
    return int(count) if count else 0


def should_require_captcha():
    """
    Determine if CAPTCHA should be required
    Based on failed lookup attempts
    """
    failed_count = get_failed_lookup_count()
    return failed_count >= 5


# ============================================================================
# INPUT VALIDATION
# ============================================================================

def validate_ticket_serial(serial_number):
    """
    Validate ticket serial number format
    Expected format: A459778 (1 letter + 6 digits)
    
    Returns:
        tuple: (is_valid: bool, error_message: str or None)
    """
    if not serial_number:
        return False, "Serial number is required"
    
    # Remove whitespace
    serial = serial_number.strip().upper()
    
    # Check length
    if len(serial) != 7:
        return False, "Serial number must be 7 characters (e.g., A459778)"
    
    # Check format: 1 letter + 6 digits
    pattern = r'^[A-Z][0-9]{6}$'
    if not re.match(pattern, serial):
        return False, "Invalid format. Expected: Letter + 6 digits (e.g., A459778)"
    
    return True, None


def sanitize_input(value, max_length=255):
    """
    Sanitize user input to prevent injection attacks
    """
    if not value:
        return value
    
    # Convert to string and strip whitespace
    sanitized = str(value).strip()
    
    # Limit length
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length]
    
    # Remove potentially dangerous characters
    # Allow alphanumeric, spaces, and common punctuation
    sanitized = re.sub(r'[^\w\s\-.,@+()\'"]', '', sanitized)
    
    return sanitized


def validate_email(email):
    """
    Validate email address format
    """
    if not email:
        return False, "Email is required"
    
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(pattern, email):
        return False, "Invalid email format"
    
    return True, None


# ============================================================================
# SECURITY HEADERS
# ============================================================================

def add_security_headers(response):
    """
    Add security headers to response
    Should be called in after_request handler
    """
    # Prevent clickjacking
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    
    # Prevent MIME type sniffing
    response.headers['X-Content-Type-Options'] = 'nosniff'
    
    # Enable XSS protection
    response.headers['X-XSS-Protection'] = '1; mode=block'
    
    # Strict Transport Security (HTTPS only)
    if request.is_secure:
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    
    # Content Security Policy
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self' https://staging.ptranz.com https://api.powertranz.com; "
        "frame-src 'self' https://staging.ptranz.com https://api.powertranz.com;"
    )
    
    # Referrer Policy
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    
    # Permissions Policy
    response.headers['Permissions-Policy'] = (
        "geolocation=(), "
        "microphone=(), "
        "camera=()"
    )
    
    return response


# ============================================================================
# IP BLOCKING
# ============================================================================

def is_ip_blocked(ip_address=None):
    """
    Check if IP address is blocked
    """
    if not is_cache_available():
        return False
    
    if ip_address is None:
        ip_address = request.remote_addr
    
    key = f"blocked_ip:{ip_address}"
    blocked = cache_get(key)
    
    return bool(blocked)


def block_ip(ip_address, duration=3600, reason="Security violation"):
    """
    Block an IP address temporarily
    
    Args:
        ip_address: IP to block
        duration: Block duration in seconds (default 1 hour)
        reason: Reason for blocking
    """
    if not is_cache_available():
        return False
    
    key = f"blocked_ip:{ip_address}"
    cache_set(key, {
        'blocked_at': datetime.utcnow().isoformat(),
        'reason': reason,
        'expires_at': (datetime.utcnow() + timedelta(seconds=duration)).isoformat()
    }, ttl=duration)
    
    current_app.logger.warning(f"🚫 IP blocked: {ip_address} - Reason: {reason}")
    return True


def unblock_ip(ip_address):
    """
    Unblock an IP address
    """
    if not is_cache_available():
        return False
    
    from .cache import cache_delete
    key = f"blocked_ip:{ip_address}"
    cache_delete(key)
    
    current_app.logger.info(f"✅ IP unblocked: {ip_address}")
    return True


# ============================================================================
# REQUEST FINGERPRINTING
# ============================================================================

def get_request_fingerprint():
    """
    Generate unique fingerprint for request
    Used for security monitoring and analytics
    """
    components = [
        request.remote_addr,
        request.headers.get('User-Agent', ''),
        request.headers.get('Accept-Language', ''),
        request.headers.get('Accept-Encoding', '')
    ]
    
    fingerprint_string = '|'.join(components)
    fingerprint_hash = hashlib.sha256(fingerprint_string.encode()).hexdigest()[:16]
    
    return fingerprint_hash


# ============================================================================
# SUSPICIOUS ACTIVITY DETECTION
# ============================================================================

def detect_suspicious_activity():
    """
    Detect suspicious activity patterns
    Returns dict with detection results
    """
    identifier = get_client_identifier()
    
    checks = {
        'failed_lookups': get_failed_lookup_count(identifier),
        'rate_limit_violations': 0,  # Would need to track this separately
        'ip_blocked': is_ip_blocked(),
        'requires_captcha': should_require_captcha()
    }
    
    # Calculate suspicion score (0-100)
    score = 0
    if checks['failed_lookups'] >= 10:
        score += 50
    elif checks['failed_lookups'] >= 5:
        score += 25
    
    if checks['ip_blocked']:
        score += 100  # Automatic high score
    
    checks['suspicion_score'] = min(score, 100)
    checks['is_suspicious'] = score >= 50
    
    return checks


# ============================================================================
# SECURITY MIDDLEWARE
# ============================================================================

def security_check():
    """
    Perform security checks before processing request
    Should be called at the start of sensitive endpoints
    
    Raises:
        Exception: If security check fails
    """
    # Check if IP is blocked
    if is_ip_blocked():
        current_app.logger.warning(f"🚫 Blocked IP attempted access: {request.remote_addr}")
        raise Exception("Access denied. Your IP address has been temporarily blocked.")
    
    # Check for suspicious activity
    activity = detect_suspicious_activity()
    if activity['suspicion_score'] >= 75:
        current_app.logger.warning(
            f"⚠️ High suspicion score ({activity['suspicion_score']}) for {get_client_identifier()}"
        )
        # Could implement additional checks or CAPTCHA here


# ============================================================================
# SECURITY REPORTING
# ============================================================================

def get_security_report():
    """
    Generate security report with current metrics
    """
    if not is_cache_available():
        return {
            'available': False,
            'message': 'Security monitoring unavailable - cache not available'
        }
    
    identifier = get_client_identifier()
    
    return {
        'available': True,
        'client_identifier': identifier,
        'failed_lookups': get_failed_lookup_count(identifier),
        'requires_captcha': should_require_captcha(),
        'ip_blocked': is_ip_blocked(),
        'request_fingerprint': get_request_fingerprint(),
        'suspicious_activity': detect_suspicious_activity()
    }
