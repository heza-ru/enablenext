# Google Drive Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Google-authenticated users browse their Drive files to attach as chat context, and automatically save artifact outputs (PPTX/XLSX/DOCX) to a designated Google Drive folder opening directly in Google Slides/Sheets/Docs.

**Architecture:** Add `drive.readonly` + `drive.file` scopes to the existing Google OAuth login, save the access/refresh tokens to the user document, then proxy all Drive API calls through a new `/api/drive/*` route set. The frontend adds a Google Drive option to the attach menu (mirroring the existing SharePoint pattern) and an "Save to Drive" button on artifact outputs.

**Tech Stack:** Node.js (Express), `googleapis` npm package (server-side Drive API calls), React/TypeScript frontend, Mongoose (MongoDB user model), passport-google-oauth20.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `api/strategies/googleStrategy.js` | Add Drive scopes to OAuth request |
| Modify | `api/strategies/socialLogin.js` | Save `googleAccessToken` + `googleRefreshToken` when provider = google |
| Modify | `packages/data-schemas/src/schema/user.ts` | Add `googleAccessToken`, `googleRefreshToken`, `googleDriveFolderId` fields |
| Modify | `packages/data-schemas/src/types/user.ts` | Add same three fields to `IUser` interface |
| Create | `api/server/routes/drive/index.js` | Mount drive sub-routes, apply auth + provider guard |
| Create | `api/server/routes/drive/files.js` | `GET /files`, `GET /files/:fileId/content`, `POST /files/upload`, `GET /status` |
| Create | `api/server/services/DriveService.js` | All Google Drive API calls + token refresh logic |
| Modify | `api/server/routes/auth.js` | Mount `GET /drive-token` route |
| Modify | `api/server/routes/index.js` (or main router) | Mount `/api/drive` router |
| Modify | `api/server/routes/config.js` | Add `googleDrivePickerEnabled` to startup config payload |
| Modify | `.env.example` | Document `GOOGLE_DRIVE_ENABLED`, `GOOGLE_DRIVE_FOLDER_NAME` |
| Create | `client/src/hooks/Files/useGoogleDriveFileHandling.ts` | Download selected Drive files → existing `handleFileChange` pipeline |
| Create | `client/src/components/GoogleDrive/GoogleDrivePickerDialog.tsx` | File browser modal |
| Create | `client/src/components/GoogleDrive/index.ts` | Barrel export |
| Modify | `client/src/components/Chat/Input/Files/AttachFileMenu.tsx` | Add Drive menu item (Google users only) |
| Modify | `client/src/components/Artifacts/DownloadArtifact.tsx` | Add "Save to Drive" button for PPTX/XLSX/DOCX |

---

## Task 1: Install `googleapis` in the API package

**Files:**
- Modify: `api/package.json`

- [ ] **Step 1: Install the package**

```bash
cd api && npm install googleapis
```

Expected: `googleapis` appears under `dependencies` in `api/package.json`.

- [ ] **Step 2: Commit**

```bash
git add api/package.json api/package-lock.json
git commit -m "chore: add googleapis dependency to api package"
```

---

## Task 2: Update user schema and types

**Files:**
- Modify: `packages/data-schemas/src/schema/user.ts`
- Modify: `packages/data-schemas/src/types/user.ts`

- [ ] **Step 1: Add fields to the Mongoose schema**

In `packages/data-schemas/src/schema/user.ts`, add these three fields inside the `userSchema` definition, after the `appleId` field (around line 108):

```typescript
    googleAccessToken: {
      type: String,
      select: false,
    },
    googleRefreshToken: {
      type: String,
      select: false,
    },
    googleDriveFolderId: {
      type: String,
    },
```

- [ ] **Step 2: Add fields to the IUser interface**

In `packages/data-schemas/src/types/user.ts`, add after `appleId?: string;` (line 20):

```typescript
  googleAccessToken?: string;
  googleRefreshToken?: string;
  googleDriveFolderId?: string;
```

- [ ] **Step 3: Rebuild the packages**

```bash
cd /Users/mohammad.haider/Documents/enablenext && npm run build:packages
```

