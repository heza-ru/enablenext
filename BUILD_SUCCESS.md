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

### 1. Updated Root `package.json` Build Scripts
Updated the build scripts to use npm workspace commands for reliable monorepo builds:

```json
"scripts": {
  "build": "npm run build:data-provider && npm run build:client-package && npm run build:client",
  "vercel-build": "npm run build:data-provider && npm run build:client-package && npm run build:client",
  "build:data-provider": "npm run build -w packages/data-provider",
  "build:client-package": "npm run build -w packages/client",
  "build:client": "npm run build -w client"
}
```

**Key Changes:**
- Changed from `cd packages/... && npm run build` to `npm run build -w workspace-name`
- Using npm's `-w` (workspace) flag ensures proper context and dependency resolution
- Added explicit `vercel-build` script (Vercel looks for this first)
- Build order: data-provider → @librechat/client package → main client app

### 2. Updated `vercel.json`
Configured Vercel to build from the root with proper output directory:
```json
{
  "src": "package.json",
  "use": "@vercel/static-build",
  "config": {
    "distDir": "client/dist"
  }
}
```

### 3. Added `postcss.config.js` to `packages/client`
Created a minimal PostCSS configuration for the @librechat/client package build process.

## Build Order
The correct build sequence is:
1. Build `packages/data-provider` (librechat-data-provider) → creates its dist output
2. Build `packages/client` (@librechat/client) → creates dist/index.js, dist/index.es.js, dist/types/
3. Build main `client` application → can now resolve @librechat/client imports

## Why Workspace Commands?
Using `npm run build -w workspace-name` instead of `cd` commands provides:
- **Proper context**: npm understands workspace relationships
- **Dependency resolution**: Automatically handles workspace dependencies
- **Reliability**: Works consistently across different environments (local, CI, Vercel)
- **Error handling**: Better error messages and build failure detection

## How It Works
When Vercel deploys:
1. Runs `npm run build` or `npm run vercel-build` from root (per vercel.json)
2. Executes build scripts in order using workspace commands
3. Each workspace builds in isolation with proper dependency context
4. `@librechat/client` package dist folder is populated with all entry points
5. Main client build can successfully resolve and import from @librechat/client
6. vite-plugin-pwa can now properly resolve the package entries

## Testing
Deploy to Vercel and verify the build completes successfully. The build should:
- Install all workspace dependencies
- Build data-provider package → dist/
- Build @librechat/client package → dist/ (with index.js, index.es.js, types/)
- Build main client application → client/dist/
- Output final static files to `client/dist`
