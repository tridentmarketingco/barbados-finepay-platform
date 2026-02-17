# PayFine Digital Enforcement System

A secure, modern, and expandable **multi-tenant SaaS platform** for government digital enforcement and payment services. Built for governments worldwide to digitize traffic fine payments, parking enforcement, and other government services with integrated PowerTranz payment gateway supporting global currencies.

## 🌍 Global Government Digital Services Platform

**Version 2.0** - Production Ready with Multi-Tenant Architecture

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Prerequisites](#prerequisites)
6. [Quick Start](#quick-start)
7. [Detailed Setup](#detailed-setup)
8. [Running the Application](#running-the-application)
9. [API Endpoints](#api-endpoints)
10. [Test Credentials](#test-credentials)
11. [PowerTranz Payment Gateway](#powertranz-payment-gateway)
12. [Security Notes](#security-notes)
13. [Future Enhancements](#future-enhancements)
14. [License](#license)

---

## Overview

**PayFine Digital Enforcement System** is a **production-ready multi-tenant SaaS platform** that enables governments worldwide to digitize enforcement fine payments and government services. The platform provides:

### For Citizens
- 🔍 **Ticket Lookup**: Search tickets by serial number with real-time status
- 💳 **Secure Payment**: Pay fines online using PowerTranz with 3D-Secure authentication
- 📄 **Digital Receipts**: Instant receipt generation after payment
- ⚖️ **Challenge System**: Contest tickets through judicial review process
- 🔐 **National ID Integration**: Link tickets to national ID systems

### For Government Administrators
- 📊 **Admin Dashboard**: Comprehensive ticket and payment management
- 🎨 **Branding Control**: Customize platform appearance per government
- 📋 **Offence Management**: Define traffic offences with automated penalty calculation
- 👥 **User Management**: Manage staff and field officer accounts
- 📈 **Reports & Analytics**: Revenue tracking and compliance reporting
- ⚖️ **Challenge Review**: Process citizen ticket challenges

### For Field Officers
- 🎫 **Ticket Issuance**: Create tickets with automatic fine calculation
- 📱 **Mobile-Friendly**: Issue tickets on-the-go
- 🔍 **Ticket Verification**: Verify National ID and driver information
- 🖨️ **Sunmi Printer Support**: Print tickets on Sunmi V2 devices

### For Platform Operators
- 🏛️ **Government Management**: Onboard and manage multiple governments
- 💰 **Revenue Dashboard**: Track platform fees and government billing
- 🔧 **Feature Flags**: Enable/disable features per government
- 📊 **Transaction Analytics**: Cross-government analytics and insights
- 🔐 **Audit Logs**: Complete audit trail for compliance

### Multi-Tenant Architecture
- 🌐 **Multiple Governments**: One platform, complete data isolation per tenant
- 💱 **Multi-Currency**: Support for any currency (USD, EUR, GBP, BBD, TTD, JMD, etc.)
- 🔒 **Encrypted Credentials**: Secure payment gateway configuration per government
- 🎨 **Custom Branding**: Logo, colors, and platform name per government
- 🌍 **Timezone Support**: Localized dates and times per government

## Features

### Core Platform Features
- ✅ **Multi-Tenant Architecture**: Complete data isolation between governments
- ✅ **Ticket Management**: Create, search, pay, void, and refund tickets
- ✅ **Payment Processing**: PowerTranz SPI-3DS-HPP integration with 3D-Secure
- ✅ **Digital Receipts**: Automatic receipt generation with transaction details
- ✅ **National Offence System**: Automated penalty calculation based on admin-defined rules
- ✅ **Challenge System**: Citizens can contest tickets with admin review workflow
- ✅ **National ID Integration**: Link tickets to government ID systems
- ✅ **Role-Based Access**: Admin, Field Officer, Staff, and Operator roles
- ✅ **Custom Branding**: Per-government logos, colors, and platform names
- ✅ **Responsive Design**: Works on desktop, tablet, and mobile devices

### Admin Portal Features
- ✅ **Dashboard**: Real-time statistics and revenue tracking
- ✅ **Ticket Management**: View, void, refund, and manage all tickets
- ✅ **Offence Categories**: Organize offences by category (Speeding, Parking, etc.)
- ✅ **Offence Management**: Define violations with measurable criteria
- ✅ **Penalty Rules**: Set fines, points, and court requirements with tiered penalties
- ✅ **Challenge Review**: Process citizen challenges with dismiss/adjust/uphold options
- ✅ **User Management**: Create and manage admin and field officer accounts
- ✅ **Service Management**: Configure government services
- ✅ **Branding Settings**: Customize platform appearance
- ✅ **Reports**: Generate revenue and compliance reports
- ✅ **AI-Powered Insights**: Predictive analytics and trend forecasting
- ✅ **Gamification**: Merit/demerit points system for citizen engagement
- ✅ **Geolocation**: Map-based ticket visualization

### Field Officer Portal Features
- ✅ **Ticket Issuance**: Create tickets with automatic fine calculation
- ✅ **Offence Selection**: Choose from admin-defined offences
- ✅ **Measurable Offences**: Enter speed, BAC, or other measurements
- ✅ **Repeat Offender Detection**: Automatic detection with fine multiplier
- ✅ **National ID Lookup**: Verify driver information
- ✅ **QR Code Generation**: Generate QR codes for printed tickets
- ✅ **Sunmi Printer Integration**: Print tickets on Sunmi V2 devices
- ✅ **Offline Mode**: Issue tickets without internet connection

### Operator Portal Features
- ✅ **Government Management**: Onboard and configure governments
- ✅ **Revenue Dashboard**: Track platform fees and government billing
- ✅ **Transaction Analytics**: Cross-government transaction insights
- ✅ **Feature Flags**: Enable/disable features per government
- ✅ **Audit Logs**: Complete audit trail for compliance
- ✅ **Compliance Alerts**: Monitor for suspicious activity

### Security Features
- 🔒 **HTTPS-Ready**: SSL/TLS configuration for production
- 🔐 **JWT Authentication**: Secure token-based authentication
- 🔑 **Password Hashing**: Werkzeug security with bcrypt
- 🛡️ **Environment Variables**: Sensitive data protection
- ✅ **Input Validation**: All endpoints validated
- 🌐 **CORS Configuration**: Secure cross-origin requests
- 💳 **PCI Compliance**: Payment data never touches servers (HPP)
- 🔐 **3D-Secure**: Enhanced fraud protection via PowerTranz
- 🔒 **Encrypted Credentials**: Payment gateway config encrypted per government
- 📝 **Audit Logging**: Complete audit trail for all actions

## Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| **Backend** | Python + Flask | 3.8+ |
| **Database** | SQLAlchemy ORM | Latest |
| **Database Engine** | PostgreSQL/MySQL/SQLite | 13+ |
| **Authentication** | Flask-JWT-Extended | Latest |
| **Frontend** | React | 18.3.1 |
| **Routing** | React Router | 6.30.3 |
| **HTTP Client** | Axios | 1.6.2 |
| **Styling** | CSS3 (Custom) | - |
| **Payment Gateway** | PowerTranz SPI-3DS-HPP | v3 |
| **Architecture** | Multi-Tenant SaaS | - |
| **Encryption** | Werkzeug Security | Latest |
| **Mobile** | Android (Kotlin) | - |
| **Printer** | Sunmi V2 SDK | Latest |

## Project Structure

```
payfine-platform/
├── backend/
│   ├── app/
│   │   ├── __init__.py              # Flask app factory
│   │   ├── config.py                # Multi-tenant configuration
│   │   ├── models.py                # Database models (multi-tenant)
│   │   ├── routes.py                # Public API routes
│   │   ├── admin_routes.py          # Government admin routes
│   │   ├── operator_routes.py       # Platform operator routes
│   │   ├── middleware.py            # Tenant resolution middleware
│   │   ├── encryption.py            # Payment config encryption
│   │   ├── notifications.py         # Email/SMS notifications
│   │   ├── ai_analytics.py          # AI-powered analytics
│   │   ├── gamification.py          # Gamification engine
│   │   ├── points_service.py        # Merit/demerit points
│   │   └── national_id_integration.py # National ID system integration
│   ├── .env.example                 # Environment template
│   ├── requirements.txt             # Python dependencies
│   ├── run.py                       # Development server
│   ├── wsgi.py                      # Production WSGI entry point
│   └── seed_production_ready.py     # Production seed script
├── frontend/
│   ├── public/
│   │   ├── index.html               # HTML template
│   │   └── logo.svg                 # Platform logo
│   ├── src/
│   │   ├── App.js                   # Main React component
│   │   ├── App.css                  # Global styles
│   │   ├── index.js                 # React entry point
│   │   ├── components/
│   │   │   ├── Login.js             # Public login
│   │   │   ├── TicketLookup.js      # Ticket search & payment
│   │   │   ├── PaymentReceipt.js    # Receipt display
│   │   │   ├── HPPIframe.js         # PowerTranz HPP iframe
│   │   │   ├── ChallengeTicket.js   # Ticket challenge form
│   │   │   ├── admin/               # Admin portal components
│   │   │   ├── operator/            # Operator portal components
│   │   │   ├── citizen/             # Citizen portal components
│   │   │   └── common/              # Shared components
│   │   ├── contexts/
│   │   │   ├── AuthContext.js       # Authentication context
│   │   │   ├── BrandingContext.js   # Branding context
│   │   │   └── NotificationContext.js # Notification context
│   │   ├── services/
│   │   │   ├── api.js               # Public API service
│   │   │   ├── adminApi.js          # Admin API service
│   │   │   └── operatorApi.js       # Operator API service
│   │   └── styles/
│   │       ├── Admin.css            # Admin portal styles
│   │       ├── Operator.css         # Operator portal styles
│   │       └── FieldOfficer.css     # Field officer portal styles
│   └── package.json                 # Node dependencies
├── android/
│   ├── app/
│   │   └── src/
│   │       └── main/
│   │           ├── java/com/payfine/enforcement/
│   │           │   ├── MainActivity.kt
│   │           │   ├── PrinterHelper.kt
│   │           │   └── ScannerHelper.kt
│   │           └── res/
│   │               └── values/
│   │                   ├── strings.xml
│   │                   └── themes.xml
│   └── build.gradle
└── README.md                        # This file
```

---

## Prerequisites

### Required Software
- **Python 3.8+**: [Download](https://www.python.org/downloads/)
- **Node.js 18+**: [Download](https://nodejs.org/)
- **PostgreSQL 13+** (recommended for production): [Download](https://www.postgresql.org/download/)
- **Git**: [Download](https://git-scm.com/)

### Recommended Tools
- **pgAdmin** (optional): Database management GUI
- **Postman** (optional): API testing tool
- **VS Code**: Code editor with Python/React extensions
- **Android Studio** (for mobile app development)

---

## Quick Start

### 1. Clone and Navigate
```bash
git clone <repository-url>
cd payfine-platform
```

### 2. Set Up Database (Optional - SQLite used by default)
```bash
# Database is automatically created with SQLite
# For PostgreSQL, see Database Setup below
```

### 3. Set Up Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
# Edit .env with your settings (see below)

# Seed database with sample data
python seed_production_ready.py

# Start Flask server
flask --app app run
```

### 4. Set Up Frontend
```bash
cd frontend
npm install

# Copy environment file
cp .env.example .env

# Start React development server
npm start
```

### 5. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **API Health Check**: http://localhost:5000/health

---

## Detailed Setup

### Database Setup

#### Option 1: SQLite (Default - No Setup Required)
The application uses SQLite by default for development:
```env
DATABASE_TYPE=sqlite
```
No additional setup needed - the database file is created automatically.

#### Option 2: PostgreSQL (Recommended for Production)
```bash
# Create PostgreSQL database and user
sudo -u postgres psql

# In PostgreSQL prompt:
CREATE DATABASE payfine_db;
CREATE USER payfine_user WITH ENCRYPTED PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE payfine_db TO payfine_user;
ALTER DATABASE payfine_db OWNER TO payfine_user;
\q
```

Then update `.env`:
```env
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://payfine_user:secure_password_here@localhost:5432/payfine_db
```

#### Option 3: Docker (Alternative)
```bash
# Run PostgreSQL in Docker
docker run --name payfine-db \
  -e POSTGRES_DB=payfine_db \
  -e POSTGRES_USER=payfine_user \
  -e POSTGRES_PASSWORD=secure_password_here \
  -p 5432:5432 \
  -d postgres:13

# Stop/Start commands
docker stop payfine-db
docker start payfine-db
```

### Backend Setup

1. **Create Virtual Environment**
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate  # Linux/Mac
   # or
   .\venv\Scripts\activate   # Windows
   ```

2. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   nano .env  # or your preferred editor
   ```

   Update these values in `.env`:
   ```env
   # IMPORTANT: Change these in production!
   SECRET_KEY=your-super-secure-random-string-here
   JWT_SECRET_KEY=your-jwt-secret-key-here
   
   # Database (SQLite by default, or PostgreSQL)
   DATABASE_TYPE=sqlite
   
   # PowerTranz Payment Gateway
   POWERTRANZ_MERCHANT_ID=your-merchant-id
   POWERTRANZ_PASSWORD=your-password
   POWERTRANZ_BASE_URL=https://api-test.powertranz.com/api/v3
   
   # CORS (add your production domain)
   CORS_ORIGINS=http://localhost:3000
   ```

4. **Seed Database**
   ```bash
   python seed_production_ready.py
   ```

   This will create:
   - Platform operator (super admin)
   - Sample government configuration
   - Government admin user
   - Services and sample data

5. **Start Backend Server**
   ```bash
   flask --app app run
   ```

   Or for development with auto-reload:
   ```bash
   export FLASK_ENV=development  # Linux/Mac
   # or
   set FLASK_ENV=development     # Windows
   flask --app app run
   ```

### Frontend Setup

1. **Install Dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   ```

   The default settings should work:
   ```env
   REACT_APP_API_URL=http://localhost:5000/api
   ```

3. **Start Development Server**
   ```bash
   npm start
   ```

   The app will open at http://localhost:3000

---

## Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
flask --app app run
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/login` | User login | No |
| POST | `/api/register` | User registration | No |
| POST | `/api/refresh` | Refresh access token | No (needs refresh token) |

### Tickets

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/lookup/<serial>` | Look up ticket | No |
| POST | `/api/pay/<serial>` | Process payment with PowerTranz | No |

### Services

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/services` | List all services | No |
| POST | `/api/services` | Create new service | Yes (Admin) |

### Admin

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/admin/tickets` | List all tickets | Yes (Admin) |
| GET | `/api/admin/analytics` | Get AI-powered insights | Yes (Admin) |

### Health

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | Health check | No |

---

## Test Credentials

### Default Users (Demo Environment)

| Role | Username | Password | Access Level |
|------|----------|----------|--------------|
| **Admin** | `admin` | `admin123` | Full admin access + Admin Portal |
| **Field Officer** | `officer` | `officer123` | Ticket issuance + Field Portal |
| **Staff** | `staff` | `staff123` | Read-only access |

### Platform Operator

| Role | Username | Password | Access Level |
|------|----------|----------|--------------|
| **Super Admin** | `operator` | `operator123` | Cross-government access + Operator Portal |

**⚠️ IMPORTANT**: Change all default passwords before deploying to production!

---

## PowerTranz Payment Gateway

### Overview

The PayFine Digital Enforcement System integrates with **PowerTranz**, a global payment gateway supporting multiple currencies and regions.

**Key Features:**
- REST API v3 for direct card integration
- Supports multiple currencies worldwide
- Sandbox environment for testing
- PCI-compliant card processing
- **3D-Secure (3DS) authentication** for enhanced security
- **Hosted Payment Page (HPP)** for PCI compliance

### PowerTranz SPI-3DS-HPP Integration

This platform implements the **SPI (Simplified 3DS Integration)** with **HPP (Hosted Payment Page)** method, which provides:

1. **Enhanced Security**: 3D-Secure 2.x authentication protects against fraud
2. **PCI Compliance**: Card data never touches your servers
3. **Better UX**: Frictionless flow for most cards, challenge only when needed
4. **Liability Shift**: Reduced fraud liability for merchants

#### Transaction Flow

```
1. Customer selects ticket to pay
2. Backend calls /api/spi/initiate/{serial_number}
3. PowerTranz returns SPI Token + RedirectData (HTML form)
4. Frontend renders HPP in iframe
5. Customer enters card details on PowerTranz HPP
6. 3DS authentication occurs (frictionless or challenge)
7. PowerTranz posts result to MerchantResponseUrl
8. Backend receives callback, stores 3DS result
9. Frontend polls /api/spi/status/{token} or receives callback
10. Frontend calls /api/spi/payment to complete transaction
11. Payment result returned, receipt generated
```

### Setup

1. **Sign Up for PowerTranz**
   - Visit: https://www.powertranz.com/
   - Register for a merchant account
   - Access the merchant dashboard for credentials

2. **Configure HPP in PowerTranz Portal**
   - Create a Hosted Payment Page with your branding
   - Note the PageSet and PageName (must use PTZ/ prefix)
   - Configure the MerchantResponseUrl callback URL

3. **Configure Environment Variables**

   Add to your `.env` file:
   ```env
   # PowerTranz Credentials
   POWERTRANZ_MERCHANT_ID=your-merchant-id
   POWERTRANZ_PASSWORD=your-password
   POWERTRANZ_API_URL=https://staging.ptranz.com/api/v3
   
   # HPP Configuration
   POWERTRANZ_HPP_PAGESET=PTZ/YourPageSet
   POWERTRANZ_HPP_PAGENAME=YourPageName
   POWERTRANZ_MERCHANT_RESPONSE_URL=https://your-domain.com/api/spi/hpp-callback
   ```

4. **API Documentation**
   - Documentation: https://developer.powertranz.com/docs/integration-types
   - Password for docs: `PowerTranz`

### Test Cards

Use these cards in the PowerTranz sandbox environment:

| Card Type | Number | Result |
|-----------|--------|--------|
| **Success** | `4111111111111111` | Transaction approved |
| **Decline** | `4111111111111112` | Transaction declined |
| **3DS Challenge** | `4111111111111111` with $10.01 | Triggers 3DS verification |

**Test Card Details:**
- **Card Type**: Visa (test)
- **Expiry**: Any future date (e.g., 12/29)
- **CVV**: Any 3 digits (e.g., 123)
- **Name**: Any name (e.g., "John Doe")
- **3DS Challenge Password**: `3ds2` (when prompted)

---

## Security Notes

### ⚠️ Critical for Production

1. **Never commit `.env` files**
   - Add `.env` to `.gitignore`
   - Use a secrets manager in production

2. **Change default passwords**
   - All default credentials must be changed
   - Use strong, unique passwords

3. **Use HTTPS in production**
   - SSL/TLS certificate required
   - Update `CORS_ORIGINS` to production domain

4. **JWT Secrets**
   - Use long, random strings
   - Rotate keys periodically

5. **Payment Security**
   - Use PowerTranz Hosted Payment Page in production
   - Never handle raw card data
   - Implement 3D Secure for additional protection
   - PCI DSS compliance required
   - Never log sensitive payment data

### Security Best Practices

```python
# In production, use stronger settings
class ProductionConfig(Config):
    DEBUG = False
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    
    # Stronger JWT settings
    JWT_COOKIE_SECURE = True
    JWT_COOKIE_CSRF_PROTECT = True
```

### Data Protection

- **Card Data**: Never store; process through PowerTranz
- **Transaction Logs**: Store only transaction IDs and amounts
- **User Data**: Encrypt sensitive fields (PII)
- **Backups**: Encrypt database backups

---

## Future Enhancements

### ✅ Completed (Version 2.0)
- ✅ Multi-tenant architecture with complete data isolation
- ✅ PowerTranz SPI-3DS-HPP integration with 3D-Secure
- ✅ National Offence System with automated penalty calculation
- ✅ Ticket challenge system with admin review workflow
- ✅ Admin, Field Officer, and Operator portals
- ✅ Custom branding per government
- ✅ National ID integration framework
- ✅ Repeat offender detection with fine multipliers
- ✅ Role-based access control
- ✅ Audit logging and compliance features
- ✅ AI-powered analytics and insights
- ✅ Gamification with merit/demerit points
- ✅ Geolocation and map visualization
- ✅ Sunmi printer integration for Android

### Roadmap (2025)
- [ ] **Email/SMS Notifications**: Automated ticket notifications
- [ ] **Payment History**: Citizen payment history dashboard
- [ ] **2FA Authentication**: Two-factor authentication for admins
- [ ] **Bulk Operations**: Bulk ticket import/export
- [ ] **API Documentation**: Interactive API documentation (Swagger)
- [ ] **Mobile App**: React Native mobile app for citizens
- [ ] **Multi-Language**: Support for multiple languages
- [ ] **Biometric Auth**: Fingerprint/face recognition
- [ ] **Blockchain Receipts**: Immutable receipt storage
- [ ] **Open Banking**: Direct bank account payments

---

## Production Deployment

### Backend (Gunicorn + Nginx)

```bash
# Install production server
pip install gunicorn

# Run with Gunicorn
gunicorn --bind 0.0.0.0:5000 wsgi:app

# With multiple workers
gunicorn --bind 0.0.0.0:5000 --workers 4 wsgi:app
```

### Nginx Configuration
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # Frontend
    location / {
        root /var/www/payfine-frontend/build;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    # HTTPS (production)
    listen 443 ssl;
    ssl_certificate /etc/ssl/certs/your-cert.crt;
    ssl_certificate_key /etc/ssl/private/your-key.key;
}
```

### Frontend (Build)
```bash
cd frontend
npm run build
# Deploy the 'build' folder to your web server
```

---

## License

This project is proprietary software.

All rights reserved © 2024-2025 PayFine Digital Enforcement System.

---

## Support & Contact

### Technical Support
- **Email**: support@payfine-system.com
- **Documentation**: Contact your account manager

### Payment Gateway Support
- **PowerTranz Support**: https://developer.powertranz.com/support
- **PowerTranz Docs**: https://developer.powertranz.com/docs
- **Docs Password**: `PowerTranz`

### Sales & Partnerships
- **Email**: sales@payfine-system.com
- **Website**: Contact your account manager

---

## Acknowledgments

- **PowerTranz** - Global payment gateway integration
- **Flask Community** - Python web framework
- **React Community** - JavaScript library
- **Government Partners** - Digital transformation initiatives worldwide

---

**🌍 PayFine Digital Enforcement System - Empowering Governments Worldwide**

*Modern enforcement solutions for modern governments*
