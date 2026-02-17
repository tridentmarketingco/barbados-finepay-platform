"""
Points Models - Merit/Demerit System for Barbados Traffic Application
Compliant with Road Traffic Act (Cap. 295) amendments 2025/2026

This module implements:
- PointsHistory: Complete transaction audit trail
- MeritBalance: Merit point tracking (optional positive incentives)
- DemeritBalance: Demerit point tracking with rolling 12-month window
- PointsThreshold: Configurable threshold settings per government
- SuspensionRecord: License suspension records
"""

from . import db
from datetime import datetime, timedelta, date
from sqlalchemy import and_, or_, Index
import uuid


# ============================================================================
# MERIT/DEMERIT POINT SYSTEM MODELS
# ============================================================================

class PointsHistory(db.Model):
    """
    Points History - Complete audit trail for all point transactions
    
    Tracks every addition, expiry, and adjustment of points for a citizen.
    This is the PRIMARY source of truth for point calculations.
    
    MULTI-TENANT: Scoped by government_id
    """
    __tablename__ = 'points_history'
    
    id = db.Column(db.Integer, primary_key=True)
    government_id = db.Column(db.String(36), db.ForeignKey('governments.id'), nullable=False, index=True)
    
    # Citizen reference (privacy-preserving via hash)
    citizen_profile_id = db.Column(db.Integer, db.ForeignKey('citizen_profiles.id'), nullable=False, index=True)
    
    # Transaction details
    transaction_type = db.Column(db.String(30), nullable=False)  # 'demerit_added', 'demerit_expired', 'merit_added', 'merit_expired', 'merit_earned', 'adjusted', 'offset'
    points_delta = db.Column(db.Integer, nullable=False)  # Positive or negative
    
    # Point type
    point_type = db.Column(db.String(20), nullable=False)  # 'merit' or 'demerit'
    
    # Source information
    source_type = db.Column(db.String(50), nullable=True)  # 'ticket', 'court_order', 'bla_sync', 'manual', 'auto_award', 'expiry'
    source_id = db.Column(db.String(100), nullable=True)  # External reference (ticket_id, court_case_id, etc.)
    
    # Violation details (for demerits)
    offence_id = db.Column(db.Integer, db.ForeignKey('offences.id'), nullable=True)
    offence_code = db.Column(db.String(50), nullable=True)
    offence_description = db.Column(db.Text, nullable=True)
    
    # Expiry tracking
    effective_date = db.Column(db.Date, nullable=False)
    expiry_date = db.Column(db.Date, nullable=True)  # For demerits: date + 365 days
    is_expired = db.Column(db.Boolean, default=False)
    expired_at = db.Column(db.DateTime, nullable=True)
    
    # Status
    status = db.Column(db.String(20), default='active')  # 'active', 'expired', 'voided', 'pending'
    
    # Balance tracking
    balance_after = db.Column(db.Integer, nullable=True)  # Running balance after transaction
    
    # Notes
    notes = db.Column(db.Text, nullable=True)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    citizen_profile = db.relationship('CitizenProfile', backref=db.backref('points_history', lazy=True))
    offence = db.relationship('Offence')
    created_by = db.relationship('User', foreign_keys=[created_by_id])
    
    # Indexes for efficient queries
    __table_args__ = (
        Index('ix_points_history_citizen_date', 'citizen_profile_id', 'effective_date'),
        Index('ix_points_history_type_status', 'point_type', 'status'),
        Index('ix_points_history_expiry', 'expiry_date', 'is_expired'),
    )
    
    def get_display_description(self):
        """Get human-readable description for this transaction"""
        descriptions = {
            'demerit_added': f"Demerit points added for {self.offence_code or 'violation'}",
            'demerit_expired': f"Demerit points expired (were added {self.get_days_since_added()} days ago)",
            'merit_earned': f"Merit points earned for {self.notes or 'clean driving'}",
            'merit_added': f"Merit points awarded",
            'merit_expired': f"Merit points expired",
            'adjusted': f"Manual adjustment: {self.notes or 'Balance correction'}",
            'offset': f"Merit points offset demerits"
        }
        return descriptions.get(self.transaction_type, self.transaction_type)
    
    def get_days_since_added(self):
        """Get days since this transaction was created"""
        if self.created_at:
            return (datetime.utcnow() - self.created_at).days
        return 0
    
    def is_within_12_month_window(self):
        """Check if demerit is still within 12-month rolling window"""
        if self.point_type != 'demerit' or self.is_expired:
            return False
        
        if not self.expiry_date:
            # Calculate from effective_date if not set
            self.expiry_date = self.effective_date + timedelta(days=365)
        
        return datetime.utcnow().date() <= self.expiry_date
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'transaction_type': self.transaction_type,
            'points_delta': self.points_delta,
            'point_type': self.point_type,
            'source_type': self.source_type,
            'source_id': self.source_id,
            'offence_code': self.offence_code,
            'offence_description': self.offence_description,
            'effective_date': self.effective_date.isoformat() if self.effective_date else None,
            'expiry_date': self.expiry_date.isoformat() if self.expiry_date else None,
            'is_expired': self.is_expired,
            'expired_at': self.expired_at.isoformat() if self.expired_at else None,
            'status': self.status,
            'balance_after': self.balance_after,
            'notes': self.notes,
            'created_at': self.created_at.isoformat(),
            'display_description': self.get_display_description()
        }
    
    def __repr__(self):
        sign = '+' if self.points_delta > 0 else ''
        return f'<PointsHistory {self.point_type}: {sign}{self.points_delta} pts ({self.transaction_type})>'


