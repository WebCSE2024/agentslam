const express = require('express');
const { body } = require('express-validator');
const jwt = require('jsonwebtoken');
const Team = require('../models/Team');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const signToken = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// POST /api/auth/register
router.post(
    '/register',
    [
        body('name').trim().notEmpty().withMessage('Team name is required'),
        body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    ],
    validate,
    async (req, res, next) => {
        try {
            const { name, email, password } = req.body;
            const team = new Team({ name, email, passwordHash: password });
            await team.save();

            // Fetch the saved team to get apiKey
            const savedTeam = await Team.findById(team._id).select('+apiKey');

            res.status(201).json({
                success: true,
                message: 'Team registered successfully',
                data: {
                    _id: savedTeam._id,
                    name: savedTeam.name,
                    email: savedTeam.email,
                    apiKey: savedTeam.apiKey,
                    isAdmin: savedTeam.isAdmin,
                    stats: savedTeam.stats,
                    token: signToken(savedTeam._id),
                },
            });
        } catch (err) {
            next(err);
        }
    }
);

// POST /api/auth/login
router.post(
    '/login',
    [
        body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
        body('password').notEmpty().withMessage('Password is required'),
    ],
    validate,
    async (req, res, next) => {
        try {
            const { email, password } = req.body;
            const team = await Team.findOne({ email }).select('+passwordHash');
            if (!team || !(await team.comparePassword(password))) {
                return res.status(401).json({ success: false, message: 'Invalid email or password' });
            }
            if (!team.isActive) {
                return res.status(403).json({ success: false, message: 'Account is deactivated' });
            }
            res.json({
                success: true,
                data: {
                    _id: team._id,
                    name: team.name,
                    email: team.email,
                    isAdmin: team.isAdmin,
                    stats: team.stats,
                    token: signToken(team._id),
                },
            });
        } catch (err) {
            next(err);
        }
    }
);

// GET /api/auth/me
router.get('/me', protect, (req, res) => {
    res.json({ success: true, data: req.team });
});

module.exports = router;
