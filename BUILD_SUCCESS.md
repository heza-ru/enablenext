# Vercel Build Fix

## Problem
The build was failing on Vercel with the error:
```
Failed to resolve entry for package "@librechat/client". 
The package may have incorrect main/module/exports specified in its package.json.
```

## Root Cause
The `@librechat/client` package is a workspace package that needs to be built before the main client application can use it. Vercel was trying to build the client directly without first building the `@librechat/client` package, which meant the `dist` folder with the entry points (`dist/index.js`, `dist/index.es.js`, `dist/types/index.d.ts`) didn't exist.

## Solution

### 1. Updated `package.json` (root)
Added a `build` script at the root level that ensures proper build order:
```json
"build": "npm run build:data-provider && npm run build:client-package && cd client && npm run build"
```

This ensures:
1. `librechat-data-provider` is built first
2. `@librechat/client` package is built (creates the dist folder with entry points)
3. Main client application is built (can now resolve `@librechat/client`)

### 2. Updated `vercel.json`
Changed the build source from `client/package.json` to root `package.json`:
```json
{
  "src": "package.json",
  "use": "@vercel/static-build",
  "config": {
    "distDir": "client/dist"
  }
}
```

This tells Vercel to run the build from the root level, which will execute the proper build sequence.

### 3. Added `postcss.config.js` to `packages/client`
Created a minimal PostCSS configuration for the client package build process.

## Build Order
The correct build sequence is now:
1. Build `packages/data-provider` → creates its dist output
2. Build `packages/client` (@librechat/client) → creates dist/index.js, dist/index.es.js, dist/types/
3. Build main `client` application → can now resolve @librechat/client imports

## Testing
Deploy to Vercel and verify the build completes successfully. The build should now:
- Install all dependencies
- Build data-provider package
- Build @librechat/client package  
- Build main client application
- Output to `client/dist`
