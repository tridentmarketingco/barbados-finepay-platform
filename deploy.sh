#!/bin/bash

# PayFine Platform - Quick Deploy Script
# Usage: ./deploy.sh

set -e

echo "🚀 PayFine Platform - Production Deployment"
echo "============================================"

# Check if we're in the right directory
if [ ! -f "vercel.json" ]; then
    echo "❌ Error: Run this script from the project root directory"
    exit 1
fi

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}✓${NC} Starting deployment..."

# Check for Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}Installing Vercel CLI...${NC}"
    npm install -g vercel
fi

# Check environment variables
echo ""
echo "Checking environment configuration..."

if [ -f "backend/.env" ]; then
    echo -e "${GREEN}✓${NC} Backend .env file found"
else
    echo -e "${YELLOW}⚠${NC} No .env file found. You'll need to configure environment variables in Vercel dashboard."
fi

# Check frontend build
if [ -d "frontend/build" ]; then
    echo -e "${GREEN}✓${NC} Frontend build found"
else
    echo -e "${YELLOW}Building frontend...${NC}"
    cd frontend && npm run build && cd ..
    echo -e "${GREEN}✓${NC} Frontend built successfully"
fi

# Deploy to Vercel
echo ""
echo "Deploying to Vercel..."
echo "-----------------------------------"

vercel --prod

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables"
echo "2. Add all required environment variables (see PRODUCTION_DEPLOYMENT_GUIDE.md)"
echo "3. Create super admin: curl -X POST https://your-project.vercel.app/api/operator/register ..."
echo "4. Test the deployment: curl https://your-project.vercel.app/health"

