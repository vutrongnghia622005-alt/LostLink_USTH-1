// Local development uses the backend on port 3000.
// After deploying the backend, replace the production URL below.
window.LOSTLINK_API_URL = (
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1'
)
    ? 'http://localhost:3000'
    : 'https://lostlink-usth-1.onrender.com';
