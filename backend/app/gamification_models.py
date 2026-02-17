"""
Gamification Models for PayFine Platform
Add these models to the main models.py file

GAMIFICATION SYSTEM:
- CitizenProfile: Tracks citizen stats, points, driving score
- Badge: Achievement definitions
- CitizenBadge: Earned badges per citizen
- Reward: Redeemable rewards catalog
- CitizenReward: Redeemed rewards per citizen
- PointTransaction: Points transaction history
- Leaderboard: Leaderboard definitions
- LeaderboardEntry: Rankings per leaderboard
- EarlyPaymentDiscount: Early payment discount configurations
"""

from . import db
from datetime import datetime, timedelta
from decimal import Decimal
import json
import hashlib
import secrets


# ============================================================================
# GAMIFICATION MODELS
# ============================================================================

class CitizenProfile(db.Model):
    """
    Citizen Profile - Gamification stats and progress tracking
    
    Privacy-preserving: Uses hashed IDs, not actual National IDs
    Multi-tenant: Scoped by government_id
    """
    __tablename__ = 'citizen_profiles'
    
    id = db.Column(db.Integer, primary_key=True)
    government_id = db.Column(db.String(36), db.ForeignKey('governments.id'), nullable=False, index=True)
    
    # Citizen Identification (Privacy-Preserving)
    national_id_hash = db.Column(db.String(255), unique=True, nullable=False, index=True)
    driver_license_hash = db.Column(db.String(255), index=True)
    email = db.Column(db.String(120))
    phone = db.Column(db.String(20))
    full_name = db.Column(db.String(200))
    
    # Gamification Stats
    total_points = db.Column(db.Integer, default=0)
    current_level = db.Column(db.Integer, default=1)
    driving_score = db.Column(db.Integer, default=750)  # Out of 1000
    
    # Streaks
    clean_driving_streak_days = db.Column(db.Integer, default=0)
    on_time_payment_streak = db.Column(db.Integer, default=0)
    last_violation_date = db.Column(db.DateTime)
    last_payment_date = db.Column(db.DateTime)
    
    # Lifetime Stats
    total_tickets_received = db.Column(db.Integer, default=0)
    total_tickets_paid = db.Column(db.Integer, default=0)
    total_violations_avoided = db.Column(db.Integer, default=0)
    total_amount_paid = db.Column(db.Numeric(12, 2), default=0)
    total_discounts_earned = db.Column(db.Numeric(12, 2), default=0)
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    opted_in_gamification = db.Column(db.Boolean, default=True)
    opted_in_leaderboard = db.Column(db.Boolean, default=False)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_activity_at = db.Column(db.DateTime)
    
    # Relationships
    badges = db.relationship('CitizenBadge', backref='citizen', lazy=True, cascade='all, delete-orphan')
    rewards = db.relationship('CitizenReward', backref='citizen', lazy=True, cascade='all, delete-orphan')
    point_transactions = db.relationship('PointTransaction', backref='citizen', lazy=True, cascade='all, delete-orphan')
    
    @staticmethod
    def hash_identifier(identifier):
        """Hash an identifier (National ID, Driver License) for privacy"""
        if not identifier:
            return None
        return hashlib.sha256(identifier.encode()).hexdigest()
    
    def calculate_driving_score(self):
        """
        Calculate driving score (0-1000) based on:
        - Violation frequency
        - Payment history
        - Clean driving streaks
        - Offence severity
        """
        base_score = 750
        
        # Deduct for violations
        if self.total_tickets_received > 0:
            violation_penalty = min(self.total_tickets_received * 10, 200)
            base_score -= violation_penalty
        
        # Add for clean streak
        if self.clean_driving_streak_days > 0:
            streak_bonus = min(self.clean_driving_streak_days // 30 * 25, 150)
            base_score += streak_bonus
        
        # Add for payment compliance
        if self.total_tickets_received > 0:
            payment_rate = self.total_tickets_paid / self.total_tickets_received
            if payment_rate >= 0.9:
                base_score += 100
            elif payment_rate >= 0.7:
                base_score += 50
        
        # Ensure within bounds
        self.driving_score = max(0, min(1000, base_score))
        return self.driving_score
    
    def award_points(self, points, source_type, source_id=None, description=None):
        """Award points to citizen and create transaction record"""
        if points == 0:
            return
        
        balance_before = self.total_points
        self.total_points += points
        balance_after = self.total_points
        
        # Create transaction record
        transaction = PointTransaction(
            citizen_profile_id=self.id,
            transaction_type='earned' if points > 0 else 'spent',
            points_amount=points,
            source_type=source_type,
            source_id=source_id,
            description=description,
            balance_before=balance_before,
            balance_after=balance_after
        )
        db.session.add(transaction)
        
        # Update level based on points
        self.current_level = (self.total_points // 1000) + 1
        
        self.last_activity_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
    
    def check_and_award_badges(self):
        """Check if citizen earned any new badges"""
        from .gamification import GamificationService
        return GamificationService.check_badge_eligibility(self)
    
    def update_streaks(self):
        """Update clean driving and payment streaks"""
        now = datetime.utcnow()
        
        # Update clean driving streak
        if self.last_violation_date:
            days_since_violation = (now - self.last_violation_date).days
            self.clean_driving_streak_days = days_since_violation
        else:
            # No violations ever - calculate from creation
            days_since_creation = (now - self.created_at).days
            self.clean_driving_streak_days = days_since_creation
        
        self.updated_at = datetime.utcnow()
    
    def to_dict(self, include_sensitive=False):
        """Convert to dictionary"""
        data = {
            'id': self.id,
            'total_points': self.total_points,
            'current_level': self.current_level,
            'driving_score': self.driving_score,
            'clean_driving_streak_days': self.clean_driving_streak_days,
            'on_time_payment_streak': self.on_time_payment_streak,
            'total_tickets_received': self.total_tickets_received,
            'total_tickets_paid': self.total_tickets_paid,
            'total_amount_paid': float(self.total_amount_paid),
            'total_discounts_earned': float(self.total_discounts_earned),
            'opted_in_gamification': self.opted_in_gamification,
            'opted_in_leaderboard': self.opted_in_leaderboard,
            'created_at': self.created_at.isoformat(),
            'last_activity_at': self.last_activity_at.isoformat() if self.last_activity_at else None
        }
        
        if include_sensitive:
            data.update({
                'email': self.email,
                'phone': self.phone,
                'full_name': self.full_name,
                'national_id_hash': self.national_id_hash,
                'driver_license_hash': self.driver_license_hash
            })
        
        return data
    
    def __repr__(self):
        return f'<CitizenProfile {self.id}: {self.driving_score}/1000, {self.total_points} pts>'


class Badge(db.Model):
    """Badge - Achievement definitions"""
    __tablename__ = 'badges'
    
    id = db.Column(db.Integer, primary_key=True)
    government_id = db.Column(db.String(36), db.ForeignKey('governments.id'), nullable=False, index=True)
    
    # Badge Details
    code = db.Column(db.String(50), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    icon_emoji = db.Column(db.String(10))
    icon_url = db.Column(db.String(255))
    
    # Badge Type
    category = db.Column(db.String(50))  # 'payment', 'driving', 'streak', 'milestone', 'special'
    tier = db.Column(db.String(20))  # 'bronze', 'silver', 'gold', 'platinum', 'diamond'
    
    # Requirements
    requirement_type = db.Column(db.String(50))  # 'tickets_paid', 'clean_days', 'early_payments', etc.
    requirement_value = db.Column(db.Integer)
    requirement_config = db.Column(db.Text)  # JSON for complex requirements
    
    # Rewards
    points_reward = db.Column(db.Integer, default=0)
    discount_percentage = db.Column(db.Numeric(5, 2), default=0)
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    is_hidden = db.Column(db.Boolean, default=False)
    display_order = db.Column(db.Integer, default=0)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def check_eligibility(self, citizen_profile):
        """Check if citizen is eligible for this badge"""
        if self.requirement_type == 'tickets_paid':
            return citizen_profile.total_tickets_paid >= self.requirement_value
        elif self.requirement_type == 'clean_days':
            return citizen_profile.clean_driving_streak_days >= self.requirement_value
        elif self.requirement_type == 'points_earned':
            return citizen_profile.total_points >= self.requirement_value
        elif self.requirement_type == 'driving_score':
            return citizen_profile.driving_score >= self.requirement_value
        elif self.requirement_type == 'on_time_streak':
            return citizen_profile.on_time_payment_streak >= self.requirement_value
        
        return False
    
    def get_requirement_config(self):
        """Parse requirement config JSON"""
        if not self.requirement_config:
            return {}
        try:
            return json.loads(self.requirement_config)
        except:
            return {}
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'description': self.description,
            'icon_emoji': self.icon_emoji,
            'icon_url': self.icon_url,
            'category': self.category,
            'tier': self.tier,
            'requirement_type': self.requirement_type,
            'requirement_value': self.requirement_value,
            'requirement_config': self.get_requirement_config(),
            'points_reward': self.points_reward,
            'discount_percentage': float(self.discount_percentage) if self.discount_percentage else 0,
            'is_active': self.is_active,
            'is_hidden': self.is_hidden,
            'display_order': self.display_order
        }
    
    def __repr__(self):
        return f'<Badge {self.code}: {self.name} ({self.tier})>'


class CitizenBadge(db.Model):
    """Citizen Badge - Earned badges per citizen"""
    __tablename__ = 'citizen_badges'
    
    id = db.Column(db.Integer, primary_key=True)
    citizen_profile_id = db.Column(db.Integer, db.ForeignKey('citizen_profiles.id'), nullable=False)
    badge_id = db.Column(db.Integer, db.ForeignKey('badges.id'), nullable=False)
    
    # Achievement Details
    earned_at = db.Column(db.DateTime, default=datetime.utcnow)
    progress_percentage = db.Column(db.Integer, default=100)
    
    # Display
    is_displayed = db.Column(db.Boolean, default=True)
    is_favorite = db.Column(db.Boolean, default=False)
    
    # Metadata
    earned_from_ticket_id = db.Column(db.Integer, db.ForeignKey('tickets.id'))
    earned_from_action = db.Column(db.String(100))
    
    # Relationships
    badge = db.relationship('Badge')
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'badge': self.badge.to_dict() if self.badge else None,
            'earned_at': self.earned_at.isoformat(),
            'progress_percentage': self.progress_percentage,
            'is_displayed': self.is_displayed,
            'is_favorite': self.is_favorite,
            'earned_from_action': self.earned_from_action
        }
    
    def __repr__(self):
        return f'<CitizenBadge {self.citizen_profile_id}: {self.badge.code if self.badge else "?"}>'


class Reward(db.Model):
    """Reward - Redeemable rewards catalog"""
    __tablename__ = 'rewards'
    
    id = db.Column(db.Integer, primary_key=True)
    government_id = db.Column(db.String(36), db.ForeignKey('governments.id'), nullable=False, index=True)
    
    # Reward Details
    code = db.Column(db.String(50), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    icon_emoji = db.Column(db.String(10))
    
    # Reward Type
    reward_type = db.Column(db.String(50))  # 'discount', 'service_waiver', 'parking_voucher', 'priority_service'
    reward_value = db.Column(db.Numeric(10, 2))
    
    # Cost
    points_cost = db.Column(db.Integer, nullable=False)
    
    # Availability
    total_available = db.Column(db.Integer)  # NULL = unlimited
    total_redeemed = db.Column(db.Integer, default=0)
    max_per_citizen = db.Column(db.Integer, default=1)
    
    # Validity
    valid_from = db.Column(db.Date)
    valid_to = db.Column(db.Date)
    validity_days = db.Column(db.Integer)  # Days valid after redemption
    
    # Terms
    terms_and_conditions = db.Column(db.Text)
    redemption_instructions = db.Column(db.Text)
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    is_featured = db.Column(db.Boolean, default=False)
    display_order = db.Column(db.Integer, default=0)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def can_redeem(self, citizen_profile):
        """Check if citizen can redeem this reward"""
        # Check points
        if citizen_profile.total_points < self.points_cost:
            return False, "Insufficient points"
        
        # Check availability
        if self.total_available is not None and self.total_redeemed >= self.total_available:
            return False, "Reward no longer available"
        
        # Check max per citizen
        citizen_redemptions = CitizenReward.query.filter_by(
            citizen_profile_id=citizen_profile.id,
            reward_id=self.id
        ).count()
        
        if citizen_redemptions >= self.max_per_citizen:
            return False, f"Maximum {self.max_per_citizen} redemption(s) per citizen"
        
        # Check validity dates
        today = datetime.utcnow().date()
        if self.valid_from and today < self.valid_from:
            return False, "Reward not yet available"
        if self.valid_to and today > self.valid_to:
            return False, "Reward expired"
        
        return True, "OK"
    
    def generate_redemption_code(self):
        """Generate unique redemption code"""
        return f"{self.code}-{secrets.token_hex(4).upper()}"
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'description': self.description,
            'icon_emoji': self.icon_emoji,
            'reward_type': self.reward_type,
            'reward_value': float(self.reward_value) if self.reward_value else None,
            'points_cost': self.points_cost,
            'total_available': self.total_available,
            'total_redeemed': self.total_redeemed,
            'remaining': (self.total_available - self.total_redeemed) if self.total_available else None,
            'max_per_citizen': self.max_per_citizen,
            'valid_from': self.valid_from.isoformat() if self.valid_from else None,
            'valid_to': self.valid_to.isoformat() if self.valid_to else None,
            'validity_days': self.validity_days,
            'terms_and_conditions': self.terms_and_conditions,
            'redemption_instructions': self.redemption_instructions,
            'is_active': self.is_active,
            'is_featured': self.is_featured
        }
    
    def __repr__(self):
        return f'<Reward {self.code}: {self.name} ({self.points_cost} pts)>'


class CitizenReward(db.Model):
    """Citizen Reward - Redeemed rewards per citizen"""
    __tablename__ = 'citizen_rewards'
    
    id = db.Column(db.Integer, primary_key=True)
    citizen_profile_id = db.Column(db.Integer, db.ForeignKey('citizen_profiles.id'), nullable=False)
    reward_id = db.Column(db.Integer, db.ForeignKey('rewards.id'), nullable=False)
    
    # Redemption Details
    redeemed_at = db.Column(db.DateTime, default=datetime.utcnow)
    points_spent = db.Column(db.Integer, nullable=False)
    
    # Voucher/Code
    redemption_code = db.Column(db.String(50), unique=True)
    
    # Usage
    used_at = db.Column(db.DateTime)
    used_for_ticket_id = db.Column(db.Integer, db.ForeignKey('tickets.id'))
    used_for_service = db.Column(db.String(100))
    
    # Validity
    expires_at = db.Column(db.DateTime)
    is_expired = db.Column(db.Boolean, default=False)
    is_used = db.Column(db.Boolean, default=False)
    
    # Metadata
    discount_amount = db.Column(db.Numeric(10, 2))
    
    # Relationships
    reward = db.relationship('Reward')
    
    def is_valid(self):
        """Check if reward is still valid"""
        if self.is_used:
            return False
        if self.is_expired:
            return False
        if self.expires_at and datetime.utcnow() > self.expires_at:
            self.is_expired = True
            return False
        return True
    
    def mark_as_used(self, ticket_id=None, service=None, discount_amount=None):
        """Mark reward as used"""
        self.is_used = True
        self.used_at = datetime.utcnow()
        self.used_for_ticket_id = ticket_id
        self.used_for_service = service
        self.discount_amount = discount_amount
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'reward': self.reward.to_dict() if self.reward else None,
            'redeemed_at': self.redeemed_at.isoformat(),
            'points_spent': self.points_spent,
            'redemption_code': self.redemption_code,
            'used_at': self.used_at.isoformat() if self.used_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'is_expired': self.is_expired,
            'is_used': self.is_used,
            'is_valid': self.is_valid(),
            'discount_amount': float(self.discount_amount) if self.discount_amount else None
        }
    
    def __repr__(self):
        return f'<CitizenReward {self.redemption_code}: {"Used" if self.is_used else "Valid"}>'


