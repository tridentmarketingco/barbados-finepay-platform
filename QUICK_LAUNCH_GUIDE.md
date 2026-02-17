# PayFine Digital Enforcement System - Quick Launch Guide

## Architecture

```
┌──────────────────────────────────────────────────────┐
│           ON-PREMISE SERVER (Government HQ)           │
│                                                       │
│   [Nginx:443] ─► [Gunicorn:8000] ─► [PostgreSQL]    │
│        │                                              │
│        │ (HTTPS - Public Internet)                    │
│        ▼                                              │
│   https://your-domain.gov  (Citizen & Officer Portal)│
└──────────────────────────────────────────────────────┘
              │
              │ Officers access from ANYWHERE
              │ via 4G/LTE/WiFi on tablets or phones
              ▼
    ┌─────────────────────────────────────────┐
    │   FIELD OFFICER DEVICES (Mobile/Tablet) │
    │   - Open browser                        │
    │   - Go to https://your-domain.gov       │
    │   - Login as officer                    │
    │   - Issue tickets anywhere              │
    └─────────────────────────────────────────┘
```

---

## Step 1: Get a Domain & SSL Certificate

1. **Acquire a domain** (e.g., from GoDaddy or Namecheap):
   - Domain: `enforcement.gov` or `traffic.gov` or similar

2. **Point domain to your server IP**:
   - Create A Record: `your-domain.gov` → `YOUR_SERVER_PUBLIC_IP`