class MeritBalance(db.Model):
    """
    Merit Balance - Tracks merit points per citizen
    
    Merit points are OPTIONAL positive incentives to encourage safe driving.
    They can offset minor demerits and be redeemed for rewards.
    
    Starting Balance: +5 for clean initial record (optional)
    Max Cap: +10 points
    Reset: Halves or resets on any violation
    """
    __tablename__ = 'merit_balances'
    
    id = db.Column(db.Integer, primary_key=True)
    government_id = db.Column(db.String(36), db.ForeignKey('governments.id'), nullable=False, index=True)
    
    # Citizen reference
    citizen_profile_id = db.Column(db.Integer, db.ForeignKey('citizen_profiles.id'), nullable=False, unique=True, index=True)
    
    # Current balance
    current_merit_points = db.Column(db.Integer, default=0)
    
    # Tracking
    total_merit_earned = db.Column(db.Integer, default=0)  # Lifetime earned
    total_merit_used = db.Column(db.Integer, default=0)  # Lifetime used
    total_merit_expired = db.Column(db.Integer, default=0)  # Lifetime expired
    
    # Award tracking
    last_merit_award_date = db.Column(db.Date, nullable=True)
    clean_driving_months_accumulated = db.Column(db.Integer, default=0)  # For 6/12 month awards
    
    # Bonus tracking
    last_2_year_bonus_awarded = db.Column(db.Date, nullable=True)
    has_received_2_year_bonus = db.Column(db.Boolean, default=False)
    
    # Status
    is_exemplary = db.Column(db.Boolean, default=False)  # 5+ merit, 0 demerits in 12 months
    is_active = db.Column(db.Boolean, default=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    citizen_profile = db.relationship('CitizenProfile', backref=db.backref('merit_balance', uselist=False))
    
    # Constants
    MAX_MERIT_POINTS = 10
    MERIT_PER_6_MONTHS = 1
    MERIT_PER_12_MONTHS = 2
    BONUS_2_YEARS = 3
    OFFSET_CAP = 3  # Can offset up to 3 demerits
    
    def add_merit_points(self, points, reason=None):
        """Add merit points (with cap at MAX_MERIT_POINTS)"""
        if points <= 0:
            return 0
        
        available_space = self.MAX_MERIT_POINTS - self.current_merit_points
        points_to_add = min(points, available_space)
        
        self.current_merit_points += points_to_add
        self.total_merit_earned += points_to_add
        self.updated_at = datetime.utcnow()
        
        # Check if now exemplary
        self._check_exemplary_status()
        
        return points_to_add
    
    def use_merit_points(self, points, reason=None):
        """Use merit points (offset demerits or redeem rewards)"""
        if points <= 0:
            return False
        
        if self.current_merit_points < points:
            return False
        
        self.current_merit_points -= points
        self.total_merit_used += points
        self.updated_at = datetime.utcnow()
        
        return True
    
    def reset_on_violation(self):
        """Reset merit points on any violation (half or full reset)"""
        # Option 1: Half reset (more lenient)
        self.current_merit_points = self.current_merit_points // 2
        
        # Option 2: Full reset (stricter)
        # self.current_merit_points = 0
        
        self.is_exemplary = False
        self.clean_driving_months_accumulated = 0
        self.updated_at = datetime.utcnow()
    
    def _check_exemplary_status(self):
        """Check if citizen qualifies as 'exemplary' driver"""
        self.is_exemplary = (
            self.current_merit_points >= 5 and
            self.current_merit_points <= self.MAX_MERIT_POINTS
        )
    
    def check_6_month_award(self):
        """Check if eligible for +1 merit for 6 months clean"""
        today = date.today()
        
        if self.last_merit_award_date:
            months_since_award = (today.year - self.last_merit_award_date.year) * 12 + \
                                (today.month - self.last_merit_award_date.month)
            if months_since_award < 6:
                return 0
        
        self.last_merit_award_date = today
        points = self.add_merit_points(self.MERIT_PER_6_MONTHS, "6 months clean driving")
        return points
    
    def check_12_month_award(self):
        """Check if eligible for +2 merit for 12 months clean (at renewal)"""
        today = date.today()
        
        if self.last_merit_award_date:
            months_since_award = (today.year - self.last_merit_award_date.year) * 12 + \
                                (today.month - self.last_merit_award_date.month)
            if months_since_award < 12:
                return 0
        
        self.last_merit_award_date = today
        points = self.add_merit_points(self.MERIT_PER_12_MONTHS, "12 months clean driving")
        return points
    
    def check_2_year_bonus(self):
        """Check if eligible for +3-5 bonus for 2+ years clean"""
        if self.has_received_2_year_bonus:
            return 0
        
        today = date.today()
        
        if self.last_merit_award_date:
            years_since_start = (today.year - self.created_at.year)
            if years_since_start >= 2:
                self.has_received_2_year_bonus = True
                self.last_2_year_bonus_awarded = today
                points = self.add_merit_points(self.BONUS_2_YEARS, "2+ years clean driving bonus")
                return points
        
        return 0
    
    def can_offset_demerits(self):
        """Check if can offset demerit points"""
        return self.current_merit_points > 0 and self.current_merit_points <= self.OFFSET_CAP
    
    def get_offset_amount(self, demerit_count):
        """Get how many demerits can be offset"""
        if not self.can_offset_demerits():
            return 0
        return min(self.current_merit_points, self.OFFSET_CAP, demerit_count)
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'current_merit_points': self.current_merit_points,
            'total_merit_earned': self.total_merit_earned,
            'total_merit_used': self.total_merit_used,
            'total_merit_expired': self.total_merit_expired,
            'last_merit_award_date': self.last_merit_award_date.isoformat() if self.last_merit_award_date else None,
            'clean_driving_months_accumulated': self.clean_driving_months_accumulated,
            'has_received_2_year_bonus': self.has_received_2_year_bonus,
            'is_exemplary': self.is_exemplary,
            'max_merit_points': self.MAX_MERIT_POINTS,
            'can_offset_demerits': self.can_offset_demerits(),
            'offset_cap': self.OFFSET_CAP
        }
    
    def __repr__(self):
        return f'<MeritBalance {self.citizen_profile_id}: {self.current_merit_points} pts>'


