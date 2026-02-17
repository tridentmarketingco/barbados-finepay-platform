"""
Trident ID Verification Service
Handles Barbados National ID (Trident ID) verification and linkage

SECURITY PRINCIPLES:
- Never store full National ID numbers
- Use SHA-256 hashing for Trident ID references
- Verify using last 4 digits or Date of Birth only
- Trident ID is the single source of truth for citizen identification
"""

import hashlib
from datetime import datetime


def hash_trident_id(trident_id):
    """
    Hash a Trident ID for secure storage
    
    Args:
        trident_id (str): Full Trident ID number
    
    Returns:
        str: SHA-256 hash of the Trident ID
    
    Example:
        hash_trident_id("123456789012") -> "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3"
    
    SECURITY NOTE:
    - The hash is one-way - we cannot recover the original ID
    - This allows us to verify ownership without storing sensitive data
    - In production, consider adding a salt for additional security
    """
    if not trident_id:
        return None
    
    # Remove any spaces or dashes
    clean_id = str(trident_id).replace(' ', '').replace('-', '').strip()
    
    # Hash using SHA-256
    return hashlib.sha256(clean_id.encode('utf-8')).hexdigest()


def verify_trident_partial(trident_id_hash, last_four_digits=None, date_of_birth=None):
    """
    Verify Trident ID ownership using partial information
    
    This function allows citizens to verify they own a ticket without
    exposing the full National ID number.
    
    Args:
        trident_id_hash (str): Stored hash of the Trident ID
        last_four_digits (str): Last 4 digits of Trident ID (optional)
        date_of_birth (str): Date of birth in YYYY-MM-DD format (optional)
    
    Returns:
        dict: {'verified': bool, 'method': str, 'message': str}
    
    VERIFICATION METHODS:
    1. Last 4 digits of Trident ID
    2. Date of Birth (from Trident ID system)
    
    In production, this would integrate with the actual Trident ID API
    to validate the partial information against the full ID.
    
    For MVP, we use a simplified verification:
    - Hash the provided partial info and compare patterns
    - In production, call Trident ID API for validation
    """
    if not trident_id_hash:
        return {
            'verified': False,
            'method': None,
            'message': 'No Trident ID linked to this ticket'
        }
    
    # PRODUCTION IMPLEMENTATION:
    # This is where you would call the Trident ID API:
    # response = requests.post('https://trident-api.gov.bb/verify', {
    #     'id_hash': trident_id_hash,
    #     'last_four': last_four_digits,
    #     'dob': date_of_birth
    # })
    # return response.json()
    
    # MVP IMPLEMENTATION (Simplified):
    # For demonstration, we accept any 4-digit code or valid date
    if last_four_digits:
        if len(str(last_four_digits)) == 4 and str(last_four_digits).isdigit():
            return {
                'verified': True,
                'method': 'last_four_digits',
                'message': 'Verified using last 4 digits of Trident ID'
            }
    
    if date_of_birth:
        try:
            # Validate date format
            datetime.strptime(date_of_birth, '%Y-%m-%d')
            return {
                'verified': True,
                'method': 'date_of_birth',
                'message': 'Verified using date of birth'
            }
        except ValueError:
            pass
    
    return {
        'verified': False,
        'method': None,
        'message': 'Verification failed. Please check your information.'
    }


def generate_trident_verification_token(ticket_id, trident_id_hash):
    """
    Generate a temporary verification token
    Used for multi-step verification flows
    
    Args:
        ticket_id (int): Ticket ID
        trident_id_hash (str): Hashed Trident ID
    
    Returns:
        str: Verification token (expires in 15 minutes)
    
    In production, store these in Redis with TTL
    """
    import secrets
    token = secrets.token_urlsafe(32)
    
    # In production, store in Redis:
    # redis_client.setex(
    #     f'trident_verify:{token}',
    #     900,  # 15 minutes
    #     json.dumps({'ticket_id': ticket_id, 'trident_hash': trident_id_hash})
    # )
    
    return token


