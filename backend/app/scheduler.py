"""
PayFine Background Job Scheduler

Handles scheduled tasks like daily late fee processing.
Uses APScheduler for reliable background job execution.
"""

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime
from . import db
from .models import Government, Ticket, LateFeeConfiguration
from .late_fees import process_ticket_late_fees
from .notifications import send_ticket_notification
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = None


def process_late_fees_for_government(government_id):
    """
    Process late fees for all eligible tickets in a government
    
    Args:
        government_id: Government ID to process
    
    Returns:
        dict: Processing statistics
    """
    logger.info(f"Processing late fees for government: {government_id}")
    
    stats = {
        'government_id': government_id,
        'tickets_processed': 0,
        'fees_applied': 0,
        'total_fees_amount': 0,
        'notifications_sent': 0,
        'errors': []
    }
    
    try:
        # Check if late fees are enabled for this government
        config = LateFeeConfiguration.query.filter_by(
            government_id=government_id,
            enabled=True,
            active=True
        ).first()
        
        if not config:
            logger.info(f"Late fees not enabled for government {government_id}")
            return stats
        
        # Get all overdue tickets for this government
        overdue_tickets = Ticket.query.filter_by(
            government_id=government_id,
            status='overdue'
        ).filter(
            Ticket.late_fee_paused == False
        ).all()
        
        # Also check unpaid tickets that might be overdue
        unpaid_tickets = Ticket.query.filter_by(
            government_id=government_id,
            status='unpaid'
        ).filter(
            Ticket.late_fee_paused == False
        ).all()
        
        # Update status for unpaid tickets
        for ticket in unpaid_tickets:
            if ticket.is_overdue():
                ticket.status = 'overdue'
                overdue_tickets.append(ticket)
        
        logger.info(f"Found {len(overdue_tickets)} overdue tickets")
        
        # Process each ticket
        for ticket in overdue_tickets:
            try:
                stats['tickets_processed'] += 1
                
                # Calculate and apply late fee
                result = process_ticket_late_fees(ticket, commit=False)
                
                if result.get('applied'):
                    stats['fees_applied'] += 1
                    stats['total_fees_amount'] += float(result.get('fee_amount', 0))
                    
                    # Send notification about late fee
                    try:
                        notification_result = send_ticket_notification(ticket, 'late_fee')
                        if notification_result.get('success'):
                            stats['notifications_sent'] += 1
                    except Exception as notif_error:
                        logger.error(f"Failed to send notification for ticket {ticket.id}: {str(notif_error)}")
                        stats['errors'].append({
                            'ticket_id': ticket.id,
                            'error': f'Notification failed: {str(notif_error)}'
                        })
                
            except Exception as ticket_error:
                logger.error(f"Error processing ticket {ticket.id}: {str(ticket_error)}")
                stats['errors'].append({
                    'ticket_id': ticket.id,
                    'error': str(ticket_error)
                })
        
        # Commit all changes
        db.session.commit()
        
        logger.info(f"Late fee processing complete for government {government_id}: "
                   f"{stats['fees_applied']} fees applied, "
                   f"${stats['total_fees_amount']:.2f} total")
        
    except Exception as e:
        logger.error(f"Error processing late fees for government {government_id}: {str(e)}")
        db.session.rollback()
        stats['errors'].append({
            'government_id': government_id,
            'error': str(e)
        })
    
    return stats


