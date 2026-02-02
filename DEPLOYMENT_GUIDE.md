# Complete Deployment Guide: Render + Vercel

This guide walks you through deploying Enable with backend on Render and frontend on Vercel.

## Architecture Overview

```
┌─────────────────┐         ┌──────────────────┐
│                 │         │                  │
│  Vercel         │────────▶│  Render          │
│  (Frontend)     │  HTTPS  │  (Backend API)   │
│                 │         │                  │
└─────────────────┘         └──────────────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │                  │
                            │  MongoDB Atlas   │
                            │  (Database)      │
                            │                  │
                            └──────────────────┘
```

**Frontend (Vercel):**
- Static React app
- PWA with service worker
- CDN distributed globally
- Makes API calls to Render backend

**Backend (Render):**
- Node.js Express server
- Handles authentication, AI requests, file uploads
- Connects to MongoDB
- CORS configured for Vercel frontend

**Database (MongoDB Atlas):**
- Managed MongoDB database
- Free tier available
- Automated backups

## Quick Start Checklist

- [ ] MongoDB Atlas database created
- [ ] Secrets generated (JWT, CREDS)
- [ ] Backend deployed to Render
- [ ] Backend environment variables set
- [ ] Frontend environment variables set in Vercel
- [ ] Backend `DOMAIN_CLIENT` updated with Vercel URL
- [ ] Frontend deployed to Vercel
- [ ] Test full authentication flow

## Step-by-Step Deployment

### Phase 1: Database Setup (10 minutes)

1. **Create MongoDB Atlas Account**
   - Go to https://www.mongodb.com/cloud/atlas
   - Sign up for free account
   - Create new cluster (free M0 tier)

2. **Configure Database**
   - Database Access: Create user with password
   - Network Access: Add `0.0.0.0/0` (allow from anywhere)
   - Get connection string:
     ```
     mongodb+srv://<username>:<password>@cluster.mongodb.net/enablenext
     ```

### Phase 2: Generate Secrets (2 minutes)

Run these commands locally to generate secure secrets:

```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# JWT_REFRESH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# CREDS_KEY (32 characters)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# CREDS_IV (16 characters)
node -e "console.log(require('crypto').randomBytes(8).toString('hex'))"
```

**Save these values** - you'll need them for Render environment variables.

### Phase 3: Deploy Backend to Render (15 minutes)

**Steps:**

1. **Push to GitHub** (if not already)
   ```bash
   git add .
   git commit -m "Configure for Render deployment"
   git push origin main
   ```

2. **Create Render Service**
   - Go to https://dashboard.render.com
   - New → Web Service
   - Connect GitHub repository
   - Use these settings:
     - **Name**: `enablenext-backend`
     - **Runtime**: Node
     - **Build**: `npm install && npm run build:packages`
     - **Start**: `npm run backend`

3. **Set Environment Variables**
   - Copy all variables from `RENDER_SETUP.md`
   - Use generated secrets from Phase 2
   - Use MongoDB URI from Phase 1
   - Set `DOMAIN_CLIENT=https://enablenext-client.vercel.app` (update later)
   - Set `DOMAIN_SERVER=https://your-service.onrender.com` (update after deploy)

4. **Deploy & Get URL**
   - Click "Create Web Service"
   - Wait for build to complete (~5-10 minutes)
   - Note your backend URL: `https://your-service-name.onrender.com`

5. **Update DOMAIN_SERVER**
   - Go to Environment tab
   - Update `DOMAIN_SERVER` with your actual URL
   - Click "Save Changes" (triggers redeploy)

6. **Test Backend**
   ```bash
   curl https://your-backend-url.onrender.com/api/health
   # Should return: {"status":"ok"}
   ```

### Phase 4: Configure & Deploy Frontend to Vercel (10 minutes)

**Steps:**

1. **Set Vercel Environment Variables**
   - Go to Vercel project settings
   - Environment Variables tab
   - Add these variables (for **Production**):

   ```bash
   VITE_API_URL=https://your-backend-name.onrender.com
   DOMAIN_CLIENT=https://your-frontend-name.vercel.app
   NODE_ENV=production
   ```

2. **Deploy Frontend**
   
   **Option A: Automatic (Recommended)**
   ```bash
   git add .
   git commit -m "Configure for Vercel deployment"
   git push origin main
   ```
   Vercel auto-deploys on push.

   **Option B: Manual**
   ```bash
   # Install Vercel CLI
   npm i -g vercel

   # Deploy
   vercel --prod
   ```

3. **Get Frontend URL**
   - Note your Vercel URL: `https://your-project.vercel.app`

4. **Update Backend DOMAIN_CLIENT**
   - Go back to Render dashboard
   - Environment tab
   - Update `DOMAIN_CLIENT` with your actual Vercel URL
   - Save (triggers redeploy)

### Phase 5: Verify & Test (5 minutes)

1. **Frontend Loads**
   - Visit your Vercel URL
   - Should see login/register page
   - No errors in browser console

2. **API Connection**
   - Open browser DevTools → Network tab
   - Login attempt should call `https://your-backend.onrender.com/api/...`
   - Should see 200 responses (or 401 if not logged in)

3. **CORS Working**
   - No CORS errors in console
   - Cookies being set/sent properly

4. **Full Auth Flow**
   - Register new account
   - Login
   - Access chat interface
   - Send test message

## Common Issues & Solutions

### ❌ API 404 Errors

**Problem:** Frontend shows API 404 errors

**Solutions:**
- Verify `VITE_API_URL` is set in Vercel
- Check Render backend is running (not crashed)
- Test backend health endpoint directly
- Rebuild frontend packages: `npm run build:packages`