class PointTransaction(db.Model):
    """Point Transaction - Points transaction history"""
    __tablename__ = 'point_transactions'
    
    id = db.Column(db.Integer, primary_key=True)
    citizen_profile_id = db.Column(db.Integer, db.ForeignKey('citizen_profiles.id'), nullable=False)
    
    # Transaction Details
    transaction_type = db.Column(db.String(50), nullable=False)  # 'earned', 'spent', 'expired', 'adjusted'
    points_amount = db.Column(db.Integer, nullable=False)
    
    # Source
    source_type = db.Column(db.String(50))  # 'early_payment', 'badge_earned', 'reward_redeemed', etc.
    source_id = db.Column(db.Integer)
    
    # Description
    description = db.Column(db.Text)
    
    # Balance
    balance_before = db.Column(db.Integer)
    balance_after = db.Column(db.Integer)
    
    # Metadata
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'transaction_type': self.transaction_type,
            'points_amount': self.points_amount,
            'source_type': self.source_type,
            'source_id': self.source_id,
            'description': self.description,
            'balance_before': self.balance_before,
            'balance_after': self.balance_after,
            'created_at': self.created_at.isoformat()
        }
    
    def __repr__(self):
        sign = '+' if self.points_amount > 0 else ''
        return f'<PointTransaction {sign}{self.points_amount} pts: {self.source_type}>'


