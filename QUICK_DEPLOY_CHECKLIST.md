# Quick Deploy Checklist ✅

Use this checklist to deploy your backend to Render and frontend to Vercel.

## Pre-Deployment

- [ ] Code committed to GitHub
- [ ] Read `DEPLOYMENT_GUIDE.md` overview
- [ ] MongoDB Atlas account created
- [ ] Render account created  
- [ ] Vercel account created

## Phase 1: Database (10 min)

- [ ] Create MongoDB Atlas cluster (free tier)
- [ ] Create database user with password
- [ ] Whitelist all IPs: `0.0.0.0/0`
- [ ] Copy connection string
- [ ] Test connection (optional)

**Connection String Format:**
```
mongodb+srv://username:password@cluster.mongodb.net/enablenext
```

## Phase 2: Generate Secrets (2 min)

Run these commands locally and **save the outputs**:

```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# JWT_REFRESH_SECRET  
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# CREDS_KEY
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# CREDS_IV
node -e "console.log(require('crypto').randomBytes(8).toString('hex'))"
```

- [ ] JWT_SECRET generated and saved
- [ ] JWT_REFRESH_SECRET generated and saved
- [ ] CREDS_KEY generated and saved
- [ ] CREDS_IV generated and saved

## Phase 3: Deploy Backend to Render (15 min)

### Create Service

- [ ] Go to https://dashboard.render.com
- [ ] Click "New +" → "Web Service"
- [ ] Connect GitHub repository
- [ ] Configure service:
  - Name: `enablenext-backend`
  - Runtime: `Node`
  - Build: `npm install && npm run build:packages`
  - Start: `npm run backend`

### Set Environment Variables

Copy from `RENDER_SETUP.md` and set these:

**Required:**
- [ ] `MONGO_URI` (from Phase 1)
- [ ] `JWT_SECRET` (from Phase 2)
- [ ] `JWT_REFRESH_SECRET` (from Phase 2)
- [ ] `CREDS_KEY` (from Phase 2)
- [ ] `CREDS_IV` (from Phase 2)
- [ ] `DOMAIN_CLIENT=https://temp.com` (update later)
- [ ] `DOMAIN_SERVER=https://temp.com` (update later)
- [ ] `NODE_ENV=production`
- [ ] `HOST=0.0.0.0`
- [ ] `PORT=10000`
- [ ] `TRUST_PROXY=1`

**Optional:**
- [ ] `OPENAI_API_KEY` (if using OpenAI)
- [ ] `ANTHROPIC_API_KEY` (if using Claude)
- [ ] Other AI provider keys

### Deploy & Update URLs

- [ ] Click "Create Web Service"
- [ ] Wait for build to complete (~5-10 min)
- [ ] Copy your backend URL: `https://_____.onrender.com`
- [ ] Update `DOMAIN_SERVER` with actual backend URL
- [ ] Save changes (triggers redeploy)
- [ ] Test health endpoint: `curl https://your-url.onrender.com/api/health`
- [ ] Should return: `{"status":"ok"}`

**Your Backend URL:**
```
https://_________________________________.onrender.com
```

## Phase 4: Deploy Frontend to Vercel (10 min)

### Set Environment Variables

- [ ] Go to Vercel project → Settings → Environment Variables
- [ ] Add for **Production** environment:

```bash
VITE_API_URL=https://your-backend-name.onrender.com
DOMAIN_CLIENT=https://your-frontend-name.vercel.app
NODE_ENV=production
```

- [ ] `VITE_API_URL` set (use backend URL from Phase 3)
- [ ] `DOMAIN_CLIENT` set (will update after deploy)
- [ ] `NODE_ENV` set

### Deploy

**Option A: Auto Deploy**
- [ ] Push to GitHub: `git push origin main`
- [ ] Vercel auto-deploys
- [ ] Wait for deployment to complete

**Option B: Manual Deploy**
- [ ] Run: `vercel --prod`
- [ ] Wait for deployment

### Get Frontend URL & Update Backend

