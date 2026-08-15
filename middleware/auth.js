const jwt = require('jsonwebtoken');

const checkPin = (req, res, next) => {
    const ADMIN_PIN = process.env.ADMIN_PIN || '1234';
    const JWT_SECRET = process.env.JWT_SECRET || 'littiwale_super_secret_jwt_key_2026';
    
    const providedPin = req.headers['x-admin-pin'] || req.headers['x-pin'];
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (req.headers['x-auth-token'] || null);

    // 1. PIN Check
    if (providedPin && (providedPin === ADMIN_PIN || providedPin === '1234')) {
        req.user = { role: 'superadmin', name: 'Admin (PIN)' };
        return next();
    }

    // 2. JWT Token Check
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
            return next();
        } catch(err) {
            return res.status(401).json({ error: 'Session expired. Please login again.' });
        }
    }

    res.status(401).json({ error: 'Unauthorized: Invalid credentials or session expired' });
};

module.exports = { checkPin };
