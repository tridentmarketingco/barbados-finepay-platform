# Multi-Tenant Subdomain Setup Guide for payfine.co

## Overview

This guide explains how to launch the PayFine platform with multi-tenant subdomains like:
- `payfine.co` - Main platform landing
- `barbados.payfine.co` - Barbados government portal
- `trinidad.payfine.co` - Trinidad & Tobago government portal

Each subdomain automatically routes to the correct government/agency with their own branding, offences, and data.

---

## Architecture

```
                    ┌─────────────────────┐
                    │   payfine.co        │  ← Main landing page
                    │   (no government)   │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ barbados.      │  │ trinidad.       │  │ [new-agency].   │
│ payfine.co     │  │ payfine.co     │  │ payfine.co     │
│                 │  │                 │  │                 │
│ Government:     │  │ Government:     │  │ Government:     │
│ Barbados        │  │ Trinidad        │  │ [New Agency]    │
│ Currency: BBD   │  │ Currency: TTD   │  │ Currency: XXX   │
│ Branding: Blue │  │ Branding: Red   │  │ Branding: ...   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## Step 1: Set Up Vercel Account

1. **Create a Vercel account:**
   - Go to https://vercel.com
   - Sign up with GitHub/GitLab/Bitbucket
   - Import this repository

2. **Configure Environment Variables in Vercel:**
   
   Go to Settings → Environment Variables and add:
   
   | Variable | Value | Notes |
   |----------|-------|-------|
   | `REACT_APP_API_URL` | `https://your-backend-api.com` | Your backend URL (see Step 2) |
   | `REACT_APP_ENV` | `production` | |

---

## Step 2: Set Up Backend (Required for Multi-Tenant)

The frontend needs a backend API. For Vercel, you have two options:

### Option A: Deploy Backend to Vercel Serverless (Recommended for Start)

Create a `vercel.json` in the backend folder to enable serverless functions:

```json
{
  "builds": [
    {
      "src": "wsgi.py",
      "use": "@vercel/python",
      "config": { "maxLambdaSize": "15mb" }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "wsgi.py"
    }
  ]
}
```

Add required environment variables in Vercel for backend:
- `DATABASE_TYPE` = `sqlite` (or `postgresql` for production)
- `SECRET_KEY` = (generate a secure key)
- `JWT_SECRET_KEY` = (generate a secure key)
- `FLASK_ENV` = `production`

### Option B: Deploy Backend to AWS/Render/Railway (Better for Production)

For better performance and data sovereignty, deploy backend separately:
- **Render**: https://render.com
- **Railway**: https://railway.app
- **AWS EC2**: For on-premise data sovereignty requirements

---

## Step 3: Configure DNS (Critical Step)

### For payfine.co:

1. **Add A Record:**
   - Type: `A`
   - Name: `@` or `*`
   - Value: `76.76.19.19` (Vercel IP)

2. **Or add CNAME:**
   - Type: `CNAME`
   - Name: `@`
   - Value: `cname.vercel-dns.com`

### For Multi-Ttenant Subdomains (barbados.payfine.co, etc.):

1. **Add wildcard CNAME:**
   - Type: `CNAME`
   - Name: `*`
   - Value: `cname.vercel-dns.com`

This wildcard will automatically route all subdomains to Vercel:
- `barbados.payfine.co` ✅
- `trinidad.payfine.co` ✅
- `anynewagency.payfine.co` ✅

---

## Step 4: Configure Vercel for Wildcard Subdomains

1. **In Vercel Dashboard:**
   - Go to your project → Settings → Domains
   
2. **Add your domain:**
   - Enter: `payfine.co`
   
3. **Vercel will automatically handle all subdomains!**

---

## Step 5: Create Government Records in Database

You need to create government records with matching subdomains:

### Option A: Via Operator Panel (After Deployment)

1. Deploy and start the platform
2. Login at: `https://payfine.co/operator/login`
3. Go to **Government Management**
4. Create new government with:
   - **Government Name**: Barbados
   - **Subdomain**: `barbados`
   - **Status**: Active

### Option B: Via Database Seed

Update `backend/seed_barbados_demo.py` or create a new seed file:

```python
# In your seed file
government = Government(
    government_name='Barbados',
    subdomain='barbados',  # This MUST match the URL: barbados.payfine.co
    status='active',
    currency_code='BBD',
    # ... other fields
)
```

