import mongoose from 'mongoose'
import { MATCH_STATUS, TEAM_NAME, TOPIC_TYPE } from '../utils/enum.js'

const matchSchema = new mongoose.Schema({
    opponents: {
        team1: {
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },
            topicType: {
                type: String,
                enum: Object.values(TOPIC_TYPE),
                required: true,
            }
        },
        team2: {
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },
            topicType: {
                type: String,
                enum: Object.values(TOPIC_TYPE),
                required: true,
            }
        }
    },
    topic:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Topic",
        required: true,
    },
    round:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Round",
        required: true,
        index: true,
    },
    matchStatus: {
        type: String,
        enum: Object.values(MATCH_STATUS),
        default: MATCH_STATUS.PENDING,
        required: true,
    },
    scores: {
        team1: { type: Number, default: 0 },
        team2: { type: Number, default: 0 },
    },
    winner:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    conversations: [
        {
            team: {
                type: String,
                enum: Object.values(TEAM_NAME),
                required: true,
            },
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },
            message: {
                type: String,
                required: true,
            },
            timestamp: {
                type: Date,
                default: Date.now,
            }
        }
    ]},
    { timestamps: true }
)

export default mongoose.model("Match", matchSchema)