class DemeritBalance(db.Model):
    """
    Demerit Balance - Tracks demerit points per citizen
    
    PRIMARY point system for traffic violations.
    Points added for violations, removed after 12-month rolling window.
    
    Starting Balance: 0 demerit points
    Rolling Window: 12 months (365 days)
    Thresholds:
      - 0-13: No action
      - 14+: License suspension (1 year)
      - 20+: Extended suspension/revocation (2 years)
    """
    __tablename__ = 'demerit_balances'
    
    id = db.Column(db.Integer, primary_key=True)
    government_id = db.Column(db.String(36), db.ForeignKey('governments.id'), nullable=False, index=True)
    
    # Citizen reference
    citizen_profile_id = db.Column(db.Integer, db.ForeignKey('citizen_profiles.id'), nullable=False, unique=True, index=True)
    
    # Current balance (calculated from active demerits)
    current_demerit_points = db.Column(db.Integer, default=0)
    active_demerit_count = db.Column(db.Integer, default=0)  # Number of active violations
    
    # Tracking
    total_demerits_accumulated = db.Column(db.Integer, default=0)  # Lifetime accumulated
    total_demerits_expired = db.Column(db.Integer, default=0)  # Lifetime expired
    
    # Status flags
    is_suspended = db.Column(db.Boolean, default=False)
    is_revoked = db.Column(db.Boolean, default=False)
    
    # Suspension tracking
    suspension_status = db.Column(db.String(20), default='clear')  # 'clear', 'warning', 'suspended', 'revoked'
    last_suspension_date = db.Column(db.Date, nullable=True)
    suspension_end_date = db.Column(db.Date, nullable=True)
    suspension_reason = db.Column(db.Text, nullable=True)
    
    # Warning tracking
    warning_issued_at = db.Column(db.DateTime, nullable=True)
    warning_threshold_reached = db.Column(db.Boolean, default=False)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_demerit_date = db.Column(db.Date, nullable=True)
    
    # Relationships
    citizen_profile = db.relationship('CitizenProfile', backref=db.backref('demerit_balance', uselist=False))
    
    # Constants (can be configured per government)
    THRESHOLD_WARNING = 10  # Issue warning at this level
    THRESHOLD_SUSPENSION = 14  # Trigger automatic suspension
    THRESHOLD_REVOCATION = 20  # Trigger potential revocation
    SUSPENSION_DURATION_MONTHS = 12
    REVOCATION_DURATION_MONTHS = 24
    
    def calculate_current_demerits(self):
        """
        Calculate current demerit points within rolling 12-month window
        
        This is the CORE method for threshold calculations.
        Returns total points from all non-expired demerits within 365 days.
        """
        from datetime import datetime
        
        cutoff_date = datetime.utcnow().date() - timedelta(days=365)
        
        # Sum all active (non-expired) demerits within window
        active_points = db.session.query(
            db.func.sum(PointsHistory.points_delta)
        ).filter(
            PointsHistory.citizen_profile_id == self.citizen_profile_id,
            PointsHistory.point_type == 'demerit',
            PointsHistory.status == 'active',
            PointsHistory.effective_date >= cutoff_date
        ).scalar() or 0
        
        # Count active demerits
        active_count = PointsHistory.query.filter(
            PointsHistory.citizen_profile_id == self.citizen_profile_id,
            PointsHistory.point_type == 'demerit',
            PointsHistory.status == 'active',
            PointsHistory.effective_date >= cutoff_date
        ).count()
        
        self.current_demerit_points = active_points
        self.active_demerit_count = active_count
        
        # Check thresholds
        self._check_suspension_threshold()
        
        return active_points, active_count
    
    def _check_suspension_threshold(self):
        """Check if demerits trigger suspension/revocation"""
        points = self.current_demerit_points
        
        # Check revocation (highest threshold)
        if points >= self.THRESHOLD_REVOCATION:
            self.suspension_status = 'revoked'
            self.is_revoked = True
            self.suspension_reason = f"License revoked: {points} demerit points (threshold: {self.THRESHOLD_REVOCATION})"
        
        # Check suspension
        elif points >= self.THRESHOLD_SUSPENSION:
            self.suspension_status = 'suspended'
            self.is_suspended = True
            if not self.last_suspension_date:
                self.last_suspension_date = date.today()
                self.suspension_end_date = date.today() + timedelta(days=365 * (points // 14))
            self.suspension_reason = f"License suspended: {points} demerit points (threshold: {self.THRESHOLD_SUSPENSION})"
        
        # Check warning
        elif points >= self.THRESHOLD_WARNING:
            if self.suspension_status != 'warning':
                self.suspension_status = 'warning'
                self.warning_threshold_reached = True
                if not self.warning_issued_at:
                    self.warning_issued_at = datetime.utcnow()
                self.suspension_reason = f"Warning: {points} demerit points approaching suspension threshold"
        
        # Clear status
        else:
            if self.suspension_status in ['warning', 'clear']:
                self.suspension_status = 'clear'
                self.warning_threshold_reached = False
        
        self.updated_at = datetime.utcnow()
    
    def add_demerit_points(self, points, offence_code=None, offence_description=None,
                          source_type='ticket', source_id=None, effective_date=None):
        """Add demerit points for a violation"""
        if points <= 0:
            return None
        
        if not effective_date:
            effective_date = date.today()
        
        # Create history record
        history = PointsHistory(
            government_id=self.government_id,
            citizen_profile_id=self.citizen_profile_id,
            transaction_type='demerit_added',
            points_delta=points,
            point_type='demerit',
            source_type=source_type,
            source_id=source_id,
            offence_code=offence_code,
            offence_description=offence_description,
            effective_date=effective_date,
            expiry_date=effective_date + timedelta(days=365),
            status='active'
        )
        db.session.add(history)
        
        # Update balance
        self.total_demerits_accumulated += points
        self.last_demerit_date = effective_date
        self.updated_at = datetime.utcnow()
        
        # Recalculate and check thresholds
        self.calculate_current_demerits()
        
        return history
    
    def get_status_info(self):
        """Get comprehensive status information"""
        return {
            'status': self.suspension_status,
            'current_points': self.current_demerit_points,
            'active_count': self.active_demerit_count,
            'threshold_warning': self.THRESHOLD_WARNING,
            'threshold_suspension': self.THRESHOLD_SUSPENSION,
            'threshold_revocation': self.THRESHOLD_REVOCATION,
            'points_to_warning': max(0, self.THRESHOLD_WARNING - self.current_demerit_points),
            'points_to_suspension': max(0, self.THRESHOLD_SUSPENSION - self.current_demerit_points),
            'points_to_revocation': max(0, self.THRESHOLD_REVOCATION - self.current_demerit_points),
            'is_suspended': self.is_suspended,
            'is_revoked': self.is_revoked,
            'suspension_end_date': self.suspension_end_date.isoformat() if self.suspension_end_date else None,
            'suspension_reason': self.suspension_reason,
            'has_warning': self.warning_threshold_reached,
            'warning_issued_at': self.warning_issued_at.isoformat() if self.warning_issued_at else None,
            'last_demerit_date': self.last_demerit_date.isoformat() if self.last_demerit_date else None
        }
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'current_demerit_points': self.current_demerit_points,
            'active_demerit_count': self.active_demerit_count,
            'total_demerits_accumulated': self.total_demerits_accumulated,
            'total_demerits_expired': self.total_demerits_expired,
            'is_suspended': self.is_suspended,
            'is_revoked': self.is_revoked,
            'suspension_status': self.suspension_status,
            'last_suspension_date': self.last_suspension_date.isoformat() if self.last_suspension_date else None,
            'suspension_end_date': self.suspension_end_date.isoformat() if self.suspension_end_date else None,
            'suspension_reason': self.suspension_reason,
            'warning_threshold_reached': self.warning_threshold_reached,
            'last_demerit_date': self.last_demerit_date.isoformat() if self.last_demerit_date else None,
            'status_info': self.get_status_info()
        }
    
    def __repr__(self):
        return f'<DemeritBalance {self.citizen_profile_id}: {self.current_demerit_points} pts ({self.suspension_status})>'


class PointsThreshold(db.Model):
    """
    Points Threshold - Configurable threshold settings per government
    
    Allows different governments to set different thresholds for
    suspension and revocation based on local laws.
    """
    __tablename__ = 'points_thresholds'
    
    id = db.Column(db.Integer, primary_key=True)
    government_id = db.Column(db.String(36), db.ForeignKey('governments.id'), nullable=False, unique=True, index=True)
    
    # Threshold settings
    warning_threshold = db.Column(db.Integer, default=10)
    suspension_threshold = db.Column(db.Integer, default=14)
    revocation_threshold = db.Column(db.Integer, default=20)
    
    # Duration settings
    suspension_duration_months = db.Column(db.Integer, default=12)
    revocation_duration_months = db.Column(db.Integer, default=24)
    
    # Provisional driver settings (stricter for new drivers)
    provisional_warning_threshold = db.Column(db.Integer, default=5)
    provisional_suspension_threshold = db.Column(db.Integer, default=7)
    
    # Rolling window
    rolling_window_days = db.Column(db.Integer, default=365)
    
    # Merit settings
    merit_enabled = db.Column(db.Boolean, default=True)
    max_merit_points = db.Column(db.Integer, default=10)
    merit_offset_cap = db.Column(db.Integer, default=3)
    
    # Merit award settings
    merit_6_month_award = db.Column(db.Integer, default=1)
    merit_12_month_award = db.Column(db.Integer, default=2)
    merit_2_year_bonus = db.Column(db.Integer, default=3)
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'government_id': self.government_id,
            'warning_threshold': self.warning_threshold,
            'suspension_threshold': self.suspension_threshold,
            'revocation_threshold': self.revocation_threshold,
            'suspension_duration_months': self.suspension_duration_months,
            'revocation_duration_months': self.revocation_duration_months,
            'provisional_warning_threshold': self.provisional_warning_threshold,
            'provisional_suspension_threshold': self.provisional_suspension_threshold,
            'rolling_window_days': self.rolling_window_days,
            'merit_enabled': self.merit_enabled,
            'max_merit_points': self.max_merit_points,
            'merit_offset_cap': self.merit_offset_cap,
            'merit_6_month_award': self.merit_6_month_award,
            'merit_12_month_award': self.merit_12_month_award,
            'merit_2_year_bonus': self.merit_2_year_bonus,
            'is_active': self.is_active
        }
    
    def __repr__(self):
        return f'<PointsThreshold {self.government_id}: warn={self.warning_threshold}, susp={self.suspension_threshold}>'


