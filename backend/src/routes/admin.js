const express = require('express');
const { body } = require('express-validator');
const Team = require('../models/Team');
const Match = require('../models/Match');
const { protect, adminOnly } = require('../middleware/auth');
const { manualJudge } = require('../services/debateService');
const validate = require('../middleware/validate');

const router = express.Router();

// All admin routes require JWT + isAdmin
router.use(protect, adminOnly);

// GET /api/admin/teams — list all teams with full details + api keys
router.get('/teams', async (req, res, next) => {
    try {
        const teams = await Team.find().select('+apiKey');
        res.json({ success: true, count: teams.length, data: teams });
    } catch (err) {
        next(err);
    }
});

// PATCH /api/admin/teams/:id/toggle-active — activate/deactivate a team
router.patch('/teams/:id/toggle-active', async (req, res, next) => {
    try {
        const team = await Team.findById(req.params.id);
        if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
        team.isActive = !team.isActive;
        await team.save({ validateBeforeSave: false });
        res.json({ success: true, message: `Team ${team.isActive ? 'activated' : 'deactivated'}`, data: team });
    } catch (err) {
        next(err);
    }
});

// PATCH /api/admin/teams/:id/make-admin — promote team to admin
router.patch('/teams/:id/make-admin', async (req, res, next) => {
    try {
        const team = await Team.findByIdAndUpdate(req.params.id, { isAdmin: true }, { new: true });
        if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
        res.json({ success: true, message: 'Team promoted to admin', data: team });
    } catch (err) {
        next(err);
    }
});

// POST /api/admin/judge/:matchId — manually set/override judge result
router.post(
    '/judge/:matchId',
    [
        body('isDraw').optional().isBoolean(),
        body('winnerId').optional().isMongoId().withMessage('Invalid winnerId'),
        body('reasoning').optional().isString(),
    ],
    validate,
    async (req, res, next) => {
        try {
            const judge = await manualJudge(req.params.matchId, req.body);
            res.json({ success: true, message: 'Judge result applied', data: judge });
        } catch (err) {
            next(err);
        }
    }
);

// GET /api/admin/stats — overall platform stats
router.get('/stats', async (req, res, next) => {
    try {
        const [totalTeams, totalMatches, matchesByStatus] = await Promise.all([
            Team.countDocuments(),
            Match.countDocuments(),
            Match.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        ]);
        res.json({
            success: true,
            data: {
                totalTeams,
                totalMatches,
                matchesByStatus: Object.fromEntries(matchesByStatus.map((s) => [s._id, s.count])),
            },
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
