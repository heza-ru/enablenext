# Vercel Environment Variables Setup

## ✅ Issue Fixed

**Problem:** `MONGO_URI` referenced secret `@mongo_uri` which doesn't exist

**Solution:** Removed all env references from `vercel.json`. You'll set them directly in Vercel dashboard instead.

---

## 🔧 How to Set Environment Variables in Vercel

### **Step 1: Go to Your Project Settings**

1. Open your project in Vercel dashboard
2. Click **Settings** tab
3. Click **Environment Variables** in the sidebar

### **Step 2: Add Each Variable**

Click **Add New** and enter these one by one:

---

## 📋 Required Environment Variables

### **1. MongoDB Connection**
```
Key:   MONGO_URI
Value: mongodb+srv://username:password@cluster.mongodb.net/enablenext?retryWrites=true&w=majority
```
**Where to get:** Your MongoDB Atlas dashboard → Connect → Connect your application

---

### **2. JWT Secrets**

Generate random strings for these:

```bash
# In terminal, run:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```
Key:   JWT_SECRET
Value: [paste generated string]

Key:   JWT_REFRESH_SECRET
Value: [paste another generated string]
```

---

### **3. Encryption Keys**

```bash
# Generate CREDS_KEY (32 characters):
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# Generate CREDS_IV (16 characters):
node -e "console.log(require('crypto').randomBytes(8).toString('hex'))"
```

```
Key:   CREDS_KEY
Value: [paste 32-char string]

Key:   CREDS_IV
Value: [paste 16-char string]
```

---

### **4. Domain Settings**

After your first deployment, Vercel will give you a URL like `https://your-app.vercel.app`

```
Key:   DOMAIN_CLIENT
Value: https://your-app.vercel.app

Key:   DOMAIN_SERVER
Value: https://your-app.vercel.app
```

**Important:** Update these after first deployment!

---

### **5. Google OAuth (Optional)**

If you want Google login:

```
Key:   GOOGLE_CLIENT_ID
Value: [your Google OAuth client ID]

Key:   GOOGLE_CLIENT_SECRET
Value: [your Google OAuth client secret]

Key:   GOOGLE_CALLBACK_URL
Value: https://your-app.vercel.app/oauth/google/callback

Key:   ALLOW_SOCIAL_LOGIN
Value: true

Key:   ALLOW_SOCIAL_REGISTRATION
Value: true
```

**Where to get:** [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials

---

### **6. Web Search (Free - No API Key!)**

```
Key:   SEARCH
Value: true

Key:   SEARXNG_INSTANCE_URL
Value: https://searx.be
```

---

### **7. Session Settings**

```
Key:   SESSION_EXPIRY
Value: 900000

Key:   REFRESH_TOKEN_EXPIRY
Value: 604800000
```

---

### **8. Claude API (Optional)**

If you want to provide a default organization key:

```
Key:   ANTHROPIC_API_KEY
Value: sk-ant-api03-xxxxx
```

Or leave it out and let users provide their own during onboarding.

---

## 🎯 Quick Setup Checklist

For **minimal working deployment**, you only need:

- [x] `MONGO_URI` - Your MongoDB connection string
- [x] `JWT_SECRET` - Random 32-char string
- [x] `JWT_REFRESH_SECRET` - Random 32-char string  
- [x] `CREDS_KEY` - Random 32-char string
- [x] `CREDS_IV` - Random 16-char string
- [x] `DOMAIN_CLIENT` - Your Vercel URL (set after first deploy)
- [x] `DOMAIN_SERVER` - Your Vercel URL (set after first deploy)

---

## 📝 Environment Selection

**Important:** For each variable, select which environments to apply to:

- ✅ **Production** - Always check this
- ✅ **Preview** - Check for testing PRs
- ✅ **Development** - Check if you'll use `vercel dev`

---

## 🚀 Deployment Steps

### **Step 1: Set Required Variables**

Add at minimum:
- MONGO_URI
- JWT_SECRET
- JWT_REFRESH_SECRET
- CREDS_KEY
- CREDS_IV

### **Step 2: First Deploy**

```bash
vercel --prod
```

You'll get a URL like: `https://your-app-xyz.vercel.app`

### **Step 3: Update Domain Variables**

Go back to Environment Variables and set:
- `DOMAIN_CLIENT` = your Vercel URL
- `DOMAIN_SERVER` = your Vercel URL

### **Step 4: Redeploy**

```bash
vercel --prod
```

---

## 🐛 Common Issues

### **Issue: White screen after deployment**

**Cause:** Missing environment variables

**Fix:** 
1. Check Vercel logs: `vercel logs`
2. Ensure all required variables are set
3. Redeploy

---

### **Issue: "Failed to connect to MongoDB"**

**Cause:** Wrong `MONGO_URI` or IP not whitelisted

**Fix:**
1. Check MongoDB Atlas → Network Access
2. Add `0.0.0.0/0` to allow all IPs (Vercel uses dynamic IPs)
3. Verify connection string is correct

---

### **Issue: "JWT secret not defined"**

**Cause:** Missing JWT secrets

**Fix:** 
1. Generate secrets using the commands above
2. Add `JWT_SECRET` and `JWT_REFRESH_SECRET` in Vercel
3. Redeploy

---

### **Issue: Google login doesn't appear**

**Cause:** Missing Google OAuth variables

**Fix:**
1. Set up Google OAuth credentials
2. Add all Google-related env variables
3. Ensure `ALLOW_SOCIAL_LOGIN=true`
4. Redeploy

---

## 💡 Pro Tips

### **1. Use Vercel CLI for Easy Setup**

```bash
# Set variables from terminal:
vercel env add MONGO_URI production
vercel env add JWT_SECRET production
# ... etc
```

### **2. Pull Variables for Local Development**

```bash
vercel env pull .env.local
```

This creates a local `.env.local` file with all your Vercel variables!

### **3. Check Current Variables**

```bash
vercel env ls
```

---

## ⚠️ Security Best Practices

1. **Never commit secrets to Git**
   - `.env` is in `.gitignore` ✅
   - Double-check before pushing

2. **Use strong random strings**
   - Always generate, never type manually
   - Use the crypto commands provided

3. **Rotate secrets periodically**
   - Change JWT secrets every few months
   - Update in Vercel dashboard

4. **Limit MongoDB access**
   - Use specific IP ranges if possible
   - Create separate DB user for production

---

## 📚 Next Steps

1. ✅ Fixed `vercel.json` (no secret references)
2. 🔧 Add environment variables in Vercel dashboard
3. 🚀 Deploy: `vercel --prod`
4. 🔄 Update `DOMAIN_CLIENT` and `DOMAIN_SERVER` with your URL
5. 🚀 Redeploy: `vercel --prod`

---

**Your `vercel.json` is now clean and ready!** Just add the environment variables in the Vercel dashboard and deploy. 🎉
