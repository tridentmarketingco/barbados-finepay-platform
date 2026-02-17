"""
PayFine API Routes - Multi-Tenant
Handles authentication, ticket lookup, and payment processing
"""

from flask import Blueprint, request, jsonify, g, current_app
from flask_jwt_extended import (
    create_access_token, 
    create_refresh_token,
    jwt_required, 
    get_jwt_identity,
    get_jwt
)
from . import db
from .models import User, Service, Ticket, TicketChallenge, Government
from .middleware import get_current_government, get_government_id
from .cache import invalidate_ticket_cache, invalidate_ticket_list_cache
from .audit import log_payment_attempt
from datetime import datetime, timedelta
import requests
import secrets
import os

api_bp = Blueprint('api', __name__)

# ============================================================================
# POWERTRANZ CONFIGURATION
# ============================================================================

def get_powertranz_config(government=None):
    """
    Get PowerTranz configuration dynamically per government
    """
    if government is None:
        try:
            government = get_current_government()
        except:
            base_url = os.getenv('POWERTRANZ_API_URL', 'https://staging.ptranz.com')
            merchant_id = os.getenv('POWERTRANZ_MERCHANT_ID', '88806220')
            password = os.getenv('POWERTRANZ_PASSWORD', '7eHpqRiS9f5Sv7GHwYV88KPMecr4mFFGxLCMxZru7OF')
            return {
                'merchant_id': merchant_id,
                'password': password,
                'base_url': base_url,
                'country_iso_code': 'BB',
                'currency_code': 'BBD'
            }
    
    config = government.get_payment_config()
    
    return {
        'merchant_id': config.get('merchant_id', os.getenv('POWERTRANZ_MERCHANT_ID')),
        'password': config.get('password', os.getenv('POWERTRANZ_PASSWORD')),
        'base_url': config.get('api_url', os.getenv('POWERTRANZ_API_URL', 'https://staging.ptranz.com')),
        'country_iso_code': government.country_iso_code,
        'currency_code': government.currency_code
    }


# ============================================================================
# AUTHENTICATION ROUTES
# ============================================================================

@api_bp.route('/login', methods=['POST'])
def login():
    """
    User login endpoint - Multi-tenant aware
    
    This endpoint is exempt from middleware government context injection
    because users don't have a JWT token yet. We resolve government manually.
    """
    try:
        data = request.get_json()
        
        if not data or not data.get('username') or not data.get('password'):
            return jsonify({'error': 'Username and password required'}), 400
        
        # Get government context - may come from subdomain, header, or default
        # Since /api/login is exempt from middleware, we need to resolve manually
        government = None
        resolution_method = None
        
        try:
            # Try to get from middleware (in case it was set)
            government = get_current_government()
            resolution_method = 'middleware'
        except RuntimeError:
            # Middleware didn't set it - resolve manually
            from .middleware import (
                resolve_government_from_subdomain,
                resolve_government_from_header,
                resolve_government_default
            )
            
            # Try subdomain first
            government = resolve_government_from_subdomain()
            if government:
                resolution_method = 'subdomain'
            
            # Try header if subdomain failed
            if not government:
                government = resolve_government_from_header()
                if government:
                    resolution_method = 'header'
            
            # Try default (development only) if both failed
            if not government:
                government = resolve_government_default()
                if government:
                    resolution_method = 'default'
            
            # If still no government, try to auto-create one for development
            if not government:
                import os
                if os.getenv('FLASK_ENV') == 'development':
                    print("⚠️  No government found - auto-creating default government for development")
                    
                    # Create a default government for development
                    government = Government(
                        government_name='Development Government',
                        country_name='Development',
                        country_iso_code='DEV',
                        currency_code='BBD',
                        timezone='America/Barbados',
                        legal_framework_version='Development v1.0',
                        payment_gateway_type='powertranz',
                        subdomain='dev',
                        contact_email='dev@payfine.local',
                        contact_phone='+1-000-000-0000',
                        status='active',
                        activated_at=datetime.utcnow()
                    )
                    
                    # Set default payment config
                    government.set_payment_config({
                        'merchant_id': '88806220',
                        'password': '7eHpqRiS9f5Sv7GHwYV88KPMecr4mFFGxLCMxZru7OF',
                        'api_url': 'https://staging.ptranz.com'
                    })
                    
                    db.session.add(government)
                    db.session.flush()  # Flush to get government.id
                    
                    # Also create a default admin user for this government
                    default_admin = User(
                        government_id=government.id,
                        username='admin',
                        email='admin@dev.local',
                        full_name='Development Admin',
                        role='admin',
                        is_admin=True,
                        is_active=True
                    )
                    default_admin.set_password('admin123')
                    db.session.add(default_admin)
                    
                    db.session.commit()
                    
                    print(f"✅ Auto-created development government (ID: {government.id})")
                    print(f"✅ Auto-created admin user: admin / admin123")
                    resolution_method = 'auto-created'
                else:
                    # Production - return detailed error
                    return jsonify({
                        'error': 'No active government found',
                        'message': 'Unable to determine government context. Please contact administrator.',
                        'hint': 'Ensure the database is properly seeded with at least one active government.',
                        'debug': {
                            'subdomain_checked': request.host,
                            'header_checked': request.headers.get('X-Government-ID'),
                            'environment': os.getenv('FLASK_ENV', 'production')
                        }
                    }), 400
        
        # Log government resolution for debugging
        print(f"🔐 Login attempt - Government: {government.government_name} (resolved via: {resolution_method})")
        
        # Look up user by username or email within this government
        user = User.query.filter(
            User.government_id == government.id,
            (User.username == data['username']) | (User.email == data['username'])
        ).first()
        
        if not user or not user.check_password(data['password']):
            return jsonify({
                'error': 'Invalid credentials',
                'message': 'Username or password is incorrect'
            }), 401
        
        if not user.is_active:
            return jsonify({
                'error': 'Account is inactive',
                'message': 'Your account has been deactivated. Please contact administrator.'
            }), 403
        
        # Update last login timestamp
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # Create JWT tokens with government context
        access_token = create_access_token(
            identity=user.id,
            additional_claims={'government_id': government.id}
        )
        refresh_token = create_refresh_token(
            identity=user.id,
            additional_claims={'government_id': government.id}
        )
        
        return jsonify({
            'message': 'Login successful',
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': user.to_dict(),
            'government': government.to_dict()
        }), 200
        
    except Exception as e:
        # Log the actual error for debugging
        import traceback
        print(f"Login error: {str(e)}")
        print(traceback.format_exc())
        
        return jsonify({
            'error': 'Login failed',
            'message': f'An unexpected error occurred: {str(e)}'
        }), 500


