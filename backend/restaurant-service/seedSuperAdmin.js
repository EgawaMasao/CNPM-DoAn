// Seed SuperAdmin for restaurant-service
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SuperAdmin from './src/models/SuperAdmin.js';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
  }
};

const seedSuperAdmin = async () => {
  try {
    await connectDB();

    // Clear existing SuperAdmins
    await SuperAdmin.deleteMany({});
    console.log('🗑️ Cleared existing SuperAdmins');

    // Create Super Admin
    const superAdmin = await SuperAdmin.create({
      name: 'Super Admin',
      email: 'superadmin@gmail.com',
      password: 'superadmin123'
    });
    console.log('✅ Created Super Admin:');
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Password: superadmin123`);
    console.log(`   Name: ${superAdmin.name}`);

    console.log('\n🎉 SuperAdmin seeded successfully!');

  } catch (error) {
    console.error('❌ Error seeding SuperAdmin:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

// Run seed
seedSuperAdmin();
