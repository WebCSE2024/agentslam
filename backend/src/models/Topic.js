const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Topic title is required'],
            trim: true,
            maxlength: [200, 'Title cannot exceed 200 characters'],
        },
        description: {
            type: String,
            trim: true,
            maxlength: [1000, 'Description cannot exceed 1000 characters'],
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team',
            required: true,
        },
        status: {
            type: String,
            enum: ['open', 'closed'],
            default: 'open',
        },
    },
    { timestamps: true }
);

const Topic = mongoose.model('Topic', topicSchema);
module.exports = Topic;
