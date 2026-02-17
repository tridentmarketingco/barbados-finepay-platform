# PayFine Digital Enforcement System - Quick Start Guide

## 🚀 Starting the Application

### Option 1: Using the Startup Script (Recommended)
```bash
./start-dev.sh
```

This will automatically start both backend and frontend servers.

### Option 2: Manual Startup

**Terminal 1 - Backend:**
```bash
cd backend
python3 run.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

## 🌐 Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/health

## 🔐 Demo Credentials

### Government Admin
- **Username**: `admin`
- **Password**: `admin123`
- **Role**: Administrator (full access)

### Field Officer
- **Username**: `officer`
- **Password**: `officer123`
- **Role**: Field Officer (issue tickets)

### Platform Operator (Super Admin)
- **Username**: `operator`
- **Password**: `operator123`
- **Role**: Platform Operator (multi-tenant management)

**⚠️ IMPORTANT**: Change all default passwords before deploying to production!

## 🎫 Test Tickets

Use these serial numbers in the ticket lookup:

1. **TRF001** - Unpaid ticket ($100.00)
   - Status: Unpaid
   - Can pay online
   
2. **TRF002** - Unpaid ticket ($150.00)
   - Status: Unpaid
   - Can pay online
   
3. **TRF003** - Paid ticket ($50.00)
   - Status: Paid
   - Payment reference available

## 📋 Common Tasks

### Check Backend Status
```bash
curl http://localhost:5000/health
```

### Test Login API
```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Lookup a Ticket
```bash
curl http://localhost:5000/api/lookup/TRF001
```

### View All Tickets (Admin)
1. Login at http://localhost:3000
2. Navigate to Admin Dashboard
3. Click "Ticket Management"

## 🛠️ Troubleshooting

### Backend Not Starting
```bash
# Check if port 5000 is in use
lsof -ti:5000

# Kill process if needed
kill -9 $(lsof -ti:5000)

# Restart backend
cd backend && python3 run.py
```

### Frontend Not Starting
```bash
# Check if port 3000 is in use
lsof -ti:3000

# Kill process if needed
kill -9 $(lsof -ti:3000)

# Restart frontend
cd frontend && npm start
```

### "An error occurred" on Login
This usually means the backend is not running. Check:
1. Is backend running on port 5000?
2. Run: `curl http://localhost:5000/health`
3. If no response, start backend: `cd backend && python3 run.py`

### Database Issues
```bash
# Reset and reseed database
cd backend
rm payfine.db  # or your database file
python3 seed_production_ready.py
```

## 📚 Additional Resources

- **Full Documentation**: See `README.md`
- **API Documentation**: See `backend/app/routes.py`
- **Configuration Guide**: Contact your account manager

## 🔄 Development Workflow

1. **Start servers**: `./start-dev.sh` or manually start both
2. **Make changes**: Edit files in `frontend/src` or `backend/app`
3. **Test changes**: 
   - Frontend auto-reloads
   - Backend auto-reloads (debug mode)
4. **Stop servers**: Press `CTRL+C` in terminal

## 📞 Support

If you encounter issues:
1. Check the terminal output for error messages
2. Review the troubleshooting section above
3. Ensure all dependencies are installed:
   - Backend: `cd backend && pip install -r requirements.txt`
   - Frontend: `cd frontend && npm install`
4. Contact technical support: support@payfine-system.com

## 🎯 Next Steps

1. **Customize Branding**: Login as admin and navigate to Branding Settings
2. **Configure Payment Gateway**: Update PowerTranz credentials in `.env`
3. **Add Users**: Create field officer and staff accounts
4. **Define Offences**: Set up your jurisdiction's traffic offences
5. **Test Workflow**: Issue a test ticket and process payment

---

**PayFine Digital Enforcement System** - Modern enforcement solutions for modern governments
