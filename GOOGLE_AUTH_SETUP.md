# Google OAuth Authentication Setup Guide

This guide will help you enable Google OAuth authentication for your Enable application.

## Overview

Enable comes with **built-in Google OAuth support**. When configured, users will see a "Continue with Google" button on the login and registration pages, allowing them to sign in with their Google account.

## Features

- ✅ One-click Google sign-in
- ✅ Automatic account creation on first login
- ✅ Profile information synced from Google (name, email, avatar)
- ✅ Secure OAuth 2.0 flow
- ✅ Works alongside email/password authentication

---

## Setup Instructions

### Step 1: Create Google Cloud Project

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/

2. **Create a new project** (or select an existing one)
   - Click the project dropdown at the top
   - Click "New Project"
   - Enter a project name (e.g., "Enable")
   - Click "Create"

### Step 2: Enable Google+ API

1. **Go to APIs & Services**
   - In the left sidebar, click "APIs & Services" → "Library"

2. **Enable Google+ API**
   - Search for "Google+ API"
   - Click on it and press "Enable"

### Step 3: Create OAuth Credentials

1. **Go to Credentials**
   - In the left sidebar, click "APIs & Services" → "Credentials"

2. **Configure OAuth Consent Screen**
   - Click "Configure Consent Screen"
   - Choose "External" (unless you're using Google Workspace)
   - Fill in required fields:
     - **App name**: Your application name (e.g., "Enable Chat")
     - **User support email**: Your email
     - **Developer contact information**: Your email
   - Click "Save and Continue"
   - **Scopes**: Add these scopes:
     - `openid`
     - `profile`
     - `email`
   - Click "Save and Continue"
   - **Test users** (for development): Add your test user emails
   - Click "Save and Continue"

3. **Create OAuth Client ID**
   - Click "Create Credentials" → "OAuth client ID"
   - Choose "Web application"
   - **Name**: "Enable Web Client"
   - **Authorized JavaScript origins**: Add your domain
     - Development: `http://localhost:3080`
     - Production: `https://yourdomain.com`
   - **Authorized redirect URIs**: Add the callback URL
     - Development: `http://localhost:3080/oauth/google/callback`
     - Production: `https://yourdomain.com/oauth/google/callback`
   - Click "Create"

4. **Copy Credentials**
   - A dialog will appear with your:
     - **Client ID** (looks like: `123456789-abc123.apps.googleusercontent.com`)
     - **Client Secret** (looks like: `GOCSPX-abc123...`)
   - **Keep these safe!**

### Step 4: Configure Environment Variables

1. **Open your `.env` file** in the project root

2. **Add Google OAuth credentials**:
   ```env
   # Google OAuth
   GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret-here
   GOOGLE_CALLBACK_URL=/oauth/google/callback
   ```

3. **Replace the placeholder values** with your actual credentials from Step 3

### Step 5: Restart the Application

1. **Stop the backend** (if running):
   ```bash
   # Press Ctrl+C in the terminal where the backend is running
   ```

2. **Restart the backend**:
   ```bash
   npm run backend:dev
   ```

3. **The frontend should automatically detect the configuration**

---

## Testing Google Authentication

1. **Open your browser** and navigate to:
   - Development: `http://localhost:3093` (or your frontend port)
   - Production: `https://yourdomain.com`

2. **You should see** the "Continue with Google" button on the login page

3. **Click the Google button** to test:
   - You'll be redirected to Google's login page
   - Sign in with your Google account
   - Grant permissions to the app
   - You'll be redirected back to Enable, logged in!

---

## Important Security Notes

### Production Deployment

For production deployments:

1. **Use HTTPS only** - OAuth requires secure connections
2. **Update redirect URIs** in Google Cloud Console to match your production domain
3. **Keep credentials secret** - Never commit `.env` to version control
4. **Use environment variables** on your hosting platform (Vercel, Netlify, etc.)

### Environment Variables for Production

When deploying to Vercel/Netlify/other platforms:

1. **Add these environment variables** in your platform's dashboard:
   ```
   GOOGLE_CLIENT_ID=your-production-client-id
   GOOGLE_CLIENT_SECRET=your-production-client-secret
   GOOGLE_CALLBACK_URL=/oauth/google/callback
   DOMAIN_CLIENT=https://yourdomain.com
   DOMAIN_SERVER=https://yourdomain.com
   ```

2. **Update Google Cloud Console**:
   - Add your production domain to "Authorized JavaScript origins"
   - Add your production callback URL to "Authorized redirect URIs"

---

## Troubleshooting

### "Continue with Google" button not showing

**Check:**
- ✅ `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in `.env`
- ✅ Backend server restarted after adding credentials
- ✅ No console errors in browser (F12 → Console)

### "Error 400: redirect_uri_mismatch"

**Fix:**
- The redirect URI in your `.env` doesn't match Google Cloud Console
- Go to Google Cloud Console → Credentials
- Edit your OAuth client
- Add the exact redirect URI: `http://localhost:3080/oauth/google/callback`
- Make sure there are no trailing slashes or typos

### "Error 401: invalid_client"

**Fix:**
- Your `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` is incorrect
- Double-check the credentials in `.env`
- Regenerate credentials in Google Cloud Console if needed

### OAuth works locally but not in production

**Check:**
- ✅ Production redirect URI added to Google Cloud Console
- ✅ Using HTTPS (not HTTP) in production
- ✅ `DOMAIN_CLIENT` and `DOMAIN_SERVER` are set correctly in production env vars
- ✅ OAuth consent screen is published (not in testing mode)

### Users can't sign in (Authorization Error)

**Fix:**
- If your OAuth consent screen is in "Testing" mode, only test users can sign in
- Go to Google Cloud Console → OAuth consent screen
- Click "Publish App" to allow anyone to sign in
- Or add specific users to the test users list

---

## Additional OAuth Providers

Enable also supports these OAuth providers:

- **GitHub**: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- **Facebook**: `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`
- **Discord**: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`
- **Apple**: `APPLE_CLIENT_ID`, `APPLE_PRIVATE_KEY_PATH`
- **OpenID Connect**: Various `OPENID_*` variables
- **SAML**: Various `SAML_*` variables

See `.env.example` for all available OAuth options!

---

## Next Steps

1. ✅ **Test the Whatfix onboarding flow** with Google OAuth:
   - Register with Google
   - The onboarding modal should appear automatically
   - Complete the onboarding as a Solutions Consultant or Sales Engineer

2. ✅ **Combine with API keys**:
   - After logging in with Google, add your Claude API key in Settings
   - The AI responses will be tailored based on your onboarding preferences

3. ✅ **Deploy to production** following the security notes above

---

## Support

- **Enable Documentation**: https://www.Enable.ai/docs
- **Google OAuth Guide**: https://developers.google.com/identity/protocols/oauth2
- **This Project's Documentation**: See `WHATFIX_IMPLEMENTATION.md` for Whatfix-specific features

---

**Your Google OAuth setup is complete!** 🎉

Users can now sign in with their Google accounts, and the onboarding flow will guide them through setting up their Whatfix context preferences.
