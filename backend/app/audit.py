"""
PayFine Platform - Audit Logging
Comprehensive audit trail for compliance and security
"""

from datetime import datetime
from flask import request, current_app
from .models import db
import json
import hashlib


# ============================================================================
# AUDIT LOG MODEL
# ============================================================================

class AuditLog(db.Model):
    """
    Audit log table for tracking all system activities
    """
    __tablename__ = 'audit_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Timestamp
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    
    # Event information
    event_type = db.Column(db.String(50), nullable=False, index=True)  # ticket_lookup, payment, login, etc.
    event_action = db.Column(db.String(50), nullable=False)  # view, create, update, delete
    event_status = db.Column(db.String(20), nullable=False)  # success, failure, error
    
    # User information
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    user_type = db.Column(db.String(20))  # admin, warden, citizen, anonymous
    username = db.Column(db.String(100))
    
    # Government context
    government_id = db.Column(db.String(36), db.ForeignKey('governments.id'), nullable=False, index=True)
    
    # Request information
    ip_address = db.Column(db.String(45))  # IPv6 compatible
    user_agent = db.Column(db.String(255))
    request_method = db.Column(db.String(10))
    request_path = db.Column(db.String(255))
    request_fingerprint = db.Column(db.String(32))
    
    # Resource information
    resource_type = db.Column(db.String(50))  # ticket, user, payment, etc.
    resource_id = db.Column(db.String(100), index=True)  # Serial number, user ID, etc.
    
    # Event details
    details = db.Column(db.Text)  # JSON string with additional details
    error_message = db.Column(db.Text)  # Error details if status is failure/error
    
    # Performance metrics
    response_time_ms = db.Column(db.Integer)  # Response time in milliseconds
    
    # Data changes (for update/delete operations)
    old_values = db.Column(db.Text)  # JSON string of old values
    new_values = db.Column(db.Text)  # JSON string of new values
    
    # Security
    security_level = db.Column(db.String(20), default='normal')  # normal, sensitive, critical
    
    def __repr__(self):
        return f'<AuditLog {self.id}: {self.event_type} - {self.event_status}>'
    
    def to_dict(self):
        """Convert audit log to dictionary"""
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'event_type': self.event_type,
            'event_action': self.event_action,
            'event_status': self.event_status,
            'user_id': self.user_id,
            'user_type': self.user_type,
            'username': self.username,
            'government_id': self.government_id,
            'ip_address': self.ip_address,
            'resource_type': self.resource_type,
            'resource_id': self.resource_id,
            'details': json.loads(self.details) if self.details else None,
            'response_time_ms': self.response_time_ms,
            'security_level': self.security_level
        }


# ============================================================================
# AUDIT LOGGING FUNCTIONS
# ============================================================================

def log_audit_event(
    event_type,
    event_action,
    event_status='success',
    resource_type=None,
    resource_id=None,
    details=None,
    error_message=None,
    old_values=None,
    new_values=None,
    security_level='normal',
    response_time_ms=None,
    user_id=None,
    government_id=None
):
    """
    Log an audit event
    
    Args:
        event_type: Type of event (ticket_lookup, payment, login, etc.)
        event_action: Action performed (view, create, update, delete)
        event_status: Status of event (success, failure, error)
        resource_type: Type of resource affected (ticket, user, etc.)
        resource_id: ID of resource affected
        details: Additional details as dict
        error_message: Error message if applicable
        old_values: Old values for update/delete operations
        new_values: New values for update/create operations
        security_level: Security level (normal, sensitive, critical)
        response_time_ms: Response time in milliseconds
        user_id: User ID (if authenticated)
        government_id: Government ID
    """
    try:
        # Get user information
        if user_id is None:
            try:
                from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
                verify_jwt_in_request(optional=True)
                user_id = get_jwt_identity()
            except:
                pass
        
        # Get government context
        if government_id is None:
            try:
                from .middleware import get_government_id
                government_id = get_government_id()
            except:
                # Default to first government if context not available
                from .models import Government
                gov = Government.query.first()
                government_id = gov.id if gov else 1
        
        # Get user details
        username = None
        user_type = 'anonymous'
        if user_id:
            try:
                from .models import User
                user = User.query.get(user_id)
                if user:
                    username = user.username
                    user_type = 'admin' if user.is_admin else 'warden' if user.role == 'warden' else 'user'
            except:
                pass
        
        # Get request information
        ip_address = get_client_ip()
        user_agent = request.headers.get('User-Agent', '')[:255] if request else None
        request_method = request.method if request else None
        request_path = request.path if request else None
        request_fingerprint = get_request_fingerprint() if request else None
        
        # Create audit log entry
        audit_log = AuditLog(
            timestamp=datetime.utcnow(),
            event_type=event_type,
            event_action=event_action,
            event_status=event_status,
            user_id=user_id,
            user_type=user_type,
            username=username,
            government_id=government_id,
            ip_address=ip_address,
            user_agent=user_agent,
            request_method=request_method,
            request_path=request_path,
            request_fingerprint=request_fingerprint,
            resource_type=resource_type,
            resource_id=resource_id,
            details=json.dumps(details, default=str) if details else None,
            error_message=error_message,
            old_values=json.dumps(old_values, default=str) if old_values else None,
            new_values=json.dumps(new_values, default=str) if new_values else None,
            security_level=security_level,
            response_time_ms=response_time_ms
        )
        
        # Use a separate session for audit logging to avoid affecting main transaction
        db.session.add(audit_log)
        db.session.commit()
        
        # Log to application logger for critical events
        if security_level == 'critical' or event_status in ['failure', 'error']:
            current_app.logger.warning(
                f"AUDIT [{security_level.upper()}]: {event_type}.{event_action} - "
                f"{event_status} - User: {username or 'anonymous'} - "
                f"Resource: {resource_type}:{resource_id}"
            )
        
        return audit_log
        
    except Exception as e:
        # Don't let audit logging failures break the application
        # Rollback the audit session to prevent affecting main transaction
        try:
            db.session.rollback()
        except:
            pass
        current_app.logger.error(f"Failed to log audit event: {str(e)}")
        return None


