const express = require('express');
const middleware = require('~/server/middleware');
const filesRouter = require('./files');

const router = express.Router();

router.use(middleware.requireJwtAuth, (req, res, next) => {
  if (req.user?.provider !== 'google') {
    return res.status(403).json({ error: 'Google Drive is only available for Google login users.' });
  }
  next();
});

router.use('/', filesRouter);

module.exports = router;