class SuspensionRecord(db.Model):
    """
    Suspension Record - Tracks license suspensions and revocations
    
    Provides complete audit trail for enforcement actions.
    """
    __tablename__ = 'suspension_records'
    
    id = db.Column(db.Integer, primary_key=True)
    government_id = db.Column(db.String(36), db.ForeignKey('governments.id'), nullable=False, index=True)
    
    # Citizen reference
    citizen_profile_id = db.Column(db.Integer, db.ForeignKey('citizen_profiles.id'), nullable=False, index=True)
    
    # Suspension details
    suspension_type = db.Column(db.String(20), nullable=False)  # 'suspension', 'revocation'
    status = db.Column(db.String(20), default='active')  # 'active', 'expired', 'lifted', 'appealed'
    
    # Points that triggered
    points_at_incident = db.Column(db.Integer, nullable=False)
    threshold_exceeded = db.Column(db.Integer, nullable=False)
    
    # Dates
    effective_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=True)
    lifted_date = db.Column(db.Date, nullable=True)
    
    # Reason
    reason = db.Column(db.Text, nullable=False)
    offences_included = db.Column(db.Text, nullable=True)  # JSON array of offence codes
    
    # Source
    source_type = db.Column(db.String(50), nullable=True)  # 'automatic', 'manual', 'court_order'
    source_id = db.Column(db.String(100), nullable=True)
    
    # BLA sync
    bla_notified = db.Column(db.Boolean, default=False)
    bla_notification_date = db.Column(db.DateTime, nullable=True)
    bla_reference = db.Column(db.String(100), nullable=True)
    
    # Admin details
    reviewed_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    review_notes = db.Column(db.Text, nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    citizen_profile = db.relationship('CitizenProfile', backref=db.backref('suspension_records', lazy=True))
    reviewed_by = db.relationship('User', foreign_keys=[reviewed_by_id])
    
    def is_active(self):
        """Check if suspension is currently active"""
        if self.status != 'active':
            return False
        
        if self.end_date and date.today() > self.end_date:
            return False
        
        return True
    
    def lift_suspension(self, reason=None, reviewed_by_id=None):
        """Manually lift a suspension"""
        self.status = 'lifted'
        self.lifted_date = date.today()
        self.review_notes = reason
        self.reviewed_by_id = reviewed_by_id
        self.updated_at = datetime.utcnow()
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'suspension_type': self.suspension_type,
            'status': self.status,
            'points_at_incident': self.points_at_incident,
            'threshold_exceeded': self.threshold_exceeded,
            'effective_date': self.effective_date.isoformat(),
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'lifted_date': self.lifted_date.isoformat() if self.lifted_date else None,
            'reason': self.reason,
            'offences_included': self.offences_included,
            'source_type': self.source_type,
            'source_id': self.source_id,
            'bla_notified': self.bla_notified,
            'bla_reference': self.bla_reference,
            'is_active': self.is_active(),
            'created_at': self.created_at.isoformat()
        }
    
    def __repr__(self):
        return f'<SuspensionRecord {self.citizen_profile_id}: {self.suspension_type} ({self.status})>'


