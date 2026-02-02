# Render Backend Deployment Guide

## Prerequisites

1. **MongoDB Database** - Set up MongoDB Atlas (free tier available)
2. **Render Account** - Sign up at https://render.com
3. **Environment Variables Ready** - Generate secrets (instructions below)

## Step 1: Deploy to Render

### Option A: Use render.yaml (Recommended)

1. Push your code to GitHub
2. Go to Render Dashboard → New → Blueprint
3. Connect your repository
4. Render will detect `render.yaml` and configure automatically

### Option B: Manual Setup

1. Go to Render Dashboard
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `enablenext-backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build:packages`
   - **Start Command**: `npm run backend`

## Step 2: Set Up MongoDB Atlas

1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free cluster
3. Create database user with password
4. Whitelist all IPs: `0.0.0.0/0` (for Render access)
5. Get connection string:
   ```
   mongodb+srv://<username>:<password>@cluster.mongodb.net/enablenext
   ```

## Step 3: Generate Secrets

Run these commands locally to generate secure secrets:

```bash
# Generate JWT_SECRET (copy output)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate JWT_REFRESH_SECRET (copy output)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate CREDS_KEY (must be 32 characters)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# Generate CREDS_IV (must be 16 characters)
node -e "console.log(require('crypto').randomBytes(8).toString('hex'))"
```

## Step 4: Set Environment Variables in Render

Go to your service → Environment tab and add:

### Required Variables

```bash
# Database
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/enablenext

# Domains (UPDATE AFTER FIRST DEPLOY)
DOMAIN_CLIENT=https://enablenext-client.vercel.app
DOMAIN_SERVER=https://your-service-name.onrender.com

# Server Config
NODE_ENV=production
HOST=0.0.0.0
PORT=10000
TRUST_PROXY=1

# Security (use generated values from Step 3)
JWT_SECRET=your-generated-jwt-secret
JWT_REFRESH_SECRET=your-generated-jwt-refresh-secret
CREDS_KEY=your-32-char-key
CREDS_IV=your-16-char-iv

# Session
SESSION_EXPIRY=900000
REFRESH_TOKEN_EXPIRY=604800000

# Logging
CONSOLE_JSON=true
DEBUG_LOGGING=false
```

### Optional (Add as needed)

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Google
GOOGLE_KEY=...

# Redis (if using)
REDIS_URI=redis://...

# File Storage (S3-compatible)
S3_ENDPOINT=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_BUCKET=...
```

## Step 5: Update DOMAIN_SERVER

After first deployment:
1. Get your Render URL: `https://your-service-name.onrender.com`
2. Update `DOMAIN_SERVER` environment variable with this URL
3. Redeploy (Render → Manual Deploy → Deploy latest commit)

## Step 6: Test Backend

Visit these URLs to verify:
- Health check: `https://your-service-name.onrender.com/api/health`
- API status: `https://your-service-name.onrender.com/api/config`

## Step 7: Configure Frontend (Next Steps)

After backend is deployed, you need to:
1. Update Vercel environment variables with backend URL
2. Redeploy frontend
3. See `VERCEL_FRONTEND_CONFIG.md` for details

## Important Notes

### Free Tier Limitations
- Spins down after 15 minutes of inactivity
- Cold start takes ~30-50 seconds
- 512 MB RAM (may need upgrade for production)
- 100 GB bandwidth/month

### Recommended Upgrades
- **Starter Plan ($7/month)**: No spin down, more RAM
- **Redis**: For better performance and sessions
- **MongoDB Atlas M10+**: For production workloads

## Troubleshooting

### Build Fails
- Check build logs in Render dashboard
- Ensure all workspace packages build successfully
- Verify Node version compatibility

### Connection Issues
- Verify MongoDB URI is correct
- Check MongoDB Atlas IP whitelist includes `0.0.0.0/0`
- Ensure `TRUST_PROXY=1` is set

### CORS Errors
- Verify `DOMAIN_CLIENT` matches your Vercel URL exactly
- Check frontend is sending credentials: `include`

### 500 Errors
- Check Render logs (Dashboard → Logs)
- Verify all required environment variables are set
- Check MongoDB connection string

## Health Check Endpoint

The backend includes a health check at `/api/health`. Render will use this to:
- Verify service is running
- Determine when to route traffic
- Monitor service health

## Next Steps

Once backend is deployed and tested:
1. ✅ Get Render backend URL
2. ✅ Configure Vercel frontend (see VERCEL_FRONTEND_CONFIG.md)
3. ✅ Test full authentication flow
4. ✅ Configure AI provider keys
5. ✅ Set up Redis (optional but recommended)

## Support

- Render Docs: https://render.com/docs
- MongoDB Atlas Docs: https://docs.atlas.mongodb.com
- LibreChat Docs: https://www.librechat.ai/docs