Expected: Exits 0 with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add packages/data-schemas/src/schema/user.ts packages/data-schemas/src/types/user.ts
git commit -m "feat: add google drive token fields to user schema"
```

---

## Task 3: Update Google OAuth strategy to request Drive scopes

**Files:**
- Modify: `api/strategies/googleStrategy.js`
- Modify: `api/strategies/socialLogin.js`

- [ ] **Step 1: No changes needed to googleStrategy.js**

`passport-google-oauth20`'s Strategy constructor does not accept scope — scope goes in the `passport.authenticate()` call in `api/server/routes/oauth.js`. `googleStrategy.js` stays unchanged.

- [ ] **Step 2: Check how passport.authenticate is called for Google**

```bash
grep -n "google" /Users/mohammad.haider/Documents/enablenext/api/server/routes/oauth.js
```

Expected: Lines showing `passport.authenticate('google', ...)`.

- [ ] **Step 3: Update oauth.js to include Drive scopes**

In `api/server/routes/oauth.js`, find the line calling `passport.authenticate('google', ...)` and update its scope option:

```javascript
// Before (example):
passport.authenticate('google', { scope: ['profile', 'email'], session: false })

// After:
passport.authenticate('google', {
  scope: [
    'profile',
    'email',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.file',
  ],
  accessType: 'offline',
  prompt: 'consent',
  session: false,
})
```

The `accessType: 'offline'` and `prompt: 'consent'` are required so Google issues a refresh token on every login.

- [ ] **Step 4: Update socialLogin.js to save tokens when provider is google**

In `api/strategies/socialLogin.js`, the callback signature is `(accessToken, refreshToken, idToken, profile, cb)`. Update the block that handles `existingUser?.provider === provider` and `createSocialUser` to also save tokens:

```javascript
const socialLogin =
  (provider, getProfileDetails) => async (accessToken, refreshToken, idToken, profile, cb) => {
    try {
      const { email, id, avatarUrl, username, name, emailVerified } = getProfileDetails({
        idToken,
        profile,
      });

      const appConfig = await getAppConfig();

      if (!isEmailDomainAllowed(email, appConfig?.registration?.allowedDomains)) {
        logger.error(
          `[${provider}Login] Authentication blocked - email domain not allowed [Email: ${email}]`,
        );
        const error = new Error(ErrorTypes.AUTH_FAILED);
        error.code = ErrorTypes.AUTH_FAILED;
        error.message = 'Email domain not allowed';
        return cb(error);
      }

      const providerKey = `${provider}Id`;
      let existingUser = null;

      if (id && typeof id === 'string') {
        existingUser = await findUser({ [providerKey]: id });
      }

      if (!existingUser) {
        existingUser = await findUser({ email: email?.trim() });
        if (existingUser) {
          logger.warn(`[${provider}Login] User found by email: ${email} but not by ${providerKey}`);
        }
      }

      if (existingUser?.provider === provider) {
        await handleExistingUser(existingUser, avatarUrl, appConfig, email);
        // Save Google Drive tokens on each login so they stay fresh
        if (provider === 'google' && accessToken) {
          const tokenUpdate = { googleAccessToken: accessToken };
          if (refreshToken) {
            tokenUpdate.googleRefreshToken = refreshToken;
          }
          await existingUser.updateOne(tokenUpdate);
        }
        return cb(null, existingUser);
      } else if (existingUser) {
        logger.info(
          `[${provider}Login] User ${email} already exists with provider ${existingUser.provider}`,
        );
        const error = new Error(ErrorTypes.AUTH_FAILED);
        error.code = ErrorTypes.AUTH_FAILED;
        error.provider = existingUser.provider;
        return cb(error);
      }

      const ALLOW_SOCIAL_REGISTRATION = isEnabled(process.env.ALLOW_SOCIAL_REGISTRATION);
      if (!ALLOW_SOCIAL_REGISTRATION) {
        logger.error(
          `[${provider}Login] Registration blocked - social registration is disabled [Email: ${email}]`,
        );
        const error = new Error(ErrorTypes.AUTH_FAILED);
        error.code = ErrorTypes.AUTH_FAILED;
        error.message = 'Social registration is disabled';
        return cb(error);
      }

      const newUser = await createSocialUser({
        email,
        avatarUrl,
        provider,
        providerKey: `${provider}Id`,
        providerId: id,
        username,
        name,
        emailVerified,
        appConfig,
      });

      // Save Google Drive tokens for new user
      if (provider === 'google' && accessToken) {
        const tokenUpdate = { googleAccessToken: accessToken };
        if (refreshToken) {
          tokenUpdate.googleRefreshToken = refreshToken;
        }
        await newUser.updateOne(tokenUpdate);
      }

      return cb(null, newUser);
    } catch (err) {
      logger.error(`[${provider}Login]`, err);
      return cb(err);
    }
  };

