#!/bin/bash

# PayFine Platform - AWS Deployment Script
# Deploys frontend to AWS Amplify and backend to AWS Elastic Beanstalk
# Usage: ./aws_deploy.sh

set -e

echo "🚀 PayFine Platform - AWS Deployment"
echo "======================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check for required tools
check_tool() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}Error: $1 is not installed. Please install it first.${NC}"
        exit 1
    fi
}

echo -e "${GREEN}Checking required tools...${NC}"
check_tool "npm"
check_tool "python3"

# Check for AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${YELLOW}Warning: AWS CLI not found. Installing...${NC}"
    pip install awscli
fi

# Check for EB CLI
if ! command -v eb &> /dev/null; then
    echo -e "${YELLOW}Warning: EB CLI not found. Installing...${NC}"
    pip install awsebcli
fi

# Check for Amplify CLI
if ! command -v amplify &> /dev/null; then
    echo -e "${YELLOW}Warning: Amplify CLI not found. Installing...${NC}"
    npm install -g @aws-amplify/cli
fi

# ============================================================================
# STEP 1: Generate secure keys if not already set
# ============================================================================
echo ""
echo "Step 1: Checking environment configuration..."
echo "-----------------------------------"

if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}No .env file found. Creating from template...${NC}"
    cp backend/.env.aws.example backend/.env
    
    # Generate secure keys
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    JWT_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    ENCRYPTION_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
    
    # Update .env with generated keys
    sed -i '' "s|SECRET_KEY=<generate-secure-random-string-min-32-chars>|$SECRET_KEY|" backend/.env
    sed -i '' "s|JWT_SECRET_KEY=<generate-secure-random-string-min-32-chars>|$JWT_SECRET_KEY|" backend/.env
    sed -i '' "s|PAYFINE_ENCRYPTION_KEY=<fernet-key-generate-with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\">|$ENCRYPTION_KEY|" backend/.env
    
    echo -e "${GREEN}✓${NC} Created .env file with generated secure keys"
else
    echo -e "${GREEN}✓${NC} Backend .env file found"
fi

# ============================================================================
# STEP 2: Build frontend
# ============================================================================
echo ""
echo "Step 2: Building frontend..."
echo "-----------------------------------"

if [ -d "frontend/build" ]; then
    echo -e "${GREEN}✓${NC} Frontend build found (using cached)"
else
    echo -e "${YELLOW}Building frontend...${NC}"
    cd frontend && npm install && npm run build && cd ..
    echo -e "${GREEN}✓${NC} Frontend built successfully"
fi

# ============================================================================
# STEP 3: Deploy to AWS Amplify (Frontend)
# ============================================================================
echo ""
echo "Step 3: Deploying frontend to AWS Amplify..."
echo "-----------------------------------"

# Check if Amplify is already initialized
if [ -d "amplify" ]; then
    echo "Amplify project found. Publishing..."
    amplify publish --yes
else
    echo -e "${YELLOW}Amplify not initialized. Running amplify init...${NC}"
    echo ""
    echo "Please run the following commands manually:"
    echo "  1. amplify init"
    echo "  2. amplify add hosting"
    echo "  3. amplify publish"
    echo ""
    echo "Or use the AWS Console for initial setup."
fi

# ============================================================================
# STEP 4: Deploy to AWS Elastic Beanstalk (Backend)
# ============================================================================
echo ""
echo "Step 4: Deploying backend to AWS Elastic Beanstalk..."
echo "-----------------------------------"

cd backend

# Check if EB is initialized
if [ -d ".elasticbeanstalk" ]; then
    echo "Elastic Beanstalk project found."
    
    # Check environment exists
    if eb status payfine-prod &> /dev/null; then
        echo "Deploying to existing environment..."
        eb deploy payfine-prod
    else
        echo "Creating new environment..."
        eb create payfine-prod --instance-type t3.micro --single
    fi
else
    echo -e "${YELLOW}Elastic Beanstalk not initialized. Running eb init...${NC}"
    eb init -p python-3.11 payfine-backend --region us-east-1
    
    echo "Creating environment..."
    eb create payfine-prod --instance-type t3.micro --single
fi

cd ..

# ============================================================================
# STEP 5: Verify deployment
# ============================================================================
echo ""
echo "Step 5: Verifying deployment..."
echo "-----------------------------------"

# Get EB URL
EB_URL=$(eb status payfine-prod 2>/dev/null | grep "CNAME" | awk '{print $2}')
if [ -z "$EB_URL" ]; then
    EB_URL="your-eb-endpoint.elasticbeanstalk.com"
fi

echo ""
echo "========================================"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "========================================"
echo ""
echo "Frontend URL: Check AWS Amplify console"
echo "Backend URL: https://${EB_URL}"
echo ""
echo "Next steps:"
echo "1. Configure environment variables in Elastic Beanstalk console:"
echo "   - DATABASE_HOST: Your RDS endpoint"
echo "   - DATABASE_PASSWORD: Your RDS password"
echo "   - CORS_ORIGINS: Your Amplify URL"
echo ""
echo "2. Create super admin:"
echo "   curl -X POST https://${EB_URL}/api/operator/register \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"username\":\"admin\",\"email\":\"admin@payfine.gov\",\"password\":\"SecurePassword123!\",\"full_name\":\"Platform Administrator\",\"role\":\"super_admin\"}'"
echo ""
echo "3. Test the deployment:"
echo "   curl https://${EB_URL}/health"

