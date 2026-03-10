import mongoose from "mongoose";
import { ROUND_STATUS } from "../utils/enum";

const roundSchema = new mongoose.Schema(
  {
    roundName: {
      type: String,
      required: true,
      trim: true,
    },
    roundStatus: {
      type: String,
      enum: Object.values(ROUND_STATUS),
      default: ROUND_STATUS.CREATED,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Round", roundSchema);
