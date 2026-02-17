"""
Points API Routes - Merit/Demerit Point System Endpoints

Public and authenticated endpoints for:
- Points balance and status
- Transaction history
- Point additions (for violations)
- Merit awards
- BLA sync integration
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import desc
from . import db
from .models import Government
from .points_models import PointsHistory, MeritBalance, DemeritBalance
from .gamification_models import CitizenProfile
from .points_service import MeritDemeritService
from .middleware import get_current_government
from datetime import datetime

points_bp = Blueprint('points', __name__, url_prefix='/api/points')


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_by_identifier(government, national_id=None, driver_license=None, profile_id=None):
    """Helper to find citizen profile by identifier"""
    if profile_id:
        return CitizenProfile.query.get(profile_id)
    
    if national_id:
        return CitizenProfile.query.filter(
            CitizenProfile.government_id == government.id,
            CitizenProfile.national_id_hash == CitizenProfile.hash_identifier(national_id)
        ).first()
    
    if driver_license:
        return CitizenProfile.query.filter(
            CitizenProfile.government_id == government.id,
            CitizenProfile.driver_license_hash == CitizenProfile.hash_identifier(driver_license)
        ).first()
    
    return None


# ============================================================================
# STATUS ENDPOINTS
# ============================================================================

@points_bp.route('/status', methods=['GET'])
def get_points_status():
    """
    Get citizen's complete points status
    
    Query params:
    - national_id: National ID (hashed)
    - driver_license: Driver license number
    - profile_id: Citizen profile ID
    """
    try:
        government = get_current_government()
        
        national_id = request.args.get('national_id')
        driver_license = request.args.get('driver_license')
        profile_id = request.args.get('profile_id', type=int)
        
        if not any([national_id, driver_license, profile_id]):
            return jsonify({'error': 'Must provide national_id, driver_license, or profile_id'}), 400
        
        # Get full status
        status = MeritDemeritService.get_full_points_status(
            government_id=government.id,
            national_id=national_id,
            driver_license=driver_license,
            profile_id=profile_id
        )
        
        if 'error' in status:
            return jsonify({'error': status['error']}), 404
        
        return jsonify({
            'status': 'success',
            'data': status
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch status: {str(e)}'}), 500


@points_bp.route('/balance', methods=['GET'])
def get_points_balance():
    """
    Get citizen's points balance (merit and demerit)
    
    Query params:
    - national_id: National ID
    - driver_license: Driver license
    - profile_id: Profile ID
    """
    try:
        government = get_current_government()
        
        national_id = request.args.get('national_id')
        driver_license = request.args.get('driver_license')
        profile_id = request.args.get('profile_id', type=int)
        
        if not any([national_id, driver_license, profile_id]):
            return jsonify({'error': 'Must provide identification'}), 400
        
        # Get balances
        merit, demerit = MeritDemeritService.get_or_create_citizen_balances(
            government_id=government.id,
            national_id=national_id,
            driver_license=driver_license,
            profile_id=profile_id
        )
        
        if not demerit:
            return jsonify({
                'status': 'success',
                'data': {
                    'merit': None,
                    'demerit': {
                        'current_demerit_points': 0,
                        'active_demerit_count': 0,
                        'status': 'clear'
                    }
                }
            }), 200
        
        # Recalculate demerits
        demerit.calculate_current_demerits()
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'data': {
                'merit': merit.to_dict() if merit else None,
                'demerit': demerit.to_dict()
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch balance: {str(e)}'}), 500


@points_bp.route('/suspension-status', methods=['GET'])
def get_suspension_status():
    """
    Get citizen's suspension status
    
    Query params:
    - national_id: National ID
    - driver_license: Driver license
    - profile_id: Profile ID
    """
    try:
        government = get_current_government()
        
        national_id = request.args.get('national_id')
        driver_license = request.args.get('driver_license')
        profile_id = request.args.get('profile_id', type=int)
        
        status = MeritDemeritService.get_suspension_status(
            government_id=government.id,
            national_id=national_id,
            driver_license=driver_license,
            profile_id=profile_id
        )
        
        if not status:
            return jsonify({'error': 'Citizen not found'}), 404
        
        return jsonify({
            'status': 'success',
            'data': status
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch status: {str(e)}'}), 500


# ============================================================================
# HISTORY ENDPOINTS
# ============================================================================

@points_bp.route('/history', methods=['GET'])
def get_points_history():
    """
    Get points transaction history
    
    Query params:
    - national_id: National ID
    - driver_license: Driver license
    - profile_id: Profile ID
    - point_type: Filter ('merit', 'demerit')
    - status: Filter ('active', 'expired')
    - limit: Max records (default 50)
    - offset: Pagination offset
    """
    try:
        government = get_current_government()
        
        national_id = request.args.get('national_id')
        driver_license = request.args.get('driver_license')
        profile_id = request.args.get('profile_id', type=int)
        point_type = request.args.get('point_type')
        status_filter = request.args.get('status')
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        if not any([national_id, driver_license, profile_id]):
            return jsonify({'error': 'Must provide identification'}), 400
        
        result = MeritDemeritService.get_points_history(
            government_id=government.id,
            national_id=national_id,
            driver_license=driver_license,
            profile_id=profile_id,
            point_type=point_type,
            status=status_filter,
            limit=limit,
            offset=offset
        )
        
        if 'error' in result:
            return jsonify({'error': result['error']}), 404
        
        return jsonify({
            'status': 'success',
            'data': result
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch history: {str(e)}'}), 500


@points_bp.route('/active-demerits', methods=['GET'])
def get_active_demerits():
    """
    Get all active (non-expired) demerit entries
    
    Query params:
    - national_id: National ID
    - driver_license: Driver license
    - profile_id: Profile ID
    """
    try:
        government = get_current_government()
        
        national_id = request.args.get('national_id')
        driver_license = request.args.get('driver_license')
        profile_id = request.args.get('profile_id', type=int)
        
        active_demerits = MeritDemeritService.get_active_demerits(
            government_id=government.id,
            national_id=national_id,
            driver_license=driver_license,
            profile_id=profile_id
        )
        
        total_points = sum(d['points_delta'] for d in active_demerits)
        
        return jsonify({
            'status': 'success',
            'data': {
                'active_demerits': active_demerits,
                'total_points': total_points,
                'count': len(active_demerits),
                'days_until_expiry': 365
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch demerits: {str(e)}'}), 500


# ============================================================================
# DEMERIT ENDPOINTS
# ============================================================================

@points_bp.route('/demerit/add', methods=['POST'])
def add_demerit_points():
    """
    Add demerit points for a traffic violation
    
    Request body:
    {
        "national_id": "xxx",
        "driver_license": "xxx",
        "offence_code": "SPEEDING_MINOR",
        "offence_id": 1,
        "points": 3,
        "ticket_id": 123,
        "fine_amount": 500,
        "description": "Speeding 25km/h over limit",
        "source_type": "ticket",  // 'ticket', 'court_order', 'bla_sync'
        "effective_date": "2026-01-15"
    }
    """
    try:
        government = get_current_government()
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body required'}), 400
        
        # Required fields
        national_id = data.get('national_id')
        driver_license = data.get('driver_license')
        profile_id = data.get('profile_id')
        
        if not any([national_id, driver_license, profile_id]):
            return jsonify({'error': 'Must provide national_id, driver_license, or profile_id'}), 400
        
        # Add demerit points
        result = MeritDemeritService.add_demerit_points(
            government_id=government.id,
            national_id=national_id,
            driver_license=driver_license,
            profile_id=profile_id,
            offence_code=data.get('offence_code'),
            offence_id=data.get('offence_id'),
            points=data.get('points'),
            ticket_id=data.get('ticket_id'),
            fine_amount=data.get('fine_amount'),
            description=data.get('description'),
            source_type=data.get('source_type', 'ticket'),
            effective_date=data.get('effective_date')
        )
        
        if not result['success']:
            return jsonify({'error': result['error']}), 400
        
        return jsonify({
            'status': 'success',
            'message': 'Demerit points added successfully',
            'data': result
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to add demerit points: {str(e)}'}), 500


@points_bp.route('/demerit/calculate', methods=['GET'])
def calculate_demerits():
    """
    Calculate current demerit points (12-month rolling window)
    
    Query params:
    - national_id: National ID
    - driver_license: Driver license
    - profile_id: Profile ID
    """
    try:
        government = get_current_government()
        
        national_id = request.args.get('national_id')
        driver_license = request.args.get('driver_license')
        profile_id = request.args.get('profile_id', type=int)
        
        if not any([national_id, driver_license, profile_id]):
            return jsonify({'error': 'Must provide identification'}), 400
        
        result = MeritDemeritService.calculate_current_demerits(
            government_id=government.id,
            national_id=national_id,
            driver_license=driver_license,
            profile_id=profile_id
        )
        
        if not result:
            return jsonify({'error': 'Citizen not found'}), 404
        
        return jsonify({
            'status': 'success',
            'data': result
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to calculate demerits: {str(e)}'}), 500


# ============================================================================
# MERIT ENDPOINTS
# ============================================================================

@points_bp.route('/merit/award', methods=['POST'])
def award_merit_points():
    """
    Award merit points to a citizen
    
    Request body:
    {
        "national_id": "xxx",
        "driver_license": "xxx",
        "points": 5,
        "reason": "2 years clean driving",
        "source_type": "bonus"  // 'auto_award', 'manual', 'bonus'
    }
    """
    try:
        government = get_current_government()
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body required'}), 400
        
        national_id = data.get('national_id')
        driver_license = data.get('driver_license')
        profile_id = data.get('profile_id')
        points = data.get('points', 1)
        
        if not any([national_id, driver_license, profile_id]):
            return jsonify({'error': 'Must provide identification'}), 400
        
        result = MeritDemeritService.add_merit_points(
            government_id=government.id,
            national_id=national_id,
            driver_license=driver_license,
            profile_id=profile_id,
            points=points,
            reason=data.get('reason'),
            source_type=data.get('source_type', 'manual')
        )
        
        if not result['success']:
            return jsonify({'error': result['error']}), 400
        
        return jsonify({
            'status': 'success',
            'message': 'Merit points awarded successfully',
            'data': result
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to award merit points: {str(e)}'}), 500


@points_bp.route('/merit/status', methods=['GET'])
def get_merit_status():
    """
    Get citizen's merit point status
    
    Query params:
    - national_id: National ID
    - driver_license: Driver license
    - profile_id: Profile ID
    """
    try:
        government = get_current_government()
        
        national_id = request.args.get('national_id')
        driver_license = request.args.get('driver_license')
        profile_id = request.args.get('profile_id', type=int)
        
        status = MeritDemeritService.get_merit_status(
            government_id=government.id,
            national_id=national_id,
            driver_license=driver_license,
            profile_id=profile_id
        )
        
        if not status:
            return jsonify({'error': 'Citizen not found'}), 404
        
        return jsonify({
            'status': 'success',
            'data': status
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch merit status: {str(e)}'}), 500


@points_bp.route('/merit/offset', methods=['POST'])
def offset_demerits():
    """
    Offset demerit points using merit points
    
    Automatically offsets up to 3 demerits using available merit points.
    
    Request body:
    {
        "national_id": "xxx",
        "driver_license": "xxx"
    }
    """
    try:
        government = get_current_government()
        data = request.get_json() or {}
        
        national_id = data.get('national_id')
        driver_license = data.get('driver_license')
        profile_id = data.get('profile_id')
        
        if not any([national_id, driver_license, profile_id]):
            return jsonify({'error': 'Must provide identification'}), 400
        
        result = MeritDemeritService.offset_demerits_with_merits(
            government_id=government.id,
            national_id=national_id,
            driver_license=driver_license,
            profile_id=profile_id
        )
        
        return jsonify({
            'status': 'success',
            'message': result.get('message', 'Offset complete'),
            'data': result
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to offset demerits: {str(e)}'}), 500


# ============================================================================
# OFFENCE POINTS ENDPOINTS
# ============================================================================

@points_bp.route('/offence/<offence_code>/points', methods=['GET'])
def get_offence_points(offence_code):
    """
    Get point value for an offence
    
    Path params:
    - offence_code: Offence code (e.g., 'SPEEDING_MINOR')
    
    Query params:
    - measured_value: Measured value (speed, BAC)
    - offence_id: Database offence ID
    """
    try:
        offence_id = request.args.get('offence_id', type=int)
        measured_value = request.args.get('measured_value', type=float)
        
        result = MeritDemeritService.get_offence_points(
            offence_code=offence_code,
            offence_id=offence_id,
            measured_value=measured_value
        )
        
        return jsonify({
            'status': 'success',
            'data': result
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get offence points: {str(e)}'}), 500


# ============================================================================
# BLA SYNC ENDPOINTS
# ============================================================================

@points_bp.route('/bla/sync', methods=['POST'])
def sync_bla():
    """
    Sync points status with Licensing Authority (BLA)
    
    Request body:
    {
        "national_id": "xxx",
        "driver_license": "xxx"
    }
    """
    try:
        government = get_current_government()
        data = request.get_json() or {}
        
        national_id = data.get('national_id')
        driver_license = data.get('driver_license')
        profile_id = data.get('profile_id')
        
        result = MeritDemeritService.sync_with_bla(
            government_id=government.id,
            national_id=national_id,
            driver_license=driver_license,
            profile_id=profile_id
        )
        
        return jsonify({
            'status': 'success',
            'data': result
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to sync with BLA: {str(e)}'}), 500


# ============================================================================
# MAINTENANCE ENDPOINTS (Scheduled Tasks)
# ============================================================================

@points_bp.route('/maintenance/expire', methods=['POST'])
def expire_points():
    """
    Trigger point expiry process
    
    Request body:
    {
        "government_id": "xxx"  // Optional, for single government
    }
    """
    try:
        # Only allow in development or with admin key
        data = request.get_json() or {}
        government_id = data.get('government_id')
        
        result = MeritDemeritService.expire_old_points(government_id)
        
        return jsonify({
            'status': 'success',
            'message': 'Point expiry complete',
            'data': result
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to expire points: {str(e)}'}), 500


@points_bp.route('/maintenance/award-merits', methods=['POST'])
def award_merits():
    """
    Trigger merit award process
    
    Request body:
    {
        "government_id": "xxx"  // Optional
    }
    """
    try:
        data = request.get_json() or {}
        government_id = data.get('government_id')
        
        result = MeritDemeritService.check_and_award_merits(government_id)
        
        return jsonify({
            'status': 'success',
            'message': 'Merit award check complete',
            'data': result
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to award merits: {str(e)}'}), 500


# ============================================================================
# REFERENCE DATA ENDPOINTS
# ============================================================================

@points_bp.route('/thresholds', methods=['GET'])
def get_thresholds():
    """
    Get demerit threshold configuration
    
    Returns current threshold settings for suspension/revocation.
    """
    try:
        government = get_current_government()
        
        thresholds = {
            'warning_threshold': 10,
            'suspension_threshold': 14,
            'revocation_threshold': 20,
            'suspension_duration_months': 12,
            'revocation_duration_months': 24,
            'rolling_window_days': 365,
            'merit': {
                'enabled': True,
                'max_points': 10,
                'offset_cap': 3,
                '6_month_award': 1,
                '12_month_award': 2,
                '2_year_bonus': 3
            }
        }
        
        return jsonify({
            'status': 'success',
            'data': thresholds
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch thresholds: {str(e)}'}), 500


@points_bp.route('/offence-points-table', methods=['GET'])
def get_offence_points_table():
    """
    Get offence points reference table
    
    Returns standard point values for common offences (Barbados 2026).
    """
    try:
        offence_points = MeritDemeritService.DEFAULT_OFFENCE_POINTS
        
        table = []
        for code, data in offence_points.items():
            table.append({
                'offence_code': code.upper(),
                'points': data['points'],
                'fine_min': data['fine_min'],
                'fine_max': data['fine_max'],
                'category': code.split('_')[0] if '_' in code else 'other'
            })
        
        # Sort by points
        table.sort(key=lambda x: x['points'])
        
        return jsonify({
            'status': 'success',
            'data': {
                'offences': table,
                'total': len(table),
                'thresholds': {
                    'suspension': 14,
                    'revocation': 20
                }
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch offence table: {str(e)}'}), 500

