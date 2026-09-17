const { rateLimit } = require('express-rate-limit');

function limiter(limit, windowMs) {
    return rateLimit({
        limit,
        windowMs,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: { message: 'Too many requests. Please try again later.' }
    });
}

module.exports = {
    loginLimit: limiter(10, 15 * 60 * 1000),
    codeLimit: limiter(30, 15 * 60 * 1000),
    createLimit: limiter(10, 60 * 60 * 1000),
    uploadLimit: limiter(20, 60 * 60 * 1000)
};