class PointsConfiguration(db.Model):
    """
    Points Configuration - Global settings for points system
    
    Master configuration for merit/demerit point behavior.
    """
    __tablename__ = 'points_configurations'
    
    id = db.Column(db.Integer, primary_key=True)
    government_id = db.Column(db.String(36), db.ForeignKey('governments.id'), nullable=False, unique=True, index=True)
    
    # System enable/disable
    demerit_system_enabled = db.Column(db.Boolean, default=True)
    merit_system_enabled = db.Column(db.Boolean, default=True)
    
    # Auto-expiry settings
    auto_expire_enabled = db.Column(db.Boolean, default=True)
    expiry_check_interval_hours = db.Column(db.Integer, default=24)
    
    # Threshold monitoring
    auto_suspension_enabled = db.Column(db.Boolean, default=True)
    auto_warning_enabled = db.Column(db.Boolean, default=True)
    notification_enabled = db.Column(db.Boolean, default=True)
    
    # BLA sync settings
    bla_sync_enabled = db.Column(db.Boolean, default=True)
    sync_interval_hours = db.Column(db.Integer, default=1)
    
    # Merit award settings
    auto_merit_award_enabled = db.Column(db.Boolean, default=True)
    merit_award_check_interval_hours = db.Column(db.Integer, default=24)
    
    # JSON for offence point values (default values)
    offence_points_default = db.Column(db.Text, nullable=True)  # JSON mapping
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def get_offence_points_default(self):
        """Get default offence point values"""
        if not self.offence_points_default:
            return self._get_default_offence_points()
        try:
            import json
            return json.loads(self.offence_points_default)
        except:
            return self._get_default_offence_points()
    
    def _get_default_offence_points(self):
        """Get Barbados 2026 default offence points"""
        return {
            'speeding_minor': {'points': 3, 'fine_min': 300, 'fine_max': 600},
            'speeding_serious': {'points': 6, 'fine_min': 1000, 'fine_max': 2000},
            'careless_dangerous': {'points': 7, 'fine_min': 2000, 'fine_max': 5000},
            'drink_driving': {'points': 11, 'fine_min': 3000, 'fine_max': 10000},
            'red_light': {'points': 4, 'fine_min': 500, 'fine_max': 1000},
            'no_seatbelt': {'points': 2, 'fine_min': 200, 'fine_max': 750},
            'mobile_phone': {'points': 4, 'fine_min': 400, 'fine_max': 800},
            'unlicensed': {'points': 9, 'fine_min': 1500, 'fine_max': 4000},
            'no_insurance': {'points': 9, 'fine_min': 2000, 'fine_max': 5000},
            'improper_overtaking': {'points': 4, 'fine_min': 500, 'fine_max': 1500},
            'psv_overloading': {'points': 6, 'fine_min': 1000, 'fine_max': 3000},
            'mechanical_defects': {'points': 3, 'fine_min': 200, 'fine_max': 800}
        }
    
    def set_offence_points_default(self, points_dict):
        """Set default offence point values"""
        import json
        self.offence_points_default = json.dumps(points_dict)
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'government_id': self.government_id,
            'demerit_system_enabled': self.demerit_system_enabled,
            'merit_system_enabled': self.merit_system_enabled,
            'auto_expire_enabled': self.auto_expire_enabled,
            'expiry_check_interval_hours': self.expiry_check_interval_hours,
            'auto_suspension_enabled': self.auto_suspension_enabled,
            'auto_warning_enabled': self.auto_warning_enabled,
            'notification_enabled': self.notification_enabled,
            'bla_sync_enabled': self.bla_sync_enabled,
            'sync_interval_hours': self.sync_interval_hours,
            'auto_merit_award_enabled': self.auto_merit_award_enabled,
            'merit_award_check_interval_hours': self.merit_award_check_interval_hours,
            'offence_points_default': self.get_offence_points_default(),
            'is_active': self.is_active
        }
    
    def __repr__(self):
        return f'<PointsConfiguration {self.government_id}: demerit={self.demerit_system_enabled}, merit={self.merit_system_enabled}>'

