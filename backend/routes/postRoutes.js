const express = require('express');
const postController = require('../controllers/postController');
const { optionalAuth } = require('../middleware/authMiddleware');
const { codeLimit, createLimit } = require('../middleware/rateLimits');

const router = express.Router();

router.get('/', postController.getPosts);
router.post('/mine', codeLimit, postController.getMyPosts);
router.get('/:id', postController.getPostById);
router.post('/', createLimit, postController.createPost);
router.put('/:id', codeLimit, optionalAuth, postController.updatePost);
router.patch('/:id/status', codeLimit, optionalAuth, postController.updateOwnPostStatus);
router.delete('/:id', codeLimit, optionalAuth, postController.deletePost);

module.exports = router;
