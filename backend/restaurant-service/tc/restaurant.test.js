// Import setup (must be first so lifecycle hooks run before tests)
import './setupMongo.js';
import { jest } from '@jest/globals';
jest.setTimeout(30000);

// then other imports
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Restaurant from '../src/models/Restaurant.js';

// Create manual mocks for bcrypt functions
const mockGenSalt = jest.fn();
const mockHash = jest.fn();
const mockCompare = jest.fn();

// Store original bcrypt functions
const originalGenSalt = bcrypt.genSalt;
const originalHash = bcrypt.hash;
const originalCompare = bcrypt.compare;

// Override bcrypt methods with mocks
bcrypt.genSalt = mockGenSalt;
bcrypt.hash = mockHash;
bcrypt.compare = mockCompare;

beforeEach(async () => {
  await Restaurant.deleteMany({});
  mockGenSalt.mockClear();
  mockHash.mockClear();
  mockCompare.mockClear();
});

afterEach(async () => {
  await Restaurant.deleteMany({});
});

afterAll(() => {
  // Restore original functions
  bcrypt.genSalt = originalGenSalt;
  bcrypt.hash = originalHash;
  bcrypt.compare = originalCompare;
});

describe('Restaurant Model - compareAdminPassword()', () => {
  
  test('Test 1: compareAdminPassword() should return true for correct password (happy path)', async () => {
    // GIVEN: A restaurant with a hashed password
    const plainPassword = 'SecurePass123!';
    const hashedPassword = '$2b$10$mockHashedPassword';
    
    const restaurant = new Restaurant({
      name: 'Test Restaurant',
      ownerName: 'John Doe',
      location: '123 Main St',
      contactNumber: '1234567890',
      admin: {
        email: 'test@restaurant.com',
        password: hashedPassword
      }
    });
    
    // Mock bcrypt.compare to return true for correct password
    mockCompare.mockResolvedValue(true);
    
    // WHEN: Comparing with the correct password
    const result = await restaurant.compareAdminPassword(plainPassword);
    
    // THEN: Should return true
    expect(result).toBe(true);
    expect(mockCompare).toHaveBeenCalledWith(plainPassword, hashedPassword);
  });

  test('Test 2: compareAdminPassword() should return false for incorrect password (error path)', async () => {
    // GIVEN: A restaurant with a hashed password
    const correctPassword = 'SecurePass123!';
    const incorrectPassword = 'WrongPassword456';
    const hashedPassword = '$2b$10$mockHashedPassword';
    
    const restaurant = new Restaurant({
      name: 'Test Restaurant',
      ownerName: 'John Doe',
      location: '123 Main St',
      contactNumber: '1234567890',
      admin: {
        email: 'test@restaurant.com',
        password: hashedPassword
      }
    });
    
    // Mock bcrypt.compare to return false for incorrect password
    mockCompare.mockResolvedValue(false);
    
    // WHEN: Comparing with an incorrect password
    const result = await restaurant.compareAdminPassword(incorrectPassword);
    
    // THEN: Should return false (security critical)
    expect(result).toBe(false);
    expect(mockCompare).toHaveBeenCalledWith(incorrectPassword, hashedPassword);
  });

  test('Test 5: compareAdminPassword() should handle null/undefined password input safely (error path)', async () => {
    // GIVEN: A restaurant with a valid hashed password
    const hashedPassword = '$2b$10$mockHashedPassword';
    
    const restaurant = new Restaurant({
      name: 'Test Restaurant',
      ownerName: 'John Doe',
      location: '123 Main St',
      contactNumber: '1234567890',
      admin: {
        email: 'test@restaurant.com',
        password: hashedPassword
      }
    });
    
    // Mock bcrypt.compare to return false for null/undefined
    mockCompare.mockResolvedValue(false);
    
    // WHEN: Comparing with null password
    const resultNull = await restaurant.compareAdminPassword(null);
    
    // THEN: Should return false and not crash
    expect(resultNull).toBe(false);
    expect(mockCompare).toHaveBeenCalledWith(null, hashedPassword);
    
    // WHEN: Comparing with undefined password
    const resultUndefined = await restaurant.compareAdminPassword(undefined);
    
    // THEN: Should return false and not crash
    expect(resultUndefined).toBe(false);
    expect(mockCompare).toHaveBeenCalledWith(undefined, hashedPassword);
  });

  test('Test 7: compareAdminPassword() should handle empty string password safely (edge case)', async () => {
    // GIVEN: A restaurant with a valid hashed password
    const hashedPassword = '$2b$10$mockHashedPassword';
    
    const restaurant = new Restaurant({
      name: 'Test Restaurant',
      ownerName: 'John Doe',
      location: '123 Main St',
      contactNumber: '1234567890',
      admin: {
        email: 'test@restaurant.com',
        password: hashedPassword
      }
    });
    
    // Mock bcrypt.compare to return false for empty string
    mockCompare.mockResolvedValue(false);
    
    // WHEN: Comparing with empty string password
    const result = await restaurant.compareAdminPassword('');
    
    // THEN: Should return false and handle safely
    expect(result).toBe(false);
    expect(mockCompare).toHaveBeenCalledWith('', hashedPassword);
  });
});

