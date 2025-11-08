// Import setup (must be first so lifecycle hooks run before tests)
import './setupMongo.js';
import { jest } from '@jest/globals';
jest.setTimeout(30000);

// then other imports
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import SuperAdmin from '../src/models/SuperAdmin.js';

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
  await SuperAdmin.deleteMany({});
  mockGenSalt.mockClear();
  mockHash.mockClear();
  mockCompare.mockClear();
});

afterEach(async () => {
  await SuperAdmin.deleteMany({});
});

afterAll(() => {
  // Restore original functions
  bcrypt.genSalt = originalGenSalt;
  bcrypt.hash = originalHash;
  bcrypt.compare = originalCompare;
});

describe('SuperAdmin Model - comparePassword()', () => {
  
  test('Test 1: comparePassword() should return true for correct password (happy path)', async () => {
    // GIVEN: A super admin with a hashed password
    const plainPassword = 'SecurePass123!';
    const hashedPassword = '$2b$10$mockHashedPassword';
    
    const superAdmin = new SuperAdmin({
      name: 'Admin User',
      email: 'admin@example.com',
      password: hashedPassword
    });
    
    // Mock bcrypt.compare to return true for correct password
    mockCompare.mockResolvedValue(true);
    
    // WHEN: Comparing with the correct password
    const result = await superAdmin.comparePassword(plainPassword);
    
    // THEN: Should return true (core authentication functionality verified)
    expect(result).toBe(true);
    expect(mockCompare).toHaveBeenCalledWith(plainPassword, hashedPassword);
  });

  test('Test 2: comparePassword() should return false for incorrect password (happy path - security validation)', async () => {
    // GIVEN: A super admin with a hashed password
    const correctPassword = 'SecurePass123!';
    const incorrectPassword = 'WrongPassword456';
    const hashedPassword = '$2b$10$mockHashedPassword';
    
    const superAdmin = new SuperAdmin({
      name: 'Admin User',
      email: 'admin@example.com',
      password: hashedPassword
    });
    
    // Mock bcrypt.compare to return false for incorrect password
    mockCompare.mockResolvedValue(false);
    
    // WHEN: Comparing with an incorrect password
    const result = await superAdmin.comparePassword(incorrectPassword);
    
    // THEN: Should return false (security critical - reject invalid credentials)
    expect(result).toBe(false);
    expect(mockCompare).toHaveBeenCalledWith(incorrectPassword, hashedPassword);
  });

  test('Test 7: comparePassword() should handle null/undefined password input safely (error path - null_pointer_risk #1)', async () => {
    // GIVEN: A super admin with a valid hashed password
    const hashedPassword = '$2b$10$mockHashedPassword';
    
    const superAdmin = new SuperAdmin({
      name: 'Admin User',
      email: 'admin@example.com',
      password: hashedPassword
    });
    
    // Mock bcrypt.compare to return false for null/undefined
    mockCompare.mockResolvedValue(false);
    
    // WHEN: Comparing with null password
    const resultNull = await superAdmin.comparePassword(null);
    
    // THEN: Should return false and not crash (null pointer risk mitigated)
    expect(resultNull).toBe(false);
    expect(mockCompare).toHaveBeenCalledWith(null, hashedPassword);
    
    mockCompare.mockClear();
    
    // WHEN: Comparing with undefined password
    const resultUndefined = await superAdmin.comparePassword(undefined);
    
    // THEN: Should return false and not crash (null pointer risk mitigated)
    expect(resultUndefined).toBe(false);
    expect(mockCompare).toHaveBeenCalledWith(undefined, hashedPassword);
  });

  test('Test 8: comparePassword() should handle null/corrupted stored password hash (error path - null_pointer_risk #2)', async () => {
    // GIVEN: A super admin with null/corrupted stored password
    const inputPassword = 'SomePassword123';
    
    const superAdmin = new SuperAdmin({
      name: 'Admin User',
      email: 'admin@example.com',
      password: null // Simulating corrupted/null hash
    });
    
    // Mock bcrypt.compare to handle null stored hash
    mockCompare.mockResolvedValue(false);
    
    // WHEN: Comparing password against null stored hash
    const result = await superAdmin.comparePassword(inputPassword);
    
    // THEN: Should return false and not crash (null pointer risk mitigated)
    expect(result).toBe(false);
    expect(mockCompare).toHaveBeenCalledWith(inputPassword, null);
  });
});

