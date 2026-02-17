"""
Admin Gamification API Routes
Handles admin management of gamification features
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func, desc
from . import db
from .gamification_models import (
    CitizenProfile, Badge, CitizenBadge, Reward, CitizenReward,
    PointTransaction, Leaderboard, LeaderboardEntry, EarlyPaymentDiscount
)
from .models import Ticket, User, Government
from .permissions import permission_required, Permission
from datetime import datetime, timedelta
from decimal import Decimal

admin_gamification_bp = Blueprint('admin_gamification', __name__, url_prefix='/api/admin/gamification')


# ============================================================================
# ANALYTICS ENDPOINTS
# ============================================================================

@admin_gamification_bp.route('/analytics/overview', methods=['GET'])
@permission_required(Permission.VIEW_DASHBOARD)
def get_analytics_overview(current_user):
    """
    Get comprehensive gamification analytics overview
    
    Query params:
    - days: Number of days to analyze (default: 30)
    """
    try:
        government_id = current_user.government_id
        days = request.args.get('days', 30, type=int)
        
        # Calculate date range
        if days == 'all':
            start_date = None
        else:
            start_date = datetime.utcnow() - timedelta(days=days)
        
        # Total citizens
        total_citizens = CitizenProfile.query.filter_by(government_id=government_id).count()
        
        # New citizens in period
        new_citizens_query = CitizenProfile.query.filter_by(government_id=government_id)
        if start_date:
            new_citizens_query = new_citizens_query.filter(CitizenProfile.created_at >= start_date)
        new_citizens = new_citizens_query.count()
        
        # Points statistics
        points_query = PointTransaction.query.join(CitizenProfile).filter(
            CitizenProfile.government_id == government_id
        )
        if start_date:
            points_query = points_query.filter(PointTransaction.created_at >= start_date)
        
        total_points_awarded = db.session.query(
            func.sum(PointTransaction.points)
        ).join(CitizenProfile).filter(
            CitizenProfile.government_id == government_id,
            PointTransaction.points > 0
        )
        if start_date:
            total_points_awarded = total_points_awarded.filter(PointTransaction.created_at >= start_date)
        total_points_awarded = total_points_awarded.scalar() or 0
        
        # Badges statistics
        badges_unlocked_query = CitizenBadge.query.join(CitizenProfile).filter(
            CitizenProfile.government_id == government_id
        )
        if start_date:
            badges_unlocked_query = badges_unlocked_query.filter(CitizenBadge.earned_at >= start_date)
        badges_unlocked = badges_unlocked_query.count()
        
        unique_badge_earners = db.session.query(
            func.count(func.distinct(CitizenBadge.citizen_profile_id))
        ).join(CitizenProfile).filter(
            CitizenProfile.government_id == government_id
        )
        if start_date:
            unique_badge_earners = unique_badge_earners.filter(CitizenBadge.earned_at >= start_date)
        unique_badge_earners = unique_badge_earners.scalar() or 0
        
        # Rewards statistics
        rewards_redeemed_query = CitizenReward.query.join(CitizenProfile).filter(
            CitizenProfile.government_id == government_id
        )
        if start_date:
            rewards_redeemed_query = rewards_redeemed_query.filter(CitizenReward.redeemed_at >= start_date)
        rewards_redeemed = rewards_redeemed_query.count()
        
        points_spent = db.session.query(
            func.sum(CitizenReward.points_cost)
        ).join(CitizenProfile).filter(
            CitizenProfile.government_id == government_id
        )
        if start_date:
            points_spent = points_spent.filter(CitizenReward.redeemed_at >= start_date)
        points_spent = points_spent.scalar() or 0
        
        # Early payment statistics
        early_discounts_query = EarlyPaymentDiscount.query.join(Ticket).filter(
            Ticket.government_id == government_id
        )
        if start_date:
            early_discounts_query = early_discounts_query.filter(EarlyPaymentDiscount.applied_at >= start_date)
        
        total_discounts_given = db.session.query(
            func.sum(EarlyPaymentDiscount.discount_amount)
        ).join(Ticket).filter(
            Ticket.government_id == government_id
        )
        if start_date:
            total_discounts_given = total_discounts_given.filter(EarlyPaymentDiscount.applied_at >= start_date)
        total_discounts_given = float(total_discounts_given.scalar() or 0)
        
        early_payments = early_discounts_query.count()
        
        # Average driving score
        avg_driving_score = db.session.query(
            func.avg(CitizenProfile.driving_score)
        ).filter(
            CitizenProfile.government_id == government_id,
            CitizenProfile.driving_score > 0
        ).scalar() or 750
        
        # Average clean streak
        avg_clean_streak = db.session.query(
            func.avg(CitizenProfile.clean_driving_streak_days)
        ).filter(
            CitizenProfile.government_id == government_id
        ).scalar() or 0
        
        # Engagement rate (citizens with activity)
        active_citizens = db.session.query(
            func.count(func.distinct(CitizenProfile.id))
        ).filter(
            CitizenProfile.government_id == government_id,
            CitizenProfile.total_points > 0
        ).scalar() or 0
        
        engagement_rate = (active_citizens / total_citizens * 100) if total_citizens > 0 else 0
        
        # Top performers
        top_points_earners = db.session.query(
            CitizenProfile
        ).filter(
            CitizenProfile.government_id == government_id
        ).order_by(desc(CitizenProfile.total_points)).limit(5).all()
        
        top_driving_scores = db.session.query(
            CitizenProfile
        ).filter(
            CitizenProfile.government_id == government_id,
            CitizenProfile.driving_score > 0
        ).order_by(desc(CitizenProfile.driving_score)).limit(5).all()
        
        top_clean_streaks = db.session.query(
            CitizenProfile
        ).filter(
            CitizenProfile.government_id == government_id
        ).order_by(desc(CitizenProfile.clean_driving_streak_days)).limit(5).all()
        
        # Badge statistics
        badge_stats = db.session.query(
            Badge,
            func.count(CitizenBadge.id).label('unlock_count'),
            func.count(func.distinct(CitizenBadge.citizen_profile_id)).label('unique_earners')
        ).outerjoin(CitizenBadge).filter(
            Badge.government_id == government_id,
            Badge.is_active == True
        ).group_by(Badge.id).all()
        
        # Reward statistics
        reward_stats = db.session.query(
            Reward,
            func.count(CitizenReward.id).label('redemption_count'),
            func.sum(CitizenReward.points_cost).label('total_points_spent')
        ).outerjoin(CitizenReward).filter(
            Reward.government_id == government_id,
            Reward.is_active == True
        ).group_by(Reward.id).all()
        
        # Leaderboard participants
        leaderboard_participants = db.session.query(
            func.count(CitizenProfile.id)
        ).filter(
            CitizenProfile.government_id == government_id,
            CitizenProfile.opted_in_leaderboard == True
        ).scalar() or 0
        
        # Total points in circulation
        total_points_in_circulation = db.session.query(
            func.sum(CitizenProfile.total_points)
        ).filter(
            CitizenProfile.government_id == government_id
        ).scalar() or 0
        
        # Calculate averages
        avg_points_per_citizen = (total_points_in_circulation / total_citizens) if total_citizens > 0 else 0
        
        total_badges_unlocked = db.session.query(
            func.count(CitizenBadge.id)
        ).join(CitizenProfile).filter(
            CitizenProfile.government_id == government_id
        ).scalar() or 0
        
        avg_badges_per_citizen = (total_badges_unlocked / total_citizens) if total_citizens > 0 else 0
        
        # Estimate revenue impact (simplified calculation)
        revenue_increase = total_discounts_given * 2  # Assume 2x return on discounts
        net_revenue_impact = revenue_increase - total_discounts_given
        roi_percentage = ((revenue_increase - total_discounts_given) / total_discounts_given * 100) if total_discounts_given > 0 else 0
        
        return jsonify({
            'total_citizens': total_citizens,
            'new_citizens': new_citizens,
            'total_points_awarded': int(total_points_awarded),
            'badges_unlocked': badges_unlocked,
            'unique_badge_earners': unique_badge_earners,
            'rewards_redeemed': rewards_redeemed,
            'points_spent': int(points_spent),
            'total_discounts_given': total_discounts_given,
            'early_payments': early_payments,
            'avg_driving_score': int(avg_driving_score),
            'avg_clean_streak': int(avg_clean_streak),
            'engagement_rate': round(engagement_rate, 1),
            'active_users': active_citizens,
            'leaderboard_participants': leaderboard_participants,
            'total_points_in_circulation': int(total_points_in_circulation),
            'avg_points_per_citizen': int(avg_points_per_citizen),
            'total_badges_unlocked': total_badges_unlocked,
            'avg_badges_per_citizen': round(avg_badges_per_citizen, 1),
            'revenue_increase': revenue_increase,
            'net_revenue_impact': net_revenue_impact,
            'roi_percentage': round(roi_percentage, 1),
            'top_points_earners': [
                {
                    'name': f"Citizen {p.id}",
                    'points': p.total_points
                } for p in top_points_earners
            ],
            'top_driving_scores': [
                {
                    'name': f"Citizen {p.id}",
                    'score': p.driving_score
                } for p in top_driving_scores
            ],
            'top_clean_streaks': [
                {
                    'name': f"Citizen {p.id}",
                    'streak': p.clean_driving_streak_days
                } for p in top_clean_streaks
            ],
            'badge_stats': [
                {
                    'name': badge.name,
                    'icon_emoji': badge.icon_emoji,
                    'unlock_count': unlock_count,
                    'unique_earners': unique_earners
                } for badge, unlock_count, unique_earners in badge_stats
            ],
            'reward_stats': [
                {
                    'name': reward.name,
                    'icon_emoji': reward.icon_emoji,
                    'redemption_count': redemption_count or 0,
                    'total_points_spent': int(total_points_spent or 0),
                    'total_available': reward.quantity_available,
                    'remaining': reward.quantity_available - (redemption_count or 0) if reward.quantity_available else None
                } for reward, redemption_count, total_points_spent in reward_stats
            ]
        }), 200
        
    except Exception as e:
        print(f"Error in analytics overview: {str(e)}")
        return jsonify({'error': f'Failed to fetch analytics: {str(e)}'}), 500


# ============================================================================
# BADGE MANAGEMENT ENDPOINTS
# ============================================================================

@admin_gamification_bp.route('/badges', methods=['GET'])
@permission_required(Permission.VIEW_DASHBOARD)
def get_badges(current_user):
    """Get all badges for admin management"""
    try:
        badges = Badge.query.filter_by(government_id=current_user.government_id).order_by(
            Badge.display_order, Badge.tier, Badge.name
        ).all()
        
        return jsonify({
            'badges': [b.to_dict() for b in badges],
            'total': len(badges)
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch badges: {str(e)}'}), 500


@admin_gamification_bp.route('/badges', methods=['POST'])
@permission_required(Permission.MANAGE_SETTINGS)
def create_badge(current_user):
    """Create a new badge"""
    try:
        data = request.get_json()
        
        badge = Badge(
            government_id=current_user.government_id,
            name=data['name'],
            description=data.get('description'),
            icon_emoji=data.get('icon_emoji', '🏆'),
            tier=data.get('tier', 'bronze'),
            requirement_type=data['requirement_type'],
            requirement_value=data['requirement_value'],
            points_reward=data.get('points_reward', 0),
            is_active=data.get('is_active', True),
            display_order=data.get('display_order', 0)
        )
        
        db.session.add(badge)
        db.session.commit()
        
        return jsonify({
            'message': 'Badge created successfully',
            'badge': badge.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create badge: {str(e)}'}), 500


@admin_gamification_bp.route('/badges/<int:badge_id>', methods=['PUT'])
@permission_required(Permission.MANAGE_SETTINGS)
def update_badge(badge_id, current_user):
    """Update a badge"""
    try:
        badge = Badge.query.get(badge_id)
        if not badge:
            return jsonify({'error': 'Badge not found'}), 404
        
        data = request.get_json()
        
        for key in ['name', 'description', 'icon_emoji', 'tier', 'requirement_type', 
                    'requirement_value', 'points_reward', 'is_active', 'display_order']:
            if key in data:
                setattr(badge, key, data[key])
        
        badge.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Badge updated successfully',
            'badge': badge.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update badge: {str(e)}'}), 500


@admin_gamification_bp.route('/badges/<int:badge_id>', methods=['DELETE'])
@permission_required(Permission.MANAGE_SETTINGS)
def delete_badge(badge_id, current_user):
    """Delete a badge"""
    try:
        badge = Badge.query.get(badge_id)
        if not badge:
            return jsonify({'error': 'Badge not found'}), 404
        
        db.session.delete(badge)
        db.session.commit()
        
        return jsonify({'message': 'Badge deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete badge: {str(e)}'}), 500


# ============================================================================
# REWARD MANAGEMENT ENDPOINTS
# ============================================================================

@admin_gamification_bp.route('/rewards', methods=['GET'])
@permission_required(Permission.VIEW_DASHBOARD)
def get_rewards(current_user):
    """Get all rewards for admin management"""
    try:
        rewards = Reward.query.filter_by(government_id=current_user.government_id).order_by(
            Reward.is_featured.desc(), Reward.display_order, Reward.name
        ).all()
        
        return jsonify({
            'rewards': [r.to_dict() for r in rewards],
            'total': len(rewards)
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch rewards: {str(e)}'}), 500


@admin_gamification_bp.route('/rewards', methods=['POST'])
@permission_required(Permission.MANAGE_SETTINGS)
def create_reward(current_user):
    """Create a new reward"""
    try:
        data = request.get_json()
        
        reward = Reward(
            government_id=current_user.government_id,
            name=data['name'],
            description=data.get('description'),
            icon_emoji=data.get('icon_emoji', '🎁'),
            reward_type=data.get('reward_type', 'discount'),
            points_cost=data['points_cost'],
            value=Decimal(str(data.get('value', 0))),
            quantity_available=data.get('quantity_available'),
            is_active=data.get('is_active', True),
            is_featured=data.get('is_featured', False),
            display_order=data.get('display_order', 0)
        )
        
        db.session.add(reward)
        db.session.commit()
        
        return jsonify({
            'message': 'Reward created successfully',
            'reward': reward.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create reward: {str(e)}'}), 500


@admin_gamification_bp.route('/rewards/<int:reward_id>', methods=['PUT'])
@permission_required(Permission.MANAGE_SETTINGS)
def update_reward(reward_id, current_user):
    """Update a reward"""
    try:
        reward = Reward.query.get(reward_id)
        if not reward:
            return jsonify({'error': 'Reward not found'}), 404
        
        data = request.get_json()
        
        for key in ['name', 'description', 'icon_emoji', 'reward_type', 'points_cost', 
                    'quantity_available', 'is_active', 'is_featured', 'display_order']:
            if key in data:
                if key == 'value':
                    setattr(reward, key, Decimal(str(data[key])))
                else:
                    setattr(reward, key, data[key])
        
        reward.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Reward updated successfully',
            'reward': reward.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update reward: {str(e)}'}), 500


@admin_gamification_bp.route('/rewards/<int:reward_id>', methods=['DELETE'])
@permission_required(Permission.MANAGE_SETTINGS)
def delete_reward(reward_id, current_user):
    """Delete a reward"""
    try:
        reward = Reward.query.get(reward_id)
        if not reward:
            return jsonify({'error': 'Reward not found'}), 404
        
        db.session.delete(reward)
        db.session.commit()
        
        return jsonify({'message': 'Reward deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete reward: {str(e)}'}), 500


# ============================================================================
# LEADERBOARD MANAGEMENT ENDPOINTS
# ============================================================================

@admin_gamification_bp.route('/leaderboards', methods=['GET'])
@permission_required(Permission.VIEW_DASHBOARD)
def get_leaderboards(current_user):
    """Get all leaderboards for admin management"""
    try:
        leaderboards = Leaderboard.query.filter_by(government_id=current_user.government_id).all()
        
        return jsonify({
            'leaderboards': [lb.to_dict() for lb in leaderboards],
            'total': len(leaderboards)
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch leaderboards: {str(e)}'}), 500


# ============================================================================
# CITIZEN PROFILES ENDPOINTS
# ============================================================================

@admin_gamification_bp.route('/citizens', methods=['GET'])
@permission_required(Permission.VIEW_DASHBOARD)
def get_citizen_profiles(current_user):
    """Get all citizen profiles for admin view"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        
        profiles = CitizenProfile.query.filter_by(
            government_id=current_user.government_id
        ).order_by(desc(CitizenProfile.total_points)).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'citizens': [p.to_dict() for p in profiles.items],
            'total': profiles.total,
            'page': page,
            'per_page': per_page,
            'pages': profiles.pages
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch citizen profiles: {str(e)}'}), 500


