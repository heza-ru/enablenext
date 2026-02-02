# Vercel Build Fix - FINAL SOLUTION

## Problem
The build was failing on Vercel with the error:
```
Failed to resolve entry for package "@librechat/client". 
The package may have incorrect main/module/exports specified in its package.json.
```

## Root Cause
The `@librechat/client` package is a workspace package that needs to be built before the main client application can use it. **Vercel was running the build directly from the `client` workspace** (not from root), bypassing any root-level build orchestration. This meant the `@librechat/client` package's `dist` folder with entry points never got created.

## Solution

### 1. Added `prebuild` Scripts to `client/package.json`
The key insight: Vercel runs `npm run build` from the **client workspace**, so we need the prebuild logic in the client's package.json:

```json
"scripts": {
  "prebuild": "npm run build:packages",
  "prebuild:ci": "npm run build:packages",
  "build:packages": "npm run build -w packages/data-provider && npm run build -w packages/client",
  "build": "cross-env NODE_ENV=production vite build && node ./scripts/post-build.cjs",
  "build:ci": "cross-env NODE_ENV=development vite build --mode ci"
}
```

**Why This Works:**
- `prebuild` automatically runs **before** the `build` script
- Uses npm workspace commands (`-w`) that work from any directory in the monorepo
- Builds dependencies in correct order: data-provider → @librechat/client package
- No reliance on `cd` commands or relative paths

### 2. Updated Root `package.json` Build Scripts
Updated root scripts to use workspace commands for consistency:

```json
"scripts": {
  "build": "npm run build:data-provider && npm run build:client-package && npm run build:client",
  "build:data-provider": "npm run build -w packages/data-provider",
  "build:client-package": "npm run build -w packages/client",
  "build:client": "npm run build -w client"
}
```

### 3. Updated `vercel.json`
Set Vercel to build from the client workspace (matching what it was already doing):
```json
{
  "src": "client/package.json",
  "use": "@vercel/static-build",
  "config": {
    "distDir": "dist"
  }
}
```

### 4. Added `postcss.config.js` to `packages/client`
Created a minimal PostCSS configuration for the @librechat/client package build process.

## Build Order & Flow

When Vercel runs the build:

```
Vercel: npm run build (in client workspace)
  ↓
prebuild hook triggers automatically
  ↓
npm run build:packages
  ↓
1. npm run build -w packages/data-provider
   → Builds librechat-data-provider
   → Creates packages/data-provider/dist/
  ↓
2. npm run build -w packages/client
   → Builds @librechat/client package
   → Creates packages/client/dist/index.js
   → Creates packages/client/dist/index.es.js
   → Creates packages/client/dist/types/index.d.ts
  ↓
prebuild completes, build script runs
  ↓
3. vite build (main client)
   → Can now resolve @librechat/client imports
   → vite-plugin-pwa can find package entry points
   → Builds successfully to client/dist/
```

## Why Workspace Commands?
Using `npm run build -w workspace-name` instead of `cd` commands provides:
- **Context-aware**: Works from any directory in the monorepo
- **Dependency resolution**: npm understands workspace relationships
- **Reliability**: Consistent behavior in local, CI, and Vercel environments
- **Error handling**: Clear error messages with proper exit codes

## Key Insight: Vercel + Monorepos
Vercel detects which workspace contains the frontend build and runs the build from **that workspace's directory**, not from the root. This is why:
- Root-level build scripts were bypassed
- `cd` commands in prebuild were failing (wrong starting directory)
- Workspace commands (`-w`) are the correct solution

## Testing
Deploy to Vercel. The build should now:
1. Install all workspace dependencies
2. Run `prebuild` automatically before building client
3. Build packages/data-provider → dist/
4. Build packages/client (@librechat/client) → dist/ with entry points
5. Build main client with vite → client/dist/
6. Successfully deploy static files from client/dist/