describe('Restaurant Model - pre(save) hook', () => {
  
  test('Test 3: pre(save) hook should hash password on new restaurant creation (happy path)', async () => {
    // GIVEN: A new restaurant with plain text password
    const plainPassword = 'MySecurePassword123!';
    const hashedPassword = '$2b$10$hashedPasswordExample';
    
    // Mock bcrypt functions
    mockGenSalt.mockResolvedValue('mockSalt');
    mockHash.mockResolvedValue(hashedPassword);
    
    const restaurant = new Restaurant({
      name: 'New Restaurant',
      ownerName: 'Jane Smith',
      location: '456 Oak Ave',
      contactNumber: '9876543210',
      admin: {
        email: 'newrestaurant@example.com',
        password: plainPassword
      }
    });
    
    // WHEN: Saving the restaurant (triggers pre-save hook)
    await restaurant.save();
    
    // THEN: Password should be hashed
    expect(mockGenSalt).toHaveBeenCalledWith(10);
    expect(mockHash).toHaveBeenCalledWith(plainPassword, 'mockSalt');
    expect(restaurant.admin.password).toBe(hashedPassword);
    expect(restaurant.admin.password).not.toBe(plainPassword);
  });

  test('Test 4: pre(save) hook should NOT rehash password when admin.password is unchanged (edge case)', async () => {
    // GIVEN: An existing restaurant already saved with hashed password
    const plainPassword = 'InitialPassword123!';
    const hashedPassword = '$2b$10$existingHashedPassword';
    
    // Mock for initial save
    mockGenSalt.mockResolvedValue('mockSalt');
    mockHash.mockResolvedValue(hashedPassword);
    
    const restaurant = new Restaurant({
      name: 'Existing Restaurant',
      ownerName: 'Bob Johnson',
      location: '789 Pine St',
      contactNumber: '5555555555',
      admin: {
        email: 'existing@example.com',
        password: plainPassword
      }
    });
    
    await restaurant.save();
    
    // Clear mock calls from initial save
    mockGenSalt.mockClear();
    mockHash.mockClear();
    
    // WHEN: Updating restaurant but NOT modifying password
    restaurant.name = 'Updated Restaurant Name';
    await restaurant.save();
    
    // THEN: Password should NOT be rehashed
    expect(mockGenSalt).not.toHaveBeenCalled();
    expect(mockHash).not.toHaveBeenCalled();
    expect(restaurant.admin.password).toBe(hashedPassword);
  });

  test('Test 6: pre(save) hook should handle bcrypt failure during hash generation (error path)', async () => {
    // GIVEN: A new restaurant and bcrypt will fail
    const plainPassword = 'PasswordToFail';
    const bcryptError = new Error('Bcrypt hashing failed');
    
    // Mock bcrypt to throw error
    mockGenSalt.mockResolvedValue('mockSalt');
    mockHash.mockRejectedValue(bcryptError);
    
    const restaurant = new Restaurant({
      name: 'Restaurant Fail',
      ownerName: 'Error Owner',
      location: '999 Error Ln',
      contactNumber: '0000000000',
      admin: {
        email: 'error@example.com',
        password: plainPassword
      }
    });
    
    // WHEN: Attempting to save (triggers pre-save hook with failing bcrypt)
    // THEN: Should propagate the error
    await expect(restaurant.save()).rejects.toThrow('Bcrypt hashing failed');
    
    // Verify bcrypt was called
    expect(mockGenSalt).toHaveBeenCalledWith(10);
    expect(mockHash).toHaveBeenCalledWith(plainPassword, 'mockSalt');
  });

  test('Test 8: pre(save) hook should only hash once per actual password change on multiple saves (edge case)', async () => {
    // GIVEN: A new restaurant
    const plainPassword = 'FirstPassword123!';
    const hashedPassword1 = '$2b$10$firstHashedPassword';
    const newPlainPassword = 'SecondPassword456!';
    const hashedPassword2 = '$2b$10$secondHashedPassword';
    
    // Mock for first save
    mockGenSalt.mockResolvedValue('mockSalt1');
    mockHash.mockResolvedValue(hashedPassword1);
    
    const restaurant = new Restaurant({
      name: 'Multi Save Restaurant',
      ownerName: 'Multi Owner',
      location: '111 Multi St',
      contactNumber: '1111111111',
      admin: {
        email: 'multisave@example.com',
        password: plainPassword
      }
    });
    
    // WHEN: First save
    await restaurant.save();
    
    // THEN: Password should be hashed once
    expect(mockHash).toHaveBeenCalledTimes(1);
    expect(restaurant.admin.password).toBe(hashedPassword1);
    
    mockGenSalt.mockClear();
    mockHash.mockClear();
    
    // WHEN: Second save without password modification
    restaurant.location = 'Updated Location';
    await restaurant.save();
    
    // THEN: Password should NOT be rehashed
    expect(mockHash).not.toHaveBeenCalled();
    expect(restaurant.admin.password).toBe(hashedPassword1);
    
    mockGenSalt.mockClear();
    mockHash.mockClear();
    
    // WHEN: Third save WITH password modification
    mockGenSalt.mockResolvedValue('mockSalt2');
    mockHash.mockResolvedValue(hashedPassword2);
    
    restaurant.admin.password = newPlainPassword;
    restaurant.markModified('admin.password');
    await restaurant.save();
    
    // THEN: Password should be hashed again (only once for this change)
    expect(mockGenSalt).toHaveBeenCalledWith(10);
    expect(mockHash).toHaveBeenCalledTimes(1);
    expect(mockHash).toHaveBeenCalledWith(newPlainPassword, 'mockSalt2');
    expect(restaurant.admin.password).toBe(hashedPassword2);
  });
});
