import mongoose from 'mongoose';
import dotenv from 'dotenv';
import FoodItem from './src/models/FoodItem.js';
import Restaurant from './src/models/Restaurant.js';

dotenv.config();

// Sample product data
const sampleFoodItems = [
  {
    name: "Margherita Pizza",
    description: "Classic pizza with tomato sauce, mozzarella cheese, and fresh basil",
    price: 12.99,
    image: "pizza-margherita.jpg",
    category: "Pizza",
    availability: true
  },
  {
    name: "Chicken Burger",
    description: "Grilled chicken breast with lettuce, tomato, and mayo on a brioche bun",
    price: 9.99,
    image: "chicken-burger.jpg", 
    category: "Burgers",
    availability: true
  },
  {
    name: "Caesar Salad",
    description: "Fresh romaine lettuce with parmesan cheese, croutons, and caesar dressing",
    price: 8.99,
    image: "caesar-salad.jpg",
    category: "Salads",
    availability: true
  },
  {
    name: "Spaghetti Carbonara",
    description: "Creamy pasta with eggs, parmesan cheese, pancetta, and black pepper",
    price: 14.99,
    image: "spaghetti-carbonara.jpg",
    category: "Pasta",
    availability: true
  },
  {
    name: "Chocolate Cake",
    description: "Rich chocolate layer cake with chocolate frosting",
    price: 6.99,
    image: "chocolate-cake.jpg",
    category: "Desserts",
    availability: true
  },
  {
    name: "Fish and Chips",
    description: "Beer-battered fish with crispy fries and tartar sauce",
    price: 13.99,
    image: "fish-and-chips.jpg",
    category: "Seafood",
    availability: true
  },
  {
    name: "Vegetable Stir Fry",
    description: "Fresh mixed vegetables stir-fried with soy sauce and ginger",
    price: 10.99,
    image: "vegetable-stir-fry.jpg",
    category: "Vegetarian",
    availability: true
  },
  {
    name: "BBQ Ribs",
    description: "Tender pork ribs with smoky BBQ sauce and coleslaw",
    price: 18.99,
    image: "bbq-ribs.jpg",
    category: "BBQ",
    availability: true
  }
];

async function seedFoodItems() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find the first restaurant (you can modify this to use a specific restaurant ID)
    const restaurant = await Restaurant.findOne();
    
    if (!restaurant) {
      console.log('❌ No restaurant found. Please create a restaurant first.');
      process.exit(1);
    }

    console.log(`🏪 Using restaurant: ${restaurant.name}`);

    // Clear existing food items for this restaurant (optional)
    await FoodItem.deleteMany({ restaurant: restaurant._id });
    console.log('🗑️ Cleared existing food items');

    // Add restaurant ID to each food item
    const foodItemsWithRestaurant = sampleFoodItems.map(item => ({
      ...item,
      restaurant: restaurant._id
    }));

    // Insert the sample data
    const insertedItems = await FoodItem.insertMany(foodItemsWithRestaurant);
    console.log(`✅ Successfully added ${insertedItems.length} food items:`);
    
    insertedItems.forEach(item => {
      console.log(`  - ${item.name} ($${item.price})`);
    });

  } catch (error) {
    console.error('❌ Error seeding data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the seeding function
seedFoodItems();