def log_ticket_lookup(serial_number, success=True, error_message=None, response_time_ms=None):
    """
    Log ticket lookup event
    """
    return log_audit_event(
        event_type='ticket_lookup',
        event_action='view',
        event_status='success' if success else 'failure',
        resource_type='ticket',
        resource_id=serial_number,
        error_message=error_message,
        response_time_ms=response_time_ms,
        security_level='normal'
    )


def log_payment_attempt(ticket_serial, amount, success=True, transaction_id=None, error_message=None):
    """
    Log payment attempt
    """
    return log_audit_event(
        event_type='payment',
        event_action='create',
        event_status='success' if success else 'failure',
        resource_type='ticket',
        resource_id=ticket_serial,
        details={
            'amount': float(amount),
            'transaction_id': transaction_id,
            'payment_method': 'card'
        },
        error_message=error_message,
        security_level='sensitive'
    )


def log_challenge_submission(ticket_serial, challenge_id, reason):
    """
    Log challenge submission
    """
    return log_audit_event(
        event_type='challenge',
        event_action='create',
        event_status='success',
        resource_type='ticket',
        resource_id=ticket_serial,
        details={
            'challenge_id': challenge_id,
            'reason': reason[:100]  # Truncate for privacy
        },
        security_level='normal'
    )


def log_ticket_creation(ticket_serial, offence_id, fine_amount):
    """
    Log ticket creation by warden
    """
    return log_audit_event(
        event_type='ticket',
        event_action='create',
        event_status='success',
        resource_type='ticket',
        resource_id=ticket_serial,
        details={
            'offence_id': offence_id,
            'fine_amount': float(fine_amount)
        },
        security_level='normal'
    )


def log_ticket_update(ticket_serial, old_values, new_values):
    """
    Log ticket update
    """
    return log_audit_event(
        event_type='ticket',
        event_action='update',
        event_status='success',
        resource_type='ticket',
        resource_id=ticket_serial,
        old_values=old_values,
        new_values=new_values,
        security_level='normal'
    )


def log_login_attempt(username, success=True, error_message=None):
    """
    Log login attempt
    """
    return log_audit_event(
        event_type='authentication',
        event_action='login',
        event_status='success' if success else 'failure',
        resource_type='user',
        resource_id=username,
        error_message=error_message,
        security_level='sensitive'
    )


def log_security_event(event_description, severity='warning'):
    """
    Log security-related event
    """
    return log_audit_event(
        event_type='security',
        event_action='alert',
        event_status='warning',
        details={'description': event_description},
        security_level='critical'
    )


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_client_ip():
    """
    Get client IP address, considering proxy headers
    """
    if not request:
        return None
    
    # Check for proxy headers
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    elif request.headers.get('X-Real-IP'):
        return request.headers.get('X-Real-IP')
    else:
        return request.remote_addr


