"""
PayFine Platform - Role-Based Access Control (RBAC) System
Defines permissions and role-based access for admin panels
"""

from functools import wraps
from flask import jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from .models import User

# ============================================================================
# PERMISSION CONSTANTS
# ============================================================================

class Permission:
    """Permission constants for different admin panels and actions"""
    
    # Dashboard & Analytics
    VIEW_DASHBOARD = 'view_dashboard'
    VIEW_AI_INSIGHTS = 'view_ai_insights'
    
    # Ticket Management
    VIEW_TICKETS = 'view_tickets'
    CREATE_TICKETS = 'create_tickets'
    EDIT_TICKETS = 'edit_tickets'
    DELETE_TICKETS = 'delete_tickets'
    VOID_TICKETS = 'void_tickets'
    REFUND_TICKETS = 'refund_tickets'
    MARK_PAID = 'mark_paid'
    
    # Challenge Management
    VIEW_CHALLENGES = 'view_challenges'
    REVIEW_CHALLENGES = 'review_challenges'
    APPROVE_CHALLENGES = 'approve_challenges'
    REJECT_CHALLENGES = 'reject_challenges'
    
    # Offence System
    VIEW_OFFENCE_CATEGORIES = 'view_offence_categories'
    MANAGE_OFFENCE_CATEGORIES = 'manage_offence_categories'
    VIEW_OFFENCES = 'view_offences'
    MANAGE_OFFENCES = 'manage_offences'
    VIEW_PENALTY_RULES = 'view_penalty_rules'
    MANAGE_PENALTY_RULES = 'manage_penalty_rules'
    
    # User Management
    VIEW_USERS = 'view_users'
    CREATE_USERS = 'create_users'
    EDIT_USERS = 'edit_users'
    DELETE_USERS = 'delete_users'
    RESET_PASSWORDS = 'reset_passwords'
    
    # Service Management
    VIEW_SERVICES = 'view_services'
    MANAGE_SERVICES = 'manage_services'
    
    # Reports & Finance
    VIEW_REPORTS = 'view_reports'
    EXPORT_REPORTS = 'export_reports'
    VIEW_REVENUE = 'view_revenue'
    
    # Settings
    VIEW_SETTINGS = 'view_settings'
    MANAGE_SETTINGS = 'manage_settings'
    MANAGE_BRANDING = 'manage_branding'
    MANAGE_AI_CONFIG = 'manage_ai_config'
    
    # Late Fee Management
    VIEW_LATE_FEE_CONFIG = 'view_late_fee_config'
    MANAGE_LATE_FEE_CONFIG = 'manage_late_fee_config'
    VIEW_LATE_FEE_RULES = 'view_late_fee_rules'
    MANAGE_LATE_FEE_RULES = 'manage_late_fee_rules'
    WAIVE_LATE_FEES = 'waive_late_fees'
    ADJUST_LATE_FEES = 'adjust_late_fees'
    TRIGGER_LATE_FEE_CALC = 'trigger_late_fee_calc'


# ============================================================================
# ROLE DEFINITIONS
# ============================================================================

class Role:
    """Role constants"""
    ADMIN = 'admin'
    TICKET_MANAGER = 'ticket_manager'
    CHALLENGE_REVIEWER = 'challenge_reviewer'
    FINANCE_MANAGER = 'finance_manager'
    OFFENCE_MANAGER = 'offence_manager'
    USER_MANAGER = 'user_manager'
    WARDEN = 'warden'
    VIEWER = 'viewer'


# ============================================================================
# ROLE-TO-PERMISSIONS MAPPING
# ============================================================================

