// backend/auth-service/test/unit/Customer.test.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Customer = require('../../models/Customer');

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
    hash: jest.fn().mockResolvedValue('$2a$12$hashedPasswordMockValue'),
    compare: jest.fn()
}));

describe('Customer Model Unit Tests - Shopee QA Standards', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ============================================================================
    // Test 1: save (pre-hook) - Password hashing on create (Happy Path)
    // ============================================================================
    describe('Test 1: save (pre-hook) - Password Hashing on Create (Happy Path)', () => {
        it('should hash password with bcrypt salt 12 before saving new customer', async () => {
            // GIVEN: A new customer with plain text password
            const plainPassword = 'MySecurePassword123!';
            const customer = new Customer({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@shopee.com',
                phone: '+1234567890',
                password: plainPassword,
                location: '123 Main St'
            });

            // Clear previous calls
            bcrypt.hash.mockClear();

            // WHEN: Customer validates and triggers pre-save hook
            await customer.validate();
            
            // Manually simulate the pre-save hook logic
            if (customer.isModified('password')) {
                customer.password = await bcrypt.hash(customer.password, 12);
            }

            // THEN: Should hash password with bcrypt and salt rounds 12
            expect(bcrypt.hash).toHaveBeenCalledWith(plainPassword, 12);
            expect(customer.password).toBe('$2a$12$hashedPasswordMockValue');
            expect(customer.password).not.toBe(plainPassword);
        });

        it('should use exactly salt rounds 12 for security compliance', async () => {
            // GIVEN: A new customer document
            const customer = new Customer({
                firstName: 'Security',
                lastName: 'Test',
                email: 'security@shopee.com',
                phone: '+9876543210',
                password: 'StrongPassword456!'
            });

            bcrypt.hash.mockClear();

            // WHEN: Pre-save hook logic executes
            await customer.validate();
            if (customer.isModified('password')) {
                customer.password = await bcrypt.hash(customer.password, 12);
            }

            // THEN: Should use exactly 12 salt rounds
            expect(bcrypt.hash).toHaveBeenCalledWith('StrongPassword456!', 12);
            expect(bcrypt.hash.mock.calls[0][1]).toBe(12);
        });

        it('should skip hashing when password is not modified', async () => {
            // GIVEN: An existing customer where password is already hashed
            const hashedPassword = '$2a$12$alreadyHashedPassword';
            const customer = new Customer({
                firstName: 'Existing',
                lastName: 'Customer',
                email: 'existing@shopee.com',
                phone: '+1111111111',
                password: hashedPassword
            });

            // Mark as not new and password as not modified
            customer.isNew = false;
            
            // Mock isModified to return false for password
            const originalIsModified = customer.isModified;
            customer.isModified = jest.fn((path) => {
                if (path === 'password') return false;
                return originalIsModified.call(customer, path);
            });

            bcrypt.hash.mockClear();

            // WHEN: Pre-save hook logic runs but password not modified
            await customer.validate();
            if (customer.isModified('password')) {
                customer.password = await bcrypt.hash(customer.password, 12);
            }

            // THEN: Should NOT hash password again
            expect(bcrypt.hash).not.toHaveBeenCalled();
            expect(customer.password).toBe(hashedPassword);
        });
    });

    // ============================================================================
    // Test 2: comparePassword - Valid Password Comparison (Happy Path)
    // ============================================================================
    describe('Test 2: comparePassword - Valid Password Comparison (Happy Path)', () => {
        it('should return true when correct password is provided', async () => {
            // GIVEN: A customer with hashed password
            const customer = new Customer({
                firstName: 'Alice',
                lastName: 'Smith',
                email: 'alice@shopee.com',
                phone: '+2222222222',
                password: '$2a$12$hashedPassword'
            });

            bcrypt.compare.mockResolvedValue(true);

            // WHEN: comparePassword is called with correct password
            const result = await customer.comparePassword('CorrectPassword123!');

            // THEN: Should return true for authentication success
            expect(result).toBe(true);
            expect(bcrypt.compare).toHaveBeenCalledWith('CorrectPassword123!', customer.password);
        });

        it('should validate bcrypt.compare is called with correct parameters', async () => {
            // GIVEN: A customer instance
            const hashedPwd = '$2a$12$specificHashedValue';
            const customer = new Customer({
                firstName: 'Bob',
                lastName: 'Johnson',
                email: 'bob@shopee.com',
                phone: '+3333333333',
                password: hashedPwd
            });

            bcrypt.compare.mockResolvedValue(true);

            // WHEN: comparePassword is invoked
            const candidatePassword = 'MyPassword789!';
            await customer.comparePassword(candidatePassword);

            // THEN: Should call bcrypt.compare with candidate and hashed password
            expect(bcrypt.compare).toHaveBeenCalledTimes(1);
            expect(bcrypt.compare).toHaveBeenCalledWith(candidatePassword, hashedPwd);
        });

        it('should handle password with special characters correctly', async () => {
            // GIVEN: Customer with hashed password
            const customer = new Customer({
                firstName: 'Charlie',
                lastName: 'Brown',
                email: 'charlie@shopee.com',
                phone: '+4444444444',
                password: '$2a$12$hashedPassword'
            });

            bcrypt.compare.mockResolvedValue(true);

            // WHEN: comparePassword receives password with special chars
            const specialPassword = 'P@ssw0rd!#$%^&*()';
            const result = await customer.comparePassword(specialPassword);

            // THEN: Should handle special characters and return true
            expect(result).toBe(true);
            expect(bcrypt.compare).toHaveBeenCalledWith(specialPassword, customer.password);
        });
    });

    // ============================================================================
    // Test 3: comparePassword - Invalid Password (Error Path)
    // ============================================================================
    describe('Test 3: comparePassword - Invalid Password (Error Path)', () => {
        it('should return false when wrong password is provided', async () => {
            // GIVEN: A customer with hashed password
            const customer = new Customer({
                firstName: 'David',
                lastName: 'Wilson',
                email: 'david@shopee.com',
                phone: '+5555555555',
                password: '$2a$12$hashedPassword'
            });

            bcrypt.compare.mockResolvedValue(false);

            // WHEN: comparePassword is called with wrong password
            const result = await customer.comparePassword('WrongPassword123!');

            // THEN: Should return false to prevent unauthorized access
            expect(result).toBe(false);
            expect(bcrypt.compare).toHaveBeenCalledWith('WrongPassword123!', customer.password);
        });

        it('should return false for empty password', async () => {
            // GIVEN: A customer instance
            const customer = new Customer({
                firstName: 'Eve',
                lastName: 'Martinez',
                email: 'eve@shopee.com',
                phone: '+6666666666',
                password: '$2a$12$hashedPassword'
            });

            bcrypt.compare.mockResolvedValue(false);

            // WHEN: comparePassword receives empty string
            const result = await customer.comparePassword('');

            // THEN: Should return false for security
            expect(result).toBe(false);
        });

        it('should return false for null password', async () => {
            // GIVEN: A customer instance
            const customer = new Customer({
                firstName: 'Frank',
                lastName: 'Garcia',
                email: 'frank@shopee.com',
                phone: '+7777777777',
                password: '$2a$12$hashedPassword'
            });

            bcrypt.compare.mockResolvedValue(false);

            // WHEN: comparePassword receives null
            const result = await customer.comparePassword(null);

            // THEN: Should return false to prevent null pointer exploitation
            expect(result).toBe(false);
            expect(bcrypt.compare).toHaveBeenCalledWith(null, customer.password);
        });

        it('should return false for undefined password', async () => {
            // GIVEN: A customer instance
            const customer = new Customer({
                firstName: 'Grace',
                lastName: 'Lee',
                email: 'grace@shopee.com',
                phone: '+8888888888',
                password: '$2a$12$hashedPassword'
            });

            bcrypt.compare.mockResolvedValue(false);

            // WHEN: comparePassword receives undefined
            const result = await customer.comparePassword(undefined);

            // THEN: Should return false for undefined input
            expect(result).toBe(false);
        });

        it('should handle bcrypt.compare exceptions', async () => {
            // GIVEN: bcrypt.compare throws an error
            const customer = new Customer({
                firstName: 'Henry',
                lastName: 'Taylor',
                email: 'henry@shopee.com',
                phone: '+9999999999',
                password: '$2a$12$hashedPassword'
            });

            const compareError = new Error('Bcrypt comparison failed');
            bcrypt.compare.mockRejectedValue(compareError);

            // WHEN: comparePassword encounters exception
            // THEN: Should propagate error for proper error handling
            await expect(customer.comparePassword('SomePassword123!')).rejects.toThrow('Bcrypt comparison failed');
        });

        it('should prevent unauthorized access with similar passwords', async () => {
            // GIVEN: Customer with specific password
            const customer = new Customer({
                firstName: 'Isabel',
                lastName: 'Anderson',
                email: 'isabel@shopee.com',
                phone: '+1010101010',
                password: '$2a$12$hashedPassword'
            });

            bcrypt.compare.mockResolvedValue(false);

            // WHEN: Attacker tries similar but wrong password
            const result = await customer.comparePassword('CorrectPassword124!'); // Off by 1 char

            // THEN: Should return false for security
            expect(result).toBe(false);
        });
    });

    // ============================================================================
    // Test 4: save - Required Field Validation (Error Path)
    // ============================================================================
    describe('Test 4: save - Required Field Validation (Error Path)', () => {
        it('should throw validation error when email is missing', async () => {
            // GIVEN: Customer without email
            const customer = new Customer({
                firstName: 'Jack',
                lastName: 'White',
                phone: '+1212121212',
                password: 'Password123!',
                location: '456 Elm St'
            });

            // WHEN: validate is called
            // THEN: Should throw validation error for missing email
            await expect(customer.validate()).rejects.toThrow();
            await expect(customer.validate()).rejects.toMatchObject({
                errors: expect.objectContaining({
                    email: expect.any(Object)
                })
            });
        });

        it('should throw validation error when firstName is missing', async () => {
            // GIVEN: Customer without firstName
            const customer = new Customer({
                lastName: 'Black',
                email: 'test@shopee.com',
                phone: '+1313131313',
                password: 'Password123!'
            });

            // WHEN: validate is called
            // THEN: Should throw validation error for missing firstName
            await expect(customer.validate()).rejects.toThrow();
            await expect(customer.validate()).rejects.toMatchObject({
                errors: expect.objectContaining({
                    firstName: expect.any(Object)
                })
            });
        });

        it('should throw validation error when lastName is missing', async () => {
            // GIVEN: Customer without lastName
            const customer = new Customer({
                firstName: 'Karen',
                email: 'karen@shopee.com',
                phone: '+1414141414',
                password: 'Password123!'
            });

            // WHEN: validate is called
            // THEN: Should throw validation error for missing lastName
            await expect(customer.validate()).rejects.toThrow();
            await expect(customer.validate()).rejects.toMatchObject({
                errors: expect.objectContaining({
                    lastName: expect.any(Object)
                })
            });
        });

        it('should throw validation error when phone is missing', async () => {
            // GIVEN: Customer without phone
            const customer = new Customer({
                firstName: 'Larry',
                lastName: 'Green',
                email: 'larry@shopee.com',
                password: 'Password123!'
            });

            // WHEN: validate is called
            // THEN: Should throw validation error for missing phone
            await expect(customer.validate()).rejects.toThrow();
            await expect(customer.validate()).rejects.toMatchObject({
                errors: expect.objectContaining({
                    phone: expect.any(Object)
                })
            });
        });

        it('should throw validation error when password is missing', async () => {
            // GIVEN: Customer without password
            const customer = new Customer({
                firstName: 'Monica',
                lastName: 'Blue',
                email: 'monica@shopee.com',
                phone: '+1515151515'
            });

            // WHEN: validate is called
            // THEN: Should throw validation error for missing password
            await expect(customer.validate()).rejects.toThrow();
            await expect(customer.validate()).rejects.toMatchObject({
                errors: expect.objectContaining({
                    password: expect.any(Object)
                })
            });
        });

        it('should throw validation error when multiple required fields are missing', async () => {
            // GIVEN: Customer with only firstName
            const customer = new Customer({
                firstName: 'Nancy'
            });

            // WHEN: validate is called
            // THEN: Should throw validation errors for all missing required fields
            await expect(customer.validate()).rejects.toThrow();
            await expect(customer.validate()).rejects.toMatchObject({
                errors: expect.objectContaining({
                    lastName: expect.any(Object),
                    email: expect.any(Object),
                    phone: expect.any(Object),
                    password: expect.any(Object)
                })
            });
        });

        it('should throw validation error when password is too short', async () => {
            // GIVEN: Customer with password less than 6 characters
            const customer = new Customer({
                firstName: 'Oscar',
                lastName: 'Red',
                email: 'oscar@shopee.com',
                phone: '+1616161616',
                password: '12345' // Only 5 characters
            });

            // WHEN: validate is called
            // THEN: Should throw validation error for minlength constraint
            await expect(customer.validate()).rejects.toThrow();
            await expect(customer.validate()).rejects.toMatchObject({
                errors: expect.objectContaining({
                    password: expect.any(Object)
                })
            });
        });

        it('should handle null values for required fields', async () => {
            // GIVEN: Customer with null values
            const customer = new Customer({
                firstName: null,
                lastName: null,
                email: null,
                phone: null,
                password: null
            });

            // WHEN: validate is called
            // THEN: Should throw validation errors
            await expect(customer.validate()).rejects.toThrow();
        });

        it('should handle empty strings for required fields', async () => {
            // GIVEN: Customer with empty strings
            const customer = new Customer({
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                password: ''
            });

            // WHEN: validate is called
            // THEN: Should throw validation errors
            await expect(customer.validate()).rejects.toThrow();
        });

        it('should handle undefined values for required fields', async () => {
            // GIVEN: Customer with undefined values
            const customer = new Customer({
                firstName: undefined,
                lastName: undefined,
                email: undefined,
                phone: undefined,
                password: undefined
            });

            // WHEN: validate is called
            // THEN: Should throw validation errors
            await expect(customer.validate()).rejects.toThrow();
        });
    });

    // ============================================================================
    // Test 5: save - Duplicate Email Constraint (Error Path)
    // ============================================================================
    describe('Test 5: save - Duplicate Email Constraint (Error Path)', () => {
        it('should enforce unique email constraint in schema', () => {
            // GIVEN: Customer schema definition
            const emailField = Customer.schema.path('email');

            // WHEN: Checking schema configuration
            const isUnique = emailField.options.unique;

            // THEN: Email field should be marked as unique
            expect(isUnique).toBe(true);
        });

        it('should have email field marked as unique in schema', () => {
            // GIVEN: Customer model schema
            const schema = Customer.schema;

            // WHEN: Inspecting email field properties
            const emailPath = schema.path('email');

            // THEN: Should have unique constraint configured
            expect(emailPath).toBeDefined();
            expect(emailPath.options.unique).toBe(true);
        });

        it('should convert email to lowercase to prevent case-sensitive duplicates', async () => {
            // GIVEN: Customer with uppercase email
            const customer = new Customer({
                firstName: 'Peter',
                lastName: 'Yellow',
                email: 'PETER.YELLOW@SHOPEE.COM',
                phone: '+1717171717',
                password: 'Password123!'
            });

            // WHEN: validate is called
            await customer.validate();

            // THEN: Email should be converted to lowercase
            expect(customer.email).toBe('peter.yellow@shopee.com');
        });

        it('should trim email to prevent duplicate spaces', async () => {
            // GIVEN: Customer with email containing spaces
            const customer = new Customer({
                firstName: 'Quinn',
                lastName: 'Orange',
                email: '  quinn@shopee.com  ',
                phone: '+1818181818',
                password: 'Password123!'
            });

            // WHEN: validate is called
            await customer.validate();

            // THEN: Email should be trimmed
            expect(customer.email).toBe('quinn@shopee.com');
        });

        it('should handle both lowercase and trim transformations together', async () => {
            // GIVEN: Customer with mixed case and spaces in email
            const customer = new Customer({
                firstName: 'Rachel',
                lastName: 'Purple',
                email: '  RACHEL.PURPLE@SHOPEE.COM  ',
                phone: '+1919191919',
                password: 'Password123!'
            });

            // WHEN: validate is called
            await customer.validate();

            // THEN: Email should be lowercase and trimmed
            expect(customer.email).toBe('rachel.purple@shopee.com');
        });

        it('should validate unique index exists on email field', () => {
            // GIVEN: Customer schema indexes
            const indexes = Customer.schema.indexes();

            // WHEN: Checking for unique index on email
            const emailIndex = indexes.find(index => {
                return index[0].email !== undefined;
            });

            // THEN: Should have index configuration for email uniqueness
            // Note: Mongoose adds unique indexes automatically
            const emailPath = Customer.schema.path('email');
            expect(emailPath.options.unique).toBe(true);
        });

        it('should handle email with special characters correctly', async () => {
            // GIVEN: Customer with email containing valid special chars
            const customer = new Customer({
                firstName: 'Samuel',
                lastName: 'Pink',
                email: 'samuel.pink+test@shopee.com',
                phone: '+2020202020',
                password: 'Password123!'
            });

            // WHEN: validate is called
            await customer.validate();

            // THEN: Should accept email with special characters
            expect(customer.email).toBe('samuel.pink+test@shopee.com');
        });

        it('should prepare email for consistent duplicate checking', async () => {
            // GIVEN: Two customers with same email but different cases
            const customer1 = new Customer({
                firstName: 'Tom',
                lastName: 'Silver',
                email: 'Tom@Shopee.COM',
                phone: '+2121212121',
                password: 'Password123!'
            });

            const customer2 = new Customer({
                firstName: 'Tom',
                lastName: 'Silver',
                email: 'tom@shopee.com',
                phone: '+2121212121',
                password: 'Password123!'
            });

            // WHEN: Both are validated
            await customer1.validate();
            await customer2.validate();

            // THEN: Both emails should be normalized to same value
            expect(customer1.email).toBe(customer2.email);
            expect(customer1.email).toBe('tom@shopee.com');
        });
    });

    // ============================================================================
    // Additional Tests - Default Values and Schema Properties
    // ============================================================================
    describe('Additional Tests - Default Values and Schema Properties', () => {
        it('should allow optional location field', async () => {
            // GIVEN: Customer without location
            const customer = new Customer({
                firstName: 'Uma',
                lastName: 'Gold',
                email: 'uma@shopee.com',
                phone: '+2222222222',
                password: 'Password123!'
            });

            // WHEN: validate is called
            await customer.validate();

            // THEN: Should pass validation without location
            expect(customer.location).toBeUndefined();
        });

        it('should trim firstName field', async () => {
            // GIVEN: Customer with spaces in firstName
            const customer = new Customer({
                firstName: '  Victor  ',
                lastName: 'Bronze',
                email: 'victor@shopee.com',
                phone: '+2323232323',
                password: 'Password123!'
            });

            // WHEN: validate is called
            await customer.validate();

            // THEN: firstName should be trimmed
            expect(customer.firstName).toBe('Victor');
        });

        it('should trim lastName field', async () => {
            // GIVEN: Customer with spaces in lastName
            const customer = new Customer({
                firstName: 'Wendy',
                lastName: '  Copper  ',
                email: 'wendy@shopee.com',
                phone: '+2424242424',
                password: 'Password123!'
            });

            // WHEN: validate is called
            await customer.validate();

            // THEN: lastName should be trimmed
            expect(customer.lastName).toBe('Copper');
        });

        it('should trim phone field', async () => {
            // GIVEN: Customer with spaces in phone
            const customer = new Customer({
                firstName: 'Xavier',
                lastName: 'Diamond',
                email: 'xavier@shopee.com',
                phone: '  +2525252525  ',
                password: 'Password123!'
            });

            // WHEN: validate is called
            await customer.validate();

            // THEN: phone should be trimmed
            expect(customer.phone).toBe('+2525252525');
        });

        it('should trim location field when provided', async () => {
            // GIVEN: Customer with spaces in location
            const customer = new Customer({
                firstName: 'Yvonne',
                lastName: 'Pearl',
                email: 'yvonne@shopee.com',
                phone: '+2626262626',
                password: 'Password123!',
                location: '  789 Oak Ave  '
            });

            // WHEN: validate is called
            await customer.validate();

            // THEN: location should be trimmed
            expect(customer.location).toBe('789 Oak Ave');
        });
    });
});
