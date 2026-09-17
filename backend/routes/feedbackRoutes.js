const express = require('express');
const feedbackController = require('../controllers/feedbackController');
const { optionalAuth, requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const { createLimit, codeLimit } = require('../middleware/rateLimits');

const router = express.Router();

router.post('/', createLimit, optionalAuth, feedbackController.createFeedback);
router.get('/track/:code', codeLimit, feedbackController.trackFeedback);
router.get('/', requireAuth, requireAdmin, feedbackController.getAllFeedback);
router.put('/:id', requireAuth, requireAdmin, feedbackController.updateFeedback);

module.exports = router;