ROLE_PERMISSIONS = {
    # ADMIN - Full access to everything
    Role.ADMIN: [
        # Dashboard & Analytics
        Permission.VIEW_DASHBOARD,
        Permission.VIEW_AI_INSIGHTS,
        
        # Tickets - Full access
        Permission.VIEW_TICKETS,
        Permission.CREATE_TICKETS,
        Permission.EDIT_TICKETS,
        Permission.DELETE_TICKETS,
        Permission.VOID_TICKETS,
        Permission.REFUND_TICKETS,
        Permission.MARK_PAID,
        
        # Challenges - Full access
        Permission.VIEW_CHALLENGES,
        Permission.REVIEW_CHALLENGES,
        Permission.APPROVE_CHALLENGES,
        Permission.REJECT_CHALLENGES,
        
        # Offence System - Full access
        Permission.VIEW_OFFENCE_CATEGORIES,
        Permission.MANAGE_OFFENCE_CATEGORIES,
        Permission.VIEW_OFFENCES,
        Permission.MANAGE_OFFENCES,
        Permission.VIEW_PENALTY_RULES,
        Permission.MANAGE_PENALTY_RULES,
        
        # Users - Full access
        Permission.VIEW_USERS,
        Permission.CREATE_USERS,
        Permission.EDIT_USERS,
        Permission.DELETE_USERS,
        Permission.RESET_PASSWORDS,
        
        # Services - Full access
        Permission.VIEW_SERVICES,
        Permission.MANAGE_SERVICES,
        
        # Reports - Full access
        Permission.VIEW_REPORTS,
        Permission.EXPORT_REPORTS,
        Permission.VIEW_REVENUE,
        
        # Settings - Full access
        Permission.VIEW_SETTINGS,
        Permission.MANAGE_SETTINGS,
        Permission.MANAGE_BRANDING,
        Permission.MANAGE_AI_CONFIG,
        
        # Late Fees - Full access
        Permission.VIEW_LATE_FEE_CONFIG,
        Permission.MANAGE_LATE_FEE_CONFIG,
        Permission.VIEW_LATE_FEE_RULES,
        Permission.MANAGE_LATE_FEE_RULES,
        Permission.WAIVE_LATE_FEES,
        Permission.ADJUST_LATE_FEES,
        Permission.TRIGGER_LATE_FEE_CALC,
    ],
    
    # TICKET MANAGER - Tickets only (no challenges, no dashboard)
    Role.TICKET_MANAGER: [
        Permission.VIEW_TICKETS,
        Permission.CREATE_TICKETS,
        Permission.EDIT_TICKETS,
        Permission.VOID_TICKETS,
        Permission.MARK_PAID,
    ],
    
    # CHALLENGE REVIEWER - Review and manage ticket challenges
    Role.CHALLENGE_REVIEWER: [
        Permission.VIEW_TICKETS,  # Read-only ticket access
        Permission.VIEW_CHALLENGES,
        Permission.REVIEW_CHALLENGES,
        Permission.APPROVE_CHALLENGES,
        Permission.REJECT_CHALLENGES,
    ],
    
    # FINANCE MANAGER - Reports, Dashboard, and Late Fee viewing
    Role.FINANCE_MANAGER: [
        Permission.VIEW_DASHBOARD,
        Permission.VIEW_REPORTS,
        Permission.EXPORT_REPORTS,
        Permission.VIEW_REVENUE,
        Permission.VIEW_LATE_FEE_CONFIG,
        Permission.VIEW_LATE_FEE_RULES,
    ],
    
    # OFFENCE MANAGER - Offence system management
    Role.OFFENCE_MANAGER: [
        Permission.VIEW_DASHBOARD,
        Permission.VIEW_OFFENCE_CATEGORIES,
        Permission.MANAGE_OFFENCE_CATEGORIES,
        Permission.VIEW_OFFENCES,
        Permission.MANAGE_OFFENCES,
        Permission.VIEW_PENALTY_RULES,
        Permission.MANAGE_PENALTY_RULES,
        Permission.VIEW_TICKETS,  # Read-only to see how offences are used
    ],
    
    # USER MANAGER - User management only
    Role.USER_MANAGER: [
        Permission.VIEW_DASHBOARD,
        Permission.VIEW_USERS,
        Permission.CREATE_USERS,
        Permission.EDIT_USERS,
        Permission.DELETE_USERS,
        Permission.RESET_PASSWORDS,
    ],
    
    # WARDEN - Create tickets, view recent tickets
    Role.WARDEN: [
        Permission.VIEW_TICKETS,
        Permission.CREATE_TICKETS,
        Permission.VIEW_SERVICES,
        Permission.VIEW_OFFENCES,
        Permission.VIEW_OFFENCE_CATEGORIES,
        Permission.VIEW_PENALTY_RULES,
    ],
    
    # VIEWER - Read-only access to Dashboard and Reports
    Role.VIEWER: [
        Permission.VIEW_DASHBOARD,
        Permission.VIEW_TICKETS,
        Permission.VIEW_REPORTS,
        Permission.VIEW_SERVICES,
    ],
}


