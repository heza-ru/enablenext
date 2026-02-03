# Render Build Fix - Missing Workspace Packages

## The Problem

Render backend was failing with:
```
Cannot find module '@librechat/data-schemas/dist/index.cjs'
```

The backend needs these workspace packages to be built:
1. `@librechat/data-schemas` - Database schemas and models
2. `@librechat/api` - API utilities and controllers
3. `librechat-data-provider` - Data services

But they weren't being built during the Render build process.

## The Solution

Updated Render build command to build all required packages:

### `render.yaml`

**Before:**
```yaml
buildCommand: npm install && npm run build:packages
```

**After:**
```yaml
buildCommand: npm install && npm run build:data-schemas && npm run build:api && npm run build:data-provider
```

## What Gets Built on Render

```
1. npm install
   → Installs all dependencies and workspaces

2. npm run build:data-schemas
   → Builds packages/data-schemas
   → Creates dist/index.cjs (required by backend)

3. npm run build:api
   → Builds packages/api
   → Creates dist/ with API utilities

4. npm run build:data-provider
   → Builds packages/data-provider
   → Creates dist/ with data services

5. npm run backend
   → Starts server
   → All packages available ✅
```

## Update Render Service

### If Using render.yaml (Blueprint)
Just push the updated `render.yaml` and redeploy:

```bash
git add render.yaml
git commit -m "Fix Render build - add all required package builds"
git push origin main
```

Render will auto-redeploy if you used Blueprint.

### If Manually Configured

1. Go to Render Dashboard → Your Service
2. Click **Settings**
3. Find "Build Command"
4. Update to:
   ```bash
   npm install && npm run build:data-schemas && npm run build:api && npm run build:data-provider
   ```
5. Click **Save Changes**
6. Click **Manual Deploy** → Deploy latest commit

## Expected Success

After rebuild (~8 minutes), Render logs should show:

```
✅ Building @librechat/data-schemas...
✅ Building @librechat/api...
✅ Building librechat-data-provider...
✅ Running in API-only mode (separate frontend deployment)
✅ Server listening on all interfaces at port 10000
✅ No module errors
```

## Test Backend

```bash
curl https://enablenext.onrender.com/api/health
# Should return: OK

curl https://enablenext.onrender.com/api/config
# Should return: JSON config
```

## What the Backend Needs

The backend (`api/server/index.js`) imports:
- `@librechat/data-schemas` - For logger, schemas
- `@librechat/api` - For controllers, utilities
- `librechat-data-provider` - For data services (via other imports)

All three must be built before the backend can start.

---

**Push the fix and redeploy on Render!** 🚀
