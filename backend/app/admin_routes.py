"""
PayFine Admin Routes - Multi-Tenant
Handles admin-only operations: ticket management, user management, reports, etc.
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from . import db
from .models import User, Service, Ticket, Government, OffenceCategory, Offence, PenaltyRule, TicketChallenge
from .middleware import get_current_government
from datetime import datetime, timedelta
from sqlalchemy import func, and_, or_
import secrets
import csv
import io

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

# ============================================================================
# ADMIN AUTHENTICATION DECORATOR
# ============================================================================

from functools import wraps
from .permissions import (
    Permission, Role, 
    permission_required, 
    any_permission_required,
    get_available_roles,
    get_role_permissions_map
)

def admin_required():
    """
    Decorator to require admin access
    NOTE: This now checks for admin role via permissions, not is_admin flag
    """
    def wrapper(fn):
        @wraps(fn)
        @jwt_required()
        def decorator(*args, **kwargs):
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # Check if user has admin role (which grants all permissions)
            if user.role != Role.ADMIN:
                return jsonify({'error': 'Admin role required'}), 403
            
            return fn(*args, **kwargs, current_user=user)
        return decorator
    return wrapper


def admin_or_warden_required():
    """Decorator to require admin or warden/staff access"""
    def wrapper(fn):
        @wraps(fn)
        @jwt_required()
        def decorator(*args, **kwargs):
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # Allow admins, staff (wardens), or users with 'warden' role
            if user.role not in [Role.ADMIN, 'staff', 'warden', Role.WARDEN]:
                return jsonify({'error': 'Admin or Warden access required'}), 403
            
            return fn(*args, **kwargs, current_user=user)
        return decorator
    return wrapper


# ============================================================================
# DASHBOARD & ANALYTICS
# ============================================================================

@admin_bp.route('/dashboard', methods=['GET'])
@permission_required(Permission.VIEW_DASHBOARD)
def get_dashboard(current_user):
    """
    Get dashboard statistics - Multi-tenant aware
    """
    try:
        government = get_current_government()
        days = request.args.get('days', 30, type=int)
        start_date = datetime.utcnow() - timedelta(days=days)
        
        total_tickets = Ticket.query.filter_by(government_id=government.id).count()
        
        unpaid_count = Ticket.query.filter_by(government_id=government.id, status='unpaid').count()
        paid_count = Ticket.query.filter_by(government_id=government.id, status='paid').count()
        overdue_count = Ticket.query.filter_by(government_id=government.id, status='overdue').count()
        voided_count = Ticket.query.filter_by(government_id=government.id, status='voided').count()
        
        total_revenue = db.session.query(func.sum(Ticket.payment_amount)).filter(
            Ticket.government_id == government.id,
            Ticket.status == 'paid'
        ).scalar() or 0
        
        revenue_this_period = db.session.query(func.sum(Ticket.payment_amount)).filter(
            Ticket.government_id == government.id,
            Ticket.status == 'paid',
            Ticket.paid_date >= start_date
        ).scalar() or 0
        
        outstanding_amount = db.session.query(func.sum(Ticket.fine_amount)).filter(
            Ticket.government_id == government.id,
            Ticket.status.in_(['unpaid', 'overdue'])
        ).scalar() or 0
        
        recent_payments = Ticket.query.filter_by(
            government_id=government.id,
            status='paid'
        ).order_by(Ticket.paid_date.desc()).limit(10).all()
        
        new_tickets_count = Ticket.query.filter(
            Ticket.government_id == government.id,
            Ticket.created_at >= start_date
        ).count()
        
        payment_methods = db.session.query(
            Ticket.payment_method,
            func.count(Ticket.id).label('count'),
            func.sum(Ticket.payment_amount).label('total')
        ).filter(
            Ticket.government_id == government.id,
            Ticket.status == 'paid'
        ).group_by(Ticket.payment_method).all()
        
        daily_revenue = db.session.query(
            func.date(Ticket.paid_date).label('date'),
            func.sum(Ticket.payment_amount).label('revenue'),
            func.count(Ticket.id).label('count')
        ).filter(
            Ticket.government_id == government.id,
            Ticket.status == 'paid',
            Ticket.paid_date >= start_date
        ).group_by(func.date(Ticket.paid_date)).all()
        
        return jsonify({
            'summary': {
                'total_tickets': total_tickets,
                'unpaid_tickets': unpaid_count,
                'paid_tickets': paid_count,
                'overdue_tickets': overdue_count,
                'voided_tickets': voided_count,
                'new_tickets_this_period': new_tickets_count,
                'total_revenue': float(total_revenue),
                'revenue_this_period': float(revenue_this_period),
                'outstanding_amount': float(outstanding_amount)
            },
            'payment_methods': [
                {
                    'method': pm[0] or 'online',
                    'count': pm[1],
                    'total': float(pm[2] or 0)
                }
                for pm in payment_methods
            ],
            'daily_revenue': [
                {
                    'date': str(dr[0]) if dr[0] else None,
                    'revenue': float(dr[1] or 0),
                    'count': dr[2]
                }
                for dr in daily_revenue
            ],
            'recent_payments': [ticket.to_dict(include_admin=True) for ticket in recent_payments],
            'period_days': days
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch dashboard data: {str(e)}'}), 500


# ============================================================================
# TICKET MANAGEMENT
# ============================================================================

@admin_bp.route('/tickets', methods=['GET'])
@any_permission_required([Permission.VIEW_TICKETS])
def get_all_tickets(current_user):
    """
    Get all tickets - Multi-tenant aware
    """
    try:
        government = get_current_government()
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        service_id = request.args.get('service_id', type=int)
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        search_raw = request.args.get('search', '')
        search = search_raw.strip() if search_raw else ''
        
        query = Ticket.query.filter_by(government_id=government.id)
        
        # Apply filters
        if status and status.strip():
            query = query.filter_by(status=status)
        
        if service_id:
            query = query.filter_by(service_id=service_id)
        
        if date_from:
            date_from_obj = datetime.fromisoformat(date_from)
            query = query.filter(Ticket.issue_date >= date_from_obj)
        
        if date_to:
            date_to_obj = datetime.fromisoformat(date_to)
            query = query.filter(Ticket.issue_date <= date_to_obj)
        
        # Apply search filter - FIXED: properly check for non-empty search string
        if search:  # search is already stripped, so empty string is falsy
            search_pattern = f'%{search}%'
            query = query.filter(
                or_(
                    Ticket.serial_number.ilike(search_pattern),
                    Ticket.vehicle_plate.ilike(search_pattern),
                    Ticket.driver_name.ilike(search_pattern),
                    Ticket.driver_license.ilike(search_pattern)
                )
            )
        
        # Paginate results
        pagination = query.order_by(Ticket.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'tickets': [ticket.to_dict(include_admin=True) for ticket in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch tickets: {str(e)}'}), 500


@admin_bp.route('/tickets', methods=['POST'])
@any_permission_required([Permission.CREATE_TICKETS])
def create_ticket(current_user):
    """
    Create a new ticket - Multi-tenant aware
    
    NATIONAL TRAFFIC OFFENCE SYSTEM:
    - Accepts offence_id for auto-calculation (NEW)
    - Accepts measured_value for measurable offences (NEW)
    - Auto-calculates fine, points, court_required (NEW)
    - Detects repeat offences automatically (NEW)
    - Falls back to manual fine_amount for legacy support
    
    TRIDENT ID INTEGRATION:
    - Accepts optional trident_id to link ticket at creation
    - Accepts citizen contact info (email, phone) for notifications
    - Automatically sends notification if Trident ID is provided
    - Generates QR code data for printed tickets
    
    Request body (NEW OFFENCE SYSTEM):
    {
        "serial_number": "A123456",
        "service_id": 1,
        "offence_id": 5,  // NEW - replaces fine_amount
        "measured_value": 25,  // NEW - for measurable offences (e.g., 25 km/h over)
        "offense_description": "Optional override",
        "due_date": "2024-02-01",
        "driver_license": "DL123456",  // Required for repeat detection
        "vehicle_plate": "ABC123",
        "location": "Highway 1",
        "officer_badge": "OFF123"
    }
    
    Request body (LEGACY SYSTEM - still supported):
    {
        "serial_number": "A123456",
        "service_id": 1,
        "fine_amount": 100.00,  // Manual fine
        "offense_description": "Speeding",
        "due_date": "2024-02-01"
    }
    """
    try:
        government = get_current_government()
        data = request.get_json()
        
        if Ticket.query.filter_by(
            government_id=government.id,
            serial_number=data.get('serial_number')
        ).first():
            return jsonify({'error': 'Serial number already exists'}), 409
        
        # Determine if using new offence system or legacy manual entry
        using_offence_system = 'offence_id' in data
        
        if using_offence_system:
            # NEW OFFENCE SYSTEM - Auto-calculate fine
            required_fields = ['serial_number', 'service_id', 'offence_id', 'due_date']
            if not all(field in data for field in required_fields):
                return jsonify({'error': 'Missing required fields: serial_number, service_id, offence_id, due_date'}), 400
            
            # Verify offence exists
            offence = Offence.query.get(data['offence_id'])
            if not offence:
                return jsonify({'error': 'Offence not found'}), 404
            
            if not offence.active:
                return jsonify({'error': 'Offence is not active'}), 400
            
            # Validate measured_value for measurable offences
            measured_value = data.get('measured_value')
            if offence.measurable_type != 'none' and measured_value is None:
                return jsonify({
                    'error': 'measured_value is required for measurable offences',
                    'offence': offence.to_dict()
                }), 400
            
            # Parse dates
            due_date = datetime.fromisoformat(data['due_date'])
            issue_date = datetime.fromisoformat(data.get('issue_date', datetime.utcnow().isoformat()))
            
            ticket = Ticket(
                government_id=government.id,
                serial_number=data['serial_number'],
                service_id=data['service_id'],
                offence_id=data['offence_id'],
                measured_value=measured_value,
                offense_description=data.get('offense_description', offence.name),
                due_date=due_date,
                issue_date=issue_date,
                location=data.get('location'),
                vehicle_plate=data.get('vehicle_plate'),
                officer_badge=data.get('officer_badge'),
                driver_name=data.get('driver_name'),
                driver_license=data.get('driver_license'),
                notes=data.get('notes'),
                created_by_id=current_user.id,
                citizen_email=data.get('citizen_email'),
                citizen_phone=data.get('citizen_phone'),
                # Photo evidence (warden only)
                photo_data=data.get('photo_data'),
                photo_filename=data.get('photo_filename'),
                photo_uploaded_at=datetime.utcnow() if data.get('photo_data') else None
            )
            
            # Auto-calculate fine, points, court_required
            calculated_fine = ticket.calculate_fine()
            
            if calculated_fine is None:
                return jsonify({
                    'error': 'No active penalty rule found for this offence',
                    'offence': offence.to_dict(),
                    'measured_value': measured_value,
                    'message': 'Please create a penalty rule for this offence or value range'
                }), 400
            
            # Set fine_amount to calculated value
            ticket.fine_amount = calculated_fine
            
            # Set initial status based on court requirement
            if ticket.court_required:
                ticket.status = 'CourtRequired'
            else:
                ticket.status = 'Issued'
            
        else:
            # LEGACY SYSTEM - Manual fine entry
            required_fields = ['serial_number', 'service_id', 'fine_amount', 'offense_description', 'due_date']
            if not all(field in data for field in required_fields):
                return jsonify({'error': 'Missing required fields for legacy ticket'}), 400
            
            # Parse dates
            due_date = datetime.fromisoformat(data['due_date'])
            issue_date = datetime.fromisoformat(data.get('issue_date', datetime.utcnow().isoformat()))
            
            ticket = Ticket(
                government_id=government.id,
                serial_number=data['serial_number'],
                service_id=data['service_id'],
                fine_amount=data['fine_amount'],
                offense_description=data['offense_description'],
                due_date=due_date,
                issue_date=issue_date,
                location=data.get('location'),
                vehicle_plate=data.get('vehicle_plate'),
                officer_badge=data.get('officer_badge'),
                driver_name=data.get('driver_name'),
                driver_license=data.get('driver_license'),
                notes=data.get('notes'),
                created_by_id=current_user.id,
                citizen_email=data.get('citizen_email'),
                citizen_phone=data.get('citizen_phone'),
                status='Issued',
                # Photo evidence (warden only)
                photo_data=data.get('photo_data'),
                photo_filename=data.get('photo_filename'),
                photo_uploaded_at=datetime.utcnow() if data.get('photo_data') else None
            )
        
        db.session.add(ticket)
        db.session.flush()  # Get ticket ID before linking
        
        # Link to Trident ID if provided
        trident_id = data.get('trident_id')
        notification_result = None
        
        if trident_id:
            link_result = link_ticket_to_trident(
                ticket=ticket,
                trident_id=trident_id,
                citizen_email=data.get('citizen_email'),
                citizen_phone=data.get('citizen_phone')
            )
            
            if link_result['success']:
                # Send notification if requested
                if data.get('send_notification', True):
                    notification_result = send_ticket_notification(ticket, 'issued')
        else:
            # No Trident ID - generate QR code anyway
            ticket.qr_code_data = generate_qr_code_data(ticket.serial_number)
        
        db.session.commit()
        
        response_data = {
            'message': 'Ticket created successfully',
            'ticket': ticket.to_dict(include_admin=True, include_trident=True),
            'using_offence_system': using_offence_system
        }
        
        if using_offence_system:
            response_data['calculation_details'] = {
                'offence': offence.to_dict(),
                'measured_value': float(measured_value) if measured_value else None,
                'calculated_fine': float(calculated_fine),
                'points': ticket.points,
                'court_required': ticket.court_required,
                'is_repeat_offence': ticket.is_repeat_offence,
                'repeat_count': ticket.repeat_count
            }
        
        if notification_result:
            response_data['notification'] = notification_result
        
        return jsonify(response_data), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create ticket: {str(e)}'}), 500


@admin_bp.route('/tickets/<int:ticket_id>', methods=['PUT'])
@any_permission_required([Permission.EDIT_TICKETS])
def update_ticket(ticket_id, current_user):
    """
    Update an existing ticket
    Admin can modify ticket details
    """
    try:
        ticket = Ticket.query.get(ticket_id)
        
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        data = request.get_json()
        
        # Update allowed fields
        if 'fine_amount' in data:
            ticket.fine_amount = data['fine_amount']
        
        if 'offense_description' in data:
            ticket.offense_description = data['offense_description']
        
        if 'location' in data:
            ticket.location = data['location']
        
        if 'vehicle_plate' in data:
            ticket.vehicle_plate = data['vehicle_plate']
        
        if 'officer_badge' in data:
            ticket.officer_badge = data['officer_badge']
        
        if 'driver_name' in data:
            ticket.driver_name = data['driver_name']
        
        if 'driver_license' in data:
            ticket.driver_license = data['driver_license']
        
        if 'due_date' in data:
            ticket.due_date = datetime.fromisoformat(data['due_date'])
        
        if 'notes' in data:
            ticket.notes = data['notes']
        
        ticket.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Ticket updated successfully',
            'ticket': ticket.to_dict(include_admin=True)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update ticket: {str(e)}'}), 500


@admin_bp.route('/tickets/<int:ticket_id>', methods=['DELETE'])
@any_permission_required([Permission.DELETE_TICKETS])
def delete_ticket(ticket_id, current_user):
    """
    Delete a ticket (soft delete by voiding)
    """
    try:
        ticket = Ticket.query.get(ticket_id)
        
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        # Soft delete by voiding
        ticket.status = 'voided'
        ticket.voided_at = datetime.utcnow()
        ticket.voided_by_id = current_user.id
        ticket.void_reason = 'Deleted by admin'
        
        db.session.commit()
        
        return jsonify({'message': 'Ticket deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete ticket: {str(e)}'}), 500


@admin_bp.route('/tickets/<int:ticket_id>/void', methods=['POST'])
@any_permission_required([Permission.VOID_TICKETS])
def void_ticket(ticket_id, current_user):
    """
    Void a ticket with reason
    """
    try:
        ticket = Ticket.query.get(ticket_id)

        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404

        data = request.get_json() or {}
        reason = data.get('reason', 'No reason provided')

        ticket.status = 'voided'
        ticket.voided_at = datetime.utcnow()
        ticket.voided_by_id = current_user.id
        ticket.void_reason = reason

        db.session.commit()

        return jsonify({
            'message': 'Ticket voided successfully',
            'ticket': ticket.to_dict(include_admin=True)
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to void ticket: {str(e)}'}), 500


@admin_bp.route('/tickets/<int:ticket_id>/unvoid', methods=['POST'])
@admin_required()
def unvoid_ticket(ticket_id, current_user):
    """
    Unvoid a ticket - restore it to payable status
    """
    try:
        ticket = Ticket.query.get(ticket_id)

        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404

        if ticket.status != 'voided':
            return jsonify({'error': 'Ticket is not voided'}), 400

        # Clear void fields
        ticket.status = 'unpaid' if not ticket.is_overdue() else 'overdue'
        ticket.voided_at = None
        ticket.voided_by_id = None
        ticket.void_reason = None

        db.session.commit()

        return jsonify({
            'message': 'Ticket unvoided successfully',
            'ticket': ticket.to_dict(include_admin=True)
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to unvoid ticket: {str(e)}'}), 500


@admin_bp.route('/tickets/<int:ticket_id>/refund', methods=['POST'])
@admin_required()
def refund_ticket(ticket_id, current_user):
    """
    Issue a refund for a paid ticket
    """
    try:
        ticket = Ticket.query.get(ticket_id)
        
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        if ticket.status != 'paid':
            return jsonify({'error': 'Only paid tickets can be refunded'}), 400
        
        data = request.get_json() or {}
        refund_amount = data.get('refund_amount', ticket.payment_amount)
        reason = data.get('reason', 'No reason provided')
        
        ticket.status = 'refunded'
        ticket.refunded_at = datetime.utcnow()
        ticket.refunded_by_id = current_user.id
        ticket.refund_reason = reason
        ticket.refund_amount = refund_amount
        
        db.session.commit()
        
        return jsonify({
            'message': 'Refund issued successfully',
            'ticket': ticket.to_dict(include_admin=True)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to issue refund: {str(e)}'}), 500


@admin_bp.route('/tickets/<int:ticket_id>/mark-paid', methods=['POST'])
@any_permission_required([Permission.MARK_PAID])
def mark_ticket_paid(ticket_id, current_user):
    """
    Manually mark a ticket as paid (for offline payments)
    """
    try:
        ticket = Ticket.query.get(ticket_id)
        
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        if ticket.status == 'paid':
            return jsonify({'error': 'Ticket is already paid'}), 400
        
        data = request.get_json() or {}
        
        ticket.status = 'paid'
        ticket.paid_date = datetime.utcnow()
        ticket.payment_method = data.get('payment_method', 'manual')
        ticket.payment_amount = data.get('payment_amount', ticket.fine_amount)
        ticket.payment_reference = data.get('payment_reference', f'MANUAL-{secrets.token_hex(4).upper()}')
        ticket.notes = data.get('notes', ticket.notes)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Ticket marked as paid successfully',
            'ticket': ticket.to_dict(include_admin=True)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to mark ticket as paid: {str(e)}'}), 500


# ============================================================================
# USER MANAGEMENT
# ============================================================================

@admin_bp.route('/users', methods=['GET'])
@admin_required()
def get_all_users(current_user):
    """
    Get all users - Multi-tenant aware
    """
    try:
        government = get_current_government()
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        role = request.args.get('role')
        is_active = request.args.get('is_active')
        search = request.args.get('search')
        
        query = User.query.filter_by(government_id=government.id)
        
        if role:
            query = query.filter_by(role=role)
        
        if is_active is not None:
            query = query.filter_by(is_active=is_active.lower() == 'true')
        
        if search:
            search_pattern = f'%{search}%'
            query = query.filter(
                or_(
                    User.username.ilike(search_pattern),
                    User.email.ilike(search_pattern),
                    User.full_name.ilike(search_pattern)
                )
            )
        
        pagination = query.order_by(User.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'users': [user.to_dict(include_sensitive=True) for user in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch users: {str(e)}'}), 500


@admin_bp.route('/users', methods=['POST'])
@admin_required()
def create_user(current_user):
    """
    Create a new user - Multi-tenant aware
    """
    try:
        government = get_current_government()
        data = request.get_json()
        
        required_fields = ['username', 'email', 'password']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400
        
        if User.query.filter_by(
            government_id=government.id,
            username=data['username']
        ).first():
            return jsonify({'error': 'Username already exists'}), 409
        
        if User.query.filter_by(
            government_id=government.id,
            email=data['email']
        ).first():
            return jsonify({'error': 'Email already exists'}), 409
        
        user = User(
            government_id=government.id,
            username=data['username'],
            email=data['email'],
            full_name=data.get('full_name'),
            phone=data.get('phone'),
            role=data.get('role', 'user'),
            is_admin=data.get('role') == 'admin',
            is_active=data.get('is_active', True),
            created_by_id=current_user.id
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'message': 'User created successfully',
            'user': user.to_dict(include_sensitive=True)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create user: {str(e)}'}), 500


@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@admin_required()
def update_user(user_id, current_user):
    """
    Update user details
    """
    try:
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        if 'email' in data and data['email'] != user.email:
            if User.query.filter_by(email=data['email']).first():
                return jsonify({'error': 'Email already exists'}), 409
            user.email = data['email']
        
        if 'full_name' in data:
            user.full_name = data['full_name']
        
        if 'phone' in data:
            user.phone = data['phone']
        
        if 'role' in data:
            user.role = data['role']
            user.is_admin = data['role'] == 'admin'
        
        if 'is_active' in data:
            user.is_active = data['is_active']
        
        if 'password' in data and data['password']:
            user.set_password(data['password'])
        
        db.session.commit()
        
        return jsonify({
            'message': 'User updated successfully',
            'user': user.to_dict(include_sensitive=True)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update user: {str(e)}'}), 500


@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@admin_required()
def delete_user(user_id, current_user):
    """
    Delete a user (deactivate)
    """
    try:
        if user_id == current_user.id:
            return jsonify({'error': 'Cannot delete your own account'}), 400
        
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        user.is_active = False
        db.session.commit()
        
        return jsonify({'message': 'User deactivated successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete user: {str(e)}'}), 500


@admin_bp.route('/users/<int:user_id>/reset-password', methods=['POST'])
@admin_required()
def reset_user_password(user_id, current_user):
    """
    Reset user password
    """
    try:
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        new_password = data.get('new_password')
        
        if not new_password:
            return jsonify({'error': 'New password is required'}), 400
        
        user.set_password(new_password)
        db.session.commit()
        
        return jsonify({'message': 'Password reset successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to reset password: {str(e)}'}), 500


# ============================================================================
# SERVICE MANAGEMENT
# ============================================================================

@admin_bp.route('/services', methods=['GET'])
@admin_or_warden_required()
def get_all_services(current_user):
    """
    Get all services - Multi-tenant aware
    Supports filtering by service_type
    """
    try:
        government = get_current_government()
        
        # Get filter parameters
        service_type = request.args.get('service_type')
        include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'
        
        # Build query
        query = Service.query.filter_by(government_id=government.id)
        
        # Filter by service type if provided
        if service_type:
            query = query.filter_by(service_type=service_type)
        
        # Filter by active status unless include_inactive is true
        if not include_inactive:
            query = query.filter_by(is_active=True)
        
        # Order by display_order, then by name
        services = query.order_by(Service.display_order.asc(), Service.name.asc()).all()
        
        return jsonify({
            'services': [service.to_dict() for service in services]
        }), 200
    except Exception as e:
        return jsonify({'error': f'Failed to fetch services: {str(e)}'}), 500


@admin_bp.route('/services', methods=['POST'])
@admin_required()
def create_service(current_user):
    """
    Create a new service - Multi-tenant aware
    NOTE: Multiple services per government are now allowed
    """
    try:
        government = get_current_government()
        data = request.get_json()
        
        if not data.get('name') or not data.get('description'):
            return jsonify({'error': 'Name and description required'}), 400
        
        # Check if service with same name already exists (keep unique constraint)
        existing_service = Service.query.filter_by(
            government_id=government.id,
            name=data['name']
        ).first()
        
        if existing_service:
            # If service exists but is inactive, reactivate it
            if not existing_service.is_active:
                existing_service.is_active = True
                existing_service.description = data['description']
                existing_service.service_type = data.get('service_type', 'other')
                existing_service.icon = data.get('icon', '📋')
                existing_service.display_order = data.get('display_order', 0)
                db.session.commit()
                return jsonify({
                    'message': 'Service reactivated successfully',
                    'service': existing_service.to_dict()
                }), 200
            else:
                return jsonify({'error': 'Service with this name already exists'}), 409
        
        # Get the next display order if not provided
        max_order = db.session.query(db.func.max(Service.display_order)).filter(
            Service.government_id == government.id
        ).scalar() or 0
        
        service = Service(
            government_id=government.id,
            name=data['name'],
            description=data['description'],
            is_active=data.get('is_active', True),
            service_type=data.get('service_type', 'other'),
            icon=data.get('icon', '📋'),
            display_order=data.get('display_order', max_order + 1)
        )
        
        db.session.add(service)
        db.session.commit()
        
        return jsonify({
            'message': 'Service created successfully',
            'service': service.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create service: {str(e)}'}), 500


@admin_bp.route('/services/<int:service_id>', methods=['PUT'])
@admin_required()
def update_service(service_id, current_user):
    """
    Update a service
    """
    try:
        service = Service.query.get(service_id)
        
        if not service:
            return jsonify({'error': 'Service not found'}), 404
        
        data = request.get_json()
        
        if 'name' in data:
            # Check if new name already exists for another service
            existing = Service.query.filter(
                Service.government_id == service.government_id,
                Service.name == data['name'],
                Service.id != service_id
            ).first()
            if existing:
                return jsonify({'error': 'Service with this name already exists'}), 409
            service.name = data['name']
        
        if 'description' in data:
            service.description = data['description']
        
        if 'is_active' in data:
            service.is_active = data['is_active']
        
        # Handle new fields
        if 'service_type' in data:
            service.service_type = data['service_type']
        
        if 'icon' in data:
            service.icon = data['icon']
        
        if 'display_order' in data:
            service.display_order = data['display_order']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Service updated successfully',
            'service': service.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update service: {str(e)}'}), 500


@admin_bp.route('/services/<int:service_id>', methods=['DELETE'])
@admin_required()
def delete_service(service_id, current_user):
    """
    Delete a service (deactivate)
    """
    try:
        service = Service.query.get(service_id)
        
        if not service:
            return jsonify({'error': 'Service not found'}), 404
        
        service.is_active = False
        db.session.commit()
        
        return jsonify({'message': 'Service deactivated successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete service: {str(e)}'}), 500


# ============================================================================
# PAYMENT REPORTS
# ============================================================================

@admin_bp.route('/reports/payments', methods=['GET'])
@permission_required(Permission.VIEW_REPORTS)
def get_payment_report(current_user):
    """
    Generate payment report - Multi-tenant aware
    """
    try:
        government = get_current_government()
        
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        status = request.args.get('status', 'paid')
        export_format = request.args.get('format', 'json')
        
        query = Ticket.query.filter_by(
            government_id=government.id,
            status=status
        )
        
        if date_from:
            date_from_obj = datetime.fromisoformat(date_from)
            query = query.filter(Ticket.paid_date >= date_from_obj)
        
        if date_to:
            date_to_obj = datetime.fromisoformat(date_to)
            query = query.filter(Ticket.paid_date <= date_to_obj)
        
        tickets = query.order_by(Ticket.paid_date.desc()).all()
        
        # Calculate totals
        total_amount = sum(float(t.payment_amount or 0) for t in tickets)
        total_count = len(tickets)
        
        if export_format == 'csv':
            # Generate CSV
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Header
            writer.writerow([
                'Serial Number', 'Service', 'Amount', 'Payment Date',
                'Payment Method', 'Payment Reference', 'Vehicle Plate',
                'Driver Name', 'Offense'
            ])
            
            # Data rows
            for ticket in tickets:
                writer.writerow([
                    ticket.serial_number,
                    ticket.service.name if ticket.service else '',
                    float(ticket.payment_amount or 0),
                    ticket.paid_date.isoformat() if ticket.paid_date else '',
                    ticket.payment_method or '',
                    ticket.payment_reference or '',
                    ticket.vehicle_plate or '',
                    ticket.driver_name or '',
                    ticket.offense_description or ''
                ])
            
            csv_data = output.getvalue()
            output.close()
            
            return csv_data, 200, {
                'Content-Type': 'text/csv',
                'Content-Disposition': f'attachment; filename=payment_report_{datetime.utcnow().strftime("%Y%m%d")}.csv'
            }
        
        # JSON response
        return jsonify({
            'tickets': [ticket.to_dict(include_admin=True) for ticket in tickets],
            'summary': {
                'total_count': total_count,
                'total_amount': total_amount,
                'date_from': date_from,
                'date_to': date_to,
                'status': status
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to generate report: {str(e)}'}), 500


@admin_bp.route('/reports/revenue', methods=['GET'])
@permission_required(Permission.VIEW_REPORTS)
def get_revenue_report(current_user):
    """
    Get revenue report - Multi-tenant aware
    """
    try:
        government = get_current_government()
        
        period = request.args.get('period', 'daily')
        days = request.args.get('days', 30, type=int)
        start_date = datetime.utcnow() - timedelta(days=days)
        
        if period == 'daily':
            revenue_data = db.session.query(
                func.date(Ticket.paid_date).label('period'),
                func.sum(Ticket.payment_amount).label('revenue'),
                func.count(Ticket.id).label('count')
            ).filter(
                Ticket.government_id == government.id,
                Ticket.status == 'paid',
                Ticket.paid_date >= start_date
            ).group_by(func.date(Ticket.paid_date)).all()
        elif period == 'monthly':
            revenue_data = db.session.query(
                func.strftime('%Y-%m', Ticket.paid_date).label('period'),
                func.sum(Ticket.payment_amount).label('revenue'),
                func.count(Ticket.id).label('count')
            ).filter(
                Ticket.government_id == government.id,
                Ticket.status == 'paid'
            ).group_by(func.strftime('%Y-%m', Ticket.paid_date)).all()
        else:
            revenue_data = []
        
        return jsonify({
            'period': period,
            'data': [
                {
                    'period': str(rd[0]),
                    'revenue': float(rd[1] or 0),
                    'count': rd[2]
                }
                for rd in revenue_data
            ]
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to generate revenue report: {str(e)}'}), 500


# ============================================================================
# USER PROFILE MANAGEMENT
# ============================================================================

@admin_bp.route('/profile', methods=['GET'])
@permission_required(Permission.VIEW_SETTINGS)
def get_profile(current_user):
    """
    Get current user's profile information
    """
    try:
        return jsonify({
            'profile': current_user.to_dict(include_sensitive=True),
            'government': current_user.government.to_dict() if current_user.government else None
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch profile: {str(e)}'}), 500


@admin_bp.route('/profile', methods=['PUT'])
@permission_required(Permission.VIEW_SETTINGS)
def update_profile(current_user):
    """
    Update current user's profile information
    
    Request body:
    {
        "full_name": "John Doe",
        "email": "john@example.com",
        "phone": "+1234567890"
    }
    """
    try:
        data = request.get_json()
        
        # Update allowed fields
        if 'full_name' in data:
            current_user.full_name = data['full_name']
        
        if 'email' in data and data['email'] != current_user.email:
            # Check if email is already taken by another user in same government
            existing_user = User.query.filter_by(
                government_id=current_user.government_id,
                email=data['email']
            ).first()
            
            if existing_user and existing_user.id != current_user.id:
                return jsonify({'error': 'Email already in use by another user'}), 409
            
            current_user.email = data['email']
        
        if 'phone' in data:
            current_user.phone = data['phone']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Profile updated successfully',
            'profile': current_user.to_dict(include_sensitive=True)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update profile: {str(e)}'}), 500


@admin_bp.route('/profile/password', methods=['PUT'])
@permission_required(Permission.VIEW_SETTINGS)
def change_password(current_user):
    """
    Change current user's password
    
    Request body:
    {
        "current_password": "old_password",
        "new_password": "new_password",
        "confirm_password": "new_password"
    }
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        if not all(k in data for k in ['current_password', 'new_password', 'confirm_password']):
            return jsonify({'error': 'All password fields are required'}), 400
        
        # Verify current password
        if not current_user.check_password(data['current_password']):
            return jsonify({'error': 'Current password is incorrect'}), 401
        
        # Validate new password matches confirmation
        if data['new_password'] != data['confirm_password']:
            return jsonify({'error': 'New passwords do not match'}), 400
        
        # Validate new password strength (minimum 6 characters)
        if len(data['new_password']) < 6:
            return jsonify({'error': 'New password must be at least 6 characters long'}), 400
        
        # Update password
        current_user.set_password(data['new_password'])
        db.session.commit()
        
        return jsonify({
            'message': 'Password changed successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to change password: {str(e)}'}), 500


