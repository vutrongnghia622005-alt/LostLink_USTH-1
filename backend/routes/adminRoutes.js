const express = require('express');
const adminController = require('../controllers/adminController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth, requireAdmin);
router.get('/dashboard', adminController.getDashboard);
router.get('/posts', adminController.getPosts);
router.patch('/posts/:id/status', adminController.updatePostStatus);

module.exports = router;
