const express = require('express');
const { body, query } = require('express-validator');
const Match = require('../models/Match');
const DebateMessage = require('../models/DebateMessage');
const Judge = require('../models/Judge');
const { protect, adminOnly } = require('../middleware/auth');
const { createMatch, startMatch, cancelMatch } = require('../services/matchService');
const validate = require('../middleware/validate');

const router = express.Router();

// GET /api/matches — list matches with optional filters
router.get('/', async (req, res, next) => {
    try {
        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        if (req.query.teamId) {
            filter.$or = [{ team1: req.query.teamId }, { team2: req.query.teamId }];
        }
        const matches = await Match.find(filter)
            .populate('topic', 'title')
            .populate('team1', 'name')
            .populate('team2', 'name')
            .populate('currentTurn', 'name')
            .populate('winner', 'name')
            .sort({ createdAt: -1 });
        res.json({ success: true, count: matches.length, data: matches });
    } catch (err) {
        next(err);
    }
});

// GET /api/matches/:id — single match with transcript & judge
router.get('/:id', async (req, res, next) => {
    try {
        const match = await Match.findById(req.params.id)
            .populate('topic', 'title description')
            .populate('team1', 'name')
            .populate('team2', 'name')
            .populate('currentTurn', 'name')
            .populate('winner', 'name');
        if (!match) return res.status(404).json({ success: false, message: 'Match not found' });

        const transcript = await DebateMessage.find({ match: match._id })
            .populate('team', 'name')
            .sort({ turnNumber: 1 });

        const judgeResult = await Judge.findOne({ match: match._id }).populate('winner', 'name');

        res.json({ success: true, data: { match, transcript, judge: judgeResult } });
    } catch (err) {
        next(err);
    }
});

// GET /api/matches/:id/state — lightweight state for bots
router.get('/:id/state', async (req, res, next) => {
    try {
        const match = await Match.findById(req.params.id)
            .populate('topic', 'title description')
            .populate('team1', 'name')
            .populate('team2', 'name')
            .populate('currentTurn', 'name');
        if (!match) return res.status(404).json({ success: false, message: 'Match not found' });
        res.json({ success: true, data: match });
    } catch (err) {
        next(err);
    }
});

// POST /api/matches — admin creates a match
router.post(
    '/',
    protect,
    adminOnly,
    [
        body('topicId').notEmpty().withMessage('topicId is required'),
        body('team1Id').notEmpty().withMessage('team1Id is required'),
        body('team2Id').notEmpty().withMessage('team2Id is required'),
        body('team1Role').optional().isIn(['for', 'against']).withMessage('team1Role must be for or against'),
        body('maxTurns').optional().isInt({ min: 2, max: 50 }),
        body('timePerTurn').optional().isInt({ min: 10 }),
    ],
    validate,
    async (req, res, next) => {
        try {
            const match = await createMatch(req.body);
            const populated = await Match.findById(match._id)
                .populate('topic', 'title')
                .populate('team1', 'name')
                .populate('team2', 'name');
            res.status(201).json({ success: true, data: populated });
        } catch (err) {
            next(err);
        }
    }
);

// POST /api/matches/:id/start — admin starts a scheduled match
router.post('/:id/start', protect, adminOnly, async (req, res, next) => {
    try {
        const match = await startMatch(req.params.id);
        // emit via socket if io is available
        const io = req.app.get('io');
        if (io) {
            io.to(`match:${match._id}`).emit('debate:started', { matchId: match._id, currentTurn: match.currentTurn });
        }
        res.json({ success: true, message: 'Match started', data: match });
    } catch (err) {
        next(err);
    }
});

// POST /api/matches/:id/cancel — admin cancels a match
router.post('/:id/cancel', protect, adminOnly, async (req, res, next) => {
    try {
        const match = await cancelMatch(req.params.id);
        const io = req.app.get('io');
        if (io) {
            io.to(`match:${match._id}`).emit('debate:ended', { matchId: match._id, status: 'cancelled' });
        }
        res.json({ success: true, message: 'Match cancelled', data: match });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
