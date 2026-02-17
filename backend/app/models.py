"""
Database models for PayFine - Global Government Digital Payments Platform
Multi-tenant SaaS architecture for government fine payment systems worldwide

MULTI-TENANT ARCHITECTURE:
Each Government = One Tenant with complete data isolation
- Government-specific configuration (currency, timezone, legal framework)
- Encrypted payment gateway credentials per government
- Government-scoped users, tickets, services, and offences

NATIONAL TRAFFIC OFFENCE & PENALTY SYSTEM:
This system removes penalty uncertainty by using admin-defined, configurable rules
while preserving the right to challenge tickets through judicial review.

Key Models:
- Government: Tenant configuration (country, currency, payment gateway)
- OperatorUser: PayFine HQ operators (cross-government access)
- GovernmentBilling: Revenue tracking per government
- OffenceCategory: Groups related offences (Speeding, Dangerous Driving, etc.)
- Offence: Specific violations with measurable criteria
- PenaltyRule: Defines fines, points, and court requirements based on offence + measured value
- TicketChallenge: Allows citizens to contest tickets; admins can dismiss or adjust

Design Principles:
1. MULTI-TENANT ISOLATION: Complete data separation between governments
2. NO ARBITRARY FINES: All penalties derived from PenaltyRule table
3. TRANSPARENCY: Citizens know exact penalty based on measurable criteria
4. JUDICIAL REVIEW: Challenge system preserves due process rights
5. GOVERNMENT-SAFE: PayFine never holds funds, government is merchant of record
"""

from . import db
from datetime import datetime, timedelta, date
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import and_, or_, Index
import uuid
import json


# ============================================================================
# MULTI-TENANT CORE MODELS
# ============================================================================

class Government(db.Model):
    """
    Government model - represents a tenant in the multi-tenant system
    
    Each government is a completely isolated tenant with:
    - Own configuration (country, currency, timezone)
    - Own payment gateway credentials (encrypted)
    - Own users, tickets, services, and offences
    - Own branding and legal framework
    
    CRITICAL: This is the foundation of multi-tenant isolation.
    All core entities MUST be scoped by government_id.
    """
    __tablename__ = 'governments'
    
    # Primary key - UUID for security and scalability
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Government identification
    government_name = db.Column(db.String(200), nullable=False)  # e.g., "Government of Trinidad and Tobago"
    country_name = db.Column(db.String(100), nullable=False)  # e.g., "Trinidad and Tobago"
    country_iso_code = db.Column(db.String(2), nullable=False, index=True)  # ISO 3166-1 alpha-2 (e.g., TT, BB, JM)
    
    # Financial configuration
    currency_code = db.Column(db.String(3), nullable=False)  # ISO 4217 (e.g., TTD, BBD, JMD, USD)
    timezone = db.Column(db.String(50), default='UTC')  # e.g., "America/Port_of_Spain"
    
    # Legal framework
    legal_framework_version = db.Column(db.String(50), nullable=True)  # e.g., "Traffic Act 2024"
    
    # Payment gateway configuration (ENCRYPTED)
    payment_gateway_type = db.Column(db.String(50), default='powertranz')  # powertranz, stripe, etc.
    payment_gateway_config = db.Column(db.Text, nullable=True)  # Encrypted JSON with credentials
    
    # Bank configuration (ENCRYPTED)
    bank_config = db.Column(db.Text, nullable=True)  # Encrypted JSON with bank details
    
    # Branding configuration
    branding_config = db.Column(db.Text, nullable=True)  # JSON: {logo_url, primary_color, secondary_color, etc.}
    
    # AI Configuration (ENCRYPTED)
    openai_api_key = db.Column(db.Text, nullable=True)  # Encrypted OpenAI API key for enhanced AI features
    ai_features_enabled = db.Column(db.Boolean, default=True)  # Enable/disable AI features
    
    # Gamification Configuration
    gamification_enabled = db.Column(db.Boolean, default=True)  # Enable/disable gamification features
    
    # Status management
    status = db.Column(db.String(20), default='pilot', index=True)  # pilot, active, suspended
    
    # Contact information
    contact_email = db.Column(db.String(120), nullable=True)
    contact_phone = db.Column(db.String(20), nullable=True)
    support_url = db.Column(db.String(255), nullable=True)
    
    # Subdomain for multi-tenant routing
    subdomain = db.Column(db.String(50), unique=True, nullable=True, index=True)  # e.g., "barbados", "trinidad"
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    activated_at = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    users = db.relationship('User', backref='government', lazy=True, cascade='all, delete-orphan')
    services = db.relationship('Service', backref='government', lazy=True, cascade='all, delete-orphan')
    tickets = db.relationship('Ticket', backref='government', lazy=True, cascade='all, delete-orphan')
    offence_categories = db.relationship('OffenceCategory', backref='government', lazy=True, cascade='all, delete-orphan')
    billing_records = db.relationship('GovernmentBilling', backref='government', lazy=True, cascade='all, delete-orphan')
    
    def get_payment_config(self):
        """
        Decrypt and return payment gateway configuration
        
        Returns dict with:
        - merchant_id
        - password
        - api_url
        - etc.
        
        TODO: Implement encryption/decryption
        """
        if not self.payment_gateway_config:
            return {}
        
        try:
            # TODO: Decrypt before parsing
            return json.loads(self.payment_gateway_config)
        except (json.JSONDecodeError, TypeError):
            return {}
    
    def set_payment_config(self, config_dict):
        """
        Encrypt and store payment gateway configuration
        
        Args:
            config_dict: Dictionary with payment gateway credentials
        
        TODO: Implement encryption
        """
        # TODO: Encrypt before storing
        self.payment_gateway_config = json.dumps(config_dict)
    
    def get_branding(self):
        """Get branding configuration as dict"""
        if not self.branding_config:
            return {
                'logo_url': None,
                'primary_color': '#007bff',
                'secondary_color': '#6c757d',
                'platform_name': 'PayFine',
                'font_family': 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }
        
        try:
            return json.loads(self.branding_config)
        except (json.JSONDecodeError, TypeError):
            return {}
    
    def set_branding(self, branding_dict):
        """Set branding configuration"""
        self.branding_config = json.dumps(branding_dict)
    
    def get_openai_key(self):
        """
        Decrypt and return OpenAI API key
        
        Returns:
            str: Decrypted OpenAI API key or None
        
        TODO: Implement encryption/decryption
        """
        if not self.openai_api_key:
            return None
        
        try:
            # TODO: Decrypt before returning
            return self.openai_api_key
        except Exception:
            return None
    
    def set_openai_key(self, api_key):
        """
        Encrypt and store OpenAI API key
        
        Args:
            api_key: OpenAI API key to store
        
        TODO: Implement encryption
        """
        if api_key:
            # TODO: Encrypt before storing
            self.openai_api_key = api_key
        else:
            self.openai_api_key = None
    
    def has_openai_enabled(self):
        """Check if OpenAI enhanced features are available"""
        return self.ai_features_enabled and bool(self.openai_api_key)
    
    def to_dict(self, include_sensitive=False):
        """
        Convert government to dictionary
        
        Args:
            include_sensitive: Include payment config (operator only)
        """
        data = {
            'id': self.id,
            'government_name': self.government_name,
            'country_name': self.country_name,
            'country_iso_code': self.country_iso_code,
            'currency_code': self.currency_code,
            'timezone': self.timezone,
            'legal_framework_version': self.legal_framework_version,
            'payment_gateway_type': self.payment_gateway_type,
            'status': self.status,
            'contact_email': self.contact_email,
            'contact_phone': self.contact_phone,
            'support_url': self.support_url,
            'subdomain': self.subdomain,
            'branding': self.get_branding(),
            'ai_features_enabled': self.ai_features_enabled,
            'has_openai_key': bool(self.openai_api_key),
            'openai_enhanced': self.has_openai_enabled(),
            'gamification_enabled': self.gamification_enabled,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'activated_at': self.activated_at.isoformat() if self.activated_at else None
        }
        
        if include_sensitive:
            # Only for PayFine operators
            data['payment_config'] = self.get_payment_config()
            data['has_payment_config'] = bool(self.payment_gateway_config)
            data['has_bank_config'] = bool(self.bank_config)
            data['openai_api_key'] = self.get_openai_key()  # Decrypted key for admin
        
        return data
    
    def __repr__(self):
        return f'<Government {self.country_iso_code}: {self.government_name}>'


