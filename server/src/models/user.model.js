import mongoose from "mongoose";
import { USER_ROLE, USER_STATUS } from "../utils/enum";

const userSchema = new mongoose.Schema({
    role: {
      type: String,
      enum: Object.values(USER_ROLE),
      default: USER_ROLE.USER,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
      required: true,
      index: true,
    },
    name: {
      type: String,
      default: "",
    },
    admissionNumber: {
      type: String,
      default: "",
      index: true,
      unique: true,
      sparse: true,
    },
    password: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    tournamentPoints: {
      type: Number,
      default: 0,
    },
});

export default mongoose.model("User", userSchema);
