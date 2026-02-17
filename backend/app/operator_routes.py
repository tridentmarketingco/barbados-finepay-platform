"""
PayFine Operator Routes - Super Admin Control Panel

These routes are for PayFine HQ operators ONLY.
Operators have cross-government access and can:
- Manage governments (create, update, activate, suspend)
- View revenue and billing across all governments
- Monitor transaction intelligence
- Access compliance and audit logs
- Control feature flags

CRITICAL SECURITY:
- Separate authentication from government users
- Uses OperatorUser model (not User model)
- No government_id scoping (cross-government access)
- Strict role-based access control
"""

from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    get_jwt
)
from . import db
from .models import (
    Government, OperatorUser, GovernmentBilling,
    User, Ticket, Service
)
from .encryption import encrypt_payment_config, decrypt_payment_config
from datetime import datetime, timedelta
from sqlalchemy import func, and_, or_
from functools import wraps
import secrets

# Create blueprint for operator routes
operator_bp = Blueprint('operator', __name__, url_prefix='/api/operator')


# ============================================================================
# OPERATOR AUTHENTICATION
# ============================================================================

def operator_required(roles=None):
    """
    Decorator to require operator authentication with optional role check
    
    Args:
        roles: List of allowed roles (e.g., ['super_admin', 'finance'])
               If None, any active operator can access
    
    Usage:
        @operator_bp.route('/governments')
        @operator_required(roles=['super_admin'])
        def manage_governments():
            ...
    """
    def wrapper(fn):
        @wraps(fn)
        @jwt_required()
        def decorator(*args, **kwargs):
            # Get JWT identity
            operator_id = get_jwt_identity()
            jwt_data = get_jwt()
            
            # Check if this is an operator token (not a regular user token)
            if jwt_data.get('user_type') != 'operator':
                return jsonify({
                    'error': 'Operator access required',
                    'message': 'This endpoint is for PayFine operators only'
                }), 403
            
            # Get operator
            operator = OperatorUser.query.get(operator_id)
            
            if not operator:
                return jsonify({'error': 'Operator not found'}), 404
            
            if not operator.is_active:
                return jsonify({'error': 'Operator account is inactive'}), 403
            
            # Check role if specified
            if roles and operator.role not in roles:
                return jsonify({
                    'error': 'Insufficient permissions',
                    'message': f'This endpoint requires one of: {", ".join(roles)}',
                    'your_role': operator.role
                }), 403
            
            # Inject operator into kwargs
            return fn(*args, **kwargs, current_operator=operator)
        
        return decorator
    return wrapper


