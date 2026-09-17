const jwt = require('jsonwebtoken');

function readTokenFromHeader(req) {
    const authHeader = req.headers.authorization || '';

    if (!authHeader.startsWith('Bearer ')) {
        return null;
    }

    return authHeader.slice(7);
}

function requireAuth(req, res, next) {
    const token = readTokenFromHeader(req);

    if (!token) {
        return res.status(401).json({ message: 'You must log in first.' });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = payload;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
}

function optionalAuth(req, res, next) {
    const token = readTokenFromHeader(req);

    if (!token) {
        req.user = null;
        return next();
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        req.user = null;
    }

    next();
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin permission required.' });
    }

    next();
}

module.exports = {
    requireAuth,
    optionalAuth,
    requireAdmin
};
