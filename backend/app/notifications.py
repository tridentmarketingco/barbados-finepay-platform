"""
PayFine Notification System
Handles SMS and email notifications for tickets
"""

from datetime import datetime
import hashlib


def link_ticket_to_trident(ticket, trident_id, citizen_email=None, citizen_phone=None):
    """
    Link a ticket to Trident ID (National ID system)
    
    Args:
        ticket: Ticket object
        trident_id: National ID number
        citizen_email: Optional email
        citizen_phone: Optional phone
    
    Returns:
        dict: {'success': bool, 'message': str}
    """
    try:
        # Hash the Trident ID for privacy (never store raw National ID)
        hashed_id = hashlib.sha256(trident_id.encode()).hexdigest()
        
        # Store hashed reference
        ticket.national_id_reference = hashed_id
        ticket.national_id_verified = False  # Requires citizen verification
        
        # Store contact info if provided
        if citizen_email:
            ticket.citizen_email = citizen_email
        
        if citizen_phone:
            ticket.citizen_phone = citizen_phone
        
        # Generate QR code data
        ticket.qr_code_data = generate_qr_code_data(ticket.serial_number)
        
        return {
            'success': True,
            'message': 'Ticket linked to Trident ID successfully'
        }
        
    except Exception as e:
        return {
            'success': False,
            'message': f'Failed to link Trident ID: {str(e)}'
        }


def generate_qr_code_data(serial_number):
    """
    Generate QR code data for ticket
    
    Args:
        serial_number: Ticket serial number
    
    Returns:
        str: URL or data for QR code
    """
    # In production, this would be the actual payment URL
    # For now, return a placeholder
    return f"https://payfine.gov.bb/pay/{serial_number}"


def send_ticket_notification(ticket, notification_type='issued'):
    """
    Send notification to citizen about ticket
    
    Args:
        ticket: Ticket object
        notification_type: 'issued', 'reminder', 'overdue', 'late_fee'
    
    Returns:
        dict: {'success': bool, 'message': str, 'method': str}
    """
    try:
        # Check if we have contact info
        if not ticket.citizen_email and not ticket.citizen_phone:
            return {
                'success': False,
                'message': 'No contact information available'
            }
        
        # Determine notification method
        methods = []
        if ticket.citizen_email:
            methods.append('email')
        if ticket.citizen_phone:
            methods.append('sms')
        
        # In production, integrate with email/SMS service
        # For now, just log the notification
        
        # Build notification message based on type
        if notification_type == 'late_fee':
            subject = f'Late Fee Added - Ticket {ticket.serial_number}'
            message = (
                f'A late fee has been added to your ticket {ticket.serial_number}. '
                f'New total amount due: ${ticket.get_total_due():.2f}. '
                f'Please pay promptly to avoid additional fees.'
            )
        elif notification_type == 'overdue':
            subject = f'Overdue Notice - Ticket {ticket.serial_number}'
            message = (
                f'Your ticket {ticket.serial_number} is now overdue. '
                f'Amount due: ${ticket.get_total_due():.2f}. '
                f'Late fees may apply if not paid promptly.'
            )
        elif notification_type == 'reminder':
            subject = f'Payment Reminder - Ticket {ticket.serial_number}'
            message = (
                f'Reminder: Your ticket {ticket.serial_number} is due soon. '
                f'Amount due: ${ticket.get_total_due():.2f}. '
                f'Due date: {ticket.due_date.strftime("%Y-%m-%d")}.'
            )
        else:  # 'issued'
            subject = f'Ticket Issued - {ticket.serial_number}'
            message = (
                f'A ticket has been issued: {ticket.serial_number}. '
                f'Amount: ${ticket.fine_amount:.2f}. '
                f'Due date: {ticket.due_date.strftime("%Y-%m-%d")}.'
            )
        
        # Log notification (in production, send actual email/SMS)
        print(f"[NOTIFICATION] {notification_type.upper()} - {subject}")
        print(f"[NOTIFICATION] To: {ticket.citizen_email or ticket.citizen_phone}")
        print(f"[NOTIFICATION] Message: {message}")
        
        # Update ticket notification status
        ticket.notification_sent = True
        ticket.notification_sent_at = datetime.utcnow()
        ticket.notification_method = ','.join(methods)
        
        return {
            'success': True,
            'message': f'Notification sent via {", ".join(methods)}',
            'method': ','.join(methods),
            'notification_type': notification_type
        }
        
    except Exception as e:
        return {
            'success': False,
            'message': f'Failed to send notification: {str(e)}'
        }


def get_notification_status(ticket):
    """
    Get notification status for a ticket
    
    Args:
        ticket: Ticket object
    
    Returns:
        dict: Notification status details
    """
    return {
        'notification_sent': ticket.notification_sent,
        'notification_sent_at': ticket.notification_sent_at.isoformat() if ticket.notification_sent_at else None,
        'notification_method': ticket.notification_method,
        'has_email': bool(ticket.citizen_email),
        'has_phone': bool(ticket.citizen_phone),
        'can_notify': bool(ticket.citizen_email or ticket.citizen_phone)
    }
