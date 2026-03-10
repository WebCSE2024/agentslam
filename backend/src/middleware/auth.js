const jwt = require('jsonwebtoken');
const Team = require('../models/Team');

/**
 * JWT authentication middleware for the web portal.
 * Reads Bearer token from Authorization header.
 */
const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer ')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authenticated. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.team = await Team.findById(decoded.id).select('-passwordHash');
        if (!req.team || !req.team.isActive) {
            return res.status(401).json({ success: false, message: 'Team not found or deactivated.' });
        }
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }
};

/**
 * Admin-only guard. Must be used AFTER protect.
 */
const adminOnly = (req, res, next) => {
    if (!req.team || !req.team.isAdmin) {
        return res.status(403).json({ success: false, message: 'Admin access required.' });
    }
    next();
};

module.exports = { protect, adminOnly };
