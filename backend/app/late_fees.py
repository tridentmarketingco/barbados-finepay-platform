"""
PayFine Late Fees Auto-Calculation Engine

Handles automatic calculation and application of late fees for overdue tickets.
Supports multiple fee structures: flat, tiered, percentage, daily, and combination.

DESIGN PRINCIPLES:
1. Multi-tenant safe - all operations scoped by government_id
2. Configurable - all rules defined in database, no hardcoded values
3. Auditable - complete event log for every calculation
4. Transparent - detailed calculation breakdown stored
5. Flexible - supports global + per-offence/category overrides
"""

from datetime import datetime, timedelta
from decimal import Decimal
from . import db
from .models import (
    Ticket, LateFeeConfiguration, LateFeeRule, LateFeeEvent,
    Offence, OffenceCategory, TicketChallenge
)
from sqlalchemy import and_, or_


# ============================================================================
# RULE SELECTION
# ============================================================================

def get_applicable_rule(ticket):
    """
    Get the applicable late fee rule for a ticket
    
    Priority order:
    1. Offence-specific rule (if ticket has offence_id)
    2. Category-specific rule (if ticket's offence has category)
    3. Global configuration
    
    Args:
        ticket: Ticket object
    
    Returns:
        tuple: (rule_or_config, rule_type)
            - rule_or_config: LateFeeRule or LateFeeConfiguration object
            - rule_type: 'offence_rule', 'category_rule', or 'global_config'
    """
    government_id = ticket.government_id
    today = datetime.utcnow().date()
    
    # Try offence-specific rule first
    if ticket.offence_id:
        offence_rule = LateFeeRule.query.filter(
            LateFeeRule.government_id == government_id,
            LateFeeRule.offence_id == ticket.offence_id,
            LateFeeRule.enabled == True,
            LateFeeRule.active == True,
            LateFeeRule.effective_from <= today
        ).filter(
            or_(
                LateFeeRule.effective_to == None,
                LateFeeRule.effective_to >= today
            )
        ).order_by(LateFeeRule.priority.desc()).first()
        
        if offence_rule:
            return (offence_rule, 'offence_rule')
    
    # Try category-specific rule
    if ticket.offence_id:
        offence = Offence.query.get(ticket.offence_id)
        if offence and offence.category_id:
            category_rule = LateFeeRule.query.filter(
                LateFeeRule.government_id == government_id,
                LateFeeRule.offence_category_id == offence.category_id,
                LateFeeRule.offence_id == None,  # Category rule, not offence-specific
                LateFeeRule.enabled == True,
                LateFeeRule.active == True,
                LateFeeRule.effective_from <= today
            ).filter(
                or_(
                    LateFeeRule.effective_to == None,
                    LateFeeRule.effective_to >= today
                )
            ).order_by(LateFeeRule.priority.desc()).first()
            
            if category_rule:
                return (category_rule, 'category_rule')
    
    # Fall back to global configuration
    global_config = LateFeeConfiguration.query.filter_by(
        government_id=government_id,
        enabled=True,
        active=True
    ).first()
    
    if global_config:
        return (global_config, 'global_config')
    
    return (None, None)


# ============================================================================
# ELIGIBILITY CHECKS
# ============================================================================

def should_calculate_late_fee(ticket):
    """
    Determine if a late fee should be calculated for this ticket
    
    Late fees are NOT calculated if:
    - Ticket is already paid, voided, or refunded
    - Ticket is not overdue
    - Late fees are paused for this ticket
    - Ticket has an active challenge and pause_during_dispute is enabled
    - No applicable rule/config found
    - Already calculated today (prevent duplicates)
    
    Args:
        ticket: Ticket object
    
    Returns:
        tuple: (should_calculate: bool, reason: str)
    """
    # Check ticket status
    if ticket.status in ['paid', 'voided', 'refunded', 'dismissed']:
        return (False, f'Ticket status is {ticket.status}')
    
    # Check if overdue
    if not ticket.is_overdue():
        return (False, 'Ticket is not overdue')
    
    # Check if late fees are paused
    if ticket.late_fee_paused:
        return (False, 'Late fees are paused for this ticket')
    
    # Get applicable rule
    rule, rule_type = get_applicable_rule(ticket)
    if not rule:
        return (False, 'No late fee configuration found')
    
    # Check grace period
    days_overdue = ticket.days_overdue()
    grace_period = rule.grace_period_days
    if days_overdue <= grace_period:
        return (False, f'Still in grace period ({days_overdue}/{grace_period} days)')
    
    # Check if ticket has active challenge and pause_during_dispute is enabled
    if rule.pause_during_dispute:
        if hasattr(ticket, 'challenge') and ticket.challenge:
            if ticket.challenge.status in ['Pending', 'UnderReview']:
                return (False, 'Ticket has active challenge and pause_during_dispute is enabled')
    
    # Check if already calculated today (prevent duplicates)
    if ticket.last_late_fee_calculated_at:
        last_calc_date = ticket.last_late_fee_calculated_at.date()
        today = datetime.utcnow().date()
        if last_calc_date == today:
            return (False, 'Late fee already calculated today')
    
    return (True, 'Eligible for late fee calculation')


