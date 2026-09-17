require('dotenv').config();

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const claimRoutes = require('./routes/claimRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const securityRoutes = require('./routes/securityRoutes');
const adminRoutes = require('./routes/adminRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();
const port = Number(process.env.PORT || 3000);
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 0));

function getAllowedOrigins() {
    return String(process.env.FRONTEND_URLS || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

const allowedOrigins = getAllowedOrigins();

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        callback(new Error('Origin is not allowed by CORS.'));
    }
}));

app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) req.body = {};
    next();
});

app.get('/', (req, res) => {
    res.json({ message: 'LostLink USTH API is running.' });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/security-reports', securityRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/uploads', uploadRoutes);

app.use((req, res) => {
    res.status(404).json({ message: 'Route not found.' });
});

app.use((error, req, res, next) => {
    console.error('Unhandled server error:', error);

    if (error.message === 'Only image files are allowed.') {
        return res.status(400).json({ message: error.message });
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Image must be smaller than 5 MB.' });
    }

    res.status(500).json({ message: 'Internal server error.' });
});

if (require.main === module) {
    app.listen(port, () => console.log(`LostLink API running on port ${port}`));
    require('./controllers/uploadController').startUploadCleanup();
}

module.exports = app;
