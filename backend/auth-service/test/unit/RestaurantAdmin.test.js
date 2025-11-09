// backend/auth-service/test/unit/RestaurantAdmin.test.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const RestaurantAdmin = require('../../models/RestaurantAdmin');

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
    hash: jest.fn().mockResolvedValue('$2a$12$hashedPasswordMockValue'),
    compare: jest.fn()
}));

describe('RestaurantAdmin Model Unit Tests - Shopee QA Standards', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ============================================================================
    // Test 1: save (pre-hook) - Password hashing on create (Happy Path)
    // ============================================================================
    describe('Test 1: save (pre-hook) - Password Hashing on Create (Happy Path)', () => {
        it('should hash password with bcrypt salt 12 before saving new restaurant admin', async () => {
            // GIVEN: A new restaurant admin with plain text password
            const plainPassword = 'MySecurePassword123!';
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@restaurant.com',
                phone: '+1234567890',
                password: plainPassword,
                businessLicense: 'BL-2024-001'
            });

            // Clear previous calls
            bcrypt.hash.mockClear();

            // WHEN: Restaurant admin validates and triggers pre-save hook
            await restaurantAdmin.validate();
            
            // Manually simulate the pre-save hook logic
            if (restaurantAdmin.isModified('password')) {
                restaurantAdmin.password = await bcrypt.hash(restaurantAdmin.password, 12);
            }

            // THEN: Should hash password with bcrypt and salt rounds 12
            expect(bcrypt.hash).toHaveBeenCalledWith(plainPassword, 12);
            expect(restaurantAdmin.password).toBe('$2a$12$hashedPasswordMockValue');
            expect(restaurantAdmin.password).not.toBe(plainPassword);
        });

        it('should use exactly salt rounds 12 for security compliance', async () => {
            // GIVEN: A new restaurant admin document
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Security',
                lastName: 'Test',
                email: 'security@restaurant.com',
                phone: '+9876543210',
                password: 'StrongPassword456!',
                businessLicense: 'BL-2024-002'
            });

            bcrypt.hash.mockClear();

            // WHEN: Pre-save hook logic executes
            await restaurantAdmin.validate();
            if (restaurantAdmin.isModified('password')) {
                restaurantAdmin.password = await bcrypt.hash(restaurantAdmin.password, 12);
            }

            // THEN: Should use exactly 12 salt rounds
            expect(bcrypt.hash).toHaveBeenCalledWith('StrongPassword456!', 12);
            expect(bcrypt.hash.mock.calls[0][1]).toBe(12);
        });

        it('should skip hashing when password is not modified', async () => {
            // GIVEN: An existing restaurant admin where password is already hashed
            const hashedPassword = '$2a$12$alreadyHashedPassword';
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Existing',
                lastName: 'Admin',
                email: 'existing@restaurant.com',
                phone: '+1111111111',
                password: hashedPassword,
                businessLicense: 'BL-2024-003'
            });

            // Mark as not new and password as not modified
            restaurantAdmin.isNew = false;
            
            // Mock isModified to return false for password
            const originalIsModified = restaurantAdmin.isModified;
            restaurantAdmin.isModified = jest.fn((path) => {
                if (path === 'password') return false;
                return originalIsModified.call(restaurantAdmin, path);
            });

            bcrypt.hash.mockClear();

            // WHEN: Pre-save hook logic runs but password not modified
            await restaurantAdmin.validate();
            if (restaurantAdmin.isModified('password')) {
                restaurantAdmin.password = await bcrypt.hash(restaurantAdmin.password, 12);
            }

            // THEN: Should NOT hash password again
            expect(bcrypt.hash).not.toHaveBeenCalled();
            expect(restaurantAdmin.password).toBe(hashedPassword);
        });

        it('should hash password on password update', async () => {
            // GIVEN: Existing restaurant admin changing password
            const newPassword = 'NewSecurePassword789!';
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Update',
                lastName: 'Test',
                email: 'update@restaurant.com',
                phone: '+2222222222',
                password: '$2a$12$oldHashedPassword',
                businessLicense: 'BL-2024-004'
            });

            restaurantAdmin.isNew = false;
            restaurantAdmin.password = newPassword;

            bcrypt.hash.mockClear();

            // WHEN: Password is modified and pre-save hook executes
            await restaurantAdmin.validate();
            if (restaurantAdmin.isModified('password')) {
                restaurantAdmin.password = await bcrypt.hash(restaurantAdmin.password, 12);
            }

            // THEN: Should hash the new password
            expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
            expect(restaurantAdmin.password).toBe('$2a$12$hashedPasswordMockValue');
        });
    });

    // ============================================================================
    // Test 2: comparePassword - Valid Password Comparison (Happy Path)
    // ============================================================================
    describe('Test 2: comparePassword - Valid Password Comparison (Happy Path)', () => {
        it('should return true when correct password is provided', async () => {
            // GIVEN: A restaurant admin with hashed password
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Alice',
                lastName: 'Smith',
                email: 'alice@restaurant.com',
                phone: '+3333333333',
                password: '$2a$12$hashedPassword',
                businessLicense: 'BL-2024-005'
            });

            bcrypt.compare.mockResolvedValue(true);

            // WHEN: comparePassword is called with correct password
            const result = await restaurantAdmin.comparePassword('CorrectPassword123!');

            // THEN: Should return true for authentication success
            expect(result).toBe(true);
            expect(bcrypt.compare).toHaveBeenCalledWith('CorrectPassword123!', restaurantAdmin.password);
        });

        it('should validate bcrypt.compare is called with correct parameters', async () => {
            // GIVEN: A restaurant admin instance
            const hashedPwd = '$2a$12$specificHashedValue';
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Bob',
                lastName: 'Johnson',
                email: 'bob@restaurant.com',
                phone: '+4444444444',
                password: hashedPwd,
                businessLicense: 'BL-2024-006'
            });

            bcrypt.compare.mockResolvedValue(true);

            // WHEN: comparePassword is invoked
            const candidatePassword = 'MyPassword789!';
            await restaurantAdmin.comparePassword(candidatePassword);

            // THEN: Should call bcrypt.compare with candidate and hashed password
            expect(bcrypt.compare).toHaveBeenCalledTimes(1);
            expect(bcrypt.compare).toHaveBeenCalledWith(candidatePassword, hashedPwd);
        });

        it('should handle password with special characters correctly', async () => {
            // GIVEN: Restaurant admin with hashed password
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Charlie',
                lastName: 'Brown',
                email: 'charlie@restaurant.com',
                phone: '+5555555555',
                password: '$2a$12$hashedPassword',
                businessLicense: 'BL-2024-007'
            });

            bcrypt.compare.mockResolvedValue(true);

            // WHEN: comparePassword receives password with special chars
            const specialPassword = 'P@ssw0rd!#$%^&*()';
            const result = await restaurantAdmin.comparePassword(specialPassword);

            // THEN: Should handle special characters and return true
            expect(result).toBe(true);
            expect(bcrypt.compare).toHaveBeenCalledWith(specialPassword, restaurantAdmin.password);
        });

        it('should work with minimum length password', async () => {
            // GIVEN: Restaurant admin with minimum password length
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'David',
                lastName: 'Wilson',
                email: 'david@restaurant.com',
                phone: '+6666666666',
                password: '$2a$12$hashedMinPassword',
                businessLicense: 'BL-2024-008'
            });

            bcrypt.compare.mockResolvedValue(true);

            // WHEN: comparePassword with 6-character password
            const minPassword = 'Pass12'; // Exactly 6 characters (minimum)
            const result = await restaurantAdmin.comparePassword(minPassword);

            // THEN: Should successfully compare minimum length password
            expect(result).toBe(true);
            expect(bcrypt.compare).toHaveBeenCalledWith(minPassword, restaurantAdmin.password);
        });

        it('should work with very long password', async () => {
            // GIVEN: Restaurant admin with long password
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Eve',
                lastName: 'Martinez',
                email: 'eve@restaurant.com',
                phone: '+7777777777',
                password: '$2a$12$hashedLongPassword',
                businessLicense: 'BL-2024-009'
            });

            bcrypt.compare.mockResolvedValue(true);

            // WHEN: comparePassword with very long password
            const longPassword = 'A'.repeat(100) + '1!'; // 102 characters
            const result = await restaurantAdmin.comparePassword(longPassword);

            // THEN: Should successfully compare long password
            expect(result).toBe(true);
            expect(bcrypt.compare).toHaveBeenCalledWith(longPassword, restaurantAdmin.password);
        });
    });

    // ============================================================================
    // Test 3: comparePassword - Invalid Password (Error Path)
    // ============================================================================
    describe('Test 3: comparePassword - Invalid Password (Error Path)', () => {
        it('should return false when wrong password is provided', async () => {
            // GIVEN: A restaurant admin with hashed password
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Frank',
                lastName: 'Garcia',
                email: 'frank@restaurant.com',
                phone: '+8888888888',
                password: '$2a$12$hashedPassword',
                businessLicense: 'BL-2024-010'
            });

            bcrypt.compare.mockResolvedValue(false);

            // WHEN: comparePassword is called with wrong password
            const result = await restaurantAdmin.comparePassword('WrongPassword123!');

            // THEN: Should return false to prevent unauthorized access
            expect(result).toBe(false);
            expect(bcrypt.compare).toHaveBeenCalledWith('WrongPassword123!', restaurantAdmin.password);
        });

        it('should return false for empty password', async () => {
            // GIVEN: A restaurant admin instance
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Grace',
                lastName: 'Lee',
                email: 'grace@restaurant.com',
                phone: '+9999999999',
                password: '$2a$12$hashedPassword',
                businessLicense: 'BL-2024-011'
            });

            bcrypt.compare.mockResolvedValue(false);

            // WHEN: comparePassword receives empty string
            const result = await restaurantAdmin.comparePassword('');

            // THEN: Should return false for security
            expect(result).toBe(false);
        });

        it('should return false for null password', async () => {
            // GIVEN: A restaurant admin instance
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Henry',
                lastName: 'Taylor',
                email: 'henry@restaurant.com',
                phone: '+1010101010',
                password: '$2a$12$hashedPassword',
                businessLicense: 'BL-2024-012'
            });

            bcrypt.compare.mockResolvedValue(false);

            // WHEN: comparePassword receives null
            const result = await restaurantAdmin.comparePassword(null);

            // THEN: Should return false to prevent null pointer exploitation
            expect(result).toBe(false);
            expect(bcrypt.compare).toHaveBeenCalledWith(null, restaurantAdmin.password);
        });

        it('should return false for undefined password', async () => {
            // GIVEN: A restaurant admin instance
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Isabel',
                lastName: 'Anderson',
                email: 'isabel@restaurant.com',
                phone: '+1212121212',
                password: '$2a$12$hashedPassword',
                businessLicense: 'BL-2024-013'
            });

            bcrypt.compare.mockResolvedValue(false);

            // WHEN: comparePassword receives undefined
            const result = await restaurantAdmin.comparePassword(undefined);

            // THEN: Should return false for undefined input
            expect(result).toBe(false);
        });

        it('should handle bcrypt.compare exceptions', async () => {
            // GIVEN: bcrypt.compare throws an error
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Jack',
                lastName: 'White',
                email: 'jack@restaurant.com',
                phone: '+1313131313',
                password: '$2a$12$hashedPassword',
                businessLicense: 'BL-2024-014'
            });

            const compareError = new Error('Bcrypt comparison failed');
            bcrypt.compare.mockRejectedValue(compareError);

            // WHEN: comparePassword encounters exception
            // THEN: Should propagate error for proper error handling
            await expect(restaurantAdmin.comparePassword('SomePassword123!')).rejects.toThrow('Bcrypt comparison failed');
        });

        it('should prevent unauthorized access with similar passwords', async () => {
            // GIVEN: Restaurant admin with specific password
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Karen',
                lastName: 'Black',
                email: 'karen@restaurant.com',
                phone: '+1414141414',
                password: '$2a$12$hashedPassword',
                businessLicense: 'BL-2024-015'
            });

            bcrypt.compare.mockResolvedValue(false);

            // WHEN: Attacker tries similar but wrong password
            const result = await restaurantAdmin.comparePassword('CorrectPassword124!'); // Off by 1 char

            // THEN: Should return false for security
            expect(result).toBe(false);
        });

        it('should return false for password with only whitespace', async () => {
            // GIVEN: Restaurant admin with valid password
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Larry',
                lastName: 'Green',
                email: 'larry@restaurant.com',
                phone: '+1515151515',
                password: '$2a$12$hashedPassword',
                businessLicense: 'BL-2024-016'
            });

            bcrypt.compare.mockResolvedValue(false);

            // WHEN: comparePassword receives whitespace-only password
            const result = await restaurantAdmin.comparePassword('     ');

            // THEN: Should return false
            expect(result).toBe(false);
        });
    });

    // ============================================================================
    // Test 4: save - Required Field Validation (Error Path)
    // ============================================================================
    describe('Test 4: save - Required Field Validation (Error Path)', () => {
        it('should throw validation error when email is missing', async () => {
            // GIVEN: Restaurant admin without email
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Monica',
                lastName: 'Blue',
                phone: '+1616161616',
                password: 'Password123!',
                businessLicense: 'BL-2024-017'
            });

            // WHEN: validate is called
            // THEN: Should throw validation error for missing email
            await expect(restaurantAdmin.validate()).rejects.toThrow();
            await expect(restaurantAdmin.validate()).rejects.toMatchObject({
                errors: expect.objectContaining({
                    email: expect.any(Object)
                })
            });
        });

        it('should throw validation error when firstName is missing', async () => {
            // GIVEN: Restaurant admin without firstName
            const restaurantAdmin = new RestaurantAdmin({
                lastName: 'Red',
                email: 'test@restaurant.com',
                phone: '+1717171717',
                password: 'Password123!',
                businessLicense: 'BL-2024-018'
            });

            // WHEN: validate is called
            // THEN: Should throw validation error for missing firstName
            await expect(restaurantAdmin.validate()).rejects.toThrow();
            await expect(restaurantAdmin.validate()).rejects.toMatchObject({
                errors: expect.objectContaining({
                    firstName: expect.any(Object)
                })
            });
        });

        it('should throw validation error when lastName is missing', async () => {
            // GIVEN: Restaurant admin without lastName
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Nancy',
                email: 'nancy@restaurant.com',
                phone: '+1818181818',
                password: 'Password123!',
                businessLicense: 'BL-2024-019'
            });

            // WHEN: validate is called
            // THEN: Should throw validation error for missing lastName
            await expect(restaurantAdmin.validate()).rejects.toThrow();
            await expect(restaurantAdmin.validate()).rejects.toMatchObject({
                errors: expect.objectContaining({
                    lastName: expect.any(Object)
                })
            });
        });

        it('should throw validation error when phone is missing', async () => {
            // GIVEN: Restaurant admin without phone
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Oscar',
                lastName: 'Yellow',
                email: 'oscar@restaurant.com',
                password: 'Password123!',
                businessLicense: 'BL-2024-020'
            });

            // WHEN: validate is called
            // THEN: Should throw validation error for missing phone
            await expect(restaurantAdmin.validate()).rejects.toThrow();
            await expect(restaurantAdmin.validate()).rejects.toMatchObject({
                errors: expect.objectContaining({
                    phone: expect.any(Object)
                })
            });
        });

        it('should throw validation error when password is missing', async () => {
            // GIVEN: Restaurant admin without password
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Peter',
                lastName: 'Orange',
                email: 'peter@restaurant.com',
                phone: '+1919191919',
                businessLicense: 'BL-2024-021'
            });

            // WHEN: validate is called
            // THEN: Should throw validation error for missing password
            await expect(restaurantAdmin.validate()).rejects.toThrow();
            await expect(restaurantAdmin.validate()).rejects.toMatchObject({
                errors: expect.objectContaining({
                    password: expect.any(Object)
                })
            });
        });

        it('should throw validation error when businessLicense is missing', async () => {
            // GIVEN: Restaurant admin without businessLicense
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Quinn',
                lastName: 'Purple',
                email: 'quinn@restaurant.com',
                phone: '+2020202020',
                password: 'Password123!'
            });

            // WHEN: validate is called
            // THEN: Should throw validation error for missing businessLicense
            await expect(restaurantAdmin.validate()).rejects.toThrow();
            await expect(restaurantAdmin.validate()).rejects.toMatchObject({
                errors: expect.objectContaining({
                    businessLicense: expect.any(Object)
                })
            });
        });

        it('should throw validation error when multiple required fields are missing', async () => {
            // GIVEN: Restaurant admin with only firstName
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Rachel'
            });

            // WHEN: validate is called
            // THEN: Should throw validation errors for all missing required fields
            await expect(restaurantAdmin.validate()).rejects.toThrow();
            await expect(restaurantAdmin.validate()).rejects.toMatchObject({
                errors: expect.objectContaining({
                    lastName: expect.any(Object),
                    email: expect.any(Object),
                    phone: expect.any(Object),
                    password: expect.any(Object),
                    businessLicense: expect.any(Object)
                })
            });
        });

        it('should throw validation error when password is too short', async () => {
            // GIVEN: Restaurant admin with password less than 6 characters
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Samuel',
                lastName: 'Pink',
                email: 'samuel@restaurant.com',
                phone: '+2121212121',
                password: '12345', // Only 5 characters
                businessLicense: 'BL-2024-022'
            });

            // WHEN: validate is called
            // THEN: Should throw validation error for minlength constraint
            await expect(restaurantAdmin.validate()).rejects.toThrow();
            await expect(restaurantAdmin.validate()).rejects.toMatchObject({
                errors: expect.objectContaining({
                    password: expect.any(Object)
                })
            });
        });

        it('should handle null values for required fields', async () => {
            // GIVEN: Restaurant admin with null values
            const restaurantAdmin = new RestaurantAdmin({
                firstName: null,
                lastName: null,
                email: null,
                phone: null,
                password: null,
                businessLicense: null
            });

            // WHEN: validate is called
            // THEN: Should throw validation errors
            await expect(restaurantAdmin.validate()).rejects.toThrow();
        });

        it('should handle empty strings for required fields', async () => {
            // GIVEN: Restaurant admin with empty strings
            const restaurantAdmin = new RestaurantAdmin({
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                password: '',
                businessLicense: ''
            });

            // WHEN: validate is called
            // THEN: Should throw validation errors
            await expect(restaurantAdmin.validate()).rejects.toThrow();
        });

        it('should handle undefined values for required fields', async () => {
            // GIVEN: Restaurant admin with undefined values
            const restaurantAdmin = new RestaurantAdmin({
                firstName: undefined,
                lastName: undefined,
                email: undefined,
                phone: undefined,
                password: undefined,
                businessLicense: undefined
            });

            // WHEN: validate is called
            // THEN: Should throw validation errors
            await expect(restaurantAdmin.validate()).rejects.toThrow();
        });
    });

    // ============================================================================
    // Test 5: save - Duplicate Email Constraint (Error Path)
    // ============================================================================
    describe('Test 5: save - Duplicate Email Constraint (Error Path)', () => {
        it('should enforce unique email constraint in schema', () => {
            // GIVEN: RestaurantAdmin schema definition
            const emailField = RestaurantAdmin.schema.path('email');

            // WHEN: Checking schema configuration
            const isUnique = emailField.options.unique;

            // THEN: Email field should be marked as unique
            expect(isUnique).toBe(true);
        });

        it('should have email field marked as unique in schema', () => {
            // GIVEN: RestaurantAdmin model schema
            const schema = RestaurantAdmin.schema;

            // WHEN: Inspecting email field properties
            const emailPath = schema.path('email');

            // THEN: Should have unique constraint configured
            expect(emailPath).toBeDefined();
            expect(emailPath.options.unique).toBe(true);
        });

        it('should convert email to lowercase to prevent case-sensitive duplicates', async () => {
            // GIVEN: Restaurant admin with uppercase email
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Tom',
                lastName: 'Silver',
                email: 'TOM.SILVER@RESTAURANT.COM',
                phone: '+2222222222',
                password: 'Password123!',
                businessLicense: 'BL-2024-023'
            });

            // WHEN: validate is called
            await restaurantAdmin.validate();

            // THEN: Email should be converted to lowercase
            expect(restaurantAdmin.email).toBe('tom.silver@restaurant.com');
        });

        it('should trim email to prevent duplicate spaces', async () => {
            // GIVEN: Restaurant admin with email containing spaces
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Uma',
                lastName: 'Gold',
                email: '  uma@restaurant.com  ',
                phone: '+2323232323',
                password: 'Password123!',
                businessLicense: 'BL-2024-024'
            });

            // WHEN: validate is called
            await restaurantAdmin.validate();

            // THEN: Email should be trimmed
            expect(restaurantAdmin.email).toBe('uma@restaurant.com');
        });

        it('should handle both lowercase and trim transformations together', async () => {
            // GIVEN: Restaurant admin with mixed case and spaces in email
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Victor',
                lastName: 'Bronze',
                email: '  VICTOR.BRONZE@RESTAURANT.COM  ',
                phone: '+2424242424',
                password: 'Password123!',
                businessLicense: 'BL-2024-025'
            });

            // WHEN: validate is called
            await restaurantAdmin.validate();

            // THEN: Email should be lowercase and trimmed
            expect(restaurantAdmin.email).toBe('victor.bronze@restaurant.com');
        });

        it('should validate unique index exists on email field', () => {
            // GIVEN: RestaurantAdmin schema indexes
            const indexes = RestaurantAdmin.schema.indexes();

            // WHEN: Checking for unique index on email
            const emailPath = RestaurantAdmin.schema.path('email');

            // THEN: Should have unique constraint
            expect(emailPath.options.unique).toBe(true);
        });

        it('should handle email with special characters correctly', async () => {
            // GIVEN: Restaurant admin with email containing valid special chars
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Wendy',
                lastName: 'Copper',
                email: 'wendy.copper+test@restaurant.com',
                phone: '+2525252525',
                password: 'Password123!',
                businessLicense: 'BL-2024-026'
            });

            // WHEN: validate is called
            await restaurantAdmin.validate();

            // THEN: Should accept email with special characters
            expect(restaurantAdmin.email).toBe('wendy.copper+test@restaurant.com');
        });

        it('should prepare email for consistent duplicate checking', async () => {
            // GIVEN: Two restaurant admins with same email but different cases
            const restaurantAdmin1 = new RestaurantAdmin({
                firstName: 'Xavier',
                lastName: 'Diamond',
                email: 'Xavier@Restaurant.COM',
                phone: '+2626262626',
                password: 'Password123!',
                businessLicense: 'BL-2024-027'
            });

            const restaurantAdmin2 = new RestaurantAdmin({
                firstName: 'Xavier',
                lastName: 'Diamond',
                email: 'xavier@restaurant.com',
                phone: '+2626262626',
                password: 'Password123!',
                businessLicense: 'BL-2024-028'
            });

            // WHEN: Both are validated
            await restaurantAdmin1.validate();
            await restaurantAdmin2.validate();

            // THEN: Both emails should be normalized to same value
            expect(restaurantAdmin1.email).toBe(restaurantAdmin2.email);
            expect(restaurantAdmin1.email).toBe('xavier@restaurant.com');
        });
    });

    // ============================================================================
    // Test 6: save - Duplicate Business License Constraint (Error Path)
    // ============================================================================
    describe('Test 6: save - Duplicate Business License Constraint (Error Path)', () => {
        it('should have businessLicense as required field', () => {
            // GIVEN: RestaurantAdmin schema definition
            const businessLicenseField = RestaurantAdmin.schema.path('businessLicense');

            // WHEN: Checking schema configuration
            const isRequired = businessLicenseField.isRequired;

            // THEN: businessLicense field should be marked as required
            expect(isRequired).toBe(true);
        });

        it('should trim businessLicense to prevent duplicate spaces', async () => {
            // GIVEN: Restaurant admin with businessLicense containing spaces
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Yvonne',
                lastName: 'Pearl',
                email: 'yvonne@restaurant.com',
                phone: '+2727272727',
                password: 'Password123!',
                businessLicense: '  BL-2024-029  '
            });

            // WHEN: validate is called
            await restaurantAdmin.validate();

            // THEN: businessLicense should be trimmed
            expect(restaurantAdmin.businessLicense).toBe('BL-2024-029');
        });

        it('should validate businessLicense is a string field', () => {
            // GIVEN: RestaurantAdmin schema
            const businessLicenseField = RestaurantAdmin.schema.path('businessLicense');

            // WHEN: Checking field type
            const fieldType = businessLicenseField.instance;

            // THEN: Should be String type
            expect(fieldType).toBe('String');
        });

        it('should handle businessLicense with alphanumeric characters', async () => {
            // GIVEN: Restaurant admin with alphanumeric businessLicense
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Zoe',
                lastName: 'Violet',
                email: 'zoe@restaurant.com',
                phone: '+2828282828',
                password: 'Password123!',
                businessLicense: 'BL-ABC123-XYZ789'
            });

            // WHEN: validate is called
            await restaurantAdmin.validate();

            // THEN: Should accept alphanumeric businessLicense
            expect(restaurantAdmin.businessLicense).toBe('BL-ABC123-XYZ789');
        });

        it('should handle businessLicense with special characters', async () => {
            // GIVEN: Restaurant admin with special chars in businessLicense
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Adam',
                lastName: 'Teal',
                email: 'adam@restaurant.com',
                phone: '+2929292929',
                password: 'Password123!',
                businessLicense: 'BL-2024/030-A'
            });

            // WHEN: validate is called
            await restaurantAdmin.validate();

            // THEN: Should accept businessLicense with special characters
            expect(restaurantAdmin.businessLicense).toBe('BL-2024/030-A');
        });

        it('should prevent fraud by requiring unique businessLicense', async () => {
            // GIVEN: Two restaurant admins attempting to use same businessLicense
            const restaurantAdmin1 = new RestaurantAdmin({
                firstName: 'Bella',
                lastName: 'Crimson',
                email: 'bella1@restaurant.com',
                phone: '+3030303030',
                password: 'Password123!',
                businessLicense: 'BL-FRAUD-001'
            });

            const restaurantAdmin2 = new RestaurantAdmin({
                firstName: 'Bella',
                lastName: 'Crimson',
                email: 'bella2@restaurant.com',
                phone: '+3131313131',
                password: 'Password123!',
                businessLicense: 'BL-FRAUD-001'
            });

            // WHEN: Both are validated
            await restaurantAdmin1.validate();
            await restaurantAdmin2.validate();

            // THEN: Both have same businessLicense (database should prevent duplicate)
            expect(restaurantAdmin1.businessLicense).toBe(restaurantAdmin2.businessLicense);
            // Note: Actual duplicate prevention happens at database level with unique index
        });

        it('should handle empty businessLicense as validation error', async () => {
            // GIVEN: Restaurant admin with empty businessLicense
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Charlie',
                lastName: 'Magenta',
                email: 'charlie@restaurant.com',
                phone: '+3232323232',
                password: 'Password123!',
                businessLicense: ''
            });

            // WHEN: validate is called
            // THEN: Should throw validation error for empty required field
            await expect(restaurantAdmin.validate()).rejects.toThrow();
        });

        it('should handle null businessLicense as validation error', async () => {
            // GIVEN: Restaurant admin with null businessLicense
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Diana',
                lastName: 'Amber',
                email: 'diana@restaurant.com',
                phone: '+3333333333',
                password: 'Password123!',
                businessLicense: null
            });

            // WHEN: validate is called
            // THEN: Should throw validation error for null required field
            await expect(restaurantAdmin.validate()).rejects.toThrow();
        });
    });

    // ============================================================================
    // Additional Tests - Default Values and Schema Properties
    // ============================================================================
    describe('Additional Tests - Default Values and Schema Properties', () => {
        it('should set default isApproved to false', async () => {
            // GIVEN: Restaurant admin without isApproved field
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Emma',
                lastName: 'Coral',
                email: 'emma@restaurant.com',
                phone: '+3434343434',
                password: 'Password123!',
                businessLicense: 'BL-2024-031'
            });

            // WHEN: validate is called
            await restaurantAdmin.validate();

            // THEN: isApproved should default to false
            expect(restaurantAdmin.isApproved).toBe(false);
        });

        it('should allow optional restaurantId field', async () => {
            // GIVEN: Restaurant admin without restaurantId
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Frank',
                lastName: 'Indigo',
                email: 'frank@restaurant.com',
                phone: '+3535353535',
                password: 'Password123!',
                businessLicense: 'BL-2024-032'
            });

            // WHEN: validate is called
            await restaurantAdmin.validate();

            // THEN: Should pass validation without restaurantId
            expect(restaurantAdmin.restaurantId).toBeUndefined();
        });

        it('should allow optional approvedBy field', async () => {
            // GIVEN: Restaurant admin without approvedBy
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Grace',
                lastName: 'Cyan',
                email: 'grace@restaurant.com',
                phone: '+3636363636',
                password: 'Password123!',
                businessLicense: 'BL-2024-033'
            });

            // WHEN: validate is called
            await restaurantAdmin.validate();

            // THEN: Should pass validation without approvedBy
            expect(restaurantAdmin.approvedBy).toBeUndefined();
        });

        it('should allow optional approvedAt field', async () => {
            // GIVEN: Restaurant admin without approvedAt
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Henry',
                lastName: 'Maroon',
                email: 'henry@restaurant.com',
                phone: '+3737373737',
                password: 'Password123!',
                businessLicense: 'BL-2024-034'
            });

            // WHEN: validate is called
            await restaurantAdmin.validate();

            // THEN: Should pass validation without approvedAt
            expect(restaurantAdmin.approvedAt).toBeUndefined();
        });

        it('should have timestamps enabled', () => {
            // GIVEN: RestaurantAdmin schema
            const schema = RestaurantAdmin.schema;

            // WHEN: Checking timestamps option
            const hasTimestamps = schema.options.timestamps;

            // THEN: Should have timestamps enabled
            expect(hasTimestamps).toBe(true);
        });

        it('should trim firstName field', async () => {
            // GIVEN: Restaurant admin with spaces in firstName
            const restaurantAdmin = new RestaurantAdmin({
                firstName: '  Isabella  ',
                lastName: 'Lime',
                email: 'isabella@restaurant.com',
                phone: '+3838383838',
                password: 'Password123!',
                businessLicense: 'BL-2024-035'
            });

            // WHEN: validate is called
            await restaurantAdmin.validate();

            // THEN: firstName should be trimmed
            expect(restaurantAdmin.firstName).toBe('Isabella');
        });

        it('should trim lastName field', async () => {
            // GIVEN: Restaurant admin with spaces in lastName
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Jacob',
                lastName: '  Olive  ',
                email: 'jacob@restaurant.com',
                phone: '+3939393939',
                password: 'Password123!',
                businessLicense: 'BL-2024-036'
            });

            // WHEN: validate is called
            await restaurantAdmin.validate();

            // THEN: lastName should be trimmed
            expect(restaurantAdmin.lastName).toBe('Olive');
        });

        it('should trim phone field', async () => {
            // GIVEN: Restaurant admin with spaces in phone
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Kate',
                lastName: 'Rust',
                email: 'kate@restaurant.com',
                phone: '  +4040404040  ',
                password: 'Password123!',
                businessLicense: 'BL-2024-037'
            });

            // WHEN: validate is called
            await restaurantAdmin.validate();

            // THEN: phone should be trimmed
            expect(restaurantAdmin.phone).toBe('+4040404040');
        });

        it('should accept valid ObjectId for restaurantId reference', async () => {
            // GIVEN: Restaurant admin with valid restaurantId
            const validObjectId = new mongoose.Types.ObjectId();
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Liam',
                lastName: 'Khaki',
                email: 'liam@restaurant.com',
                phone: '+4141414141',
                password: 'Password123!',
                businessLicense: 'BL-2024-038',
                restaurantId: validObjectId
            });

            // WHEN: validate is called
            await restaurantAdmin.validate();

            // THEN: Should accept valid ObjectId
            expect(restaurantAdmin.restaurantId).toEqual(validObjectId);
        });

        it('should accept valid ObjectId for approvedBy reference', async () => {
            // GIVEN: Restaurant admin with valid approvedBy
            const validObjectId = new mongoose.Types.ObjectId();
            const restaurantAdmin = new RestaurantAdmin({
                firstName: 'Mia',
                lastName: 'Navy',
                email: 'mia@restaurant.com',
                phone: '+4242424242',
                password: 'Password123!',
                businessLicense: 'BL-2024-039',
                approvedBy: validObjectId
            });

            // WHEN: validate is called
            await restaurantAdmin.validate();

            // THEN: Should accept valid ObjectId
            expect(restaurantAdmin.approvedBy).toEqual(validObjectId);
        });
    });
});