class OperatorUser(db.Model):
    """
    Operator User model - PayFine HQ staff with cross-government access
    
    These users are NOT scoped to a single government.
    They can view and manage multiple governments.
    
    Roles:
    - super_admin: Full access to all governments and platform settings
    - finance: Access to billing and revenue data
    - support: Read-only access for customer support
    - auditor: Read-only access to audit logs and compliance data
    """
    __tablename__ = 'operator_users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    
    # Operator details
    full_name = db.Column(db.String(200), nullable=True)
    role = db.Column(db.String(20), default='support')  # super_admin, finance, support, auditor
    is_active = db.Column(db.Boolean, default=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)
    
    def set_password(self, password):
        """Hash and set operator password"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Verify password against hash"""
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        """Convert operator to dictionary"""
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'full_name': self.full_name,
            'role': self.role,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat(),
            'last_login': self.last_login.isoformat() if self.last_login else None
        }
    
    def __repr__(self):
        return f'<OperatorUser {self.username} ({self.role})>'


class GovernmentBilling(db.Model):
    """
    Government Billing model - tracks revenue and fees per government
    
    PayFine invoices governments monthly in arrears based on:
    - Transaction volume
    - Platform fees (percentage or flat rate)
    - Pilot operations fees (if applicable)
    
    CRITICAL: PayFine NEVER holds public funds.
    This table tracks what governments owe PayFine for platform usage.
    """
    __tablename__ = 'government_billing'
    
    id = db.Column(db.Integer, primary_key=True)
    government_id = db.Column(db.String(36), db.ForeignKey('governments.id'), nullable=False, index=True)
    
    # Billing period
    billing_period_start = db.Column(db.Date, nullable=False)
    billing_period_end = db.Column(db.Date, nullable=False)
    billing_month = db.Column(db.String(7), nullable=False, index=True)  # YYYY-MM format
    
    # Transaction metrics
    transaction_count = db.Column(db.Integer, default=0)
    successful_transactions = db.Column(db.Integer, default=0)
    failed_transactions = db.Column(db.Integer, default=0)
    
    # Revenue (what government collected from citizens)
    total_revenue = db.Column(db.Numeric(12, 2), default=0)  # Total fines paid
    
    # Platform fees (what government owes PayFine)
    platform_fee_percentage = db.Column(db.Numeric(5, 2), default=2.5)  # e.g., 2.5%
    platform_fee_amount = db.Column(db.Numeric(12, 2), default=0)
    pilot_ops_fee = db.Column(db.Numeric(12, 2), default=0)  # Fixed fee for pilot governments
    total_fees = db.Column(db.Numeric(12, 2), default=0)  # Total owed to PayFine
    
    # Invoice details
    invoice_number = db.Column(db.String(50), unique=True, nullable=True)
    invoice_issued_at = db.Column(db.DateTime, nullable=True)
    invoice_due_date = db.Column(db.Date, nullable=True)
    
    # Payment status
    status = db.Column(db.String(20), default='pending')  # pending, invoiced, paid, overdue
    paid_at = db.Column(db.DateTime, nullable=True)
    payment_reference = db.Column(db.String(100), nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def calculate_fees(self):
        """Calculate platform fees based on revenue"""
        if self.total_revenue and self.platform_fee_percentage:
            self.platform_fee_amount = (self.total_revenue * self.platform_fee_percentage) / 100
            self.total_fees = self.platform_fee_amount + (self.pilot_ops_fee or 0)
        return self.total_fees
    
    def to_dict(self):
        """Convert billing record to dictionary"""
        return {
            'id': self.id,
            'government_id': self.government_id,
            'billing_period_start': self.billing_period_start.isoformat(),
            'billing_period_end': self.billing_period_end.isoformat(),
            'billing_month': self.billing_month,
            'transaction_count': self.transaction_count,
            'successful_transactions': self.successful_transactions,
            'failed_transactions': self.failed_transactions,
            'total_revenue': float(self.total_revenue),
            'platform_fee_percentage': float(self.platform_fee_percentage),
            'platform_fee_amount': float(self.platform_fee_amount),
            'pilot_ops_fee': float(self.pilot_ops_fee) if self.pilot_ops_fee else 0,
            'total_fees': float(self.total_fees),
            'invoice_number': self.invoice_number,
            'invoice_issued_at': self.invoice_issued_at.isoformat() if self.invoice_issued_at else None,
            'invoice_due_date': self.invoice_due_date.isoformat() if self.invoice_due_date else None,
            'status': self.status,
            'paid_at': self.paid_at.isoformat() if self.paid_at else None,
            'payment_reference': self.payment_reference,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
    
    def __repr__(self):
        return f'<GovernmentBilling {self.billing_month} - {self.government_id}>'


# ============================================================================
# GOVERNMENT-SCOPED MODELS
# ============================================================================

class Service(db.Model):
    """
    Service model - represents different government services
    Allows modular expansion (traffic fines, license renewal, etc.)
    
    MULTI-TENANT: Scoped by government_id
    
    Service Types:
    - traffic_fines: Traffic violation tickets
    - parking: Parking permits and fines
    - vehicle_licensing: Vehicle registration and renewals
    - business_licenses: Business permit applications
    - property_tax: Property tax payments
    - permits: General permit applications
    - other: Other government services/fines
    """
    __tablename__ = 'services'
    
    id = db.Column(db.Integer, primary_key=True)
    government_id = db.Column(db.String(36), db.ForeignKey('governments.id'), nullable=False, index=True)
    
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Enhanced fields for multi-service support
    service_type = db.Column(db.String(50), default='other')  # traffic_fines, parking, vehicle_licensing, etc.
    icon = db.Column(db.String(10), default='📋')  # Emoji icon for display
    display_order = db.Column(db.Integer, default=0)  # Order to display services
    
    # Relationship to tickets
    tickets = db.relationship('Ticket', backref='service', lazy=True, cascade='all, delete-orphan')
    
    # Composite unique constraint: name must be unique per government
    __table_args__ = (
        Index('ix_service_government_name', 'government_id', 'name', unique=True),
    )
    
    def to_dict(self):
        """Convert service to dictionary for JSON response"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'is_active': self.is_active,
            'service_type': self.service_type,
            'icon': self.icon,
            'display_order': self.display_order,
            'created_at': self.created_at.isoformat()
        }
    
    def __repr__(self):
        return f'<Service {self.name}>'


class Ticket(db.Model):
    """
    Ticket model - represents traffic tickets or other service tickets
    Tracks payment status, amounts, and due dates
    Enhanced with admin features: void, refund, manual payment
    Enhanced with late fees auto-calculation
    
    MULTI-TENANT: Scoped by government_id
    """
    __tablename__ = 'tickets'
    
    id = db.Column(db.Integer, primary_key=True)
    government_id = db.Column(db.String(36), db.ForeignKey('governments.id'), nullable=False, index=True)
    
    serial_number = db.Column(db.String(20), nullable=False, index=True)
    fine_amount = db.Column(db.Numeric(10, 2), nullable=False)
    status = db.Column(db.String(20), default='unpaid')  # unpaid, paid, overdue, voided, refunded
    issue_date = db.Column(db.DateTime, default=datetime.utcnow)
    due_date = db.Column(db.DateTime, nullable=False)
    paid_date = db.Column(db.DateTime, nullable=True)
    payment_reference = db.Column(db.String(100), nullable=True)
    
    # Late Fee Fields
    late_fees_added = db.Column(db.Numeric(10, 2), default=0)  # Total late fees accumulated
    last_late_fee_calculated_at = db.Column(db.DateTime, nullable=True)  # Prevent duplicate calculations
    late_fee_paused = db.Column(db.Boolean, default=False)  # Pause during dispute/appeal
    
    # Foreign key to service
    service_id = db.Column(db.Integer, db.ForeignKey('services.id'), nullable=False)
    
    # Composite unique constraint: serial_number must be unique per government
    __table_args__ = (
        Index('ix_ticket_government_serial', 'government_id', 'serial_number', unique=True),
    )
    
    # NATIONAL TRAFFIC OFFENCE SYSTEM INTEGRATION
    # Links ticket to specific offence with auto-calculated fine
    offence_id = db.Column(db.Integer, db.ForeignKey('offences.id'), nullable=True, index=True)
    measured_value = db.Column(db.Numeric(10, 2), nullable=True)  # Speed, BAC, distance, etc.
    calculated_fine = db.Column(db.Numeric(10, 2), nullable=True)  # Auto-calculated from PenaltyRule
    points = db.Column(db.Integer, default=0)  # Demerit points
    court_required = db.Column(db.Boolean, default=False, index=True)  # Requires court appearance
    is_repeat_offence = db.Column(db.Boolean, default=False)  # Repeat offender flag
    repeat_count = db.Column(db.Integer, default=0)  # Number of prior similar offences
    
    # Additional ticket details (legacy field for backward compatibility)
    offense_description = db.Column(db.Text, nullable=True)
    vehicle_plate = db.Column(db.String(20), nullable=True)
    officer_badge = db.Column(db.String(20), nullable=True)
    location = db.Column(db.String(200), nullable=True)
    driver_name = db.Column(db.String(120), nullable=True)
    driver_license = db.Column(db.String(50), nullable=True)
    
    # Geolocation fields for Google Maps integration
    latitude = db.Column(db.Numeric(10, 8), nullable=True)  # e.g., 13.0969 (Barbados)
    longitude = db.Column(db.Numeric(11, 8), nullable=True)  # e.g., -59.6145 (Barbados)
    
    # National ID Integration (Government-specific National ID System)
    # Each government may have their own national ID system (e.g., Trident ID in Barbados)
    # We store a hashed reference for privacy - never the full National ID number
    national_id_reference = db.Column(db.String(255), nullable=True, index=True)  # Hashed National ID
    national_id_verified = db.Column(db.Boolean, default=False)  # Has citizen verified ownership?
    national_id_verified_at = db.Column(db.DateTime, nullable=True)  # When was it verified?
    
    # Citizen contact information (for notifications)
    # These are populated from Trident ID system or entered at ticket issuance
    citizen_email = db.Column(db.String(120), nullable=True)
    citizen_phone = db.Column(db.String(20), nullable=True)
    
    # Notification tracking
    notification_sent = db.Column(db.Boolean, default=False)
    notification_sent_at = db.Column(db.DateTime, nullable=True)
    notification_method = db.Column(db.String(20), nullable=True)  # 'sms', 'email', 'both'
    
    # QR Code for printed tickets (links to PayFine payment page)
    qr_code_data = db.Column(db.Text, nullable=True)  # URL or data for QR code
    
    # Payment details
    payment_method = db.Column(db.String(50), nullable=True)  # online, manual, cash, check
    payment_amount = db.Column(db.Numeric(10, 2), nullable=True)
    
    # Admin actions
    voided_at = db.Column(db.DateTime, nullable=True)
    voided_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    void_reason = db.Column(db.Text, nullable=True)
    
    refunded_at = db.Column(db.DateTime, nullable=True)
    refunded_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    refund_reason = db.Column(db.Text, nullable=True)
    refund_amount = db.Column(db.Numeric(10, 2), nullable=True)
    
    # Photo evidence (optional for visual evidence)
    photo_data = db.Column(db.Text, nullable=True)  # Base64 encoded image data
    photo_filename = db.Column(db.String(255), nullable=True)  # Original filename
    photo_uploaded_at = db.Column(db.DateTime, nullable=True)  # When photo was uploaded

    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    
    def calculate_fine(self):
        """
        Auto-calculate fine based on offence and measured value
        
        This is the CORE LOGIC that removes penalty uncertainty.
        Fines are calculated from admin-defined PenaltyRule, not arbitrary amounts.
        
        Process:
        1. Get offence and find matching PenaltyRule
        2. Apply base_fine from rule
        3. Check for repeat offences (same driver, same category, last 12 months)
        4. Apply repeat_multiplier if repeat offence detected
        5. Set points and court_required from rule
        
        Returns:
            Decimal: Calculated fine amount, or None if no matching rule
        """
        if not self.offence_id:
            # Legacy ticket without offence - use fine_amount
            return self.fine_amount
        
        # Get the offence
        offence = Offence.query.get(self.offence_id)
        if not offence:
            return None
        
        # Find matching penalty rule
        penalty_rule = offence.get_active_penalty_rule(self.measured_value)
        if not penalty_rule:
            return None
        
        # Check for repeat offences if driver license provided
        is_repeat = False
        if self.driver_license and offence.category_id:
            is_repeat = self._check_repeat_offence(offence.category_id)
        
        # Calculate fine with repeat multiplier if applicable
        calculated = penalty_rule.calculate_fine(is_repeat_offence=is_repeat)
        
        # Update ticket fields
        self.calculated_fine = calculated
        self.points = penalty_rule.points
        self.court_required = penalty_rule.court_required
        self.is_repeat_offence = is_repeat
        
        return calculated
    
    def _check_repeat_offence(self, offence_category_id, lookback_months=12):
        """
        Check if driver has prior offences in same category
        
        REPEAT OFFENDER DETECTION:
        Searches for paid tickets by same driver in same offence category
        within the lookback period (default 12 months).
        
        Args:
            offence_category_id: Category to check for repeats
            lookback_months: How far back to look (default 12)
        
        Returns:
            bool: True if repeat offence detected
        """
        if not self.driver_license:
            return False
        
        lookback_date = datetime.utcnow() - timedelta(days=lookback_months * 30)
        
        # Find prior tickets by same driver in same category
        prior_tickets = Ticket.query.join(Offence).filter(
            Ticket.driver_license == self.driver_license,
            Ticket.id != self.id,  # Exclude current ticket
            Ticket.status == 'paid',  # Only count paid tickets
            Offence.category_id == offence_category_id,
            Ticket.issue_date >= lookback_date
        ).count()
        
        self.repeat_count = prior_tickets
        return prior_tickets > 0
    
    def can_pay_online(self):
        """
        Determine if ticket can be paid online
        
        PAYMENT ELIGIBILITY RULES:
        Online payment is BLOCKED if:
        1. court_required = True (serious offences require judicial review)
        2. Ticket is challenged (must be resolved first)
        3. Ticket is already paid, voided, or dismissed
        
        Online payment is ALLOWED if:
        1. Status is 'unpaid', 'overdue', 'payable', or 'adjusted'
        2. court_required = False
        3. No active challenge
        
        This preserves judicial review rights while enabling convenient payment
        for standard offences.
        
        Returns:
            bool: True if online payment allowed
        """
        # Check if court appearance required
        if self.court_required:
            return False
        
        # Check if ticket has active challenge
        if hasattr(self, 'challenge') and self.challenge:
            if self.challenge.status in ['Pending', 'UnderReview']:
                return False
        
        # Check ticket status
        payable_statuses = ['unpaid', 'overdue', 'payable', 'adjusted', 'issued', 'verified']
        if self.status.lower() not in payable_statuses:
            return False
        
        return True
    
    def get_total_due(self):
        """
        Calculate total amount due (original fine + late fees)
        
        Returns:
            Decimal: Total amount owed
        """
        return self.fine_amount + (self.late_fees_added or 0)
    
    def days_overdue(self):
        """
        Calculate number of days ticket is overdue
        
        Returns:
            int: Days overdue (0 if not overdue)
        """
        if not self.is_overdue():
            return 0
        return (datetime.utcnow() - self.due_date).days
    
    def is_overdue(self):
        """Check if ticket is past due date"""
        return datetime.utcnow() > self.due_date and self.status in ['unpaid', 'overdue']
    
    def update_status(self):
        """Update status based on due date"""
        if self.status == 'unpaid' and self.is_overdue():
            self.status = 'overdue'
    
    def days_until_due(self):
        """Calculate days until due date"""
        return (self.due_date - datetime.utcnow()).days
    
    def get_verification_status(self):
        """
        Get human-readable verification status
        Returns: 'issued', 'unverified', 'verified', 'paid'
        """
        if self.status == 'paid':
            return 'paid'
        elif self.national_id_verified:
            return 'verified'
        elif self.national_id_reference:
            return 'unverified'
        else:
            return 'issued'
    
    def to_dict(self, include_admin=False, include_trident=False):
        """
        Convert ticket to dictionary for JSON response
        
        Args:
            include_admin: Include admin-only fields (void, refund data)
            include_trident: Include Trident ID verification status (admin only)
        """
        self.update_status()
        is_overdue = self.is_overdue()
        days_until_due = self.days_until_due()
        
        # Generate photo_url from photo_data if available
        photo_url = None
        if self.photo_data:
            # If photo_data is already a data URL, use it directly
            if self.photo_data.startswith('data:'):
                photo_url = self.photo_data
            else:
                # Otherwise, assume it's base64 and create a data URL
                photo_url = f"data:image/jpeg;base64,{self.photo_data}"
        
        data = {
            'id': self.id,
            'serial_number': self.serial_number,
            'fine_amount': float(self.fine_amount),
            'status': self.status,
            'verification_status': self.get_verification_status(),
            'issue_date': self.issue_date.isoformat(),
            'due_date': self.due_date.isoformat(),
            'paid_date': self.paid_date.isoformat() if self.paid_date else None,
            'payment_reference': self.payment_reference,
            'service': self.service.to_dict() if self.service else None,
            'offense_description': self.offense_description,
            'vehicle_plate': self.vehicle_plate,
            'officer_badge': self.officer_badge,
            'location': self.location,
            'latitude': float(self.latitude) if self.latitude else None,
            'longitude': float(self.longitude) if self.longitude else None,
            'driver_name': self.driver_name,
            'driver_license': self.driver_license,
            'payment_method': self.payment_method,
            'payment_amount': float(self.payment_amount) if self.payment_amount else None,
            'is_overdue': is_overdue,
            'days_until_due': days_until_due,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'qr_code_data': self.qr_code_data,

            # Photo evidence fields
            'has_photo': bool(self.photo_data),
            'photo_url': photo_url,
            'photo_filename': self.photo_filename,
            'photo_uploaded_at': self.photo_uploaded_at.isoformat() if self.photo_uploaded_at else None,

            # NATIONAL TRAFFIC OFFENCE SYSTEM FIELDS
            'offence_id': self.offence_id,
            'offence': self.offence.to_dict() if self.offence else None,
            'measured_value': float(self.measured_value) if self.measured_value else None,
            'calculated_fine': float(self.calculated_fine) if self.calculated_fine else float(self.fine_amount),
            'points': self.points,
            'court_required': self.court_required,
            'is_repeat_offence': self.is_repeat_offence,
            'repeat_count': self.repeat_count,
            'can_pay_online': self.can_pay_online(),
            'has_challenge': hasattr(self, 'challenge') and self.challenge is not None,
            'challenge_status': self.challenge.status if hasattr(self, 'challenge') and self.challenge else None,
            
            # Late fee fields
            'late_fees_added': float(self.late_fees_added) if self.late_fees_added else 0,
            'total_due': float(self.get_total_due()),
            'days_overdue': self.days_overdue(),
            'late_fee_paused': self.late_fee_paused,
            'last_late_fee_calculated_at': self.last_late_fee_calculated_at.isoformat() if self.last_late_fee_calculated_at else None
        }
        
        if include_admin:
            data.update({
                'voided_at': self.voided_at.isoformat() if self.voided_at else None,
                'voided_by_id': self.voided_by_id,
                'void_reason': self.void_reason,
                'refunded_at': self.refunded_at.isoformat() if self.refunded_at else None,
                'refunded_by_id': self.refunded_by_id,
                'refund_reason': self.refund_reason,
                'refund_amount': float(self.refund_amount) if self.refund_amount else None,
                'created_by_id': self.created_by_id,
                'notes': self.notes
            })
        
        if include_trident:
            # Only include National ID data for admin users
            data.update({
                'national_id_verified': self.national_id_verified,
                'national_id_verified_at': self.national_id_verified_at.isoformat() if self.national_id_verified_at else None,
                'has_national_id_link': bool(self.national_id_reference),
                'citizen_email': self.citizen_email,
                'citizen_phone': self.citizen_phone,
                'notification_sent': self.notification_sent,
                'notification_sent_at': self.notification_sent_at.isoformat() if self.notification_sent_at else None,
                'notification_method': self.notification_method
            })
        
        return data
    
    def __repr__(self):
        return f'<Ticket {self.serial_number}>'


class User(db.Model):
    """
    User model - for authentication and user management
    Supports JWT-based authentication with password hashing
    Enhanced with role-based access control
    
    MULTI-TENANT: Scoped by government_id
    Government admins and staff can only access their government's data
    """
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    government_id = db.Column(db.String(36), db.ForeignKey('governments.id'), nullable=False, index=True)
    
    username = db.Column(db.String(80), nullable=False, index=True)
    email = db.Column(db.String(120), nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    
    # Composite unique constraints: username and email must be unique per government
    __table_args__ = (
        Index('ix_user_government_username', 'government_id', 'username', unique=True),
        Index('ix_user_government_email', 'government_id', 'email', unique=True),
    )
    
    # User details
    full_name = db.Column(db.String(200), nullable=True)
    phone = db.Column(db.String(20), nullable=True)
    is_admin = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    custom_panels = db.Column(db.Text, nullable=True)  # JSON array of custom panel access
    role = db.Column(db.String(20), default='user')  # 'admin', 'staff', 'user'
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    # Relationships
    created_tickets = db.relationship('Ticket', backref='created_by_user', lazy=True, 
                                     foreign_keys='Ticket.created_by_id')
    voided_tickets = db.relationship('Ticket', backref='voided_by_user', lazy=True,
                                    foreign_keys='Ticket.voided_by_id')
    refunded_tickets = db.relationship('Ticket', backref='refunded_by_user', lazy=True,
                                      foreign_keys='Ticket.refunded_by_id')
    
    def set_password(self, password):
        """Hash and set user password"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Verify password against hash"""
        return check_password_hash(self.password_hash, password)
    
    def has_permission(self, permission):
        """
        Check if user has a specific permission
        
        Args:
            permission: Permission constant from permissions.py
        
        Returns:
            bool: True if user has permission
        """
        from .permissions import user_has_permission
        return user_has_permission(self, permission)
    
    def get_custom_panels(self):
        """Get user's custom panel access list"""
        if self.custom_panels:
            try:
                import json
                return json.loads(self.custom_panels)
            except:
                return None
        return None
    
    def set_custom_panels(self, panels):
        """Set user's custom panel access list"""
        if panels is None:
            self.custom_panels = None
        else:
            import json
            self.custom_panels = json.dumps(panels)
    
    def get_permissions(self):
        """
        Get all permissions for this user based on their role

        Returns:
            list: List of permission strings
        """
        from .permissions import get_user_permissions
        return get_user_permissions(self)
    
    def get_accessible_panels(self):
        """
        Get list of admin panels this user can access
        
        Returns:
            list: List of panel names
        """
        from .permissions import get_user_accessible_panels
        return get_user_accessible_panels(self)
    
    def to_dict(self, include_sensitive=False):
        """Convert user to dictionary (exclude sensitive data by default)"""
        data = {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'full_name': self.full_name,
            'phone': self.phone,
            'is_admin': self.is_admin,
            'is_active': self.is_active,
            'role': self.role,
            'created_at': self.created_at.isoformat(),
            'last_login': self.last_login.isoformat() if self.last_login else None
        }
        
        if include_sensitive:
            data['created_by_id'] = self.created_by_id
            data['permissions'] = self.get_permissions()
            data['accessible_panels'] = self.get_accessible_panels()
        
        return data
    
    def __repr__(self):
        return f'<User {self.username}>'


# ============================================================================
# NATIONAL TRAFFIC OFFENCE & PENALTY SYSTEM MODELS
# ============================================================================

class OffenceCategory(db.Model):
    """
    Offence Category model - groups related traffic offences
    
    Examples: Speeding, Dangerous Driving, License Violations, etc.
    Allows logical organization and reporting of offences.
    
    MULTI-TENANT: Scoped by government_id
    Each government defines their own offence categories
    
    DESIGN NOTE: Categories help admins organize offences and citizens
    understand the nature of their violation.
    """
    __tablename__ = 'offence_categories'
    
    id = db.Column(db.Integer, primary_key=True)
    government_id = db.Column(db.String(36), db.ForeignKey('governments.id'), nullable=False, index=True)
    
    code = db.Column(db.String(50), nullable=False, index=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    active = db.Column(db.Boolean, default=True, index=True)
    
    # Composite unique constraint: code must be unique per government
    __table_args__ = (
        Index('ix_offence_category_government_code', 'government_id', 'code', unique=True),
    )
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    offences = db.relationship('Offence', backref='category', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        """Convert category to dictionary for JSON response"""
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'description': self.description,
            'active': self.active,
            'offence_count': len([o for o in self.offences if o.active]),
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
    
    def __repr__(self):
        return f'<OffenceCategory {self.code}: {self.name}>'


class Offence(db.Model):
    """
    Offence model - specific traffic violations
    
    Supports both fixed offences (e.g., running red light) and measurable
    offences (e.g., speeding by X km/h over limit).
    
    MULTI-TENANT: Scoped by government_id
    Each government defines their own offences and penalties
    
    MEASURABLE TYPES:
    - 'none': Fixed offence (no measurement needed)
    - 'speed': Speed over limit in km/h
    - 'alcohol': Blood Alcohol Content (BAC) percentage
    - 'distance': Distance in meters (e.g., following too close)
    
    DESIGN NOTE: Separating Offence from PenaltyRule allows:
    1. Same offence to have different penalties over time (effective dates)
    2. Tiered penalties (multiple rules for same offence with different ranges)
    3. Historical tracking of penalty changes
    """
    __tablename__ = 'offences'
    
    id = db.Column(db.Integer, primary_key=True)
    government_id = db.Column(db.String(36), db.ForeignKey('governments.id'), nullable=False, index=True)
    
    code = db.Column(db.String(50), nullable=False, index=True)
    name = db.Column(db.String(200), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('offence_categories.id'), nullable=False, index=True)
    description = db.Column(db.Text, nullable=True)
    
    # Composite unique constraint: code must be unique per government
    __table_args__ = (
        Index('ix_offence_government_code', 'government_id', 'code', unique=True),
    )
    
    # Measurable offence configuration
    measurable_type = db.Column(db.String(20), default='none')  # 'none', 'speed', 'alcohol', 'distance'
    unit = db.Column(db.String(20), nullable=True)  # 'km/h', '%BAC', 'meters', etc.
    
    active = db.Column(db.Boolean, default=True, index=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    penalty_rules = db.relationship('PenaltyRule', backref='offence', lazy=True, cascade='all, delete-orphan')
    tickets = db.relationship('Ticket', backref='offence', lazy=True)
    
    def get_active_penalty_rule(self, measured_value=None):
        """
        Get the active penalty rule for this offence
        
        For measurable offences, finds rule where:
        - government_id matches (MULTI-TENANT ISOLATION)
        - min_value <= measured_value <= max_value
        - effective_from <= today <= effective_to (or effective_to is NULL)
        - active = True
        
        For fixed offences, returns the active rule for today's date.
        
        Returns None if no matching rule found.
        """
        today = datetime.utcnow().date()
        
        # Build query for active rules - MUST include government_id for multi-tenant isolation
        query = PenaltyRule.query.filter(
            PenaltyRule.government_id == self.government_id,  # CRITICAL: Multi-tenant filter
            PenaltyRule.offence_id == self.id,
            PenaltyRule.active == True,
            PenaltyRule.effective_from <= today
        ).filter(
            or_(
                PenaltyRule.effective_to == None,
                PenaltyRule.effective_to >= today
            )
        )
        
        # For measurable offences, filter by value range
        if self.measurable_type != 'none' and measured_value is not None:
            query = query.filter(
                and_(
                    or_(PenaltyRule.min_value == None, PenaltyRule.min_value <= measured_value),
                    or_(PenaltyRule.max_value == None, PenaltyRule.max_value >= measured_value)
                )
            )
        
        # Return first matching rule (should only be one)
        return query.first()
    
    def to_dict(self, include_rules=False):
        """Convert offence to dictionary for JSON response"""
        data = {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'category_id': self.category_id,
            'category': self.category.to_dict() if self.category else None,
            'description': self.description,
            'measurable_type': self.measurable_type,
            'unit': self.unit,
            'is_measurable': self.measurable_type != 'none',
            'active': self.active,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
        
        if include_rules:
            data['penalty_rules'] = [rule.to_dict() for rule in self.penalty_rules if rule.active]
        
        return data
    
    def __repr__(self):
        return f'<Offence {self.code}: {self.name}>'


class PenaltyRule(db.Model):
    """
    Penalty Rule model - defines fines, points, and court requirements
    
    This is the SINGLE SOURCE OF TRUTH for all penalty amounts.
    NO ARBITRARY FINES: All ticket fines must be calculated from this table.
    
    MULTI-TENANT: Scoped by government_id
    Each government sets their own penalty amounts and rules
    
    TIERED PENALTIES:
    Multiple rules can exist for the same offence with different value ranges.
    Example: Speeding
    - Rule 1: 1-10 km/h over = $50, 0 points
    - Rule 2: 11-20 km/h over = $100, 2 points
    - Rule 3: 21-30 km/h over = $200, 3 points
    - Rule 4: 31+ km/h over = $500, 6 points, court required
    
    REPEAT OFFENDER LOGIC:
    - repeat_multiplier: Applied to base_fine for repeat offences (default 1.5x)
    - Example: Second speeding ticket in 12 months = $100 * 1.5 = $150
    
    EFFECTIVE DATES:
    - effective_from: When this rule becomes active
    - effective_to: When this rule expires (NULL = no expiry)
    - Allows penalty changes over time while preserving historical data
    
    COURT REQUIRED:
    - court_required = True: Blocks online payment, requires court appearance
    - Used for serious offences: DUI, dangerous driving, excessive speed
    """
    __tablename__ = 'penalty_rules'
    
    id = db.Column(db.Integer, primary_key=True)
    government_id = db.Column(db.String(36), db.ForeignKey('governments.id'), nullable=False, index=True)
    offence_id = db.Column(db.Integer, db.ForeignKey('offences.id'), nullable=False, index=True)
    
    # Value range for measurable offences (NULL for fixed offences)
    min_value = db.Column(db.Numeric(10, 2), nullable=True)
    max_value = db.Column(db.Numeric(10, 2), nullable=True)
    
    # Penalty details
    base_fine = db.Column(db.Numeric(10, 2), nullable=False)
    points = db.Column(db.Integer, default=0)  # Demerit points
    court_required = db.Column(db.Boolean, default=False, index=True)
    
    # Repeat offender multiplier (applied to base_fine)
    repeat_multiplier = db.Column(db.Numeric(4, 2), default=1.5)
    
    # Effective date range
    effective_from = db.Column(db.Date, nullable=False, default=datetime.utcnow)
    effective_to = db.Column(db.Date, nullable=True)
    
    active = db.Column(db.Boolean, default=True, index=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def calculate_fine(self, is_repeat_offence=False):
        """
        Calculate final fine amount
        
        Args:
            is_repeat_offence: Whether this is a repeat offence
        
        Returns:
            Decimal: Final fine amount
        
        DESIGN NOTE: This ensures consistent fine calculation across the system.
        Repeat offenders automatically pay higher fines as a deterrent.
        """
        fine = self.base_fine
        
        if is_repeat_offence:
            fine = fine * self.repeat_multiplier
        
        return fine
    
    def is_currently_effective(self):
        """Check if this rule is currently in effect"""
        today = datetime.utcnow().date()
        
        if not self.active:
            return False
        
        if self.effective_from > today:
            return False
        
        if self.effective_to and self.effective_to < today:
            return False
        
        return True
    
    def to_dict(self):
        """Convert penalty rule to dictionary for JSON response"""
        return {
            'id': self.id,
            'offence_id': self.offence_id,
            'offence': self.offence.to_dict() if self.offence else None,
            'min_value': float(self.min_value) if self.min_value else None,
            'max_value': float(self.max_value) if self.max_value else None,
            'base_fine': float(self.base_fine),
            'points': self.points,
            'court_required': self.court_required,
            'repeat_multiplier': float(self.repeat_multiplier),
            'effective_from': self.effective_from.isoformat(),
            'effective_to': self.effective_to.isoformat() if self.effective_to else None,
            'active': self.active,
            'is_currently_effective': self.is_currently_effective(),
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
    
    def __repr__(self):
        range_str = ''
        if self.min_value or self.max_value:
            range_str = f' ({self.min_value}-{self.max_value})'
        return f'<PenaltyRule {self.offence.code if self.offence else "?"}{range_str}: ${self.base_fine}>'


class TicketChallenge(db.Model):
    """
    Ticket Challenge model - allows citizens to contest tickets
    
    PRESERVES JUDICIAL REVIEW RIGHTS:
    This model ensures citizens can challenge tickets they believe are unjust.
    Admins can review challenges and take appropriate action:
    1. Dismiss ticket entirely (citizen was right)
    2. Adjust fine within bounds (partial merit)
    3. Uphold original fine (no merit)
    
    PAYMENT BLOCKING:
    When a challenge is submitted, the ticket status changes to 'Challenged'
    and online payment is blocked until the challenge is resolved.
    
    ACCOUNTABILITY:
    All admin actions are logged with notes and timestamps for audit trail.
    """
    __tablename__ = 'ticket_challenges'
    
    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('tickets.id'), nullable=False, unique=True, index=True)
    
    # Challenge details
    reason = db.Column(db.Text, nullable=False)
    evidence = db.Column(db.Text, nullable=True)  # URLs, descriptions, or file references
    
    # Status tracking
    status = db.Column(db.String(20), default='Pending', index=True)  # Pending, UnderReview, Approved, Rejected
    
    # Review details
    reviewed_at = db.Column(db.DateTime, nullable=True)
    reviewed_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    admin_notes = db.Column(db.Text, nullable=True)
    
    # Outcome
    outcome = db.Column(db.String(20), nullable=True)  # Dismissed, FineAdjusted, Upheld
    adjusted_fine = db.Column(db.Numeric(10, 2), nullable=True)
    
    # Timestamps
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    ticket = db.relationship('Ticket', backref=db.backref('challenge', uselist=False))
    reviewed_by = db.relationship('User', foreign_keys=[reviewed_by_id])
    
    def can_adjust_fine(self, new_fine):
        """
        Check if fine adjustment is within allowed bounds
        
        DESIGN NOTE: Admins can adjust fines ±20% of calculated fine to account
        for mitigating circumstances while preventing arbitrary amounts.
        
        Args:
            new_fine: Proposed adjusted fine
        
        Returns:
            bool: True if adjustment is within bounds
        """
        if not self.ticket or not self.ticket.calculated_fine:
            return False
        
        original_fine = float(self.ticket.calculated_fine)
        min_allowed = original_fine * 0.8  # 20% reduction
        max_allowed = original_fine * 1.2  # 20% increase
        
        return min_allowed <= float(new_fine) <= max_allowed
    
    def to_dict(self, include_ticket=False):
        """Convert challenge to dictionary for JSON response"""
        data = {
            'id': self.id,
            'ticket_id': self.ticket_id,
            'reason': self.reason,
            'evidence': self.evidence,
            'status': self.status,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'reviewed_by_id': self.reviewed_by_id,
            'reviewed_by': self.reviewed_by.to_dict() if self.reviewed_by else None,
            'admin_notes': self.admin_notes,
            'outcome': self.outcome,
            'adjusted_fine': float(self.adjusted_fine) if self.adjusted_fine else None,
            'submitted_at': self.submitted_at.isoformat(),
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
        
        if include_ticket and self.ticket:
            data['ticket'] = self.ticket.to_dict(include_admin=True)
        
        return data
    
    def __repr__(self):
        return f'<TicketChallenge {self.id} for Ticket {self.ticket_id}: {self.status}>'


# ============================================================================
# LATE FEE AUTO-CALCULATION SYSTEM MODELS
# ============================================================================

class LateFeeConfiguration(db.Model):
    """
    Late Fee Configuration model - Global late fee settings per government
    
    Defines how late fees are calculated and applied for overdue tickets.
    Each government can configure their own late fee rules.
    
    MULTI-TENANT: Scoped by government_id
    
    FEE STRUCTURE TYPES:
    - 'flat': Fixed amount after X days (e.g., $25 after 15 days)
    - 'tiered': Different flat fees at different day ranges
    - 'percentage': Percentage of unpaid balance per period
    - 'daily': Fixed amount per day after grace period
    - 'combination': Flat initial fee + ongoing percentage/daily
    
    CONFIG JSON EXAMPLES:
    
    Flat: {"amount": 25, "after_days": 15}
    Tiered: {"tiers": [{"days": 15, "amount": 25}, {"days": 45, "amount": 50}]}
    Percentage: {"rate": 1.5, "period": "monthly", "compound": false}
    Daily: {"amount": 1, "max_days": 90}
    Combination: {"initial_flat": 25, "after_days": 15, "then_daily": 1}
    """
    __tablename__ = 'late_fee_configurations'
    
    id = db.Column(db.Integer, primary_key=True)
    government_id = db.Column(db.String(36), db.ForeignKey('governments.id'), nullable=False, index=True)
    
    # Enable/disable
    enabled = db.Column(db.Boolean, default=False)
    
    # Grace period
    grace_period_days = db.Column(db.Integer, default=0)  # Days after due_date before first fee
    
    # Fee structure
    fee_structure_type = db.Column(db.String(20), default='flat')  # flat, tiered, percentage, daily, combination
    config_json = db.Column(db.Text, nullable=True)  # JSON configuration for the selected structure
    
    # Caps
    max_fee_cap_amount = db.Column(db.Numeric(10, 2), nullable=True)  # Absolute maximum late fee
    max_fee_cap_percentage = db.Column(db.Numeric(5, 2), nullable=True)  # Max as % of original fine
    
    # Application rules
    apply_to_original_only = db.Column(db.Boolean, default=True)  # True = apply to original fine only, False = apply to growing total
    pause_during_dispute = db.Column(db.Boolean, default=True)  # Pause accrual during challenge/appeal
    
    # Status
    active = db.Column(db.Boolean, default=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def get_config(self):
        """Parse and return configuration JSON"""
        if not self.config_json:
            return {}
        try:
            return json.loads(self.config_json)
        except (json.JSONDecodeError, TypeError):
            return {}
    
    def set_config(self, config_dict):
        """Set configuration from dictionary"""
        self.config_json = json.dumps(config_dict)
    
    def to_dict(self):
        """Convert to dictionary for JSON response"""
        return {
            'id': self.id,
            'government_id': self.government_id,
            'enabled': self.enabled,
            'grace_period_days': self.grace_period_days,
            'fee_structure_type': self.fee_structure_type,
            'config': self.get_config(),
            'max_fee_cap_amount': float(self.max_fee_cap_amount) if self.max_fee_cap_amount else None,
            'max_fee_cap_percentage': float(self.max_fee_cap_percentage) if self.max_fee_cap_percentage else None,
            'apply_to_original_only': self.apply_to_original_only,
            'pause_during_dispute': self.pause_during_dispute,
            'active': self.active,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
    
    def __repr__(self):
        return f'<LateFeeConfiguration {self.government_id}: {self.fee_structure_type}>'


class LateFeeRule(db.Model):
    """
    Late Fee Rule model - Per-offence or per-category late fee overrides
    
    Allows governments to set different late fee rules for specific offences
    or offence categories. Rules are prioritized:
    1. Offence-specific rules (highest priority)
    2. Category-specific rules
    3. Global configuration (lowest priority)
    
    MULTI-TENANT: Scoped by government_id
    
    PRIORITY SYSTEM:
    - Higher priority number = higher precedence
    - Offence-specific rules should have priority > category rules
    - Category rules should have priority > global config
    """
    __tablename__ = 'late_fee_rules'
    
    id = db.Column(db.Integer, primary_key=True)
    government_id = db.Column(db.String(36), db.ForeignKey('governments.id'), nullable=False, index=True)
    
    # Rule scope
    offence_category_id = db.Column(db.Integer, db.ForeignKey('offence_categories.id'), nullable=True, index=True)
    offence_id = db.Column(db.Integer, db.ForeignKey('offences.id'), nullable=True, index=True)
    priority = db.Column(db.Integer, default=0)  # Higher = higher precedence
    
    # Rule name/description
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    
    # Same configuration fields as LateFeeConfiguration
    enabled = db.Column(db.Boolean, default=True)
    grace_period_days = db.Column(db.Integer, default=0)
    fee_structure_type = db.Column(db.String(20), default='flat')
    config_json = db.Column(db.Text, nullable=True)
    max_fee_cap_amount = db.Column(db.Numeric(10, 2), nullable=True)
    max_fee_cap_percentage = db.Column(db.Numeric(5, 2), nullable=True)
    apply_to_original_only = db.Column(db.Boolean, default=True)
    pause_during_dispute = db.Column(db.Boolean, default=True)
    
    # Effective dates
    effective_from = db.Column(db.Date, nullable=False, default=datetime.utcnow)
    effective_to = db.Column(db.Date, nullable=True)
    
    # Status
    active = db.Column(db.Boolean, default=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    offence_category = db.relationship('OffenceCategory', foreign_keys=[offence_category_id])
    offence = db.relationship('Offence', foreign_keys=[offence_id])
    
    def get_config(self):
        """Parse and return configuration JSON"""
        if not self.config_json:
            return {}
        try:
            return json.loads(self.config_json)
        except (json.JSONDecodeError, TypeError):
            return {}
    
    def set_config(self, config_dict):
        """Set configuration from dictionary"""
        self.config_json = json.dumps(config_dict)
    
    def is_currently_effective(self):
        """Check if this rule is currently in effect"""
        today = datetime.utcnow().date()
        
        if not self.active:
            return False
        
        if self.effective_from > today:
            return False
        
        if self.effective_to and self.effective_to < today:
            return False
        
        return True
    
    def get_scope_type(self):
        """Get the scope type of this rule"""
        if self.offence_id:
            return 'offence'
        elif self.offence_category_id:
            return 'category'
        else:
            return 'global'
    
    def to_dict(self):
        """Convert to dictionary for JSON response"""
        return {
            'id': self.id,
            'government_id': self.government_id,
            'offence_category_id': self.offence_category_id,
            'offence_id': self.offence_id,
            'offence_category': self.offence_category.to_dict() if self.offence_category else None,
            'offence': self.offence.to_dict() if self.offence else None,
            'priority': self.priority,
            'scope_type': self.get_scope_type(),
            'name': self.name,
            'description': self.description,
            'enabled': self.enabled,
            'grace_period_days': self.grace_period_days,
            'fee_structure_type': self.fee_structure_type,
            'config': self.get_config(),
            'max_fee_cap_amount': float(self.max_fee_cap_amount) if self.max_fee_cap_amount else None,
            'max_fee_cap_percentage': float(self.max_fee_cap_percentage) if self.max_fee_cap_percentage else None,
            'apply_to_original_only': self.apply_to_original_only,
            'pause_during_dispute': self.pause_during_dispute,
            'effective_from': self.effective_from.isoformat(),
            'effective_to': self.effective_to.isoformat() if self.effective_to else None,
            'active': self.active,
            'is_currently_effective': self.is_currently_effective(),
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
    
    def __repr__(self):
        scope = f'Offence {self.offence_id}' if self.offence_id else f'Category {self.offence_category_id}' if self.offence_category_id else 'Global'
        return f'<LateFeeRule {self.name} ({scope})>'


class LateFeeEvent(db.Model):
    """
    Late Fee Event model - Audit log of all late fee calculations
    
    Tracks every time a late fee is calculated and applied to a ticket.
    Provides complete audit trail for transparency and accountability.
    
    MULTI-TENANT: Scoped via ticket relationship
    """
    __tablename__ = 'late_fee_events'
    
    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('tickets.id'), nullable=False, index=True)
    
    # Calculation details
    calculated_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    fee_amount = db.Column(db.Numeric(10, 2), nullable=False)
    days_overdue = db.Column(db.Integer, nullable=False)
    
    # Rule applied
    rule_type = db.Column(db.String(20), nullable=False)  # 'global_config', 'category_rule', 'offence_rule'
    rule_id = db.Column(db.Integer, nullable=True)  # ID of LateFeeRule (null for global config)
    fee_structure_type = db.Column(db.String(20), nullable=False)
    
    # Calculation breakdown (JSON)
    calculation_details = db.Column(db.Text, nullable=True)  # Full calculation breakdown for transparency
    
    # Manual adjustments
    manually_adjusted = db.Column(db.Boolean, default=False)
    adjusted_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    adjustment_reason = db.Column(db.Text, nullable=True)
    
    # Waived fees
    waived = db.Column(db.Boolean, default=False)
    waived_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    waive_reason = db.Column(db.Text, nullable=True)
    waived_at = db.Column(db.DateTime, nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    ticket = db.relationship('Ticket', backref='late_fee_events')
    adjusted_by = db.relationship('User', foreign_keys=[adjusted_by_id])
    waived_by = db.relationship('User', foreign_keys=[waived_by_id])
    
    def get_calculation_details(self):
        """Parse and return calculation details JSON"""
        if not self.calculation_details:
            return {}
        try:
            return json.loads(self.calculation_details)
        except (json.JSONDecodeError, TypeError):
            return {}
    
    def set_calculation_details(self, details_dict):
        """Set calculation details from dictionary"""
        self.calculation_details = json.dumps(details_dict)
    
    def to_dict(self, include_ticket=False):
        """Convert to dictionary for JSON response"""
        data = {
            'id': self.id,
            'ticket_id': self.ticket_id,
            'calculated_at': self.calculated_at.isoformat(),
            'fee_amount': float(self.fee_amount),
            'days_overdue': self.days_overdue,
            'rule_type': self.rule_type,
            'rule_id': self.rule_id,
            'fee_structure_type': self.fee_structure_type,
            'calculation_details': self.get_calculation_details(),
            'manually_adjusted': self.manually_adjusted,
            'adjusted_by_id': self.adjusted_by_id,
            'adjusted_by': self.adjusted_by.to_dict() if self.adjusted_by else None,
            'adjustment_reason': self.adjustment_reason,
            'waived': self.waived,
            'waived_by_id': self.waived_by_id,
            'waived_by': self.waived_by.to_dict() if self.waived_by else None,
            'waive_reason': self.waive_reason,
            'waived_at': self.waived_at.isoformat() if self.waived_at else None,
            'created_at': self.created_at.isoformat()
        }
        
        if include_ticket and self.ticket:
            data['ticket'] = self.ticket.to_dict()
        
        return data
    
    def __repr__(self):
        return f'<LateFeeEvent {self.id} for Ticket {self.ticket_id}: ${self.fee_amount}>'


# ============================================================================
# GAMIFICATION MODELS
# ============================================================================

# Import gamification models
from .gamification_models import (
    CitizenProfile, Badge, CitizenBadge, Reward, CitizenReward,
    PointTransaction, Leaderboard, LeaderboardEntry, EarlyPaymentDiscount
)
