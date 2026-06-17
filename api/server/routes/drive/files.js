const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { findUser } = require('~/models');
const { listFiles, downloadFile, uploadFile } = require('~/server/services/DriveService');

const router = express.Router();

/** GET /api/drive/status */
router.get('/status', async (req, res) => {
  try {
    const user = await findUser({ _id: req.user._id }, '+googleRefreshToken');
    res.json({ connected: !!user?.googleRefreshToken });
  } catch {
    res.json({ connected: false });
  }
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

/**
 * GET /api/drive/files/:fileId/content
 * Streams the file as a binary download so the frontend can create a File object
 * and push it through the existing upload pipeline.
 */
router.get('/files/:fileId/content', async (req, res) => {
  try {
    const { buffer, mimeType, filename } = await downloadFile(req.user._id, req.params.fileId);
    res.set('Content-Type', mimeType);
    res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.set('Content-Length', buffer.length);
    res.send(buffer);
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
