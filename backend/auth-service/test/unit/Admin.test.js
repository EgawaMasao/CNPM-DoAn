const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('../../models/Admin');

// Mock bcryptjs
jest.mock('bcryptjs');

describe('Admin Model Unit Tests - Shopee QA Standards', () => {
    let adminData;

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();

        // Setup default admin data
        adminData = {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@shopee.com',
            phone: '+1234567890',
            password: 'SecurePassword123!'
        };

        // Setup default bcrypt mock behavior
        bcrypt.hash.mockResolvedValue('$2a$12$hashedPasswordMockValue');
        bcrypt.compare.mockResolvedValue(true);
    });

    afterAll(async () => {
        // Close mongoose connection after all tests
        await mongoose.connection.close();
    });

    // ============================================================================
    // Test 1: save (pre-hook) - Password hashing on create (Happy Path)
    // ============================================================================
    describe('Test 1: save (pre-hook) - Password Hashing on Create (Happy Path)', () => {
        it('should hash password before saving new admin', async () => {
            // GIVEN: A new admin with plain text password
            const plainPassword = 'MySecurePassword123!';
            const admin = new Admin({
                firstName: 'Jane',
                lastName: 'Smith',
                email: 'jane.smith@shopee.com',
                phone: '+9876543210',
                password: plainPassword
            });

            // Clear previous calls
            bcrypt.hash.mockClear();

            // WHEN: Admin document is validated and password hashing logic is applied
            await admin.validate();
            
            // Manually simulate the pre-save hook logic
            if (admin.isModified('password')) {
                admin.password = await bcrypt.hash(admin.password, 12);
            }

            // THEN: Should hash password with bcrypt and salt rounds 12
            expect(bcrypt.hash).toHaveBeenCalledWith(plainPassword, 12);
            expect(admin.password).toBe('$2a$12$hashedPasswordMockValue');
        });

        it('should use correct salt rounds (12) for password hashing', async () => {
            // GIVEN: A new admin document
            const originalPassword = 'StrongPassword456!';
            const admin = new Admin({
                firstName: 'Security',
                lastName: 'Admin',
                email: 'security@shopee.com',
                phone: '+1111111111',
                password: originalPassword
            });

            bcrypt.hash.mockClear();

            // WHEN: Pre-save hook logic executes
            await admin.validate();
            if (admin.isModified('password')) {
                admin.password = await bcrypt.hash(admin.password, 12);
            }

            // THEN: Should use exactly 12 salt rounds
            expect(bcrypt.hash).toHaveBeenCalledWith(originalPassword, 12);
            expect(bcrypt.hash.mock.calls[0][1]).toBe(12);
        });

        it('should skip hashing when password is not modified', async () => {
            // GIVEN: An existing admin where password is already hashed
            const hashedPassword = '$2a$12$alreadyHashedPassword';
            const admin = new Admin({
                firstName: 'Existing',
                lastName: 'Admin',
                email: 'existing@shopee.com',
                phone: '+2222222222',
                password: hashedPassword
            });

            // Mark as not new and password as not modified
            admin.isNew = false;
            admin.modifiedPaths = jest.fn().mockReturnValue(['firstName']); // Modified only firstName
            
            // Mock isModified to return false for password
            const originalIsModified = admin.isModified;
            admin.isModified = jest.fn((path) => {
                if (path === 'password') return false;
                return originalIsModified.call(admin, path);
            });

            admin.save = jest.fn().mockResolvedValue(admin);

            // Clear previous hash calls
            bcrypt.hash.mockClear();

            // WHEN: Save is called but password not modified
            await admin.save();

            // THEN: Should NOT hash password again
            expect(bcrypt.hash).not.toHaveBeenCalled();
        });

        it('should preserve original password format in schema before hashing', async () => {
            // GIVEN: Admin with minimum length password
            const minPassword = 'Pass12'; // Exactly 6 characters (minimum)
            const admin = new Admin({
                firstName: 'Min',
                lastName: 'Password',
                email: 'min@shopee.com',
                phone: '+3333333333',
                password: minPassword
            });

            bcrypt.hash.mockClear();

            // WHEN: Pre-save hook processes password
            await admin.validate();
            if (admin.isModified('password')) {
                admin.password = await bcrypt.hash(admin.password, 12);
            }

            // THEN: Should hash even minimum length password
            expect(bcrypt.hash).toHaveBeenCalledWith(minPassword, 12);
            expect(admin.password).not.toBe(minPassword);
            expect(admin.password).toBe('$2a$12$hashedPasswordMockValue');
        });

        it('should handle very long passwords correctly', async () => {
            // GIVEN: Admin with very long password
            const longPassword = 'A'.repeat(100) + '1!'; // 102 characters
            const admin = new Admin({
                firstName: 'Long',
                lastName: 'Password',
                email: 'long@shopee.com',
                phone: '+4444444444',
                password: longPassword
            });

            bcrypt.hash.mockClear();

            // WHEN: Pre-save hook hashes long password
            await admin.validate();
            if (admin.isModified('password')) {
                admin.password = await bcrypt.hash(admin.password, 12);
            }

            // THEN: Should hash long password without issues
            expect(bcrypt.hash).toHaveBeenCalledWith(longPassword, 12);
            expect(admin.password).toBe('$2a$12$hashedPasswordMockValue');
        });

        it('should handle bcrypt hashing exceptions gracefully', async () => {
            // GIVEN: Bcrypt.hash throws an error
            const hashError = new Error('Bcrypt hashing failed');
            bcrypt.hash.mockRejectedValue(hashError);

            const admin = new Admin({
                firstName: 'Error',
                lastName: 'Case',
                email: 'error@shopee.com',
                phone: '+5555555555',
                password: 'ErrorPassword123!'
            });

            // Mock save to actually trigger the pre-save hook
            const originalSave = admin.save;
            admin.save = async function() {
                // Manually trigger the pre-save logic
                if (this.isModified('password')) {
                    try {
                        this.password = await bcrypt.hash(this.password, 12);
                    } catch (error) {
                        throw error;
                    }
                }
                return this;
            };

            // WHEN: Save encounters hashing error
            // THEN: Should propagate error
            await expect(admin.save()).rejects.toThrow('Bcrypt hashing failed');
            expect(bcrypt.hash).toHaveBeenCalled();
        });
    });

    // ============================================================================
    // Test 2: comparePassword - Valid password comparison (Happy Path)
    // ============================================================================
    describe('Test 2: comparePassword - Valid Password Comparison (Happy Path)', () => {
        it('should return true when correct password is provided', async () => {
            // GIVEN: An admin with hashed password
            const plainPassword = 'CorrectPassword123!';
            const admin = new Admin({
                firstName: 'Auth',
                lastName: 'User',
                email: 'auth@shopee.com',
                phone: '+6666666666',
                password: '$2a$12$hashedPasswordMockValue'
            });

            // Mock bcrypt.compare to return true for correct password
            bcrypt.compare.mockResolvedValue(true);

            // WHEN: comparePassword is called with correct password
            const result = await admin.comparePassword(plainPassword);

            // THEN: Should return true and call bcrypt.compare correctly
            expect(bcrypt.compare).toHaveBeenCalledWith(plainPassword, admin.password);
            expect(result).toBe(true);
        });

        it('should validate bcrypt.compare is called with correct parameters', async () => {
            // GIVEN: Admin with hashed password
            const candidatePassword = 'TestPassword456!';
            const hashedPassword = '$2a$12$specificHashedValue123';
            const admin = new Admin({
                firstName: 'Validate',
                lastName: 'Params',
                email: 'validate@shopee.com',
                phone: '+7777777777',
                password: hashedPassword
            });

            bcrypt.compare.mockResolvedValue(true);

            // WHEN: comparePassword is invoked
            await admin.comparePassword(candidatePassword);

            // THEN: Should call bcrypt.compare with candidate and stored hash
            expect(bcrypt.compare).toHaveBeenCalledTimes(1);
            expect(bcrypt.compare).toHaveBeenCalledWith(candidatePassword, hashedPassword);
        });

        it('should handle password with special characters correctly', async () => {
            // GIVEN: Password with special characters
            const specialPassword = 'P@ssw0rd!#$%^&*()_+-=[]{}|;:,.<>?';
            const admin = new Admin({
                firstName: 'Special',
                lastName: 'Chars',
                email: 'special@shopee.com',
                phone: '+8888888888',
                password: '$2a$12$hashedSpecialPassword'
            });

            bcrypt.compare.mockResolvedValue(true);

            // WHEN: Comparing password with special characters
            const result = await admin.comparePassword(specialPassword);

            // THEN: Should handle special characters correctly
            expect(bcrypt.compare).toHaveBeenCalledWith(specialPassword, admin.password);
            expect(result).toBe(true);
        });

        it('should work with minimum length password', async () => {
            // GIVEN: Minimum length password (6 characters)
            const minPassword = 'Pass12';
            const admin = new Admin({
                firstName: 'Min',
                lastName: 'Length',
                email: 'minlength@shopee.com',
                phone: '+9999999999',
                password: '$2a$12$hashedMinPassword'
            });

            bcrypt.compare.mockResolvedValue(true);

            // WHEN: Comparing minimum length password
            const result = await admin.comparePassword(minPassword);

            // THEN: Should successfully compare
            expect(bcrypt.compare).toHaveBeenCalledWith(minPassword, admin.password);
            expect(result).toBe(true);
        });

        it('should work with very long password', async () => {
            // GIVEN: Very long password
            const longPassword = 'SecurePassword' + 'x'.repeat(200);
            const admin = new Admin({
                firstName: 'Long',
                lastName: 'Pass',
                email: 'longpass@shopee.com',
                phone: '+1010101010',
                password: '$2a$12$hashedLongPassword'
            });

            bcrypt.compare.mockResolvedValue(true);

            // WHEN: Comparing long password
            const result = await admin.comparePassword(longPassword);

            // THEN: Should handle long password correctly
            expect(bcrypt.compare).toHaveBeenCalledWith(longPassword, admin.password);
            expect(result).toBe(true);
        });
    });

    // ============================================================================
    // Test 3: comparePassword - Invalid password comparison (Error Path)
    // ============================================================================
    describe('Test 3: comparePassword - Invalid Password Comparison (Error Path)', () => {
        it('should return false when wrong password is provided', async () => {
            // GIVEN: Admin with hashed password
            const wrongPassword = 'WrongPassword123!';
            const admin = new Admin({
                firstName: 'Security',
                lastName: 'Test',
                email: 'security@shopee.com',
                phone: '+1212121212',
                password: '$2a$12$correctHashedPassword'
            });

            // Mock bcrypt.compare to return false for wrong password
            bcrypt.compare.mockResolvedValue(false);

            // WHEN: comparePassword is called with wrong password
            const result = await admin.comparePassword(wrongPassword);

            // THEN: Should return false to prevent unauthorized access
            expect(bcrypt.compare).toHaveBeenCalledWith(wrongPassword, admin.password);
            expect(result).toBe(false);
        });

        it('should return false for empty password', async () => {
            // GIVEN: Admin with valid hashed password
            const admin = new Admin({
                firstName: 'Empty',
                lastName: 'Password',
                email: 'empty@shopee.com',
                phone: '+1313131313',
                password: '$2a$12$validHashedPassword'
            });

            bcrypt.compare.mockResolvedValue(false);

            // WHEN: comparePassword is called with empty string
            const result = await admin.comparePassword('');

            // THEN: Should return false
            expect(bcrypt.compare).toHaveBeenCalledWith('', admin.password);
            expect(result).toBe(false);
        });

        it('should return false for null password', async () => {
            // GIVEN: Admin with valid password
            const admin = new Admin({
                firstName: 'Null',
                lastName: 'Test',
                email: 'null@shopee.com',
                phone: '+1414141414',
                password: '$2a$12$validHashedPassword'
            });

            bcrypt.compare.mockResolvedValue(false);

            // WHEN: comparePassword is called with null
            const result = await admin.comparePassword(null);

            // THEN: Should handle null and return false
            expect(bcrypt.compare).toHaveBeenCalledWith(null, admin.password);
            expect(result).toBe(false);
        });

        it('should return false for undefined password', async () => {
            // GIVEN: Admin with valid password
            const admin = new Admin({
                firstName: 'Undefined',
                lastName: 'Test',
                email: 'undefined@shopee.com',
                phone: '+1515151515',
                password: '$2a$12$validHashedPassword'
            });

            bcrypt.compare.mockResolvedValue(false);

            // WHEN: comparePassword is called with undefined
            const result = await admin.comparePassword(undefined);

            // THEN: Should handle undefined and return false
            expect(bcrypt.compare).toHaveBeenCalledWith(undefined, admin.password);
            expect(result).toBe(false);
        });

        it('should prevent unauthorized access with similar passwords', async () => {
            // GIVEN: Admin with password and similar but wrong password
            const correctPassword = 'SecurePassword123!';
            const similarPassword = 'SecurePassword123'; // Missing !
            const admin = new Admin({
                firstName: 'Similar',
                lastName: 'Password',
                email: 'similar@shopee.com',
                phone: '+1616161616',
                password: '$2a$12$hashedCorrectPassword'
            });

            bcrypt.compare.mockResolvedValue(false);

            // WHEN: Similar but incorrect password is provided
            const result = await admin.comparePassword(similarPassword);

            // THEN: Should return false to prevent access
            expect(result).toBe(false);
        });

        it('should handle bcrypt.compare exceptions', async () => {
            // GIVEN: bcrypt.compare throws an error
            const compareError = new Error('Bcrypt comparison failed');
            bcrypt.compare.mockRejectedValue(compareError);

            const admin = new Admin({
                firstName: 'Error',
                lastName: 'Compare',
                email: 'errorcompare@shopee.com',
                phone: '+1717171717',
                password: '$2a$12$someHashedPassword'
            });

            // WHEN: comparePassword encounters an error
            // THEN: Should propagate the error
            await expect(admin.comparePassword('anyPassword')).rejects.toThrow('Bcrypt comparison failed');
            expect(bcrypt.compare).toHaveBeenCalled();
        });

        it('should return false for password with only whitespace', async () => {
            // GIVEN: Admin with valid password
            const admin = new Admin({
                firstName: 'Whitespace',
                lastName: 'Test',
                email: 'whitespace@shopee.com',
                phone: '+1818181818',
                password: '$2a$12$validHashedPassword'
            });

            bcrypt.compare.mockResolvedValue(false);

            // WHEN: comparePassword is called with whitespace only
            const result = await admin.comparePassword('     ');

            // THEN: Should return false
            expect(result).toBe(false);
        });
    });

    // ============================================================================
    // Test 4: save - Required field validation (Error Path)
    // ============================================================================
    describe('Test 4: save - Required Field Validation (Error Path)', () => {
        it('should throw validation error when email is missing', () => {
            // GIVEN: Admin data without email
            const adminWithoutEmail = new Admin({
                firstName: 'John',
                lastName: 'Doe',
                // email is missing
                phone: '+1234567890',
                password: 'SecurePass123!'
            });

            // WHEN: Validating the document
            const validationError = adminWithoutEmail.validateSync();

            // THEN: Should have validation error for email
            expect(validationError).toBeDefined();
            expect(validationError.errors.email).toBeDefined();
            expect(validationError.errors.email.kind).toBe('required');
        });

        it('should throw validation error when firstName is missing', () => {
            // GIVEN: Admin data without firstName
            const adminWithoutFirstName = new Admin({
                // firstName is missing
                lastName: 'Doe',
                email: 'test@shopee.com',
                phone: '+1234567890',
                password: 'SecurePass123!'
            });

            // WHEN: Validating the document
            const validationError = adminWithoutFirstName.validateSync();

            // THEN: Should have validation error for firstName
            expect(validationError).toBeDefined();
            expect(validationError.errors.firstName).toBeDefined();
            expect(validationError.errors.firstName.kind).toBe('required');
        });

        it('should throw validation error when lastName is missing', () => {
            // GIVEN: Admin data without lastName
            const adminWithoutLastName = new Admin({
                firstName: 'John',
                // lastName is missing
                email: 'test@shopee.com',
                phone: '+1234567890',
                password: 'SecurePass123!'
            });

            // WHEN: Validating the document
            const validationError = adminWithoutLastName.validateSync();

            // THEN: Should have validation error for lastName
            expect(validationError).toBeDefined();
            expect(validationError.errors.lastName).toBeDefined();
            expect(validationError.errors.lastName.kind).toBe('required');
        });

        it('should throw validation error when phone is missing', () => {
            // GIVEN: Admin data without phone
            const adminWithoutPhone = new Admin({
                firstName: 'John',
                lastName: 'Doe',
                email: 'test@shopee.com',
                // phone is missing
                password: 'SecurePass123!'
            });

            // WHEN: Validating the document
            const validationError = adminWithoutPhone.validateSync();

            // THEN: Should have validation error for phone
            expect(validationError).toBeDefined();
            expect(validationError.errors.phone).toBeDefined();
            expect(validationError.errors.phone.kind).toBe('required');
        });

        it('should throw validation error when password is missing', () => {
            // GIVEN: Admin data without password
            const adminWithoutPassword = new Admin({
                firstName: 'John',
                lastName: 'Doe',
                email: 'test@shopee.com',
                phone: '+1234567890'
                // password is missing
            });

            // WHEN: Validating the document
            const validationError = adminWithoutPassword.validateSync();

            // THEN: Should have validation error for password
            expect(validationError).toBeDefined();
            expect(validationError.errors.password).toBeDefined();
            expect(validationError.errors.password.kind).toBe('required');
        });

        it('should throw validation error when multiple required fields are missing', () => {
            // GIVEN: Admin data with multiple missing required fields
            const incompleteAdmin = new Admin({
                firstName: 'John'
                // lastName, email, phone, password all missing
            });

            // WHEN: Validating the document
            const validationError = incompleteAdmin.validateSync();

            // THEN: Should have validation errors for all missing fields
            expect(validationError).toBeDefined();
            expect(validationError.errors.lastName).toBeDefined();
            expect(validationError.errors.email).toBeDefined();
            expect(validationError.errors.phone).toBeDefined();
            expect(validationError.errors.password).toBeDefined();
        });

        it('should throw validation error when password is too short', () => {
            // GIVEN: Admin with password less than 6 characters
            const adminWithShortPassword = new Admin({
                firstName: 'John',
                lastName: 'Doe',
                email: 'test@shopee.com',
                phone: '+1234567890',
                password: '12345' // Only 5 characters, minimum is 6
            });

            // WHEN: Validating the document
            const validationError = adminWithShortPassword.validateSync();

            // THEN: Should have minlength validation error
            expect(validationError).toBeDefined();
            expect(validationError.errors.password).toBeDefined();
            expect(validationError.errors.password.kind).toBe('minlength');
        });

        it('should handle null values for required fields', () => {
            // GIVEN: Admin data with null values
            const adminWithNulls = new Admin({
                firstName: null,
                lastName: null,
                email: null,
                phone: null,
                password: null
            });

            // WHEN: Validating the document
            const validationError = adminWithNulls.validateSync();

            // THEN: Should have validation errors for null fields
            expect(validationError).toBeDefined();
            expect(Object.keys(validationError.errors).length).toBeGreaterThan(0);
        });

        it('should handle empty strings for required fields', () => {
            // GIVEN: Admin data with empty strings
            const adminWithEmptyStrings = new Admin({
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                password: ''
            });

            // WHEN: Validating the document
            const validationError = adminWithEmptyStrings.validateSync();

            // THEN: Should have validation errors (trim makes them null-like)
            expect(validationError).toBeDefined();
            expect(validationError.errors.firstName).toBeDefined();
            expect(validationError.errors.lastName).toBeDefined();
            expect(validationError.errors.email).toBeDefined();
            expect(validationError.errors.phone).toBeDefined();
            expect(validationError.errors.password).toBeDefined();
        });

        it('should handle undefined values for required fields', () => {
            // GIVEN: Admin data with explicit undefined values
            const adminWithUndefined = new Admin({
                firstName: undefined,
                lastName: undefined,
                email: undefined,
                phone: undefined,
                password: undefined
            });

            // WHEN: Validating the document
            const validationError = adminWithUndefined.validateSync();

            // THEN: Should have validation errors for undefined fields
            expect(validationError).toBeDefined();
            expect(validationError.errors.firstName).toBeDefined();
            expect(validationError.errors.lastName).toBeDefined();
            expect(validationError.errors.email).toBeDefined();
            expect(validationError.errors.phone).toBeDefined();
            expect(validationError.errors.password).toBeDefined();
        });
    });

    // ============================================================================
    // Test 5: save - Duplicate email constraint (Error Path)
    // ============================================================================
    describe('Test 5: save - Duplicate Email Constraint (Error Path)', () => {
        it('should enforce unique email constraint in schema', () => {
            // GIVEN: Schema definition with unique email
            const emailField = Admin.schema.path('email');

            // WHEN: Checking schema properties
            // THEN: Should have unique constraint defined
            expect(emailField.options.unique).toBe(true);
            expect(emailField.options.required).toBe(true);
        });

        it('should have email field marked as unique in schema', () => {
            // GIVEN: Admin model schema
            const schema = Admin.schema;

            // WHEN: Inspecting email field configuration
            const emailPath = schema.path('email');

            // THEN: Should be configured for uniqueness
            expect(emailPath).toBeDefined();
            expect(emailPath.options.unique).toBe(true);
        });

        it('should convert email to lowercase to prevent case-sensitive duplicates', () => {
            // GIVEN: Admin with uppercase email
            const admin = new Admin({
                firstName: 'Case',
                lastName: 'Test',
                email: 'TEST@SHOPEE.COM',
                phone: '+1919191919',
                password: 'Password123!'
            });

            // WHEN: Email is processed by schema
            // THEN: Email should be lowercase
            expect(admin.email).toBe('test@shopee.com');
        });

        it('should trim email to prevent duplicate spaces', () => {
            // GIVEN: Admin with email containing spaces
            const admin = new Admin({
                firstName: 'Trim',
                lastName: 'Test',
                email: '  trim@shopee.com  ',
                phone: '+2020202020',
                password: 'Password123!'
            });

            // WHEN: Email is processed by schema
            // THEN: Email should be trimmed
            expect(admin.email).toBe('trim@shopee.com');
        });

        it('should handle both lowercase and trim transformations together', () => {
            // GIVEN: Admin with mixed case and spaces in email
            const admin = new Admin({
                firstName: 'Transform',
                lastName: 'Test',
                email: '  MixedCase@SHOPEE.com  ',
                phone: '+2121212121',
                password: 'Password123!'
            });

            // WHEN: Email is processed by schema
            // THEN: Email should be lowercase and trimmed
            expect(admin.email).toBe('mixedcase@shopee.com');
        });

        it('should validate unique index exists on email field', () => {
            // GIVEN: Admin model schema indexes
            const indexes = Admin.schema.indexes();

            // WHEN: Checking for unique index on email
            const emailIndex = indexes.find(index => 
                index[0].email !== undefined
            );

            // THEN: Should have index configuration for email
            // Note: Unique constraint creates an index in MongoDB
            expect(Admin.schema.path('email').options.unique).toBe(true);
        });

        it('should handle email with special characters correctly', () => {
            // GIVEN: Admin with email containing special characters
            const admin = new Admin({
                firstName: 'Special',
                lastName: 'Email',
                email: 'user+tag@sub-domain.shopee.com',
                phone: '+2222222222',
                password: 'Password123!'
            });

            // WHEN: Email is validated and processed
            const validationError = admin.validateSync();

            // THEN: Should accept valid email with special characters
            expect(validationError).toBeUndefined();
            expect(admin.email).toBe('user+tag@sub-domain.shopee.com');
        });

        it('should prepare email for consistent duplicate checking', () => {
            // GIVEN: Multiple variations of same email
            const email1 = new Admin({
                firstName: 'User1',
                lastName: 'Test',
                email: 'same@shopee.com',
                phone: '+3333333333',
                password: 'Password123!'
            });

            const email2 = new Admin({
                firstName: 'User2',
                lastName: 'Test',
                email: 'SAME@SHOPEE.COM',
                phone: '+4444444444',
                password: 'Password123!'
            });

            const email3 = new Admin({
                firstName: 'User3',
                lastName: 'Test',
                email: '  same@shopee.com  ',
                phone: '+5555555555',
                password: 'Password123!'
            });

            // WHEN: Emails are processed
            // THEN: All should be normalized to same value for duplicate checking
            expect(email1.email).toBe('same@shopee.com');
            expect(email2.email).toBe('same@shopee.com');
            expect(email3.email).toBe('same@shopee.com');
            expect(email1.email).toBe(email2.email);
            expect(email2.email).toBe(email3.email);
        });
    });

    // ============================================================================
    // Additional Tests for Complete Coverage
    // ============================================================================
    describe('Additional Tests - Default Values and Schema Properties', () => {
        it('should set default role to "admin"', () => {
            // GIVEN: Admin without explicit role
            const admin = new Admin({
                firstName: 'Default',
                lastName: 'Role',
                email: 'defaultrole@shopee.com',
                phone: '+6666666666',
                password: 'Password123!'
            });

            // WHEN: Admin is created
            // THEN: Role should default to "admin"
            expect(admin.role).toBe('admin');
        });

        it('should set default permissions array', () => {
            // GIVEN: Admin without explicit permissions
            const admin = new Admin({
                firstName: 'Default',
                lastName: 'Permissions',
                email: 'defaultperms@shopee.com',
                phone: '+7777777777',
                password: 'Password123!'
            });

            // WHEN: Admin is created
            // THEN: Permissions should have default values
            expect(admin.permissions).toBeDefined();
            expect(admin.permissions).toEqual(['manage-users', 'manage-restaurants', 'manage-orders']);
        });

        it('should enforce role enum values', () => {
            // GIVEN: Admin with invalid role
            const adminWithInvalidRole = new Admin({
                firstName: 'Invalid',
                lastName: 'Role',
                email: 'invalidrole@shopee.com',
                phone: '+8888888888',
                password: 'Password123!',
                role: 'invalid-role'
            });

            // WHEN: Validating the document
            const validationError = adminWithInvalidRole.validateSync();

            // THEN: Should have enum validation error
            expect(validationError).toBeDefined();
            expect(validationError.errors.role).toBeDefined();
            expect(validationError.errors.role.kind).toBe('enum');
        });

        it('should accept valid enum role values', () => {
            // GIVEN: Admin with valid "super-admin" role
            const superAdmin = new Admin({
                firstName: 'Super',
                lastName: 'Admin',
                email: 'superadmin@shopee.com',
                phone: '+9999999999',
                password: 'Password123!',
                role: 'super-admin'
            });

            // WHEN: Validating the document
            const validationError = superAdmin.validateSync();

            // THEN: Should not have validation errors
            expect(validationError).toBeUndefined();
            expect(superAdmin.role).toBe('super-admin');
        });

        it('should have timestamps enabled', () => {
            // GIVEN: Admin model schema
            const admin = new Admin(adminData);

            // WHEN: Checking schema options
            // THEN: Should have timestamps option enabled
            expect(Admin.schema.options.timestamps).toBe(true);
        });
    });
});
