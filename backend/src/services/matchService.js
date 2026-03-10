const Match = require('../models/Match');
const Team = require('../models/Team');

/**
 * Create a new scheduled match.
 */
const createMatch = async ({ topicId, team1Id, team2Id, team1Role = 'for', maxTurns = 10, timePerTurn = 60, scheduledAt }) => {
    const match = await Match.create({
        topic: topicId,
        team1: team1Id,
        team2: team2Id,
        team1Role,
        maxTurns,
        timePerTurn,
        scheduledAt: scheduledAt || null,
    });
    return match;
};

/**
 * Start a scheduled match.
 * Sets status to 'ongoing', assigns first turn to the team arguing 'for'.
 */
const startMatch = async (matchId) => {
    const match = await Match.findById(matchId).populate('team1 team2');
    if (!match) throw Object.assign(new Error('Match not found'), { statusCode: 404 });
    if (match.status !== 'scheduled') {
        throw Object.assign(new Error(`Cannot start a match with status '${match.status}'`), { statusCode: 400 });
    }

    // The 'for' team goes first
    const firstTeam = match.team1Role === 'for' ? match.team1 : match.team2;

    match.status = 'ongoing';
    match.startedAt = new Date();
    match.turnNumber = 1;
    match.currentTurn = firstTeam._id;
    match.turnDeadline = new Date(Date.now() + match.timePerTurn * 1000);

    await match.save();
    return match;
};

/**
 * Cancel a match (admin only).
 */
const cancelMatch = async (matchId) => {
    const match = await Match.findById(matchId);
    if (!match) throw Object.assign(new Error('Match not found'), { statusCode: 404 });
    if (['completed', 'cancelled'].includes(match.status)) {
        throw Object.assign(new Error(`Match is already ${match.status}`), { statusCode: 400 });
    }
    match.status = 'cancelled';
    match.endedAt = new Date();
    await match.save();
    return match;
};

/**
 * Update team stats after a match completes.
 */
const updateTeamStats = async (match) => {
    const { team1, team2, winner, isDraw } = match;

    if (isDraw) {
        await Team.findByIdAndUpdate(team1, { $inc: { 'stats.draws': 1, 'stats.totalMatches': 1 } });
        await Team.findByIdAndUpdate(team2, { $inc: { 'stats.draws': 1, 'stats.totalMatches': 1 } });
    } else {
        const loserId = winner.toString() === team1.toString() ? team2 : team1;
        await Team.findByIdAndUpdate(winner, { $inc: { 'stats.wins': 1, 'stats.totalMatches': 1 } });
        await Team.findByIdAndUpdate(loserId, { $inc: { 'stats.losses': 1, 'stats.totalMatches': 1 } });
    }
};

module.exports = { createMatch, startMatch, cancelMatch, updateTeamStats };