@api_bp.route('/register', methods=['POST'])
def register():
    """
    User registration - Multi-tenant aware
    """
    try:
        data = request.get_json()
        
        required_fields = ['username', 'email', 'password']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Username, email, and password required'}), 400
        
        government = get_current_government()
        
        if User.query.filter_by(government_id=government.id, username=data['username']).first():
            return jsonify({'error': 'Username already exists'}), 409
        
        if User.query.filter_by(government_id=government.id, email=data['email']).first():
            return jsonify({'error': 'Email already exists'}), 409
        
        user = User(
            government_id=government.id,
            username=data['username'],
            email=data['email'],
            full_name=data.get('full_name', '')
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'message': 'Registration successful',
            'user': user.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500


@api_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """
    Refresh access token using refresh token
    """
    try:
        current_user_id = get_jwt_identity()
        access_token = create_access_token(identity=current_user_id)
        
        return jsonify({
            'access_token': access_token
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Token refresh failed: {str(e)}'}), 500


# ============================================================================
# TICKET LOOKUP ROUTES
# ============================================================================

@api_bp.route('/lookup/<serial_number>', methods=['GET'])
def lookup_ticket(serial_number):
    """
    Look up ticket by serial number - Production-ready with caching, rate limiting, and audit logging
    
    Features:
    - Input validation
    - Rate limiting (100 requests/hour per IP)
    - Redis caching (5-minute TTL)
    - Comprehensive audit logging
    - Performance monitoring
    - Multi-tenant aware
    """
    import time
    from .cache import (
        ticket_cache_key, cache_get_or_set, 
        invalidate_ticket_cache, is_cache_available
    )
    from .security import (
        validate_ticket_serial, rate_limit, 
        track_failed_lookup, security_check
    )
    from .audit import log_ticket_lookup
    
    start_time = time.time()
    
    try:
        # Security check (IP blocking, suspicious activity)
        try:
            security_check()
        except Exception as security_error:
            log_ticket_lookup(
                serial_number=serial_number,
                success=False,
                error_message=str(security_error),
                response_time_ms=int((time.time() - start_time) * 1000)
            )
            return jsonify({
                'error': 'Access denied',
                'message': str(security_error)
            }), 403
        
        # Validate input format
        is_valid, error_message = validate_ticket_serial(serial_number)
        if not is_valid:
            track_failed_lookup(serial_number)
            log_ticket_lookup(
                serial_number=serial_number,
                success=False,
                error_message=error_message,
                response_time_ms=int((time.time() - start_time) * 1000)
            )
            return jsonify({
                'error': 'Invalid serial number',
                'message': error_message
            }), 400
        
        # Rate limiting check
        from .security import check_rate_limit, RateLimitExceeded
        try:
            check_rate_limit('ticket_lookup', limit=100, window=3600)
        except RateLimitExceeded as e:
            log_ticket_lookup(
                serial_number=serial_number,
                success=False,
                error_message='Rate limit exceeded',
                response_time_ms=int((time.time() - start_time) * 1000)
            )
            return jsonify({
                'error': 'Rate limit exceeded',
                'message': str(e)
            }), 429
        
        # Get government context - resolve manually since endpoint is exempt from middleware
        try:
            government = get_current_government()
        except RuntimeError:
            # Middleware didn't set it - resolve manually
            from .middleware import (
                resolve_government_from_subdomain,
                resolve_government_from_header,
                resolve_government_default
            )
            
            # Try subdomain first
            government = resolve_government_from_subdomain()
            
            # Try header if subdomain failed
            if not government:
                government = resolve_government_from_header()
            
            # Try default (development only) if both failed
            if not government:
                government = resolve_government_default()
            
            # If still no government, return error
            if not government:
                return jsonify({
                    'error': 'No active government found',
                    'message': 'Unable to determine government context. Please contact administrator.',
                    'hint': 'For localhost development, ensure at least one government exists in the database.'
                }), 400
        
        # Normalize serial number
        serial_upper = serial_number.upper().strip()
        
        # Try to get from cache first
        cache_key = ticket_cache_key(government.id, serial_upper)
        
        def fetch_ticket():
            """Fetch ticket from database"""
            # Eager load related data to avoid N+1 queries
            from sqlalchemy.orm import joinedload
            from .models import Offence, OffenceCategory
            
            ticket = Ticket.query.options(
                joinedload(Ticket.service),
                joinedload(Ticket.offence).joinedload(Offence.category)
            ).filter(
                Ticket.government_id == government.id,
                db.func.upper(Ticket.serial_number) == serial_upper
            ).first()
            
            if not ticket:
                return None
            
            # Update status if needed
            ticket.update_status()
            db.session.commit()
            
            return ticket.to_dict()
        
        # Get ticket (from cache or database)
        ticket_data, cache_hit = cache_get_or_set(
            cache_key,
            fetch_ticket,
            ttl=300  # 5 minutes for unpaid, could be longer for paid
        )
        
        # If ticket not found
        if ticket_data is None:
            track_failed_lookup(serial_upper)
            response_time = int((time.time() - start_time) * 1000)
            
            log_ticket_lookup(
                serial_number=serial_upper,
                success=False,
                error_message='Ticket not found',
                response_time_ms=response_time
            )
            
            return jsonify({
                'error': 'Ticket not found',
                'message': f'No ticket found with serial number {serial_upper}'
            }), 404
        
        # Calculate response time
        response_time = int((time.time() - start_time) * 1000)
        
        # Log successful lookup
        log_ticket_lookup(
            serial_number=serial_upper,
            success=True,
            response_time_ms=response_time
        )
        
        # Prepare response
        response_data = {
            'ticket': ticket_data,
            'government': {
                'name': government.government_name,
                'currency': government.currency_code
            },
            'meta': {
                'cache_hit': cache_hit,
                'response_time_ms': response_time
            }
        }
        
        # Add cache headers
        from flask import make_response
        response = make_response(jsonify(response_data), 200)
        
        if cache_hit:
            response.headers['X-Cache'] = 'HIT'
        else:
            response.headers['X-Cache'] = 'MISS'
        
        response.headers['X-Response-Time'] = f"{response_time}ms"
        
        return response
        
    except Exception as e:
        # Log error
        response_time = int((time.time() - start_time) * 1000)
        
        log_ticket_lookup(
            serial_number=serial_number,
            success=False,
            error_message=str(e),
            response_time_ms=response_time
        )
        
        current_app.logger.error(f"Ticket lookup error: {str(e)}")
        
        return jsonify({
            'error': 'Lookup failed',
            'message': 'An error occurred while looking up the ticket. Please try again.'
        }), 500




# ============================================================================
# POWERTRANZ SPI-3DS-HPP CONFIGURATION
# ============================================================================

# HPP Configuration (loaded from environment or use defaults)
HPP_CONFIG = {
    'PageSet': os.getenv('POWERTRANZ_HPP_PAGESET', 'PTZ/PayFine'),
    'PageName': os.getenv('POWERTRANZ_HPP_PAGENAME', 'payfine'),
    'MerchantResponseUrl': os.getenv('POWERTRANZ_MERCHANT_RESPONSE_URL', 'http://localhost:3000/hpp-callback')
}

# SPI Token storage (in production, use Redis or database)
SPI_TOKENS = {}  # {'token': {'ticket_id': int, 'amount': float, 'expires_at': datetime, 'response': dict}}


def get_spi_token(ttl_minutes=5):
    """
    Generate a new SPI token
    Token expires after specified minutes (default 5)
    """
    import uuid
    token = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(minutes=ttl_minutes)
    return token, expires_at


def validate_spi_token(token):
    """
    Validate and consume an SPI token
    Returns token data if valid, None if expired or not found
    """
    token_data = SPI_TOKENS.get(token)
    if not token_data:
        return None
    
    # Check expiry
    if datetime.utcnow() > token_data['expires_at']:
        del SPI_TOKENS[token]  # Clean up expired token
        return None
    
    return token_data


def store_spi_token(token, ticket, response_data, ttl_minutes=5):
    """
    Store SPI token with associated data
    """
    token, expires_at = get_spi_token(ttl_minutes)
    SPI_TOKENS[token] = {
        'ticket_id': ticket.id,
        'ticket_serial': ticket.serial_number,
        'amount': float(ticket.fine_amount),
        'response': response_data,
        'expires_at': expires_at,
        'created_at': datetime.utcnow()
    }
    return token, expires_at


def cleanup_expired_tokens():
    """
    Remove expired SPI tokens
    Should be called periodically in production
    """
    now = datetime.utcnow()
    expired = [token for token, data in SPI_TOKENS.items() if now > data['expires_at']]
    for token in expired:
        del SPI_TOKENS[token]


# ============================================================================
# POWERTRANZ SPI-3DS-HPP ENDPOINTS
# ============================================================================

@api_bp.route('/spi/initiate/<serial_number>', methods=['POST'])
def spi_initiate(serial_number):
    """
    Initiate 3DS authentication via HPP
    
    This endpoint:
    1. Validates the ticket
    2. Creates a 3DS authentication request with PowerTranz
    3. Returns SPI Token and RedirectData (HTML form for iframe)
    
    The cardholder will be shown the HPP in an iframe where they:
    - Enter card details
    - Complete 3DS authentication (frictionless or challenge flow)
    
    After authentication, the HPP will post results to MerchantResponseUrl
    
    Expected request body:
    {
        "email": "cardholder@example.com",
        "billing_address": {
            "name": "John Doe",
            "street": "123 Main St",
            "city": "Bridgetown",
            "country": "BB"
        }
    }
    """
    try:
        # Find ticket
        ticket = Ticket.query.filter(
            db.func.upper(Ticket.serial_number) == serial_number.upper()
        ).first()
        
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        # Check if already paid
        if ticket.status == 'paid':
            return jsonify({'error': 'Ticket already paid'}), 400
        
        # Note: Overdue tickets can still be paid online
        # The frontend will show a warning message
        
        # Get request data
        data = request.get_json() or {}
        
        import uuid
        transaction_id = str(uuid.uuid4())
        # PowerTranz expects amount in dollars with decimal precision (e.g., 50.00)
        amount_dollars = float(ticket.fine_amount)
        
        government = get_current_government()
        pt_config = get_powertranz_config(government)
        
        currency_map = {
            'BBD': '052',
            'TTD': '780',
            'JMD': '388',
            'USD': '840'
        }
        currency_code = currency_map.get(pt_config['currency_code'], '840')
        
        spi_payload = {
            "TransactionIdentifier": transaction_id,
            "TotalAmount": amount_dollars,
            "CurrencyCode": currency_code,
            "ThreeDSecure": True,
            "OrderIdentifier": f"payfine-{ticket.serial_number}",
            "AddressMatch": False,
            "ExtendedData": {
                "ThreeDSecure": {
                    "ChallengeWindowSize": 4,
                    "ChallengeIndicator": "01"
                },
                "HostedPage": {
                    "PageSet": "PTZ/PayFine",  # Must include PTZ/ prefix
                    "PageName": "payfine"
                },
                "MerchantResponseUrl": HPP_CONFIG['MerchantResponseUrl']
            }
        }
        
        # Add optional fields if provided
        if data.get('email'):
            spi_payload['CustomerEmail'] = data['email']
        
        billing_address = data.get('billing_address', {})
        if billing_address:
            spi_payload['BillingAddress'] = {
                'Name': billing_address.get('name', ''),
                'Street': billing_address.get('street', ''),
                'City': billing_address.get('city', ''),
                'State': billing_address.get('state', ''),
                'PostalCode': billing_address.get('postal_code', ''),
                'Country': billing_address.get('country', 'BB')
            }
        
        spi_url = f"{pt_config['base_url']}/api/spi/sale"
        
        response = requests.post(
            spi_url,
            json=spi_payload,
            headers={
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'PowerTranz-PowerTranzId': pt_config['merchant_id'],
                'PowerTranz-PowerTranzPassword': pt_config['password']
            },
            timeout=30
        )
        
        if response.status_code in (200, 201):
            # Try to parse JSON response
            try:
                result = response.json()
            except ValueError:
                # PowerTranz returned empty or invalid JSON
                return jsonify({
                    'error': 'Payment gateway error',
                    'message': 'Invalid response from payment gateway. Please check your PowerTranz credentials or try again later.',
                    'debug_info': f'Response status: {response.status_code}, Content length: {len(response.text)}'
                }), 502
            
            # Check for SPI preprocessing response
            iso_response_code = result.get('IsoResponseCode', '')
            
            if iso_response_code == 'SP4':
                # SPI Preprocessing successful - 3DS flow initiated
                spi_token, expires_at = store_spi_token(
                    token=None,  # Will be generated
                    ticket=ticket,
                    response_data={
                        'transaction_id': transaction_id,
                        'amount': float(ticket.fine_amount),
                        'currency': 'BBD',
                        'original_request': spi_payload
                    },
                    ttl_minutes=5
                )
                
                # Update token with transaction ID
                SPI_TOKENS[spi_token]['transaction_id'] = transaction_id
                
                return jsonify({
                    'success': True,
                    'message': '3DS authentication initiated',
                    'SpiToken': spi_token,
                    'TransactionIdentifier': transaction_id,
                    'IsoResponseCode': iso_response_code,
                    'ResponseMessage': result.get('ResponseMessage', 'SPI Preprocessing complete'),
                    'RedirectData': result.get('RedirectData', ''),
                    'OrderIdentifier': result.get('OrderIdentifier', f"payfine-{ticket.serial_number}"),
                    'expires_at': expires_at.isoformat(),
                    'ticket': ticket.to_dict()
                }), 200
                
            elif iso_response_code == 'SP1':
                # Card doesn't support 3DS - proceed with regular sale
                return jsonify({
                    'success': True,
                    'message': 'Card does not support 3DS, proceeding with standard payment',
                    'three_ds_required': False,
                    'can_proceed_direct': True,
                    'ticket': ticket.to_dict()
                }), 200
            else:
                return jsonify({
                    'error': 'SPI initiation failed',
                    'response_code': iso_response_code,
                    'message': result.get('ResponseMessage', 'Unknown error')
                }), 400
        else:
            # API error
            try:
                error_data = response.json()
            except ValueError:
                error_data = {}
            
            return jsonify({
                'error': 'SPI initiation failed',
                'message': error_data.get('ResponseMessage', f'API Error: {response.status_code}'),
                'status_code': response.status_code,
                'debug_info': f'Response: {response.text[:200]}'
            }), response.status_code
            
    except requests.exceptions.Timeout:
        return jsonify({'error': 'Payment gateway timeout. Please try again.'}), 504
    except requests.exceptions.ConnectionError:
        return jsonify({'error': 'Unable to connect to payment gateway. Please try again.'}), 503
    except Exception as e:
        return jsonify({'error': f'SPI initiation failed: {str(e)}'}), 500


@api_bp.route('/spi/payment', methods=['POST'])
def spi_payment():
    """
    Complete payment after 3DS authentication
    
    This endpoint is called after the HPP has posted the 3DS authentication
    result to the MerchantResponseUrl. The frontend should then call this
    endpoint with the SPI Token to complete the payment.
    
    Expected request body:
    {
        "SpiToken": "uuid-token-here"
    }
    
    Returns:
    - Approved: true/false
    - Transaction details if successful
    - Error details if failed
    """
    try:
        data = request.get_json()
        
        if not data or not data.get('SpiToken'):
            return jsonify({'error': 'SpiToken is required'}), 400
        
        spi_token = data['SpiToken']
        
        # Validate and get token data
        token_data = validate_spi_token(spi_token)
        
        if not token_data:
            return jsonify({
                'error': 'Invalid or expired SPI token',
                'message': 'The payment session has expired. Please start again.'
            }), 400
        
        # Get ticket from token data
        ticket = Ticket.query.get(token_data['ticket_id'])
        
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        # Get PowerTranz configuration
        pt_config = get_powertranz_config()
        
        # Build payment completion request
        payment_payload = spi_token  # SPI Token surrounded by quotes
        
        # Make request to PowerTranz payment endpoint
        payment_url = f"{pt_config['base_url']}/api/spi/payment"
        
        response = requests.post(
            payment_url,
            data=f'"{spi_token}"',  # SPI token in quotes
            headers={
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'PowerTranz-MerchantId': pt_config['merchant_id'],
                'PowerTranz-Password': pt_config['password']
            },
            timeout=30
        )
        
        if response.status_code in (200, 201):
            result = response.json()
            
            # Check if payment was approved
            if result.get('Approved', False):
                # Update ticket status
                ticket.status = 'paid'
                ticket.paid_date = datetime.utcnow()
                ticket.payment_reference = result.get('TransactionIdentifier', f"TXN-{secrets.token_hex(8).upper()}")
                
                db.session.commit()
                
                # Invalidate cache for this ticket and ticket lists
                try:
                    invalidate_ticket_cache(ticket.government_id, ticket.serial_number)
                    invalidate_ticket_list_cache(ticket.government_id)
                except Exception as cache_error:
                    # Log but don't fail the payment if cache invalidation fails
                    current_app.logger.warning(f"Cache invalidation failed: {str(cache_error)}")
                
                # Log successful payment
                try:
                    log_payment_attempt(
                        ticket_serial=ticket.serial_number,
                        amount=float(ticket.fine_amount),
                        success=True,
                        transaction_id=result.get('TransactionIdentifier'),
                        error_message=None
                    )
                except Exception as audit_error:
                    # Log but don't fail the payment if audit logging fails
                    current_app.logger.warning(f"Audit logging failed: {str(audit_error)}")
                
                # Generate receipt
                receipt = generate_receipt(ticket, result)
                
                # Clean up used token
                del SPI_TOKENS[spi_token]
                
                return jsonify({
                    'success': True,
                    'message': 'Payment successful',
                    'Approved': True,
                    'TransactionIdentifier': result.get('TransactionIdentifier'),
                    'AuthorizationCode': result.get('AuthorizationCode'),
                    'IsoResponseCode': result.get('IsoResponseCode', '00'),
                    'ResponseMessage': result.get('ResponseMessage', 'Transaction approved'),
                    'receipt': receipt,
                    'ticket': ticket.to_dict()
                }), 200
            else:
                # Payment declined - log the failed attempt
                try:
                    log_payment_attempt(
                        ticket_serial=ticket.serial_number,
                        amount=float(ticket.fine_amount),
                        success=False,
                        transaction_id=result.get('TransactionIdentifier'),
                        error_message=result.get('ResponseMessage', 'Payment declined')
                    )
                except Exception as audit_error:
                    current_app.logger.warning(f"Audit logging failed: {str(audit_error)}")
                
                response_code = result.get('IsoResponseCode', '')
                return jsonify({
                    'success': False,
                    'message': 'Payment was declined',
                    'Approved': False,
                    'IsoResponseCode': response_code,
                    'ResponseMessage': result.get('ResponseMessage', 'Payment declined'),
                    'RiskManagement': result.get('RiskManagement')
                }), 400
        else:
            # API error
            error_data = response.json() if response.json() else {}
            return jsonify({
                'success': False,
                'error': 'Payment completion failed',
                'message': error_data.get('ResponseMessage', f'API Error: {response.status_code}'),
                'status_code': response.status_code
            }), response.status_code
            
    except requests.exceptions.Timeout:
        return jsonify({'error': 'Payment gateway timeout. Please try again.'}), 504
    except requests.exceptions.ConnectionError:
        return jsonify({'error': 'Unable to connect to payment gateway. Please try again.'}), 503
    except Exception as e:
        return jsonify({'error': f'Payment completion failed: {str(e)}'}), 500


@api_bp.route('/spi/hpp-callback', methods=['POST'])
def spi_hpp_callback():
    """
    PowerTranz HPP callback endpoint
    
    PowerTranz will POST the 3DS authentication result to this URL.
    This is called from the cardholder's browser after 3DS authentication.
    
    Expected POST data from PowerTranz:
    - SpiToken
    - IsoResponseCode (3D0 = success, others = failure)
    - RiskManagement (3DS data)
    - TransactionIdentifier
    """
    try:
        data = request.get_json() or request.form.to_dict() or {}
        
        if not data:
            return jsonify({'error': 'No callback data received'}), 400
        
        spi_token = data.get('SpiToken')
        iso_response_code = data.get('IsoResponseCode', '')
        transaction_id = data.get('TransactionIdentifier', '')
        
        # Log the callback (in production, use proper logging)
        print(f"HPP Callback received - Token: {spi_token}, Code: {iso_response_code}")
        
        # Validate token if provided
        if spi_token:
            token_data = validate_spi_token(spi_token)
            if token_data:
                # Store 3DS authentication result
                token_data['3ds_result'] = {
                    'iso_response_code': iso_response_code,
                    'response_message': data.get('ResponseMessage', ''),
                    'risk_management': data.get('RiskManagement'),
                    'transaction_id': transaction_id,
                    'timestamp': datetime.utcnow().isoformat()
                }
        
        # Return success to PowerTranz
        return jsonify({
            'received': True,
            'message': 'Callback processed'
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Callback processing failed: {str(e)}'}), 500


@api_bp.route('/spi/status/<spi_token>', methods=['GET'])
def spi_status(spi_token):
    """
    Check the status of an SPI transaction/3DS authentication
    
    This endpoint can be polled by the frontend to check if 3DS
    authentication has completed.
    
    Returns:
    - status: 'pending' | 'completed' | 'failed' | 'expired'
    - 3ds_result: Authentication result if completed
    """
    try:
        token_data = validate_spi_token(spi_token)
        
        if not token_data:
            return jsonify({
                'status': 'expired',
                'message': 'SPI token has expired'
            }), 400
        
        # Check if we have 3DS result
        if token_data.get('3ds_result'):
            return jsonify({
                'status': 'completed',
                'spi_token': spi_token,
                '3ds_result': token_data['3ds_result'],
                'transaction_id': token_data.get('transaction_id'),
                'amount': token_data['amount']
            }), 200
        else:
            # Still waiting for 3DS authentication
            return jsonify({
                'status': 'pending',
                'spi_token': spi_token,
                'message': 'Waiting for 3DS authentication',
                'expires_at': token_data['expires_at'].isoformat()
            }), 200
            
    except Exception as e:
        return jsonify({'error': f'Status check failed: {str(e)}'}), 500


# ============================================================================
# LEGACY PAYMENT ENDPOINT (kept for backward compatibility)
# ============================================================================

@api_bp.route('/pay/<serial_number>', methods=['POST'])
def pay_ticket(serial_number):
    """
    Process payment for a ticket using PowerTranz payment gateway
    
    PCI DSS COMPLIANCE:
    - This integration uses PowerTranz REST API v3
    - Card data is sent directly to PowerTranz (not stored on our servers)
    - Never log card numbers, CVV, or expiry dates
    
    API DOCUMENTATION:
    - https://developer.powertranz.com/docs/integration-types
    
    TEST CARDS (Sandbox):
    - Success: 4111111111111111
    - Decline: 4111111111111112
    - 3DS Challenge: $10.01 with card 4111111111111111
    """
    try:
        # Find ticket
        ticket = Ticket.query.filter(
            db.func.upper(Ticket.serial_number) == serial_number.upper()
        ).first()
        
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        # Check if already paid
        if ticket.status == 'paid':
            return jsonify({'error': 'Ticket already paid'}), 400
        
        # Check if overdue (redirect to court)
        if ticket.is_overdue():
            return jsonify({
                'error': 'Ticket is overdue',
                'message': 'This ticket is past the due date. Please contact the Magistrate Court.',
                'court_info': {
                    'name': 'Magistrate Court of Barbados',
                    'phone': '+1-246-228-2503',
                    'address': 'Coleridge Street, Bridgetown, Barbados'
                }
            }), 400
        
        # Get payment details from request
        data = request.get_json() or {}
        
        # Get PowerTranz configuration
        pt_config = get_powertranz_config()
        
        # Process payment through PowerTranz
        payment_result = process_powertranz_payment(
            ticket=ticket,
            config=pt_config,
            card_number=data.get('card_number'),
            expiry_mm=data.get('expiry_mm'),
            expiry_yy=data.get('expiry_yy'),
            cvv=data.get('cvv'),
            card_holder_name=data.get('card_holder_name'),
            customer_email=data.get('email')
        )
        
        if not payment_result['success']:
            return jsonify({
                'error': 'Payment processing failed',
                'message': payment_result.get('message', 'Unknown error'),
                'response_code': payment_result.get('response_code')
            }), 400
        
        # Update ticket status
        ticket.status = 'paid'
        ticket.paid_date = datetime.utcnow()
        ticket.payment_reference = payment_result['transaction_id']
        
        db.session.commit()
        
        # Invalidate cache for this ticket and ticket lists
        try:
            invalidate_ticket_cache(ticket.government_id, ticket.serial_number)
            invalidate_ticket_list_cache(ticket.government_id)
        except Exception as cache_error:
            current_app.logger.warning(f"Cache invalidation failed: {str(cache_error)}")
        
        # Log successful payment
        try:
            log_payment_attempt(
                ticket_serial=ticket.serial_number,
                amount=float(ticket.fine_amount),
                success=True,
                transaction_id=payment_result['transaction_id'],
                error_message=None
            )
        except Exception as audit_error:
            current_app.logger.warning(f"Audit logging failed: {str(audit_error)}")
        
        # Generate receipt
        receipt = generate_receipt(ticket, payment_result)
        
        return jsonify({
            'message': 'Payment successful',
            'ticket': ticket.to_dict(),
            'receipt': receipt
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Payment failed: {str(e)}'}), 500


def process_powertranz_payment(ticket, config, card_number, expiry_mm, expiry_yy, cvv, card_holder_name, customer_email=None):
    """
    Process payment through PowerTranz REST API v3
    
    SECURITY:
    - Card data is sent directly to PowerTranz (PCI compliant)
    - Never log or store card numbers, CVV, or full track data
    - Use HTTPS for all API calls
    
    API REFERENCE:
    - https://developer.powertranz.com/docs/integration-types
    """
    try:
        # Build PowerTranz Sale transaction payload
        # Amount must be in cents (smallest currency unit)
        amount_cents = int(float(ticket.fine_amount) * 100)
        
        payload = {
            "TransactionType": "Sale",
            "MerchantId": config['merchant_id'],
            "Password": config['password'],
            "Amount": amount_cents,
            "Currency": "BBD",
            "CardNumber": card_number,
            "ExpiryMonth": str(expiry_mm).zfill(2),
            "ExpiryYear": str(expiry_yy)[-2:],
            "CVV": cvv,
            "CardHolderName": card_holder_name,
            "OrderId": f"payfine-{ticket.serial_number}",
            "Description": f"Traffic fine payment for ticket {ticket.serial_number}",
            "CustomerEmail": customer_email or "customer@example.com",
            "ReferenceNumber": f"PAYFINE-{secrets.token_hex(4).upper()}"
        }
        
        # Make API request to PowerTranz
        response = requests.post(
            f"{config['base_url']}/transactions",
            json=payload,
            headers={
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout=30
        )
        
        # Parse response
        if response.status_code in (200, 201):
            result = response.json()
            
            # Check for successful transaction
            # PowerTranz uses ResponseCode "00" for success
            response_code = result.get('ResponseCode', '')
            
            if response_code == '00' or result.get('Approved', False):
                return {
                    'success': True,
                    'transaction_id': result.get('TransactionId', f'TXN-{secrets.token_hex(8).upper()}'),
                    'amount': float(ticket.fine_amount),
                    'currency': 'BBD',
                    'timestamp': datetime.utcnow().isoformat(),
                    'response_code': response_code,
                    'authorization_code': result.get('AuthorizationCode'),
                    'reference_number': result.get('ReferenceNumber')
                }
            else:
                # Payment was declined
                return {
                    'success': False,
                    'message': result.get('ResponseMessage', 'Payment was declined'),
                    'response_code': response_code
                }
        else:
            # API error
            error_data = response.json() if response.json() else {}
            return {
                'success': False,
                'message': error_data.get('ResponseMessage', f'API Error: {response.status_code}'),
                'response_code': str(response.status_code)
            }
            
    except requests.exceptions.Timeout:
        return {
            'success': False,
            'message': 'Payment gateway timeout. Please try again.'
        }
    except requests.exceptions.ConnectionError:
        return {
            'success': False,
            'message': 'Unable to connect to payment gateway. Please try again.'
        }
    except Exception as e:
        return {
            'success': False,
            'message': f'Payment processing error: {str(e)}'
        }


def generate_receipt(ticket, payment_result):
    """
    Generate digital receipt for successful payment
    """
    return {
        'receipt_number': f'RCP-{secrets.token_hex(6).upper()}',
        'ticket_serial': ticket.serial_number,
        'amount_paid': float(ticket.fine_amount),
        'currency': 'BBD',
        'payment_date': ticket.paid_date.isoformat(),
        'payment_reference': ticket.payment_reference,
        'transaction_id': payment_result['transaction_id'],
        'service': ticket.service.name,
        'offense': ticket.offense_description,
        'vehicle_plate': ticket.vehicle_plate,
        'status': 'PAID',
        'issued_by': 'PayFine Platform',
        'note': 'Keep this receipt for your records. This is an official payment confirmation.'
    }


# ============================================================================
# POWERTRANZ WEBHOOK (for payment status updates)
# ============================================================================

@api_bp.route('/payment/webhook', methods=['POST'])
def powertranz_webhook():
    """
    PowerTranz webhook endpoint for payment status updates
    
    SECURITY:
    - Validate HMAC signature from PowerTranz
    - Never log sensitive payment data
    - Use HTTPS for webhook endpoint
    
    DOCUMENTATION:
    - https://developer.powertranz.com/docs/webhooks
    """
    try:
        # Get signature from header (if PowerTranz sends one)
        signature = request.headers.get('X-PowerTranz-Signature')
        
        # Get webhook payload
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No payload received'}), 400
        
        # Validate signature (implement based on PowerTranz documentation)
        # This is a placeholder - actual validation depends on PowerTranz setup
        if signature:
            # Validate HMAC signature here
            pass
        
        # Process transaction status
        transaction_id = data.get('TransactionId')
        transaction_status = data.get('TransactionStatus')
        order_id = data.get('OrderId')
        
        # Extract ticket serial from order_id (format: payfine-{serial})
        if order_id and order_id.startswith('payfine-'):
            serial_number = order_id.replace('payfine-', '')
            
            ticket = Ticket.query.filter_by(serial_number=serial_number).first()
            
            if ticket:
                if transaction_status == 'Approved':
                    ticket.status = 'paid'
                    ticket.payment_reference = transaction_id
                    ticket.paid_date = datetime.utcnow()
                elif transaction_status == 'Declined':
                    ticket.status = 'unpaid'
                
                db.session.commit()
        
        return jsonify({'received': True}), 200
        
    except Exception as e:
        return jsonify({'error': f'Webhook processing failed: {str(e)}'}), 500


# ============================================================================
# SERVICE MANAGEMENT ROUTES (Admin)
# ============================================================================

@api_bp.route('/services', methods=['GET'])
def get_services():
    """
    Get list of all active services - Multi-tenant aware
    """
    try:
        government = get_current_government()
        services = Service.query.filter_by(
            government_id=government.id,
            is_active=True
        ).all()
        return jsonify({
            'services': [service.to_dict() for service in services]
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch services: {str(e)}'}), 500


@api_bp.route('/services', methods=['POST'])
@jwt_required()
def create_service():
    """
    Create new service - Multi-tenant aware
    NOTE: Access control now handled by role-based permissions
    """
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Check if user has permission to manage services
        from .permissions import Permission, user_has_permission
        if not user_has_permission(user, Permission.MANAGE_SERVICES):
            return jsonify({'error': 'Permission denied. You need MANAGE_SERVICES permission.'}), 403
        
        data = request.get_json()
        
        if not data.get('name') or not data.get('description'):
            return jsonify({'error': 'Name and description required'}), 400
        
        government = get_current_government()
        
        if Service.query.filter_by(
            government_id=government.id,
            name=data['name']
        ).first():
            return jsonify({'error': 'Service already exists'}), 409
        
        service = Service(
            government_id=government.id,
            name=data['name'],
            description=data['description']
        )
        
        db.session.add(service)
        db.session.commit()
        
        return jsonify({
            'message': 'Service created successfully',
            'service': service.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Service creation failed: {str(e)}'}), 500


# ============================================================================
# TICKET CHALLENGE ROUTES (CITIZEN-FACING)
# ============================================================================

@api_bp.route('/tickets/<serial_number>/challenge', methods=['POST'])
def submit_ticket_challenge(serial_number):
    """
    Submit a challenge for a ticket - Multi-tenant aware
    """
    try:
        government = get_current_government()
        
        ticket = Ticket.query.filter(
            Ticket.government_id == government.id,
            db.func.upper(Ticket.serial_number) == serial_number.upper()
        ).first()
        
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        # Check if ticket can be challenged
        if ticket.status in ['paid', 'voided', 'dismissed', 'refunded']:
            return jsonify({
                'error': 'Ticket cannot be challenged',
                'message': f'Ticket status is {ticket.status}. Only unpaid tickets can be challenged.'
            }), 400
        
        # Check if already challenged
        existing_challenge = TicketChallenge.query.filter_by(ticket_id=ticket.id).first()
        if existing_challenge:
            return jsonify({
                'error': 'Ticket already challenged',
                'message': 'This ticket already has an active challenge',
                'challenge': existing_challenge.to_dict()
            }), 409
        
        # Get challenge data
        data = request.get_json() or {}
        reason = data.get('reason')
        
        if not reason:
            return jsonify({'error': 'Challenge reason is required'}), 400
        
        # Create challenge
        challenge = TicketChallenge(
            ticket_id=ticket.id,
            reason=reason,
            evidence=data.get('evidence'),
            status='Pending'
        )
        
        # Update ticket status to Challenged
        ticket.status = 'Challenged'
        ticket.updated_at = datetime.utcnow()
        
        db.session.add(challenge)
        db.session.commit()
        
        return jsonify({
            'message': 'Challenge submitted successfully',
            'challenge': challenge.to_dict(include_ticket=True),
            'next_steps': [
                'Your challenge has been submitted and is pending review',
                'An administrator will review your challenge within 5-7 business days',
                'You will be notified of the outcome via email (if provided)',
                'Payment is blocked until the challenge is resolved',
                'You can check the status using the ticket lookup'
            ]
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to submit challenge: {str(e)}'}), 500


@api_bp.route('/tickets/<serial_number>/challenge', methods=['GET'])
def get_ticket_challenge_status(serial_number):
    """
    Get challenge status - Multi-tenant aware
    Includes complete admin decision information
    """
    try:
        government = get_current_government()
        
        ticket = Ticket.query.filter(
            Ticket.government_id == government.id,
            db.func.upper(Ticket.serial_number) == serial_number.upper()
        ).first()
        
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        # Get challenge
        challenge = TicketChallenge.query.filter_by(ticket_id=ticket.id).first()
        
        if not challenge:
            return jsonify({
                'has_challenge': False,
                'message': 'No challenge found for this ticket'
            }), 200
        
        # Return challenge details with complete admin decision information
        response = {
            'has_challenge': True,
            'challenge': challenge.to_dict(),
            'ticket_status': ticket.status
        }
        
        # Add detailed outcome information if resolved
        if challenge.status in ['Approved', 'Rejected']:
            outcome_messages = {
                'Dismissed': 'Your challenge was approved. The ticket has been dismissed and no payment is required.',
                'FineAdjusted': f'Your challenge was approved. The fine has been adjusted to ${float(challenge.adjusted_fine):.2f}. You can now proceed with payment.',
                'Upheld': 'Your challenge was reviewed and the original fine has been upheld. The ticket is now payable.'
            }
            
            response['outcome_message'] = outcome_messages.get(
                challenge.outcome,
                'Your challenge has been reviewed.'
            )
            
            # Include admin decision details
            response['admin_decision'] = {
                'outcome': challenge.outcome,
                'admin_notes': challenge.admin_notes,
                'reviewed_at': challenge.reviewed_at.isoformat() if challenge.reviewed_at else None,
                'reviewed_by': challenge.reviewed_by.username if challenge.reviewed_by else None
            }
            
            # Include adjusted fine if applicable
            if challenge.outcome == 'FineAdjusted' and challenge.adjusted_fine:
                response['admin_decision']['adjusted_fine'] = float(challenge.adjusted_fine)
                response['admin_decision']['original_fine'] = float(ticket.calculated_fine or ticket.fine_amount)
        
        return jsonify(response), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get challenge status: {str(e)}'}), 500


# ============================================================================
# ADMIN ROUTES
# ============================================================================

@api_bp.route('/admin/tickets', methods=['GET'])
@jwt_required()
def get_all_tickets():
    """
    Get all tickets - Multi-tenant aware
    NOTE: Access control now handled by role-based permissions
    """
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Check if user has permission to view tickets
        from .permissions import Permission, user_has_permission
        if not user_has_permission(user, Permission.VIEW_TICKETS):
            return jsonify({'error': 'Permission denied. You need VIEW_TICKETS permission.'}), 403
        
        government = get_current_government()
        
        from sqlalchemy import or_
        status = request.args.get('status')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        search_raw = request.args.get('search', '')
        search = search_raw.strip() if search_raw else ''
        
        query = Ticket.query.filter_by(government_id=government.id)
        
        if status and status.strip():
            query = query.filter_by(status=status)
        
        if search:
            search_pattern = f'%{search}%'
            query = query.filter(
                or_(
                    Ticket.serial_number.ilike(search_pattern),
                    Ticket.vehicle_plate.ilike(search_pattern),
                    Ticket.driver_name.ilike(search_pattern),
                    Ticket.driver_license.ilike(search_pattern)
                )
            )
        
        pagination = query.order_by(Ticket.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'tickets': [ticket.to_dict() for ticket in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch tickets: {str(e)}'}), 500


# ============================================================================
# OFFENCE SYSTEM - PUBLIC/WARDEN ACCESS
# ============================================================================

@api_bp.route('/offence-categories', methods=['GET'])
@jwt_required()
def get_public_offence_categories():
    """
    Get active offence categories - Multi-tenant aware
    """
    try:
        from .models import OffenceCategory
        
        government = get_current_government()
        
        categories = OffenceCategory.query.filter_by(
            government_id=government.id,
            active=True
        ).order_by(OffenceCategory.name).all()
        
        return jsonify({
            'categories': [cat.to_dict() for cat in categories]
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch categories: {str(e)}'}), 500


@api_bp.route('/offences', methods=['GET'])
@jwt_required()
def get_public_offences():
    """
    Get active offences - Multi-tenant aware
    """
    try:
        from .models import Offence
        
        government = get_current_government()
        
        query = Offence.query.filter_by(government_id=government.id)
        
        active = request.args.get('active', 'true').lower() == 'true'
        if active:
            query = query.filter_by(active=True)
        
        category_id = request.args.get('category_id', type=int)
        if category_id:
            query = query.filter_by(category_id=category_id)
        
        offences = query.order_by(Offence.category_id, Offence.name).all()
        
        return jsonify({
            'offences': [offence.to_dict() for offence in offences]
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to fetch offences: {str(e)}'}), 500


# ============================================================================
# ERROR HANDLERS
# ============================================================================

@api_bp.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({'error': 'Resource not found'}), 404


@api_bp.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    db.session.rollback()
    return jsonify({'error': 'Internal server error'}), 500


# ============================================================================
# PUBLIC BRANDING ENDPOINT
# ============================================================================

@api_bp.route('/branding', methods=['GET'])
def get_public_branding():
    """
    Get current government branding configuration (public endpoint)
    No authentication required - used for styling the public-facing pages
    
    NOTE: This endpoint is exempt from middleware, so we manually resolve government
    """
    try:
        # Manually resolve government since this endpoint is exempt from middleware
        from .middleware import resolve_government
        
        try:
            government = resolve_government()
        except Exception:
            # If resolution fails, try to get from g (in case middleware did run)
            try:
                government = get_current_government()
            except:
                # Fall back to first active government in development
                government = Government.query.filter_by(status='active').first()
                if not government:
                    raise Exception("No active government found")
        
        branding = government.get_branding()
        
        return jsonify({
            'branding': branding,
            'government': {
                'name': government.government_name,
                'country': government.country_name
            }
        }), 200
        
    except Exception as e:
        # Return default branding if government not found
        return jsonify({
            'branding': {
                'logo_url': '/logo.svg',
                'primary_color': '#003f87',
                'secondary_color': '#ffc72c',
                'platform_name': 'PayFine',
                'tagline': 'Secure Government Payment Platform'
            },
            'government': {
                'name': 'PayFine Platform',
                'country': 'Default'
            }
        }), 200

