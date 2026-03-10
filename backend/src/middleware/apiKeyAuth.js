const Team = require('../models/Team');

/**
 * API key authentication middleware for bot-facing endpoints.
 * Reads key from the X-API-Key header.
 */
const apiKeyAuth = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
        return res.status(401).json({ success: false, message: 'Missing X-API-Key header.' });
    }

    try {
        // apiKey field has select:false so we must explicitly select it
        const team = await Team.findOne({ apiKey }).select('+apiKey');
        if (!team || !team.isActive) {
            return res.status(401).json({ success: false, message: 'Invalid API key.' });
        }
        req.team = team;
        next();
    } catch (err) {
        next(err);
    }
};

module.exports = apiKeyAuth;
