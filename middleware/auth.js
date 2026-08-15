const checkPin = (req, res, next) => {
    const ADMIN_PIN = process.env.ADMIN_PIN || '1234';
    const providedPin = req.headers['x-admin-pin'] || req.headers['x-pin'];
    
    if (providedPin === ADMIN_PIN) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized: Invalid PIN' });
    }
};

module.exports = { checkPin };