# ============================================================================
# FEE STRUCTURE CALCULATORS
# ============================================================================

def calculate_flat_fee(ticket, rule, config, days_overdue):
    """
    Calculate flat fee structure
    
    Config format: {"amount": 25, "after_days": 15}
    Applies a fixed amount after X days overdue
    
    Returns:
        tuple: (fee_amount: Decimal, details: dict)
    """
    amount = Decimal(str(config.get('amount', 0)))
    after_days = config.get('after_days', 0)
    
    # Check if we've passed the threshold
    if days_overdue < after_days:
        return (Decimal('0'), {
            'structure': 'flat',
            'amount': float(amount),
            'after_days': after_days,
            'days_overdue': days_overdue,
            'applied': False,
            'reason': f'Not yet {after_days} days overdue'
        })
    
    # Check if already applied (look for existing event with this structure)
    existing_flat_fee = LateFeeEvent.query.filter_by(
        ticket_id=ticket.id,
        fee_structure_type='flat',
        waived=False
    ).first()
    
    if existing_flat_fee:
        return (Decimal('0'), {
            'structure': 'flat',
            'amount': float(amount),
            'after_days': after_days,
            'days_overdue': days_overdue,
            'applied': False,
            'reason': 'Flat fee already applied',
            'previous_event_id': existing_flat_fee.id
        })
    
    return (amount, {
        'structure': 'flat',
        'amount': float(amount),
        'after_days': after_days,
        'days_overdue': days_overdue,
        'applied': True
    })


def calculate_tiered_fee(ticket, rule, config, days_overdue):
    """
    Calculate tiered fee structure
    
    Config format: {"tiers": [{"days": 15, "amount": 25}, {"days": 45, "amount": 50}]}
    Applies different flat fees at different day thresholds
    
    Returns:
        tuple: (fee_amount: Decimal, details: dict)
    """
    tiers = config.get('tiers', [])
    if not tiers:
        return (Decimal('0'), {
            'structure': 'tiered',
            'error': 'No tiers configured'
        })
    
    # Sort tiers by days
    sorted_tiers = sorted(tiers, key=lambda t: t.get('days', 0))
    
    # Find applicable tier
    applicable_tier = None
    for tier in sorted_tiers:
        if days_overdue >= tier.get('days', 0):
            applicable_tier = tier
    
    if not applicable_tier:
        return (Decimal('0'), {
            'structure': 'tiered',
            'tiers': tiers,
            'days_overdue': days_overdue,
            'applied': False,
            'reason': 'No tier threshold reached'
        })
    
    tier_days = applicable_tier.get('days', 0)
    tier_amount = Decimal(str(applicable_tier.get('amount', 0)))
    
    # Check if this tier already applied
    existing_tier_fee = LateFeeEvent.query.filter_by(
        ticket_id=ticket.id,
        fee_structure_type='tiered',
        waived=False
    ).filter(
        LateFeeEvent.calculation_details.like(f'%"tier_days": {tier_days}%')
    ).first()
    
    if existing_tier_fee:
        return (Decimal('0'), {
            'structure': 'tiered',
            'tier_days': tier_days,
            'tier_amount': float(tier_amount),
            'days_overdue': days_overdue,
            'applied': False,
            'reason': f'Tier at {tier_days} days already applied',
            'previous_event_id': existing_tier_fee.id
        })
    
    return (tier_amount, {
        'structure': 'tiered',
        'tier_days': tier_days,
        'tier_amount': float(tier_amount),
        'all_tiers': tiers,
        'days_overdue': days_overdue,
        'applied': True
    })


