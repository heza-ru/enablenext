const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { getStrategyFunctions } = require('~/server/services/Files/strategies');
const { getFileStrategy } = require('~/server/utils/getFileStrategy');

const router = express.Router();

/**
 * Standalone, conversation-independent image upload endpoint.
 *
 * Unlike `/files/images/avatar`, this endpoint does not crop the image to a
 * square, does not force a fixed thumbnail size, and does not overwrite a
 * single per-user record. It simply stores whatever image is uploaded (via
 * the app's configured file storage strategy) and returns its URL, so it can
 * be dropped into an `<img src>` (e.g. by the canvas presentation editor's
 * image upload/crop tool).
 *
 * Unlike `/files/images`, it does not require a conversation-scoped
 * `file_id`/`endpoint`/`width`/`height` and does not create a database File
 * record tied to a message attachment.
 */
router.post('/', async (req, res) => {
  const file = req.file;
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!file) {
      return res.status(400).json({ message: 'No file provided' });
    }

    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return res.status(400).json({ message: `Unsupported file type: ${file.mimetype}` });
    }

    if (file.size === 0) {
      return res.status(400).json({ message: 'Empty file uploaded' });
    }

    const userId = req.user.id;
    const appConfig = req.config;
    const buffer = await fs.readFile(file.path);

    const fileStrategy = getFileStrategy(appConfig, { isImage: true });
    const { saveBuffer } = getStrategyFunctions(fileStrategy);

    if (!saveBuffer) {
      throw new Error(`File storage strategy "${fileStrategy}" does not support image uploads`);
    }

    const extension = path.extname(file.originalname || '') || '.png';
    const fileName = `${crypto.randomUUID()}${extension}`;

    const url = await saveBuffer({ userId, buffer, fileName });

    res.json({ url });
  } catch (error) {
    const message = 'An error occurred while uploading the image';
    logger.error(message, error);
    res.status(500).json({ message });
  } finally {
    if (file?.path) {
      try {
        await fs.unlink(file.path);
        logger.debug('[/files/images/deck-asset] Temp. image upload file deleted');
      } catch {
        logger.debug('[/files/images/deck-asset] Temp. image upload file already deleted');
      }
    }
  }
});

module.exports = router;
