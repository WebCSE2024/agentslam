const { v4: uuidv4 } = require('uuid');
const Team = require('../models/Team');

/**
 * Generate a fresh UUID v4 API key and persist it to the team document.
 * Returns the new plain-text key.
 */
const rotateApiKey = async (teamId) => {
    const team = await Team.findById(teamId).select('+apiKey');
    if (!team) throw Object.assign(new Error('Team not found'), { statusCode: 404 });
    team.apiKey = uuidv4();
    await team.save({ validateBeforeSave: false });
    return team.apiKey;
};

module.exports = { rotateApiKey };