module.exports = socialLogin;
```

- [ ] **Step 5: Commit**

```bash
git add api/strategies/googleStrategy.js api/strategies/socialLogin.js api/server/routes/oauth.js
git commit -m "feat: request google drive scopes and save oauth tokens at login"
```

---

## Task 4: Create DriveService.js

**Files:**
- Create: `api/server/services/DriveService.js`

This service wraps all Google Drive API calls and handles token refresh transparently.

- [ ] **Step 1: Create the service file**

Create `api/server/services/DriveService.js`:

```javascript
const { google } = require('googleapis');
const { findUser } = require('~/models');
const { logger } = require('@librechat/data-schemas');

function buildOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.DOMAIN_SERVER}${process.env.GOOGLE_CALLBACK_URL}`,
  );
}

/**
 * Returns a Drive API client with a valid (possibly refreshed) access token.
 * Saves a new access token to the user document if refreshed.
 */
async function getDriveClient(userId) {
  const user = await findUser({ _id: userId }, '+googleAccessToken +googleRefreshToken');
  if (!user?.googleRefreshToken) {
    throw new Error('DRIVE_NOT_CONNECTED');
  }

  const oauth2Client = buildOAuthClient();
  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken,
  });

  // Proactively refresh if token looks expired (googleapis handles this automatically,
  // but we save the new token back so the next call starts fresh too)
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await user.updateOne({ googleAccessToken: tokens.access_token });
    }
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

/**
 * List files in the user's Drive.
 * @param {string} userId
 * @param {{ query?: string, pageToken?: string, mimeType?: string }} options
 */
async function listFiles(userId, { query = '', pageToken, mimeType } = {}) {
  const drive = await getDriveClient(userId);

  let q = "trashed = false";
  if (query) {
    q += ` and name contains '${query.replace(/'/g, "\\'")}'`;
  }
  if (mimeType) {
    q += ` and mimeType = '${mimeType}'`;
  }

  const response = await drive.files.list({
    q,
    pageSize: 50,
    pageToken: pageToken || undefined,
    fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, iconLink, thumbnailLink, webViewLink)',
    orderBy: 'modifiedTime desc',
  });

  return response.data;
}

/**
 * Download a file from Drive. Google Workspace files are exported as plain text.
 * Returns { buffer: Buffer, mimeType: string, filename: string }
 */
async function downloadFile(userId, fileId) {
  const drive = await getDriveClient(userId);

  // Get file metadata first
  const meta = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType',
  });

  const { name, mimeType } = meta.data;

  const EXPORT_MAP = {
    'application/vnd.google-apps.document': { mime: 'text/plain', ext: '.txt' },
    'application/vnd.google-apps.spreadsheet': { mime: 'text/csv', ext: '.csv' },
    'application/vnd.google-apps.presentation': { mime: 'text/plain', ext: '.txt' },
  };

  if (EXPORT_MAP[mimeType]) {
    const { mime, ext } = EXPORT_MAP[mimeType];
    const response = await drive.files.export(
      { fileId, mimeType: mime },
      { responseType: 'arraybuffer' },
    );
    return {
      buffer: Buffer.from(response.data),
      mimeType: mime,
      filename: name.endsWith(ext) ? name : `${name}${ext}`,
    };
  }

  // Binary file — download directly
  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' },
  );
  return {
    buffer: Buffer.from(response.data),
    mimeType,
    filename: name,
  };
}

const GOOGLE_WORKSPACE_MIME = {
  pptx: 'application/vnd.google-apps.presentation',
  xlsx: 'application/vnd.google-apps.spreadsheet',
  docx: 'application/vnd.google-apps.document',
};

