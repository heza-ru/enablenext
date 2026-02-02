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

### 1. Added `prebuild` Script to `client/package.json`
Added prebuild scripts that automatically run before the client build:
```json
"scripts": {
  "prebuild": "npm run build:deps",
  "prebuild:ci": "npm run build:deps",
  "build:deps": "cd ../packages/data-provider && npm run build && cd ../packages/client && npm run build",
  "build": "cross-env NODE_ENV=production vite build && node ./scripts/post-build.cjs",
  "build:ci": "cross-env NODE_ENV=development vite build --mode ci"
}
```

The `prebuild` script automatically runs before `build` and ensures:
1. `packages/data-provider` is built first
2. `packages/client` (@librechat/client) is built (creates the dist folder with entry points)
3. Then the main client build can proceed and successfully resolve `@librechat/client`

### 2. Updated `package.json` (root)
Added a `build` script at the root level for convenience:
```json
"build": "npm run build:data-provider && npm run build:client-package && cd client && npm run build"
```

### 3. Updated `vercel.json`
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

### 4. Added `postcss.config.js` to `packages/client`
Created a minimal PostCSS configuration for the @librechat/client package build process.

## Build Order
The correct build sequence is now:
1. Build `packages/data-provider` → creates its dist output
2. Build `packages/client` (@librechat/client) → creates dist/index.js, dist/index.es.js, dist/types/
3. Build main `client` application → can now resolve @librechat/client imports

## How It Works
When Vercel runs the build:
1. Runs `npm run build` from root (per vercel.json)
2. This eventually calls the client's build script
3. **Before** the client build runs, `prebuild` automatically executes
4. `prebuild` builds the data-provider and @librechat/client packages
5. Now the @librechat/client package has its dist folder populated
6. The main client build can successfully resolve and import from @librechat/client

## Testing
Deploy to Vercel and verify the build completes successfully. The build should now:
- Install all dependencies
- Run prebuild to create package dependencies
- Build @librechat/client package with dist folder
- Build main client application
- Output to `client/dist`
