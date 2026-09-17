const express = require('express');
const securityController = require('../controllers/securityController');
const { optionalAuth, requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const { createLimit, codeLimit } = require('../middleware/rateLimits');

const router = express.Router();

router.post('/', createLimit, optionalAuth, securityController.createSecurityReport);
router.get('/track/:code', codeLimit, securityController.trackSecurityReport);
router.get('/', requireAuth, requireAdmin, securityController.getAllSecurityReports);
router.put('/:id/status', requireAuth, requireAdmin, securityController.updateSecurityReport);

module.exports = router;