Run the seed:
```bash
cd backend
python seed_barbados_demo.py
```

---

## Step 6: How Multi-Tenant Routing Works

When a user visits `barbados.payfine.co`:

```
1. User requests barbados.payfine.co
         │
         ▼
2. DNS resolves to Vercel
         │
         ▼
3. Frontend loads (React app)
         │
         ▼
4. Frontend calls API: https://api.payfine.co/api/branding
         │
         ▼
5. Backend middleware extracts subdomain from request host
         │
         ▼
6. Query: Government.query.filter_by(subdomain='barbados')
         │
         ▼
7. Returns Barbados government config:
   - Custom branding (logo, colors)
   - Currency: BBD
   - Offences: Barbados-specific
   - Payment gateway: Barbados PowerTranz
```

---

## Step 7: Testing Multi-Tenant Setup

### Test Local Development:

1. Edit your `/etc/hosts` file (Mac/Linux) or `C:\Windows\System32\drivers\etc\hosts` (Windows):

```bash
# Add these lines:
127.0.0.1 barbados.localhost
127.0.0.1 trinidad.localhost
```

2. Start backend:
```bash
cd backend
python run.py
```

3. Start frontend:
```bash
cd frontend
npm start
```

4. Visit:
- `http://barbados.localhost:3000` → Barbados government
- `http://trinidad.localhost:3000` → Trinidad government
- `http://localhost:3000` → Default (no government)

### Test Production:

1. Visit `https://barbados.payfine.co` - Should show Barbados branding
2. Visit `https://trinidad.payfine.co` - Should show Trinidad branding
3. Visit `https://payfine.co` - Should show default/platform landing

---

## Step 8: Environment Configuration

### Backend .env file:

```env
# Database
DATABASE_TYPE=sqlite  # or postgresql for production

# Security
SECRET_KEY=your-secure-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-key-here

# Multi-tenant
ENABLE_SUBDOMAIN_ROUTING=true
FLASK_ENV=production

# Payment Gateway (fallback)
POWERTRANZ_API_URL=https://staging.ptranz.com/api/v3
POWERTRANZ_MERCHANT_ID=your-merchant-id
POWERTRANZ_PASSWORD=your-password

# CORS (allow your Vercel domain)
CORS_ORIGINS=https://payfine.co,https://*.payfine.co
```

### Frontend .env (or Vercel env vars):

```env
REACT_APP_API_URL=https://your-backend-url.com
REACT_APP_ENV=production
```

---

## Step 9: DNS Records Summary

| Record Type | Name | Value | Purpose |
|-------------|------|-------|---------|
| A | @ | 76.76.19.19 | Main domain to Vercel |
| CNAME | www | cname.vercel-dns.com | WWW subdomain |
| CNAME | * | cname.vercel-dns.com | All other subdomains |

---

## Step 10: Troubleshooting

### Subdomain not working?

1. **Check DNS propagation:**
   ```bash
   dig barbados.payfine.co
   # or
   nslookup barbados.payfine.co
   ```

2. **Verify wildcard is set in Vercel:**
   - Vercel Dashboard → Project → Settings → Domains
   - Should see `*.payfine.co` listed

3. **Check Government record exists:**
   - Query database: `SELECT * FROM governments WHERE subdomain='barbados'`

### Getting wrong government?

1. Check the subdomain in the database matches exactly
2. Subdomains are case-sensitive (use lowercase)
3. Clear browser cache / try incognito

### CORS errors?

1. Add your domain to `CORS_ORIGINS` in backend config
2. Format: `https://payfine.co,https://*.payfine.co`

---

## Quick Reference

| Task | Command/Action |
|------|----------------|
| Add new agency | Operator Panel → Government Management |
| Update subdomain | Edit government record in database |
| Test locally | Edit /etc/hosts, use `*.localhost:3000` |
| Check DNS | `dig your-subdomain.payfine.co` |

---

## Next Steps After Setup

1. **Configure branding** for each government via Admin Panel
2. **Set up payment gateways** per government
3. **Configure offence categories** for each jurisdiction
4. **Create user accounts** for government staff
5. **Test end-to-end** ticket creation and payment flow

---

**Need Help?** 
- Check `backend/app/middleware.py` for tenant resolution logic
- Check `QUICK_LAUNCH_GUIDE.md` for full deployment guide

