"""
PayFine - Global Multi-Tenant Configuration
Supports SQLite (dev), MySQL (DreamHost), PostgreSQL (Azure)

MULTI-TENANT ARCHITECTURE:
- No hard-coded currency or country codes
- Payment gateway credentials stored per government (encrypted)
- Dynamic configuration based on government context
"""

import os
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

class Config:
    """
    Multi-environment configuration for PayFine
    All sensitive data loaded from environment variables
    
    CRITICAL: This config is government-agnostic.
    Government-specific settings (currency, payment gateway) are stored in the database.
    """
    
    # =============================================================================
    # FLASK SETTINGS
    # =============================================================================
    
    SECRET_KEY = os.getenv('SECRET_KEY')
    if not SECRET_KEY:
        raise ValueError("SECRET_KEY must be set in environment variables")
    
    DEBUG = os.getenv('FLASK_ENV', 'production') == 'development'
    ENVIRONMENT = os.getenv('ENVIRONMENT', 'production')
    
    # =============================================================================
    # DATABASE - Multi-platform support
    # =============================================================================
    
    db_choice = os.getenv('DATABASE_TYPE', 'sqlite')
    
    if db_choice.lower() == 'postgresql':
        # PostgreSQL connection for Azure
        DB_HOST = os.getenv('DATABASE_HOST')
        DB_NAME = os.getenv('DATABASE_NAME', 'payfine_db')
        DB_USER = os.getenv('DATABASE_USER')
        DB_PASSWORD = os.getenv('DATABASE_PASSWORD')
        
        if all([DB_HOST, DB_USER, DB_PASSWORD]):
            SQLALCHEMY_DATABASE_URI = (
                f"postgresql://{DB_USER}:{DB_PASSWORD}"
                f"@{DB_HOST}:5432/{DB_NAME}?sslmode=require"
            )
        else:
            raise ValueError("PostgreSQL credentials must be set in environment variables")
        
        # PostgreSQL-specific engine options
        SQLALCHEMY_ENGINE_OPTIONS = {
            'pool_pre_ping': True,
            'pool_recycle': 300,
            'pool_size': 10,
            'max_overflow': 20,
            'echo': False,
            'connect_args': {
                'sslmode': 'require',
                'connect_timeout': 10
            }
        }
    
    elif db_choice.lower() == 'mysql':
        # MySQL connection for DreamHost shared hosting
        MYSQL_HOST = os.getenv('MYSQL_HOST', 'localhost')
        MYSQL_PORT = os.getenv('MYSQL_PORT', '3306')
        MYSQL_USER = os.getenv('MYSQL_USER')
        MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD')
        MYSQL_DATABASE = os.getenv('MYSQL_DATABASE')
        
        if all([MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE]):
            SQLALCHEMY_DATABASE_URI = (
                f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}"
                f"@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE}"
            )
        else:
            raise ValueError("MySQL credentials must be set in .env file")
        
        # MySQL-specific engine options for connection pooling
        SQLALCHEMY_ENGINE_OPTIONS = {
            'pool_pre_ping': True,
            'pool_recycle': 300,
            'pool_size': 5,
            'max_overflow': 10,
            'echo': False
        }
    
    else:
        # SQLite for local development
        basedir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
        db_path = os.path.join(basedir, 'payfine.db')
        SQLALCHEMY_DATABASE_URI = f'sqlite:///{db_path}'
        SQLALCHEMY_ENGINE_OPTIONS = {}
    
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # =============================================================================
    # JWT SETTINGS
    # =============================================================================
    
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
    if not JWT_SECRET_KEY:
        raise ValueError("JWT_SECRET_KEY must be set in environment variables")
    
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    
    # =============================================================================
    # CORS - PRODUCTION (RESTRICTED)
    # =============================================================================
    
    cors_origins_str = os.getenv('CORS_ORIGINS', '')
    if cors_origins_str:
        CORS_ORIGINS = [origin.strip() for origin in cors_origins_str.split(',')]
    else:
        CORS_ORIGINS = []
    
    # =============================================================================
    # ENCRYPTION SETTINGS
    # =============================================================================
    
    # Encryption key for sensitive data (payment configs, bank details)
    # Generate with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'
    PAYFINE_ENCRYPTION_KEY = os.getenv('PAYFINE_ENCRYPTION_KEY')
    if not PAYFINE_ENCRYPTION_KEY and ENVIRONMENT == 'production':
        raise ValueError("PAYFINE_ENCRYPTION_KEY must be set in production")
    
    # =============================================================================
    # POWERTRANZ PAYMENT GATEWAY (DEFAULT/FALLBACK ONLY)
    # =============================================================================
    
    # These are FALLBACK values only for development/testing
    # Production systems MUST use government-specific credentials from database
    
    # WARNING: These will be DEPRECATED in future versions
    # Use Government.payment_gateway_config instead
    
    POWERTRANZ_API_URL = os.getenv('POWERTRANZ_API_URL', 'https://staging.ptranz.com/api/v3')
    POWERTRANZ_MERCHANT_ID = os.getenv('POWERTRANZ_MERCHANT_ID', '88806220')
    POWERTRANZ_PASSWORD = os.getenv('POWERTRANZ_PASSWORD', '7eHpqRiS9f5Sv7GHwYV88KPMecr4mFFGxLCMxZru7OF')
    POWERTRANZ_HPP_PAGESET = os.getenv('POWERTRANZ_HPP_PAGESET', 'PTZ/PayFine')
    POWERTRANZ_HPP_PAGENAME = os.getenv('POWERTRANZ_HPP_PAGENAME', 'payfine')
    POWERTRANZ_MERCHANT_RESPONSE_URL = os.getenv('POWERTRANZ_MERCHANT_RESPONSE_URL')
    
    # =============================================================================
    # APPLICATION SETTINGS (GOVERNMENT-AGNOSTIC)
    # =============================================================================
    
    # REMOVED: Hard-coded CURRENCY = 'BBD'
    # Currency is now determined by government.currency_code
    
    # Default ticket due days (can be overridden per government)
    TICKET_DUE_DAYS = int(os.getenv('TICKET_DUE_DAYS', '21'))
    
    # Platform settings
    PLATFORM_NAME = 'PayFine'
    PLATFORM_VERSION = '2.0.0'
    
    # Operator panel settings
    OPERATOR_SESSION_TIMEOUT = timedelta(hours=8)
    
    # Multi-tenant settings
    ENABLE_SUBDOMAIN_ROUTING = os.getenv('ENABLE_SUBDOMAIN_ROUTING', 'true').lower() == 'true'
    DEFAULT_GOVERNMENT_ID = os.getenv('DEFAULT_GOVERNMENT_ID')  # For development only