### ❌ CORS Errors

**Problem:** `Access-Control-Allow-Origin` errors

**Solutions:**
- Verify `DOMAIN_CLIENT` in Render exactly matches Vercel URL
- Include `https://` protocol
- No trailing slash
- Redeploy backend after changing

### ❌ 401 Unauthorized Loop

**Problem:** Keeps redirecting to login

**Solutions:**
- Check `TRUST_PROXY=1` in Render
- Verify JWT secrets are set
- Check cookies are being sent (`withCredentials: true`)
- Clear browser cookies and try again

### ❌ Service Worker Errors

**Problem:** `non-precached-url` errors

**Solutions:**
- These are usually harmless
- Clear cache and reload
- Verify PWA config in `vite.config.ts`

### ❌ Render Cold Start

**Problem:** First request takes 30-50 seconds

**Solutions:**
- Expected on free tier (spins down after 15min)
- Upgrade to Starter plan ($7/month) for always-on
- Use Render Cron Jobs to keep warm

## Environment Variables Reference

### Backend (Render)

**Essential:**
```bash
NODE_ENV=production
HOST=0.0.0.0
PORT=10000
MONGO_URI=mongodb+srv://...
DOMAIN_CLIENT=https://your-frontend.vercel.app
DOMAIN_SERVER=https://your-backend.onrender.com
JWT_SECRET=<generated>
JWT_REFRESH_SECRET=<generated>
CREDS_KEY=<generated-32-chars>
CREDS_IV=<generated-16-chars>
TRUST_PROXY=1
```

**Optional:**
```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
REDIS_URI=redis://...
S3_ENDPOINT=...
```

### Frontend (Vercel)

**Required:**
```bash
VITE_API_URL=https://your-backend.onrender.com
DOMAIN_CLIENT=https://your-frontend.vercel.app
NODE_ENV=production
```

## Cost Breakdown

### Free Tier (Good for testing)
- **Vercel**: Free (100GB bandwidth, 100 serverless function invocations)
- **Render**: Free (512MB RAM, spins down after 15min)
- **MongoDB Atlas**: Free (512MB storage, shared cluster)
- **Total**: $0/month

### Production Tier (Recommended)
- **Vercel Pro**: $20/month (more bandwidth, better performance)
- **Render Starter**: $7/month (always-on, 512MB RAM)
- **MongoDB Atlas M10**: $57/month (10GB storage, dedicated)
- **Render Redis**: $5/month (optional, caching)
- **Total**: ~$89/month

## Post-Deployment Checklist

- [ ] Custom domain configured (optional)
- [ ] SSL certificates working (automatic on both platforms)
- [ ] All AI provider keys added
- [ ] File upload tested
- [ ] Chat functionality tested
- [ ] User registration tested
- [ ] Password reset tested
- [ ] Redis configured (optional)
- [ ] Monitoring set up
- [ ] Backup strategy for MongoDB
- [ ] Error logging configured

## Monitoring & Maintenance

### Render Monitoring
- Dashboard → Metrics tab
- View CPU, memory, response times
- Set up email alerts

### Vercel Monitoring
- Analytics tab (enable in settings)
- View page views, performance
- Check function execution times

### MongoDB Monitoring
- Atlas dashboard → Metrics
- Monitor connections, operations
- Set up backup schedule

## Scaling Considerations

### When to Upgrade

**Render:**
- Upgrade if cold starts are impacting UX
- Upgrade if hitting memory limits (512MB)
- Consider Standard plan ($25/month) for 2GB RAM

**MongoDB:**
- Upgrade when approaching 512MB storage
- Upgrade for better performance (IOPS)
- M10 tier recommended for production

**Vercel:**
- Upgrade for more bandwidth
- Upgrade for team features
- Pro plan removes most limits

## Security Best Practices

- [ ] Use strong, unique secrets (32+ characters)
- [ ] Enable MongoDB IP whitelist in production
- [ ] Rotate secrets periodically
- [ ] Enable 2FA on all accounts
- [ ] Monitor logs for suspicious activity
- [ ] Keep dependencies updated
- [ ] Use environment variables (never commit secrets)

## Backup Strategy

### MongoDB Backups
- Atlas provides automatic backups
- Configure retention period
- Test restore procedure

### Environment Variables
- Keep `.env.example` updated
- Store actual values in secure password manager
- Document all custom configurations

## Quick Reference Files

- **DEPLOYMENT_GUIDE.md** (this file) - Complete deployment walkthrough
- **QUICK_DEPLOY_CHECKLIST.md** - Step-by-step checklist format
- **BUILD_SUCCESS.md** - Build configuration and fixes applied
- **render.yaml** - Render service configuration

## Support & Resources

- **Render Docs**: https://render.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **MongoDB Docs**: https://docs.atlas.mongodb.com
- **LibreChat Docs**: https://www.librechat.ai/docs

## Getting Help

If you encounter issues:

1. Check the troubleshooting section above
2. Review Render logs (Dashboard → Logs)
3. Check Vercel deployment logs
4. Verify environment variables are correct
5. Test backend health endpoint directly
6. Check MongoDB connection in Atlas

## Next Steps

Once deployed successfully:

1. Configure AI provider settings
2. Customize branding (colors, logo, etc.)
3. Set up custom domain
4. Configure email (SMTP) for password reset
5. Add Redis for better performance
6. Set up monitoring/alerting
7. Plan backup and disaster recovery

---

**Congratulations!** 🎉 Your Enable application is now deployed with backend on Render and frontend on Vercel.
