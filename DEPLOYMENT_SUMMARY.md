# Deployment Configuration Summary

## Changes Made for Render + Vercel Deployment

### 1. Backend Configuration (Render)

**New Files:**
- `render.yaml` - Render service configuration (optional, for Blueprint deployment)
- `RENDER_SETUP.md` - Detailed backend deployment guide

**Configuration:**
- Node.js web service
- Build command: `npm install && npm run build:packages`
- Start command: `npm run backend`
- Health check endpoint: `/api/health`

### 2. Frontend Configuration (Vercel)

**New Files:**
- `.env.production.example` - Production environment variables template
- `VERCEL_FRONTEND_CONFIG.md` - Frontend deployment guide
- `DEPLOYMENT_GUIDE.md` - Complete step-by-step guide

**Modified Files:**
- `vercel.json` - Updated for frontend-only deployment
- `packages/data-provider/src/api-endpoints.ts` - Support for `VITE_API_URL`
- `packages/data-provider/src/request.ts` - Enable credentials for CORS

**Key Changes:**
- API calls now use `VITE_API_URL` environment variable
- CORS credentials enabled by default
- Removed backend API routes from Vercel config

### 3. Environment Variables

**Backend (Render) - Required:**
```bash
MONGO_URI=mongodb+srv://...
DOMAIN_CLIENT=https://your-frontend.vercel.app
DOMAIN_SERVER=https://your-backend.onrender.com
JWT_SECRET=<generated>
JWT_REFRESH_SECRET=<generated>
CREDS_KEY=<32-chars>
CREDS_IV=<16-chars>
HOST=0.0.0.0
PORT=10000
TRUST_PROXY=1
NODE_ENV=production
```

**Frontend (Vercel) - Required:**
```bash
VITE_API_URL=https://your-backend.onrender.com
DOMAIN_CLIENT=https://your-frontend.vercel.app
NODE_ENV=production
```

## How It Works

### Development (Local)
```
┌─────────────┐
│  Frontend   │
│  :3090      │──┐
└─────────────┘  │  Proxy via Vite
                 │
                 ▼
            ┌─────────────┐
            │  Backend    │
            │  :3080      │
            └─────────────┘
```
- Vite proxy forwards `/api` requests to backend
- Both run locally on different ports

### Production (Render + Vercel)
```
┌─────────────────┐         ┌──────────────────┐
│  Vercel         │         │  Render          │
│  Frontend       │────────▶│  Backend API     │
│  Static Assets  │  HTTPS  │  Node.js         │
└─────────────────┘         └──────────────────┘
```
- Frontend makes direct API calls to Render backend
- VITE_API_URL sets the backend URL
- CORS configured via DOMAIN_CLIENT

## Deployment Steps

### 1. Setup MongoDB Atlas
- Create free cluster
- Get connection string
- Whitelist IPs: `0.0.0.0/0`

### 2. Generate Secrets
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Deploy Backend to Render
- Connect GitHub repo
- Set environment variables
- Deploy and get URL

### 4. Deploy Frontend to Vercel
- Set `VITE_API_URL` environment variable
- Push to GitHub (auto-deploys)
- Update backend's `DOMAIN_CLIENT`

### 5. Test
- Visit frontend URL
- Test login/registration
- Verify API calls work

## Key Files Reference

| File | Purpose |
|------|---------|
| `render.yaml` | Render service configuration |
| `vercel.json` | Vercel deployment config (frontend only) |
| `RENDER_SETUP.md` | Backend deployment guide |
| `VERCEL_FRONTEND_CONFIG.md` | Frontend deployment guide |
| `DEPLOYMENT_GUIDE.md` | Complete step-by-step guide |
| `.env.production.example` | Production environment variables template |

## Important Notes

### CORS Configuration
Backend must allow frontend origin:
- Backend `DOMAIN_CLIENT` = Frontend URL
- Frontend `VITE_API_URL` = Backend URL

### Service Worker (PWA)
- Only active in production
- Caches static assets
- Doesn't cache API routes

### Authentication
- Cookies used for auth
- `withCredentials: true` for all requests
- `TRUST_PROXY=1` required on Render

### Free Tier Limitations
- **Render**: Spins down after 15min (30-50s cold start)
- **Vercel**: 100GB bandwidth/month
- **MongoDB**: 512MB storage

## Testing Endpoints

After deployment, test these:

```bash
# Backend health
curl https://your-backend.onrender.com/api/health

# Backend config
curl https://your-backend.onrender.com/api/config

# Frontend
open https://your-frontend.vercel.app
```

## Troubleshooting Quick Reference

| Issue | Solution |
|-------|----------|
| API 404 | Check `VITE_API_URL` in Vercel |
| CORS Error | Verify `DOMAIN_CLIENT` matches exactly |
| 401 Loop | Check `TRUST_PROXY=1`, verify JWT secrets |
| Cold Start | Expected on free tier, upgrade or use Cron |
| Service Worker Error | Clear cache, usually harmless |

## Cost Estimate

**Free Tier (Testing):**
- $0/month (all free tiers)

**Production:**
- Vercel Pro: $20/month
- Render Starter: $7/month
- MongoDB M10: $57/month
- **Total: ~$84/month**

## Next Steps After Deployment

1. ✅ Test full authentication flow
2. ✅ Configure AI provider keys
3. ✅ Set up custom domain (optional)
4. ✅ Enable Redis for caching (optional)
5. ✅ Configure email SMTP
6. ✅ Set up monitoring
7. ✅ Plan backup strategy

## Support

For detailed guides, see:
- `DEPLOYMENT_GUIDE.md` - Complete walkthrough
- `RENDER_SETUP.md` - Backend specifics
- `VERCEL_FRONTEND_CONFIG.md` - Frontend specifics

---

**Ready to deploy?** Start with `DEPLOYMENT_GUIDE.md` for step-by-step instructions.
