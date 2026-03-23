import mongoose from "mongoose";

const topicSchema = new mongoose.Schema({

    title:{
        type: String,
        required: true,
        trim: true,
    },
    description:{
        type: String,
        default: "",
    },
    round:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Round",
        required: true,
        index: true,
    },
    weights:{
        type:Number,
        default: 1,
        required: true,
    }
})

export default mongoose.model("Topic", topicSchema);