class Leaderboard(db.Model):
    """Leaderboard - Leaderboard definitions"""
    __tablename__ = 'leaderboards'
    
    id = db.Column(db.Integer, primary_key=True)
    government_id = db.Column(db.String(36), db.ForeignKey('governments.id'), nullable=False, index=True)
    
    # Leaderboard Details
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    leaderboard_type = db.Column(db.String(50))  # 'points', 'driving_score', 'clean_streak', 'early_payments'
    
    # Time Period
    period_type = db.Column(db.String(20))  # 'all_time', 'yearly', 'monthly', 'weekly'
    period_start = db.Column(db.Date)
    period_end = db.Column(db.Date)
    
    # Display
    max_display_rank = db.Column(db.Integer, default=100)
    is_public = db.Column(db.Boolean, default=True)
    
    # Prizes/Recognition
    has_prizes = db.Column(db.Boolean, default=False)
    prize_config = db.Column(db.Text)  # JSON
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_calculated_at = db.Column(db.DateTime)
    
    # Relationships
    entries = db.relationship('LeaderboardEntry', backref='leaderboard', lazy=True, cascade='all, delete-orphan')
    
    def calculate_rankings(self):
        """Calculate and update leaderboard rankings"""
        from .gamification import GamificationService
        return GamificationService.update_leaderboard(self)
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'leaderboard_type': self.leaderboard_type,
            'period_type': self.period_type,
            'period_start': self.period_start.isoformat() if self.period_start else None,
            'period_end': self.period_end.isoformat() if self.period_end else None,
            'max_display_rank': self.max_display_rank,
            'is_public': self.is_public,
            'has_prizes': self.has_prizes,
            'is_active': self.is_active,
            'last_calculated_at': self.last_calculated_at.isoformat() if self.last_calculated_at else None
        }
    
    def __repr__(self):
        return f'<Leaderboard {self.name} ({self.leaderboard_type})>'


