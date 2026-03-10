const express = require('express');
const { body } = require('express-validator');
const Topic = require('../models/Topic');
const { protect, adminOnly } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// GET /api/topics — list open topics
router.get('/', async (req, res, next) => {
    try {
        const filter = req.query.status ? { status: req.query.status } : {};
        const topics = await Topic.find(filter)
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 });
        res.json({ success: true, count: topics.length, data: topics });
    } catch (err) {
        next(err);
    }
});

// GET /api/topics/:id
router.get('/:id', async (req, res, next) => {
    try {
        const topic = await Topic.findById(req.params.id).populate('createdBy', 'name');
        if (!topic) return res.status(404).json({ success: false, message: 'Topic not found' });
        res.json({ success: true, data: topic });
    } catch (err) {
        next(err);
    }
});

// POST /api/topics — admin only
router.post(
    '/',
    protect,
    adminOnly,
    [
        body('title').trim().notEmpty().withMessage('Title is required'),
        body('description').optional().trim(),
    ],
    validate,
    async (req, res, next) => {
        try {
            const { title, description } = req.body;
            const topic = await Topic.create({ title, description, createdBy: req.team._id });
            res.status(201).json({ success: true, data: topic });
        } catch (err) {
            next(err);
        }
    }
);

// PUT /api/topics/:id — admin only
router.put(
    '/:id',
    protect,
    adminOnly,
    [
        body('title').optional().trim().notEmpty(),
        body('status').optional().isIn(['open', 'closed']).withMessage('Status must be open or closed'),
    ],
    validate,
    async (req, res, next) => {
        try {
            const topic = await Topic.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
            if (!topic) return res.status(404).json({ success: false, message: 'Topic not found' });
            res.json({ success: true, data: topic });
        } catch (err) {
            next(err);
        }
    }
);

// DELETE /api/topics/:id — admin only
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
    try {
        const topic = await Topic.findByIdAndDelete(req.params.id);
        if (!topic) return res.status(404).json({ success: false, message: 'Topic not found' });
        res.json({ success: true, message: 'Topic deleted' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
