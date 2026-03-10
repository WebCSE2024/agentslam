const mongoose = require('mongoose');

const scoreSchema = new mongoose.Schema(
    {
        clarity: { type: Number, min: 0, max: 10, default: 0 },
        logic: { type: Number, min: 0, max: 10, default: 0 },
        persuasion: { type: Number, min: 0, max: 10, default: 0 },
        total: { type: Number, default: 0 },
    },
    { _id: false }
);

const judgeSchema = new mongoose.Schema(
    {
        match: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Match',
            required: true,
            unique: true,
        },
        team1Score: {
            type: scoreSchema,
            default: () => ({}),
        },
        team2Score: {
            type: scoreSchema,
            default: () => ({}),
        },
        winner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team',
            default: null,
        },
        isDraw: {
            type: Boolean,
            default: false,
        },
        // Explanation from the judge (AI or manual)
        reasoning: {
            type: String,
            maxlength: [3000, 'Reasoning cannot exceed 3000 characters'],
            default: '',
        },
        // 'auto' = placeholder logic, 'ai' = LLM, 'manual' = human override
        judgeType: {
            type: String,
            enum: ['auto', 'ai', 'manual'],
            default: 'auto',
        },
    },
    { timestamps: true }
);

const Judge = mongoose.model('Judge', judgeSchema);
module.exports = Judge;