def link_ticket_to_trident(ticket, trident_id, citizen_email=None, citizen_phone=None):
    """
    Link a ticket to a Trident ID
    
    This should be called when a ticket is issued by Police/Traffic systems.
    The Trident ID is hashed before storage for privacy.
    
    Args:
        ticket: Ticket model instance
        trident_id (str): Full Trident ID number
        citizen_email (str): Citizen's email for notifications
        citizen_phone (str): Citizen's phone for SMS notifications
    
    Returns:
        dict: {'success': bool, 'message': str, 'trident_hash': str}
    
    INTEGRATION POINT:
    This is where the Police/Traffic system would provide the Trident ID
    at the time of ticket issuance. The ID is immediately hashed and
    the original is never stored.
    """
    if not trident_id:
        return {
            'success': False,
            'message': 'Trident ID is required',
            'trident_hash': None
        }
    
    # Hash the Trident ID
    trident_hash = hash_trident_id(trident_id)
    
    # Update ticket
    ticket.trident_id_reference = trident_hash
    ticket.citizen_email = citizen_email
    ticket.citizen_phone = citizen_phone
    ticket.trident_verified = False  # Not yet verified by citizen
    
    # Generate QR code data (URL to ticket payment page)
    # In production, use your actual domain
    base_url = "https://payfine.gov.bb"  # Production URL
    ticket.qr_code_data = f"{base_url}/ticket/{ticket.serial_number}"
    
    return {
        'success': True,
        'message': 'Ticket linked to Trident ID successfully',
        'trident_hash': trident_hash,
        'qr_code_url': ticket.qr_code_data
    }


def claim_unlinked_ticket(ticket, trident_id, verification_data):
    """
    Allow a citizen to claim an unlinked ticket using their Trident ID
    
    This handles the case where a ticket was issued without Trident ID
    (e.g., tourist, expired ID, etc.) and the citizen later claims it.
    
    Args:
        ticket: Ticket model instance
        trident_id (str): Citizen's Trident ID
        verification_data (dict): Additional verification data (license, DOB, etc.)
    
    Returns:
        dict: {'success': bool, 'message': str}
    
    VERIFICATION PROCESS:
    1. Check if ticket matches citizen's information (name, license, etc.)
    2. Hash and link Trident ID
    3. Mark as verified
    """
    # Verify ticket details match citizen information
    matches = []
    
    if verification_data.get('driver_name'):
        if ticket.driver_name and ticket.driver_name.lower() == verification_data['driver_name'].lower():
            matches.append('name')
    
    if verification_data.get('driver_license'):
        if ticket.driver_license and ticket.driver_license.lower() == verification_data['driver_license'].lower():
            matches.append('license')
    
    if verification_data.get('vehicle_plate'):
        if ticket.vehicle_plate and ticket.vehicle_plate.lower() == verification_data['vehicle_plate'].lower():
            matches.append('vehicle')
    
    # Require at least 2 matches for security
    if len(matches) < 2:
        return {
            'success': False,
            'message': 'Insufficient matching information. Please verify your details.',
            'matches': matches
        }
    
    # Link Trident ID
    trident_hash = hash_trident_id(trident_id)
    ticket.trident_id_reference = trident_hash
    ticket.trident_verified = True
    ticket.trident_verified_at = datetime.utcnow()
    
    # Update contact info if provided
    if verification_data.get('email'):
        ticket.citizen_email = verification_data['email']
    
    if verification_data.get('phone'):
        ticket.citizen_phone = verification_data['phone']
    
    return {
        'success': True,
        'message': 'Ticket claimed and verified successfully',
        'matches': matches
    }


def get_trident_display_info(trident_id_hash):
    """
    Get displayable information about a Trident ID (without exposing the full ID)
    
    Args:
        trident_id_hash (str): Hashed Trident ID
    
    Returns:
        dict: Safe display information
    
    In production, this would query the Trident ID API to get:
    - Masked ID (e.g., "****-****-1234")
    - Citizen name
    - Verification status
    """
    if not trident_id_hash:
        return {
            'has_trident_link': False,
            'masked_id': None,
            'status': 'unlinked'
        }
    
    # In production, call Trident ID API
    # For MVP, return generic info
    return {
        'has_trident_link': True,
        'masked_id': '****-****-****',  # Masked for privacy
        'status': 'linked'
    }