def calculate_percentage_fee(ticket, rule, config, days_overdue):
    """
    Calculate percentage fee structure
    
    Config format: {"rate": 1.5, "period": "monthly", "compound": false}
    Applies percentage of unpaid balance per period
    
    Returns:
        tuple: (fee_amount: Decimal, details: dict)
    """
    rate = Decimal(str(config.get('rate', 0))) / Decimal('100')  # Convert to decimal
    period = config.get('period', 'monthly')  # 'daily', 'weekly', 'monthly'
    compound = config.get('compound', False)
    
    # Calculate number of periods elapsed
    if period == 'daily':
        periods = days_overdue
    elif period == 'weekly':
        periods = days_overdue // 7
    elif period == 'monthly':
        periods = days_overdue // 30
    else:
        return (Decimal('0'), {
            'structure': 'percentage',
            'error': f'Invalid period: {period}'
        })
    
    if periods == 0:
        return (Decimal('0'), {
            'structure': 'percentage',
            'rate': float(rate * 100),
            'period': period,
            'days_overdue': days_overdue,
            'periods': periods,
            'applied': False,
            'reason': 'No complete period elapsed'
        })
    
    # Determine base amount
    if rule.apply_to_original_only:
        base_amount = ticket.fine_amount
    else:
        base_amount = ticket.get_total_due()
    
    # Calculate fee
    if compound:
        # Compound interest formula: A = P(1 + r)^n - P
        fee_amount = base_amount * ((Decimal('1') + rate) ** periods - Decimal('1'))
    else:
        # Simple interest: A = P * r * n
        fee_amount = base_amount * rate * periods
    
    # Check how many periods already applied
    existing_events = LateFeeEvent.query.filter_by(
        ticket_id=ticket.id,
        fee_structure_type='percentage',
        waived=False
    ).all()
    
    periods_already_applied = len(existing_events)
    
    if periods_already_applied >= periods:
        return (Decimal('0'), {
            'structure': 'percentage',
            'rate': float(rate * 100),
            'period': period,
            'compound': compound,
            'base_amount': float(base_amount),
            'days_overdue': days_overdue,
            'periods': periods,
            'periods_already_applied': periods_already_applied,
            'applied': False,
            'reason': f'All {periods} periods already applied'
        })
    
    # Calculate fee for new periods only
    new_periods = periods - periods_already_applied
    if compound:
        # For compound, recalculate from scratch and subtract already applied
        total_fee = base_amount * ((Decimal('1') + rate) ** periods - Decimal('1'))
        already_applied_fee = sum(Decimal(str(e.fee_amount)) for e in existing_events)
        fee_amount = total_fee - already_applied_fee
    else:
        # For simple, just calculate new periods
        fee_amount = base_amount * rate * new_periods
    
    return (fee_amount, {
        'structure': 'percentage',
        'rate': float(rate * 100),
        'period': period,
        'compound': compound,
        'base_amount': float(base_amount),
        'days_overdue': days_overdue,
        'periods': periods,
        'new_periods': new_periods,
        'periods_already_applied': periods_already_applied,
        'fee_amount': float(fee_amount),
        'applied': True
    })


def calculate_daily_fee(ticket, rule, config, days_overdue):
    """
    Calculate daily accruing fee structure
    
    Config format: {"amount": 1, "max_days": 90}
    Applies fixed amount per day, optionally capped at max days
    
    Returns:
        tuple: (fee_amount: Decimal, details: dict)
    """
    daily_amount = Decimal(str(config.get('amount', 0)))
    max_days = config.get('max_days', None)
    
    # Calculate days to charge
    days_to_charge = days_overdue
    if max_days and days_to_charge > max_days:
        days_to_charge = max_days
    
    # Check how many days already charged
    existing_events = LateFeeEvent.query.filter_by(
        ticket_id=ticket.id,
        fee_structure_type='daily',
        waived=False
    ).all()
    
    days_already_charged = sum(e.days_overdue for e in existing_events)
    
    if days_already_charged >= days_to_charge:
        return (Decimal('0'), {
            'structure': 'daily',
            'daily_amount': float(daily_amount),
            'max_days': max_days,
            'days_overdue': days_overdue,
            'days_to_charge': days_to_charge,
            'days_already_charged': days_already_charged,
            'applied': False,
            'reason': f'All {days_to_charge} days already charged'
        })
    
    # Calculate fee for new days only
    new_days = days_to_charge - days_already_charged
    fee_amount = daily_amount * new_days
    
    return (fee_amount, {
        'structure': 'daily',
        'daily_amount': float(daily_amount),
        'max_days': max_days,
        'days_overdue': days_overdue,
        'days_to_charge': days_to_charge,
        'new_days': new_days,
        'days_already_charged': days_already_charged,
        'fee_amount': float(fee_amount),
        'applied': True
    })


