"""
Gamification API Routes - Public citizen endpoints
Handles citizen profiles, badges, rewards, leaderboards, and points
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from . import db
from .gamification_models import (
    CitizenProfile, Badge, CitizenBadge, Reward, CitizenReward,
    PointTransaction, Leaderboard, LeaderboardEntry, EarlyPaymentDiscount
)
from .models import Ticket, User
from .gamification import GamificationService
from .middleware import get_current_government
from datetime import datetime
from decimal import Decimal

gamification_bp = Blueprint('gamification', __name__, url_prefix='/api/gamification')


# ============================================================================
# CITIZEN PROFILE ENDPOINTS
# ============================================================================

@gamification_bp.route('/profile', methods=['GET'])
def get_citizen_profile():
    """
    Get citizen's gamification profile (public endpoint)
    
    Query params:
    - national_id: National ID (will be hashed)
    - driver_license: Driver license (will be hashed)
    - ticket_serial: Ticket serial number (to link profile)
    """
    try:
        government = get_current_government()
        
        # Get identifier from query params
        national_id = request.args.get('national_id')
        driver_license = request.args.get('driver_license')
        ticket_serial = request.args.get('ticket_serial')
        
        profile = None
        
        # Try to find by ticket first
        if ticket_serial:
            ticket = Ticket.query.filter_by(
                government_id=government.id,
                serial_number=ticket_serial
            ).first()
            
            if ticket and ticket.citizen_profile_id:
                profile = CitizenProfile.query.get(ticket.citizen_profile_id)
        
        # Try to find by identifiers
        if not profile:
            profile = GamificationService.get_or_create_citizen_profile(
                government_id=government.id,
                national_id=national_id,
                driver_license=driver_license
            )
        
        if not profile:
            return jsonify({'error': 'Profile not found. Please provide valid identification.'}), 404
        
        # Update streaks
        profile.update_streaks()
        db.session.commit()
        
        return jsonify({
            'profile': profile.to_dict(),
            'badges_count': len(profile.badges),
            'rewards_count': len([r for r in profile.rewards if r.is_valid()])
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch profile: {str(e)}'}), 500


@gamification_bp.route('/profile/stats', methods=['GET'])
def get_citizen_stats():
    """Get detailed statistics for a citizen"""
    try:
        government = get_current_government()
        
        national_id = request.args.get('national_id')
        driver_license = request.args.get('driver_license')
        
        profile = GamificationService.get_or_create_citizen_profile(
            government_id=government.id,
            national_id=national_id,
            driver_license=driver_license
        )
        
        if not profile:
            return jsonify({'error': 'Profile not found'}), 404
        
        # Calculate current driving score
        driving_score = profile.calculate_driving_score()
        
        # Get recent point transactions
        recent_transactions = PointTransaction.query.filter_by(
            citizen_profile_id=profile.id
        ).order_by(PointTransaction.created_at.desc()).limit(10).all()
        
        # Get badge progress
        all_badges = Badge.query.filter_by(
            government_id=government.id,
            is_active=True
        ).all()
        
        earned_badge_ids = [cb.badge_id for cb in profile.badges]
        
        badge_progress = []
        for badge in all_badges:
            if badge.id not in earned_badge_ids:
                # Calculate progress toward badge
                progress = 0
                if badge.requirement_type == 'tickets_paid':
                    progress = min(100, int((profile.total_tickets_paid / badge.requirement_value) * 100))
                elif badge.requirement_type == 'clean_days':
                    progress = min(100, int((profile.clean_driving_streak_days / badge.requirement_value) * 100))
                elif badge.requirement_type == 'points_earned':
                    progress = min(100, int((profile.total_points / badge.requirement_value) * 100))
                
                if progress > 0:
                    badge_progress.append({
                        'badge': badge.to_dict(),
                        'progress': progress
                    })
        
        db.session.commit()
        
        return jsonify({
            'profile': profile.to_dict(),
            'driving_score': driving_score,
            'recent_transactions': [t.to_dict() for t in recent_transactions],
            'badge_progress': sorted(badge_progress, key=lambda x: x['progress'], reverse=True)[:5]
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch stats: {str(e)}'}), 500


# ============================================================================
# BADGES ENDPOINTS
# ============================================================================

@gamification_bp.route('/badges', methods=['GET'])
def get_all_badges():
    """Get all available badges"""
    try:
        government = get_current_government()
        
        badges = Badge.query.filter_by(
            government_id=government.id,
            is_active=True
        ).order_by(Badge.display_order, Badge.tier, Badge.name).all()
        
        # Group by tier
        badges_by_tier = {}
        for badge in badges:
            tier = badge.tier or 'other'
            if tier not in badges_by_tier:
                badges_by_tier[tier] = []
            badges_by_tier[tier].append(badge.to_dict())
        
        return jsonify({
            'badges': [b.to_dict() for b in badges],
            'badges_by_tier': badges_by_tier,
            'total': len(badges)
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch badges: {str(e)}'}), 500


@gamification_bp.route('/profile/badges', methods=['GET'])
def get_citizen_badges():
    """Get citizen's earned badges"""
    try:
        government = get_current_government()
        
        national_id = request.args.get('national_id')
        driver_license = request.args.get('driver_license')
        
        profile = GamificationService.get_or_create_citizen_profile(
            government_id=government.id,
            national_id=national_id,
            driver_license=driver_license
        )
        
        if not profile:
            return jsonify({'error': 'Profile not found'}), 404
        
        # Get earned badges
        earned_badges = CitizenBadge.query.filter_by(
            citizen_profile_id=profile.id
        ).order_by(CitizenBadge.earned_at.desc()).all()
        
        return jsonify({
            'badges': [cb.to_dict() for cb in earned_badges],
            'total': len(earned_badges)
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch badges: {str(e)}'}), 500


# ============================================================================
# REWARDS ENDPOINTS
# ============================================================================

@gamification_bp.route('/rewards', methods=['GET'])
def get_available_rewards():
    """Get all available rewards"""
    try:
        government = get_current_government()
        
        # Get query params
        featured_only = request.args.get('featured', 'false').lower() == 'true'
        reward_type = request.args.get('type')
        
        query = Reward.query.filter_by(
            government_id=government.id,
            is_active=True
        )
        
        if featured_only:
            query = query.filter_by(is_featured=True)
        
        if reward_type:
            query = query.filter_by(reward_type=reward_type)
        
        rewards = query.order_by(
            Reward.is_featured.desc(),
            Reward.display_order,
            Reward.points_cost
        ).all()
        
        return jsonify({
            'rewards': [r.to_dict() for r in rewards],
            'total': len(rewards)
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch rewards: {str(e)}'}), 500


@gamification_bp.route('/rewards/<int:reward_id>/redeem', methods=['POST'])
def redeem_reward(reward_id):
    """Redeem a reward using points"""
    try:
        government = get_current_government()
        data = request.get_json() or {}
        
        national_id = data.get('national_id')
        driver_license = data.get('driver_license')
        
        profile = GamificationService.get_or_create_citizen_profile(
            government_id=government.id,
            national_id=national_id,
            driver_license=driver_license
        )
        
        if not profile:
            return jsonify({'error': 'Profile not found'}), 404
        
        # Redeem reward
        success, message, citizen_reward = GamificationService.redeem_reward(
            citizen_profile=profile,
            reward_id=reward_id
        )
        
        if not success:
            return jsonify({'error': message}), 400
        
        db.session.commit()
        
        return jsonify({
            'message': message,
            'reward': citizen_reward.to_dict(),
            'new_balance': profile.total_points
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to redeem reward: {str(e)}'}), 500


@gamification_bp.route('/profile/rewards', methods=['GET'])
def get_citizen_rewards():
    """Get citizen's redeemed rewards"""
    try:
        government = get_current_government()
        
        national_id = request.args.get('national_id')
        driver_license = request.args.get('driver_license')
        
        profile = GamificationService.get_or_create_citizen_profile(
            government_id=government.id,
            national_id=national_id,
            driver_license=driver_license
        )
        
        if not profile:
            return jsonify({'error': 'Profile not found'}), 404
        
        # Get redeemed rewards
        rewards = CitizenReward.query.filter_by(
            citizen_profile_id=profile.id
        ).order_by(CitizenReward.redeemed_at.desc()).all()
        
        # Separate valid and used/expired
        valid_rewards = [r for r in rewards if r.is_valid()]
        used_rewards = [r for r in rewards if r.is_used]
        expired_rewards = [r for r in rewards if r.is_expired and not r.is_used]
        
        return jsonify({
            'valid': [r.to_dict() for r in valid_rewards],
            'used': [r.to_dict() for r in used_rewards],
            'expired': [r.to_dict() for r in expired_rewards],
            'total': len(rewards)
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch rewards: {str(e)}'}), 500


@gamification_bp.route('/rewards/<redemption_code>/verify', methods=['GET'])
def verify_reward_code(redemption_code):
    """Verify a reward redemption code"""
    try:
        citizen_reward = CitizenReward.query.filter_by(
            redemption_code=redemption_code
        ).first()
        
        if not citizen_reward:
            return jsonify({'valid': False, 'message': 'Invalid code'}), 404
        
        if not citizen_reward.is_valid():
            return jsonify({
                'valid': False,
                'message': 'Reward expired or already used',
                'reward': citizen_reward.to_dict()
            }), 200
        
        return jsonify({
            'valid': True,
            'reward': citizen_reward.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to verify code: {str(e)}'}), 500


# ============================================================================
# LEADERBOARDS ENDPOINTS
# ============================================================================

@gamification_bp.route('/leaderboards', methods=['GET'])
def get_leaderboards():
    """Get all active leaderboards"""
    try:
        government = get_current_government()
        
        leaderboards = Leaderboard.query.filter_by(
            government_id=government.id,
            is_active=True,
            is_public=True
        ).all()
        
        return jsonify({
            'leaderboards': [lb.to_dict() for lb in leaderboards],
            'total': len(leaderboards)
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch leaderboards: {str(e)}'}), 500


@gamification_bp.route('/leaderboards/<int:leaderboard_id>', methods=['GET'])
def get_leaderboard_rankings(leaderboard_id):
    """Get rankings for a specific leaderboard"""
    try:
        leaderboard = Leaderboard.query.get(leaderboard_id)
        
        if not leaderboard:
            return jsonify({'error': 'Leaderboard not found'}), 404
        
        if not leaderboard.is_public:
            return jsonify({'error': 'Leaderboard is private'}), 403
        
        # Get rankings
        entries = LeaderboardEntry.query.filter_by(
            leaderboard_id=leaderboard_id
        ).order_by(LeaderboardEntry.rank).limit(leaderboard.max_display_rank).all()
        
        return jsonify({
            'leaderboard': leaderboard.to_dict(),
            'rankings': [entry.to_dict() for entry in entries],
            'total': len(entries)
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch rankings: {str(e)}'}), 500


@gamification_bp.route('/leaderboards/<int:leaderboard_id>/my-rank', methods=['GET'])
def get_my_leaderboard_rank(leaderboard_id):
    """Get citizen's rank on a leaderboard"""
    try:
        government = get_current_government()
        
        national_id = request.args.get('national_id')
        driver_license = request.args.get('driver_license')
        
        profile = GamificationService.get_or_create_citizen_profile(
            government_id=government.id,
            national_id=national_id,
            driver_license=driver_license
        )
        
        if not profile:
            return jsonify({'error': 'Profile not found'}), 404
        
        # Check if opted in
        if not profile.opted_in_leaderboard:
            return jsonify({
                'opted_in': False,
                'message': 'You must opt in to leaderboards to see your rank'
            }), 200
        
        # Get rank
        entry = LeaderboardEntry.query.filter_by(
            leaderboard_id=leaderboard_id,
            citizen_profile_id=profile.id
        ).first()
        
        if not entry:
            return jsonify({
                'opted_in': True,
                'ranked': False,
                'message': 'You are not yet ranked on this leaderboard'
            }), 200
        
        return jsonify({
            'opted_in': True,
            'ranked': True,
            'entry': entry.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch rank: {str(e)}'}), 500


@gamification_bp.route('/leaderboards/opt-in', methods=['POST'])
def opt_in_leaderboard():
    """Opt in to leaderboards"""
    try:
        government = get_current_government()
        data = request.get_json() or {}
        
        national_id = data.get('national_id')
        driver_license = data.get('driver_license')
        opt_in = data.get('opt_in', True)
        
        profile = GamificationService.get_or_create_citizen_profile(
            government_id=government.id,
            national_id=national_id,
            driver_license=driver_license
        )
        
        if not profile:
            return jsonify({'error': 'Profile not found'}), 404
        
        profile.opted_in_leaderboard = opt_in
        profile.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': f"Successfully {'opted in to' if opt_in else 'opted out of'} leaderboards",
            'opted_in': profile.opted_in_leaderboard
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update opt-in status: {str(e)}'}), 500


# ============================================================================
# POINTS ENDPOINTS
# ============================================================================

@gamification_bp.route('/profile/points/history', methods=['GET'])
def get_points_history():
    """Get citizen's points transaction history"""
    try:
        government = get_current_government()
        
        national_id = request.args.get('national_id')
        driver_license = request.args.get('driver_license')
        limit = request.args.get('limit', 50, type=int)
        
        profile = GamificationService.get_or_create_citizen_profile(
            government_id=government.id,
            national_id=national_id,
            driver_license=driver_license
        )
        
        if not profile:
            return jsonify({'error': 'Profile not found'}), 404
        
        transactions = PointTransaction.query.filter_by(
            citizen_profile_id=profile.id
        ).order_by(PointTransaction.created_at.desc()).limit(limit).all()
        
        return jsonify({
            'transactions': [t.to_dict() for t in transactions],
            'current_balance': profile.total_points,
            'total': len(transactions)
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch history: {str(e)}'}), 500


# ============================================================================
# EARLY PAYMENT DISCOUNT ENDPOINTS
# ============================================================================

@gamification_bp.route('/tickets/<serial_number>/discount-preview', methods=['GET'])
def preview_early_payment_discount(serial_number):
    """Preview early payment discount for a ticket"""
    try:
        government = get_current_government()
        
        ticket = Ticket.query.filter_by(
            government_id=government.id,
            serial_number=serial_number
        ).first()
        
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        # Calculate discount
        discount_info = GamificationService.calculate_early_payment_discount(ticket)
        
        return jsonify({
            'ticket_serial': serial_number,
            'fine_amount': float(ticket.fine_amount),
            'discount_amount': float(discount_info['discount_amount']),
            'discount_percentage': float(discount_info['discount_percentage']),
            'points_bonus': discount_info['points_bonus'],
            'days_early': discount_info['days_early'],
            'tier_name': discount_info['tier_name'],
            'final_amount': float(ticket.fine_amount - discount_info['discount_amount']),
            'due_date': ticket.due_date.isoformat(),
            'has_discount': discount_info['discount_amount'] > 0
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to calculate discount: {str(e)}'}), 500