class LeaderboardEntry(db.Model):
    """Leaderboard Entry - Rankings per leaderboard"""
    __tablename__ = 'leaderboard_entries'
    
    id = db.Column(db.Integer, primary_key=True)
    leaderboard_id = db.Column(db.Integer, db.ForeignKey('leaderboards.id'), nullable=False)
    citizen_profile_id = db.Column(db.Integer, db.ForeignKey('citizen_profiles.id'), nullable=False)
    
    # Ranking
    rank = db.Column(db.Integer, nullable=False)
    score = db.Column(db.Numeric(12, 2), nullable=False)
    
    # Display Name (Privacy)
    display_name = db.Column(db.String(100))
    
    # Change Tracking
    previous_rank = db.Column(db.Integer)
    rank_change = db.Column(db.Integer)  # Positive = moved up
    
    # Timestamps
    calculated_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    citizen = db.relationship('CitizenProfile')
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'rank': self.rank,
            'score': float(self.score),
            'display_name': self.display_name or f"Citizen #{self.citizen_profile_id}",
            'previous_rank': self.previous_rank,
            'rank_change': self.rank_change,
            'calculated_at': self.calculated_at.isoformat()
        }
    
    def __repr__(self):
        return f'<LeaderboardEntry #{self.rank}: {self.display_name} ({self.score})>'


