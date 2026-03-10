const Match = require('../models/Match');
const DebateMessage = require('../models/DebateMessage');
const Judge = require('../models/Judge');
const { updateTeamStats } = require('./matchService');

/**
 * Get the current debate state for a given match.
 */
const getDebateState = async (matchId) => {
    const match = await Match.findById(matchId)
        .populate('topic', 'title description')
        .populate('team1', 'name')
        .populate('team2', 'name')
        .populate('currentTurn', 'name')
        .populate('winner', 'name');

    if (!match) throw Object.assign(new Error('Match not found'), { statusCode: 404 });
    return match;
};

/**
 * Submit a debate turn on behalf of an authenticated bot.
 * Validates it is the team's turn, records the message, advances the turn.
 * Returns { match, message, isMatchOver }.
 */
const submitTurn = async (matchId, team, content) => {
    const match = await Match.findById(matchId).populate('team1 team2');
    if (!match) throw Object.assign(new Error('Match not found'), { statusCode: 404 });

    if (match.status !== 'ongoing') {
        throw Object.assign(new Error(`Match is not ongoing (status: ${match.status})`), { statusCode: 400 });
    }

    // Ensure this team is part of the match
    const teamIdStr = team._id.toString();
    const isTeam1 = match.team1._id.toString() === teamIdStr;
    const isTeam2 = match.team2._id.toString() === teamIdStr;
    if (!isTeam1 && !isTeam2) {
        throw Object.assign(new Error('Your team is not part of this match'), { statusCode: 403 });
    }

    // Ensure it is this team's turn
    if (!match.currentTurn || match.currentTurn.toString() !== teamIdStr) {
        throw Object.assign(new Error('It is not your turn'), { statusCode: 409 });
    }

    // Determine the team's debate role
    const role = isTeam1 ? match.team1Role : (match.team1Role === 'for' ? 'against' : 'for');

    // Record the debate message
    const message = await DebateMessage.create({
        match: match._id,
        team: team._id,
        role,
        content,
        turnNumber: match.turnNumber,
    });

    // Check if this was the last turn
    const isMatchOver = match.turnNumber >= match.maxTurns;

    if (isMatchOver) {
        match.status = 'judging';
        match.currentTurn = null;
        match.turnDeadline = null;
        match.endedAt = new Date();
        await match.save();

        // Auto-judge
        const judgeResult = await autoJudge(match);
        return { match, message, isMatchOver: true, judgeResult };
    }

    // Advance the turn to the other team
    const nextTeam = isTeam1 ? match.team2._id : match.team1._id;
    match.turnNumber += 1;
    match.currentTurn = nextTeam;
    match.turnDeadline = new Date(Date.now() + match.timePerTurn * 1000);
    await match.save();

    return { match, message, isMatchOver: false };
};

/**
 * Placeholder auto-judge: tallies turn counts per team, awards win to the
 * team with higher total content length (proxy for engagement).
 * Replace this function body with a real LLM call when ready.
 */
const autoJudge = async (match) => {
    const messages = await DebateMessage.find({ match: match._id });

    const team1Id = match.team1._id.toString();
    const team2Id = match.team2._id.toString();

    let team1ContentLen = 0;
    let team2ContentLen = 0;

    messages.forEach((msg) => {
        if (msg.team.toString() === team1Id) team1ContentLen += msg.content.length;
        else team2ContentLen += msg.content.length;
    });

    // Simple scoring (0-10) on a 5000-char scale
    const scale = (len) => Math.min(10, Math.round((len / 5000) * 10 * 10) / 10);
    const t1Score = scale(team1ContentLen);
    const t2Score = scale(team2ContentLen);

    const isDraw = t1Score === t2Score;
    const winner = isDraw ? null : (t1Score > t2Score ? match.team1._id : match.team2._id);

    const judgeDoc = await Judge.create({
        match: match._id,
        team1Score: { clarity: t1Score, logic: t1Score, persuasion: t1Score, total: t1Score },
        team2Score: { clarity: t2Score, logic: t2Score, persuasion: t2Score, total: t2Score },
        winner,
        isDraw,
        reasoning: isDraw
            ? 'Both teams contributed equally to the debate.'
            : `Team ${t1Score > t2Score ? '1' : '2'} submitted more content overall. (Placeholder auto-judge — replace with LLM)`,
        judgeType: 'auto',
    });

    // Finalise match
    match.status = 'completed';
    match.winner = winner;
    match.isDraw = isDraw;
    await match.save();

    // Update team stats
    await updateTeamStats(match);

    return judgeDoc;
};

/**
 * Manually override the judge result (admin endpoint).
 */
const manualJudge = async (matchId, { winnerId, isDraw, reasoning, team1Score, team2Score }) => {
    const match = await Match.findById(matchId);
    if (!match) throw Object.assign(new Error('Match not found'), { statusCode: 404 });
    if (!['judging', 'completed'].includes(match.status)) {
        throw Object.assign(new Error('Match must be in judging or completed status'), { statusCode: 400 });
    }

    const existingJudge = await Judge.findOne({ match: matchId });

    const judgeData = {
        match: matchId,
        team1Score: team1Score || { clarity: 0, logic: 0, persuasion: 0, total: 0 },
        team2Score: team2Score || { clarity: 0, logic: 0, persuasion: 0, total: 0 },
        winner: isDraw ? null : winnerId,
        isDraw: isDraw || false,
        reasoning: reasoning || '',
        judgeType: 'manual',
    };

    let judgeDoc;
    if (existingJudge) {
        Object.assign(existingJudge, judgeData);
        judgeDoc = await existingJudge.save();
    } else {
        judgeDoc = await Judge.create(judgeData);
    }

    match.status = 'completed';
    match.winner = isDraw ? null : winnerId;
    match.isDraw = isDraw || false;
    if (!match.endedAt) match.endedAt = new Date();
    await match.save();

    await updateTeamStats(match);

    return judgeDoc;
};

module.exports = { getDebateState, submitTurn, autoJudge, manualJudge };