def process_all_late_fees():
    """
    Daily job to process late fees for all governments
    
    Runs at 2 AM daily to calculate and apply late fees for all
    overdue tickets across all governments.
    """
    logger.info("=" * 80)
    logger.info(f"Starting daily late fee processing at {datetime.utcnow()}")
    logger.info("=" * 80)
    
    overall_stats = {
        'started_at': datetime.utcnow().isoformat(),
        'governments_processed': 0,
        'total_tickets_processed': 0,
        'total_fees_applied': 0,
        'total_fees_amount': 0,
        'total_notifications_sent': 0,
        'government_results': []
    }
    
    try:
        # Get all active governments
        governments = Government.query.filter_by(status='active').all()
        
        # Also include pilot governments
        pilot_governments = Government.query.filter_by(status='pilot').all()
        governments.extend(pilot_governments)
        
        logger.info(f"Processing {len(governments)} governments")
        
        # Process each government
        for government in governments:
            try:
                stats = process_late_fees_for_government(government.id)
                
                overall_stats['governments_processed'] += 1
                overall_stats['total_tickets_processed'] += stats['tickets_processed']
                overall_stats['total_fees_applied'] += stats['fees_applied']
                overall_stats['total_fees_amount'] += stats['total_fees_amount']
                overall_stats['total_notifications_sent'] += stats['notifications_sent']
                overall_stats['government_results'].append(stats)
                
            except Exception as gov_error:
                logger.error(f"Error processing government {government.id}: {str(gov_error)}")
                overall_stats['government_results'].append({
                    'government_id': government.id,
                    'error': str(gov_error)
                })
        
        overall_stats['completed_at'] = datetime.utcnow().isoformat()
        
        logger.info("=" * 80)
        logger.info(f"Daily late fee processing complete:")
        logger.info(f"  Governments: {overall_stats['governments_processed']}")
        logger.info(f"  Tickets processed: {overall_stats['total_tickets_processed']}")
        logger.info(f"  Fees applied: {overall_stats['total_fees_applied']}")
        logger.info(f"  Total amount: ${overall_stats['total_fees_amount']:.2f}")
        logger.info(f"  Notifications sent: {overall_stats['total_notifications_sent']}")
        logger.info("=" * 80)
        
    except Exception as e:
        logger.error(f"Critical error in daily late fee processing: {str(e)}")
        overall_stats['critical_error'] = str(e)
        overall_stats['completed_at'] = datetime.utcnow().isoformat()
    
    return overall_stats


def init_scheduler(app):
    """
    Initialize the background scheduler
    
    Sets up APScheduler with the Flask app context.
    Schedules the daily late fee processing job.
    
    Args:
        app: Flask application instance
    """
    global scheduler
    
    if scheduler is not None:
        logger.warning("Scheduler already initialized")
        return scheduler
    
    logger.info("Initializing background scheduler...")
    
    # Create scheduler
    scheduler = BackgroundScheduler(daemon=True)
    
    # Wrap job in app context
    def job_with_context():
        with app.app_context():
            process_all_late_fees()
    
    # Schedule daily late fee processing at 2 AM
    scheduler.add_job(
        func=job_with_context,
        trigger=CronTrigger(hour=2, minute=0),  # 2:00 AM daily
        id='daily_late_fee_processing',
        name='Daily Late Fee Processing',
        replace_existing=True
    )
    
    # Start scheduler
    scheduler.start()
    
    logger.info("Background scheduler started successfully")
    logger.info("Scheduled jobs:")
    for job in scheduler.get_jobs():
        logger.info(f"  - {job.name} (ID: {job.id}): {job.trigger}")
    
    return scheduler


def shutdown_scheduler():
    """
    Shutdown the background scheduler gracefully
    """
    global scheduler
    
    if scheduler is not None:
        logger.info("Shutting down background scheduler...")
        scheduler.shutdown(wait=True)
        scheduler = None
        logger.info("Background scheduler shut down successfully")


def get_scheduler():
    """
    Get the global scheduler instance
    
    Returns:
        BackgroundScheduler or None
    """
    return scheduler


def trigger_late_fee_processing_now(government_id=None):
    """
    Manually trigger late fee processing immediately
    
    Useful for testing or admin-triggered processing.
    
    Args:
        government_id: Optional government ID to process only one government
    
    Returns:
        dict: Processing statistics
    """
    logger.info(f"Manual late fee processing triggered for government: {government_id or 'ALL'}")
    
    if government_id:
        return process_late_fees_for_government(government_id)
    else:
        return process_all_late_fees()
