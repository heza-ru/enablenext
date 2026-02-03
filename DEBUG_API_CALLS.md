# Debug: API Calls Going to Vercel Instead of Render

## Quick Checks

### 1. Check Console (MOST IMPORTANT)

Open your Vercel site and check the console:

```javascript
// Open DevTools Console on https://enablenext-client.vercel.app
console.log('VITE_API_URL:', import.meta.env.VITE_API_URL)
console.log('All env vars:', import.meta.env)
```

**Expected:** `VITE_API_URL: "https://enablenext.onrender.com"`
**If undefined:** Environment variable not applied

### 2. Check Network Tab

1. Open DevTools → Network tab
2. Refresh page
3. Look at API calls

**Current (wrong):**
```
https://enablenext-client.vercel.app/api/config ❌
```

**Expected (correct):**
```
https://enablenext.onrender.com/api/config ✅
```

## Root Causes & Solutions

### Cause 1: Environment Variable Not Set in Vercel ⚠️

**Check:**
1. Go to Vercel Dashboard
2. Your project → Settings → Environment Variables
3. Look for `VITE_API_URL`

**If missing, add it:**
- Key: `VITE_API_URL`
- Value: `https://enablenext.onrender.com`
- Environment: **Production** ✅
- Click Save

### Cause 2: Deployment Hasn't Run Since Adding Env Var ⚠️

Environment variables only apply to **NEW** deployments.

**Solution: Force Redeploy**
1. Vercel Dashboard → Deployments
2. Latest deployment → Three dots (⋯) → **Redeploy**
3. **Uncheck "Use existing Build Cache"** ← IMPORTANT
4. Click Redeploy

### Cause 3: Old Build Cache ⚠️

**Solution: Clear Cache**
1. Vercel Dashboard → Settings → General
2. Scroll to "Build & Development Settings"
3. Click **Clear Build Cache**
4. Then redeploy (Cause 2 above)

### Cause 4: Latest Code Not Deployed ⚠️

**Check which commit is deployed:**
1. Vercel Dashboard → Deployments → Latest
2. Check commit hash
3. Compare with: `git log -1 --oneline`

**If different, push latest:**
```bash
git push origin main
```

## Step-by-Step Fix

### Step 1: Verify Vercel Environment Variable

```bash
# Go to Vercel Dashboard
1. Project → Settings → Environment Variables
2. Check if VITE_API_URL exists
3. Value should be: https://enablenext.onrender.com
4. Environment should be: Production
```

### Step 2: Check Build Logs

```bash
# After deployment, check logs
1. Vercel Dashboard → Deployments → Latest
2. Click on deployment
3. View Build Logs
4. Search for "VITE_API_URL"
5. Should see it being used during build
```

### Step 3: Force Fresh Deploy

```bash
# Method 1: Via Dashboard (Recommended)
1. Deployments → Latest → Three dots → Redeploy
2. Uncheck "Use existing Build Cache"
3. Click Redeploy

# Method 2: Via Git
git commit --allow-empty -m "Force Vercel redeploy"
git push origin main
```

### Step 4: Verify After Deploy

```javascript
// On deployed site, open console:
console.log(import.meta.env.VITE_API_URL)
// Should show: https://enablenext.onrender.com
```

## Alternative: Check if .env.production is Being Used

The code has a fallback to `client/.env.production`:

```bash
# Check the file
cat client/.env.production

# Should contain:
VITE_API_URL=https://enablenext.onrender.com
```

If this file exists and is committed to git, it should work even without Vercel env vars.

## Verify the Code Change

Check if the vite.config.ts change was deployed:

```typescript
// Should have this line in client/vite.config.ts
envDir: process.env.VERCEL ? '.' : '../',
```

## Nuclear Option: Complete Reset

If nothing works:

1. **Delete all env vars in Vercel**
2. **Clear build cache**
3. **Add env vars fresh:**
   ```
   VITE_API_URL=https://enablenext.onrender.com
   DOMAIN_CLIENT=https://enablenext-client.vercel.app
   NODE_ENV=production
   ```
4. **Redeploy with no cache**

## Check Deployment Status

```bash
# Verify latest changes are pushed
git status
git log -1 --oneline

# Should show recent commits with fixes
```

## Expected Working State

**Console output:**
```javascript
import.meta.env.VITE_API_URL
// "https://enablenext.onrender.com"
```

**Network tab:**
```
✅ https://enablenext.onrender.com/api/config
✅ https://enablenext.onrender.com/api/banner
✅ https://enablenext.onrender.com/api/auth/refresh
```

**No errors:**
```
✅ No 404 errors
✅ No CORS errors
✅ Can login/register
```

---

## Quick Test After Fix

```bash
# 1. Check env var in console
console.log(import.meta.env.VITE_API_URL)

# 2. Check Network tab
# API calls should go to enablenext.onrender.com

# 3. Test API directly
curl https://enablenext.onrender.com/api/health
# Should return: OK
```

**Most likely issue:** Vercel env var not set or deployment not run after setting it.

**Quick fix:** Add `VITE_API_URL` in Vercel, then redeploy with no cache.
