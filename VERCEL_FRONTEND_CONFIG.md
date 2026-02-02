# Vercel Frontend Configuration Guide

## Prerequisites

- Backend deployed on Render (see `RENDER_SETUP.md`)
- Backend URL ready (e.g., `https://enablenext-backend.onrender.com`)

## Step 1: Configure Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:

### Required Variables

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `VITE_API_URL` | `https://your-backend.onrender.com` | Production |
| `DOMAIN_CLIENT` | `https://your-frontend.vercel.app` | Production |
| `NODE_ENV` | `production` | Production |

### Optional Variables

| Variable Name | Description | Example |
|--------------|-------------|---------|
| `VITE_GOOGLE_ANALYTICS_ID` | Google Analytics tracking ID | `G-XXXXXXXXXX` |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key | `0x4AAA...` |
| `ALLOW_REGISTRATION` | Allow user registration | `true` |
| `ALLOW_SOCIAL_LOGIN` | Enable social login | `false` |

## Step 2: Update vercel.json

The `vercel.json` is already configured for static frontend deployment:
- Builds from `client` workspace
- Outputs to `client/dist`
- No API routes (those are on Render)

## Step 3: Deploy Frontend

### Option A: Push to Git (Recommended)

```bash
git add .
git commit -m "Configure for separate backend deployment"
git push origin main
```

Vercel will automatically deploy.

### Option B: Manual Deploy

```bash
# From project root
npm run build

# Then deploy via Vercel CLI or Dashboard
```

## Step 4: Verify Configuration

After deployment, check:

1. **Frontend loads**: Visit `https://your-frontend.vercel.app`
2. **API calls work**: Check browser console for API requests
3. **CORS works**: Verify no CORS errors in console
4. **Auth flow**: Test login/registration

## Step 5: Update Backend DOMAIN_CLIENT

Go back to Render and update the backend's `DOMAIN_CLIENT` environment variable:

```bash
DOMAIN_CLIENT=https://your-actual-vercel-url.vercel.app
```

Then redeploy the backend.

## Important Configuration Details

### How API Calls Work

The frontend uses relative URLs by default (e.g., `/api/config`). For production with separate backend:

1. `VITE_API_URL` environment variable sets the backend URL
2. Axios is configured to use this base URL
3. All API requests go to: `https://your-backend.onrender.com/api/...`

### CORS Configuration

The backend (Render) allows requests from the frontend (Vercel) via `DOMAIN_CLIENT` setting.

**Backend (Render):**
```bash
DOMAIN_CLIENT=https://your-frontend.vercel.app
```

**Frontend (Vercel):**
```bash
VITE_API_URL=https://your-backend.onrender.com
```

### Service Worker (PWA)

The service worker is configured in `client/vite.config.ts`:
- Only active in production
- Caches static assets
- Excludes `/api` and `/oauth` routes

## Troubleshooting

### API 404 Errors
- ✅ Verify `VITE_API_URL` is set correctly in Vercel
- ✅ Check Render backend is running
- ✅ Test backend directly: `curl https://your-backend.onrender.com/api/health`

### CORS Errors
```
Access to XMLHttpRequest has been blocked by CORS policy
```
- ✅ Verify `DOMAIN_CLIENT` in Render matches your Vercel URL exactly
- ✅ Include protocol: `https://` not just domain
- ✅ No trailing slash

### 401 Unauthorized
```
401 error, refreshing token
```
- ✅ Verify cookies are being sent with credentials: `include`
- ✅ Check `TRUST_PROXY=1` is set in Render
- ✅ Verify JWT secrets are set in Render

### Service Worker Errors
```
non-precached-url: index.html
```
- This is normal during navigation
- Service worker will update on page reload
- Clear browser cache if persistent

### Build Fails
- ✅ Check build logs in Vercel
- ✅ Verify all dependencies installed
- ✅ Ensure `uuid` package is in dependencies
- ✅ Check Node version compatibility

## Environment-Specific Builds

### Development (Local)
```bash
npm run frontend:dev
# Uses proxy in vite.config.ts
# API calls go to http://localhost:3080
```

### Production (Vercel)
```bash
npm run build
# Uses VITE_API_URL from environment
# API calls go to Render backend
```

## Deployment Checklist

Before going live:

- [ ] Backend deployed and tested on Render
- [ ] `VITE_API_URL` set in Vercel environment variables
- [ ] `DOMAIN_CLIENT` updated in Render backend
- [ ] Frontend deployed to Vercel
- [ ] Health check passes: `https://backend.onrender.com/api/health`
- [ ] Login/registration works
- [ ] AI chat functionality works
- [ ] File uploads work
- [ ] No CORS errors in browser console
- [ ] SSL/HTTPS working on both frontend and backend

## Performance Tips

### Reduce Cold Starts (Render Free Tier)
- Backend spins down after 15min inactivity
- First request takes 30-50 seconds
- Consider upgrading to Starter plan ($7/month)

### Optimize Frontend
- Service worker caches static assets
- Lazy load routes and components
- CDN caching via Vercel Edge Network

### Monitor Performance
- Vercel Analytics: Enable in project settings
- Backend logs: Check Render dashboard

## Next Steps

Once everything is working:

1. ✅ Set up custom domain (optional)
2. ✅ Configure Redis for better performance
3. ✅ Set up monitoring/alerts
4. ✅ Enable backup strategy for MongoDB
5. ✅ Configure CDN for file storage

## Support Resources

- Vercel Docs: https://vercel.com/docs
- Render Docs: https://render.com/docs
- LibreChat Docs: https://www.librechat.ai/docs

## Common Vercel CLI Commands

```bash
# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod

# View logs
vercel logs

# Check environment variables
vercel env ls
```