def get_request_fingerprint():
    """
    Generate unique fingerprint for request
    """
    if not request:
        return None
    
    components = [
        request.remote_addr or '',
        request.headers.get('User-Agent', ''),
        request.headers.get('Accept-Language', ''),
        request.headers.get('Accept-Encoding', '')
    ]
    
    fingerprint_string = '|'.join(components)
    return hashlib.sha256(fingerprint_string.encode()).hexdigest()[:32]


# ============================================================================
# AUDIT LOG QUERIES
# ============================================================================

def get_audit_logs(
    government_id=None,
    event_type=None,
    user_id=None,
    resource_id=None,
    start_date=None,
    end_date=None,
    limit=100
):
    """
    Query audit logs with filters
    """
    query = AuditLog.query
    
    if government_id:
        query = query.filter_by(government_id=government_id)
    
    if event_type:
        query = query.filter_by(event_type=event_type)
    
    if user_id:
        query = query.filter_by(user_id=user_id)
    
    if resource_id:
        query = query.filter_by(resource_id=resource_id)
    
    if start_date:
        query = query.filter(AuditLog.timestamp >= start_date)
    
    if end_date:
        query = query.filter(AuditLog.timestamp <= end_date)
    
    return query.order_by(AuditLog.timestamp.desc()).limit(limit).all()


def get_failed_login_attempts(username, hours=24):
    """
    Get failed login attempts for a user in the last N hours
    """
    since = datetime.utcnow() - timedelta(hours=hours)
    
    return AuditLog.query.filter(
        AuditLog.event_type == 'authentication',
        AuditLog.event_action == 'login',
        AuditLog.event_status == 'failure',
        AuditLog.resource_id == username,
        AuditLog.timestamp >= since
    ).count()


def get_suspicious_activity(government_id, hours=24):
    """
    Get suspicious activity for a government
    """
    since = datetime.utcnow() - timedelta(hours=hours)
    
    # Failed lookups
    failed_lookups = AuditLog.query.filter(
        AuditLog.government_id == government_id,
        AuditLog.event_type == 'ticket_lookup',
        AuditLog.event_status == 'failure',
        AuditLog.timestamp >= since
    ).count()
    
    # Failed payments
    failed_payments = AuditLog.query.filter(
        AuditLog.government_id == government_id,
        AuditLog.event_type == 'payment',
        AuditLog.event_status == 'failure',
        AuditLog.timestamp >= since
    ).count()
    
    # Security events
    security_events = AuditLog.query.filter(
        AuditLog.government_id == government_id,
        AuditLog.event_type == 'security',
        AuditLog.timestamp >= since
    ).count()
    
    return {
        'failed_lookups': failed_lookups,
        'failed_payments': failed_payments,
        'security_events': security_events,
        'total_suspicious': failed_lookups + failed_payments + security_events
    }


def get_audit_statistics(government_id, days=7):
    """
    Get audit statistics for a government
    """
    since = datetime.utcnow() - timedelta(days=days)
    
    total_events = AuditLog.query.filter(
        AuditLog.government_id == government_id,
        AuditLog.timestamp >= since
    ).count()
    
    successful_events = AuditLog.query.filter(
        AuditLog.government_id == government_id,
        AuditLog.event_status == 'success',
        AuditLog.timestamp >= since
    ).count()
    
    failed_events = AuditLog.query.filter(
        AuditLog.government_id == government_id,
        AuditLog.event_status.in_(['failure', 'error']),
        AuditLog.timestamp >= since
    ).count()
    
    # Event type breakdown
    event_types = db.session.query(
        AuditLog.event_type,
        db.func.count(AuditLog.id).label('count')
    ).filter(
        AuditLog.government_id == government_id,
        AuditLog.timestamp >= since
    ).group_by(AuditLog.event_type).all()
    
    return {
        'total_events': total_events,
        'successful_events': successful_events,
        'failed_events': failed_events,
        'success_rate': round((successful_events / total_events * 100) if total_events > 0 else 0, 2),
        'event_types': {et: count for et, count in event_types},
        'period_days': days
    }


# ============================================================================
# AUDIT LOG CLEANUP
# ============================================================================

def cleanup_old_audit_logs(days=365):
    """
    Clean up audit logs older than specified days
    Keep critical security events indefinitely
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    deleted = AuditLog.query.filter(
        AuditLog.timestamp < cutoff_date,
        AuditLog.security_level != 'critical'
    ).delete()
    
    db.session.commit()
    
    current_app.logger.info(f"Cleaned up {deleted} old audit log entries")
    return deleted
