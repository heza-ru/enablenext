# Force Vercel to Deploy Latest Commits

## If Vercel Isn't Picking Up Commits

### Option 1: Manual Redeploy (Fastest)

1. Go to https://vercel.com/dashboard
2. Click your project
3. Go to **Deployments** tab
4. Find the latest deployment
5. Click three dots (⋯) → **Redeploy**
6. **Important:** Uncheck "Use existing Build Cache"
7. Click "Redeploy"

### Option 2: Via Vercel CLI

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Login
vercel login

# Deploy to production
vercel --prod
```

### Option 3: Trigger via Git

```bash
# Make sure latest commits are pushed
git log -1 --oneline

# If not pushed, push now
git push origin main

# Force trigger by making empty commit
git commit --allow-empty -m "Force Vercel redeploy"
git push origin main
```

### Option 4: Check Vercel Git Integration

1. Go to Vercel Dashboard → Your Project
2. Click **Settings** → **Git**
3. Verify:
   - ✅ Git repository is connected
   - ✅ Production branch is correct (usually `main`)
   - ✅ "Automatic Deployments" is ON
4. If anything is wrong, reconnect the repository

### Option 5: Clear Deployment Cache

1. Vercel Dashboard → Settings
2. Scroll to "Build & Development Settings"
3. Click **Clear Build Cache**
4. Trigger a new deployment (Option 1 or 3)

## Verify Deployment

After deploying:

1. **Check deployment status:**
   - Vercel Dashboard → Deployments
   - Should show new deployment with latest commit hash

2. **Check build logs:**
   - Click on the deployment
   - Check if `VITE_API_URL` appears in logs
   - Should see: `VITE_API_URL=https://enablenext.onrender.com`

3. **Test in browser:**
   ```javascript
   // Open your Vercel site
   // DevTools Console:
   console.log(import.meta.env.VITE_API_URL)
   // Should return: "https://enablenext.onrender.com"
   ```

## Common Issues

### "No new commits to deploy"
- Vercel may think it's already deployed the latest
- Use Option 1 (Manual Redeploy) and uncheck cache

### Branch mismatch
- Check if you pushed to correct branch
- Verify production branch in Vercel settings

### Environment variables not applied
- Variables only apply to NEW deployments
- Must redeploy after adding/changing variables

## Quick Fix Command

```bash
# All-in-one: ensure pushed, force redeploy
git push origin main && git commit --allow-empty -m "Trigger deploy" && git push origin main
```

---

**After fixing:** Your Vercel deployment should pick up the latest commits with the environment variable fix!
