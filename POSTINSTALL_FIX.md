# Postinstall Fix for @librechat/client

## The Problem

Vite was trying to resolve `@librechat/client` before it was built, causing:
```
Failed to resolve entry for package "@librechat/client"
```

Even though we had build scripts, the packages weren't being built in time.

## The Solution

Use `postinstall` hook to automatically build packages right after npm install.

## Changes Made

### Updated `package.json`

```json
{
  "scripts": {
    "postinstall": "npm run build:packages",
    "build": "npm run build:client",
    "vercel-build": "npm run build:client"
  }
}
```

## How It Works

**Vercel build sequence:**

```
1. npm install
   → Installs all dependencies
   → Runs postinstall automatically
   
2. postinstall runs: npm run build:packages
   → Builds packages/data-provider
   → Builds packages/client (@librechat/client)
   → Creates all dist/ folders and entry points
   
3. npm run build (or vercel-build)
   → Just builds the client
   → @librechat/client is already built and available
   → Success!
```

## Why This Works

- `postinstall` runs **automatically** after every `npm install`
- Packages are built **before** the main build command runs
- Vite can resolve `@librechat/client` because dist/ exists
- Works on **any** environment (local, Vercel, CI)

## Push the Fix

```bash
git add package.json
git commit -m "Fix: Add postinstall hook to build packages before main build"
git push origin main
```

## Expected Vercel Build Log

```
✅ Installing dependencies...
✅ Running postinstall...
✅ Building packages/data-provider...
✅ Building @librechat/client...
✅ Postinstall complete
✅ Running build command...
✅ Building client with vite...
✅ Build successful!
```

## Benefits

1. **Automatic** - No manual steps needed
2. **Reliable** - Packages always built before use
3. **Simple** - One hook handles everything
4. **Universal** - Works everywhere npm install runs

## Local Development

The postinstall will also run locally, which is fine:
- First time: Builds packages
- After that: Only rebuilds if packages change
- Can still use `npm run dev` normally

---

**This should be the final, working solution!** 🎉
