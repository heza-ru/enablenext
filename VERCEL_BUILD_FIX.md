# Vercel Build Fix - Workspace Commands Issue

## Problem

Vercel build was failing with:
```
npm error command sh -c npm --prefix .. run build:data-provider
npm error Lifecycle script `build:packages` failed
```

The `npm --prefix ..` commands weren't working properly on Vercel's build environment.

## Fix Applied

Changed `client/package.json` prebuild script from workspace commands to simple `cd` commands:

**Before (failed on Vercel):**
```json
"build:packages": "npm --prefix .. run build:data-provider && npm --prefix .. run build:client-package"
```

**After (works on Vercel):**
```json
"build:packages": "cd ../packages/data-provider && npm run build && cd ../client && npm run build"
```

## Why This Works

- `cd` commands are more reliable across different environments
- Directly runs build in each package directory
- Doesn't rely on workspace command resolution
- Works the same locally and on Vercel

## Deploy the Fix

```bash
git add client/package.json
git commit -m "Fix Vercel build - use cd instead of workspace commands"
git push origin main
```

## What Gets Built

The prebuild script now:

1. **Changes to `packages/data-provider`** → Runs `npm run build`
   - Builds librechat-data-provider
   - Creates `dist/` folder

2. **Changes to `packages/client`** → Runs `npm run build`
   - Builds @librechat/client package
   - Creates `dist/` folder with entry points

3. **Main build runs** → `vite build`
   - Can now resolve both packages
   - Builds the frontend successfully

## Expected Build Log

After fix, Vercel build should show:
```
✅ Running prebuild...
✅ Building data-provider...
✅ Building @librechat/client...
✅ Building client with vite...
✅ Build completed successfully
```

## If Still Failing

### Check Build Logs
Look for:
- Which package is failing to build?
- Are all dependencies installed?
- Is there a TypeScript or Rollup error?

### Common Issues

**Missing dependencies:**
```bash
# Make sure all workspace dependencies are in package.json
```

**TypeScript errors:**
```bash
# Check if build:packages builds locally
cd packages/data-provider && npm run build
cd ../client && npm run build
```

**Rollup errors:**
- Check rollup.config.js in failing package
- Verify all imports can be resolved

## Verify Locally

Test the exact build sequence locally:

```bash
# From client directory
npm run build:packages

# Should build both packages without errors
# Then run main build
npm run build
```

If this works locally, it should work on Vercel.

---

**Push the fix and trigger a new deployment!** 🚀
