"""
PayFine Platform - Redis Caching Utilities
Provides caching layer for improved performance

Redis is OPTIONAL - the application will work without it,
but with degraded performance (no caching).
"""

import json
import os
from functools import wraps
from datetime import timedelta
from flask import current_app

# Try to import redis, but make it optional
try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    redis = None

# Redis connection pool
redis_client = None


def init_redis(app):
    """
    Initialize Redis connection pool
    
    Redis is optional - if not available, caching will be disabled
    but the application will continue to work.
    """
    global redis_client
    
    # Check if redis module is available
    if not REDIS_AVAILABLE:
        app.logger.warning("⚠️ Redis module not installed. Caching disabled.")
        app.logger.info("   To enable caching: pip install redis")
        redis_client = None
        return
    
    redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    redis_enabled = os.getenv('REDIS_ENABLED', 'true').lower() == 'true'
    
    if redis_enabled:
        try:
            redis_client = redis.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )
            # Test connection
            redis_client.ping()
            app.logger.info(f"✅ Redis connected successfully: {redis_url}")
        except Exception as e:
            app.logger.warning(f"⚠️ Redis connection failed: {str(e)}. Caching disabled.")
            redis_client = None
    else:
        app.logger.info("ℹ️ Redis caching disabled by configuration")
        redis_client = None


def get_redis_client():
    """
    Get Redis client instance
    """
    return redis_client


def is_cache_available():
    """
    Check if Redis cache is available
    """
    if redis_client is None:
        return False
    
    try:
        redis_client.ping()
        return True
    except:
        return False


# ============================================================================
# CACHE KEY GENERATORS
# ============================================================================

def ticket_cache_key(government_id, serial_number):
    """
    Generate cache key for ticket lookup
    Format: ticket:lookup:{government_id}:{serial_number}
    """
    return f"ticket:lookup:{government_id}:{serial_number.upper()}"


def ticket_list_cache_key(government_id, status=None, page=1):
    """
    Generate cache key for ticket list
    Format: ticket:list:{government_id}:{status}:{page}
    """
    status_key = status or 'all'
    return f"ticket:list:{government_id}:{status_key}:{page}"


def analytics_cache_key(government_id, metric_type, date=None):
    """
    Generate cache key for analytics
    Format: analytics:{government_id}:{metric_type}:{date}
    """
    date_key = date or 'today'
    return f"analytics:{government_id}:{metric_type}:{date_key}"


# ============================================================================
# CACHE OPERATIONS
# ============================================================================

def cache_get(key):
    """
    Get value from cache
    Returns None if cache miss or error
    """
    if not is_cache_available():
        return None
    
    try:
        value = redis_client.get(key)
        if value:
            return json.loads(value)
        return None
    except Exception as e:
        current_app.logger.warning(f"Cache get error for key {key}: {str(e)}")
        return None


def cache_set(key, value, ttl=300):
    """
    Set value in cache with TTL (default 5 minutes)
    
    Args:
        key: Cache key
        value: Value to cache (will be JSON serialized)
        ttl: Time to live in seconds (default 300 = 5 minutes)
    """
    if not is_cache_available():
        return False
    
    try:
        serialized = json.dumps(value, default=str)
        redis_client.setex(key, ttl, serialized)
        return True
    except Exception as e:
        current_app.logger.warning(f"Cache set error for key {key}: {str(e)}")
        return False


def cache_delete(key):
    """
    Delete key from cache
    """
    if not is_cache_available():
        return False
    
    try:
        redis_client.delete(key)
        return True
    except Exception as e:
        current_app.logger.warning(f"Cache delete error for key {key}: {str(e)}")
        return False


def cache_delete_pattern(pattern):
    """
    Delete all keys matching pattern
    Example: cache_delete_pattern('ticket:lookup:1:*')
    """
    if not is_cache_available():
        return False
    
    try:
        keys = redis_client.keys(pattern)
        if keys:
            redis_client.delete(*keys)
        return True
    except Exception as e:
        current_app.logger.warning(f"Cache delete pattern error for {pattern}: {str(e)}")
        return False


def cache_increment(key, amount=1, ttl=3600):
    """
    Increment counter in cache
    Used for rate limiting and analytics
    """
    if not is_cache_available():
        return None
    
    try:
        value = redis_client.incr(key, amount)
        # Set TTL if this is a new key
        if value == amount:
            redis_client.expire(key, ttl)
        return value
    except Exception as e:
        current_app.logger.warning(f"Cache increment error for key {key}: {str(e)}")
        return None


def cache_get_or_set(key, callback, ttl=300):
    """
    Get value from cache, or execute callback and cache result
    
    Args:
        key: Cache key
        callback: Function to execute if cache miss
        ttl: Time to live in seconds
    
    Returns:
        Cached value or callback result
    """
    # Try to get from cache
    cached_value = cache_get(key)
    if cached_value is not None:
        return cached_value, True  # Return value and cache hit flag
    
    # Cache miss - execute callback
    value = callback()
    
    # Cache the result
    cache_set(key, value, ttl)
    
    return value, False  # Return value and cache miss flag


