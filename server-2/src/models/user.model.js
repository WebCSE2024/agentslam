import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    role: {
      type: String,
      default: "user",
    },
    status: {
      type: String,
      default: "active",
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
      default: "",
    },
    email: {
      type: String,
      default: "",
      lowercase: true,
    },
    tournamentPoints: {
      type: Number,
      default: 0,
    },
});

export default mongoose.model("User", userSchema);
