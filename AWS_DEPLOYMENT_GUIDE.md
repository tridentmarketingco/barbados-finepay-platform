# PayFine Platform - AWS Deployment Guide
## Complete Deployment to AWS using Amplify + Elastic Beanstalk + RDS

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PAYFINE PLATFORM ON AWS                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐              ┌──────────────────┐                │
│  │   FRONTEND       │              │   BACKEND        │                │
│  │   (Amplify)      │ ──────────► │   (Elastic       │                │
│  │                  │   API Calls  │    Beanstalk)    │                │
│  │  - React SPA     │              │                  │                │
│  │  - CloudFront    │              │  - Flask API     │                │
│  │  - Global CDN    │              │  - Python 3.11   │                │
│  └──────────────────┘              └──────────────────┘                │
│                                    ┌──────────────────┐                │
│                                    │   DATABASE      │                │
│                                    │   (RDS          │                │
│                                    │    PostgreSQL)  │                │
│                                    └──────────────────┘                │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    EXTERNAL INTEGRATIONS                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │   │
│  │  │ PowerTranz  │  │   OpenAI    │  │   Agency Systems       │  │   │
│  │  │ (Payments)  │  │  (AI/ML)    │  │   (Trident ID, etc.)  │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

1. **AWS Account** - Sign up at https://aws.amazon.com
2. **AWS CLI** - Install and configure
3. **Node.js 18+** - For building frontend
4. **Python 3.9+** - For backend
5. **Git** - For version control

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

## Step 2: Create AWS RDS PostgreSQL Database

### Using AWS Console:

1. Go to **AWS Console** → **RDS** → **Create database**
2. **Choose a database creation method**: Standard create
3. **Engine options**: PostgreSQL
4. **Templates**: Free tier
5. **Settings**:
   - DB instance identifier: `payfine-db`
   - Master username: `payfine_admin`
   - Master password: `<secure-password>`
6. **Instance configuration**: db.t3.micro
7. **Storage**: 20 GB (Free tier)
8. **Connectivity**:
   - Compute resource: Don't connect to an EC2 instance
   - Network type: IPv4
   - VPC: Default
   - Public access: Yes (for development)
   - VPC security groups: Create new
9. **Database authentication**: Password authentication
10. Click **Create database**

### Note your connection details:
- **Endpoint**: `payfine-db.xxxxx.us-east-1.rds.amazonaws.com`
- **Port**: 5432
- **Database name**: `payfine_prod`

---

## Step 3: Deploy Backend to AWS Elastic Beanstalk

### Option A: Using EB CLI

```bash
# Install EB CLI
pip install awsebcli

# Initialize EB application
cd /Users/erikjohnson/Documents/barbados-finepay-platform/backend
eb init -p python-3.11 payfine-backend --region us-east-1

# Create environment
eb create payfine-prod --instance-type t3.micro --single
```

### Option B: Using AWS Console

1. Go to **AWS Console** → **Elastic Beanstalk** → **Create application**
2. **Application name**: PayFine Platform
3. **Platform**: Python
4. **Platform version**: Python 3.11
5. **Application code**: Upload your code
6. Click **Create application**

### Set Environment Variables in EB:

Go to **Elastic Beanstalk** → **Configuration** → **Software**:

| Variable | Value |
|----------|-------|
| `FLASK_ENV` | production |
| `ENVIRONMENT` | production |
| `SECRET_KEY` | (your generated key) |
| `JWT_SECRET_KEY` | (your generated key) |
| `DATABASE_TYPE` | postgresql |
| `DATABASE_HOST` | (RDS endpoint) |
| `DATABASE_NAME` | payfine_prod |
| `DATABASE_USER` | payfine_admin |
| `DATABASE_PASSWORD` | (your database password) |
| `CORS_ORIGINS` | (your Amplify domain) |
| `PAYFINE_ENCRYPTION_KEY` | (your generated key) |
| `PYTHONPATH` | /opt/python/current/app |
| `GUNICORN_CMD_LINE` | --workers 3 --bind 0.0.0.0:5000 wsgi:application |

---

## Step 4: Deploy Frontend to AWS Amplify

### Option A: Using Amplify Console

1. Go to **AWS Console** → **Amplify** → **Create new app**
2. Connect your Git repository (GitHub, GitLab, or CodeCommit)
3. **Build settings**:
   - Build image: Amazon Linux 2
   - Build command: `npm run build`
   - Output directory: `build`
4. **Environment variables**:
   - `REACT_APP_API_URL`: `https://your-eb-endpoint.elasticbeanstalk.com`
5. Click **Save and deploy**

### Option B: Manual Deploy

```bash
# Install AWS Amplify CLI
npm install -g @aws-amplify/cli

# Initialize Amplify
cd /Users/erikjohnson/Documents/barbados-finepay-platform
amplify init

# Add hosting
amplify add hosting

# Publish
amplify publish
```

---

## Step 5: Update Frontend API Configuration

Update the frontend to point to your Elastic Beanstalk endpoint:

```javascript
// frontend/src/services/api.js
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://your-eb-endpoint.elasticbeanstalk.com';
```

---

## Step 6: Create Super Admin

```bash
curl -X POST https://your-eb-endpoint.elasticbeanstalk.com/api/operator/register \
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

## AWS Services Summary

| Service | Purpose | Cost (Free Tier) |
|---------|---------|-------------------|
| **Amplify** | Frontend hosting | ✓ Free |
| **Elastic Beanstalk** | Backend API | ✓ Free |
| **RDS PostgreSQL** | Database | ✓ Free |
| **CloudFront** | CDN (included in Amplify) | ✓ Free |
| **S3** | Static assets | ~$0.01/month |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Database connection failed | Check DATABASE_* environment variables in EB |
| CORS errors | Add your Amplify domain to CORS_ORIGINS |
| 500 Internal Server Error | Check CloudWatch logs in EB console |
| Static files not loading | Ensure frontend is built and Amplify configured |

---

## Quick Deploy Commands

```bash
# Build frontend
cd frontend && npm run build

# Deploy to Amplify (after amplify init)
amplify publish

# Deploy backend to EB
cd backend
eb deploy

# Or use AWS CLI
aws elasticbeanstalk create-application-version \
  --application-name payfine-backend \
  --version-label v1 \
  --source-bundle S3Bucket="your-bucket",S3Key="payfine.zip"
```

---

## Support

- AWS Amplify Docs: https://docs.amplify.aws
- AWS EB Docs: https://docs.aws.amazon.com/elastic-beanstalk
- AWS RDS Docs: https://docs.aws.amazon.com/rds

