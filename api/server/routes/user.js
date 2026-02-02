const express = require('express');
const {
  updateUserPluginsController,
  resendVerificationController,
  getTermsStatusController,
  acceptTermsController,
  verifyEmailController,
  deleteUserController,
  getUserController,
  getOnboardingStatusController,
  updateOnboardingController,
  completeOnboardingController,
} = require('~/server/controllers/UserController');
const {
  getApiUsageController,
  trackApiUsageController,
} = require('~/server/controllers/ApiUsageController');
const {
  verifyEmailLimiter,
  configMiddleware,
  canDeleteAccount,
  requireJwtAuth,
} = require('~/server/middleware');

const settings = require('./settings');

const router = express.Router();

router.use('/settings', settings);
router.get('/', requireJwtAuth, getUserController);
router.get('/terms', requireJwtAuth, getTermsStatusController);
router.post('/terms/accept', requireJwtAuth, acceptTermsController);
router.get('/onboarding', requireJwtAuth, getOnboardingStatusController);
router.post('/onboarding', requireJwtAuth, updateOnboardingController);
router.post('/onboarding/complete', requireJwtAuth, completeOnboardingController);
router.get('/usage', requireJwtAuth, getApiUsageController);
router.post('/usage/track', requireJwtAuth, trackApiUsageController);
router.post('/plugins', requireJwtAuth, updateUserPluginsController);
router.delete('/delete', requireJwtAuth, canDeleteAccount, configMiddleware, deleteUserController);
router.post('/verify', verifyEmailController);
router.post('/verify/resend', verifyEmailLimiter, resendVerificationController);

module.exports = router;


