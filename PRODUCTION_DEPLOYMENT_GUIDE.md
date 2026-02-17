# PayFine Platform - Production Deployment Guide
## Enterprise-Grade Multi-Tenant SaaS for Agency Fine Payments

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PAYFINE PLATFORM                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐              ┌──────────────────┐                │
│  │   FRONTEND       │              │   BACKEND        │                │
│  │   (Vercel)       │ ──────────► │   (Vercel OR     │                │
│  │                  │   API Calls  │    AWS EB)       │                │
│  │  - React SPA     │              │                  │                │
│  │  - Static Build  │              │  - Flask API     │                │
│  │  - CDN Global    │              │  - PostgreSQL    │                │
│  └──────────────────┘              │  - Redis Cache   │                │
│                                    └──────────────────┘                │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    EXTERNAL INTEGRATIONS                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │   │
│  │  │ PowerTranz  │  │   OpenAI    │  │   Agency Systems       │  │   │
│  │  │ (Payments)  │  │  (AI/ML)    │  │   (Trident ID, etc.)   │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

1. **Node.js 18+** - For building frontend
2. **Python 3.9+** - For backend
3. **Git** - For version control
4. **Vercel Account** - For frontend hosting (free tier available)
5. **Vercel Postgres** or **AWS RDS** - For production database

---

## Step 1: Generate Secure Keys

```bash
# Navigate to backend directory
cd /Users/erikjohnson/Documents/barbados-finepay-platform/backend

# Generate SECRET_KEY and JWT_SECRET_KEY
python -c "import secrets; print('SECRET_KEY=' + secrets.token_hex(32))"
python -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_hex(32))"

# Generate encryption key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

---

## Step 2: Database Setup

### Option A: Vercel Postgres (Recommended)

1. Go to [Vercel Storage](https://vercel.com/dashboard/stores)
2. Create new Postgres database
3. Copy connection string

### Option B: AWS RDS PostgreSQL

1. AWS Console → RDS → Create Database
2. Select PostgreSQL (free tier: db.t3.micro)
3. Configure security group to allow Vercel IPs

---

## Step 3: Environment Variables

Create `/backend/.env` with production values:

```bash
# =============================================================================
# PAYFINE PLATFORM - PRODUCTION ENVIRONMENT
# =============================================================================

# FLASK CONFIGURATION
FLASK_ENV=production
ENVIRONMENT=production
SECRET_KEY=<generate-secure-random-string-min-32-chars>
JWT_SECRET_KEY=<generate-secure-random-string-min-32-chars>

# DATABASE - PostgreSQL (REQUIRED for production)
DATABASE_TYPE=postgresql
DATABASE_HOST=<your-postgres-host>.aws.amazon.com
DATABASE_NAME=payfine_prod
DATABASE_USER=payfine_admin
DATABASE_PASSWORD=<secure-database-password>

# CORS - Your Vercel frontend domain
CORS_ORIGINS=https://your-project.vercel.app

# ENCRYPTION
PAYFINE_ENCRYPTION_KEY=<fernet-key-from-above>

# POWERTRANZ PAYMENT GATEWAY
POWERTRANZ_API_URL=https://api.ptranz.com/api/v3
POWERTRANZ_MERCHANT_ID=<your-merchant-id>
POWERTRANZ_PASSWORD=<your-password>
POWERTRANZ_HPP_PAGESET=PTZ/PayFine
POWERTRANZ_HPP_PAGENAME=payfine
POWERTRANZ_MERCHANT_RESPONSE_URL=https://your-project.vercel.app/api/spi/callback

# PLATFORM SETTINGS
TICKET_DUE_DAYS=21
ENABLE_SUBDOMAIN_ROUTING=true
ENABLE_SCHEDULER=true
LOG_LEVEL=INFO
```

---

## Step 4: Deploy to Vercel

### Install Vercel CLI and Login

```bash
npm install -g vercel
vercel login
```

### Deploy

```bash
cd /Users/erikjohnson/Documents/barbados-finepay-platform
vercel --prod
```

**Follow the prompts:**
1. Set up and deploy? **Yes**
2. Which scope? **[Your Vercel account]**
3. Link to existing project? **No**
4. Project name: **payfine-platform**
5. Directory? **./**
6. Want to modify settings? **Yes**

### Configure in Vercel Dashboard

1. Go to **Settings** → **General**
   - Framework Preset: **Other**
   - Build Command: (leave empty)
   - Output Directory: (leave empty)

2. Go to **Settings** → **Environment Variables**

Add these variables:

| Variable | Value |
|----------|-------|
| `FLASK_ENV` | production |
| `ENVIRONMENT` | production |
| `SECRET_KEY` | (your generated key) |
| `JWT_SECRET_KEY` | (your generated key) |
| `DATABASE_TYPE` | postgresql |
| `DATABASE_HOST` | (from Vercel Postgres) |
| `DATABASE_NAME` | (from Vercel Postgres) |
| `DATABASE_USER` | (from Vercel Postgres) |
| `DATABASE_PASSWORD` | (from Vercel Postgres) |
| `CORS_ORIGINS` | https://your-project.vercel.app |
| `PAYFINE_ENCRYPTION_KEY` | (your generated key) |

3. Go to **Settings** → **Git**
   - Deploy on every git push: **Yes**

---

## Step 5: Verify Deployment

### Health Check
```bash
curl https://your-project.vercel.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "PayFine Platform",
  "version": "2.0.0",
  "environment": "production"
}
```

### Readiness Check
```bash
curl https://your-project.vercel.app/ready
```

Expected response:
```json
{
  "status": "ready",
  "database": "connected",
  "cache": "connected"
}
```

---

## Step 6: Create Super Admin

```bash
curl -X POST https://your-project.vercel.app/api/operator/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@payfine.gov",
    "password": "SecurePassword123!",
    "full_name": "Platform Administrator",
    "role": "super_admin"
  }'
```

---

## AWS Backend (Alternative)

If you prefer AWS for backend instead of Vercel:

### AWS Elastic Beanstalk

```bash
cd backend
eb init -p python-3.9 payfine-backend
eb create payfine-prod --instance-type t3.micro

# Set environment variables
eb setenv SECRET_KEY=<key> JWT_SECRET_KEY=<key> DATABASE_TYPE=postgresql DATABASE_HOST=<rds-endpoint> ...
```

---

## Post-Deployment Checklist

- [ ] Super admin account created
- [ ] Agency (tenant) provisioned via operator panel
- [ ] Payment gateway configured for agency
- [ ] Test ticket creation and payment flow
- [ ] Configure custom domain (optional)
- [ ] Set up monitoring (Sentry, DataDog)

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Database connection failed | Check DATABASE_* environment variables |
| CORS errors | Add your domain to CORS_ORIGINS |
| 500 Internal Server Error | Check Vercel logs in Dashboard → Functions |
| Static files not loading | Ensure frontend is built |

---

## Quick Deploy Commands

```bash
# Build frontend
cd frontend && npm run build

# Deploy to Vercel
vercel --prod

# Or deploy frontend only
vercel --prod --frontend
```

---

## Support

- Vercel Docs: https://vercel.com/docs
- Flask Deployment: https://flask.palletsprojects.com/en/2.3.x/deploying/

