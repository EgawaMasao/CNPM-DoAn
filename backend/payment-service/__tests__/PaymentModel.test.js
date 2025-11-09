// backend/payment-service/__tests__/PaymentModel.test.js
const mongoose = require('mongoose');
const Payment = require('../models/PaymentModel');

// Mock mongoose connection
jest.mock('../config/db', () => jest.fn());

describe('PaymentModel Unit Tests - Shopee QA Standards', () => {
    let mockDateNow;

    beforeAll(async () => {
        // Setup in-memory MongoDB for testing
        await mongoose.connect('mongodb://127.0.0.1:27017/payment-service-test', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
    });

    afterAll(async () => {
        // Cleanup
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        // Clear all documents before each test
        await Payment.deleteMany({});
        
        // Mock Date.now for consistent timestamp testing
        mockDateNow = jest.spyOn(Date, 'now');
        mockDateNow.mockReturnValue(1699507200000); // Fixed timestamp
    });

    afterEach(() => {
        // Restore Date.now
        mockDateNow.mockRestore();
    });

    // ============================================================================
    // Test 1: Schema validation - Validates all required fields (Happy Path)
    // ============================================================================
    describe('Test 1: Schema Validation - All Required Fields Enforced (Happy Path)', () => {
        it('should accept payment with all required fields', async () => {
            // GIVEN: Valid payment data with all required fields
            const validPaymentData = {
                orderId: 'ORDER-12345',
                userId: 'USER-67890',
                amount: 99.99,
                email: 'customer@example.com',
                phone: '+1234567890'
            };

            // WHEN: Creating a new payment instance
            const payment = new Payment(validPaymentData);
            const savedPayment = await payment.save();

            // THEN: Should save successfully with all required fields
            expect(savedPayment.orderId).toBe('ORDER-12345');
            expect(savedPayment.userId).toBe('USER-67890');
            expect(savedPayment.amount).toBe(99.99);
            expect(savedPayment.email).toBe('customer@example.com');
            expect(savedPayment.phone).toBe('+1234567890');
            expect(savedPayment._id).toBeDefined();
        });

        it('should enforce orderId as required field', async () => {
            // GIVEN: Payment data without orderId
            const paymentWithoutOrderId = new Payment({
                userId: 'USER-67890',
                amount: 99.99,
                email: 'customer@example.com',
                phone: '+1234567890'
            });

            // WHEN: Attempting to save without orderId
            // THEN: Should throw validation error
            await expect(paymentWithoutOrderId.save()).rejects.toThrow();
        });

        it('should enforce userId as required field', async () => {
            // GIVEN: Payment data without userId
            const paymentWithoutUserId = new Payment({
                orderId: 'ORDER-12345',
                amount: 99.99,
                email: 'customer@example.com',
                phone: '+1234567890'
            });

            // WHEN: Attempting to save without userId
            // THEN: Should throw validation error
            await expect(paymentWithoutUserId.save()).rejects.toThrow();
        });

        it('should enforce amount as required field', async () => {
            // GIVEN: Payment data without amount
            const paymentWithoutAmount = new Payment({
                orderId: 'ORDER-12345',
                userId: 'USER-67890',
                email: 'customer@example.com',
                phone: '+1234567890'
            });

            // WHEN: Attempting to save without amount
            // THEN: Should throw validation error
            await expect(paymentWithoutAmount.save()).rejects.toThrow();
        });

        it('should enforce email as required field', async () => {
            // GIVEN: Payment data without email
            const paymentWithoutEmail = new Payment({
                orderId: 'ORDER-12345',
                userId: 'USER-67890',
                amount: 99.99,
                phone: '+1234567890'
            });

            // WHEN: Attempting to save without email
            // THEN: Should throw validation error
            await expect(paymentWithoutEmail.save()).rejects.toThrow();
        });

        it('should enforce phone as required field', async () => {
            // GIVEN: Payment data without phone
            const paymentWithoutPhone = new Payment({
                orderId: 'ORDER-12345',
                userId: 'USER-67890',
                amount: 99.99,
                email: 'customer@example.com'
            });

            // WHEN: Attempting to save without phone
            // THEN: Should throw validation error
            await expect(paymentWithoutPhone.save()).rejects.toThrow();
        });

        it('should validate schema with optional fields included', async () => {
            // GIVEN: Valid payment data with optional fields
            const paymentWithOptionalFields = {
                orderId: 'ORDER-54321',
                userId: 'USER-98765',
                amount: 149.99,
                currency: 'eur',
                email: 'premium@example.com',
                phone: '+9876543210',
                status: 'Paid',
                stripePaymentIntentId: 'pi_test_123',
                stripeClientSecret: 'pi_test_123_secret_abc'
            };

            // WHEN: Creating payment with optional fields
            const payment = new Payment(paymentWithOptionalFields);
            const savedPayment = await payment.save();

            // THEN: Should save with all fields including optional ones
            expect(savedPayment.currency).toBe('eur');
            expect(savedPayment.status).toBe('Paid');
            expect(savedPayment.stripePaymentIntentId).toBe('pi_test_123');
            expect(savedPayment.stripeClientSecret).toBe('pi_test_123_secret_abc');
        });
    });

    // ============================================================================
    // Test 2: save() - Creates payment with auto-generated timestamps (Happy Path)
    // ============================================================================
    describe('Test 2: save() - Payment Creation with Auto-Generated Timestamps (Happy Path)', () => {
        it('should create payment with createdAt timestamp automatically', async () => {
            // GIVEN: Valid payment data
            const paymentData = {
                orderId: 'ORDER-TIMESTAMP-1',
                userId: 'USER-TIME-1',
                amount: 50.00,
                email: 'timestamp@example.com',
                phone: '+1111111111'
            };

            // WHEN: Saving new payment
            const payment = new Payment(paymentData);
            const savedPayment = await payment.save();

            // THEN: Should have createdAt timestamp automatically set
            expect(savedPayment.createdAt).toBeDefined();
            expect(savedPayment.createdAt).toBeInstanceOf(Date);
        });

        it('should create payment with updatedAt timestamp automatically', async () => {
            // GIVEN: Valid payment data
            const paymentData = {
                orderId: 'ORDER-TIMESTAMP-2',
                userId: 'USER-TIME-2',
                amount: 75.50,
                email: 'updated@example.com',
                phone: '+2222222222'
            };

            // WHEN: Saving new payment
            const payment = new Payment(paymentData);
            const savedPayment = await payment.save();

            // THEN: Should have updatedAt timestamp automatically set
            expect(savedPayment.updatedAt).toBeDefined();
            expect(savedPayment.updatedAt).toBeInstanceOf(Date);
        });

        it('should set createdAt and updatedAt on initial save', async () => {
            // GIVEN: Valid payment data for first save
            const paymentData = {
                orderId: 'ORDER-TIMESTAMP-3',
                userId: 'USER-TIME-3',
                amount: 100.00,
                email: 'initial@example.com',
                phone: '+3333333333'
            };

            // WHEN: Saving payment for the first time
            const payment = new Payment(paymentData);
            const savedPayment = await payment.save();

            // THEN: Both createdAt and updatedAt should be set
            expect(savedPayment.createdAt).toBeDefined();
            expect(savedPayment.createdAt).toBeInstanceOf(Date);
            expect(savedPayment.updatedAt).toBeDefined();
            expect(savedPayment.updatedAt).toBeInstanceOf(Date);
        });

        it('should update updatedAt timestamp on subsequent saves', async () => {
            // GIVEN: Existing payment saved once
            const paymentData = {
                orderId: 'ORDER-TIMESTAMP-4',
                userId: 'USER-TIME-4',
                amount: 125.75,
                email: 'subsequent@example.com',
                phone: '+4444444444'
            };

            const payment = new Payment(paymentData);
            const savedPayment = await payment.save();
            const initialUpdatedAt = savedPayment.updatedAt.getTime();

            // Wait a bit and update with new timestamp
            mockDateNow.mockReturnValue(1699507300000); // Different timestamp

            // WHEN: Updating payment and saving again
            savedPayment.status = 'Paid';
            const updatedPayment = await savedPayment.save();

            // THEN: updatedAt should be refreshed but createdAt should remain same
            expect(updatedPayment.createdAt.getTime()).toBe(savedPayment.createdAt.getTime());
            expect(updatedPayment.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt);
        });

        it('should save payment with default currency value', async () => {
            // GIVEN: Payment without explicit currency
            const paymentData = {
                orderId: 'ORDER-CURRENCY-1',
                userId: 'USER-CURRENCY-1',
                amount: 88.88,
                email: 'currency@example.com',
                phone: '+5555555555'
            };

            // WHEN: Saving payment without currency
            const payment = new Payment(paymentData);
            const savedPayment = await payment.save();

            // THEN: Should default to 'usd'
            expect(savedPayment.currency).toBe('usd');
        });

        it('should save payment with default status value', async () => {
            // GIVEN: Payment without explicit status
            const paymentData = {
                orderId: 'ORDER-STATUS-1',
                userId: 'USER-STATUS-1',
                amount: 66.66,
                email: 'status@example.com',
                phone: '+6666666666'
            };

            // WHEN: Saving payment without status
            const payment = new Payment(paymentData);
            const savedPayment = await payment.save();

            // THEN: Should default to 'Pending'
            expect(savedPayment.status).toBe('Pending');
        });

        it('should save all fields correctly in database', async () => {
            // GIVEN: Complete payment data
            const completePaymentData = {
                orderId: 'ORDER-COMPLETE-1',
                userId: 'USER-COMPLETE-1',
                amount: 199.99,
                currency: 'gbp',
                status: 'Paid',
                email: 'complete@example.com',
                phone: '+7777777777',
                stripePaymentIntentId: 'pi_complete_123',
                stripeClientSecret: 'pi_complete_123_secret'
            };

            // WHEN: Saving complete payment
            const payment = new Payment(completePaymentData);
            const savedPayment = await payment.save();

            // Retrieve from database to verify persistence
            const retrievedPayment = await Payment.findById(savedPayment._id);

            // THEN: All fields should persist correctly
            expect(retrievedPayment.orderId).toBe('ORDER-COMPLETE-1');
            expect(retrievedPayment.userId).toBe('USER-COMPLETE-1');
            expect(retrievedPayment.amount).toBe(199.99);
            expect(retrievedPayment.currency).toBe('gbp');
            expect(retrievedPayment.status).toBe('Paid');
            expect(retrievedPayment.email).toBe('complete@example.com');
            expect(retrievedPayment.phone).toBe('+7777777777');
            expect(retrievedPayment.stripePaymentIntentId).toBe('pi_complete_123');
            expect(retrievedPayment.stripeClientSecret).toBe('pi_complete_123_secret');
        });
    });

    // ============================================================================
    // Test 3: orderId unique constraint (Error Path)
    // ============================================================================
    describe('Test 3: orderId Unique Constraint - Prevents Duplicate Payment Records (Error Path)', () => {
        it('should throw error when saving duplicate orderId', async () => {
            // GIVEN: Payment already saved with specific orderId
            const firstPayment = new Payment({
                orderId: 'ORDER-DUPLICATE-1',
                userId: 'USER-FIRST',
                amount: 100.00,
                email: 'first@example.com',
                phone: '+1111111111'
            });
            await firstPayment.save();

            // WHEN: Attempting to save another payment with same orderId
            const duplicatePayment = new Payment({
                orderId: 'ORDER-DUPLICATE-1', // Same orderId
                userId: 'USER-SECOND',
                amount: 200.00,
                email: 'second@example.com',
                phone: '+2222222222'
            });

            // THEN: Should throw duplicate key error
            await expect(duplicatePayment.save()).rejects.toThrow(/duplicate key error/);
        });

        it('should allow different orderIds to save successfully', async () => {
            // GIVEN: First payment with unique orderId
            const firstPayment = new Payment({
                orderId: 'ORDER-UNIQUE-1',
                userId: 'USER-A',
                amount: 50.00,
                email: 'usera@example.com',
                phone: '+1234567890'
            });
            await firstPayment.save();

            // WHEN: Saving second payment with different orderId
            const secondPayment = new Payment({
                orderId: 'ORDER-UNIQUE-2', // Different orderId
                userId: 'USER-B',
                amount: 75.00,
                email: 'userb@example.com',
                phone: '+9876543210'
            });
            const savedSecondPayment = await secondPayment.save();

            // THEN: Should save successfully
            expect(savedSecondPayment.orderId).toBe('ORDER-UNIQUE-2');
            expect(savedSecondPayment._id).toBeDefined();
        });

        it('should enforce orderId uniqueness across different users', async () => {
            // GIVEN: Payment from User A
            const paymentUserA = new Payment({
                orderId: 'ORDER-SHARED-1',
                userId: 'USER-A',
                amount: 100.00,
                email: 'usera@example.com',
                phone: '+1111111111'
            });
            await paymentUserA.save();

            // WHEN: User B attempts to use same orderId
            const paymentUserB = new Payment({
                orderId: 'ORDER-SHARED-1', // Same orderId but different user
                userId: 'USER-B',
                amount: 150.00,
                email: 'userb@example.com',
                phone: '+2222222222'
            });

            // THEN: Should reject due to unique constraint on orderId
            await expect(paymentUserB.save()).rejects.toThrow(/duplicate key error/);
        });

        it('should handle null pointer risk when orderId is null', async () => {
            // GIVEN: Payment with null orderId
            const paymentWithNullOrderId = new Payment({
                orderId: null,
                userId: 'USER-NULL',
                amount: 50.00,
                email: 'null@example.com',
                phone: '+1234567890'
            });

            // WHEN: Attempting to save with null orderId
            // THEN: Should throw validation error (null pointer risk #1)
            await expect(paymentWithNullOrderId.save()).rejects.toThrow();
        });

        it('should handle null pointer risk when orderId is undefined', async () => {
            // GIVEN: Payment with undefined orderId
            const paymentWithUndefinedOrderId = new Payment({
                orderId: undefined,
                userId: 'USER-UNDEFINED',
                amount: 75.00,
                email: 'undefined@example.com',
                phone: '+9876543210'
            });

            // WHEN: Attempting to save with undefined orderId
            // THEN: Should throw validation error (null pointer risk #1)
            await expect(paymentWithUndefinedOrderId.save()).rejects.toThrow();
        });

        it('should handle empty string orderId', async () => {
            // GIVEN: Payment with empty string orderId
            const paymentWithEmptyOrderId = new Payment({
                orderId: '',
                userId: 'USER-EMPTY',
                amount: 25.00,
                email: 'empty@example.com',
                phone: '+5555555555'
            });

            // WHEN: Attempting to save with empty orderId
            // THEN: Should throw validation error
            await expect(paymentWithEmptyOrderId.save()).rejects.toThrow();
        });
    });

    // ============================================================================
    // Test 4: stripePaymentIntentId unique constraint (Error Path)
    // ============================================================================
    describe('Test 4: stripePaymentIntentId Unique Constraint with Sparse Index (Error Path)', () => {
        it('should throw error when saving duplicate stripePaymentIntentId', async () => {
            // GIVEN: Payment with specific stripePaymentIntentId
            const firstPayment = new Payment({
                orderId: 'ORDER-STRIPE-1',
                userId: 'USER-STRIPE-1',
                amount: 100.00,
                email: 'stripe1@example.com',
                phone: '+1111111111',
                stripePaymentIntentId: 'pi_duplicate_123'
            });
            await firstPayment.save();

            // WHEN: Attempting to save another payment with same stripePaymentIntentId
            const duplicateStripePayment = new Payment({
                orderId: 'ORDER-STRIPE-2', // Different orderId
                userId: 'USER-STRIPE-2',
                amount: 200.00,
                email: 'stripe2@example.com',
                phone: '+2222222222',
                stripePaymentIntentId: 'pi_duplicate_123' // Same Stripe ID
            });

            // THEN: Should throw duplicate key error (null pointer risk #2)
            await expect(duplicateStripePayment.save()).rejects.toThrow(/duplicate key error/);
        });

        it('should allow multiple payments without stripePaymentIntentId due to sparse index', async () => {
            // GIVEN: First payment without stripePaymentIntentId
            const firstPayment = new Payment({
                orderId: 'ORDER-NO-STRIPE-1',
                userId: 'USER-NO-STRIPE-1',
                amount: 50.00,
                email: 'nostripe1@example.com',
                phone: '+3333333333'
            });
            await firstPayment.save();

            // WHEN: Saving second payment also without stripePaymentIntentId
            const secondPayment = new Payment({
                orderId: 'ORDER-NO-STRIPE-2',
                userId: 'USER-NO-STRIPE-2',
                amount: 75.00,
                email: 'nostripe2@example.com',
                phone: '+4444444444'
            });
            const savedSecondPayment = await secondPayment.save();

            // THEN: Should save successfully (sparse index allows multiple nulls)
            expect(savedSecondPayment._id).toBeDefined();
            expect(savedSecondPayment.stripePaymentIntentId).toBeUndefined();
        });

        it('should allow undefined stripePaymentIntentId for multiple payments', async () => {
            // GIVEN: Multiple payments without stripePaymentIntentId (undefined, not null)
            const payment1 = new Payment({
                orderId: 'ORDER-NULL-STRIPE-1',
                userId: 'USER-NULL-STRIPE-1',
                amount: 30.00,
                email: 'null1@example.com',
                phone: '+5555555555'
                // stripePaymentIntentId intentionally omitted (undefined)
            });
            await payment1.save();

            const payment2 = new Payment({
                orderId: 'ORDER-NULL-STRIPE-2',
                userId: 'USER-NULL-STRIPE-2',
                amount: 40.00,
                email: 'null2@example.com',
                phone: '+6666666666'
                // stripePaymentIntentId intentionally omitted (undefined)
            });

            // WHEN: Saving second payment without stripePaymentIntentId
            const savedPayment2 = await payment2.save();

            // THEN: Should save successfully (sparse index allows multiple undefined)
            expect(savedPayment2._id).toBeDefined();
            expect(savedPayment2.stripePaymentIntentId).toBeUndefined();
        });

        it('should enforce uniqueness only for non-null stripePaymentIntentId', async () => {
            // GIVEN: One payment with stripePaymentIntentId and one without
            const paymentWithStripe = new Payment({
                orderId: 'ORDER-WITH-STRIPE-1',
                userId: 'USER-WITH-STRIPE',
                amount: 100.00,
                email: 'withstripe@example.com',
                phone: '+7777777777',
                stripePaymentIntentId: 'pi_unique_456'
            });
            await paymentWithStripe.save();

            const paymentWithoutStripe = new Payment({
                orderId: 'ORDER-WITHOUT-STRIPE-1',
                userId: 'USER-WITHOUT-STRIPE',
                amount: 50.00,
                email: 'withoutstripe@example.com',
                phone: '+8888888888'
                // No stripePaymentIntentId
            });

            // WHEN: Saving payment without stripePaymentIntentId
            const savedPaymentWithout = await paymentWithoutStripe.save();

            // THEN: Should save successfully
            expect(savedPaymentWithout._id).toBeDefined();
            expect(savedPaymentWithout.stripePaymentIntentId).toBeUndefined();
        });

        it('should handle null pointer risk for stripePaymentIntentId validation', async () => {
            // GIVEN: Payment with valid stripePaymentIntentId format
            const validStripePayment = new Payment({
                orderId: 'ORDER-VALID-STRIPE',
                userId: 'USER-VALID-STRIPE',
                amount: 150.00,
                email: 'validstripe@example.com',
                phone: '+9999999999',
                stripePaymentIntentId: 'pi_valid_789'
            });

            // WHEN: Saving payment with valid Stripe ID
            const savedPayment = await validStripePayment.save();

            // THEN: Should save successfully with Stripe ID
            expect(savedPayment.stripePaymentIntentId).toBe('pi_valid_789');
            expect(savedPayment._id).toBeDefined();
        });

        it('should store stripeClientSecret along with stripePaymentIntentId', async () => {
            // GIVEN: Payment with both Stripe fields
            const paymentWithStripeFields = new Payment({
                orderId: 'ORDER-STRIPE-COMPLETE',
                userId: 'USER-STRIPE-COMPLETE',
                amount: 250.00,
                email: 'stripecomplete@example.com',
                phone: '+1010101010',
                stripePaymentIntentId: 'pi_complete_999',
                stripeClientSecret: 'pi_complete_999_secret_abc'
            });

            // WHEN: Saving payment with both Stripe fields
            const savedPayment = await paymentWithStripeFields.save();

            // THEN: Should save both fields correctly
            expect(savedPayment.stripePaymentIntentId).toBe('pi_complete_999');
            expect(savedPayment.stripeClientSecret).toBe('pi_complete_999_secret_abc');
        });
    });

    // ============================================================================
    // Test 5: status enum validation (Error Path)
    // ============================================================================
    describe('Test 5: Status Enum Validation - Ensures Payment State Integrity (Error Path)', () => {
        it('should accept valid status value "Pending"', async () => {
            // GIVEN: Payment with status "Pending"
            const paymentPending = new Payment({
                orderId: 'ORDER-PENDING-1',
                userId: 'USER-PENDING-1',
                amount: 50.00,
                email: 'pending@example.com',
                phone: '+1111111111',
                status: 'Pending'
            });

            // WHEN: Saving payment with Pending status
            const savedPayment = await paymentPending.save();

            // THEN: Should save successfully
            expect(savedPayment.status).toBe('Pending');
        });

        it('should accept valid status value "Paid"', async () => {
            // GIVEN: Payment with status "Paid"
            const paymentPaid = new Payment({
                orderId: 'ORDER-PAID-1',
                userId: 'USER-PAID-1',
                amount: 100.00,
                email: 'paid@example.com',
                phone: '+2222222222',
                status: 'Paid'
            });

            // WHEN: Saving payment with Paid status
            const savedPayment = await paymentPaid.save();

            // THEN: Should save successfully
            expect(savedPayment.status).toBe('Paid');
        });

        it('should accept valid status value "Failed"', async () => {
            // GIVEN: Payment with status "Failed"
            const paymentFailed = new Payment({
                orderId: 'ORDER-FAILED-1',
                userId: 'USER-FAILED-1',
                amount: 75.00,
                email: 'failed@example.com',
                phone: '+3333333333',
                status: 'Failed'
            });

            // WHEN: Saving payment with Failed status
            const savedPayment = await paymentFailed.save();

            // THEN: Should save successfully
            expect(savedPayment.status).toBe('Failed');
        });

        it('should reject invalid status value', async () => {
            // GIVEN: Payment with invalid status
            const paymentInvalidStatus = new Payment({
                orderId: 'ORDER-INVALID-STATUS',
                userId: 'USER-INVALID-STATUS',
                amount: 50.00,
                email: 'invalid@example.com',
                phone: '+4444444444',
                status: 'Processing' // Invalid status not in enum
            });

            // WHEN: Attempting to save with invalid status
            // THEN: Should throw validation error (null pointer risk #3)
            await expect(paymentInvalidStatus.save()).rejects.toThrow(/is not a valid enum value/);
        });

        it('should reject lowercase status value', async () => {
            // GIVEN: Payment with lowercase status (case-sensitive enum)
            const paymentLowercaseStatus = new Payment({
                orderId: 'ORDER-LOWERCASE-STATUS',
                userId: 'USER-LOWERCASE-STATUS',
                amount: 60.00,
                email: 'lowercase@example.com',
                phone: '+5555555555',
                status: 'pending' // Lowercase, should be 'Pending'
            });

            // WHEN: Attempting to save with lowercase status
            // THEN: Should throw validation error
            await expect(paymentLowercaseStatus.save()).rejects.toThrow(/is not a valid enum value/);
        });

        it('should reject uppercase status value', async () => {
            // GIVEN: Payment with uppercase status
            const paymentUppercaseStatus = new Payment({
                orderId: 'ORDER-UPPERCASE-STATUS',
                userId: 'USER-UPPERCASE-STATUS',
                amount: 80.00,
                email: 'uppercase@example.com',
                phone: '+6666666666',
                status: 'PAID' // Uppercase, should be 'Paid'
            });

            // WHEN: Attempting to save with uppercase status
            // THEN: Should throw validation error
            await expect(paymentUppercaseStatus.save()).rejects.toThrow(/is not a valid enum value/);
        });

        it('should accept null status and store as null', async () => {
            // GIVEN: Payment with null status (Mongoose allows null for non-required enum)
            const paymentNullStatus = new Payment({
                orderId: 'ORDER-NULL-STATUS',
                userId: 'USER-NULL-STATUS',
                amount: 90.00,
                email: 'nullstatus@example.com',
                phone: '+7777777777',
                status: null
            });

            // WHEN: Saving with null status
            const savedPayment = await paymentNullStatus.save();

            // THEN: Should save with null status (enum with default doesn't enforce non-null)
            expect(savedPayment.status).toBeNull();
        });

        it('should default to "Pending" when status is not provided', async () => {
            // GIVEN: Payment without explicit status
            const paymentNoStatus = new Payment({
                orderId: 'ORDER-NO-STATUS',
                userId: 'USER-NO-STATUS',
                amount: 45.00,
                email: 'nostatus@example.com',
                phone: '+8888888888'
                // No status provided
            });

            // WHEN: Saving payment without status
            const savedPayment = await paymentNoStatus.save();

            // THEN: Should default to 'Pending'
            expect(savedPayment.status).toBe('Pending');
        });

        it('should handle status transitions correctly', async () => {
            // GIVEN: Payment initially with Pending status
            const payment = new Payment({
                orderId: 'ORDER-TRANSITION',
                userId: 'USER-TRANSITION',
                amount: 120.00,
                email: 'transition@example.com',
                phone: '+9999999999',
                status: 'Pending'
            });
            const savedPayment = await payment.save();
            expect(savedPayment.status).toBe('Pending');

            // WHEN: Updating status to Paid
            savedPayment.status = 'Paid';
            const updatedPayment = await savedPayment.save();

            // THEN: Should update successfully to Paid
            expect(updatedPayment.status).toBe('Paid');
        });
    });

    // ============================================================================
    // Test 6: Required field validation (Error Path)
    // ============================================================================
    describe('Test 6: Required Field Validation - Prevents Incomplete Payment Records (Error Path)', () => {
        it('should throw validation error when orderId is missing', async () => {
            // GIVEN: Payment without orderId
            const paymentNoOrderId = new Payment({
                userId: 'USER-NO-ORDER',
                amount: 100.00,
                email: 'noorder@example.com',
                phone: '+1111111111'
            });

            // WHEN: Attempting to save without orderId
            // THEN: Should throw validation error (null pointer risk #4)
            await expect(paymentNoOrderId.save()).rejects.toThrow(/orderId.*required/);
        });

        it('should throw validation error when userId is missing', async () => {
            // GIVEN: Payment without userId
            const paymentNoUserId = new Payment({
                orderId: 'ORDER-NO-USER',
                amount: 100.00,
                email: 'nouser@example.com',
                phone: '+2222222222'
            });

            // WHEN: Attempting to save without userId
            // THEN: Should throw validation error (null pointer risk #4)
            await expect(paymentNoUserId.save()).rejects.toThrow(/userId.*required/);
        });

        it('should throw validation error when amount is missing', async () => {
            // GIVEN: Payment without amount
            const paymentNoAmount = new Payment({
                orderId: 'ORDER-NO-AMOUNT',
                userId: 'USER-NO-AMOUNT',
                email: 'noamount@example.com',
                phone: '+3333333333'
            });

            // WHEN: Attempting to save without amount
            // THEN: Should throw validation error (null pointer risk #4)
            await expect(paymentNoAmount.save()).rejects.toThrow(/amount.*required/);
        });

        it('should throw validation error when email is missing', async () => {
            // GIVEN: Payment without email
            const paymentNoEmail = new Payment({
                orderId: 'ORDER-NO-EMAIL',
                userId: 'USER-NO-EMAIL',
                amount: 100.00,
                phone: '+4444444444'
            });

            // WHEN: Attempting to save without email
            // THEN: Should throw validation error (null pointer risk #4)
            await expect(paymentNoEmail.save()).rejects.toThrow(/email.*required/);
        });

        it('should throw validation error when phone is missing', async () => {
            // GIVEN: Payment without phone
            const paymentNoPhone = new Payment({
                orderId: 'ORDER-NO-PHONE',
                userId: 'USER-NO-PHONE',
                amount: 100.00,
                email: 'nophone@example.com'
            });

            // WHEN: Attempting to save without phone
            // THEN: Should throw validation error (null pointer risk #4)
            await expect(paymentNoPhone.save()).rejects.toThrow(/phone.*required/);
        });

        it('should throw validation error when multiple required fields are missing', async () => {
            // GIVEN: Payment with only one required field
            const paymentOneField = new Payment({
                orderId: 'ORDER-ONE-FIELD'
                // Missing userId, amount, email, phone
            });

            // WHEN: Attempting to save with multiple missing fields
            // THEN: Should throw validation error
            await expect(paymentOneField.save()).rejects.toThrow(/required/);
        });

        it('should throw validation error when all required fields are missing', async () => {
            // GIVEN: Payment with no required fields
            const paymentNoFields = new Payment({
                currency: 'usd' // Only optional field
            });

            // WHEN: Attempting to save without any required fields
            // THEN: Should throw validation error
            await expect(paymentNoFields.save()).rejects.toThrow(/required/);
        });

        it('should handle null values for required fields', async () => {
            // GIVEN: Payment with null values for required fields
            const paymentNullFields = new Payment({
                orderId: null,
                userId: null,
                amount: null,
                email: null,
                phone: null
            });

            // WHEN: Attempting to save with null required fields
            // THEN: Should throw validation error (null pointer risk #4)
            await expect(paymentNullFields.save()).rejects.toThrow();
        });

        it('should handle undefined values for required fields', async () => {
            // GIVEN: Payment with undefined values
            const paymentUndefinedFields = new Payment({
                orderId: undefined,
                userId: undefined,
                amount: undefined,
                email: undefined,
                phone: undefined
            });

            // WHEN: Attempting to save with undefined required fields
            // THEN: Should throw validation error (null pointer risk #4)
            await expect(paymentUndefinedFields.save()).rejects.toThrow();
        });

        it('should handle empty strings for required fields', async () => {
            // GIVEN: Payment with empty strings
            const paymentEmptyStrings = new Payment({
                orderId: '',
                userId: '',
                amount: 0,
                email: '',
                phone: ''
            });

            // WHEN: Attempting to save with empty strings
            // THEN: Should throw validation error
            await expect(paymentEmptyStrings.save()).rejects.toThrow();
        });

        it('should accept optional fields as undefined without error', async () => {
            // GIVEN: Payment with all required fields but optional fields undefined
            const paymentOptionalUndefined = new Payment({
                orderId: 'ORDER-OPTIONAL-UNDEFINED',
                userId: 'USER-OPTIONAL-UNDEFINED',
                amount: 50.00,
                email: 'optional@example.com',
                phone: '+1234567890'
                // currency, status, stripePaymentIntentId, stripeClientSecret undefined
            });

            // WHEN: Saving payment without optional fields
            const savedPayment = await paymentOptionalUndefined.save();

            // THEN: Should save successfully with defaults
            expect(savedPayment._id).toBeDefined();
            expect(savedPayment.currency).toBe('usd'); // Default
            expect(savedPayment.status).toBe('Pending'); // Default
        });
    });

    // ============================================================================
    // Test 7: Default Values Validation (Edge Case)
    // ============================================================================
    describe('Test 7: Default Values - Currency and Status Defaults Work Correctly (Edge Case)', () => {
        it('should default currency to "usd" when not provided', async () => {
            // GIVEN: Payment without currency
            const paymentNoCurrency = new Payment({
                orderId: 'ORDER-DEFAULT-CURRENCY-1',
                userId: 'USER-DEFAULT-CURRENCY-1',
                amount: 100.00,
                email: 'defaultcurrency@example.com',
                phone: '+1111111111'
            });

            // WHEN: Saving payment without currency
            const savedPayment = await paymentNoCurrency.save();

            // THEN: Should default to 'usd'
            expect(savedPayment.currency).toBe('usd');
        });

        it('should default status to "Pending" when not provided', async () => {
            // GIVEN: Payment without status
            const paymentNoStatus = new Payment({
                orderId: 'ORDER-DEFAULT-STATUS-1',
                userId: 'USER-DEFAULT-STATUS-1',
                amount: 150.00,
                email: 'defaultstatus@example.com',
                phone: '+2222222222'
            });

            // WHEN: Saving payment without status
            const savedPayment = await paymentNoStatus.save();

            // THEN: Should default to 'Pending'
            expect(savedPayment.status).toBe('Pending');
        });

        it('should allow custom currency to override default', async () => {
            // GIVEN: Payment with custom currency
            const paymentCustomCurrency = new Payment({
                orderId: 'ORDER-CUSTOM-CURRENCY-1',
                userId: 'USER-CUSTOM-CURRENCY-1',
                amount: 200.00,
                currency: 'eur',
                email: 'customcurrency@example.com',
                phone: '+3333333333'
            });

            // WHEN: Saving payment with custom currency
            const savedPayment = await paymentCustomCurrency.save();

            // THEN: Should use provided currency
            expect(savedPayment.currency).toBe('eur');
        });

        it('should allow custom status to override default', async () => {
            // GIVEN: Payment with custom status
            const paymentCustomStatus = new Payment({
                orderId: 'ORDER-CUSTOM-STATUS-1',
                userId: 'USER-CUSTOM-STATUS-1',
                amount: 250.00,
                status: 'Paid',
                email: 'customstatus@example.com',
                phone: '+4444444444'
            });

            // WHEN: Saving payment with custom status
            const savedPayment = await paymentCustomStatus.save();

            // THEN: Should use provided status
            expect(savedPayment.status).toBe('Paid');
        });

        it('should apply both defaults when both currency and status not provided', async () => {
            // GIVEN: Payment without currency and status
            const paymentBothDefaults = new Payment({
                orderId: 'ORDER-BOTH-DEFAULTS',
                userId: 'USER-BOTH-DEFAULTS',
                amount: 75.00,
                email: 'bothdefaults@example.com',
                phone: '+5555555555'
            });

            // WHEN: Saving payment without currency and status
            const savedPayment = await paymentBothDefaults.save();

            // THEN: Should apply both defaults
            expect(savedPayment.currency).toBe('usd');
            expect(savedPayment.status).toBe('Pending');
        });
    });

    // ============================================================================
    // Test 8: Pre-save Hook - updatedAt Refresh (Edge Case)
    // ============================================================================
    describe('Test 8: Pre-save Hook - Validates updatedAt is Refreshed on Every Save (Edge Case)', () => {
        it('should trigger pre-save hook and update updatedAt on save', async () => {
            // GIVEN: New payment
            const payment = new Payment({
                orderId: 'ORDER-PRESAVE-1',
                userId: 'USER-PRESAVE-1',
                amount: 100.00,
                email: 'presave@example.com',
                phone: '+1111111111'
            });

            // WHEN: Saving payment (triggers pre-save hook)
            const savedPayment = await payment.save();

            // THEN: updatedAt should be set by pre-save hook
            expect(savedPayment.updatedAt).toBeDefined();
            expect(savedPayment.updatedAt).toBeInstanceOf(Date);
        });

        it('should update updatedAt on subsequent saves via pre-save hook', async () => {
            // GIVEN: Saved payment
            const payment = new Payment({
                orderId: 'ORDER-PRESAVE-2',
                userId: 'USER-PRESAVE-2',
                amount: 150.00,
                email: 'presave2@example.com',
                phone: '+2222222222'
            });
            const savedPayment = await payment.save();
            const firstUpdatedAt = savedPayment.updatedAt.getTime();

            // Change mock time to simulate passage of time
            mockDateNow.mockReturnValue(1699507500000); // Later timestamp

            // WHEN: Modifying and saving again
            savedPayment.amount = 200.00;
            const updatedPayment = await savedPayment.save();

            // THEN: updatedAt should be refreshed by pre-save hook
            expect(updatedPayment.updatedAt.getTime()).toBeGreaterThan(firstUpdatedAt);
        });

        it('should call pre-save hook even when no fields are modified', async () => {
            // GIVEN: Saved payment
            const payment = new Payment({
                orderId: 'ORDER-PRESAVE-3',
                userId: 'USER-PRESAVE-3',
                amount: 75.00,
                email: 'presave3@example.com',
                phone: '+3333333333'
            });
            const savedPayment = await payment.save();
            const firstUpdatedAt = savedPayment.updatedAt.getTime();

            // Change mock time
            mockDateNow.mockReturnValue(1699508000000);

            // WHEN: Saving without modification
            const resavedPayment = await savedPayment.save();

            // THEN: updatedAt should still be refreshed
            expect(resavedPayment.updatedAt.getTime()).toBeGreaterThan(firstUpdatedAt);
        });

        it('should use Date.now() in pre-save hook for updatedAt', async () => {
            // GIVEN: New payment with mocked Date.now
            const mockedTime = 1699510000000;
            mockDateNow.mockReturnValue(mockedTime);

            const payment = new Payment({
                orderId: 'ORDER-PRESAVE-MOCK',
                userId: 'USER-PRESAVE-MOCK',
                amount: 50.00,
                email: 'presavemock@example.com',
                phone: '+4444444444'
            });

            // WHEN: Saving payment
            const savedPayment = await payment.save();

            // THEN: updatedAt should use mocked Date.now value
            expect(savedPayment.updatedAt.getTime()).toBe(mockedTime);
            expect(Date.now).toHaveBeenCalled();
        });

        it('should not modify createdAt in pre-save hook', async () => {
            // GIVEN: Saved payment
            const payment = new Payment({
                orderId: 'ORDER-PRESAVE-CREATEDAT',
                userId: 'USER-PRESAVE-CREATEDAT',
                amount: 125.00,
                email: 'presavecreatedat@example.com',
                phone: '+5555555555'
            });
            const savedPayment = await payment.save();
            const originalCreatedAt = savedPayment.createdAt.getTime();

            // Change mock time
            mockDateNow.mockReturnValue(1699512000000);

            // WHEN: Updating and saving
            savedPayment.status = 'Paid';
            const updatedPayment = await savedPayment.save();

            // THEN: createdAt should remain unchanged
            expect(updatedPayment.createdAt.getTime()).toBe(originalCreatedAt);
        });
    });
});
