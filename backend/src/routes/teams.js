const express = require('express');
const { body } = require('express-validator');
const Team = require('../models/Team');
const { protect, adminOnly } = require('../middleware/auth');
const { rotateApiKey } = require('../services/apiKeyService');
const validate = require('../middleware/validate');

const router = express.Router();

// GET /api/teams — list all teams (public)
router.get('/', async (req, res, next) => {
    try {
        const teams = await Team.find({ isActive: true }).select('name stats createdAt');
        res.json({ success: true, count: teams.length, data: teams });
    } catch (err) {
        next(err);
    }
});

// GET /api/teams/:id — public profile
router.get('/:id', async (req, res, next) => {
    try {
        const team = await Team.findById(req.params.id).select('name stats createdAt');
        if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
        res.json({ success: true, data: team });
    } catch (err) {
        next(err);
    }
});

// PUT /api/teams/me — update own profile (JWT)
router.put(
    '/me',
    protect,
    [body('name').optional().trim().notEmpty().withMessage('Name cannot be empty')],
    validate,
    async (req, res, next) => {
        try {
            const { name } = req.body;
            const updates = {};
            if (name) updates.name = name;

            const team = await Team.findByIdAndUpdate(req.team._id, updates, { new: true, runValidators: true });
            res.json({ success: true, data: team });
        } catch (err) {
            next(err);
        }
    }
);

// POST /api/teams/me/rotate-api-key — regenerate API key (JWT)
router.post('/me/rotate-api-key', protect, async (req, res, next) => {
    try {
        const newKey = await rotateApiKey(req.team._id);
        res.json({ success: true, message: 'API key rotated successfully', data: { apiKey: newKey } });
    } catch (err) {
        next(err);
    }
});

// GET /api/teams/me/api-key — retrieve own API key (JWT)
router.get('/me/api-key', protect, async (req, res, next) => {
    try {
        const team = await Team.findById(req.team._id).select('+apiKey');
        res.json({ success: true, data: { apiKey: team.apiKey } });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