# ============================================================================
# CACHE INVALIDATION
# ============================================================================

def invalidate_ticket_cache(government_id, serial_number):
    """
    Invalidate cache for a specific ticket
    Called when ticket is updated, paid, or challenged
    """
    key = ticket_cache_key(government_id, serial_number)
    cache_delete(key)
    
    # Also invalidate ticket lists
    cache_delete_pattern(f"ticket:list:{government_id}:*")
    
    current_app.logger.info(f"Cache invalidated for ticket {serial_number}")


def invalidate_ticket_list_cache(government_id):
    """
    Invalidate all ticket list caches for a government
    Called when tickets are created, updated, or deleted
    """
    cache_delete_pattern(f"ticket:list:{government_id}:*")
    current_app.logger.info(f"Ticket list cache invalidated for government {government_id}")


def invalidate_analytics_cache(government_id):
    """
    Invalidate analytics cache for a government
    Called when new data is available
    """
    cache_delete_pattern(f"analytics:{government_id}:*")
    current_app.logger.info(f"Analytics cache invalidated for government {government_id}")


# ============================================================================
# CACHE DECORATOR
# ============================================================================

def cached(ttl=300, key_prefix='custom'):
    """
    Decorator to cache function results
    
    Usage:
        @cached(ttl=600, key_prefix='user')
        def get_user(user_id):
            return User.query.get(user_id)
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key from function name and arguments
            cache_key = f"{key_prefix}:{func.__name__}:{str(args)}:{str(kwargs)}"
            
            # Try to get from cache
            cached_value = cache_get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Execute function
            result = func(*args, **kwargs)
            
            # Cache result
            cache_set(cache_key, result, ttl)
            
            return result
        
        return wrapper
    return decorator


# ============================================================================
# CACHE STATISTICS
# ============================================================================

def get_cache_stats():
    """
    Get cache statistics
    Returns dict with cache metrics
    """
    if not is_cache_available():
        return {
            'available': False,
            'message': 'Redis cache not available'
        }
    
    try:
        info = redis_client.info('stats')
        return {
            'available': True,
            'total_connections': info.get('total_connections_received', 0),
            'total_commands': info.get('total_commands_processed', 0),
            'keyspace_hits': info.get('keyspace_hits', 0),
            'keyspace_misses': info.get('keyspace_misses', 0),
            'hit_rate': calculate_hit_rate(
                info.get('keyspace_hits', 0),
                info.get('keyspace_misses', 0)
            ),
            'used_memory': info.get('used_memory_human', 'N/A'),
            'connected_clients': redis_client.info('clients').get('connected_clients', 0)
        }
    except Exception as e:
        return {
            'available': False,
            'error': str(e)
        }


def calculate_hit_rate(hits, misses):
    """
    Calculate cache hit rate percentage
    """
    total = hits + misses
    if total == 0:
        return 0.0
    return round((hits / total) * 100, 2)


# ============================================================================
# CACHE WARMING
# ============================================================================

def warm_cache_for_government(government_id):
    """
    Pre-populate cache with frequently accessed data
    Called during deployment or maintenance windows
    """
    if not is_cache_available():
        return False
    
    try:
        from .models import Ticket
        
        # Cache recent unpaid tickets
        recent_tickets = Ticket.query.filter_by(
            government_id=government_id,
            status='unpaid'
        ).order_by(Ticket.created_at.desc()).limit(100).all()
        
        for ticket in recent_tickets:
            key = ticket_cache_key(government_id, ticket.serial_number)
            cache_set(key, ticket.to_dict(), ttl=300)
        
        current_app.logger.info(f"Cache warmed for government {government_id}: {len(recent_tickets)} tickets")
        return True
        
    except Exception as e:
        current_app.logger.error(f"Cache warming failed: {str(e)}")
        return False


# ============================================================================
# HEALTH CHECK
# ============================================================================

def cache_health_check():
    """
    Check cache health status
    Returns dict with health information
    """
    if not is_cache_available():
        return {
            'status': 'unhealthy',
            'message': 'Redis not available'
        }
    
    try:
        # Test basic operations
        test_key = 'health:check:test'
        test_value = {'timestamp': str(os.times())}
        
        # Test write
        cache_set(test_key, test_value, ttl=10)
        
        # Test read
        retrieved = cache_get(test_key)
        
        # Test delete
        cache_delete(test_key)
        
        if retrieved == test_value:
            return {
                'status': 'healthy',
                'message': 'All cache operations working',
                'latency_ms': 'OK'
            }
        else:
            return {
                'status': 'degraded',
                'message': 'Cache read/write mismatch'
            }
            
    except Exception as e:
        return {
            'status': 'unhealthy',
            'message': f'Cache health check failed: {str(e)}'
        }