class EarlyPaymentDiscount(db.Model):
    """Early Payment Discount - Discount configurations"""
    __tablename__ = 'early_payment_discounts'
    
    id = db.Column(db.Integer, primary_key=True)
    government_id = db.Column(db.String(36), db.ForeignKey('governments.id'), nullable=False, index=True)
    
    # Discount Configuration
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    
    # Discount Tiers (Days-based)
    discount_type = db.Column(db.String(20))  # 'percentage', 'fixed_amount', 'tiered'
    discount_config = db.Column(db.Text)  # JSON with tier configuration
    
    # Applicability
    applies_to_offence_categories = db.Column(db.Text)  # JSON array
    applies_to_offences = db.Column(db.Text)  # JSON array
    min_fine_amount = db.Column(db.Numeric(10, 2))
    max_fine_amount = db.Column(db.Numeric(10, 2))
    
    # Points Bonus
    points_bonus_config = db.Column(db.Text)  # JSON
    
    # Effective Dates
    effective_from = db.Column(db.Date, nullable=False)
    effective_to = db.Column(db.Date)
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def get_discount_config(self):
        """Parse discount config JSON"""
        if not self.discount_config:
            return {}
        try:
            return json.loads(self.discount_config)
        except:
            return {}
    
    def get_points_bonus_config(self):
        """Parse points bonus config JSON"""
        if not self.points_bonus_config:
            return {}
        try:
            return json.loads(self.points_bonus_config)
        except:
            return {}
    
    def calculate_discount(self, ticket, payment_date=None):
        """Calculate discount for a ticket based on payment timing"""
        if not payment_date:
            payment_date = datetime.utcnow()
        
        days_early = (ticket.due_date - payment_date).days
        
        if days_early <= 0:
            return 0, 0  # No discount if not early
        
        config = self.get_discount_config()
        points_config = self.get_points_bonus_config()
        
        discount_amount = 0
        points_bonus = 0
        
        if self.discount_type == 'tiered' and 'tiers' in config:
            # Find applicable tier
            for tier in sorted(config['tiers'], key=lambda x: x['days']):
                if days_early <= tier['days']:
                    discount_amount = float(ticket.fine_amount) * (tier.get('discount_percentage', 0) / 100)
                    points_bonus = tier.get('points_bonus', 0)
                    break
        
        return discount_amount, points_bonus
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'discount_type': self.discount_type,
            'discount_config': self.get_discount_config(),
            'points_bonus_config': self.get_points_bonus_config(),
            'effective_from': self.effective_from.isoformat(),
            'effective_to': self.effective_to.isoformat() if self.effective_to else None,
            'is_active': self.is_active
        }
    
    def __repr__(self):
        return f'<EarlyPaymentDiscount {self.name}>'
