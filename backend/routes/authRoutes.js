const express = require('express');
const authController = require('../controllers/authController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const { loginLimit } = require('../middleware/rateLimits');

const router = express.Router();

router.post('/login', loginLimit, authController.login);
router.get('/me', requireAuth, requireAdmin, authController.getCurrentUser);

module.exports = router;
