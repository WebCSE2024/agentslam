const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const teamSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Team name is required'],
            unique: true,
            trim: true,
            maxlength: [50, 'Team name cannot exceed 50 characters'],
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
        },
        passwordHash: {
            type: String,
            required: true,
            select: false, // never returned in queries by default
        },
        apiKey: {
            type: String,
            unique: true,
            default: () => uuidv4(),
            select: false, // only exposed explicitly
        },
        isAdmin: {
            type: Boolean,
            default: false,
        },
        stats: {
            wins: { type: Number, default: 0 },
            losses: { type: Number, default: 0 },
            draws: { type: Number, default: 0 },
            totalMatches: { type: Number, default: 0 },
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

// Hash password before save
// NOTE: In Mongoose 8+, async pre-hooks are Promise-based — 'next' is not passed.
teamSchema.pre('save', async function () {
    if (!this.isModified('passwordHash')) return;
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
});

// Compare password
teamSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Rotate API key
teamSchema.methods.rotateApiKey = async function () {
    this.apiKey = uuidv4();
    await this.save();
    return this.apiKey;
};

const Team = mongoose.model('Team', teamSchema);
module.exports = Team;
