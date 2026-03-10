const mongoose = require('mongoose');

const debateMessageSchema = new mongoose.Schema(
    {
        match: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Match',
            required: true,
            index: true,
        },
        team: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team',
            required: true,
        },
        role: {
            type: String,
            enum: ['for', 'against'],
            required: true,
        },
        content: {
            type: String,
            required: [true, 'Argument content is required'],
            maxlength: [5000, 'Argument cannot exceed 5000 characters'],
            trim: true,
        },
        turnNumber: {
            type: Number,
            required: true,
        },
        // Whether the team submitted in time or was skipped due to timeout
        isTimeout: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

const DebateMessage = mongoose.model('DebateMessage', debateMessageSchema);
module.exports = DebateMessage;