const UPLOAD_MIME = {
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/**
 * Ensure the app's designated output folder exists in the user's Drive.
 * Caches the folderId on the user document.
 * Returns the folder ID.
 */
async function ensureOutputFolder(userId, drive) {
  const user = await findUser({ _id: userId }, 'googleDriveFolderId');
  if (user.googleDriveFolderId) {
    // Verify folder still exists
    try {
      await drive.files.get({ fileId: user.googleDriveFolderId, fields: 'id' });
      return user.googleDriveFolderId;
    } catch {
      // Folder was deleted — recreate it
    }
  }

  const folderName = process.env.GOOGLE_DRIVE_FOLDER_NAME || 'EnableNext Outputs';
  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });

  const folderId = folder.data.id;
  await user.updateOne({ googleDriveFolderId: folderId });
  return folderId;
}

/**
 * Upload a file buffer to the user's Drive output folder.
 * Converts Office formats to Google Workspace.
 * Returns { webViewLink, id }
 */
async function uploadFile(userId, { buffer, filename, ext }) {
  const drive = await getDriveClient(userId);
  const folderId = await ensureOutputFolder(userId, drive);

  const sourceMime = UPLOAD_MIME[ext];
  const targetMime = GOOGLE_WORKSPACE_MIME[ext];

  if (!sourceMime || !targetMime) {
    throw new Error(`Unsupported extension: ${ext}`);
  }

  const { Readable } = require('stream');
  const stream = Readable.from(buffer);

  const response = await drive.files.create({
    requestBody: {
      name: filename,
      mimeType: targetMime, // convert to Google Workspace format
      parents: [folderId],
    },
    media: {
      mimeType: sourceMime,
      body: stream,
    },
    fields: 'id, webViewLink',
  });

  return response.data;
}

module.exports = { listFiles, downloadFile, uploadFile };
```

- [ ] **Step 2: Commit**

```bash
git add api/server/services/DriveService.js
git commit -m "feat: add DriveService for Google Drive API calls"
```

---

## Task 5: Create Drive API routes

**Files:**
- Create: `api/server/routes/drive/files.js`
- Create: `api/server/routes/drive/index.js`

- [ ] **Step 1: Create files.js**

Create `api/server/routes/drive/files.js`:

```javascript
const express = require('express');
const { Readable } = require('stream');
const { logger } = require('@librechat/data-schemas');
const { listFiles, downloadFile, uploadFile } = require('~/server/services/DriveService');

const router = express.Router();

/** GET /api/drive/status */
router.get('/status', (req, res) => {
  const connected = req.user?.provider === 'google' && !!req.user?.googleDriveFolderId !== undefined;
  // We check by re-fetching with select to see if refresh token is present
  const { findUser } = require('~/models');
  findUser({ _id: req.user._id }, '+googleRefreshToken')
    .then((user) => res.json({ connected: !!user?.googleRefreshToken }))
    .catch(() => res.json({ connected: false }));
});

/** GET /api/drive/files */
router.get('/files', async (req, res) => {
  try {
    const { query, pageToken, mimeType } = req.query;
    const data = await listFiles(req.user._id, { query, pageToken, mimeType });
    res.json(data);
  } catch (err) {
    if (err.message === 'DRIVE_NOT_CONNECTED') {
      return res.status(403).json({ error: 'Google Drive not connected. Please log in again.' });
    }
    logger.error('[Drive] listFiles error', err);
    res.status(500).json({ error: 'Failed to list Drive files' });
  }
});

/** GET /api/drive/files/:fileId/content */
router.get('/files/:fileId/content', async (req, res) => {
  try {
    const { buffer, mimeType, filename } = await downloadFile(req.user._id, req.params.fileId);

    // Push through the existing file upload pipeline
    const { processFileUpload } = require('~/server/services/Files/process');
    const fakeReq = Object.assign({}, req, {
      file: {
        buffer,
        originalname: filename,
        mimetype: mimeType,
        size: buffer.length,
      },
    });

    const result = await processFileUpload({ req: fakeReq, res, file: fakeReq.file });
    res.json(result);
  } catch (err) {
    if (err.message === 'DRIVE_NOT_CONNECTED') {
      return res.status(403).json({ error: 'Google Drive not connected. Please log in again.' });
    }
    logger.error('[Drive] downloadFile error', err);
    res.status(500).json({ error: 'Failed to download Drive file' });
  }
});