# ============================================================================
# PERMISSION CHECKING FUNCTIONS
# ============================================================================

def get_user_permissions(user):
    """
    Get all permissions for a user based on their role
    
    Args:
        user: User object
    
    Returns:
        list: List of permission strings
    """
    if not user:
        return []
    
    # Get permissions for user's role (admin role gets all permissions via ROLE_PERMISSIONS)
    role = user.role
    if role in ROLE_PERMISSIONS:
        return ROLE_PERMISSIONS[role]
    
    # Default to empty permissions
    return []


def user_has_permission(user, permission):
    """
    Check if user has a specific permission
    
    Args:
        user: User object
        permission: Permission constant to check
    
    Returns:
        bool: True if user has permission
    """
    if not user:
        return False
    
    # Check if permission is in user's role permissions
    user_permissions = get_user_permissions(user)
    return permission in user_permissions


def user_has_any_permission(user, permissions):
    """
    Check if user has any of the specified permissions
    
    Args:
        user: User object
        permissions: List of permission constants
    
    Returns:
        bool: True if user has at least one permission
    """
    if not user:
        return False
    
    for permission in permissions:
        if user_has_permission(user, permission):
            return True
    
    return False


def user_has_all_permissions(user, permissions):
    """
    Check if user has all of the specified permissions
    
    Args:
        user: User object
        permissions: List of permission constants
    
    Returns:
        bool: True if user has all permissions
    """
    if not user:
        return False
    
    for permission in permissions:
        if not user_has_permission(user, permission):
            return False
    
    return True


# ============================================================================
# PERMISSION DECORATORS
# ============================================================================

def permission_required(permission):
    """
    Decorator to require a specific permission
    
    Usage:
        @permission_required(Permission.VIEW_TICKETS)
        def get_tickets(current_user):
            ...
    """
    def wrapper(fn):
        @wraps(fn)
        @jwt_required()
        def decorator(*args, **kwargs):
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            if not user_has_permission(user, permission):
                return jsonify({
                    'error': 'Permission denied',
                    'message': f'You do not have permission to perform this action',
                    'required_permission': permission
                }), 403
            
            # Pass user to the function
            return fn(*args, **kwargs, current_user=user)
        
        return decorator
    return wrapper


def any_permission_required(permissions):
    """
    Decorator to require any of the specified permissions
    
    Usage:
        @any_permission_required([Permission.VIEW_TICKETS, Permission.CREATE_TICKETS])
        def ticket_action(current_user):
            ...
    """
    def wrapper(fn):
        @wraps(fn)
        @jwt_required()
        def decorator(*args, **kwargs):
            from flask_jwt_extended import get_jwt_identity
            
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            if not user_has_any_permission(user, permissions):
                return jsonify({
                    'error': 'Permission denied',
                    'message': f'You do not have permission to perform this action',
                    'required_permissions': permissions
                }), 403
            
            return fn(*args, **kwargs, current_user=user)
        
        return decorator
    return wrapper


