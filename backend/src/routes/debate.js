const express = require('express');
const { body } = require('express-validator');
const Match = require('../models/Match');
const DebateMessage = require('../models/DebateMessage');
const apiKeyAuth = require('../middleware/apiKeyAuth');
const { getDebateState, submitTurn } = require('../services/debateService');
const validate = require('../middleware/validate');

const router = express.Router();

// All debate bot routes require API key authentication
router.use(apiKeyAuth);

/**
 * GET /api/debate/session
 * Returns the current ongoing/scheduled match for the authenticated bot's team.
 */
router.get('/session', async (req, res, next) => {
    try {
        const teamId = req.team._id;
        const match = await Match.findOne({
            $or: [{ team1: teamId }, { team2: teamId }],
            status: { $in: ['scheduled', 'ongoing'] },
        })
            .populate('topic', 'title description')
            .populate('team1', 'name')
            .populate('team2', 'name')
            .populate('currentTurn', 'name')
            .sort({ createdAt: -1 });

        if (!match) {
            return res.json({ success: true, message: 'No active session found', data: null });
        }

        // Tell the bot its role in this match
        const isTeam1 = match.team1._id.toString() === teamId.toString();
        const myRole = isTeam1 ? match.team1Role : (match.team1Role === 'for' ? 'against' : 'for');
        const isMyTurn = match.currentTurn && match.currentTurn._id.toString() === teamId.toString();

        res.json({
            success: true,
            data: {
                match,
                myRole,
                isMyTurn,
                turnDeadline: match.turnDeadline,
            },
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/debate/session/:matchId/submit
 * Submit a debate argument for the current turn.
 * Body: { content: "your argument text" }
 */
router.post(
    '/session/:matchId/submit',
    [body('content').trim().notEmpty().withMessage('Argument content is required')],
    validate,
    async (req, res, next) => {
        try {
            const { matchId } = req.params;
            const { content } = req.body;

            const result = await submitTurn(matchId, req.team, content);

            // Emit real-time events
            const io = req.app.get('io');
            if (io) {
                if (result.isMatchOver) {
                    io.to(`match:${matchId}`).emit('debate:ended', {
                        matchId,
                        status: 'completed',
                        winner: result.match.winner,
                        isDraw: result.match.isDraw,
                    });
                } else {
                    io.to(`match:${matchId}`).emit('debate:newTurn', {
                        matchId,
                        currentTurn: result.match.currentTurn,
                        turnNumber: result.match.turnNumber,
                        lastMessage: {
                            team: req.team._id,
                            role: result.message.role,
                            content: result.message.content,
                            turnNumber: result.message.turnNumber,
                        },
                    });
                }
            }

            res.json({
                success: true,
                message: result.isMatchOver ? 'Match complete' : 'Turn submitted',
                data: {
                    message: result.message,
                    match: {
                        status: result.match.status,
                        turnNumber: result.match.turnNumber,
                        currentTurn: result.match.currentTurn,
                        turnDeadline: result.match.turnDeadline,
                    },
                    ...(result.isMatchOver && { judge: result.judgeResult }),
                },
            });
        } catch (err) {
            next(err);
        }
    }
);

/**
 * GET /api/debate/session/:matchId/transcript
 * Get the full transcript of a match so far.
 */
router.get('/session/:matchId/transcript', async (req, res, next) => {
    try {
        const { matchId } = req.params;
        const teamId = req.team._id;

        // Ensure the requesting team is part of this match
        const match = await Match.findById(matchId);
        if (!match) return res.status(404).json({ success: false, message: 'Match not found' });

        const isParticipant =
            match.team1.toString() === teamId.toString() ||
            match.team2.toString() === teamId.toString();
        if (!isParticipant) {
            return res.status(403).json({ success: false, message: 'Your team is not part of this match' });
        }

        const transcript = await DebateMessage.find({ match: matchId })
            .populate('team', 'name')
            .sort({ turnNumber: 1 });

        res.json({ success: true, count: transcript.length, data: transcript });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
