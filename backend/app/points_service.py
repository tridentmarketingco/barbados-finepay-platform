"""
Merit/Demerit Service - Core business logic for point system

Handles:
- Adding/removing demerit points for violations
- Awarding merit points for clean driving
- Automatic point expiry (12-month rolling window)
- Threshold monitoring and suspension detection
- BLA sync integration
- Scheduled maintenance tasks
"""

from . import db
from .gamification_models import CitizenProfile
from .points_models import (
    PointsHistory, MeritBalance, DemeritBalance, 
    PointsThreshold, SuspensionRecord, PointsConfiguration
)
from .models import Ticket, Offence, PenaltyRule, Government
from datetime import datetime, timedelta, date
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)


class MeritDemeritService:
    """
    Core service for merit/demerit point management
    
    This service is the SINGLE SOURCE OF TRUTH for all point calculations.
    All point transactions must go through this service.
    """
    
    # Default offence point values (Barbados 2026)
    DEFAULT_OFFENCE_POINTS = {
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
    
    @staticmethod
    def get_or_create_citizen_balances(government_id, national_id=None, 
                                        driver_license=None, profile_id=None):
        """
        Get or create citizen's merit and demerit balances
        
        Args:
            government_id: Government ID
            national_id: National ID (will be hashed)
            driver_license: Driver license
            profile_id: CitizenProfile ID (optional)
        
        Returns:
            tuple: (merit_balance, demerit_balance)
        """
        # Get or create profile
        if profile_id:
            profile = CitizenProfile.query.get(profile_id)
        else:
            profile = CitizenProfile.query.filter(
                CitizenProfile.government_id == government_id,
                (
                    (national_id and CitizenProfile.national_id_hash == CitizenProfile.hash_identifier(national_id)) |
                    (driver_license and CitizenProfile.driver_license_hash == CitizenProfile.hash_identifier(driver_license))
                )
            ).first()
        
        if not profile:
            return None, None
        
        # Get or create merit balance
        merit = MeritBalance.query.filter_by(
            citizen_profile_id=profile.id
        ).first()
        
        if not merit:
            merit = MeritBalance(
                government_id=government_id,
                citizen_profile_id=profile.id,
                current_merit_points=0,
                total_merit_earned=0,
                total_merit_used=0
            )
            db.session.add(merit)
            db.session.flush()
        
        # Get or create demerit balance
        demerit = DemeritBalance.query.filter_by(
            citizen_profile_id=profile.id
        ).first()
        
        if not demerit:
            demerit = DemeritBalance(
                government_id=government_id,
                citizen_profile_id=profile.id,
                current_demerit_points=0,
                active_demerit_count=0
            )
            db.session.add(demerit)
            db.session.flush()
        
        return merit, demerit
    
    # =========================================================================
    # DEMERIT POINT METHODS
    # =========================================================================
    
    @staticmethod
    def add_demerit_points(government_id, national_id=None, driver_license=None,
                          offence_code=None, offence_id=None, points=None,
                          ticket_id=None, fine_amount=None, description=None,
                          source_type='ticket', effective_date=None, profile_id=None):
        """
        Add demerit points for a traffic violation
        
        This is the PRIMARY method for recording violations.
        Automatically checks thresholds and creates suspension records.
        
        Args:
            government_id: Government ID
            national_id: National ID (optional if profile_id provided)
            driver_license: Driver license (optional)
            offence_code: Offence code (e.g., 'SPEEDING_MINOR')
            offence_id: Offence ID from database
            points: Points to add (optional, will look up if not provided)
            ticket_id: Ticket ID
            fine_amount: Fine amount (for records)
            description: Offence description
            source_type: Source type ('ticket', 'court_order', 'bla_sync')
            effective_date: Date points become effective
            profile_id: CitizenProfile ID
        
        Returns:
            dict: Result with success status, demerit record, and threshold info
        """
        try:
            # Get citizen balances
            merit, demerit = MeritDemeritService.get_or_create_citizen_balances(
                government_id=government_id,
                national_id=national_id,
                driver_license=driver_license,
                profile_id=profile_id
            )
            
            if not demerit:
                return {'success': False, 'error': 'Citizen profile not found'}
            
            # Get points from offence if not provided
            if points is None and offence_id:
                offence = Offence.query.get(offence_id)
                if offence:
                    # Get penalty rule
                    penalty = offence.get_active_penalty_rule()
                    if penalty:
                        points = penalty.points
            
            if not points or points <= 0:
                return {'success': False, 'error': 'Invalid points value'}
            
            # Set effective date
            if not effective_date:
                effective_date = date.today()
            
            # Get offence info
            offence_info = None
            if offence_id:
                offence = Offence.query.get(offence_id)
                if offence:
                    offence_code = offence.code
                    offence_info = offence
                    description = offence.description or description
            
            # Add demerit points
            history = demerit.add_demerit_points(
                points=points,
                offence_code=offence_code,
                offence_description=description,
                source_type=source_type,
                source_id=ticket_id,
                effective_date=effective_date
            )
            
            # Update citizen profile
            profile = CitizenProfile.query.get(demerit.citizen_profile_id)
            if profile:
                profile.total_violations_avoided = (profile.total_violations_avoided or 0) + 1
                profile.last_violation_date = datetime.utcnow()
                profile.update_streaks()
            
            # Reset merit on violation (option: half or full reset)
            if merit:
                merit.reset_on_violation()
            
            db.session.commit()
            
            # Get updated status
            status_info = demerit.get_status_info()
            
            # Check if suspension triggered
            suspension_triggered = None
            if status_info['is_suspended'] and not demerit.last_suspension_date:
                # Create suspension record
                suspension = MeritDemeritService.create_suspension_record(
                    demerit=demerit,
                    suspension_type='suspension',
                    points_at_incident=demerit.current_demerit_points,
                    threshold_exceeded=demerit.THRESHOLD_SUSPENSION,
                    reason=f"Automatic suspension: {demerit.current_demerit_points} demerit points exceeded threshold of {demerit.THRESHOLD_SUSPENSION}",
                    offences_included=[offence_code] if offence_code else None,
                    source_type='automatic'
                )
                suspension_triggered = suspension
            
            return {
                'success': True,
                'history_id': history.id,
                'points_added': points,
                'total_demerits': demerit.current_demerit_points,
                'status_info': status_info,
                'suspension_triggered': suspension_triggered is not None,
                'suspension_record': suspension_triggered.to_dict() if suspension_triggered else None
            }
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error adding demerit points: {e}")
            return {'success': False, 'error': str(e)}
    
    @staticmethod
    def calculate_current_demerits(government_id, national_id=None, driver_license=None,
                                   profile_id=None):
        """
        Calculate current demerit points within 12-month rolling window
        
        Args:
            government_id: Government ID
            national_id: National ID
            driver_license: Driver license
            profile_id: CitizenProfile ID
        
        Returns:
            dict: Current demerit status
        """
        _, demerit = MeritDemeritService.get_or_create_citizen_balances(
            government_id=government_id,
            national_id=national_id,
            driver_license=driver_license,
            profile_id=profile_id
        )
        
        if not demerit:
            return None
        
        # Recalculate
        points, count = demerit.calculate_current_demerits()
        db.session.commit()
        
        return {
            'current_demerit_points': points,
            'active_violation_count': count,
            'status': demerit.suspension_status,
            'is_suspended': demerit.is_suspended,
            'is_revoked': demerit.is_revoked,
            'status_info': demerit.get_status_info()
        }
    
    @staticmethod
    def get_active_demerits(government_id, national_id=None, driver_license=None,
                           profile_id=None):
        """
        Get all active (non-expired) demerit entries
        
        Args:
            government_id: Government ID
            national_id: National ID
            driver_license: Driver license
            profile_id: CitizenProfile ID
        
        Returns:
            list: Active demerit entries
        """
        # Get profile
        if profile_id:
            profile = CitizenProfile.query.get(profile_id)
        else:
            profile = CitizenProfile.query.filter(
                CitizenProfile.government_id == government_id,
                (
                    (national_id and CitizenProfile.national_id_hash == CitizenProfile.hash_identifier(national_id)) |
                    (driver_license and CitizenProfile.driver_license_hash == CitizenProfile.hash_identifier(driver_license))
                )
            ).first()
        
        if not profile:
            return []
        
        # Get active demerits
        cutoff_date = date.today() - timedelta(days=365)
        
        active_demerits = PointsHistory.query.filter(
            PointsHistory.citizen_profile_id == profile.id,
            PointsHistory.point_type == 'demerit',
            PointsHistory.status == 'active',
            PointsHistory.effective_date >= cutoff_date
        ).order_by(PointsHistory.effective_date.desc()).all()
        
        return [d.to_dict() for d in active_demerits]
    
    # =========================================================================
    # MERIT POINT METHODS
    # =========================================================================
    
    @staticmethod
    def add_merit_points(government_id, national_id=None, driver_license=None,
                        points=None, reason=None, source_type='auto_award',
                        profile_id=None):
        """
        Award merit points to a citizen
        
        Args:
            government_id: Government ID
            national_id: National ID
            driver_license: Driver license
            points: Points to award
            reason: Reason for award
            source_type: Source type ('auto_award', 'manual', 'bonus')
            profile_id: CitizenProfile ID
        
        Returns:
            dict: Result with success status and new balance
        """
        try:
            merit, _ = MeritDemeritService.get_or_create_citizen_balances(
                government_id=government_id,
                national_id=national_id,
                driver_license=driver_license,
                profile_id=profile_id
            )
            
            if not merit:
                return {'success': False, 'error': 'Citizen profile not found'}
            
            # Get profile
            profile = CitizenProfile.query.get(merit.citizen_profile_id)
            
            # Calculate balance before
            balance_before = merit.current_merit_points
            
            # Award points (with cap)
            points_added = merit.add_merit_points(points, reason)
            
            # Create history record
            history = PointsHistory(
                government_id=government_id,
                citizen_profile_id=merit.citizen_profile_id,
                transaction_type='merit_added' if source_type == 'manual' else 'merit_earned',
                points_delta=points_added,
                point_type='merit',
                source_type=source_type,
                description=reason,
                effective_date=date.today(),
                status='active',
                balance_after=merit.current_merit_points
            )
            db.session.add(history)
            
            db.session.commit()
            
            return {
                'success': True,
                'points_awarded': points_added,
                'points_requested': points,
                'current_balance': merit.current_merit_points,
                'total_earned': merit.total_merit_earned,
                'is_exemplary': merit.is_exemplary
            }
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error adding merit points: {e}")
            return {'success': False, 'error': str(e)}
    
    @staticmethod
    def offset_demerits_with_merits(government_id, national_id=None, driver_license=None,
                                     profile_id=None):
        """
        Offset demerit points using merit points
        
        Can offset up to 3 demerits using available merit points.
        
        Args:
            government_id: Government ID
            national_id: National ID
            driver_license: Driver license
            profile_id: CitizenProfile ID
        
        Returns:
            dict: Result with offsets applied
        """
        try:
            merit, demerit = MeritDemeritService.get_or_create_citizen_balances(
                government_id=government_id,
                national_id=national_id,
                driver_license=driver_license,
                profile_id=profile_id
            )
            
            if not merit or not demerit:
                return {'success': False, 'error': 'Citizen profile not found'}
            
            # Check if can offset
            if not merit.can_offset_demerits():
                return {
                    'success': True,
                    'message': 'No merit points available for offset',
                    'offsets_applied': 0,
                    'current_demerits': demerit.current_demerit_points,
                    'current_merits': merit.current_merit_points
                }
            
            # Get offset amount
            offset_amount = merit.get_offset_amount(demerit.current_demerit_points)
            
            if offset_amount <= 0:
                return {
                    'success': True,
                    'message': 'No offsets applicable',
                    'offsets_applied': 0
                }
            
            # Use merit points
            merit.use_merit_points(offset_amount, "Offset demerit points")
            
            # Create history record for offset
            history = PointsHistory(
                government_id=government_id,
                citizen_profile_id=merit.citizen_profile_id,
                transaction_type='offset',
                points_delta=-offset_amount,
                point_type='merit',
                source_type='auto_offset',
                description=f"Offset {offset_amount} demerit point(s)",
                effective_date=date.today(),
                status='active',
                balance_after=merit.current_merit_points
            )
            db.session.add(history)
            
            db.session.commit()
            
            return {
                'success': True,
                'offsets_applied': offset_amount,
                'remaining_merits': merit.current_merit_points,
                'current_demerits': demerit.current_demerit_points,
                'message': f"Successfully offset {offset_amount} demerit point(s)"
            }
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error offsetting demerits: {e}")
            return {'success': False, 'error': str(e)}
    
    @staticmethod
    def get_merit_status(government_id, national_id=None, driver_license=None,
                         profile_id=None):
        """
        Get citizen's merit point status
        
        Args:
            government_id: Government ID
            national_id: National ID
            driver_license: Driver license
            profile_id: CitizenProfile ID
        
        Returns:
            dict: Merit status information
        """
        merit, _ = MeritDemeritService.get_or_create_citizen_balances(
            government_id=government_id,
            national_id=national_id,
            driver_license=driver_license,
            profile_id=profile_id
        )
        
        if not merit:
            return None
        
        return {
            'current_merit_points': merit.current_merit_points,
            'total_earned': merit.total_merit_earned,
            'total_used': merit.total_merit_used,
            'total_expired': merit.total_merit_expired,
            'last_award_date': merit.last_merit_award_date.isoformat() if merit.last_merit_award_date else None,
            'is_exemplary': merit.is_exemplary,
            'max_points': merit.MAX_MERIT_POINTS,
            'can_offset_demerits': merit.can_offset_demerits(),
            'offset_cap': merit.OFFSET_CAP,
            'eligible_for_bonus': not merit.has_received_2_year_bonus
        }
    
    # =========================================================================
    # POINT EXPIRY METHODS
    # =========================================================================
    
    @staticmethod
    def expire_old_points(government_id=None):
        """
        Expire demerit points that are older than 12 months
        
        Scheduled task that runs daily to:
        1. Find expired demerits
        2. Update their status
        3. Recalculate balances
        4. Log the expiry
        
        Args:
            government_id: Specific government (None = all governments)
        
        Returns:
            dict: Summary of expiries processed
        """
        today = date.today()
        cutoff_date = today - timedelta(days=365)
        
        try:
            # Build query
            query = PointsHistory.query.filter(
                PointsHistory.point_type == 'demerit',
                PointsHistory.status == 'active',
                PointsHistory.expiry_date <= today,
                PointsHistory.expiry_date >= cutoff_date
            )
            
            if government_id:
                query = query.filter(PointsHistory.government_id == government_id)
            
            # Find expired points
            expired_entries = query.all()
            
            summary = {
                'total_found': len(expired_entries),
                'processed': 0,
                'errors': 0,
                'points_expired': 0,
                'by_citizen': {}
            }
            
            for entry in expired_entries:
                try:
                    # Mark as expired
                    entry.status = 'expired'
                    entry.is_expired = True
                    entry.expired_at = datetime.utcnow()
                    
                    # Update demerit balance
                    demerit = DemeritBalance.query.filter_by(
                        citizen_profile_id=entry.citizen_profile_id
                    ).first()
                    
                    if demerit:
                        demerit.total_demerits_expired += abs(entry.points_delta)
                        demerit.calculate_current_demerits()
                        
                        # Track by citizen
                        cid = entry.citizen_profile_id
                        if cid not in summary['by_citizen']:
                            summary['by_citizen'][cid] = 0
                        summary['by_citizen'][cid] += abs(entry.points_delta)
                    
                    summary['points_expired'] += abs(entry.points_delta)
                    summary['processed'] += 1
                    
                except Exception as e:
                    logger.error(f"Error expiring entry {entry.id}: {e}")
                    summary['errors'] += 1
            
            db.session.commit()
            
            logger.info(f"Point expiry complete: {summary['processed']} entries processed, {summary['points_expired']} points expired")
            
            return summary
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error in expire_old_points: {e}")
            return {'error': str(e)}
    
    @staticmethod
    def check_and_award_merits(government_id=None):
        """
        Check for citizens eligible for merit awards
        
        Scheduled task that runs daily to:
        1. Check for 6-month clean driving awards
        2. Check for 12-month clean driving awards
        3. Award merits where applicable
        
        Args:
            government_id: Specific government (None = all governments)
        
        Returns:
            dict: Summary of awards processed
        """
        try:
            # Build query for merit balances
            query = MeritBalance.query.filter(
                MeritBalance.is_active == True
            )
            
            if government_id:
                query = query.filter(MeritBalance.government_id == government_id)
            
            merit_balances = query.all()
            
            summary = {
                'total_checked': len(merit_balances),
                '6_month_awards': 0,
                '12_month_awards': 0,
                '2_year_bonuses': 0,
                'errors': 0
            }
            
            for merit in merit_balances:
                try:
                    profile = CitizenProfile.query.get(merit.citizen_profile_id)
                    if not profile:
                        continue
                    
                    # Skip if has recent violations
                    if profile.last_violation_date:
                        months_since_violation = (datetime.utcnow() - profile.last_violation_date).days / 30
                        if months_since_violation < 6:
                            continue
                    
                    # Check for awards
                    if merit.last_merit_award_date:
                        months_since = (date.today() - merit.last_merit_award_date).days / 30
                        
                        # 6-month award
                        if months_since >= 6:
                            points = merit.check_6_month_award()
                            if points > 0:
                                summary['6_month_awards'] += 1
                        
                        # 12-month award
                        if months_since >= 12:
                            points = merit.check_12_month_award()
                            if points > 0:
                                summary['12_month_awards'] += 1
                    else:
                        # First award if never had violations
                        if not profile.last_violation_date:
                            age_months = (date.today() - profile.created_at.date()).days / 30
                            
                            if age_months >= 6:
                                points = merit.add_merit_points(1, "First 6 months clean")
                                summary['6_month_awards'] += 1
                    
                    # Check 2-year bonus
                    points = merit.check_2_year_bonus()
                    if points > 0:
                        summary['2_year_bonuses'] += 1
                    
                except Exception as e:
                    logger.error(f"Error checking merit for profile {merit.citizen_profile_id}: {e}")
                    summary['errors'] += 1
            
            db.session.commit()
            
            logger.info(f"Merit award check complete: {summary}")
            
            return summary
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error in check_and_award_merits: {e}")
            return {'error': str(e)}
    
    # =========================================================================
    # SUSPENSION METHODS
    # =========================================================================
    
    @staticmethod
    def create_suspension_record(demerit, suspension_type, points_at_incident,
                                  threshold_exceeded, reason, offences_included=None,
                                  source_type='automatic', source_id=None):
        """
        Create a suspension record
        
        Args:
            demerit: DemeritBalance instance
            suspension_type: 'suspension' or 'revocation'
            points_at_incident: Points at time of incident
            threshold_exceeded: Threshold that was exceeded
            reason: Reason for suspension
            offences_included: List of offence codes
            source_type: Source type
            source_id: Source reference
        
        Returns:
            SuspensionRecord: Created record
        """
        # Calculate end date
        if suspension_type == 'suspension':
            end_date = date.today() + timedelta(days=365)
        else:  # revocation
            end_date = date.today() + timedelta(days=730)  # 2 years
        
        import json
        offences_json = json.dumps(offences_included) if offences_included else None
        
        suspension = SuspensionRecord(
            government_id=demerit.government_id,
            citizen_profile_id=demerit.citizen_profile_id,
            suspension_type=suspension_type,
            status='active',
            points_at_incident=points_at_incident,
            threshold_exceeded=threshold_exceeded,
            effective_date=date.today(),
            end_date=end_date,
            reason=reason,
            offences_included=offences_json,
            source_type=source_type,
            source_id=source_id
        )
        
        db.session.add(suspension)
        db.session.flush()
        
        return suspension
    
    @staticmethod
    def get_suspension_status(government_id, national_id=None, driver_license=None,
                               profile_id=None):
        """
        Get citizen's suspension status
        
        Args:
            government_id: Government ID
            national_id: National ID
            driver_license: Driver license
            profile_id: CitizenProfile ID
        
        Returns:
            dict: Suspension information
        """
        # Get profile
        if profile_id:
            profile = CitizenProfile.query.get(profile_id)
        else:
            profile = CitizenProfile.query.filter(
                CitizenProfile.government_id == government_id,
                (
                    (national_id and CitizenProfile.national_id_hash == CitizenProfile.hash_identifier(national_id)) |
                    (driver_license and CitizenProfile.driver_license_hash == CitizenProfile.hash_identifier(driver_license))
                )
            ).first()
        
        if not profile:
            return None
        
        # Get demerit status
        demerit_status = MeritDemeritService.calculate_current_demerits(
            government_id, profile_id=profile.id
        )
        
        # Get active suspensions
        active_suspensions = SuspensionRecord.query.filter(
            SuspensionRecord.citizen_profile_id == profile.id,
            SuspensionRecord.status == 'active'
        ).all()
        
        return {
            'is_suspended': demerit_status['is_suspended'] if demerit_status else False,
            'is_revoked': demerit_status['is_revoked'] if demerit_status else False,
            'current_demerits': demerit_status['current_demerit_points'] if demerit_status else 0,
            'active_suspensions': [s.to_dict() for s in active_suspensions],
            'suspension_status': demerit_status['status'] if demerit_status else 'clear',
            'status_info': demerit_status['status_info'] if demerit_status else None
        }
    
    # =========================================================================
    # FULL STATUS METHODS
    # =========================================================================
    
    @staticmethod
    def get_full_points_status(government_id, national_id=None, driver_license=None,
                               profile_id=None):
        """
        Get complete points status for a citizen
        
        Returns full status including:
        - Demerit balance and status
        - Merit balance and awards
        - Active demerit entries
        - Suspension status
        - Warnings
        
        Args:
            government_id: Government ID
            national_id: National ID
            driver_license: Driver license
            profile_id: CitizenProfile ID
        
        Returns:
            dict: Complete points status
        """
        # Get balances
        merit, demerit = MeritDemeritService.get_or_create_citizen_balances(
            government_id=government_id,
            national_id=national_id,
            driver_license=driver_license,
            profile_id=profile_id
        )
        
        if not demerit:
            return {'error': 'Citizen profile not found'}
        
        # Get profile
        if profile_id:
            profile = CitizenProfile.query.get(profile_id)
        else:
            profile = CitizenProfile.query.filter(
                CitizenProfile.government_id == government_id,
                (
                    (national_id and CitizenProfile.national_id_hash == CitizenProfile.hash_identifier(national_id)) |
                    (driver_license and CitizenProfile.driver_license_hash == CitizenProfile.hash_identifier(driver_license))
                )
            ).first()
        
        # Recalculate demerits
        demerit.calculate_current_demerits()
        db.session.commit()
        
        # Get active demerits
        active_demerits = MeritDemeritService.get_active_demerits(
            government_id, profile_id=demerit.citizen_profile_id
        )
        
        # Get suspension status
        suspension_status = MeritDemeritService.get_suspension_status(
            government_id, profile_id=demerit.citizen_profile_id
        )
        
        return {
            'citizen_profile_id': demerit.citizen_profile_id,
            'demerit': demerit.to_dict(),
            'merit': merit.to_dict() if merit else None,
            'active_demerits': active_demerits,
            'suspension_status': suspension_status,
            'total_demerits_12_months': sum(d['points_delta'] for d in active_demerits),
            'violations_count_12_months': len(active_demerits),
            'clean_driving_streak': profile.clean_driving_streak_days if profile else 0,
            'warnings': MeritDemeritService._get_warnings(demerit)
        }
    
    @staticmethod
    def _get_warnings(demerit):
        """Generate warnings based on demerit status"""
        warnings = []
        
        if demerit.suspension_status == 'suspended':
            warnings.append({
                'level': 'critical',
                'message': f'License suspended. {demerit.current_demerit_points} demerit points. Contact Licensing Authority.'
            })
        elif demerit.suspension_status == 'revoked':
            warnings.append({
                'level': 'critical',
                'message': f'License revoked. {demerit.current_demerit_points} demerit points. Requires reapplication.'
            })
        elif demerit.suspension_status == 'warning':
            warnings.append({
                'level': 'warning',
                'message': f'Warning: {demerit.current_demerit_points} demerit points. {demerit.THRESHOLD_SUSPENSION - demerit.current_demerit_points} points until suspension.'
            })
        elif demerit.current_demerit_points >= demerit.THRESHOLD_WARNING:
            warnings.append({
                'level': 'info',
                'message': f'Approaching suspension threshold. Stay violation-free to prevent license suspension.'
            })
        
        return warnings
    
    # =========================================================================
    # BLA SYNC METHODS
    # =========================================================================
    
    @staticmethod
    def sync_with_bla(government_id, national_id=None, driver_license=None,
                       profile_id=None):
        """
        Sync point status with Licensing Authority (BLA)
        
        Placeholder for actual BLA API integration.
        In production, this would:
        1. Send current point status to BLA
        2. Receive any updates from BLA
        3. Apply changes locally
        
        Args:
            government_id: Government ID
            national_id: National ID
            driver_license: Driver license
            profile_id: CitizenProfile ID
        
        Returns:
            dict: Sync result
        """
        # Get full status
        status = MeritDemeritService.get_full_points_status(
            government_id, national_id=national_id,
            driver_license=driver_license, profile_id=profile_id
        )
        
        if 'error' in status:
            return {'success': False, 'error': status['error']}
        
        # Placeholder for BLA API call
        # In production:
        # bla_response = requests.post(
        #     f"{BLA_API_URL}/sync/points",
        #     json={
        #         'national_id': national_id,
        #         'demerit_points': status['demerit']['current_demerit_points'],
        #         'merit_points': status['merit']['current_merit_points'] if status['merit'] else 0,
        #         'is_suspended': status['suspension_status']['is_suspended']
        #     },
        #     headers={'Authorization': f'Bearer {BLA_API_KEY}'}
        # )
        
        return {
            'success': True,
            'synced': True,
            'timestamp': datetime.utcnow().isoformat(),
            'local_status': status,
            'bla_sync_pending': True  # Would be False after actual API call
        }
    
    # =========================================================================
    # OFFENCE POINTS LOOKUP
    # =========================================================================
    
    @staticmethod
    def get_offence_points(offence_code, offence_id=None, measured_value=None):
        """
        Get point value for an offence
        
        Args:
            offence_code: Offence code (e.g., 'SPEEDING_MINOR')
            offence_id: Offence ID from database
            measured_value: Measured value (speed, BAC, etc.)
        
        Returns:
            dict: Points and fine information
        """
        # Try database first
        if offence_id:
            offence = Offence.query.get(offence_id)
            if offence:
                penalty = offence.get_active_penalty_rule(measured_value)
                if penalty:
                    return {
                        'points': penalty.points,
                        'fine_min': float(penalty.base_fine),
                        'fine_max': float(penalty.calculate_fine(is_repeat_offence=True)),
                        'court_required': penalty.court_required,
                        'offence_code': offence.code,
                        'offence_name': offence.name
                    }
        
        # Fall back to defaults
        if offence_code and offence_code.lower() in MeritDemeritService.DEFAULT_OFFENCE_POINTS:
            defaults = MeritDemeritService.DEFAULT_OFFENCE_POINTS[offence_code.lower()]
            return {
                'points': defaults['points'],
                'fine_min': defaults['fine_min'],
                'fine_max': defaults['fine_max'],
                'court_required': defaults.get('court_required', False),
                'offence_code': offence_code,
                'source': 'default'
            }
        
        return {
            'points': 3,  # Default
            'fine_min': 300,
            'fine_max': 500,
            'court_required': False,
            'offence_code': offence_code,
            'source': 'default'
        }
    
    # =========================================================================
    # TRANSACTION HISTORY
    # =========================================================================
    
    @staticmethod
    def get_points_history(government_id, national_id=None, driver_license=None,
                            profile_id=None, point_type=None, status=None,
                            limit=100, offset=0):
        """
        Get points transaction history
        
        Args:
            government_id: Government ID
            national_id: National ID
            driver_license: Driver license
            profile_id: CitizenProfile ID
            point_type: Filter by type ('merit', 'demerit')
            status: Filter by status ('active', 'expired', 'voided')
            limit: Max records
            offset: Pagination offset
        
        Returns:
            dict: Paginated history
        """
        # Get profile
        if profile_id:
            profile = CitizenProfile.query.get(profile_id)
        else:
            profile = CitizenProfile.query.filter(
                CitizenProfile.government_id == government_id,
                (
                    (national_id and CitizenProfile.national_id_hash == CitizenProfile.hash_identifier(national_id)) |
                    (driver_license and CitizenProfile.driver_license_hash == CitizenProfile.hash_identifier(driver_license))
                )
            ).first()
        
        if not profile:
            return {'error': 'Profile not found', 'history': [], 'total': 0}
        
        # Build query
        query = PointsHistory.query.filter(
            PointsHistory.citizen_profile_id == profile.id
        )
        
        if point_type:
            query = query.filter(PointsHistory.point_type == point_type)
        
        if status:
            query = query.filter(PointsHistory.status == status)
        
        # Get total
        total = query.count()
        
        # Apply pagination
        history = query.order_by(
            PointsHistory.created_at.desc()
        ).offset(offset).limit(limit).all()
        
        return {
            'history': [h.to_dict() for h in history],
            'total': total,
            'limit': limit,
            'offset': offset
        }

