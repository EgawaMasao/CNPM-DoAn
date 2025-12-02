// Import setup (must be first so lifecycle hooks run before tests)
import './setupMongo.js';
import { jest } from '@jest/globals';
jest.setTimeout(30000);

// then other imports
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/server.js';
import Restaurant from '../src/models/Restaurant.js';
import FoodItem from '../src/models/FoodItem.js';

// Note: removed local mongoServer, beforeAll, afterAll that used MongoMemoryServer
// setupMongo.js now manages connection/start/stop and cleans between tests

beforeEach(async () => {
  await Restaurant.deleteMany({});
  await FoodItem.deleteMany({});
});

afterEach(async () => {
  await Restaurant.deleteMany({});
  await FoodItem.deleteMany({});
});

test('GET /api/food-items/restaurant/:restaurantId trả về đúng các food items của nhà hàng', async () => {
  // Sử dụng _id giống dữ liệu mẫu bạn cung cấp
  const restaurantId = new mongoose.Types.ObjectId('68e200a4cf3d5d59c085fa17');
  // Tạo nhà hàng theo dữ liệu mẫu
  await Restaurant.create({
    _id: restaurantId,
    name: 'NH1',
    ownerName: 'Nghia',
    location: 'Binh Chanh',
    contactNumber: '12345',
    profilePicture: '/uploads/1759641764355-452841891.png',
    admin: {
      email: 'NH1@gmail.com',
      password: '$2b$10$hIq1Ub9bhi.PSGLSmoNDbOimAnZCV0yt4G4Xub6lkrbPhThgQsmEi'
    },
    availability: true
  });

  // Tạo 2 món ăn theo dữ liệu mẫu (gán _id giống mẫu để dễ debug)
  await FoodItem.create({
    _id: new mongoose.Types.ObjectId('68e2062ccf3d5d59c085fa24'),
    restaurant: restaurantId,
    name: 'tes1',
    description: 'tes1',
    price: 1000a,
    image: '/uploads/1761004777984-992290185.png',
    category: 'FastFood',
    availability: true
  });

  await FoodItem.create({
    _id: new mongoose.Types.ObjectId('68ebd37d9d33cd34787ae7f1'),
    restaurant: restaurantId,
    name: 'test 2',
    description: 'test2',
    price: 1000,
    image: '/uploads/1761004850538-75857323.png',
    category: 'Drinks',
    availability: true
  });

  // Request phải trùng với mount trên app: /api/food-items/restaurant/:id
  const res = await request(app).get(`/api/food-items/restaurant/${restaurantId}`);

  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body).toHaveLength(2);

  const returnedNames = res.body.map(i => i.name).sort();
  expect(returnedNames).toEqual(['tes1', 'test 2'].sort());

  // Kiểm tra mỗi item tham chiếu tới đúng restaurant
  for (const item of res.body) {
    const ref = item.restaurant && item.restaurant._id ? item.restaurant._id : item.restaurant;
    expect(String(ref)).toBe(String(restaurantId));
  }
});