const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
    {
        topic: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Topic',
            required: [true, 'Topic is required'],
        },
        team1: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team',
            required: [true, 'Team 1 is required'],
        },
        team2: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team',
            required: [true, 'Team 2 is required'],
        },
        // Which side each team argues
        team1Role: {
            type: String,
            enum: ['for', 'against'],
            required: true,
        },
        // Derived: team2Role is always the opposite of team1Role
        status: {
            type: String,
            enum: ['scheduled', 'ongoing', 'judging', 'completed', 'cancelled'],
            default: 'scheduled',
        },
        // Which team should submit its turn right now
        currentTurn: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team',
            default: null,
        },
        turnNumber: {
            type: Number,
            default: 0,
        },
        maxTurns: {
            type: Number,
            default: 10,
            min: [2, 'Match must have at least 2 turns'],
            max: [50, 'Match cannot exceed 50 turns'],
        },
        // Seconds each team has to submit a turn
        timePerTurn: {
            type: Number,
            default: 60,
            min: 10,
        },
        // Deadline timestamp for the current turn
        turnDeadline: {
            type: Date,
            default: null,
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
        scheduledAt: {
            type: Date,
            default: null,
        },
        startedAt: {
            type: Date,
            default: null,
        },
        endedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

// Validate: team1 !== team2
// In Mongoose 8+, throw errors directly in pre-hooks instead of calling next(err)
matchSchema.pre('save', function () {
    if (this.team1.toString() === this.team2.toString()) {
        throw new Error('A team cannot debate against itself');
    }
});

// Virtual: team2Role (opposite of team1Role)
matchSchema.virtual('team2Role').get(function () {
    return this.team1Role === 'for' ? 'against' : 'for';
});

matchSchema.set('toJSON', { virtuals: true });
matchSchema.set('toObject', { virtuals: true });

const Match = mongoose.model('Match', matchSchema);
module.exports = Match;
