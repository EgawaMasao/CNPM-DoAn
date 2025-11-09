// Seed users for auth-service
require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/Admin');
const Customer = require('./models/Customer');
const RestaurantAdmin = require('./models/RestaurantAdmin');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
  }
};

const seedUsers = async () => {
  try {
    await connectDB();

    // Clear existing data
    await Admin.deleteMany({});
    await Customer.deleteMany({});
    await RestaurantAdmin.deleteMany({});
    console.log('🗑️ Cleared existing users');

    // Create Super Admin
    const superAdmin = await Admin.create({
      firstName: 'Super',
      lastName: 'Admin',
      email: 'superadmin@gmail.com',
      phone: '0901234567',
      password: 'superadmin123',
      role: 'super-admin',
      permissions: ['manage-users', 'manage-restaurants', 'manage-orders', 'manage-delivery', 'manage-payments']
    });
    console.log('✅ Created Super Admin:');
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Password: superadmin123`);
    console.log(`   Role: ${superAdmin.role}`);

    // Create Regular Admin
    const admin = await Admin.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@gmail.com',
      phone: '0901234568',
      password: 'admin123',
      role: 'admin',
      permissions: ['manage-users', 'manage-restaurants', 'manage-orders']
    });
    console.log('\n✅ Created Regular Admin:');
    console.log(`   Email: ${admin.email}`);
    console.log(`   Password: admin123`);
    console.log(`   Role: ${admin.role}`);

    // Create Customer
    const customer = await Customer.create({
      firstName: 'Nguyen',
      lastName: 'Van A',
      email: 'customer@gmail.com',
      phone: '0912345678',
      password: 'customer123',
      location: 'Ho Chi Minh City'
    });
    console.log('\n✅ Created Customer:');
    console.log(`   Email: ${customer.email}`);
    console.log(`   Password: customer123`);
    console.log(`   Name: ${customer.firstName} ${customer.lastName}`);

    // Create Restaurant Admin
    const restaurantAdmin = await RestaurantAdmin.create({
      firstName: 'Restaurant',
      lastName: 'Owner',
      email: 'restaurant@gmail.com',
      phone: '0923456789',
      password: 'restaurant123',
      businessLicense: 'BL-2025-001',
      isApproved: true,
      approvedBy: superAdmin._id,
      approvedAt: new Date()
    });
    console.log('\n✅ Created Restaurant Admin:');
    console.log(`   Email: ${restaurantAdmin.email}`);
    console.log(`   Password: restaurant123`);
    console.log(`   Business License: ${restaurantAdmin.businessLicense}`);
    console.log(`   Approved: ${restaurantAdmin.isApproved}`);

    console.log('\n🎉 Seed data created successfully!');
    console.log('\n📋 Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Super Admin  : superadmin@gmail.com / superadmin123');
    console.log('Admin        : admin@gmail.com / admin123');
    console.log('Customer     : customer@gmail.com / customer123');
    console.log('Restaurant   : restaurant@gmail.com / restaurant123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

// Run seed
seedUsers();
