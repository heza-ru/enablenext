const { Readable } = require('stream');
const { google } = require('googleapis');
const { findUser, updateUser } = require('~/models');
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

  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await updateUser(user._id.toString(), { googleAccessToken: tokens.access_token });
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

  let q = 'trashed = false';
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
    fields:
      'nextPageToken, files(id, name, mimeType, size, modifiedTime, iconLink, thumbnailLink, webViewLink)',
    orderBy: 'modifiedTime desc',
  });

  return response.data;
}

const EXPORT_MAP = {
  'application/vnd.google-apps.document': { mime: 'text/plain', ext: '.txt' },
  'application/vnd.google-apps.spreadsheet': { mime: 'text/csv', ext: '.csv' },
  'application/vnd.google-apps.presentation': { mime: 'text/plain', ext: '.txt' },
};

/**
 * Download a file from Drive. Google Workspace files are exported as plain text.
 * Returns { buffer: Buffer, mimeType: string, filename: string }
 */
async function downloadFile(userId, fileId) {
  const drive = await getDriveClient(userId);

  const meta = await drive.files.get({ fileId, fields: 'id, name, mimeType' });
  const { name, mimeType } = meta.data;

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

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' },
  );
  return { buffer: Buffer.from(response.data), mimeType, filename: name };
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
 * Caches the folderId on the user document. Returns the folder ID.
 */
async function ensureOutputFolder(userId, drive) {
  const user = await findUser({ _id: userId }, 'googleDriveFolderId');

  if (user.googleDriveFolderId) {
    try {
      await drive.files.get({ fileId: user.googleDriveFolderId, fields: 'id' });
      return user.googleDriveFolderId;
    } catch {
      // Folder was deleted — fall through to recreate
    }
  }

  const folderName = process.env.GOOGLE_DRIVE_FOLDER_NAME || 'EnableNext Outputs';
  const folder = await drive.files.create({
    requestBody: { name: folderName, mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id',
  });

  const folderId = folder.data.id;
  await updateUser(userId.toString(), { googleDriveFolderId: folderId });
  return folderId;
}

/**
 * Upload a file buffer to the user's Drive output folder, converting to Google Workspace format.
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

  const stream = Readable.from(buffer);

  const response = await drive.files.create({
    requestBody: { name: filename, mimeType: targetMime, parents: [folderId] },
    media: { mimeType: sourceMime, body: stream },
    fields: 'id, webViewLink',
  });

  return response.data;
}

module.exports = { listFiles, downloadFile, uploadFile };
