# Connect Frontend to Backend - Quick Fix

Your backend is running at: **https://enablenext.onrender.com**
Your frontend is at: **https://enablenext-client.vercel.app**

## The Problem

Your frontend is getting 404 errors because it's trying to call `/api/config`, `/api/banner`, etc. on its own domain (Vercel) instead of your backend (Render).

## The Solution

You need to set environment variables so your frontend knows where the backend is.

---

## Step 1: Set Environment Variables in Vercel (5 min)

### Go to Vercel Dashboard

1. Open: https://vercel.com/dashboard
2. Click on your project: **enablenext-client** (or whatever it's called)
3. Go to: **Settings** → **Environment Variables**

### Add These Variables

Click "Add New" and add each of these:

| Key | Value | Environment |
|-----|-------|-------------|
| `VITE_API_URL` | `https://enablenext.onrender.com` | **Production** |
| `DOMAIN_CLIENT` | `https://enablenext-client.vercel.app` | **Production** |
| `NODE_ENV` | `production` | **Production** |

**Important:** Make sure to select **Production** environment for each!

### Save Changes

Click "Save" after adding each variable.

---

## Step 2: Redeploy Frontend on Vercel (2 min)

After adding environment variables, you need to redeploy:

### Option A: Via Dashboard
1. Go to: **Deployments** tab
2. Find the latest deployment
3. Click the three dots (⋯) → **Redeploy**
4. Confirm the redeploy

### Option B: Via Git Push
```bash
# Make a small change or empty commit
git commit --allow-empty -m "Trigger redeploy with env vars"
git push origin main
```

Wait for the deployment to complete (~2-3 minutes).

---

## Step 3: Update Backend Environment Variables (2 min)

### Go to Render Dashboard

1. Open: https://dashboard.render.com
2. Click on your service: **enablenext** (or whatever it's called)
3. Go to: **Environment** tab

### Update These Variables

Find and update these (or add if missing):

| Key | Value |
|-----|-------|
| `DOMAIN_CLIENT` | `https://enablenext-client.vercel.app` |
| `DOMAIN_SERVER` | `https://enablenext.onrender.com` |

### Save Changes

1. Click "Save Changes" (this will trigger a redeploy)
2. Wait for the redeploy to complete (~5 minutes)

---

## Step 4: Test Your Connection (1 min)

### Test Backend Health

Open in browser or run:
```bash
curl https://enablenext.onrender.com/api/health
```

Should return:
```json
{"status":"ok"}
```

### Test Frontend

1. Go to: https://enablenext-client.vercel.app
2. Open DevTools (F12) → **Console** tab
3. Look for errors:
   - ✅ **No 404 errors** = Success!
   - ✅ **API calls go to enablenext.onrender.com** = Success!
   - ❌ **Still 404 errors** = See troubleshooting below

### Test API Call

In DevTools → **Network** tab:
- Look for calls to `enablenext.onrender.com/api/...`
- Should see responses (not 404)

---

## Expected Results

After completing all steps:

✅ **Before:**
```
https://enablenext-client.vercel.app/api/config → 404 ❌
```

✅ **After:**
```
https://enablenext.onrender.com/api/config → 200 ✅
```

---

## Troubleshooting

### Still Getting 404 Errors

**Check 1: Environment Variables Set?**
```bash
# In Vercel dashboard, verify VITE_API_URL is there
# Must be in "Production" environment
```

**Check 2: Frontend Redeployed?**
```bash
# Environment variables only apply to NEW deployments
# Redeploy after adding variables
```

**Check 3: Check Logs**
- Vercel: Dashboard → Deployments → Latest → Build Logs
- Look for: `VITE_API_URL` should be visible during build

### CORS Errors

If you see `Access-Control-Allow-Origin` errors:

**Check backend DOMAIN_CLIENT:**
```bash
# In Render dashboard → Environment
# DOMAIN_CLIENT must exactly match: https://enablenext-client.vercel.app
# No trailing slash!
```

### Backend Not Responding

**Check if backend is running:**
```bash
curl https://enablenext.onrender.com/api/health
```

**Check Render logs:**
- Render Dashboard → Logs
- Look for startup errors

### Service Worker Error (non-precached-url)

This is usually harmless but if it persists:
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R)
3. Check if it still causes issues

---

## Quick Verification Checklist

Before testing, verify:

- [ ] `VITE_API_URL=https://enablenext.onrender.com` set in Vercel
- [ ] `DOMAIN_CLIENT=https://enablenext-client.vercel.app` set in Vercel
- [ ] Frontend redeployed after adding env vars
- [ ] `DOMAIN_CLIENT=https://enablenext-client.vercel.app` set in Render
- [ ] `DOMAIN_SERVER=https://enablenext.onrender.com` set in Render
- [ ] Backend redeployed after updating env vars
- [ ] Backend health check works
- [ ] Frontend loads without 404 errors

---

## Expected Timeline

- Add Vercel env vars: **2 minutes**
- Redeploy frontend: **2-3 minutes**
- Update Render env vars: **1 minute**
- Redeploy backend: **5-8 minutes**
- **Total: ~10-15 minutes**

---

## What Happens Next

After successful connection:

1. ✅ Frontend loads at Vercel URL
2. ✅ API calls go to Render backend
3. ✅ You can register/login
4. ✅ Chat functionality works
5. ✅ No CORS or 404 errors

---

## Need Help?

If something doesn't work:

1. Check the troubleshooting section above
2. Verify all environment variables are set correctly
3. Make sure both services redeployed after changes
4. Check browser console for specific error messages
5. Check Render logs for backend errors

---

**Ready?** Start with Step 1 above! 🚀