3. **Install SSL (free with Let's Encrypt):**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.gov
   ```
   - Follow prompts, select "Redirect" option for HTTPS

---

## Step 2: Server Setup

### Install software on your server:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y python3 python3-pip python3-venv nodejs npm postgresql nginx git

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

---

## Step 3: Deploy Backend

```bash
# Create project directory
cd /opt
sudo mkdir payfine && cd payfine

# Upload the code (from your computer):
# Use FileZilla/WinSCP or git clone from your repository

# Set up database
sudo -u postgres psql
CREATE DATABASE payfine_db;
CREATE USER payfine_user WITH PASSWORD 'YOUR_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE payfine_db TO payfine_user;
\q

# Set up Python virtual environment
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
nano .env
```

**Update .env with:**
```env
DATABASE_URL=postgresql://payfine_user:YOUR_STRONG_PASSWORD@localhost/payfine_db
SECRET_KEY=YOUR_64_CHARACTER_RANDOM_STRING
JWT_SECRET_KEY=YOUR_64_CHARACTER_RANDOM_STRING
FLASK_ENV=production

# PowerTranz Configuration
POWERTRANZ_MERCHANT_ID=your-merchant-id
POWERTRANZ_PASSWORD=your-password
POWERTRANZ_API_URL=https://api.powertranz.com/api/v3

# CORS
CORS_ORIGINS=https://your-domain.gov
```

```bash
# Initialize database
python3 seed_production_ready.py

# Test it runs
python3 run.py
# (Press Ctrl+C to stop)
```

---

## Step 4: Run Backend with Gunicorn

```bash
# Install gunicorn if needed
pip install gunicorn

# Run in background (production)
nohup gunicorn --bind 0.0.0.0:8000 --workers 4 wsgi:app > /var/log/payfine.log 2>&1 &

# Check it's running
curl http://localhost:8000/health
```

---

## Step 5: Deploy Frontend

```bash
cd ../frontend
npm install
npm run build

# Copy to web server
sudo mkdir -p /var/www/payfine
sudo cp -r build/* /var/www/payfine/
```

---

## Step 6: Configure Nginx (Reverse Proxy)

```bash
sudo nano /etc/nginx/sites-available/payfine
```

**Paste this configuration:**

```nginx
server {
    listen 80;
    server_name your-domain.gov;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.gov;

    ssl_certificate /etc/letsencrypt/live/your-domain.gov/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.gov/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Frontend
    location / {
        root /var/www/payfine;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:8000;
    }
}
```

```bash
# Enable and restart
sudo ln -s /etc/nginx/sites-available/payfine /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Step 7: Test It Works

**From any computer:**
1. Open browser
2. Go to `https://your-domain.gov`
3. You should see the PayFine login page ✅

**Test admin login:**
- Username: `admin`
- Password: `admin123`

**Test officer login:**
- Username: `officer`
- Password: `officer123`

**Test citizen portal:**
- Click "Ticket Lookup"
- Enter ticket serial: `TRF001`

---

## Step 8: Field Officer Devices Setup

### Option A: Sunmi V2 POS Tablets (Recommended for Printing)
1. Connect to WiFi or enable mobile data
2. Open browser
3. Go to `https://your-domain.gov`
4. Bookmark the page / Add to home screen
5. Login as field officer
6. Sunmi printer will be automatically detected

### Option B: Any Android Phone/Tablet
1. Open Chrome browser
2. Go to `https://your-domain.gov`
3. Login as field officer
4. Add to home screen for quick access

### Option C: iPhone/iPad
1. Open Safari
2. Go to `https://your-domain.gov`
3. Login as field officer
4. Add to home screen for quick access

---

## Step 9: Important Security Changes

**Before going live, MUST change these:**

1. **Change admin password:**
   - Login as admin → User Management → Change password
   - Use a strong password (minimum 12 characters)

2. **Change officer passwords:**
   - Login as admin → User Management → Update all officer passwords

3. **Generate new secret keys:**
   ```bash
   # Run this to generate random keys
   python3 -c "import secrets; print('SECRET_KEY=' + secrets.token_hex(32))"
   python3 -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_hex(32))"
   ```
   - Update `.env` with new keys
   - Restart backend: `sudo systemctl restart payfine`

4. **Configure PowerTranz:**
   - Update merchant credentials in `.env`
   - Test payment processing

---

## Step 10: Backup Automation

```bash
sudo crontab -e
```

**Add this line (runs daily at 2 AM):**
```
0 2 * * * pg_dump -U postgres payfine_db > /backup/payfine_$(date +\%Y\%m\%d).sql
```

```bash
# Create backup folder
sudo mkdir -p /backup
sudo chmod 700 /backup
```

---

## Step 11: System Service (Auto-start on Reboot)

Create a systemd service for automatic startup:

```bash
sudo nano /etc/systemd/system/payfine.service
```

**Paste this:**
```ini
[Unit]
Description=PayFine Digital Enforcement System
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/payfine/backend
Environment="PATH=/opt/payfine/backend/venv/bin"
ExecStart=/opt/payfine/backend/venv/bin/gunicorn --bind 0.0.0.0:8000 --workers 4 wsgi:app
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable payfine
sudo systemctl start payfine
sudo systemctl status payfine
```

---

## Quick Reference Card

| Item | Value |
|------|-------|
| **Server URL** | https://your-domain.gov |
| **Admin Login** | admin / admin123 (CHANGE THIS!) |
| **Officer Login** | officer / officer123 (CHANGE THIS!) |
| **Citizen Portal** | https://your-domain.gov/lookup |
| **API Endpoint** | https://your-domain.gov/api |
| **Health Check** | https://your-domain.gov/health |

---

## Troubleshooting

**Can't connect?**
```bash
# Check services
sudo systemctl status payfine
sudo systemctl status nginx
sudo systemctl status postgresql

# Check firewall
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check logs
tail -f /var/log/payfine.log
tail -f /var/log/nginx/error.log
```

**Officer can't login?**
- Check internet connection on their device
- Verify credentials (passwords may need changing)
- Check if backend is running: `curl http://localhost:8000/health`

**Payment not working?**
- Verify PowerTranz credentials in `.env`
- Check PowerTranz dashboard for transaction logs
- Review backend logs: `tail -f /var/log/payfine.log`

**Database issues?**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check database connection
sudo -u postgres psql -d payfine_db -c "SELECT COUNT(*) FROM tickets;"
```

---

## Monitoring & Maintenance

### Daily Checks
- Check system logs: `tail -f /var/log/payfine.log`
- Verify backups exist: `ls -lh /backup/`
- Check disk space: `df -h`

### Weekly Tasks
- Review transaction reports in admin panel
- Check for system updates: `sudo apt update && sudo apt upgrade`
- Test backup restoration

### Monthly Tasks
- Rotate logs: `sudo logrotate /etc/logrotate.d/payfine`
- Review user accounts and permissions
- Update SSL certificate if needed: `sudo certbot renew`

---

## That's It! 🎉

Your PayFine Digital Enforcement System is now live at `https://your-domain.gov`

- Citizens can look up and pay tickets from anywhere
- Field officers can issue tickets from anywhere using tablets/phones
- Admins manage everything from the admin panel
- All data is secure and encrypted

**Next Steps:**
1. Customize branding in Admin → Branding Settings
2. Define your jurisdiction's offences in Admin → Offence Management
3. Create field officer accounts in Admin → User Management
4. Train staff on the system
5. Go live!

---

**PayFine Digital Enforcement System** - Modern enforcement solutions for modern governments
