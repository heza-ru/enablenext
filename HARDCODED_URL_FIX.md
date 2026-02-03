# Hardcoded Backend URL Fix

## The Problem

Environment variables weren't working because:
1. `data-provider` package is pre-built during postinstall
2. At build time, `import.meta.env` doesn't exist yet
3. The built package had `BASE_URL = '/'` hardcoded
4. Main app used the pre-built package with wrong URL

## The Solution

**Hardcode the production backend URL** in the data-provider package.

## What Changed

### `packages/data-provider/src/api-endpoints.ts`

```typescript
// Production backend URL
const PRODUCTION_BACKEND_URL = 'https://enablenext.onrender.com';

// Auto-detect if running on Vercel
const isProduction = typeof window !== 'undefined' && 
  (window.location.hostname.includes('vercel.app') || 
   window.location.hostname.includes('enablenext-client'));

if (isProduction) {
  BASE_URL = PRODUCTION_BACKEND_URL;  // Use Render backend
} else {
  BASE_URL = baseEl?.getAttribute('href') || '/';  // Local development
}
```

## How It Works

**On Vercel Production:**
- Detects `vercel.app` or `enablenext-client` in hostname
- Uses hardcoded Render URL: `https://enablenext.onrender.com`
- All API calls go to Render ✅

**On Local Development:**
- Detects localhost
- Uses relative URLs: `/api/...`
- Vite proxy forwards to local backend ✅

## Pros of This Approach

✅ **Simple** - No environment variable complexity
✅ **Reliable** - Always works
✅ **Fast** - No runtime checks needed
✅ **Works immediately** - No deployment issues

## Cons

⚠️ **Hardcoded** - Need to update code if backend URL changes
⚠️ **Not configurable** - Can't change via env vars

## If You Change Backend URL

If you change your Render backend URL or domain, update this line:

```typescript
const PRODUCTION_BACKEND_URL = 'https://your-new-backend-url.com';
```

Then rebuild and redeploy.

## Push the Fix

```bash
git add packages/data-provider/src/api-endpoints.ts
git commit -m "Fix: Hardcode production backend URL for reliable deployment"
git push origin main
```

## Expected Results

After deployment:

**Network Tab:**
```
✅ https://enablenext.onrender.com/api/config
✅ https://enablenext.onrender.com/api/banner
✅ https://enablenext.onrender.com/api/auth/refresh
```

**No more:**
```
❌ https://enablenext-client.vercel.app/api/config
```

## Verify After Deploy

1. **Check Network tab:**
   - API calls go to `enablenext.onrender.com` ✅

2. **Test backend:**
   ```bash
   curl https://enablenext.onrender.com/api/health
   # Should return: OK
   ```

3. **Test login:**
   - Should work without 404 errors ✅

---

**This is the simplest, most reliable solution!** Push and deploy. 🚀
