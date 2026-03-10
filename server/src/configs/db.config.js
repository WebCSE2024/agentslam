import mongoose from "mongoose";

export const connectDB = async () => {
    try {
        const connection = await mongoose.connect(process.env.MONGODB_URI);
        
        console.log(`MongoDB Connected: ${connection.connection.host}`);
        
        connection.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });

        connection.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
        });

        return connection;
    }  catch (error) {
        console.error('Error connecting to MongoDB:', error.message);
        process.exit(1);
    }
}