def calculate_combination_fee(ticket, rule, config, days_overdue):
    """
    Calculate combination fee structure
    
    Config format: {"initial_flat": 25, "after_days": 15, "then_daily": 1, "max_days": 90}
    Applies initial flat fee, then daily accrual
    
    Returns:
        tuple: (fee_amount: Decimal, details: dict)
    """
    initial_flat = Decimal(str(config.get('initial_flat', 0)))
    after_days = config.get('after_days', 0)
    then_daily = Decimal(str(config.get('then_daily', 0)))
    max_days = config.get('max_days', None)
    
    total_fee = Decimal('0')
    details = {
        'structure': 'combination',
        'initial_flat': float(initial_flat),
        'after_days': after_days,
        'then_daily': float(then_daily),
        'max_days': max_days,
        'days_overdue': days_overdue,
        'components': []
    }
    
    # Check if initial flat fee should be applied
    if days_overdue >= after_days:
        # Check if flat already applied
        existing_flat = LateFeeEvent.query.filter_by(
            ticket_id=ticket.id,
            fee_structure_type='combination',
            waived=False
        ).filter(
            LateFeeEvent.calculation_details.like('%"component": "initial_flat"%')
        ).first()
        
        if not existing_flat:
            total_fee += initial_flat
            details['components'].append({
                'component': 'initial_flat',
                'amount': float(initial_flat),
                'applied': True
            })
        else:
            details['components'].append({
                'component': 'initial_flat',
                'amount': float(initial_flat),
                'applied': False,
                'reason': 'Already applied',
                'previous_event_id': existing_flat.id
            })
    
    # Calculate daily accrual after initial period
    if days_overdue > after_days:
        days_for_daily = days_overdue - after_days
        if max_days:
            days_for_daily = min(days_for_daily, max_days)
        
        # Check how many daily fees already applied
        existing_daily_events = LateFeeEvent.query.filter_by(
            ticket_id=ticket.id,
            fee_structure_type='combination',
            waived=False
        ).filter(
            LateFeeEvent.calculation_details.like('%"component": "daily"%')
        ).all()
        
        days_already_charged = sum(
            e.get_calculation_details().get('days_charged', 0) 
            for e in existing_daily_events
        )
        
        if days_already_charged < days_for_daily:
            new_days = days_for_daily - days_already_charged
            daily_fee = then_daily * new_days
            total_fee += daily_fee
            details['components'].append({
                'component': 'daily',
                'daily_amount': float(then_daily),
                'days_charged': new_days,
                'days_already_charged': days_already_charged,
                'amount': float(daily_fee),
                'applied': True
            })
        else:
            details['components'].append({
                'component': 'daily',
                'applied': False,
                'reason': f'All {days_for_daily} days already charged'
            })
    
    if total_fee == 0:
        details['applied'] = False
        details['reason'] = 'All components already applied'
    else:
        details['applied'] = True
        details['total_fee'] = float(total_fee)
    
    return (total_fee, details)


# ============================================================================
# MAIN CALCULATION ENGINE
# ============================================================================

