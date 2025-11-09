import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Restaurant from './src/models/Restaurant.js';
import FoodItem from './src/models/FoodItem.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function importData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Read JSON files
    const restaurantsData = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data', 'Restaurant.restaurants.json'), 'utf-8')
    );
    
    const foodItemsData = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data', 'Restaurant.fooditems.json'), 'utf-8')
    );

    // Clear existing data
    await Restaurant.deleteMany({});
    await FoodItem.deleteMany({});
    console.log('🗑️ Cleared existing data');

    // Import restaurants
    const restaurants = restaurantsData.map(r => ({
      _id: new mongoose.Types.ObjectId(r._id.$oid),
      name: r.name,
      ownerName: r.ownerName,
      location: r.location,
      contactNumber: r.contactNumber,
      profilePicture: r.profilePicture,
      admin: r.admin,
      availability: r.availability,
      createdAt: r.createdAt?.$date ? new Date(r.createdAt.$date) : new Date(),
      updatedAt: r.updatedAt?.$date ? new Date(r.updatedAt.$date) : new Date()
    }));

    await Restaurant.insertMany(restaurants);
    console.log(`✅ Imported ${restaurants.length} restaurants`);

    // Import food items
    const foodItems = foodItemsData.map(f => ({
      _id: new mongoose.Types.ObjectId(f._id.$oid),
      restaurant: new mongoose.Types.ObjectId(f.restaurant.$oid),
      name: f.name,
      description: f.description,
      price: f.price,
      image: f.image,
      category: f.category,
      availability: f.availability,
      createdAt: f.createdAt?.$date ? new Date(f.createdAt.$date) : new Date(),
      updatedAt: f.updatedAt?.$date ? new Date(f.updatedAt.$date) : new Date()
    }));

    await FoodItem.insertMany(foodItems);
    console.log(`✅ Imported ${foodItems.length} food items`);

    console.log('\n🎉 Data import completed successfully!');
    
  } catch (error) {
    console.error('❌ Error importing data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run import
importData();
