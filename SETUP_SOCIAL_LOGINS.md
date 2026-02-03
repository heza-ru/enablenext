# Setup Social Logins (Google, GitHub, etc.)

## Current Issue

When you click **"Sign in with Google"** on the login page, nothing happens because OAuth isn't configured yet on the backend.

## How Social Login Works

1. User clicks "Sign in with Google"
2. Frontend redirects to: `https://enablenext.onrender.com/oauth/google`
3. Backend redirects to Google OAuth
4. User authorizes on Google
5. Google redirects back to: `https://enablenext.onrender.com/oauth/google/callback`
6. Backend creates session and redirects to frontend
7. User is logged in ✅

But steps 3-5 require OAuth credentials that you must set up.

## 🔐 Google OAuth Setup

### Step 1: Create Google OAuth App

1. Go to: https://console.cloud.google.com/apis/credentials
2. Create a new project or select existing
3. Click **"Create Credentials"** → **"OAuth 2.0 Client ID"**
4. Choose **"Web application"**
5. Set **Authorized redirect URIs**:
   ```
   https://enablenext.onrender.com/oauth/google/callback
   ```
6. Click **Create**
7. Copy your **Client ID** and **Client Secret**

### Step 2: Set Environment Variables in Render

Go to Render Dashboard → Your Service → **Environment** tab:

**GOOGLE_CLIENT_ID**
```
123456789-abcdefghijklmnop.apps.googleusercontent.com
```

**GOOGLE_CLIENT_SECRET**
```
GOCSPX-your_secret_here
```

**GOOGLE_CALLBACK_URL**
```
https://enablenext.onrender.com/oauth/google/callback
```

### Step 3: Enable Social Login

Also add/update:

**ALLOW_SOCIAL_LOGIN**
```
true
```

**DOMAIN_SERVER** (should already be set)
```
https://enablenext.onrender.com
```

**DOMAIN_CLIENT** (should already be set)
```
https://enablenext-client.vercel.app
```

### Step 4: Save and Restart

Click **"Save Changes"** in Render - service will restart (~30 seconds).

### Step 5: Test

1. Go to: https://enablenext-client.vercel.app
2. Click **"Sign in with Google"**
3. Should redirect to Google login ✅
4. After authorization, redirects back and logs you in ✅

## 🔐 Other Social Login Providers

### GitHub

**Environment Variables:**
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_CALLBACK_URL=https://enablenext.onrender.com/oauth/github/callback`

**Setup**: https://github.com/settings/applications/new

### Discord

**Environment Variables:**
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_CALLBACK_URL=https://enablenext.onrender.com/oauth/discord/callback`

**Setup**: https://discord.com/developers/applications

### Facebook

**Environment Variables:**
- `FACEBOOK_CLIENT_ID`
- `FACEBOOK_CLIENT_SECRET`
- `FACEBOOK_CALLBACK_URL=https://enablenext.onrender.com/oauth/facebook/callback`

**Setup**: https://developers.facebook.com/apps/

## 📋 Complete Environment Variables Checklist

### Required (Already Set)
- [x] `MONGO_URI` - Database connection
- [x] `JWT_SECRET` - Authentication secret
- [x] `CREDS_KEY` - Encryption key
- [x] `CREDS_IV` - Encryption IV
- [x] `DOMAIN_CLIENT` - Frontend URL
- [x] `DOMAIN_SERVER` - Backend URL
- [x] `NODE_ENV=production`
- [x] `HOST=0.0.0.0`
- [x] `PORT=10000`

### For Social Login
- [ ] `ALLOW_SOCIAL_LOGIN=true`
- [ ] `GOOGLE_CLIENT_ID` (if using Google)
- [ ] `GOOGLE_CLIENT_SECRET` (if using Google)
- [ ] `GOOGLE_CALLBACK_URL` (if using Google)
- [ ] Other providers as needed...

### Optional Email Settings
For email verification and password reset:

- `EMAIL_SERVICE` (e.g., `gmail`, `sendgrid`)
- `EMAIL_HOST` (SMTP host)
- `EMAIL_PORT` (SMTP port)
- `EMAIL_USERNAME` (SMTP username)
- `EMAIL_PASSWORD` (SMTP password)
- `EMAIL_FROM` (sender email address)

## Quick Reference Table

| Provider | Client ID | Client Secret | Callback URL |
|----------|-----------|---------------|--------------|
| Google | `GOOGLE_CLIENT_ID` | `GOOGLE_CLIENT_SECRET` | `/oauth/google/callback` |
| GitHub | `GITHUB_CLIENT_ID` | `GITHUB_CLIENT_SECRET` | `/oauth/github/callback` |
| Discord | `DISCORD_CLIENT_ID` | `DISCORD_CLIENT_SECRET` | `/oauth/discord/callback` |
| Facebook | `FACEBOOK_CLIENT_ID` | `FACEBOOK_CLIENT_SECRET` | `/oauth/facebook/callback` |

All callback URLs should be prefixed with your backend domain:
```
https://enablenext.onrender.com/oauth/{provider}/callback
```

## Current Status

### ✅ Working Now (After Latest Push):
- Email/password registration
- Email/password login
- Register button stays on frontend
- Logo displays correctly

### ⚠️ Pending (Optional Setup):
- Google OAuth (need to add credentials)
- Other social providers (if desired)
- Email verification (need SMTP)
- Password reset (need SMTP)

## Documentation

For Google OAuth detailed setup, see:
- `GOOGLE_AUTH_SETUP.md` in your repo

---

**Social logins are optional!** Email/password auth already works. Set up OAuth providers only if you want them. 🚀
