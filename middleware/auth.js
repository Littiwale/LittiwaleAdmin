const checkPin = (req, res, next) => {
    // For now, PIN is hardcoded. Later can be moved to .env
    const ADMIN_PIN = process.env.ADMIN_PIN || '1234';
    
    // Allow PIN to come from headers
    const providedPin = req.headers['x-admin-pin'];
    
    if (providedPin === ADMIN_PIN) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized: Invalid PIN' });
    }
};

module.exports = { checkPin };
