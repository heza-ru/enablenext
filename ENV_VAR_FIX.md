# Environment Variable Fix for Vercel

## The Problem

Your `VITE_API_URL` environment variable wasn't being picked up because of a Vite configuration issue.

## What I Fixed

### 1. Updated `client/vite.config.ts`

**Changed this:**
```typescript
envDir: '../',
```

**To this:**
```typescript
envDir: process.env.VERCEL ? '.' : '../',
```

**Why?** 
- Locally, it looks in parent directory for `.env` files (works with your monorepo)
- On Vercel, it looks in current directory where Vercel injects environment variables
- This allows both local and Vercel builds to work correctly

### 2. Created `client/.env.production`

Added a production env file with your Render backend URL as a fallback. This helps with local production builds.

## What You Need to Do Now

### Step 1: Push the Changes

```bash
git add .
git commit -m "Fix Vite env variable loading for Vercel"
git push origin main
```

This will trigger a new Vercel deployment with the fix.

### Step 2: Verify Environment Variables in Vercel

Make sure these are still set in Vercel Dashboard → Environment Variables → **Production**:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://enablenext.onrender.com` |
| `DOMAIN_CLIENT` | `https://enablenext-client.vercel.app` |
| `NODE_ENV` | `production` |

### Step 3: Wait for Build

The new deployment will take 2-3 minutes. Watch the build logs.

### Step 4: Check Build Logs

After deployment:
1. Go to Vercel → Deployments → Latest
2. Click on it → Build Logs
3. Search for `VITE_API_URL`
4. You should now see it being used!

### Step 5: Test in Browser

1. Go to your Vercel site: https://enablenext-client.vercel.app
2. Open DevTools Console
3. Type: `console.log(import.meta.env.VITE_API_URL)`
4. Should return: `https://enablenext.onrender.com` ✅

### Step 6: Check Network Calls

1. Open DevTools → Network tab
2. Refresh the page
3. Look for API calls
4. They should now go to: `enablenext.onrender.com/api/...` ✅

## Why This Happened

Vite's `envDir` setting was looking for environment variables in the parent directory (`../`). This works locally because your `.env` files are in the root, but on Vercel:

- Vercel injects environment variables into the build environment
- They're available in the current directory context
- The parent directory lookup was missing them

## Testing Locally

If you want to test production build locally:

```bash
# From client directory
npm run build
npm run preview-prod
```

It will use the values from `client/.env.production`.

## If It Still Doesn't Work

### Clear Everything and Try Again:

1. **In Vercel Dashboard:**
   - Delete all environment variables
   - Save
   - Add them back fresh
   - Make sure environment is **Production**

2. **Clear Build Cache:**
   - Vercel → Settings → General
   - Find "Build Cache"
   - Click "Clear Build Cache"

3. **Force Fresh Deploy:**
   ```bash
   git commit --allow-empty -m "Force fresh Vercel build"
   git push origin main
   ```

### Check for Typos:

Double-check the variable name is EXACTLY:
```
VITE_API_URL
```

Not:
- `VITE_API_URL ` (extra space)
- `VITE_API_URl` (lowercase L)
- `REACT_APP_API_URL` (wrong prefix)

## Expected Results

**Before Fix:**
```
API calls → https://enablenext-client.vercel.app/api/config → 404 ❌
```

**After Fix:**
```
API calls → https://enablenext.onrender.com/api/config → 200 ✅
```

## Timeline

- Push changes: **1 minute**
- Vercel build: **2-3 minutes**
- Test: **1 minute**
- **Total: ~5 minutes**

---

**Push the changes now and watch the build!** 🚀