describe('SuperAdmin Model - pre(save) hook', () => {
  
  test('Test 3: pre(save) hook should hash password on new super admin creation (happy path - critical security)', async () => {
    // GIVEN: A new super admin with plain text password
    const plainPassword = 'MySecurePassword123!';
    const hashedPassword = '$2b$10$hashedPasswordExample';
    
    // Mock bcrypt functions
    mockGenSalt.mockResolvedValue('mockSalt');
    mockHash.mockResolvedValue(hashedPassword);
    
    const superAdmin = new SuperAdmin({
      name: 'New Admin',
      email: 'newadmin@example.com',
      password: plainPassword
    });
    
    // WHEN: Saving the super admin (triggers pre-save hook)
    await superAdmin.save();
    
    // THEN: Password should be hashed (security critical - never store plain text)
    expect(mockGenSalt).toHaveBeenCalledWith(10);
    expect(mockHash).toHaveBeenCalledWith(plainPassword, 'mockSalt');
    expect(superAdmin.password).toBe(hashedPassword);
    expect(superAdmin.password).not.toBe(plainPassword);
  });

  test('Test 4: pre(save) hook should NOT rehash password when password is unchanged (edge case)', async () => {
    // GIVEN: An existing super admin already saved with hashed password
    const plainPassword = 'InitialPassword123!';
    const hashedPassword = '$2b$10$existingHashedPassword';
    
    // Mock for initial save
    mockGenSalt.mockResolvedValue('mockSalt');
    mockHash.mockResolvedValue(hashedPassword);
    
    const superAdmin = new SuperAdmin({
      name: 'Existing Admin',
      email: 'existing@example.com',
      password: plainPassword
    });
    
    await superAdmin.save();
    
    // Clear mock calls from initial save
    mockGenSalt.mockClear();
    mockHash.mockClear();
    
    // WHEN: Updating super admin but NOT modifying password
    superAdmin.name = 'Updated Admin Name';
    await superAdmin.save();
    
    // THEN: Password should NOT be rehashed (efficiency & correctness)
    expect(mockGenSalt).not.toHaveBeenCalled();
    expect(mockHash).not.toHaveBeenCalled();
    expect(superAdmin.password).toBe(hashedPassword);
  });

  test('Test 5: pre(save) hook should handle bcrypt.genSalt() failure (error path - external dependency failure)', async () => {
    // GIVEN: A new super admin and bcrypt.genSalt will fail
    const plainPassword = 'PasswordToFail';
    const bcryptError = new Error('Bcrypt genSalt failed');
    
    // Mock bcrypt.genSalt to throw error
    mockGenSalt.mockRejectedValue(bcryptError);
    
    const superAdmin = new SuperAdmin({
      name: 'Admin Fail',
      email: 'fail@example.com',
      password: plainPassword
    });
    
    // WHEN: Attempting to save (triggers pre-save hook with failing bcrypt.genSalt)
    // THEN: Should propagate the error (external dependency failure handling)
    await expect(superAdmin.save()).rejects.toThrow('Bcrypt genSalt failed');
    
    // Verify bcrypt.genSalt was called
    expect(mockGenSalt).toHaveBeenCalledWith(10);
    expect(mockHash).not.toHaveBeenCalled();
  });

  test('Test 6: pre(save) hook should handle bcrypt.hash() failure with null/undefined password (error path)', async () => {
    // GIVEN: A new super admin and bcrypt.hash will fail
    const plainPassword = 'PasswordToHashFail';
    const hashError = new Error('Bcrypt hash failed - invalid input');
    
    // Mock bcrypt functions - genSalt succeeds, hash fails
    mockGenSalt.mockResolvedValue('mockSalt');
    mockHash.mockRejectedValue(hashError);
    
    const superAdmin = new SuperAdmin({
      name: 'Hash Fail Admin',
      email: 'hashfail@example.com',
      password: plainPassword
    });
    
    // WHEN: Attempting to save (triggers pre-save hook with failing bcrypt.hash)
    // THEN: Should propagate the error (handles null/undefined password edge case)
    await expect(superAdmin.save()).rejects.toThrow('Bcrypt hash failed - invalid input');
    
    // Verify both bcrypt functions were called
    expect(mockGenSalt).toHaveBeenCalledWith(10);
    expect(mockHash).toHaveBeenCalledWith(plainPassword, 'mockSalt');
  });
});
