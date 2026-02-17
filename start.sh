#!/bin/bash

# PayFine Platform - Railpack Deployment Script
# This script builds and runs the application for Railpack deployment

set -e

echo "==============================================="
echo "PayFine Platform - Building & Starting App"
echo "==============================================="

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================
# Step 1: Install and Build Frontend
# ============================================
echo ""
echo -e "${YELLOW}[1/4]${NC} Setting up frontend..."

if [ -d "frontend" ]; then
    cd frontend
    
    # Install frontend dependencies
    echo "Installing frontend dependencies..."
    npm install
    
    # Build the React app
    echo "Building frontend..."
    npm run build
    
    cd ..
    echo -e "${GREEN}✓${NC} Frontend built successfully"
else
    echo -e "${YELLOW}⚠${NC} Frontend directory not found, skipping..."
fi

# ============================================
# Step 2: Install Backend Dependencies
# ============================================
echo ""
echo -e "${YELLOW}[2/4]${NC} Setting up backend..."

if [ -d "backend" ]; then
    cd backend
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        echo "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install Python dependencies
    echo "Installing backend dependencies..."
    pip install -r requirements.txt
    
    cd ..
    echo -e "${GREEN}✓${NC} Backend dependencies installed"
else
    echo -e "${YELLOW}⚠${NC} Backend directory not found, skipping..."
fi

# ============================================
# Step 3: Start Backend Server
# ============================================
echo ""
echo -e "${YELLOW}[3/4]${NC} Starting backend server..."

cd backend
source venv/bin/activate

# Start gunicorn with the WSGI app
echo "Starting Gunicorn server..."
exec gunicorn --bind 0.0.0.0:$PORT --workers 2 wsgi:app