@operator_bp.route('/login', methods=['POST'])
def operator_login():
    """
    Operator login endpoint
    
    Request body:
    {
        "username": "operator@payfine.com",
        "password": "secure_password"
    }
    
    Returns JWT tokens with user_type='operator'
    """
    try:
        data = request.get_json()
        
        if not data or not data.get('username') or not data.get('password'):
            return jsonify({'error': 'Username and password required'}), 400
        
        # Find operator
        operator = OperatorUser.query.filter(
            (OperatorUser.username == data['username']) | 
            (OperatorUser.email == data['username'])
        ).first()
        
        if not operator or not operator.check_password(data['password']):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        if not operator.is_active:
            return jsonify({'error': 'Account is inactive'}), 403
        
        # Update last login
        operator.last_login = datetime.utcnow()
        db.session.commit()
        
        # Create JWT tokens with operator flag
        additional_claims = {
            'user_type': 'operator',
            'role': operator.role
        }
        
        access_token = create_access_token(
            identity=operator.id,
            additional_claims=additional_claims
        )
        refresh_token = create_refresh_token(
            identity=operator.id,
            additional_claims=additional_claims
        )
        
        return jsonify({
            'message': 'Login successful',
            'access_token': access_token,
            'refresh_token': refresh_token,
            'operator': operator.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Login failed: {str(e)}'}), 500


# ============================================================================
# GOVERNMENT MANAGEMENT
# ============================================================================

@operator_bp.route('/governments', methods=['GET'])
@operator_required()
def get_governments(current_operator):
    """
    Get all governments
    
    Query params:
    - status: Filter by status (pilot, active, suspended)
    - country_iso_code: Filter by country
    - search: Search by name or country
    """
    try:
        query = Government.query
        
        # Apply filters
        status = request.args.get('status')
        if status:
            query = query.filter_by(status=status)
        
        country_iso_code = request.args.get('country_iso_code')
        if country_iso_code:
            query = query.filter_by(country_iso_code=country_iso_code.upper())
        
        search = request.args.get('search')
        if search:
            search_pattern = f'%{search}%'
            query = query.filter(
                or_(
                    Government.government_name.ilike(search_pattern),
                    Government.country_name.ilike(search_pattern)
                )
            )
        
        governments = query.order_by(Government.created_at.desc()).all()
        
        # Include sensitive data for super_admin only
        include_sensitive = current_operator.role == 'super_admin'
        
        return jsonify({
            'governments': [gov.to_dict(include_sensitive=include_sensitive) for gov in governments],
            'total': len(governments)
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch governments: {str(e)}'}), 500


@operator_bp.route('/governments', methods=['POST'])
@operator_required(roles=['super_admin'])
def create_government(current_operator):
    """
    Create a new government (super_admin only)
    
    Request body:
    {
        "government_name": "Government of Trinidad and Tobago",
        "country_name": "Trinidad and Tobago",
        "country_iso_code": "TT",
        "currency_code": "TTD",
        "timezone": "America/Port_of_Spain",
        "legal_framework_version": "Traffic Act 2024",
        "payment_gateway_type": "powertranz",
        "payment_gateway_config": {
            "merchant_id": "12345",
            "password": "secret",
            "api_url": "https://api.powertranz.com"
        },
        "subdomain": "trinidad",
        "contact_email": "info@payfine.gov.tt",
        "contact_phone": "+1-868-123-4567",
        "status": "pilot"
    }
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['government_name', 'country_name', 'country_iso_code', 'currency_code']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Validate ISO codes
        if len(data['country_iso_code']) != 2:
            return jsonify({'error': 'country_iso_code must be 2 characters (ISO 3166-1 alpha-2)'}), 400
        
        if len(data['currency_code']) != 3:
            return jsonify({'error': 'currency_code must be 3 characters (ISO 4217)'}), 400
        
        # Check if subdomain already exists
        if data.get('subdomain'):
            existing = Government.query.filter_by(subdomain=data['subdomain']).first()
            if existing:
                return jsonify({'error': 'Subdomain already exists'}), 409
        
        # Create government
        government = Government(
            government_name=data['government_name'],
            country_name=data['country_name'],
            country_iso_code=data['country_iso_code'].upper(),
            currency_code=data['currency_code'].upper(),
            timezone=data.get('timezone', 'UTC'),
            legal_framework_version=data.get('legal_framework_version'),
            payment_gateway_type=data.get('payment_gateway_type', 'powertranz'),
            subdomain=data.get('subdomain'),
            contact_email=data.get('contact_email'),
            contact_phone=data.get('contact_phone'),
            support_url=data.get('support_url'),
            status=data.get('status', 'pilot')
        )
        
        # Set payment gateway config (encrypted)
        if data.get('payment_gateway_config'):
            government.set_payment_config(data['payment_gateway_config'])
        
        # Set branding
        if data.get('branding'):
            government.set_branding(data['branding'])
        
        db.session.add(government)
        db.session.commit()
        
        return jsonify({
            'message': 'Government created successfully',
            'government': government.to_dict(include_sensitive=True)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create government: {str(e)}'}), 500


@operator_bp.route('/governments/<government_id>', methods=['GET'])
@operator_required()
def get_government(government_id, current_operator):
    """
    Get a specific government by ID
    """
    try:
        government = Government.query.get(government_id)
        
        if not government:
            return jsonify({'error': 'Government not found'}), 404
        
        include_sensitive = current_operator.role == 'super_admin'
        
        return jsonify({
            'government': government.to_dict(include_sensitive=include_sensitive)
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch government: {str(e)}'}), 500


@operator_bp.route('/governments/<government_id>', methods=['PUT'])
@operator_required(roles=['super_admin'])
def update_government(government_id, current_operator):
    """
    Update a government (super_admin only)
    """
    try:
        government = Government.query.get(government_id)
        
        if not government:
            return jsonify({'error': 'Government not found'}), 404
        
        data = request.get_json()
        
        # Update fields
        if 'government_name' in data:
            government.government_name = data['government_name']
        
        if 'country_name' in data:
            government.country_name = data['country_name']
        
        if 'timezone' in data:
            government.timezone = data['timezone']
        
        if 'legal_framework_version' in data:
            government.legal_framework_version = data['legal_framework_version']
        
        if 'contact_email' in data:
            government.contact_email = data['contact_email']
        
        if 'contact_phone' in data:
            government.contact_phone = data['contact_phone']
        
        if 'support_url' in data:
            government.support_url = data['support_url']
        
        if 'payment_gateway_config' in data:
            government.set_payment_config(data['payment_gateway_config'])
        
        if 'branding' in data:
            government.set_branding(data['branding'])
        
        government.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Government updated successfully',
            'government': government.to_dict(include_sensitive=True)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update government: {str(e)}'}), 500


@operator_bp.route('/governments/<government_id>/profile', methods=['PUT'])
@operator_required(roles=['super_admin'])
def update_government_profile(government_id, current_operator):
    """
    Update comprehensive government profile (super_admin only)
    
    Request body can include any/all of these fields:
    {
        "government_name": "Government of Barbados",
        "country_name": "Barbados",
        "country_iso_code": "BB",
        "currency_code": "BBD",
        "timezone": "America/Barbados",
        "legal_framework_version": "Traffic Act 2024",
        "payment_gateway_type": "powertranz",
        "payment_gateway_config": {...},
        "bank_config": {...},
        "branding": {...},
        "openai_api_key": "sk-...",
        "ai_features_enabled": true,
        "gamification_enabled": true,
        "contact_email": "info@gov.bb",
        "contact_phone": "+1-246-123-4567",
        "support_url": "https://support.gov.bb",
        "subdomain": "barbados",
        "status": "active"
    }
    """
    try:
        government = Government.query.get(government_id)
        
        if not government:
            return jsonify({'error': 'Government not found'}), 404
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        # Basic Information
        if 'government_name' in data:
            government.government_name = data['government_name']
        
        if 'country_name' in data:
            government.country_name = data['country_name']
        
        if 'country_iso_code' in data:
            iso_code = data['country_iso_code'].upper()
            if len(iso_code) != 2:
                return jsonify({'error': 'country_iso_code must be 2 characters (ISO 3166-1 alpha-2)'}), 400
            government.country_iso_code = iso_code
        
        # Financial Configuration
        if 'currency_code' in data:
            currency = data['currency_code'].upper()
            if len(currency) != 3:
                return jsonify({'error': 'currency_code must be 3 characters (ISO 4217)'}), 400
            government.currency_code = currency
        
        if 'timezone' in data:
            government.timezone = data['timezone']
        
        if 'legal_framework_version' in data:
            government.legal_framework_version = data['legal_framework_version']
        
        # Payment Gateway Configuration
        if 'payment_gateway_type' in data:
            government.payment_gateway_type = data['payment_gateway_type']
        
        if 'payment_gateway_config' in data:
            government.set_payment_config(data['payment_gateway_config'])
        
        # Bank Configuration
        if 'bank_config' in data:
            # TODO: Encrypt bank_config before storing
            import json
            government.bank_config = json.dumps(data['bank_config'])
        
        # Branding Configuration
        if 'branding' in data:
            government.set_branding(data['branding'])
        
        # AI Configuration
        if 'openai_api_key' in data:
            government.set_openai_key(data['openai_api_key'])
        
        if 'ai_features_enabled' in data:
            government.ai_features_enabled = data['ai_features_enabled']
        
        # Gamification Configuration
        if 'gamification_enabled' in data:
            government.gamification_enabled = data['gamification_enabled']
        
        # Contact Information
        if 'contact_email' in data:
            government.contact_email = data['contact_email']
        
        if 'contact_phone' in data:
            government.contact_phone = data['contact_phone']
        
        if 'support_url' in data:
            government.support_url = data['support_url']
        
        # Advanced Settings
        if 'subdomain' in data:
            # Check if subdomain is already taken by another government
            if data['subdomain']:
                existing = Government.query.filter(
                    Government.subdomain == data['subdomain'],
                    Government.id != government_id
                ).first()
                if existing:
                    return jsonify({'error': 'Subdomain already exists'}), 409
            government.subdomain = data['subdomain']
        
        if 'status' in data:
            valid_statuses = ['pilot', 'active', 'suspended']
            if data['status'] not in valid_statuses:
                return jsonify({'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'}), 400
            government.status = data['status']
        
        government.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Government profile updated successfully',
            'government': government.to_dict(include_sensitive=True)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update government profile: {str(e)}'}), 500


@operator_bp.route('/governments/<government_id>/activate', methods=['POST'])
@operator_required(roles=['super_admin'])
def activate_government(government_id, current_operator):
    """
    Activate a government (pilot → active)
    """
    try:
        government = Government.query.get(government_id)
        
        if not government:
            return jsonify({'error': 'Government not found'}), 404
        
        government.status = 'active'
        government.activated_at = datetime.utcnow()
        government.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Government activated successfully',
            'government': government.to_dict(include_sensitive=True)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to activate government: {str(e)}'}), 500


@operator_bp.route('/governments/<government_id>/suspend', methods=['POST'])
@operator_required(roles=['super_admin'])
def suspend_government(government_id, current_operator):
    """
    Suspend a government
    """
    try:
        government = Government.query.get(government_id)
        
        if not government:
            return jsonify({'error': 'Government not found'}), 404
        
        data = request.get_json() or {}
        reason = data.get('reason', 'No reason provided')
        
        government.status = 'suspended'
        government.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Government suspended successfully',
            'reason': reason,
            'government': government.to_dict(include_sensitive=True)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to suspend government: {str(e)}'}), 500


@operator_bp.route('/governments/<government_id>/reactivate', methods=['POST'])
@operator_required(roles=['super_admin'])
def reactivate_government(government_id, current_operator):
    """
    Reactivate a suspended government
    """
    try:
        government = Government.query.get(government_id)
        
        if not government:
            return jsonify({'error': 'Government not found'}), 404
        
        if government.status != 'suspended':
            return jsonify({
                'error': 'Government is not suspended',
                'message': f'Current status is "{government.status}". Only suspended governments can be reactivated.'
            }), 400
        
        data = request.get_json() or {}
        reason = data.get('reason', 'Reactivated by operator')
        
        government.status = 'active'
        government.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Government reactivated successfully',
            'reason': reason,
            'government': government.to_dict(include_sensitive=True)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to reactivate government: {str(e)}'}), 500


# ============================================================================
# REVENUE & BILLING
# ============================================================================

@operator_bp.route('/revenue/dashboard', methods=['GET'])
@operator_required(roles=['super_admin', 'finance'])
def get_revenue_dashboard(current_operator):
    """
    Get aggregated revenue dashboard
    
    Returns:
    - Total revenue across all governments
    - Revenue per government
    - Platform fees collected
    - Monthly trends
    """
    try:
        # Get date range
        days = request.args.get('days', 30, type=int)
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Total revenue across all governments
        total_revenue = db.session.query(func.sum(Ticket.payment_amount)).filter(
            and_(
                Ticket.status == 'paid',
                Ticket.paid_date >= start_date
            )
        ).scalar() or 0
        
        # Revenue per government
        revenue_by_government = db.session.query(
            Government.id,
            Government.government_name,
            Government.country_name,
            Government.currency_code,
            func.count(Ticket.id).label('transaction_count'),
            func.sum(Ticket.payment_amount).label('total_revenue')
        ).join(Ticket).filter(
            and_(
                Ticket.status == 'paid',
                Ticket.paid_date >= start_date
            )
        ).group_by(Government.id).all()
        
        # Platform fees (from billing records)
        total_platform_fees = db.session.query(
            func.sum(GovernmentBilling.platform_fee_amount)
        ).filter(
            GovernmentBilling.billing_period_start >= start_date
        ).scalar() or 0
        
        return jsonify({
            'summary': {
                'total_revenue': float(total_revenue),
                'total_platform_fees': float(total_platform_fees),
                'period_days': days
            },
            'by_government': [
                {
                    'government_id': row[0],
                    'government_name': row[1],
                    'country_name': row[2],
                    'currency_code': row[3],
                    'transaction_count': row[4],
                    'total_revenue': float(row[5] or 0)
                }
                for row in revenue_by_government
            ]
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch revenue dashboard: {str(e)}'}), 500


@operator_bp.route('/billing/generate', methods=['POST'])
@operator_required(roles=['super_admin', 'finance'])
def generate_billing(current_operator):
    """
    Generate billing records for a specific month
    
    Request body:
    {
        "billing_month": "2024-01",  // YYYY-MM format
        "government_id": "uuid"  // Optional, if not provided generates for all
    }
    """
    try:
        data = request.get_json()
        
        if not data or not data.get('billing_month'):
            return jsonify({'error': 'billing_month is required (YYYY-MM format)'}), 400
        
        billing_month = data['billing_month']
        government_id = data.get('government_id')
        
        # Parse billing month
        from datetime import date
        year, month = map(int, billing_month.split('-'))
        
        # Calculate period
        period_start = date(year, month, 1)
        if month == 12:
            period_end = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            period_end = date(year, month + 1, 1) - timedelta(days=1)
        
        # Get governments to bill
        if government_id:
            governments = [Government.query.get(government_id)]
            if not governments[0]:
                return jsonify({'error': 'Government not found'}), 404
        else:
            governments = Government.query.filter_by(status='active').all()
        
        billing_records = []
        
        for government in governments:
            # Check if billing record already exists
            existing = GovernmentBilling.query.filter_by(
                government_id=government.id,
                billing_month=billing_month
            ).first()
            
            if existing:
                continue  # Skip if already billed
            
            # Calculate metrics for this government
            transactions = Ticket.query.filter(
                and_(
                    Ticket.government_id == government.id,
                    Ticket.paid_date >= period_start,
                    Ticket.paid_date <= period_end
                )
            ).all()
            
            transaction_count = len(transactions)
            successful_transactions = len([t for t in transactions if t.status == 'paid'])
            total_revenue = sum(float(t.payment_amount or 0) for t in transactions if t.status == 'paid')
            
            # Create billing record
            billing = GovernmentBilling(
                government_id=government.id,
                billing_period_start=period_start,
                billing_period_end=period_end,
                billing_month=billing_month,
                transaction_count=transaction_count,
                successful_transactions=successful_transactions,
                total_revenue=total_revenue,
                platform_fee_percentage=2.5,  # Default 2.5%
                invoice_number=f'INV-{government.country_iso_code}-{billing_month}-{secrets.token_hex(4).upper()}',
                status='pending'
            )
            
            # Calculate fees
            billing.calculate_fees()
            
            db.session.add(billing)
            billing_records.append(billing)
        
        db.session.commit()
        
        return jsonify({
            'message': f'Generated {len(billing_records)} billing records',
            'billing_month': billing_month,
            'records': [record.to_dict() for record in billing_records]
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to generate billing: {str(e)}'}), 500


# ============================================================================
# TRANSACTION INTELLIGENCE
# ============================================================================

@operator_bp.route('/analytics/transactions', methods=['GET'])
@operator_required()
def get_transaction_analytics(current_operator):
    """
    Get transaction analytics across all governments
    
    Query params:
    - days: Number of days to analyze (default: 30)
    - government_id: Filter by specific government
    """
    try:
        days = request.args.get('days', 30, type=int)
        government_id = request.args.get('government_id')
        start_date = datetime.utcnow() - timedelta(days=days)
        
        query = Ticket.query.filter(Ticket.created_at >= start_date)
        
        if government_id:
            query = query.filter_by(government_id=government_id)
        
        # Total transactions
        total_transactions = query.count()
        
        # Success rate
        successful = query.filter_by(status='paid').count()
        success_rate = (successful / total_transactions * 100) if total_transactions > 0 else 0
        
        # Average transaction value
        avg_value = db.session.query(func.avg(Ticket.payment_amount)).filter(
            and_(
                Ticket.status == 'paid',
                Ticket.created_at >= start_date
            )
        ).scalar() or 0
        
        return jsonify({
            'period_days': days,
            'total_transactions': total_transactions,
            'successful_transactions': successful,
            'success_rate': round(success_rate, 2),
            'average_transaction_value': float(avg_value)
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch analytics: {str(e)}'}), 500


# ============================================================================
# COMPLIANCE & MONITORING
# ============================================================================

@operator_bp.route('/compliance/alerts', methods=['GET'])
@operator_required(roles=['super_admin', 'support'])
def get_compliance_alerts(current_operator):
    """
    Get compliance alerts (configuration errors, missing ISO codes, etc.)
    """
    try:
        alerts = []
        
        # Check for governments without payment config
        governments_no_payment = Government.query.filter(
            or_(
                Government.payment_gateway_config == None,
                Government.payment_gateway_config == ''
            )
        ).filter_by(status='active').all()
        
        for gov in governments_no_payment:
            alerts.append({
                'severity': 'high',
                'type': 'missing_payment_config',
                'government_id': gov.id,
                'government_name': gov.government_name,
                'message': 'Active government missing payment gateway configuration'
            })
        
        # Check for invalid ISO codes
        governments_invalid_iso = Government.query.filter(
            or_(
                func.length(Government.country_iso_code) != 2,
                func.length(Government.currency_code) != 3
            )
        ).all()
        
        for gov in governments_invalid_iso:
            alerts.append({
                'severity': 'critical',
                'type': 'invalid_iso_code',
                'government_id': gov.id,
                'government_name': gov.government_name,
                'message': f'Invalid ISO codes: country={gov.country_iso_code}, currency={gov.currency_code}'
            })
        
        return jsonify({
            'alerts': alerts,
            'total': len(alerts)
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch alerts: {str(e)}'}), 500


# ============================================================================
# FEATURE FLAGS & GAMIFICATION CONFIGURATION
# ============================================================================

@operator_bp.route('/governments/<government_id>/features', methods=['GET'])
@operator_required()
def get_government_features(government_id, current_operator):
    """
    Get feature flags for a specific government
    """
    try:
        government = Government.query.get(government_id)
        
        if not government:
            return jsonify({'error': 'Government not found'}), 404
        
        # Build features object from government properties and defaults
        features = {
            'payment_processing': True,
            'ticket_challenges': True,
            'gamification_enabled': government.gamification_enabled,
            'mobile_app': False,
            'sms_notifications': True,
            'email_notifications': True,
            'payment_plans': False,
            'bulk_operations': False,
            'advanced_reporting': True,
            'api_access': False,
            'webhook_notifications': False,
            'multi_currency': False,
            'offline_payments': False,
            'qr_code_payments': True,
            'biometric_auth': False,
            'two_factor_auth': True,
            'audit_logging': True,
            'data_export': True,
            'custom_branding': True,
            'white_label': False,
            'developer_mode': False
        }
        
        return jsonify({
            'government_id': government_id,
            'government_name': government.government_name,
            'features': features
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch feature flags: {str(e)}'}), 500


@operator_bp.route('/governments/<government_id>/features', methods=['PUT'])
@operator_required(roles=['super_admin'])
def update_government_features(government_id, current_operator):
    """
    Update feature flags for a specific government
    """
    try:
        government = Government.query.get(government_id)
        
        if not government:
            return jsonify({'error': 'Government not found'}), 404
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        # Update gamification_enabled specifically (saves to database)
        if 'gamification_enabled' in data:
            government.gamification_enabled = data['gamification_enabled']
        
        government.updated_at = datetime.utcnow()
        db.session.commit()
        
        # Build updated features object
        features = {
            'payment_processing': data.get('payment_processing', True),
            'ticket_challenges': data.get('ticket_challenges', True),
            'gamification_enabled': government.gamification_enabled,
            'mobile_app': data.get('mobile_app', False),
            'sms_notifications': data.get('sms_notifications', True),
            'email_notifications': data.get('email_notifications', True),
            'payment_plans': data.get('payment_plans', False),
            'bulk_operations': data.get('bulk_operations', False),
            'advanced_reporting': data.get('advanced_reporting', True),
            'api_access': data.get('api_access', False),
            'webhook_notifications': data.get('webhook_notifications', False),
            'multi_currency': data.get('multi_currency', False),
            'offline_payments': data.get('offline_payments', False),
            'qr_code_payments': data.get('qr_code_payments', True),
            'biometric_auth': data.get('biometric_auth', False),
            'two_factor_auth': data.get('two_factor_auth', True),
            'audit_logging': data.get('audit_logging', True),
            'data_export': data.get('data_export', True),
            'custom_branding': data.get('custom_branding', True),
            'white_label': data.get('white_label', False),
            'developer_mode': data.get('developer_mode', False)
        }
        
        return jsonify({
            'message': 'Feature flags updated successfully',
            'government_id': government_id,
            'government_name': government.government_name,
            'features': features
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update feature flags: {str(e)}'}), 500


@operator_bp.route('/governments/<government_id>/gamification', methods=['GET'])
@operator_required()
def get_gamification_config(government_id, current_operator):
    """
    Get gamification configuration for a specific government
    """
    try:
        government = Government.query.get(government_id)
        
        if not government:
            return jsonify({'error': 'Government not found'}), 404
        
        return jsonify({
            'government_id': government_id,
            'government_name': government.government_name,
            'gamification_enabled': government.gamification_enabled,
            'status': 'enabled' if government.gamification_enabled else 'disabled'
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch gamification config: {str(e)}'}), 500


@operator_bp.route('/governments/<government_id>/gamification', methods=['PUT'])
@operator_required(roles=['super_admin'])
def update_gamification_config(government_id, current_operator):
    """
    Update gamification configuration for a specific government
    
    Request body:
    {
        "gamification_enabled": true  // or false to disable
    }
    """
    try:
        government = Government.query.get(government_id)
        
        if not government:
            return jsonify({'error': 'Government not found'}), 404
        
        data = request.get_json()
        
        if data is None or 'gamification_enabled' not in data:
            return jsonify({'error': 'gamification_enabled field is required'}), 400
        
        # Update gamification enabled status
        old_status = government.gamification_enabled
        new_status = data['gamification_enabled']
        government.gamification_enabled = new_status
        government.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Gamification configuration updated successfully',
            'government_id': government_id,
            'government_name': government.government_name,
            'gamification_enabled': government.gamification_enabled,
            'previous_status': 'enabled' if old_status else 'disabled',
            'new_status': 'enabled' if new_status else 'disabled'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update gamification config: {str(e)}'}), 500


# ============================================================================
# AUDIT LOGS
# ============================================================================

@operator_bp.route('/audit-logs', methods=['GET'])
@operator_required()
def get_audit_logs(current_operator):
    """
    Get audit logs for operator actions
    
    Query params:
    - days: Number of days to retrieve (default: 7)
    - action_type: Filter by action type
    - government_id: Filter by government
    - operator_id: Filter by operator
    """
    try:
        from .audit import AuditLog
        
        # Get query parameters
        days = request.args.get('days', 7, type=int)
        action_type = request.args.get('action_type')
        government_id = request.args.get('government_id')
        operator_id = request.args.get('operator_id')
        
        # Calculate date range
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Build query
        query = AuditLog.query.filter(AuditLog.timestamp >= start_date)
        
        # Apply filters
        if action_type:
            query = query.filter_by(action_type=action_type)
        
        if government_id:
            query = query.filter_by(government_id=government_id)
        
        if operator_id:
            query = query.filter_by(user_id=operator_id)
        
        # Get logs ordered by most recent
        logs = query.order_by(AuditLog.timestamp.desc()).limit(1000).all()
        
        # Format logs for response
        formatted_logs = []
        for log in logs:
            formatted_logs.append({
                'id': log.id,
                'timestamp': log.timestamp.isoformat() if log.timestamp else None,
                'action_type': log.action_type,
                'operator_id': log.user_id,
                'operator_name': log.user_name,
                'operator_role': log.user_role,
                'government_id': log.government_id,
                'resource_type': log.resource_type,
                'resource_id': log.resource_id,
                'details': log.details,
                'ip_address': log.ip_address,
                'user_agent': log.user_agent
            })
        
        return jsonify({
            'logs': formatted_logs,
            'total': len(formatted_logs),
            'period_days': days
        }), 200
        
    except Exception as e:
        # If audit log table doesn't exist, return empty logs
        return jsonify({
            'logs': [],
            'total': 0,
            'period_days': days,
            'note': 'Audit logging not yet configured'
        }), 200
