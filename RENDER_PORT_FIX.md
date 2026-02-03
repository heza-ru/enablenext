# Render Port Binding Fix

## Issue

Render was timing out with:
```
==> No open ports detected on 0.0.0.0
==> Port scan timeout reached
```

The server was binding to `localhost:10000` instead of `0.0.0.0:10000`.

## Fix Applied

Updated `api/server/index.js` to automatically detect cloud deployments and bind to `0.0.0.0`.

**Before:**
```javascript
const host = HOST || 'localhost';
```

**After:**
```javascript
const host = HOST || process.env.RENDER || process.env.RAILWAY_ENVIRONMENT ? '0.0.0.0' : 'localhost';
```

Now it automatically uses `0.0.0.0` when deployed on Render.

## Verify in Render Dashboard

Also make sure `HOST=0.0.0.0` is set in Render:

1. Go to Render Dashboard → Your Service
2. Environment tab
3. Check if `HOST=0.0.0.0` exists
4. If not, add it and redeploy

## Push the Fix

```bash
git add .
git commit -m "Fix server port binding for Render deployment"
git push origin main
```

This will trigger a redeploy on Render.

## Expected Result

After deployment, Render logs should show:
```
✅ Server listening on all interfaces at port 10000
✅ (No timeout errors)
```
