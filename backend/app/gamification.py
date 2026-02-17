"""
Gamification Service - Core business logic for gamification features
Handles points, badges, rewards, leaderboards, and early payment discounts
"""

from . import db
from .gamification_models import (
    CitizenProfile, Badge, CitizenBadge, Reward, CitizenReward,
    PointTransaction, Leaderboard, LeaderboardEntry, EarlyPaymentDiscount
)
from datetime import datetime, timedelta
from decimal import Decimal
import hashlib


class GamificationService:
    """Service for managing gamification features"""
    
    @staticmethod
    def get_or_create_citizen_profile(government_id, national_id=None, driver_license=None, 
                                      email=None, phone=None, full_name=None):
        """
        Get or create citizen profile
        
        Args:
            government_id: Government ID
            national_id: National ID (will be hashed)
            driver_license: Driver license (will be hashed)
            email: Email address
            phone: Phone number
            full_name: Full name
        
        Returns:
            CitizenProfile: Citizen profile instance
        """
        # Hash identifiers for privacy
        national_id_hash = CitizenProfile.hash_identifier(national_id) if national_id else None
        driver_license_hash = CitizenProfile.hash_identifier(driver_license) if driver_license else None
        
        if not national_id_hash and not driver_license_hash:
            return None
        
        # Try to find existing profile
        profile = None
        if national_id_hash:
            profile = CitizenProfile.query.filter_by(
                government_id=government_id,
                national_id_hash=national_id_hash
            ).first()
        
        if not profile and driver_license_hash:
            profile = CitizenProfile.query.filter_by(
                government_id=government_id,
                driver_license_hash=driver_license_hash
            ).first()
        
        # Create new profile if not found
        if not profile:
            profile = CitizenProfile(
                government_id=government_id,
                national_id_hash=national_id_hash,
                driver_license_hash=driver_license_hash,
                email=email,
                phone=phone,
                full_name=full_name
            )
            db.session.add(profile)
            db.session.flush()
        else:
            # Update contact info if provided
            if email and not profile.email:
                profile.email = email
            if phone and not profile.phone:
                profile.phone = phone
            if full_name and not profile.full_name:
                profile.full_name = full_name
        
        return profile
    
    @staticmethod
    def calculate_early_payment_discount(ticket, payment_date=None):
        """
        Calculate early payment discount for a ticket
        
        Args:
            ticket: Ticket instance
            payment_date: Payment date (default: now)
        
        Returns:
            dict: {
                'discount_amount': Decimal,
                'discount_percentage': Decimal,
                'points_bonus': int,
                'days_early': int,
                'tier_name': str
            }
        """
        if not payment_date:
            payment_date = datetime.utcnow()
        
        days_early = (ticket.due_date - payment_date).days
        
        if days_early <= 0:
            return {
                'discount_amount': Decimal('0'),
                'discount_percentage': Decimal('0'),
                'points_bonus': 0,
                'days_early': 0,
                'tier_name': None
            }
        
        # Find active early payment discount config
        discount_config = EarlyPaymentDiscount.query.filter_by(
            government_id=ticket.government_id,
            is_active=True
        ).filter(
            EarlyPaymentDiscount.effective_from <= payment_date.date()
        ).filter(
            db.or_(
                EarlyPaymentDiscount.effective_to == None,
                EarlyPaymentDiscount.effective_to >= payment_date.date()
            )
        ).first()
        
        if not discount_config:
            return {
                'discount_amount': Decimal('0'),
                'discount_percentage': Decimal('0'),
                'points_bonus': 0,
                'days_early': days_early,
                'tier_name': None
            }
        
        # Calculate discount based on config
        config = discount_config.get_discount_config()
        points_config = discount_config.get_points_bonus_config()
        
        discount_amount = Decimal('0')
        discount_percentage = Decimal('0')
        points_bonus = 0
        tier_name = None
        
        if discount_config.discount_type == 'tiered' and 'tiers' in config:
            # Find applicable tier (sorted by days ascending)
            for tier in sorted(config['tiers'], key=lambda x: x['days']):
                if days_early <= tier['days']:
                    discount_percentage = Decimal(str(tier.get('discount_percentage', 0)))
                    discount_amount = (ticket.fine_amount * discount_percentage) / 100
                    points_bonus = tier.get('points_bonus', 0)
                    tier_name = tier.get('label', f"{tier['days']} days")
                    break
        
        return {
            'discount_amount': discount_amount,
            'discount_percentage': discount_percentage,
            'points_bonus': points_bonus,
            'days_early': days_early,
            'tier_name': tier_name
        }
    
    @staticmethod
    def award_payment_points(ticket, citizen_profile):
        """
        Award points for paying a ticket
        
        Args:
            ticket: Ticket instance
            citizen_profile: CitizenProfile instance
        
        Returns:
            int: Points awarded
        """
        if not citizen_profile:
            return 0
        
        # Base points for payment
        base_points = 10
        
        # Bonus for early payment (already calculated in discount)
        early_payment_bonus = ticket.points_earned if hasattr(ticket, 'points_earned') and ticket.points_earned else 0
        
        # Bonus for on-time payment
        on_time_bonus = 5 if datetime.utcnow() <= ticket.due_date else 0
        
        total_points = base_points + early_payment_bonus + on_time_bonus
        
        # Award points
        citizen_profile.award_points(
            points=total_points,
            source_type='ticket_payment',
            source_id=ticket.id,
            description=f"Payment for ticket {ticket.serial_number}"
        )
        
        # Update payment streak
        if datetime.utcnow() <= ticket.due_date:
            citizen_profile.on_time_payment_streak += 1
        else:
            citizen_profile.on_time_payment_streak = 0
        
        citizen_profile.last_payment_date = datetime.utcnow()
        citizen_profile.total_tickets_paid += 1
        citizen_profile.total_amount_paid += ticket.payment_amount or ticket.fine_amount
        
        if ticket.early_payment_discount_applied:
            citizen_profile.total_discounts_earned += ticket.early_payment_discount_applied
        
        return total_points
    
    @staticmethod
    def check_badge_eligibility(citizen_profile):
        """
        Check if citizen earned any new badges
        
        Args:
            citizen_profile: CitizenProfile instance
        
        Returns:
            list: List of newly earned badges
        """
        newly_earned = []
        
        # Get all active badges for this government
        all_badges = Badge.query.filter_by(
            government_id=citizen_profile.government_id,
            is_active=True
        ).all()
        
        # Get already earned badge IDs
        earned_badge_ids = [cb.badge_id for cb in citizen_profile.badges]
        
        for badge in all_badges:
            # Skip if already earned
            if badge.id in earned_badge_ids:
                continue
            
            # Check eligibility
            if badge.check_eligibility(citizen_profile):
                # Award badge
                citizen_badge = CitizenBadge(
                    citizen_profile_id=citizen_profile.id,
                    badge_id=badge.id,
                    earned_from_action='auto_check'
                )
                db.session.add(citizen_badge)
                
                # Award points for earning badge
                if badge.points_reward > 0:
                    citizen_profile.award_points(
                        points=badge.points_reward,
                        source_type='badge_earned',
                        source_id=badge.id,
                        description=f"Earned badge: {badge.name}"
                    )
                
                newly_earned.append(badge)
        
        return newly_earned
    
    @staticmethod
    def calculate_driving_score(citizen_profile):
        """
        Calculate and update citizen's driving score
        
        Args:
            citizen_profile: CitizenProfile instance
        
        Returns:
            int: Updated driving score
        """
        return citizen_profile.calculate_driving_score()
    
    @staticmethod
    def update_leaderboard(leaderboard):
        """
        Update a specific leaderboard's rankings
        
        Args:
            leaderboard: Leaderboard instance
        
        Returns:
            int: Number of entries updated
        """
        # Get all opted-in citizens for this government
        citizens = CitizenProfile.query.filter_by(
            government_id=leaderboard.government_id,
            is_active=True,
            opted_in_leaderboard=True
        ).all()
        
        # Calculate scores based on leaderboard type
        scores = []
        for citizen in citizens:
            score = 0
            if leaderboard.leaderboard_type == 'points':
                score = citizen.total_points
            elif leaderboard.leaderboard_type == 'driving_score':
                score = citizen.driving_score
            elif leaderboard.leaderboard_type == 'clean_streak':
                score = citizen.clean_driving_streak_days
            elif leaderboard.leaderboard_type == 'early_payments':
                score = citizen.on_time_payment_streak
            
            scores.append((citizen, score))
        
        # Sort by score descending
        scores.sort(key=lambda x: x[1], reverse=True)
        
        # Get existing entries for rank change tracking
        existing_entries = {
            entry.citizen_profile_id: entry 
            for entry in leaderboard.entries
        }
        
        # Clear existing entries
        LeaderboardEntry.query.filter_by(leaderboard_id=leaderboard.id).delete()
        
        # Create new entries
        for rank, (citizen, score) in enumerate(scores[:leaderboard.max_display_rank], start=1):
            previous_rank = existing_entries[citizen.id].rank if citizen.id in existing_entries else None
            rank_change = (previous_rank - rank) if previous_rank else 0
            
            # Generate display name (anonymized or citizen's choice)
            display_name = citizen.full_name if citizen.full_name else f"Citizen #{citizen.id}"
            
            entry = LeaderboardEntry(
                leaderboard_id=leaderboard.id,
                citizen_profile_id=citizen.id,
                rank=rank,
                score=score,
                display_name=display_name,
                previous_rank=previous_rank,
                rank_change=rank_change
            )
            db.session.add(entry)
        
        leaderboard.last_calculated_at = datetime.utcnow()
        
        return len(scores)
    
    @staticmethod
    def update_all_leaderboards(government_id):
        """
        Update all active leaderboards for a government
        
        Args:
            government_id: Government ID
        
        Returns:
            dict: Summary of updates
        """
        leaderboards = Leaderboard.query.filter_by(
            government_id=government_id,
            is_active=True
        ).all()
        
        summary = {
            'total_leaderboards': len(leaderboards),
            'updated': 0,
            'failed': 0
        }
        
        for leaderboard in leaderboards:
            try:
                GamificationService.update_leaderboard(leaderboard)
                summary['updated'] += 1
            except Exception as e:
                print(f"Failed to update leaderboard {leaderboard.id}: {e}")
                summary['failed'] += 1
        
        return summary
    
    @staticmethod
    def redeem_reward(citizen_profile, reward_id):
        """
        Redeem a reward using points
        
        Args:
            citizen_profile: CitizenProfile instance
            reward_id: Reward ID
        
        Returns:
            tuple: (success: bool, message: str, citizen_reward: CitizenReward or None)
        """
        reward = Reward.query.get(reward_id)
        
        if not reward:
            return False, "Reward not found", None
        
        if reward.government_id != citizen_profile.government_id:
            return False, "Reward not available in your region", None
        
        # Check eligibility
        can_redeem, message = reward.can_redeem(citizen_profile)
        if not can_redeem:
            return False, message, None
        
        # Deduct points
        citizen_profile.award_points(
            points=-reward.points_cost,
            source_type='reward_redeemed',
            source_id=reward.id,
            description=f"Redeemed: {reward.name}"
        )
        
        # Create citizen reward
        redemption_code = reward.generate_redemption_code()
        
        expires_at = None
        if reward.validity_days:
            expires_at = datetime.utcnow() + timedelta(days=reward.validity_days)
        
        citizen_reward = CitizenReward(
            citizen_profile_id=citizen_profile.id,
            reward_id=reward.id,
            points_spent=reward.points_cost,
            redemption_code=redemption_code,
            expires_at=expires_at
        )
        db.session.add(citizen_reward)
        
        # Update reward stats
        reward.total_redeemed += 1
        
        return True, "Reward redeemed successfully", citizen_reward
    
    @staticmethod
    def apply_reward_to_ticket(ticket, redemption_code):
        """
        Apply a redeemed reward to a ticket payment
        
        Args:
            ticket: Ticket instance
            redemption_code: Redemption code
        
        Returns:
            tuple: (success: bool, message: str, discount_amount: Decimal)
        """
        citizen_reward = CitizenReward.query.filter_by(
            redemption_code=redemption_code
        ).first()
        
        if not citizen_reward:
            return False, "Invalid redemption code", Decimal('0')
        
        if not citizen_reward.is_valid():
            return False, "Reward has expired or already been used", Decimal('0')
        
        reward = citizen_reward.reward
        
        # Calculate discount based on reward type
        discount_amount = Decimal('0')
        
        if reward.reward_type == 'discount':
            if reward.reward_value:
                # Fixed amount discount
                discount_amount = min(Decimal(str(reward.reward_value)), ticket.fine_amount)
            else:
                # Percentage discount (if configured)
                discount_amount = ticket.fine_amount * Decimal('0.1')  # Default 10%
        
        # Mark reward as used
        citizen_reward.mark_as_used(
            ticket_id=ticket.id,
            discount_amount=discount_amount
        )
        
        # Update ticket
        ticket.reward_code_used = redemption_code
        
        return True, "Reward applied successfully", discount_amount
    
    @staticmethod
    def update_citizen_streaks(government_id):
        """
        Update streaks for all citizens in a government
        
        Args:
            government_id: Government ID
        
        Returns:
            int: Number of citizens updated
        """
        citizens = CitizenProfile.query.filter_by(
            government_id=government_id,
            is_active=True
        ).all()
        
        for citizen in citizens:
            citizen.update_streaks()
        
        return len(citizens)