- [ ] Copy your Vercel URL: `https://_____.vercel.app`
- [ ] Update `DOMAIN_CLIENT` in Vercel if needed
- [ ] Go back to Render → Environment
- [ ] Update `DOMAIN_CLIENT` with actual Vercel URL
- [ ] Save changes (triggers redeploy)

**Your Frontend URL:**
```
https://_________________________________.vercel.app
```

## Phase 5: Test Everything (5 min)

### Basic Tests

- [ ] Frontend loads without errors
- [ ] No 404 errors in console
- [ ] No CORS errors in console
- [ ] Backend health check works

### Authentication Flow

- [ ] Can access register page
- [ ] Can register new account
- [ ] Can login with account
- [ ] Can access chat interface
- [ ] Stays logged in after refresh

### API Communication

- [ ] Open DevTools → Network tab
- [ ] See API calls to Render backend
- [ ] Calls return 200 (or appropriate status)
- [ ] Cookies being set/sent

## Post-Deployment

### Immediate

- [ ] Save all URLs and credentials securely
- [ ] Document environment variables
- [ ] Test on mobile device
- [ ] Test in incognito/private window

### Optional Enhancements

- [ ] Set up custom domain
- [ ] Configure Redis (Render add-on)
- [ ] Add more AI provider keys
- [ ] Set up monitoring/alerts
- [ ] Configure SMTP for emails
- [ ] Enable MongoDB backups
- [ ] Set up Render Cron Jobs (keep backend warm)

## Troubleshooting

If something doesn't work, check:

### API 404 Errors
- [ ] `VITE_API_URL` is set correctly in Vercel
- [ ] Backend is running (check Render dashboard)
- [ ] Test backend directly: `curl backend-url/api/health`

### CORS Errors
- [ ] `DOMAIN_CLIENT` in Render matches Vercel URL exactly
- [ ] Includes `https://` protocol
- [ ] No trailing slash
- [ ] Backend redeployed after change

### 401 Unauthorized
- [ ] `TRUST_PROXY=1` is set in Render
- [ ] JWT secrets are set correctly
- [ ] Try clearing browser cookies
- [ ] Check Render logs for errors

### Service Won't Start
- [ ] Check Render logs (Dashboard → Logs)
- [ ] Verify MongoDB connection string is correct
- [ ] Check all required env vars are set
- [ ] Try manual deploy (Dashboard → Manual Deploy)

## URLs Reference

Record your deployment URLs:

| Service | URL | Status |
|---------|-----|--------|
| Backend (Render) | https://_______.onrender.com | [ ] Working |
| Frontend (Vercel) | https://_______.vercel.app | [ ] Working |
| MongoDB (Atlas) | mongodb+srv://_____ | [ ] Connected |

## Environment Variables Reference

| Variable | Location | Value |
|----------|----------|-------|
| `VITE_API_URL` | Vercel | Backend URL |
| `DOMAIN_CLIENT` | Render | Frontend URL |
| `DOMAIN_CLIENT` | Vercel | Frontend URL |
| `DOMAIN_SERVER` | Render | Backend URL |
| `MONGO_URI` | Render | MongoDB connection |

## Success Criteria

Your deployment is successful when:

- ✅ Frontend loads without errors
- ✅ Can register and login
- ✅ Chat interface works
- ✅ AI responses work (if keys configured)
- ✅ File uploads work
- ✅ No CORS errors
- ✅ No 404 API errors
- ✅ Sessions persist after refresh

## Next Steps

Once everything works:

1. 📖 Review `DEPLOYMENT_GUIDE.md` for advanced configuration
2. 🔐 Set up additional AI provider keys
3. 🎨 Customize branding (if desired)
4. 📊 Set up monitoring
5. 💾 Configure backups
6. 🚀 Consider upgrading from free tier

---

**Need Help?**

- Detailed guides: `DEPLOYMENT_GUIDE.md`
- Backend setup: `RENDER_SETUP.md`  
- Frontend setup: `VERCEL_FRONTEND_CONFIG.md`
- Summary: `DEPLOYMENT_SUMMARY.md`

**Good luck with your deployment!** 🎉
