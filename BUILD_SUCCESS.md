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
  "build:packages": "npm --prefix .. run build:data-provider && npm --prefix .. run build:client-package",
  "build": "cross-env NODE_ENV=production vite build && node ./scripts/post-build.cjs",
  "build:ci": "cross-env NODE_ENV=development vite build --mode ci"
}
```

**Why This Works:**
- `prebuild` automatically runs **before** the `build` script
- Uses `npm --prefix ..` to execute npm from the root directory
- This gives access to the workspace configuration defined in root `package.json`
- Calls root build scripts that use workspace commands
- Builds dependencies in correct order: data-provider → @librechat/client package

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
Vercel: npm run build (in /vercel/path0/client)
  ↓
prebuild hook triggers automatically
  ↓
npm run build:packages
  ↓
npm --prefix .. run build:data-provider
  → Executes from root: npm run build -w packages/data-provider
  → Builds librechat-data-provider
  → Creates packages/data-provider/dist/
  ↓
npm --prefix .. run build:client-package
  → Executes from root: npm run build -w packages/client
  → Builds @librechat/client package
  → Creates packages/client/dist/index.js
  → Creates packages/client/dist/index.es.js
  → Creates packages/client/dist/types/index.d.ts
  ↓
prebuild completes, build script runs
  ↓
vite build (main client)
  → Can now resolve @librechat/client imports
  → vite-plugin-pwa can find package entry points
  → Builds successfully to client/dist/
```

## Why `npm --prefix` + Workspace Commands?
Using `npm --prefix ..` to run root scripts that use workspace commands provides:
- **Root context**: `--prefix ..` executes npm from the root directory where workspaces are defined
- **Workspace access**: Root scripts can use `-w` flag to target specific workspaces
- **Dependency resolution**: npm understands workspace relationships
- **Reliability**: Works regardless of where Vercel starts the build
- **Error handling**: Clear error messages with proper exit codes
- **No path issues**: Avoids problems with `cd` commands and relative paths

## Key Insight: Vercel + Monorepos
Vercel detects which workspace contains the frontend build and runs the build from **that workspace's directory** (`/vercel/path0/client`), not from the root. This creates two challenges:

1. **Workspace commands don't work from subdirectories**: When running `npm run build -w packages/client` from the client folder, npm can't find workspaces because they're defined in the root `package.json`

2. **Solution: `npm --prefix ..`**: By using `npm --prefix ..`, we tell npm to execute commands from the parent (root) directory, giving access to the workspace configuration while still being called from the client's prebuild script

This is why:
- Root-level build scripts were initially bypassed
- Direct workspace commands (`-w`) failed with "No workspaces found"
- The `--prefix ..` approach solves both problems by bridging the gap between Vercel's build location and the workspace configuration

## Testing
Deploy to Vercel. The build should now:
1. Install all workspace dependencies
2. Run `prebuild` automatically before building client
3. Build packages/data-provider → dist/
4. Build packages/client (@librechat/client) → dist/ with entry points
5. Build main client with vite → client/dist/
6. Successfully deploy static files from client/dist/
