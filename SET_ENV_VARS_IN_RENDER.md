# CRITICAL: Set Environment Variables in Render

## 🚨 You Must Do This Right Now

Your backend needs these environment variables set in Render Dashboard.

## Go to Render Dashboard

1. Open: https://dashboard.render.com
2. Click your service (likely named **enablenext** or **enablenext-backend**)
3. Click the **Environment** tab on the left

## Required Environment Variables

### 1. DOMAIN_CLIENT (Most Important!)
**Variable**: `DOMAIN_CLIENT`  
**Value**: `https://enablenext-client.vercel.app`

This tells the backend which domain to accept CORS requests from.

### 2. DOMAIN_SERVER
**Variable**: `DOMAIN_SERVER`  
**Value**: `https://enablenext.onrender.com`

Your backend's own URL.

### 3. Security Keys (Critical for Production!)

You're currently using default values which is insecure. Generate new ones:

Go to: https://www.librechat.ai/toolkit/creds_generator

This will generate:
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `CREDS_KEY`
- `CREDS_IV`

Copy each one into Render:

**Variable**: `JWT_SECRET`  
**Value**: (paste generated value)

**Variable**: `JWT_REFRESH_SECRET`  
**Value**: (paste generated value)

**Variable**: `CREDS_KEY`  
**Value**: (paste generated value)

**Variable**: `CREDS_IV`  
**Value**: (paste generated value)

### 4. Database (If Not Set)

**Variable**: `MONGO_URI`  
**Value**: Your MongoDB connection string

Example:
```
mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority
```

## How to Add/Edit Variables in Render

1. In Environment tab, you'll see a list of existing variables
2. To **edit** existing variable:
   - Click the pencil icon next to it
   - Update the value
   - Click checkmark to save
3. To **add** new variable:
   - Click **Add Environment Variable** button
   - Enter Key (e.g., `DOMAIN_CLIENT`)
   - Enter Value (e.g., `https://enablenext-client.vercel.app`)
   - Click **Save**

## After Adding Variables

1. Click **Save Changes** button at the top
2. Render will automatically restart your service (~30 seconds)
3. No need to redeploy, just restart!

## Verify Variables Are Set

After restart, check the logs:

```
✅ Should NOT see: "Default value for CREDS_KEY is being used"
✅ Should NOT see: "Default value for JWT_REFRESH_SECRET is being used"
✅ Should see: "Server listening on all interfaces at port 10000"
✅ Should see: "Connected to MongoDB"
```

## Quick Checklist

- [ ] Set `DOMAIN_CLIENT` to `https://enablenext-client.vercel.app`
- [ ] Set `DOMAIN_SERVER` to `https://enablenext.onrender.com`
- [ ] Set `MONGO_URI` (if not already set)
- [ ] Generate and set `JWT_SECRET`
- [ ] Generate and set `JWT_REFRESH_SECRET`
- [ ] Generate and set `CREDS_KEY`
- [ ] Generate and set `CREDS_IV`
- [ ] Click Save Changes
- [ ] Wait for restart (~30 seconds)

## Test After Restart

1. Go to: https://enablenext-client.vercel.app
2. Try to login/register
3. Should work without 404 errors! ✅

## Timeline

- Set variables: 3 minutes
- Generate security keys: 1 minute
- Restart: 30 seconds
- **Total: 5 minutes**

---

**Do this FIRST before pushing the CORS fix!** This is the most critical step. 🎯
