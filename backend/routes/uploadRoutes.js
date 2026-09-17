const express = require('express');
const multer = require('multer');
const uploadController = require('../controllers/uploadController');
const { uploadLimit } = require('../middleware/rateLimits');

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, callback) => callback(null, true)
});

router.post('/', uploadLimit, upload.single('image'), uploadController.uploadImage);

module.exports = router;