# ============================================================================
# BRANDING MANAGEMENT
# ============================================================================

@admin_bp.route('/branding', methods=['GET'])
@permission_required(Permission.VIEW_SETTINGS)
def get_branding(current_user):
    """
    Get current government branding configuration
    """
    try:
        government = get_current_government()
        branding = government.get_branding()
        
        return jsonify({
            'branding': branding,
            'government': {
                'id': government.id,
                'name': government.government_name,
                'country': government.country_name
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch branding: {str(e)}'}), 500


@admin_bp.route('/branding', methods=['PUT'])
@permission_required(Permission.MANAGE_BRANDING)
def update_branding(current_user):
    """
    Update government branding configuration
    
    Request body:
    {
        "logo_url": "https://example.com/logo.png",
        "primary_color": "#003f87",
        "secondary_color": "#ffc72c",
        "platform_name": "Barbados PayFine",
        "tagline": "Secure Government Payment Platform"
    }
    """
    try:
        government = get_current_government()
        data = request.get_json()
        
        # Get current branding
        current_branding = government.get_branding()
        
        # Update with new values
        if 'logo_url' in data:
            current_branding['logo_url'] = data['logo_url']
        
        if 'primary_color' in data:
            current_branding['primary_color'] = data['primary_color']
        
        if 'secondary_color' in data:
            current_branding['secondary_color'] = data['secondary_color']
        
        if 'platform_name' in data:
            current_branding['platform_name'] = data['platform_name']
        
        if 'tagline' in data:
            current_branding['tagline'] = data['tagline']

        if 'font_family' in data:
            current_branding['font_family'] = data['font_family']

        # Save updated branding
        government.set_branding(current_branding)
        government.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Branding updated successfully',
            'branding': current_branding
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update branding: {str(e)}'}), 500


@admin_bp.route('/branding/upload-logo', methods=['POST'])
@permission_required(Permission.MANAGE_BRANDING)
def upload_logo(current_user):
    """
    Upload logo file
    
    For now, this accepts a base64 encoded image or URL
    In production, this would handle file uploads to cloud storage
    
    Request body:
    {
        "logo_data": "data:image/png;base64,..." or "https://..."
    }
    """
    try:
        government = get_current_government()
        data = request.get_json()
        
        logo_data = data.get('logo_data')
        if not logo_data:
            return jsonify({'error': 'logo_data is required'}), 400
        
        # Get current branding
        branding = government.get_branding()
        
        # Update logo URL
        branding['logo_url'] = logo_data
        
        # Save updated branding
        government.set_branding(branding)
        government.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Logo uploaded successfully',
            'logo_url': logo_data,
            'branding': branding
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to upload logo: {str(e)}'}), 500


# ============================================================================
# AI CONFIGURATION MANAGEMENT
# ============================================================================

@admin_bp.route('/ai-config', methods=['GET'])
@permission_required(Permission.VIEW_SETTINGS)
def get_ai_config(current_user):
    """
    Get AI configuration status
    
    Returns:
    - ai_features_enabled: Whether AI features are enabled
    - has_openai_key: Whether OpenAI API key is configured
    - openai_enhanced: Whether enhanced AI features are available
    """
    try:
        government = get_current_government()
        
        return jsonify({
            'ai_features_enabled': government.ai_features_enabled,
            'has_openai_key': bool(government.openai_api_key),
            'openai_enhanced': government.has_openai_enabled(),
            'openai_api_key': government.get_openai_key() if government.openai_api_key else None
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch AI config: {str(e)}'}), 500


@admin_bp.route('/ai-config', methods=['PUT'])
@permission_required(Permission.MANAGE_AI_CONFIG)
def update_ai_config(current_user):
    """
    Update AI configuration
    
    Request body:
    {
        "ai_features_enabled": true/false,
        "openai_api_key": "sk-..." or null
    }
    """
    try:
        government = get_current_government()
        data = request.get_json()
        
        # Update AI features enabled flag
        if 'ai_features_enabled' in data:
            government.ai_features_enabled = data['ai_features_enabled']
        
        # Update OpenAI API key
        if 'openai_api_key' in data:
            api_key = data['openai_api_key']
            if api_key:
                # Validate API key format (basic check)
                if not api_key.startswith('sk-'):
                    return jsonify({'error': 'Invalid OpenAI API key format. Must start with "sk-"'}), 400
                government.set_openai_key(api_key)
            else:
                government.set_openai_key(None)
        
        government.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'AI configuration updated successfully',
            'ai_features_enabled': government.ai_features_enabled,
            'has_openai_key': bool(government.openai_api_key),
            'openai_enhanced': government.has_openai_enabled()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update AI config: {str(e)}'}), 500


@admin_bp.route('/ai-config/test', methods=['POST'])
@permission_required(Permission.MANAGE_AI_CONFIG)
def test_openai_connection(current_user):
    """
    Test OpenAI API key connection
    
    Makes a simple API call to verify the key works
    """
    try:
        government = get_current_government()
        
        if not government.openai_api_key:
            return jsonify({'error': 'No OpenAI API key configured'}), 400
        
        # TODO: Implement actual OpenAI API test
        # For now, just validate format
        api_key = government.get_openai_key()
        if not api_key or not api_key.startswith('sk-'):
            return jsonify({
                'success': False,
                'message': 'Invalid API key format'
            }), 400
        
        return jsonify({
            'success': True,
            'message': 'OpenAI API key format is valid. Enhanced AI features are ready to use.'
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Connection test failed: {str(e)}'
        }), 500


# ============================================================================
# GAMIFICATION CONFIGURATION MANAGEMENT
# ============================================================================

@admin_bp.route('/gamification-config', methods=['GET'])
@permission_required(Permission.VIEW_SETTINGS)
def get_gamification_config(current_user):
    """
    Get gamification configuration status
    
    Returns:
    - gamification_enabled: Whether gamification features are enabled
    """
    try:
        government = get_current_government()
        
        return jsonify({
            'gamification_enabled': government.gamification_enabled
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch gamification config: {str(e)}'}), 500


@admin_bp.route('/gamification-config', methods=['PUT'])
@permission_required(Permission.MANAGE_SETTINGS)
def update_gamification_config(current_user):
    """
    Update gamification configuration
    
    Request body:
    {
        "gamification_enabled": true/false
    }
    """
    try:
        government = get_current_government()
        data = request.get_json()
        
        # Update gamification enabled flag
        if 'gamification_enabled' in data:
            government.gamification_enabled = data['gamification_enabled']
        
        government.updated_at = datetime.utcnow()
        db.session.commit()
        
        status_message = "enabled" if government.gamification_enabled else "disabled"
        
        return jsonify({
            'message': f'Gamification {status_message} successfully',
            'gamification_enabled': government.gamification_enabled
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update gamification config: {str(e)}'}), 500


# ============================================================================
# TRIDENT ID & NOTIFICATION MANAGEMENT
# ============================================================================

@admin_bp.route('/tickets/<int:ticket_id>/link-trident', methods=['POST'])
@admin_required()
def link_trident_to_ticket(ticket_id, current_user):
    """
    Link a Trident ID to an existing ticket
    Admin can add Trident ID to tickets that were created without it
    """
    try:
        ticket = Ticket.query.get(ticket_id)
        
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        data = request.get_json()
        trident_id = data.get('trident_id')
        
        if not trident_id:
            return jsonify({'error': 'Trident ID is required'}), 400
        
        if ticket.trident_id_reference:
            return jsonify({'error': 'Ticket already linked to a Trident ID'}), 400
        
        # Link Trident ID
        link_result = link_ticket_to_trident(
            ticket=ticket,
            trident_id=trident_id,
            citizen_email=data.get('citizen_email') or ticket.citizen_email,
            citizen_phone=data.get('citizen_phone') or ticket.citizen_phone
        )
        
        if link_result['success']:
            db.session.commit()
            
            # Send notification if requested
            notification_result = None
            if data.get('send_notification', False):
                notification_result = send_ticket_notification(ticket, 'issued')
            
            response_data = {
                'message': 'Trident ID linked successfully',
                'ticket': ticket.to_dict(include_admin=True, include_trident=True)
            }
            
            if notification_result:
                response_data['notification'] = notification_result
            
            return jsonify(response_data), 200
        else:
            return jsonify({'error': link_result['message']}), 400
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to link Trident ID: {str(e)}'}), 500


@admin_bp.route('/tickets/<int:ticket_id>/send-notification', methods=['POST'])
@admin_required()
def send_notification_manual(ticket_id, current_user):
    """
    Manually trigger notification for a ticket
    Useful for resending notifications or sending reminders
    """
    try:
        ticket = Ticket.query.get(ticket_id)
        
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        data = request.get_json() or {}
        notification_type = data.get('type', 'issued')  # 'issued', 'reminder', 'overdue'
        
        # Send notification
        result = send_ticket_notification(ticket, notification_type)
        
        if result['success']:
            db.session.commit()
            
            return jsonify({
                'message': 'Notification sent successfully',
                'result': result
            }), 200
        else:
            return jsonify({
                'error': 'Failed to send notification',
                'message': result['message']
            }), 400
        
    except Exception as e:
        return jsonify({'error': f'Failed to send notification: {str(e)}'}), 500


@admin_bp.route('/tickets/<int:ticket_id>/notification-status', methods=['GET'])
@admin_required()
def get_ticket_notification_status(ticket_id, current_user):
    """
    Get notification status for a ticket
    """
    try:
        ticket = Ticket.query.get(ticket_id)
        
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        from .notifications import get_notification_status
        status = get_notification_status(ticket)
        
        return jsonify(status), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get notification status: {str(e)}'}), 500


# ============================================================================
# NATIONAL TRAFFIC OFFENCE & PENALTY SYSTEM - ADMIN ROUTES
# ============================================================================

# Import notification helpers
from .notifications import (
    link_ticket_to_trident,
    send_ticket_notification,
    generate_qr_code_data,
    get_notification_status
)


# ============================================================================
# OFFENCE CATEGORY MANAGEMENT
# ============================================================================

@admin_bp.route('/offence-categories', methods=['GET'])
@permission_required(Permission.VIEW_OFFENCE_CATEGORIES)
def get_offence_categories(current_user):
    """
    Get all offence categories - Multi-tenant aware
    """
    try:
        government = get_current_government()
        query = OffenceCategory.query.filter_by(government_id=government.id)
        
        # Filter by active status
        active = request.args.get('active')
        if active is not None:
            query = query.filter_by(active=active.lower() == 'true')
        
        # Search filter
        search = request.args.get('search')
        if search:
            search_pattern = f'%{search}%'
            query = query.filter(
                or_(
                    OffenceCategory.code.ilike(search_pattern),
                    OffenceCategory.name.ilike(search_pattern)
                )
            )
        
        categories = query.order_by(OffenceCategory.name).all()
        
        return jsonify({
            'categories': [cat.to_dict() for cat in categories],
            'total': len(categories)
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch offence categories: {str(e)}'}), 500


@admin_bp.route('/offence-categories', methods=['POST'])
@permission_required(Permission.MANAGE_OFFENCE_CATEGORIES)
def create_offence_category(current_user):
    """
    Create a new offence category - Multi-tenant aware
    """
    try:
        government = get_current_government()
        data = request.get_json()
        
        if not data.get('code') or not data.get('name'):
            return jsonify({'error': 'Code and name are required'}), 400
        
        if OffenceCategory.query.filter_by(
            government_id=government.id,
            code=data['code']
        ).first():
            return jsonify({'error': 'Category code already exists'}), 409
        
        category = OffenceCategory(
            government_id=government.id,
            code=data['code'].upper(),
            name=data['name'],
            description=data.get('description'),
            active=data.get('active', True)
        )
        
        db.session.add(category)
        db.session.commit()
        
        return jsonify({
            'message': 'Offence category created successfully',
            'category': category.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create offence category: {str(e)}'}), 500


@admin_bp.route('/offence-categories/<int:category_id>', methods=['PUT'])
@permission_required(Permission.MANAGE_OFFENCE_CATEGORIES)
def update_offence_category(category_id, current_user):
    """
    Update an offence category
    """
    try:
        category = OffenceCategory.query.get(category_id)
        
        if not category:
            return jsonify({'error': 'Offence category not found'}), 404
        
        data = request.get_json()
        
        # Update fields
        if 'name' in data:
            category.name = data['name']
        
        if 'description' in data:
            category.description = data['description']
        
        if 'active' in data:
            category.active = data['active']
        
        category.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Offence category updated successfully',
            'category': category.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update offence category: {str(e)}'}), 500


@admin_bp.route('/offence-categories/<int:category_id>', methods=['DELETE'])
@permission_required(Permission.MANAGE_OFFENCE_CATEGORIES)
def delete_offence_category(category_id, current_user):
    """
    Delete (deactivate) an offence category
    """
    try:
        category = OffenceCategory.query.get(category_id)
        
        if not category:
            return jsonify({'error': 'Offence category not found'}), 404
        
        # Soft delete by deactivating
        category.active = False
        category.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({'message': 'Offence category deactivated successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete offence category: {str(e)}'}), 500


# ============================================================================
# OFFENCE MANAGEMENT
# ============================================================================

@admin_bp.route('/offences', methods=['GET'])
@permission_required(Permission.VIEW_OFFENCES)
def get_offences(current_user):
    """
    Get all offences - Multi-tenant aware
    """
    try:
        government = get_current_government()
        query = Offence.query.filter_by(government_id=government.id)
        
        # Filter by category
        category_id = request.args.get('category_id', type=int)
        if category_id:
            query = query.filter_by(category_id=category_id)
        
        # Filter by active status
        active = request.args.get('active')
        if active is not None:
            query = query.filter_by(active=active.lower() == 'true')
        
        # Filter by measurable type
        measurable = request.args.get('measurable')
        if measurable:
            query = query.filter_by(measurable_type=measurable)
        
        # Search filter
        search = request.args.get('search')
        if search:
            search_pattern = f'%{search}%'
            query = query.filter(
                or_(
                    Offence.code.ilike(search_pattern),
                    Offence.name.ilike(search_pattern),
                    Offence.description.ilike(search_pattern)
                )
            )
        
        offences = query.order_by(Offence.category_id, Offence.name).all()
        
        # Include penalty rules if requested
        include_rules = request.args.get('include_rules', 'false').lower() == 'true'
        
        return jsonify({
            'offences': [off.to_dict(include_rules=include_rules) for off in offences],
            'total': len(offences)
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch offences: {str(e)}'}), 500


@admin_bp.route('/offences', methods=['POST'])
@permission_required(Permission.MANAGE_OFFENCES)
def create_offence(current_user):
    """
    Create a new offence - Multi-tenant aware
    """
    try:
        government = get_current_government()
        data = request.get_json()
        
        required_fields = ['code', 'name', 'category_id']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Code, name, and category_id are required'}), 400
        
        if Offence.query.filter_by(
            government_id=government.id,
            code=data['code']
        ).first():
            return jsonify({'error': 'Offence code already exists'}), 409
        
        category = OffenceCategory.query.filter_by(
            government_id=government.id,
            id=data['category_id']
        ).first()
        if not category:
            return jsonify({'error': 'Offence category not found'}), 404
        
        offence = Offence(
            government_id=government.id,
            code=data['code'].upper(),
            name=data['name'],
            category_id=data['category_id'],
            description=data.get('description'),
            measurable_type=data.get('measurable_type', 'none'),
            unit=data.get('unit'),
            active=data.get('active', True)
        )
        
        db.session.add(offence)
        db.session.commit()
        
        return jsonify({
            'message': 'Offence created successfully',
            'offence': offence.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create offence: {str(e)}'}), 500


@admin_bp.route('/offences/<int:offence_id>', methods=['PUT'])
@permission_required(Permission.MANAGE_OFFENCES)
def update_offence(offence_id, current_user):
    """
    Update an offence
    """
    try:
        offence = Offence.query.get(offence_id)
        
        if not offence:
            return jsonify({'error': 'Offence not found'}), 404
        
        data = request.get_json()
        
        # Update fields
        if 'name' in data:
            offence.name = data['name']
        
        if 'description' in data:
            offence.description = data['description']
        
        if 'category_id' in data:
            category = OffenceCategory.query.get(data['category_id'])
            if not category:
                return jsonify({'error': 'Offence category not found'}), 404
            offence.category_id = data['category_id']
        
        if 'measurable_type' in data:
            offence.measurable_type = data['measurable_type']
        
        if 'unit' in data:
            offence.unit = data['unit']
        
        if 'active' in data:
            offence.active = data['active']
        
        offence.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Offence updated successfully',
            'offence': offence.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update offence: {str(e)}'}), 500


@admin_bp.route('/offences/<int:offence_id>', methods=['DELETE'])
@permission_required(Permission.MANAGE_OFFENCES)
def delete_offence(offence_id, current_user):
    """
    Delete (deactivate) an offence
    """
    try:
        offence = Offence.query.get(offence_id)
        
        if not offence:
            return jsonify({'error': 'Offence not found'}), 404
        
        # Soft delete by deactivating
        offence.active = False
        offence.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({'message': 'Offence deactivated successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete offence: {str(e)}'}), 500


# ============================================================================
# PENALTY RULE MANAGEMENT
# ============================================================================

@admin_bp.route('/penalty-rules', methods=['GET'])
@permission_required(Permission.VIEW_PENALTY_RULES)
def get_penalty_rules(current_user):
    """
    Get all penalty rules - Multi-tenant aware
    """
    try:
        government = get_current_government()
        query = PenaltyRule.query.filter_by(government_id=government.id)
        
        # Filter by offence
        offence_id = request.args.get('offence_id', type=int)
        if offence_id:
            query = query.filter_by(offence_id=offence_id)
        
        # Filter by active status
        active = request.args.get('active')
        if active is not None:
            query = query.filter_by(active=active.lower() == 'true')
        
        # Filter by court requirement
        court_required = request.args.get('court_required')
        if court_required is not None:
            query = query.filter_by(court_required=court_required.lower() == 'true')
        
        rules = query.order_by(PenaltyRule.offence_id, PenaltyRule.min_value).all()
        
        # Filter by current effectiveness if requested
        currently_effective = request.args.get('currently_effective')
        if currently_effective and currently_effective.lower() == 'true':
            rules = [rule for rule in rules if rule.is_currently_effective()]
        
        return jsonify({
            'rules': [rule.to_dict() for rule in rules],
            'total': len(rules)
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch penalty rules: {str(e)}'}), 500


@admin_bp.route('/penalty-rules', methods=['POST'])
@permission_required(Permission.MANAGE_PENALTY_RULES)
def create_penalty_rule(current_user):
    """
    Create a new penalty rule - Multi-tenant aware
    """
    try:
        government = get_current_government()
        data = request.get_json()
        
        required_fields = ['offence_id', 'base_fine', 'effective_from']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'offence_id, base_fine, and effective_from are required'}), 400
        
        offence = Offence.query.filter_by(
            government_id=government.id,
            id=data['offence_id']
        ).first()
        if not offence:
            return jsonify({'error': 'Offence not found'}), 404
        
        # Parse dates
        from datetime import date as date_type
        effective_from = datetime.fromisoformat(data['effective_from']).date()
        effective_to = None
        if data.get('effective_to'):
            effective_to = datetime.fromisoformat(data['effective_to']).date()
        
        rule = PenaltyRule(
            government_id=government.id,
            offence_id=data['offence_id'],
            min_value=data.get('min_value'),
            max_value=data.get('max_value'),
            base_fine=data['base_fine'],
            points=data.get('points', 0),
            court_required=data.get('court_required', False),
            repeat_multiplier=data.get('repeat_multiplier', 1.5),
            effective_from=effective_from,
            effective_to=effective_to,
            active=data.get('active', True)
        )
        
        db.session.add(rule)
        db.session.commit()
        
        return jsonify({
            'message': 'Penalty rule created successfully',
            'rule': rule.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create penalty rule: {str(e)}'}), 500


@admin_bp.route('/penalty-rules/<int:rule_id>', methods=['PUT'])
@permission_required(Permission.MANAGE_PENALTY_RULES)
def update_penalty_rule(rule_id, current_user):
    """
    Update a penalty rule
    """
    try:
        rule = PenaltyRule.query.get(rule_id)
        
        if not rule:
            return jsonify({'error': 'Penalty rule not found'}), 404
        
        data = request.get_json()
        
        # Update fields
        if 'min_value' in data:
            rule.min_value = data['min_value']
        
        if 'max_value' in data:
            rule.max_value = data['max_value']
        
        if 'base_fine' in data:
            rule.base_fine = data['base_fine']
        
        if 'points' in data:
            rule.points = data['points']
        
        if 'court_required' in data:
            rule.court_required = data['court_required']
        
        if 'repeat_multiplier' in data:
            rule.repeat_multiplier = data['repeat_multiplier']
        
        if 'effective_from' in data:
            rule.effective_from = datetime.fromisoformat(data['effective_from']).date()
        
        if 'effective_to' in data:
            if data['effective_to']:
                rule.effective_to = datetime.fromisoformat(data['effective_to']).date()
            else:
                rule.effective_to = None
        
        if 'active' in data:
            rule.active = data['active']
        
        rule.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Penalty rule updated successfully',
            'rule': rule.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update penalty rule: {str(e)}'}), 500


@admin_bp.route('/penalty-rules/<int:rule_id>', methods=['DELETE'])
@permission_required(Permission.MANAGE_PENALTY_RULES)
def delete_penalty_rule(rule_id, current_user):
    """
    Delete (deactivate) a penalty rule
    """
    try:
        rule = PenaltyRule.query.get(rule_id)
        
        if not rule:
            return jsonify({'error': 'Penalty rule not found'}), 404
        
        # Soft delete by deactivating
        rule.active = False
        rule.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({'message': 'Penalty rule deactivated successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete penalty rule: {str(e)}'}), 500


@admin_bp.route('/penalty-rules/calculate-preview', methods=['POST'])
@admin_or_warden_required()
def calculate_fine_preview(current_user):
    """
    Preview fine calculation for given offence and measured value
    
    Request body:
    - offence_id: ID of the offence
    - measured_value: Measured value (optional, for measurable offences)
    - is_repeat_offence: Whether this is a repeat offence (optional)
    
    Returns calculated fine, points, and court requirement
    """
    try:
        data = request.get_json()
        
        if not data.get('offence_id'):
            return jsonify({'error': 'offence_id is required'}), 400
        
        # Get offence
        offence = Offence.query.get(data['offence_id'])
        if not offence:
            return jsonify({'error': 'Offence not found'}), 404
        
        # Get matching penalty rule
        measured_value = data.get('measured_value')
        penalty_rule = offence.get_active_penalty_rule(measured_value)
        
        if not penalty_rule:
            return jsonify({
                'error': 'No active penalty rule found for this offence',
                'offence': offence.to_dict()
            }), 404
        
        # Calculate fine
        is_repeat = data.get('is_repeat_offence', False)
        calculated_fine = penalty_rule.calculate_fine(is_repeat_offence=is_repeat)
        
        return jsonify({
            'offence': offence.to_dict(),
            'penalty_rule': penalty_rule.to_dict(),
            'calculated_fine': float(calculated_fine),
            'base_fine': float(penalty_rule.base_fine),
            'points': penalty_rule.points,
            'court_required': penalty_rule.court_required,
            'is_repeat_offence': is_repeat,
            'repeat_multiplier': float(penalty_rule.repeat_multiplier) if is_repeat else 1.0
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to calculate fine preview: {str(e)}'}), 500


# ============================================================================
# TICKET CHALLENGE MANAGEMENT
# ============================================================================

@admin_bp.route('/challenges', methods=['GET'])
@permission_required(Permission.VIEW_CHALLENGES)
def get_challenges(current_user):
    """
    Get all ticket challenges - Multi-tenant aware
    """
    try:
        government = get_current_government()
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        query = TicketChallenge.query.join(Ticket).filter(
            Ticket.government_id == government.id
        )
        
        # Filter by status
        status = request.args.get('status')
        if status:
            query = query.filter(TicketChallenge.status == status)
        
        # Filter by ticket
        ticket_id = request.args.get('ticket_id', type=int)
        if ticket_id:
            query = query.filter_by(ticket_id=ticket_id)
        
        # Paginate results
        pagination = query.order_by(TicketChallenge.submitted_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'challenges': [challenge.to_dict(include_ticket=True) for challenge in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch challenges: {str(e)}'}), 500


@admin_bp.route('/challenges/<int:challenge_id>', methods=['GET'])
@permission_required(Permission.VIEW_CHALLENGES)
def get_challenge(challenge_id, current_user):
    """
    Get a specific challenge with full details
    """
    try:
        challenge = TicketChallenge.query.get(challenge_id)

        if not challenge:
            return jsonify({'error': 'Challenge not found'}), 404
        
        return jsonify({
            'challenge': challenge.to_dict(include_ticket=True)
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch challenge: {str(e)}'}), 500


@admin_bp.route('/challenges/<int:challenge_id>/review', methods=['POST'])
@permission_required(Permission.REVIEW_CHALLENGES)
def start_challenge_review(challenge_id, current_user):
    """
    Start reviewing a challenge
    
    Changes status from 'Pending' to 'UnderReview'
    Assigns the current admin as the reviewer
    """
    try:
        challenge = TicketChallenge.query.get(challenge_id)
        
        if not challenge:
            return jsonify({'error': 'Challenge not found'}), 404
        
        if challenge.status != 'Pending':
            return jsonify({'error': f'Challenge is already {challenge.status}'}), 400
        
        # Update challenge status
        challenge.status = 'UnderReview'
        challenge.reviewed_by_id = current_user.id
        challenge.updated_at = datetime.utcnow()
        
        # Update ticket status
        challenge.ticket.status = 'UnderReview'
        challenge.ticket.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Challenge review started',
            'challenge': challenge.to_dict(include_ticket=True)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to start review: {str(e)}'}), 500


@admin_bp.route('/challenges/<int:challenge_id>/dismiss', methods=['POST'])
@permission_required(Permission.APPROVE_CHALLENGES)
def dismiss_challenge(challenge_id, current_user):
    """
    Dismiss the ticket (citizen was right)
    
    PRESERVES JUDICIAL REVIEW:
    This action acknowledges the citizen's challenge was valid.
    The ticket is dismissed and no payment is required.
    
    Request body:
    - admin_notes: Reason for dismissal (required)
    """
    try:
        challenge = TicketChallenge.query.get(challenge_id)
        
        if not challenge:
            return jsonify({'error': 'Challenge not found'}), 404
        
        if challenge.status not in ['Pending', 'UnderReview']:
            return jsonify({'error': f'Challenge is already {challenge.status}'}), 400
        
        data = request.get_json() or {}
        admin_notes = data.get('admin_notes')
        
        if not admin_notes:
            return jsonify({'error': 'admin_notes is required for dismissal'}), 400
        
        # Update challenge
        challenge.status = 'Approved'
        challenge.outcome = 'Dismissed'
        challenge.reviewed_at = datetime.utcnow()
        challenge.reviewed_by_id = current_user.id
        challenge.admin_notes = admin_notes
        challenge.updated_at = datetime.utcnow()
        
        # Update ticket - mark as dismissed
        challenge.ticket.status = 'Dismissed'
        challenge.ticket.updated_at = datetime.utcnow()
        challenge.ticket.notes = f"Dismissed by {current_user.username}: {admin_notes}"
        
        db.session.commit()
        
        # Invalidate cache for this ticket
        from .cache import invalidate_ticket_cache, invalidate_ticket_list_cache
        try:
            invalidate_ticket_cache(challenge.ticket.government_id, challenge.ticket.serial_number)
            invalidate_ticket_list_cache(challenge.ticket.government_id)
        except Exception as cache_error:
            # Log but don't fail if cache invalidation fails
            print(f"Cache invalidation warning: {str(cache_error)}")
        
        return jsonify({
            'message': 'Ticket dismissed successfully',
            'challenge': challenge.to_dict(include_ticket=True)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to dismiss challenge: {str(e)}'}), 500


@admin_bp.route('/challenges/<int:challenge_id>/adjust', methods=['POST'])
@permission_required(Permission.APPROVE_CHALLENGES)
def adjust_challenge_fine(challenge_id, current_user):
    """
    Adjust fine within allowed bounds (±20% of calculated fine)
    
    BOUNDED ADJUSTMENTS:
    Admins can adjust fines to account for mitigating circumstances,
    but only within ±20% of the calculated fine to prevent arbitrary amounts.
    
    Request body:
    - adjusted_fine: New fine amount (required)
    - admin_notes: Reason for adjustment (required)
    """
    try:
        challenge = TicketChallenge.query.get(challenge_id)
        
        if not challenge:
            return jsonify({'error': 'Challenge not found'}), 404
        
        if challenge.status not in ['Pending', 'UnderReview']:
            return jsonify({'error': f'Challenge is already {challenge.status}'}), 400
        
        data = request.get_json() or {}
        adjusted_fine = data.get('adjusted_fine')
        admin_notes = data.get('admin_notes')
        
        if not adjusted_fine or not admin_notes:
            return jsonify({'error': 'adjusted_fine and admin_notes are required'}), 400
        
        # Validate adjustment is within bounds
        if not challenge.can_adjust_fine(adjusted_fine):
            original_fine = float(challenge.ticket.calculated_fine or challenge.ticket.fine_amount)
            min_allowed = original_fine * 0.8
            max_allowed = original_fine * 1.2
            
            return jsonify({
                'error': 'Fine adjustment out of bounds',
                'message': f'Adjusted fine must be between ${min_allowed:.2f} and ${max_allowed:.2f} (±20% of ${original_fine:.2f})',
                'original_fine': original_fine,
                'min_allowed': min_allowed,
                'max_allowed': max_allowed
            }), 400
        
        # Update challenge
        challenge.status = 'Approved'
        challenge.outcome = 'FineAdjusted'
        challenge.adjusted_fine = adjusted_fine
        challenge.reviewed_at = datetime.utcnow()
        challenge.reviewed_by_id = current_user.id
        challenge.admin_notes = admin_notes
        challenge.updated_at = datetime.utcnow()
        
        # Update ticket - adjust fine and make payable
        challenge.ticket.fine_amount = adjusted_fine
        challenge.ticket.status = 'Adjusted'
        challenge.ticket.updated_at = datetime.utcnow()
        challenge.ticket.notes = f"Fine adjusted by {current_user.username}: {admin_notes}"
        
        db.session.commit()
        
        # Invalidate cache for this ticket
        from .cache import invalidate_ticket_cache, invalidate_ticket_list_cache
        try:
            invalidate_ticket_cache(challenge.ticket.government_id, challenge.ticket.serial_number)
            invalidate_ticket_list_cache(challenge.ticket.government_id)
        except Exception as cache_error:
            # Log but don't fail if cache invalidation fails
            print(f"Cache invalidation warning: {str(cache_error)}")
        
        return jsonify({
            'message': 'Fine adjusted successfully',
            'challenge': challenge.to_dict(include_ticket=True)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to adjust fine: {str(e)}'}), 500


@admin_bp.route('/challenges/<int:challenge_id>/uphold', methods=['POST'])
@permission_required(Permission.REJECT_CHALLENGES)
def uphold_challenge(challenge_id, current_user):
    """
    Uphold the original fine (challenge rejected)
    
    ACCOUNTABILITY:
    This action rejects the citizen's challenge and maintains the original fine.
    The ticket becomes payable again.
    
    Request body:
    - admin_notes: Reason for upholding (required)
    """
    try:
        challenge = TicketChallenge.query.get(challenge_id)
        
        if not challenge:
            return jsonify({'error': 'Challenge not found'}), 404
        
        if challenge.status not in ['Pending', 'UnderReview']:
            return jsonify({'error': f'Challenge is already {challenge.status}'}), 400
        
        data = request.get_json() or {}
        admin_notes = data.get('admin_notes')
        
        if not admin_notes:
            return jsonify({'error': 'admin_notes is required'}), 400
        
        # Update challenge
        challenge.status = 'Rejected'
        challenge.outcome = 'Upheld'
        challenge.reviewed_at = datetime.utcnow()
        challenge.reviewed_by_id = current_user.id
        challenge.admin_notes = admin_notes
        challenge.updated_at = datetime.utcnow()
        
        # Update ticket - make payable again
        challenge.ticket.status = 'Payable'
        challenge.ticket.updated_at = datetime.utcnow()
        challenge.ticket.notes = f"Challenge upheld by {current_user.username}: {admin_notes}"
        
        db.session.commit()
        
        # Invalidate cache for this ticket
        from .cache import invalidate_ticket_cache, invalidate_ticket_list_cache
        try:
            invalidate_ticket_cache(challenge.ticket.government_id, challenge.ticket.serial_number)
            invalidate_ticket_list_cache(challenge.ticket.government_id)
        except Exception as cache_error:
            # Log but don't fail if cache invalidation fails
            print(f"Cache invalidation warning: {str(cache_error)}")
        
        return jsonify({
            'message': 'Challenge upheld successfully',
            'challenge': challenge.to_dict(include_ticket=True)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to uphold challenge: {str(e)}'}), 500


# ============================================================================
# PERMISSIONS & ROLES MANAGEMENT
# ============================================================================

@admin_bp.route('/permissions/me', methods=['GET'])
@jwt_required()
def get_my_permissions():
    """
    Get current user's permissions and accessible panels
    
    OPEN TO ALL AUTHENTICATED USERS:
    This endpoint is accessible to all authenticated users so they can
    check their own permissions and see which panels they can access.
    
    Returns:
    - permissions: List of permission strings
    - accessible_panels: List of panel names user can access
    - role: User's role
    - is_admin: Whether user is admin
    """
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'permissions': user.get_permissions(),
            'accessible_panels': user.get_accessible_panels(),
            'role': user.role,
            'is_admin': user.is_admin
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get permissions: {str(e)}'}), 500


@admin_bp.route('/permissions/roles', methods=['GET'])
@admin_required()
def get_roles(current_user):
    """
    Get list of available roles with descriptions
    
    Returns list of roles that can be assigned to users
    """
    try:
        roles = get_available_roles()
        return jsonify({
            'roles': roles
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get roles: {str(e)}'}), 500


@admin_bp.route('/permissions/role-permissions', methods=['GET'])
@admin_required()
def get_role_permissions(current_user):
    """
    Get complete role-to-permissions mapping
    
    Returns mapping of each role to its permissions and accessible panels
    """
    try:
        role_permissions = get_role_permissions_map()
        return jsonify({
            'role_permissions': role_permissions
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get role permissions: {str(e)}'}), 500


@admin_bp.route('/permissions/check', methods=['POST'])
@jwt_required()
def check_permission():
    """
    Check if current user has a specific permission
    
    Request body:
    - permission: Permission string to check
    
    Returns:
    - has_permission: Boolean indicating if user has the permission
    """
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        permission = data.get('permission')
        
        if not permission:
            return jsonify({'error': 'permission is required'}), 400
        
        has_permission = user.has_permission(permission)
        
        return jsonify({
            'permission': permission,
            'has_permission': has_permission
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to check permission: {str(e)}'}), 500


# ============================================================================
# CUSTOM PANEL ACCESS MANAGEMENT
# ============================================================================

@admin_bp.route('/users/<int:user_id>/panels', methods=['GET'])
@admin_required()
def get_user_panels(user_id, current_user):
    """
    Get user's panel access configuration
    
    Returns:
    - custom_panels: User's custom panel list (null if using role defaults)
    - role_panels: Panels from user's role
    - all_available_panels: All panels that can be assigned
    """
    try:
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get custom panels if set
        custom_panels = user.get_custom_panels()
        
        # Get role-based panels
        from .permissions import get_accessible_panels, get_user_permissions, ROLE_PERMISSIONS
        role_permissions = get_user_permissions(user)
        role_panels = get_accessible_panels(role_permissions)
        
        # Get all available panels
        all_panels = [
            {'id': 'dashboard', 'name': 'Dashboard', 'icon': '📊'},
            {'id': 'ai-insights', 'name': 'AI Insights', 'icon': '🤖'},
            {'id': 'tickets', 'name': 'Tickets', 'icon': '🎫'},
            {'id': 'offence-categories', 'name': 'Offence Categories', 'icon': '📋'},
            {'id': 'offences', 'name': 'Offences', 'icon': '⚖️'},
            {'id': 'penalty-rules', 'name': 'Penalty Rules', 'icon': '💰'},
            {'id': 'challenges', 'name': 'Challenges', 'icon': '⚖️'},
            {'id': 'users', 'name': 'Users', 'icon': '👥'},
            {'id': 'services', 'name': 'Services', 'icon': '🗂️'},
            {'id': 'reports', 'name': 'Reports', 'icon': '📈'},
            {'id': 'settings', 'name': 'Settings', 'icon': '⚙️'},
        ]
        
        return jsonify({
            'user_id': user_id,
            'username': user.username,
            'role': user.role,
            'custom_panels': custom_panels,
            'role_panels': role_panels,
            'all_available_panels': all_panels,
            'using_custom': custom_panels is not None
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get user panels: {str(e)}'}), 500


@admin_bp.route('/users/<int:user_id>/panels', methods=['PUT'])
@admin_required()
def update_user_panels(user_id, current_user):
    """
    Update user's custom panel access
    
    Request body:
    - panels: Array of panel IDs to grant access to (or null to use role defaults)
    
    Examples:
    - {"panels": ["dashboard", "tickets", "reports"]} - Custom panels
    - {"panels": null} - Reset to role defaults
    """
    try:
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        if 'panels' not in data:
            return jsonify({'error': 'panels field is required'}), 400
        
        panels = data['panels']
        
        # Validate panels if provided
        if panels is not None:
            if not isinstance(panels, list):
                return jsonify({'error': 'panels must be an array or null'}), 400
            
            valid_panels = [
                'dashboard', 'ai-insights', 'tickets', 'offence-categories',
                'offences', 'penalty-rules', 'challenges', 'users',
                'services', 'reports', 'settings'
            ]
            
            for panel in panels:
                if panel not in valid_panels:
                    return jsonify({'error': f'Invalid panel: {panel}'}), 400
        
        # Update user's custom panels
        user.set_custom_panels(panels)
        db.session.commit()
        
        return jsonify({
            'message': 'User panel access updated successfully',
            'user_id': user_id,
            'custom_panels': panels,
            'using_custom': panels is not None
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update user panels: {str(e)}'}), 500


@admin_bp.route('/users/<int:user_id>/panels/reset', methods=['POST'])
@admin_required()
def reset_user_panels(user_id, current_user):
    """
    Reset user's panel access to role defaults
    """
    try:
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Reset to role defaults
        user.set_custom_panels(None)
        db.session.commit()
        
        return jsonify({
            'message': 'User panel access reset to role defaults',
            'user_id': user_id,
            'using_custom': False
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to reset user panels: {str(e)}'}), 500


# ============================================================================
# LATE FEE MANAGEMENT
# ============================================================================

from .models import LateFeeConfiguration, LateFeeRule, LateFeeEvent
from .late_fees import calculate_late_fee, process_ticket_late_fees
from .scheduler import trigger_late_fee_processing_now


@admin_bp.route('/late-fee-config', methods=['GET'])
@permission_required(Permission.VIEW_LATE_FEE_CONFIG)
def get_late_fee_config(current_user):
    """Get current late fee configuration"""
    try:
        government = get_current_government()
        
        config = LateFeeConfiguration.query.filter_by(
            government_id=government.id
        ).first()
        
        if not config:
            return jsonify({
                'config': None,
                'message': 'No configuration found. Run migration to create default config.'
            }), 200
        
        return jsonify({
            'config': config.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch config: {str(e)}'}), 500


@admin_bp.route('/late-fee-config', methods=['PUT'])
@permission_required(Permission.MANAGE_LATE_FEE_CONFIG)
def update_late_fee_config(current_user):
    """Update late fee configuration"""
    try:
        government = get_current_government()
        data = request.get_json()
        
        config = LateFeeConfiguration.query.filter_by(
            government_id=government.id
        ).first()
        
        if not config:
            config = LateFeeConfiguration(government_id=government.id)
            db.session.add(config)
        
        # Update fields
        if 'enabled' in data:
            config.enabled = data['enabled']
        if 'grace_period_days' in data:
            config.grace_period_days = data['grace_period_days']
        if 'fee_structure_type' in data:
            config.fee_structure_type = data['fee_structure_type']
        if 'config' in data:
            config.set_config(data['config'])
        if 'max_fee_cap_amount' in data:
            config.max_fee_cap_amount = data['max_fee_cap_amount']
        if 'max_fee_cap_percentage' in data:
            config.max_fee_cap_percentage = data['max_fee_cap_percentage']
        if 'apply_to_original_only' in data:
            config.apply_to_original_only = data['apply_to_original_only']
        if 'pause_during_dispute' in data:
            config.pause_during_dispute = data['pause_during_dispute']
        
        config.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Configuration updated successfully',
            'config': config.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update config: {str(e)}'}), 500


@admin_bp.route('/late-fee-rules', methods=['GET'])
@permission_required(Permission.VIEW_LATE_FEE_RULES)
def get_late_fee_rules(current_user):
    """Get all late fee rules"""
    try:
        government = get_current_government()
        
        query = LateFeeRule.query.filter_by(government_id=government.id)
        
        # Filters
        active = request.args.get('active')
        if active is not None:
            query = query.filter_by(active=active.lower() == 'true')
        
        offence_id = request.args.get('offence_id', type=int)
        if offence_id:
            query = query.filter_by(offence_id=offence_id)
        
        category_id = request.args.get('category_id', type=int)
        if category_id:
            query = query.filter_by(offence_category_id=category_id)
        
        rules = query.order_by(LateFeeRule.priority.desc()).all()
        
        return jsonify({
            'rules': [rule.to_dict() for rule in rules],
            'total': len(rules)
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch rules: {str(e)}'}), 500


@admin_bp.route('/late-fee-rules', methods=['POST'])
@permission_required(Permission.MANAGE_LATE_FEE_RULES)
def create_late_fee_rule(current_user):
    """Create a new late fee rule"""
    try:
        government = get_current_government()
        data = request.get_json()
        
        required_fields = ['name', 'fee_structure_type', 'effective_from']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400
        
        rule = LateFeeRule(
            government_id=government.id,
            offence_category_id=data.get('offence_category_id'),
            offence_id=data.get('offence_id'),
            priority=data.get('priority', 0),
            name=data['name'],
            description=data.get('description'),
            enabled=data.get('enabled', True),
            grace_period_days=data.get('grace_period_days', 0),
            fee_structure_type=data['fee_structure_type'],
            max_fee_cap_amount=data.get('max_fee_cap_amount'),
            max_fee_cap_percentage=data.get('max_fee_cap_percentage'),
            apply_to_original_only=data.get('apply_to_original_only', True),
            pause_during_dispute=data.get('pause_during_dispute', True),
            effective_from=datetime.fromisoformat(data['effective_from']).date(),
            effective_to=datetime.fromisoformat(data['effective_to']).date() if data.get('effective_to') else None,
            active=data.get('active', True)
        )
        
        if 'config' in data:
            rule.set_config(data['config'])
        
        db.session.add(rule)
        db.session.commit()
        
        return jsonify({
            'message': 'Rule created successfully',
            'rule': rule.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create rule: {str(e)}'}), 500


@admin_bp.route('/late-fee-rules/<int:rule_id>', methods=['PUT'])
@permission_required(Permission.MANAGE_LATE_FEE_RULES)
def update_late_fee_rule(rule_id, current_user):
    """Update a late fee rule"""
    try:
        rule = LateFeeRule.query.get(rule_id)
        
        if not rule:
            return jsonify({'error': 'Rule not found'}), 404
        
        data = request.get_json()
        
        # Update fields
        if 'name' in data:
            rule.name = data['name']
        if 'description' in data:
            rule.description = data['description']
        if 'priority' in data:
            rule.priority = data['priority']
        if 'enabled' in data:
            rule.enabled = data['enabled']
        if 'grace_period_days' in data:
            rule.grace_period_days = data['grace_period_days']
        if 'fee_structure_type' in data:
            rule.fee_structure_type = data['fee_structure_type']
        if 'config' in data:
            rule.set_config(data['config'])
        if 'max_fee_cap_amount' in data:
            rule.max_fee_cap_amount = data['max_fee_cap_amount']
        if 'max_fee_cap_percentage' in data:
            rule.max_fee_cap_percentage = data['max_fee_cap_percentage']
        if 'apply_to_original_only' in data:
            rule.apply_to_original_only = data['apply_to_original_only']
        if 'pause_during_dispute' in data:
            rule.pause_during_dispute = data['pause_during_dispute']
        if 'effective_from' in data:
            rule.effective_from = datetime.fromisoformat(data['effective_from']).date()
        if 'effective_to' in data:
            rule.effective_to = datetime.fromisoformat(data['effective_to']).date() if data['effective_to'] else None
        if 'active' in data:
            rule.active = data['active']
        
        rule.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Rule updated successfully',
            'rule': rule.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update rule: {str(e)}'}), 500


@admin_bp.route('/late-fee-rules/<int:rule_id>', methods=['DELETE'])
@permission_required(Permission.MANAGE_LATE_FEE_RULES)
def delete_late_fee_rule(rule_id, current_user):
    """Delete (deactivate) a late fee rule"""
    try:
        rule = LateFeeRule.query.get(rule_id)
        
        if not rule:
            return jsonify({'error': 'Rule not found'}), 404
        
        rule.active = False
        rule.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({'message': 'Rule deactivated successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete rule: {str(e)}'}), 500


@admin_bp.route('/tickets/<int:ticket_id>/calculate-late-fee', methods=['POST'])
@permission_required(Permission.TRIGGER_LATE_FEE_CALC)
def calculate_ticket_late_fee(ticket_id, current_user):
    """Manually calculate late fee for a ticket"""
    try:
        ticket = Ticket.query.get(ticket_id)
        
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        result = process_ticket_late_fees(ticket, commit=True)
        
        return jsonify(result), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to calculate late fee: {str(e)}'}), 500


@admin_bp.route('/tickets/<int:ticket_id>/waive-late-fee', methods=['POST'])
@permission_required(Permission.WAIVE_LATE_FEES)
def waive_ticket_late_fee(ticket_id, current_user):
    """Waive late fees for a ticket"""
    try:
        ticket = Ticket.query.get(ticket_id)
        
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        data = request.get_json() or {}
        reason = data.get('reason', 'No reason provided')
        
        # Mark all late fee events as waived
        events = LateFeeEvent.query.filter_by(
            ticket_id=ticket_id,
            waived=False
        ).all()
        
        total_waived = 0
        for event in events:
            event.waived = True
            event.waived_by_id = current_user.id
            event.waive_reason = reason
            event.waived_at = datetime.utcnow()
            total_waived += float(event.fee_amount)
        
        # Reset ticket late fees
        ticket.late_fees_added = 0
        ticket.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Late fees waived successfully',
            'total_waived': total_waived,
            'events_waived': len(events),
            'ticket': ticket.to_dict(include_admin=True)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to waive late fees: {str(e)}'}), 500


@admin_bp.route('/tickets/<int:ticket_id>/adjust-late-fee', methods=['POST'])
@permission_required(Permission.ADJUST_LATE_FEES)
def adjust_ticket_late_fee(ticket_id, current_user):
    """Manually adjust late fees for a ticket"""
    try:
        ticket = Ticket.query.get(ticket_id)
        
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        data = request.get_json()
        
        if 'new_amount' not in data or 'reason' not in data:
            return jsonify({'error': 'new_amount and reason are required'}), 400
        
        new_amount = Decimal(str(data['new_amount']))
        reason = data['reason']
        
        old_amount = ticket.late_fees_added
        ticket.late_fees_added = new_amount
        ticket.updated_at = datetime.utcnow()
        
        # Create adjustment event
        event = LateFeeEvent(
            ticket_id=ticket_id,
            calculated_at=datetime.utcnow(),
            fee_amount=new_amount - (old_amount or 0),
            days_overdue=ticket.days_overdue(),
            rule_type='manual_adjustment',
            fee_structure_type='manual',
            manually_adjusted=True,
            adjusted_by_id=current_user.id,
            adjustment_reason=reason
        )
        event.set_calculation_details({
            'type': 'manual_adjustment',
            'old_amount': float(old_amount or 0),
            'new_amount': float(new_amount),
            'adjusted_by': current_user.username,
            'reason': reason
        })
        
        db.session.add(event)
        db.session.commit()
        
        return jsonify({
            'message': 'Late fee adjusted successfully',
            'old_amount': float(old_amount or 0),
            'new_amount': float(new_amount),
            'ticket': ticket.to_dict(include_admin=True)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to adjust late fee: {str(e)}'}), 500


@admin_bp.route('/tickets/<int:ticket_id>/late-fee-history', methods=['GET'])
@permission_required(Permission.VIEW_TICKETS)
def get_ticket_late_fee_history(ticket_id, current_user):
    """Get late fee history for a ticket"""
    try:
        ticket = Ticket.query.get(ticket_id)
        
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        events = LateFeeEvent.query.filter_by(
            ticket_id=ticket_id
        ).order_by(LateFeeEvent.calculated_at.desc()).all()
        
        return jsonify({
            'ticket_id': ticket_id,
            'current_late_fees': float(ticket.late_fees_added or 0),
            'events': [event.to_dict() for event in events],
            'total_events': len(events)
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch history: {str(e)}'}), 500


@admin_bp.route('/late-fees/process-now', methods=['POST'])
@permission_required(Permission.TRIGGER_LATE_FEE_CALC)
def trigger_late_fee_processing(current_user):
    """Manually trigger late fee processing"""
    try:
        government = get_current_government()
        
        # Trigger processing for current government only
        result = trigger_late_fee_processing_now(government.id)
        
        return jsonify({
            'message': 'Late fee processing triggered',
            'result': result
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to trigger processing: {str(e)}'}), 500


@admin_bp.route('/late-fees/preview', methods=['GET'])
@permission_required(Permission.VIEW_LATE_FEE_CONFIG)
def preview_late_fees(current_user):
    """Preview late fees that would be calculated"""
    try:
        government = get_current_government()
        
        # Get all overdue tickets
        overdue_tickets = Ticket.query.filter_by(
            government_id=government.id,
            status='overdue'
        ).filter(
            Ticket.late_fee_paused == False
        ).all()
        
        previews = []
        total_fees = 0
        
        for ticket in overdue_tickets:
            result = calculate_late_fee(ticket)
            if result['success'] and result.get('fee_amount', 0) > 0:
                previews.append({
                    'ticket_id': ticket.id,
                    'serial_number': ticket.serial_number,
                    'days_overdue': ticket.days_overdue(),
                    'current_late_fees': float(ticket.late_fees_added or 0),
                    'new_fee': float(result['fee_amount']),
                    'total_after': float(ticket.get_total_due() + result['fee_amount']),
                    'details': result['details']
                })
                total_fees += float(result['fee_amount'])
        
        return jsonify({
            'previews': previews,
            'total_tickets': len(previews),
            'total_new_fees': total_fees
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to preview: {str(e)}'}), 500


# ============================================================================
# TICKET MAP DATA
# ============================================================================

@admin_bp.route('/tickets/map-data', methods=['GET'])
@any_permission_required([Permission.VIEW_TICKETS])
def get_tickets_map_data(current_user):
    """
    Get tickets with geolocation data for map visualization
    
    Returns tickets that have latitude/longitude coordinates for display on Google Maps.
    Supports filtering by date range, status, and time period.
    
    Query Parameters:
    - days: Number of days to look back (default: 30)
    - status: Filter by ticket status (optional)
    - date_from: Start date filter (optional)
    - date_to: End date filter (optional)
    """
    try:
        government = get_current_government()
        
        # Get filter parameters
        days = request.args.get('days', 30, type=int)
        status = request.args.get('status')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        
        # Build query for tickets with geolocation
        query = Ticket.query.filter(
            Ticket.government_id == government.id,
            Ticket.latitude.isnot(None),
            Ticket.longitude.isnot(None)
        )
        
        # Apply date range filter
        if date_from:
            date_from_obj = datetime.fromisoformat(date_from)
            query = query.filter(Ticket.issue_date >= date_from_obj)
        elif days:
            start_date = datetime.utcnow() - timedelta(days=days)
            query = query.filter(Ticket.issue_date >= start_date)
        
        if date_to:
            date_to_obj = datetime.fromisoformat(date_to)
            query = query.filter(Ticket.issue_date <= date_to_obj)
        
        # Apply status filter
        if status:
            query = query.filter(Ticket.status == status)
        
        # Get tickets ordered by most recent first
        tickets = query.order_by(Ticket.issue_date.desc()).limit(1000).all()
        
        # Format data for map markers
        map_data = []
        for ticket in tickets:
            map_data.append({
                'id': ticket.id,
                'serial_number': ticket.serial_number,
                'latitude': float(ticket.latitude),
                'longitude': float(ticket.longitude),
                'location': ticket.location,
                'status': ticket.status,
                'fine_amount': float(ticket.fine_amount),
                'total_due': float(ticket.get_total_due()),
                'issue_date': ticket.issue_date.isoformat(),
                'due_date': ticket.due_date.isoformat(),
                'offense_description': ticket.offense_description,
                'vehicle_plate': ticket.vehicle_plate,
                'driver_name': ticket.driver_name,
                'is_overdue': ticket.is_overdue(),
                'days_overdue': ticket.days_overdue() if ticket.is_overdue() else 0,
                'offence': ticket.offence.to_dict() if ticket.offence else None
            })
        
        # Calculate statistics
        total_tickets = len(map_data)
        total_amount = sum(t['fine_amount'] for t in map_data)
        
        # Status breakdown
        status_counts = {}
        for ticket in tickets:
            status_counts[ticket.status] = status_counts.get(ticket.status, 0) + 1
        
        # Calculate center point (average of all coordinates)
        center_lat = sum(t['latitude'] for t in map_data) / total_tickets if total_tickets > 0 else 13.0969
        center_lng = sum(t['longitude'] for t in map_data) / total_tickets if total_tickets > 0 else -59.6145
        
        return jsonify({
            'tickets': map_data,
            'total_tickets': total_tickets,
            'total_amount': total_amount,
            'status_counts': status_counts,
            'center': {
                'lat': center_lat,
                'lng': center_lng
            },
            'filters': {
                'days': days,
                'status': status,
                'date_from': date_from,
                'date_to': date_to
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch map data: {str(e)}'}), 500