def calculate_late_fee(ticket):
    """
    Calculate late fee for a ticket
    
    Main entry point for late fee calculation. Determines applicable rule,
    calculates fee based on structure type, applies caps, and returns result.
    
    Args:
        ticket: Ticket object
    
    Returns:
        dict: {
            'success': bool,
            'fee_amount': Decimal or None,
            'rule_type': str or None,
            'rule_id': int or None,
            'details': dict,
            'message': str
        }
    """
    # Check eligibility
    should_calc, reason = should_calculate_late_fee(ticket)
    if not should_calc:
        return {
            'success': False,
            'fee_amount': None,
            'message': reason,
            'details': {'eligible': False, 'reason': reason}
        }
    
    # Get applicable rule
    rule, rule_type = get_applicable_rule(ticket)
    if not rule:
        return {
            'success': False,
            'fee_amount': None,
            'message': 'No late fee configuration found',
            'details': {'eligible': True, 'error': 'No configuration'}
        }
    
    # Get configuration
    config = rule.get_config()
    fee_structure_type = rule.fee_structure_type
    days_overdue = ticket.days_overdue()
    
    # Calculate fee based on structure type
    calculators = {
        'flat': calculate_flat_fee,
        'tiered': calculate_tiered_fee,
        'percentage': calculate_percentage_fee,
        'daily': calculate_daily_fee,
        'combination': calculate_combination_fee
    }
    
    calculator = calculators.get(fee_structure_type)
    if not calculator:
        return {
            'success': False,
            'fee_amount': None,
            'message': f'Unknown fee structure type: {fee_structure_type}',
            'details': {'error': 'Invalid structure type'}
        }
    
    fee_amount, calc_details = calculator(ticket, rule, config, days_overdue)
    
    # Apply caps if configured
    if fee_amount > 0:
        original_fee = fee_amount
        
        # Absolute cap
        if rule.max_fee_cap_amount:
            max_absolute = Decimal(str(rule.max_fee_cap_amount))
            # Check total late fees including this one
            total_late_fees = (ticket.late_fees_added or Decimal('0')) + fee_amount
            if total_late_fees > max_absolute:
                fee_amount = max_absolute - (ticket.late_fees_added or Decimal('0'))
                if fee_amount < 0:
                    fee_amount = Decimal('0')
                calc_details['capped_by_absolute'] = {
                    'original': float(original_fee),
                    'cap': float(max_absolute),
                    'adjusted': float(fee_amount)
                }
        
        # Percentage cap
        if rule.max_fee_cap_percentage and fee_amount > 0:
            max_percentage = Decimal(str(rule.max_fee_cap_percentage)) / Decimal('100')
            max_by_percentage = ticket.fine_amount * max_percentage
            total_late_fees = (ticket.late_fees_added or Decimal('0')) + fee_amount
            if total_late_fees > max_by_percentage:
                fee_amount = max_by_percentage - (ticket.late_fees_added or Decimal('0'))
                if fee_amount < 0:
                    fee_amount = Decimal('0')
                calc_details['capped_by_percentage'] = {
                    'original': float(original_fee),
                    'cap_percentage': float(rule.max_fee_cap_percentage),
                    'cap_amount': float(max_by_percentage),
                    'adjusted': float(fee_amount)
                }
    
    # Round to 2 decimal places
    fee_amount = fee_amount.quantize(Decimal('0.01'))
    
    return {
        'success': True,
        'fee_amount': fee_amount,
        'rule_type': rule_type,
        'rule_id': rule.id if isinstance(rule, LateFeeRule) else None,
        'fee_structure_type': fee_structure_type,
        'details': calc_details,
        'message': f'Calculated ${fee_amount} late fee' if fee_amount > 0 else 'No new late fee to apply'
    }


def apply_late_fee(ticket, fee_amount, rule_type, rule_id, fee_structure_type, calculation_details):
    """
    Apply calculated late fee to ticket and create audit event
    
    Args:
        ticket: Ticket object
        fee_amount: Decimal amount to add
        rule_type: 'global_config', 'category_rule', or 'offence_rule'
        rule_id: ID of LateFeeRule (None for global config)
        fee_structure_type: Type of fee structure used
        calculation_details: Dict with calculation breakdown
    
    Returns:
        LateFeeEvent: Created event object
    """
    # Update ticket
    ticket.late_fees_added = (ticket.late_fees_added or Decimal('0')) + fee_amount
    ticket.last_late_fee_calculated_at = datetime.utcnow()
    
    # Update status to overdue if not already
    if ticket.status == 'unpaid':
        ticket.status = 'overdue'
    
    # Create audit event
    event = LateFeeEvent(
        ticket_id=ticket.id,
        calculated_at=datetime.utcnow(),
        fee_amount=fee_amount,
        days_overdue=ticket.days_overdue(),
        rule_type=rule_type,
        rule_id=rule_id,
        fee_structure_type=fee_structure_type
    )
    event.set_calculation_details(calculation_details)
    
    db.session.add(event)
    
    return event


def process_ticket_late_fees(ticket, commit=True):
    """
    Process late fees for a single ticket
    
    Calculates and applies late fee if eligible.
    
    Args:
        ticket: Ticket object
        commit: Whether to commit changes to database
    
    Returns:
        dict: Result of processing
    """
    result = calculate_late_fee(ticket)
    
    if not result['success']:
        return result
    
    fee_amount = result['fee_amount']
    
    if fee_amount <= 0:
        return {
            **result,
            'applied': False,
            'message': 'No new late fee to apply'
        }
    
    # Apply the fee
    event = apply_late_fee(
        ticket=ticket,
        fee_amount=fee_amount,
        rule_type=result['rule_type'],
        rule_id=result['rule_id'],
        fee_structure_type=result['fee_structure_type'],
        calculation_details=result['details']
    )
    
    if commit:
        db.session.commit()
    
    return {
        **result,
        'applied': True,
        'event_id': event.id,
        'new_total_due': float(ticket.get_total_due()),
        'message': f'Applied ${fee_amount} late fee. New total: ${ticket.get_total_due()}'
    }
