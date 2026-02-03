# Vercel Minimal Config - Force Clean Deploy

## The Problem

All fixes have been pushed but Vercel is STILL returning 404s:
```
register:1 GET .../register 404 (Not Found)
login:1 GET .../login 404 (Not Found)
```

This means:
1. Either the build is failing
2. Or Vercel is using cached old build
3. Or the config needs to be simpler

## The Nuclear Option

I've stripped `vercel.json` down to **absolute minimum**:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**Removed:**
- `version: 2` (not needed, Vercel defaults to 2)
- `builds` (not needed for static sites)
- `headers` (causing potential conflicts)

This is the **simplest possible SPA configuration**.

## Critical: You MUST Do This in Vercel Dashboard

### Step 1: Clear Build Cache

1. Go to: https://vercel.com/dashboard
2. Click your project
3. **Settings** → **General**
4. Scroll to **Build & Development Settings**
5. Click **Clear Build Cache** button

### Step 2: Check Build Command

Make sure these are set:

**Framework Preset**: `Other`

**Build Command**:
```
npm run build
```

**Output Directory**:
```
client/dist
```

**Install Command**:
```
npm install
```

### Step 3: Force Redeploy

1. Go to **Deployments** tab
2. Click **⋯** on latest deployment
3. Click **Redeploy**
4. Check **Clear Build Cache** checkbox ✅
5. Click **Redeploy**

## Alternative: Check Build Logs

The build might be failing. Check:

1. Vercel Dashboard → Deployments
2. Click on latest deployment
3. Look at **Build Logs** tab
4. Look for errors

**Common errors:**
- Locize sync failing (we disabled it, but check)
- npm install errors
- Workspace build errors

## If Build is Failing

### Check for Locize Error

If you see:
```
error: missing required argument `projectId`
```

The Locize workflow is STILL running. Check:
- GitHub Actions tab
- Make sure the workflow is disabled

### If npm install fails

Check if workspace packages are building:
```
Building packages/data-provider... ✅
Building packages/client... ✅
Building client... ✅
```

## After Redeploying

### Test URLs:

1. **https://enablenext-client.vercel.app**
   - Should load ✅

2. **https://enablenext-client.vercel.app/login**
   - Should return 200 OK (view network tab)
   - Should show login page ✅

3. **https://enablenext-client.vercel.app/register**
   - Should return 200 OK
   - Should show register page ✅

### Check with curl:

```bash
curl -I https://enablenext-client.vercel.app/register
```

Should return:
```
HTTP/2 200
content-type: text/html
```

NOT:
```
HTTP/2 404
```

## If STILL 404 After All This

Then the issue is MORE fundamental. Possibilities:

### 1. Wrong Output Directory

Vercel might not be finding `client/dist`. Check build logs for:
```
Error: Could not find client/dist
```

Fix: Change Output Directory to just `dist` and update vercel.json:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

### 2. index.html Not in Output

Check if `client/dist/index.html` exists after build.

### 3. Vercel Framework Detection Issue

Vercel might be auto-detecting framework incorrectly.

Fix:
1. Settings → Framework Preset
2. Change to **"Other"**
3. Manually set build command: `npm run build`
4. Manually set output: `client/dist`

## Push This Minimal Config

```bash
git add vercel.json VERCEL_MINIMAL_CONFIG.md
git commit -m "Fix: Simplify Vercel config to absolute minimum"
git push origin main
```

Then:
1. **Clear build cache** in Vercel
2. **Redeploy** with cache cleared
3. **Check build logs**

If this doesn't work, we need to check the actual build output and logs.

---

**This is the nuclear option - simplest possible config!** 🚀
