# Deployment Guide: Whatfix AI Assistant with Claude API

This guide covers deploying the Enable-based Whatfix AI Assistant to Vercel, Netlify, or a hybrid setup.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Database Setup (MongoDB Atlas)](#database-setup-mongodb-atlas)
- [Vercel Deployment](#vercel-deployment)
- [Netlify Deployment](#netlify-deployment)
- [Hybrid Deployment (Recommended)](#hybrid-deployment-recommended)
- [Environment Variables](#environment-variables)
- [Post-Deployment Configuration](#post-deployment-configuration)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

- Node.js 20+ installed locally
- A MongoDB Atlas account (free tier available)
- A Vercel or Netlify account
- Git repository with the codebase
- Claude API keys for users (or organization key)

---

## Database Setup (MongoDB Atlas)

1. **Create a MongoDB Atlas Account**
   - Go to [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas)
   - Sign up for a free account

2. **Create a New Cluster**
   - Click "Build a Database"
   - Choose the free M0 tier
   - Select your preferred cloud provider and region
   - Click "Create Cluster"

3. **Configure Network Access**
   - Go to "Network Access" in the left sidebar
   - Click "Add IP Address"
   - Choose "Allow Access from Anywhere" (0.0.0.0/0)
   - **Important**: Ensure your database uses strong authentication

4. **Create Database User**
   - Go to "Database Access" in the left sidebar
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Create a strong username and password
   - Set "Database User Privileges" to "Read and write to any database"
   - Click "Add User"

5. **Get Connection String**
   - Go to "Database" and click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Replace `<dbname>` with `Enable`
   - Example: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/Enable?retryWrites=true&w=majority`

---

## Vercel Deployment

### Option A: Deploy via Vercel Dashboard (Recommended)

1. **Push Code to GitHub**
   ```bash
   git add .
   git commit -m "Add Whatfix onboarding and deployment config"
   git push origin main
   ```

2. **Import Project in Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New..." > "Project"
   - Import your GitHub repository
   - Vercel will auto-detect the `vercel.json` configuration

3. **Configure Environment Variables**
   - In the Vercel project settings, go to "Environment Variables"
   - Add the following variables:

   | Variable Name | Value | Notes |
   |--------------|-------|-------|
   | `MONGO_URI` | Your MongoDB Atlas connection string | From step above |
   | `JWT_SECRET` | Random 32+ character string | Generate with `openssl rand -hex 32` |
   | `CREDS_KEY` | Random 64-character hex string | Generate with `openssl rand -hex 32` |
   | `CREDS_IV` | Random 32-character hex string | Generate with `openssl rand -hex 16` |
   | `ANTHROPIC_API_KEY` | `user_provided` | Users will provide their own keys |
   | `SESSION_EXPIRY` | `900000` | 15 minutes in milliseconds |
   | `REFRESH_TOKEN_EXPIRY` | `604800000` | 7 days in milliseconds |
   | `DOMAIN_CLIENT` | Your Vercel domain | e.g., `https://yourapp.vercel.app` |
   | `DOMAIN_SERVER` | Your Vercel domain | Same as above |

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete (~5-10 minutes)
   - Visit your deployment URL

### Option B: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Add Environment Variables**
   ```bash
   vercel env add MONGO_URI
   vercel env add JWT_SECRET
   vercel env add CREDS_KEY
   vercel env add CREDS_IV
   # ... add remaining variables
   ```

4. **Deploy to Production**
   ```bash
   vercel --prod
   ```

### Vercel Limitations

⚠️ **Important**: Vercel serverless functions have limitations:
- **No MeiliSearch**: Search functionality disabled
- **No RAG API**: Document embeddings disabled
- **10-second timeout** on free tier (30 seconds on Pro)
- **Cold starts**: First request after inactivity may be slow
- **No background jobs**: Cron tasks not supported

---

## Netlify Deployment

### Option A: Deploy via Netlify Dashboard

1. **Push Code to GitHub**
   ```bash
   git add .
   git commit -m "Add Whatfix onboarding and deployment config"
   git push origin main
   ```

2. **Import Project in Netlify**
   - Go to [netlify.com](https://netlify.com)
   - Click "Add new site" > "Import an existing project"
   - Connect to GitHub and select your repository
   - Netlify will auto-detect the `netlify.toml` configuration

3. **Configure Environment Variables**
   - In the Netlify site settings, go to "Environment Variables"
   - Add the same variables as Vercel (see table above)

4. **Deploy**
   - Click "Deploy site"
   - Wait for build to complete (~5-10 minutes)
   - Visit your deployment URL

### Option B: Deploy via Netlify CLI

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify**
   ```bash
   netlify login
   ```

3. **Initialize Site**
   ```bash
   netlify init
   ```

4. **Add Environment Variables**
   - Go to Netlify dashboard
   - Navigate to Site Settings > Environment Variables
   - Add all required variables (see table above)

5. **Deploy to Production**
   ```bash
   netlify deploy --prod
   ```

### Netlify Limitations

⚠️ **Important**: Similar to Vercel:
- **No MeiliSearch**: Search functionality disabled
- **No RAG API**: Document embeddings disabled
- **10-second timeout** on free tier (26 seconds on Pro)
- **Cold starts**: First request after inactivity may be slow
- **No background jobs**: Cron tasks not supported

---

## Hybrid Deployment (Recommended)

For production use with full features, deploy the backend on a traditional server and frontend on Vercel/Netlify.

### Architecture

```
Frontend (Vercel/Netlify) → Backend API (Railway/Render/DigitalOcean)
                                    ↓
                          MongoDB + MeiliSearch + RAG API
```

### Backend Setup (Railway Example)

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Deploy Backend**
   - Click "New Project" > "Deploy from GitHub repo"
   - Select your repository
   - Railway will detect Docker configuration

3. **Add Services**
   - Add MongoDB service (or use MongoDB Atlas)
   - Add MeiliSearch service
   - Configure environment variables

4. **Get Backend URL**
   - Railway will provide a public URL like `https://yourapp.railway.app`

### Frontend Setup (Vercel)

1. **Deploy Frontend to Vercel**
   - Follow Vercel deployment steps above

2. **Configure CORS**
   - In backend `.env`, set:
     ```bash
     DOMAIN_CLIENT=https://yourapp.vercel.app
     DOMAIN_SERVER=https://yourapp.railway.app
     ```

3. **Update Frontend API URL**
   - In Vercel environment variables, add:
     ```bash
     VITE_API_URL=https://yourapp.railway.app
     ```

### Benefits of Hybrid Deployment

✅ Full feature support (search, RAG, background jobs)
✅ No serverless timeout limitations
✅ Better performance and reliability
✅ Persistent WebSocket connections
✅ Easier to scale independently

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/Enable` |
| `JWT_SECRET` | Secret for JWT tokens | `your-secret-key-here` |
| `CREDS_KEY` | Encryption key for API keys | 64-char hex string |
| `CREDS_IV` | Encryption IV for API keys | 32-char hex string |
| `ANTHROPIC_API_KEY` | Set to `user_provided` | `user_provided` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SESSION_EXPIRY` | Session timeout (ms) | `900000` (15 min) |
| `REFRESH_TOKEN_EXPIRY` | Refresh token timeout (ms) | `604800000` (7 days) |
| `DOMAIN_CLIENT` | Frontend domain | Auto-detected |
| `DOMAIN_SERVER` | Backend domain | Auto-detected |

### Generating Secure Keys

```bash
# Generate JWT_SECRET (32 characters)
openssl rand -hex 32

# Generate CREDS_KEY (64 characters)
openssl rand -hex 32

# Generate CREDS_IV (32 characters)
openssl rand -hex 16
```

---

## Post-Deployment Configuration

### 1. Test User Registration

1. Visit your deployment URL
2. Click "Register" and create a test account
3. Check MongoDB Atlas to verify user was created

### 2. Add Claude API Key

1. Login with your test account
2. Go to Settings (gear icon)
3. Navigate to "Account" tab
4. Add your Claude API key in the API Keys section
5. Click "Save"

### 3. Complete Onboarding

1. After login, the onboarding modal should appear automatically
2. Select your role (Solutions Consultant or Sales Engineer)
3. Choose use cases and focus areas
4. Add custom instructions (optional)
5. Click "Complete Setup"

### 4. Test Chat Functionality

1. Start a new conversation
2. Send a test message related to Whatfix
3. Verify the AI response includes Whatfix context
4. Check that role-based prompts are working

### 5. Reopen Onboarding (Optional)

1. Go to Settings > Onboarding tab
2. Click "Restart Onboarding Setup"
3. Update your preferences
4. Test that changes are reflected in responses

---

## Troubleshooting

### Issue: "Failed to connect to database"

**Solution**: 
- Verify MongoDB Atlas IP whitelist includes `0.0.0.0/0`
- Check connection string format
- Ensure database user has correct permissions

### Issue: "API key not found" when chatting

**Solution**:
- Verify `ANTHROPIC_API_KEY=user_provided` in environment variables
- Ensure user has added their Claude API key in Settings > Account
- Check that `CREDS_KEY` and `CREDS_IV` are set correctly

### Issue: Onboarding modal not appearing

**Solution**:
- Clear browser localStorage: `localStorage.clear()`
- Refresh the page
- Check browser console for errors
- Verify user schema has `onboarding` field in MongoDB

### Issue: "502 Bad Gateway" on Vercel/Netlify

**Solution**:
- Check function logs in deployment dashboard
- Verify MongoDB connection string is correct
- Ensure all environment variables are set
- Check if function timeout is being exceeded

### Issue: Slow response times

**Solution**:
- Use hybrid deployment for better performance
- Upgrade to Pro tier for longer timeouts
- Check MongoDB Atlas cluster region (choose nearest)
- Enable MongoDB connection pooling

### Issue: Cold starts on Vercel/Netlify

**Solution**:
- Expected behavior on free tier
- Upgrade to Pro for faster cold starts
- Consider hybrid deployment with always-on backend
- Implement health check pings to keep functions warm

---

## Additional Resources

- [Enable Documentation](https://www.Enable.ai/docs)
- [MongoDB Atlas Setup Guide](https://www.mongodb.com/docs/atlas/getting-started/)
- [Vercel Documentation](https://vercel.com/docs)
- [Netlify Documentation](https://docs.netlify.com/)
- [Railway Documentation](https://docs.railway.app/)

---

## Support

For issues specific to this implementation:
1. Check the troubleshooting section above
2. Review application logs in deployment platform
3. Check MongoDB Atlas logs for database issues
4. Verify all environment variables are correctly set

For Enable-specific issues:
- [Enable GitHub Issues](https://github.com/danny-avila/Enable/issues)
- [Enable Discord](https://discord.Enable.ai/)