/** POST /api/drive/files/upload */
router.post('/files/upload', async (req, res) => {
  try {
    const { filename, ext, data } = req.body;
    if (!filename || !ext || !data) {
      return res.status(400).json({ error: 'filename, ext, and data are required' });
    }
    const buffer = Buffer.from(data, 'base64');
    const result = await uploadFile(req.user._id, { buffer, filename, ext });
    res.json({ webViewLink: result.webViewLink, id: result.id });
  } catch (err) {
    if (err.message === 'DRIVE_NOT_CONNECTED') {
      return res.status(403).json({ error: 'Google Drive not connected. Please log in again.' });
    }
    logger.error('[Drive] uploadFile error', err);
    res.status(500).json({ error: 'Failed to upload file to Drive' });
  }
});

module.exports = router;
```

- [ ] **Step 2: Create index.js**

Create `api/server/routes/drive/index.js`:

```javascript
const express = require('express');
const middleware = require('~/server/middleware');
const filesRouter = require('./files');

const router = express.Router();

// All drive routes require JWT auth and Google provider
router.use(middleware.requireJwtAuth, (req, res, next) => {
  if (req.user?.provider !== 'google') {
    return res.status(403).json({ error: 'Google Drive is only available for Google login users.' });
  }
  next();
});

router.use('/', filesRouter);

module.exports = router;
```

- [ ] **Step 3: Mount the drive router in the main API routes**

Find the main routes index file:

```bash
grep -rn "require.*routes" /Users/mohammad.haider/Documents/enablenext/api/server/index.js | head -20
# Or check:
ls /Users/mohammad.haider/Documents/enablenext/api/server/routes/
```

In the main router file (likely `api/server/index.js` or `api/app.js`), add:

```javascript
const driveRouter = require('./routes/drive');
// ...
app.use('/api/drive', driveRouter);
```

- [ ] **Step 4: Commit**

```bash
git add api/server/routes/drive/
git commit -m "feat: add google drive API routes (list, download, upload)"
```

---

## Task 6: Update startup config

**Files:**
- Modify: `api/server/routes/config.js`
- Modify: `.env.example`

- [ ] **Step 1: Add Drive config flag**

In `api/server/routes/config.js`, after line 23 (`const sharePointFilePickerEnabled = ...`), add:

```javascript
const googleDrivePickerEnabled = isEnabled(process.env.GOOGLE_DRIVE_ENABLED);
```

In the `payload` object (around line 108 where `sharePointFilePickerEnabled` is set), add:

```javascript
      googleDrivePickerEnabled,
      googleDriveFolderName: process.env.GOOGLE_DRIVE_FOLDER_NAME || 'EnableNext Outputs',
