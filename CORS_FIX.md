# CORS Configuration Fix for Login

## The Problem

Frontend on Vercel was getting 404 errors when trying to login:

```
Failed to load resource: the server responded with a status of 404 ()
refreshToken mutation error: K
There was an internal server error.
```

Backend CORS was misconfigured with just `app.use(cors())` - this doesn't handle credentials (cookies) for cross-origin requests.

## The Solution

Updated `api/server/index.js` to properly configure CORS:

### Before (Line 112):
```javascript
app.use(mongoSanitize());
app.use(cors());
app.use(cookieParser());
```

### After:
```javascript
app.use(mongoSanitize());

// CORS configuration for separate frontend deployment
const corsOptions = {
  origin: process.env.DOMAIN_CLIENT || 'http://localhost:3090',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.use(cookieParser());
```

## What This Does

1. **`origin: process.env.DOMAIN_CLIENT`** - Only allows requests from your Vercel domain
2. **`credentials: true`** - Enables cookies to be sent/received cross-origin (required for auth)
3. **`methods`** - Explicitly allows all needed HTTP methods
4. **`allowedHeaders`** - Allows Content-Type and Authorization headers

## Set DOMAIN_CLIENT in Render

This is **CRITICAL** - you MUST set this environment variable in Render:

### Go to Render Dashboard:

1. Click your service: **enablenext**
2. Go to **Environment** tab
3. Find or add **DOMAIN_CLIENT** variable
4. Set value to:
   ```
   https://enablenext-client.vercel.app
   ```
5. Click **Save Changes**
6. Service will auto-restart (~30 seconds)

## Also Set DOMAIN_SERVER

While you're there, also set:

**Variable**: `DOMAIN_SERVER`  
**Value**: `https://enablenext.onrender.com`

This helps with some internal URL generation.

## Push and Test

### 1. Push the Code Fix
```bash
git add api/server/index.js
git commit -m "Fix: Configure CORS for cross-origin authentication"
git push origin main
```

### 2. Wait for Render Redeploy
- Render will auto-redeploy (~8 minutes)
- OR manually trigger deploy in dashboard

### 3. Verify Environment Variables

In Render Dashboard → Environment tab, you should have:

```
DOMAIN_CLIENT = https://enablenext-client.vercel.app
DOMAIN_SERVER = https://enablenext.onrender.com
MONGO_URI = mongodb+srv://...
JWT_SECRET = your_secret
CREDS_KEY = your_key
CREDS_IV = your_iv
```

### 4. Test Login

Go to: https://enablenext-client.vercel.app

1. Click "Register" or "Login"
2. Should **NOT** get 404 errors
3. Should be able to create account
4. Should be able to login
5. Cookies should work ✅

## Check Backend Health

```bash
# Should return OK
curl https://enablenext.onrender.com/api/health

# Should return config JSON (not 404)
curl https://enablenext.onrender.com/api/config

# Test CORS (should include Access-Control-Allow-Origin header)
curl -H "Origin: https://enablenext-client.vercel.app" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://enablenext.onrender.com/api/auth/login -v
```

## About the Service Worker Warning

The `non-precached-url` warning is **not critical**:

```
Uncaught (in promise) non-precached-url: non-precached-url :: [{"url":"index.html"}]
```

This is just the PWA service worker complaining that `index.html` isn't in its precache. The app will still work fine. We can fix this later by updating the PWA config if needed.

## Expected Result

After this fix:
- ✅ No more 404 errors on login
- ✅ Authentication works
- ✅ Cookies set/received correctly
- ✅ Can register and login
- ✅ Full app functionality restored

---

**Push the code, set DOMAIN_CLIENT in Render, and login will work!** 🚀
