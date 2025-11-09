import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/Order';

console.log('Attempting to connect to MongoDB...');
console.log('URI:', MONGODB_URI);

try {
    await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000
    });
    console.log('✅ MongoDB connected successfully!');
    console.log('Connection state:', mongoose.connection.readyState);
    console.log('Database name:', mongoose.connection.db.databaseName);
    
    // Test a simple operation
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    
    await mongoose.connection.close();
    console.log('✅ Connection closed successfully');
    process.exit(0);
} catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
}
