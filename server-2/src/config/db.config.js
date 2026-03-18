import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const connection = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB connected: ${connection.connection.host}`);

    connection.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err.message);
    });

    connection.connection.on("disconnected", () => {
      console.log("MongoDB disconnected");
    });

    return connection;
  } catch (error) {
    console.error("Failed to connect MongoDB:", error.message);
    process.exit(1);
  }
};