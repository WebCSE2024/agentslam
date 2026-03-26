const express = require('express');
const { body } = require('express-validator');
const Match = require('../models/Match');
const DebateMessage = require('../models/DebateMessage');
const apiKeyAuth = require('../middleware/apiKeyAuth');
const { submitTurn } = require('../services/debateService');
const validate = require('../middleware/validate');

const router = express.Router();

// All debate bot routes require API key authentication
router.use(apiKeyAuth);

/**
 * GET /api/debate/session
 * Returns only what the bot needs to know right now:
 * the topic, its assigned role, whether it's its turn, and the deadline.
 */
router.get('/session', async (req, res, next) => {
    try {
        const teamId = req.team._id;
        const match = await Match.findOne({
            $or: [{ team1: teamId }, { team2: teamId }],
            status: { $in: ['scheduled', 'ongoing'] },
        })
            .populate('topic', 'title description')
            .sort({ createdAt: -1 });

        if (!match) {
            return res.json({ active: false });
        }

        const isTeam1 = match.team1.toString() === teamId.toString();
        const myRole = isTeam1 ? match.team1Role : (match.team1Role === 'for' ? 'against' : 'for');
        const isMyTurn = match.status === 'ongoing' &&
            match.currentTurn &&
            match.currentTurn.toString() === teamId.toString();

        res.json({
            active: true,
            matchId: match._id,
            status: match.status,
            topic: {
                title: match.topic.title,
                description: match.topic.description || '',
            },
            myRole,        // "for" or "against"
            isMyTurn,
            turnNumber: match.turnNumber,
            maxTurns: match.maxTurns,
            turnDeadline: match.turnDeadline,  // null if match not started yet
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/debate/session/:matchId/submit
 * Body: { "argument": "your rebuttal or point here" }
 *
 * The server timestamps the submission itself — bots do NOT send a timestamp.
 * Returns minimal acknowledgement.
 */
router.post(
    '/session/:matchId/submit',
    [body('argument').trim().notEmpty().withMessage('argument is required')],
    validate,
    async (req, res, next) => {
        try {
            const { matchId } = req.params;
            const { argument } = req.body;

            const result = await submitTurn(matchId, req.team, argument);

            // Emit real-time events to web observers
            const io = req.app.get('io');
            if (io) {
                if (result.isMatchOver) {
                    io.to(`match:${matchId}`).emit('debate:ended', {
                        matchId,
                        winner: result.match.winner,
                        isDraw: result.match.isDraw,
                    });
                } else {
                    io.to(`match:${matchId}`).emit('debate:newTurn', {
                        matchId,
                        turnNumber: result.match.turnNumber,
                        currentTurn: result.match.currentTurn,
                    });
                }
            }

            if (result.isMatchOver) {
                return res.json({
                    accepted: true,
                    matchOver: true,
                    winner: result.match.winner,
                    isDraw: result.match.isDraw,
                });
            }

            res.json({
                accepted: true,
                matchOver: false,
                turnNumber: result.match.turnNumber,   // next turn number
                nextTurn: result.match.currentTurn,    // ID of team whose turn is next
                turnDeadline: result.match.turnDeadline,
            });
        } catch (err) {
            next(err);
        }
    }
);

/**
 * GET /api/debate/session/:matchId/transcript
 * Returns only: role, argument text, and server-recorded time for each turn.
 */
router.get('/session/:matchId/transcript', async (req, res, next) => {
    try {
        const { matchId } = req.params;
        const teamId = req.team._id;

        const match = await Match.findById(matchId).select('team1 team2');
        if (!match) return res.status(404).json({ error: 'Match not found' });

        const isParticipant =
            match.team1.toString() === teamId.toString() ||
            match.team2.toString() === teamId.toString();
        if (!isParticipant) {
            return res.status(403).json({ error: 'Your team is not part of this match' });
        }

        const transcript = await DebateMessage.find({ match: matchId })
            .select('role content createdAt turnNumber -_id')
            .sort({ turnNumber: 1 });

        // Return flat array — only role, argument, server timestamp, turn number
        res.json(transcript.map(m => ({
            turn: m.turnNumber,
            role: m.role,
            argument: m.content,
            receivedAt: m.createdAt,   // set by server, never by the bot
        })));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
