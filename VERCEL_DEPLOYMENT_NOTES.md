# Vercel Deployment - Important Notes ⚠️

## ✅ Fixed Issue

**Problem:** Vercel error - "functions property cannot be used with builds property"

**Solution:** Removed the `functions` property from `vercel.json`. Now uses only `builds`.

---

## 📋 Current Configuration

### **vercel.json**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/server/index.js",
      "use": "@vercel/node"
    },
    {
      "src": "client/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "api/server/index.js"
    },
    {
      "src": "/(.*)",
      "dest": "client/dist/$1"
    }
  ],
  "env": {
    "NODE_ENV": "production",
    "MONGO_URI": "@mongo_uri",
    "ANTHROPIC_API_KEY": "user_provided",
    "SESSION_EXPIRY": "900000",
    "REFRESH_TOKEN_EXPIRY": "604800000"
  }
}
```

---

## ⚠️ Critical Limitations on Vercel

### **Serverless Function Constraints:**

1. **Execution Timeout:**
   - Hobby: 10 seconds max
   - Pro: 60 seconds max
   - Enterprise: 300 seconds max
   - **Your app may need longer for:**
     - MongoDB queries
     - AI model responses
     - File uploads
     - Web search operations

2. **No Persistent Connections:**
   - ❌ No WebSockets (for real-time features)
   - ❌ No Server-Sent Events (SSE) for streaming
   - ❌ Each request = new cold start
   - **Your app uses:** Streaming AI responses, real-time updates

3. **Memory Limits:**
   - Hobby: 1024 MB
   - Pro: 3008 MB
   - **Your app loads:** Large language models, user sessions, MongoDB connections

4. **Cold Starts:**
   - First request = slow (1-5 seconds)
   - Affects user experience
   - MongoDB connections take time to establish

---

## 🚀 Recommended Deployment Strategy

### **Option 1: Hybrid Deployment (BEST)**

**Backend:** VPS or Cloud Platform
- Railway.app (easiest)
- Render.com
- DigitalOcean App Platform
- AWS EC2 / Lightsail
- Google Cloud Run

**Frontend:** Vercel or Netlify
- Fast CDN
- Auto-scaling
- Zero config

**Why this works:**
- ✅ Backend runs continuously (no cold starts)
- ✅ WebSockets work
- ✅ No timeout limits
- ✅ Persistent MongoDB connections
- ✅ Frontend is fast and cached globally

### **Option 2: All-in-One Platform**

Deploy both on:
- **Railway** (recommended - easy setup, good pricing)
- **Render** (generous free tier)
- **Fly.io** (closer to metal, good for real-time)
- **DigitalOcean** (traditional VPS)

**Why this works:**
- ✅ Everything in one place
- ✅ No CORS issues
- ✅ Persistent connections
- ✅ Better for your use case

### **Option 3: Vercel (Testing Only)**

Only use for:
- Demo purposes
- Testing deployments
- Small-scale usage

**Expect issues with:**
- ❌ Long AI responses timing out
- ❌ File upload failures
- ❌ Streaming not working properly
- ❌ Slow cold starts

---

## 📝 Vercel Environment Variables

You'll need to set these in Vercel dashboard:

### **Required:**
```bash
NODE_ENV=production
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
CREDS_KEY=your_32_char_encryption_key
CREDS_IV=your_16_char_encryption_iv
```

### **For Google Auth:**
```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=https://your-domain.vercel.app/oauth/google/callback
ALLOW_SOCIAL_LOGIN=true
ALLOW_SOCIAL_REGISTRATION=true
```

### **For Claude API:**
```bash
ANTHROPIC_API_KEY=user_provided
# Or set your org key:
# ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
```

### **For Web Search:**
```bash
SEARXNG_INSTANCE_URL=https://searx.be
```

### **Domain Settings:**
```bash
DOMAIN_CLIENT=https://your-app.vercel.app
DOMAIN_SERVER=https://your-app.vercel.app
```

---

## 🔧 Deployment Steps for Vercel

### **1. Prepare Environment Variables**

In Vercel dashboard:
1. Go to your project
2. Settings → Environment Variables
3. Add all required variables above
4. Set for: Production, Preview, Development

### **2. Configure Build Settings**

**Build Command:**
```bash
npm install && cd client && npm install && npm run build
```

**Output Directory:**
```
client/dist
```

**Install Command:**
```bash
npm install
```

### **3. Deploy**

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

Or connect your GitHub repo to Vercel for auto-deployments.

---

## 🐛 Expected Issues on Vercel

### **1. Timeout Errors**
**Symptom:** "Function execution timed out"
**Cause:** AI responses take > 10 seconds
**Fix:** Upgrade to Pro ($20/month) or deploy backend elsewhere

### **2. Cold Starts**
**Symptom:** First request very slow
**Cause:** Serverless function needs to spin up
**Fix:** Use a real server (Railway, Render) or upgrade to Pro with reserved instances

### **3. MongoDB Connections**
**Symptom:** "Too many connections" or timeouts
**Cause:** Each function creates new connection
**Fix:** Use MongoDB Atlas M0 cluster (free) with connection pooling

### **4. File Uploads Failing**
**Symptom:** Large file uploads fail
**Cause:** 4.5MB request limit + timeout
**Fix:** Deploy backend on real server

### **5. Streaming Not Working**
**Symptom:** AI responses don't stream, appear all at once
**Cause:** Vercel buffers responses
**Fix:** Deploy backend elsewhere

---

## 💰 Cost Comparison

### **Vercel (Frontend + Backend):**
- Hobby: Free (limited, will timeout)
- Pro: $20/month (still has limits)
- **Not recommended for your app**

### **Railway (Recommended):**
- $5/month base
- Pay for usage (~$10-20/month for small app)
- No limits, persistent connections
- **Best for Enable app**

### **Render:**
- Free tier available
- Paid: $7/month per service
- Good for MVP/testing

### **Hybrid (Railway Backend + Vercel Frontend):**
- Backend: $10-15/month (Railway)
- Frontend: Free (Vercel)
- **Total: ~$10-15/month**
- **Best performance/cost ratio**

---

## 🎯 My Recommendation for Enable

### **For Production:**

1. **Backend on Railway:**
   ```bash
   # In Railway dashboard:
   # 1. New Project → Deploy from GitHub
   # 2. Select your repo
   # 3. Set root directory to "/" 
   # 4. Set start command: npm run backend:dev
   # 5. Add all environment variables
   ```

2. **Frontend on Vercel:**
   ```bash
   # In Vercel:
   # 1. Import GitHub repo
   # 2. Framework: Vite
   # 3. Root directory: client
   # 4. Build command: npm run build
   # 5. Output: dist
   ```

3. **Update DOMAIN_CLIENT in Railway:**
   ```bash
   DOMAIN_CLIENT=https://your-app.vercel.app
   ```

### **For Testing/Demo:**
- Use current Vercel setup
- Expect timeouts with long responses
- Keep sessions short
- Monitor usage

---

## ✅ Current Status

```
✅ vercel.json:     Fixed (removed functions property)
⚠️  Deployment:     Will work but with limitations
🎯 Recommended:     Hybrid deployment (Railway + Vercel)
📝 Next Steps:      Set environment variables in Vercel dashboard
```

---

## 📚 Useful Links

- **Vercel Limits:** https://vercel.com/docs/concepts/limits/overview
- **Railway Docs:** https://docs.railway.app/
- **Render Docs:** https://render.com/docs
- **MongoDB Atlas:** https://www.mongodb.com/cloud/atlas

---

**For best results with your Enable app, I strongly recommend the hybrid approach!**

Railway backend (~$15/month) + Vercel frontend (free) = Best performance and reliability 🚀