def all_permissions_required(permissions):
    """
    Decorator to require all of the specified permissions
    
    Usage:
        @all_permissions_required([Permission.EDIT_TICKETS, Permission.VOID_TICKETS])
        def advanced_ticket_action(current_user):
            ...
    """
    def wrapper(fn):
        @wraps(fn)
        @jwt_required()
        def decorator(*args, **kwargs):
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            if not user_has_all_permissions(user, permissions):
                return jsonify({
                    'error': 'Permission denied',
                    'message': f'You do not have all required permissions to perform this action',
                    'required_permissions': permissions
                }), 403
            
            return fn(*args, **kwargs, current_user=user)
        
        return decorator
    return wrapper


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_available_roles():
    """Get list of all available roles"""
    return [
        {'value': Role.ADMIN, 'label': 'Administrator', 'description': 'Full access to all features'},
        {'value': Role.TICKET_MANAGER, 'label': 'Ticket Manager', 'description': 'Manage tickets only'},
        {'value': Role.CHALLENGE_REVIEWER, 'label': 'Challenge Reviewer', 'description': 'Review and manage ticket challenges'},
        {'value': Role.FINANCE_MANAGER, 'label': 'Finance Manager', 'description': 'View reports and financial data'},
        {'value': Role.OFFENCE_MANAGER, 'label': 'Offence Manager', 'description': 'Manage offences and penalty rules'},
        {'value': Role.USER_MANAGER, 'label': 'User Manager', 'description': 'Manage user accounts'},
        {'value': Role.WARDEN, 'label': 'Warden', 'description': 'Issue tickets in the field'},
        {'value': Role.VIEWER, 'label': 'Viewer', 'description': 'Read-only access to dashboard and reports'},
    ]


def get_role_permissions_map():
    """Get complete role-to-permissions mapping for frontend"""
    return {
        role: {
            'permissions': permissions,
            'panels': get_accessible_panels(permissions)
        }
        for role, permissions in ROLE_PERMISSIONS.items()
    }


def get_accessible_panels(permissions):
    """
    Get list of accessible admin panels based on permissions
    
    Args:
        permissions: List of permission strings
    
    Returns:
        list: List of panel names user can access
    """
    panels = []
    
    if Permission.VIEW_DASHBOARD in permissions:
        panels.append('dashboard')
    
    if Permission.VIEW_AI_INSIGHTS in permissions:
        panels.append('ai-insights')
    
    if Permission.VIEW_TICKETS in permissions:
        panels.append('tickets')
    
    if Permission.VIEW_CHALLENGES in permissions:
        panels.append('challenges')
    
    if Permission.VIEW_OFFENCE_CATEGORIES in permissions:
        panels.append('offence-categories')
    
    if Permission.VIEW_OFFENCES in permissions:
        panels.append('offences')
    
    if Permission.VIEW_PENALTY_RULES in permissions:
        panels.append('penalty-rules')
    
    if Permission.VIEW_USERS in permissions:
        panels.append('users')
    
    if Permission.VIEW_SERVICES in permissions:
        panels.append('services')
    
    if Permission.VIEW_REPORTS in permissions:
        panels.append('reports')
    
    if Permission.VIEW_SETTINGS in permissions:
        panels.append('settings')
    
    if Permission.VIEW_LATE_FEE_CONFIG in permissions or Permission.VIEW_LATE_FEE_RULES in permissions:
        panels.append('late-fees')
    
    return panels


def get_user_accessible_panels(user):
    """
    Get list of panels accessible to a specific user
    Includes custom panel overrides if set
    
    Args:
        user: User object
    
    Returns:
        list: List of panel names
    """
    # Check if user has custom panels set
    custom_panels = user.get_custom_panels()
    if custom_panels is not None:
        # User has custom panel access - use that instead of role-based
        return custom_panels
    
    # No custom panels - use role-based permissions
    permissions = get_user_permissions(user)
    return get_accessible_panels(permissions)