@admin_gamification_bp.route('/citizens/<int:profile_id>', methods=['GET'])
@permission_required(Permission.VIEW_DASHBOARD)
def get_citizen_profile_detail(profile_id, current_user):
    """Get detailed citizen profile"""
    try:
        profile = CitizenProfile.query.get(profile_id)
        if not profile:
            return jsonify({'error': 'Profile not found'}), 404
        
        # Get recent transactions
        transactions = PointTransaction.query.filter_by(
            citizen_profile_id=profile_id
        ).order_by(desc(PointTransaction.created_at)).limit(20).all()
        
        # Get badges
        badges = CitizenBadge.query.filter_by(
            citizen_profile_id=profile_id
        ).order_by(desc(CitizenBadge.earned_at)).all()
        
        # Get rewards
        rewards = CitizenReward.query.filter_by(
            citizen_profile_id=profile_id
        ).order_by(desc(CitizenReward.redeemed_at)).all()
        
        return jsonify({
            'profile': profile.to_dict(),
            'transactions': [t.to_dict() for t in transactions],
            'badges': [b.to_dict() for b in badges],
            'rewards': [r.to_dict() for r in rewards]
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch profile details: {str(e)}'}), 500


# ============================================================================
# GAMIFICATION CONFIG ENDPOINTS
# ============================================================================

@admin_gamification_bp.route('/config', methods=['GET'])
@permission_required(Permission.VIEW_DASHBOARD)
def get_gamification_config(current_user):
    """
    Get gamification configuration for the current government
    Returns the gamification_enabled status from Government model
    """
    try:
        government = Government.query.get(current_user.government_id)
        
        if not government:
            return jsonify({'error': 'Government not found'}), 404
        
        return jsonify({
            'gamification_enabled': government.gamification_enabled
        }), 200
        
    except Exception as e:
        print(f"Error fetching gamification config: {str(e)}")
        return jsonify({'error': f'Failed to fetch gamification config: {str(e)}'}), 500


@admin_gamification_bp.route('/config', methods=['PUT'])
@permission_required(Permission.MANAGE_SETTINGS)
def update_gamification_config(current_user):
    """
    Update gamification configuration for the current government
    Request body:
    {
        "gamification_enabled": true
    }
    """
    try:
        data = request.get_json()
        
        if data is None or 'gamification_enabled' not in data:
            return jsonify({'error': 'gamification_enabled field is required'}), 400
        
        government = Government.query.get(current_user.government_id)
        
        if not government:
            return jsonify({'error': 'Government not found'}), 404
        
        old_status = government.gamification_enabled
        new_status = data['gamification_enabled']
        
        government.gamification_enabled = new_status
        government.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Gamification configuration updated successfully',
            'gamification_enabled': government.gamification_enabled,
            'previous_status': 'enabled' if old_status else 'disabled',
            'new_status': 'enabled' if new_status else 'disabled'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating gamification config: {str(e)}")
        return jsonify({'error': f'Failed to update gamification config: {str(e)}'}), 500