```

- [ ] **Step 2: Add env vars to .env.example**

Find the Google OAuth section in `.env.example` (search for `GOOGLE_CLIENT_ID`) and add below it:

```bash
# Google Drive Integration (requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET above)
GOOGLE_DRIVE_ENABLED=true
GOOGLE_DRIVE_FOLDER_NAME=EnableNext Outputs
```

- [ ] **Step 3: Commit**

```bash
git add api/server/routes/config.js .env.example
git commit -m "feat: add google drive config flags to startup config"
```

---

## Task 7: Create frontend hook for Drive file handling

**Files:**
- Create: `client/src/hooks/Files/useGoogleDriveFileHandling.ts`

This hook downloads selected Drive files and feeds them into the existing upload pipeline.

- [ ] **Step 1: Create the hook**

Create `client/src/hooks/Files/useGoogleDriveFileHandling.ts`:

```typescript
import { useState, useCallback } from 'react';
import { useFileHandling } from '~/hooks';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export default function useGoogleDriveFileHandling() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleFiles } = useFileHandling();

  const handleDriveFiles = useCallback(
    async (driveFiles: DriveFile[]) => {
      setIsProcessing(true);
      setError(null);
      try {
        for (const driveFile of driveFiles) {
          const res = await fetch(`/api/drive/files/${driveFile.id}/content`, {
            credentials: 'include',
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `Failed to fetch ${driveFile.name}`);
          }
          const fileRecord = await res.json();
          // fileRecord matches the shape returned by processFileUpload
          // handleFiles expects File objects — wrap the response for the pipeline
          if (fileRecord) {
            handleFiles([fileRecord]);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to attach Drive file');
      } finally {
        setIsProcessing(false);
      }
    },
    [handleFiles],
  );

  return { handleDriveFiles, isProcessing, error };
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/hooks/Files/useGoogleDriveFileHandling.ts
git commit -m "feat: add useGoogleDriveFileHandling hook"
```

---

## Task 8: Create GoogleDrivePickerDialog component

**Files:**
- Create: `client/src/components/GoogleDrive/GoogleDrivePickerDialog.tsx`
- Create: `client/src/components/GoogleDrive/index.ts`

- [ ] **Step 1: Create the dialog**

Create `client/src/components/GoogleDrive/GoogleDrivePickerDialog.tsx`:

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Search, FileText, TableIcon, PresentationIcon, Loader2 } from 'lucide-react';
import {
  OGDialog,
  OGDialogTitle,
  OGDialogPortal,
  OGDialogOverlay,
  OGDialogContent,
  Button,
} from '@librechat/client';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  iconLink?: string;
}

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onFilesSelected?: (files: DriveFile[]) => void;
  isDownloading?: boolean;
  maxSelectionCount?: number;
}

function mimeLabel(mimeType: string): string {
  if (mimeType.includes('document')) return 'Doc';
  if (mimeType.includes('spreadsheet')) return 'Sheet';
  if (mimeType.includes('presentation')) return 'Slides';
  if (mimeType.includes('pdf')) return 'PDF';
  return 'File';
}

export default function GoogleDrivePickerDialog({
  isOpen,
  onOpenChange,
  onFilesSelected,
  isDownloading = false,
  maxSelectionCount,
}: Props) {
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(
    async (pageToken?: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (query) params.set('query', query);
        if (pageToken) params.set('pageToken', pageToken);
        const res = await fetch(`/api/drive/files?${params}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load Drive files');
        const data = await res.json();
        setFiles((prev) => (pageToken ? [...prev, ...(data.files ?? [])] : (data.files ?? [])));
        setNextPageToken(data.nextPageToken ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load files');
      } finally {
        setLoading(false);
      }
    },
    [query],
  );

  useEffect(() => {
    if (isOpen) {
      setFiles([]);
      setSelected(new Set());
      fetchFiles();
    }
  }, [isOpen, fetchFiles]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (!maxSelectionCount || next.size < maxSelectionCount) {
        next.add(id);
      }
      return next;
    });
  };

  const handleAttach = () => {
    const selectedFiles = files.filter((f) => selected.has(f.id));
    onFilesSelected?.(selectedFiles);
    onOpenChange(false);
  };

  return (
    <OGDialog open={isOpen} onOpenChange={onOpenChange}>
      <OGDialogPortal>
        <OGDialogOverlay className="bg-black/50" />
        <OGDialogContent className="fixed left-1/2 top-1/2 z-50 h-[560px] w-[600px] max-h-[90vh] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-surface-primary p-4 shadow-lg focus:outline-none flex flex-col gap-3">
          <OGDialogTitle className="text-base font-semibold">
            Google Drive
          </OGDialogTitle>

          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              placeholder="Search files..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchFiles()}
              className="w-full rounded-md border bg-surface-primary pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* File list */}
          <div className="flex-1 overflow-y-auto rounded-md border divide-y">
            {error && (
              <p className="p-4 text-sm text-red-500">{error}</p>
            )}
            {loading && files.length === 0 && (
              <div className="flex items-center justify-center p-8">
                <Loader2 size={20} className="animate-spin text-text-secondary" />
              </div>
            )}
            {!loading && files.length === 0 && !error && (
              <p className="p-4 text-sm text-text-secondary">No files found.</p>
            )}
            {files.map((file) => (
              <label
                key={file.id}
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-surface-hover"
              >
                <input
                  type="checkbox"
                  checked={selected.has(file.id)}
                  onChange={() => toggleSelect(file.id)}
                  className="rounded"
                />
                <FileText size={15} className="shrink-0 text-text-secondary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{file.name}</p>
                  <p className="text-xs text-text-secondary">
                    {mimeLabel(file.mimeType)}
                    {file.modifiedTime && ` · ${new Date(file.modifiedTime).toLocaleDateString()}`}
                  </p>
                </div>
              </label>
            ))}
            {nextPageToken && !loading && (
              <button
                onClick={() => fetchFiles(nextPageToken)}
                className="w-full py-2 text-sm text-primary hover:underline"
              >
                Load more
              </button>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">
              {selected.size} selected{maxSelectionCount ? ` / ${maxSelectionCount}` : ''}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={selected.size === 0 || isDownloading}
                onClick={handleAttach}
              >
                {isDownloading ? (
                  <><Loader2 size={13} className="mr-1 animate-spin" /> Attaching...</>
                ) : (
                  `Attach ${selected.size > 0 ? `(${selected.size})` : ''}`
                )}
              </Button>
            </div>
          </div>
        </OGDialogContent>
      </OGDialogPortal>
    </OGDialog>
  );
}
```

- [ ] **Step 2: Create barrel export**

Create `client/src/components/GoogleDrive/index.ts`:

```typescript
export { default as GoogleDrivePickerDialog } from './GoogleDrivePickerDialog';
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/GoogleDrive/
git commit -m "feat: add GoogleDrivePickerDialog component"
```

---

## Task 9: Wire Google Drive into AttachFileMenu

**Files:**
- Modify: `client/src/components/Chat/Input/Files/AttachFileMenu.tsx`

- [ ] **Step 1: Add imports**

At the top of `AttachFileMenu.tsx`, add these imports alongside the existing ones:

```tsx
// Add to existing lucide-react imports:
import { HardDrive } from 'lucide-react';

// Add after the SharePoint import lines:
import useGoogleDriveFileHandling from '~/hooks/Files/useGoogleDriveFileHandling';
import { GoogleDrivePickerDialog } from '~/components/GoogleDrive';
```

- [ ] **Step 2: Add hook call and state inside the component**

Inside `AttachFileMenu` component body, after the SharePoint hook line (line 70), add:

```tsx
  const { handleDriveFiles, isProcessing: isDriveProcessing } = useGoogleDriveFileHandling();
  const [isDriveDialogOpen, setIsDriveDialogOpen] = useState(false);
  const googleDriveEnabled = startupConfig?.googleDrivePickerEnabled;
  const isGoogleUser = /* get from auth context */ startupConfig?.googleLoginEnabled; // will refine below
```

To get the current user's provider, check how `useRecoilState` or auth context exposes `user.provider`. Search:

```bash
grep -rn "user\.provider\|useAuthContext\|useUserData" /Users/mohammad.haider/Documents/enablenext/client/src/hooks/ | head -10
```

Use the found hook/selector to read `user.provider === 'google'` for the guard.

- [ ] **Step 3: Add Drive menu item to dropdownItems**

Inside `createMenuItems`, after the SharePoint block (after `return localItems;` at line 228), but before the outer `return localItems`, add:

```tsx
    if (googleDriveEnabled && isGoogleUser) {
      localItems.push({
        label: 'Google Drive',
        onClick: () => setIsDriveDialogOpen(true),
        icon: <HardDrive className="icon-md" />,
      });
    }
```

- [ ] **Step 4: Add the dialog to the JSX**

In the return statement, after the `<SharePointPickerDialog ... />` block (around line 295), add:

```tsx
      <GoogleDrivePickerDialog
        isOpen={isDriveDialogOpen}
        onOpenChange={setIsDriveDialogOpen}
        onFilesSelected={async (driveFiles) => {
          await handleDriveFiles(driveFiles);
          setIsDriveDialogOpen(false);
        }}
        isDownloading={isDriveProcessing}
        maxSelectionCount={endpointFileConfig?.fileLimit}
      />
```

- [ ] **Step 5: Add new deps to the `useMemo` dependency array**

Add `googleDriveEnabled`, `isGoogleUser`, `setIsDriveDialogOpen` to the `useMemo` deps array at line 229.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/Chat/Input/Files/AttachFileMenu.tsx
git commit -m "feat: add google drive option to attach file menu"
```

---

## Task 10: Add "Save to Drive" button on artifact outputs

**Files:**
- Modify: `client/src/components/Artifacts/DownloadArtifact.tsx`

The artifact's `downloadNative` function already handles PPTX/XLSX/DOCX. We intercept the generated file blob (via the `artifact-download` postMessage) and optionally upload it to Drive.

- [ ] **Step 1: Add hook and state**

At the top of `DownloadArtifact.tsx`, add this import:

```tsx
import { useGetStartupConfig } from '~/data-provider';
```

Inside the `DownloadArtifact` component, add:

```tsx
  const { data: startupConfig } = useGetStartupConfig();
  const [driveLink, setDriveLink] = useState<string | null>(null);
  const [driveSaving, setDriveSaving] = useState<string | null>(null); // ext being saved
```

- [ ] **Step 2: Add saveToDrive function**

Add this function inside the component, after `flash`:

```tsx
  const saveToDrive = async (fmt: NativeFormat) => {
    setDriveSaving(fmt.ext);
    setDriveLink(null);

    // Trigger the native download to get the blob via postMessage
    return new Promise<void>((resolve) => {
      const handler = async (e: MessageEvent) => {
        if (e.data?.type !== 'artifact-download') return;
        if (!e.data.filename?.endsWith(`.${fmt.ext}`)) return;
        window.removeEventListener('message', handler);

        try {
          const res = await fetch('/api/drive/files/upload', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: e.data.filename,
              ext: fmt.ext,
              data: e.data.data, // already base64 from the existing blob interceptor
            }),
          });
          if (!res.ok) throw new Error('Upload failed');
          const { webViewLink } = await res.json();
          setDriveLink(webViewLink);
        } catch (err) {
          console.error('[DownloadArtifact] Drive upload error', err);
        } finally {
          setDriveSaving(null);
          resolve();
        }
      };
      window.addEventListener('message', handler);
      // Trigger the generation — reuse existing downloadNative logic
      downloadNative(fmt);
    });
  };
```

- [ ] **Step 3: Add "Save to Drive" buttons in the JSX**

In the return statement, inside the `nativeFormats.map(...)` block, after the existing download `<Button>`, add:

```tsx
        {startupConfig?.googleDrivePickerEnabled && (
          <Button
            key={`${fmt.ext}-drive`}
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs font-medium"
            onClick={() => saveToDrive(fmt)}
            disabled={driveSaving === fmt.ext}
            aria-label={`Save ${fmt.label} to Google Drive`}
          >
            {driveSaving === fmt.ext ? (
              <Loader2 size={12} className="mr-1 animate-spin" />
            ) : driveLink && done === fmt.ext ? (
              <CircleCheckBig size={13} className="mr-1" />
            ) : null}
            {driveSaving === fmt.ext ? 'Saving...' : 'Drive'}
          </Button>
        )}
        {driveLink && (
          <a
            href={driveLink}
            target="_blank"
            rel="noopener noreferrer"
            className="h-7 px-2 text-xs font-medium text-primary hover:underline flex items-center"
          >
            Open ↗
          </a>
        )}
```

Add `Loader2` to the existing lucide-react import at the top of the file.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/Artifacts/DownloadArtifact.tsx
git commit -m "feat: add save-to-drive button on artifact outputs"
```

---

## Task 11: Manual verification

- [ ] **Step 1: Set env vars in your .env file**

```bash
GOOGLE_DRIVE_ENABLED=true
GOOGLE_DRIVE_FOLDER_NAME=EnableNext Outputs
# GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must already be set
```

Also go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Enable **Google Drive API** for your project, and add the two Drive scopes to your OAuth consent screen.

- [ ] **Step 2: Start the app**

```bash
npm run build:packages && npm run dev
```

- [ ] **Step 3: Log in with Google and verify token storage**

Log in via Google OAuth. Then in a mongo shell or admin tool, verify the user document has `googleAccessToken` and `googleRefreshToken` populated.

- [ ] **Step 4: Test Drive file picker**

Open a chat. Click the attach (paperclip) menu. Confirm "Google Drive" appears. Click it, verify the file browser loads, select a file, click Attach, confirm it appears in the chat input.

- [ ] **Step 5: Test artifact save to Drive**

Generate a presentation/spreadsheet/document artifact. Confirm "Drive" button appears next to PPTX/XLSX/DOCX. Click it. Verify the file appears in the "EnableNext Outputs" folder in the user's Google Drive and the "Open ↗" link works.

---

## Possible Gotchas

- **`processFileUpload` signature**: Check the actual signature in `api/server/services/Files/process.js` before using the fake-req approach in Task 5. You may need to write the buffer to a temp file and construct a real `req.file` multer object.
- **Token not returned on existing sessions**: Users who already have a Google session won't get Drive tokens until they log out and back in. This is expected — document it.
- **`googleapis` stream upload**: Ensure Node.js `Readable.from(buffer)` works with the googleapis Drive client. If not, use `require('stream').PassThrough` with `stream.end(buffer)`.
- **User auth context for `isGoogleUser` in frontend**: Check `useAuthContext` or `useRecoilValue(userInfoAtom)` — whichever pattern the rest of the codebase uses to read `user.provider`.
