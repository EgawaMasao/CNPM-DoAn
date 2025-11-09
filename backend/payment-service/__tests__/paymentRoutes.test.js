// backend/payment-service/__tests__/paymentRoutes.test.js
const request = require('supertest');
const express = require('express');

// Mock external dependencies BEFORE requiring paymentRoutes
jest.mock('../models/PaymentModel');
jest.mock('../utils/twilioService');
jest.mock('../config/db', () => jest.fn());

// Mock Stripe with proper structure
const mockPaymentIntents = {
    create: jest.fn(),
    retrieve: jest.fn(),
    cancel: jest.fn()
};

jest.mock('stripe', () => {
    return jest.fn().mockImplementation(() => ({
        paymentIntents: mockPaymentIntents
    }));
});

const Payment = require('../models/PaymentModel');
const { sendSmsNotification } = require('../utils/twilioService');
const paymentRoutes = require('../routes/paymentRoutes');

// Setup Express app for testing
const app = express();
app.use(express.json());
app.use('/api/payment', paymentRoutes);

describe('PaymentRoutes Unit Tests - Shopee QA Standards', () => {
    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();

        // Setup default SMS notification mock
        sendSmsNotification.mockResolvedValue(undefined);

        // Setup default Payment model methods
        Payment.findOne = jest.fn();
        Payment.deleteOne = jest.fn();
        Payment.prototype.save = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // ============================================================================
    // Test 1: POST /process - Complete payment flow with valid data (Happy Path)
    // ============================================================================
    describe('Test 1: POST /process - Complete Payment Flow with Valid Data (Happy Path)', () => {
        it('should process payment successfully with all valid data', async () => {
            // GIVEN: Valid payment request data and mocked dependencies
            const validPaymentData = {
                orderId: 'ORDER-12345',
                userId: 'USER-67890',
                amount: 99.99,
                currency: 'usd',
                email: 'customer@example.com',
                phone: '+1234567890'
            };

            // Mock Payment.findOne returns null (no existing payment)
            Payment.findOne.mockResolvedValue(null);

            // Mock Stripe paymentIntent creation
            const mockPaymentIntent = {
                id: 'pi_test_123',
                client_secret: 'pi_test_123_secret_abc',
                amount: 9999,
                currency: 'usd'
            };
            mockPaymentIntents.create.mockResolvedValue(mockPaymentIntent);

            // Mock Payment save
            const mockSavedPayment = {
                _id: 'payment_id_123',
                orderId: 'ORDER-12345',
                userId: 'USER-67890',
                amount: 99.99,
                currency: 'usd',
                status: 'Pending',
                stripePaymentIntentId: 'pi_test_123',
                stripeClientSecret: 'pi_test_123_secret_abc',
                phone: '+1234567890',
                email: 'customer@example.com',
                save: jest.fn().mockResolvedValue(this)
            };
            Payment.mockImplementation(() => mockSavedPayment);
            mockSavedPayment.save.mockResolvedValue(mockSavedPayment);

            // Mock SMS notification success
            sendSmsNotification.mockResolvedValue(undefined);

            // WHEN: Sending POST request to /api/payment/process
            const response = await request(app)
                .post('/api/payment/process')
                .send(validPaymentData);

            // THEN: Should return 200 with clientSecret and payment details
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('clientSecret', 'pi_test_123_secret_abc');
            expect(response.body).toHaveProperty('paymentId', 'payment_id_123');
            expect(response.body).toHaveProperty('disablePayment', false);

            // Verify Payment.findOne was called to check existing payment
            expect(Payment.findOne).toHaveBeenCalledWith({ orderId: 'ORDER-12345' });

            // Verify Stripe paymentIntent was created with correct data
            expect(mockPaymentIntents.create).toHaveBeenCalledWith({
                amount: 9999, // 99.99 * 100
                currency: 'usd',
                metadata: { orderId: 'ORDER-12345', userId: 'USER-67890' },
                receipt_email: 'customer@example.com'
            });

            // Verify Payment model was instantiated and saved
            expect(Payment).toHaveBeenCalledWith({
                orderId: 'ORDER-12345',
                userId: 'USER-67890',
                amount: 99.99,
                currency: 'usd',
                status: 'Pending',
                stripePaymentIntentId: 'pi_test_123',
                stripeClientSecret: 'pi_test_123_secret_abc',
                phone: '+1234567890',
                email: 'customer@example.com'
            });
            expect(mockSavedPayment.save).toHaveBeenCalled();

            // Verify SMS notification was sent
            expect(sendSmsNotification).toHaveBeenCalledWith(
                '+1234567890',
                'Your payment of $ORDER-12345 has been processed successfully.'
            );
        });

        it('should process payment with default currency when not provided', async () => {
            // GIVEN: Payment data without currency
            const paymentDataNoCurrency = {
                orderId: 'ORDER-NO-CURRENCY',
                userId: 'USER-12345',
                amount: 50.00,
                email: 'test@example.com',
                phone: '+9876543210'
            };

            Payment.findOne.mockResolvedValue(null);

            const mockPaymentIntent = {
                id: 'pi_test_456',
                client_secret: 'pi_test_456_secret_xyz',
                amount: 5000,
                currency: 'usd'
            };
            mockPaymentIntents.create.mockResolvedValue(mockPaymentIntent);

            const mockSavedPayment = {
                _id: 'payment_id_456',
                save: jest.fn().mockResolvedValue(this)
            };
            Payment.mockImplementation(() => mockSavedPayment);

            // WHEN: Sending request without currency
            const response = await request(app)
                .post('/api/payment/process')
                .send(paymentDataNoCurrency);

            // THEN: Should default to 'usd'
            expect(response.status).toBe(200);
            expect(mockPaymentIntents.create).toHaveBeenCalledWith(
                expect.objectContaining({ currency: 'usd' })
            );
        });

        it('should handle decimal amounts correctly by converting to cents', async () => {
            // GIVEN: Payment with decimal amount
            const paymentDataDecimal = {
                orderId: 'ORDER-DECIMAL',
                userId: 'USER-DECIMAL',
                amount: 123.45,
                email: 'decimal@example.com',
                phone: '+1111111111'
            };

            Payment.findOne.mockResolvedValue(null);

            const mockPaymentIntent = {
                id: 'pi_decimal',
                client_secret: 'pi_decimal_secret',
                amount: 12345
            };
            mockPaymentIntents.create.mockResolvedValue(mockPaymentIntent);

            const mockSavedPayment = {
                _id: 'payment_decimal',
                save: jest.fn().mockResolvedValue(this)
            };
            Payment.mockImplementation(() => mockSavedPayment);

            // WHEN: Processing payment with decimal
            const response = await request(app)
                .post('/api/payment/process')
                .send(paymentDataDecimal);

            // THEN: Amount should be converted to cents (12345)
            expect(response.status).toBe(200);
            expect(mockPaymentIntents.create).toHaveBeenCalledWith(
                expect.objectContaining({ amount: 12345 })
            );
        });
    });

    // ============================================================================
    // Test 2: POST /process - Missing phone number validation (Error Path)
    // ============================================================================
    describe('Test 2: POST /process - Missing Phone Number Validation (Error Path)', () => {
        it('should return 400 error when phone number is missing', async () => {
            // GIVEN: Payment data without phone number (null pointer risk #1)
            const paymentDataNoPhone = {
                orderId: 'ORDER-NO-PHONE',
                userId: 'USER-NO-PHONE',
                amount: 100.00,
                currency: 'usd',
                email: 'noPhone@example.com'
                // phone is missing
            };

            // WHEN: Sending request without phone number
            const response = await request(app)
                .post('/api/payment/process')
                .send(paymentDataNoPhone);

            // THEN: Should return 400 with error message
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Phone number is required.');

            // Verify no database or Stripe operations were attempted
            expect(Payment.findOne).not.toHaveBeenCalled();
            expect(mockPaymentIntents.create).not.toHaveBeenCalled();
            expect(sendSmsNotification).not.toHaveBeenCalled();
        });

        it('should return 400 error when phone is null', async () => {
            // GIVEN: Payment data with null phone
            const paymentDataNullPhone = {
                orderId: 'ORDER-NULL-PHONE',
                userId: 'USER-NULL-PHONE',
                amount: 75.00,
                email: 'nullphone@example.com',
                phone: null
            };

            // WHEN: Sending request with null phone
            const response = await request(app)
                .post('/api/payment/process')
                .send(paymentDataNullPhone);

            // THEN: Should return 400 error
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Phone number is required.');
        });

        it('should return 400 error when phone is empty string', async () => {
            // GIVEN: Payment data with empty phone string
            const paymentDataEmptyPhone = {
                orderId: 'ORDER-EMPTY-PHONE',
                userId: 'USER-EMPTY-PHONE',
                amount: 50.00,
                email: 'emptyphone@example.com',
                phone: ''
            };

            // WHEN: Sending request with empty phone
            const response = await request(app)
                .post('/api/payment/process')
                .send(paymentDataEmptyPhone);

            // THEN: Should return 400 error
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Phone number is required.');
        });

        it('should return 400 error when phone is undefined', async () => {
            // GIVEN: Payment data with undefined phone
            const paymentDataUndefinedPhone = {
                orderId: 'ORDER-UNDEFINED-PHONE',
                userId: 'USER-UNDEFINED-PHONE',
                amount: 25.00,
                email: 'undefinedphone@example.com',
                phone: undefined
            };

            // WHEN: Sending request with undefined phone
            const response = await request(app)
                .post('/api/payment/process')
                .send(paymentDataUndefinedPhone);

            // THEN: Should return 400 error
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Phone number is required.');
        });
    });

    // ============================================================================
    // Test 3: POST /process - Existing paid order prevents duplicate (Happy Path)
    // ============================================================================
    describe('Test 3: POST /process - Existing Paid Order Returns Early (Happy Path)', () => {
        it('should return early with disablePayment true for already paid order', async () => {
            // GIVEN: Existing payment with status "Paid"
            const paymentData = {
                orderId: 'ORDER-ALREADY-PAID',
                userId: 'USER-PAID',
                amount: 150.00,
                email: 'paid@example.com',
                phone: '+1234567890'
            };

            const existingPaidPayment = {
                _id: 'existing_payment_id',
                orderId: 'ORDER-ALREADY-PAID',
                userId: 'USER-PAID',
                amount: 150.00,
                status: 'Paid',
                stripePaymentIntentId: 'pi_existing_123',
                stripeClientSecret: 'pi_existing_123_secret'
            };

            // Mock findOne to return existing paid payment
            Payment.findOne.mockResolvedValue(existingPaidPayment);

            // WHEN: Attempting to process payment for already paid order
            const response = await request(app)
                .post('/api/payment/process')
                .send(paymentData);

            // THEN: Should return 200 with disablePayment true
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('message', '✅ This order has already been paid successfully.');
            expect(response.body).toHaveProperty('paymentStatus', 'Paid');
            expect(response.body).toHaveProperty('disablePayment', true);

            // Verify Payment.findOne was called
            expect(Payment.findOne).toHaveBeenCalledWith({ orderId: 'ORDER-ALREADY-PAID' });

            // Verify no new payment intent was created
            expect(mockPaymentIntents.create).not.toHaveBeenCalled();

            // Verify no new payment was saved
            expect(Payment).not.toHaveBeenCalled();

            // Verify no SMS was sent
            expect(sendSmsNotification).not.toHaveBeenCalled();
        });

        it('should prevent duplicate charges for paid orders', async () => {
            // GIVEN: Multiple requests for same paid order
            const paymentData = {
                orderId: 'ORDER-DUPLICATE-PREVENT',
                userId: 'USER-DUPLICATE',
                amount: 200.00,
                email: 'duplicate@example.com',
                phone: '+9999999999'
            };

            const paidPayment = {
                orderId: 'ORDER-DUPLICATE-PREVENT',
                status: 'Paid',
                stripeClientSecret: 'pi_paid_secret'
            };

            Payment.findOne.mockResolvedValue(paidPayment);

            // WHEN: Sending duplicate request
            const response = await request(app)
                .post('/api/payment/process')
                .send(paymentData);

            // THEN: Should block duplicate charge
            expect(response.status).toBe(200);
            expect(response.body.disablePayment).toBe(true);
            expect(mockPaymentIntents.create).not.toHaveBeenCalled();
        });
    });

    // ============================================================================
    // Test 4: POST /process - Reuse valid existing payment intent (Happy Path)
    // ============================================================================
    describe('Test 4: POST /process - Reuse Valid Existing Payment Intent (Happy Path)', () => {
        it('should reuse existing valid payment intent when status is requires_payment_method', async () => {
            // GIVEN: Existing pending payment with valid payment intent
            const paymentData = {
                orderId: 'ORDER-REUSE-INTENT',
                userId: 'USER-REUSE',
                amount: 75.00,
                email: 'reuse@example.com',
                phone: '+1112223333'
            };

            const existingPendingPayment = {
                _id: 'existing_pending_id',
                orderId: 'ORDER-REUSE-INTENT',
                status: 'Pending',
                stripePaymentIntentId: 'pi_existing_valid',
                stripeClientSecret: 'pi_existing_valid_secret'
            };

            // Mock findOne to return existing pending payment
            Payment.findOne.mockResolvedValue(existingPendingPayment);

            // Mock Stripe retrieve to return valid intent
            const mockExistingIntent = {
                id: 'pi_existing_valid',
                status: 'requires_payment_method',
                client_secret: 'pi_existing_valid_secret'
            };
            mockPaymentIntents.retrieve.mockResolvedValue(mockExistingIntent);

            // WHEN: Attempting to process payment with existing valid intent
            const response = await request(app)
                .post('/api/payment/process')
                .send(paymentData);

            // THEN: Should return existing clientSecret without creating new intent
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('clientSecret', 'pi_existing_valid_secret');
            expect(response.body).toHaveProperty('paymentId', 'existing_pending_id');
            expect(response.body).toHaveProperty('disablePayment', false);

            // Verify existing intent was retrieved
            expect(mockPaymentIntents.retrieve).toHaveBeenCalledWith('pi_existing_valid');

            // Verify no new payment intent was created
            expect(mockPaymentIntents.create).not.toHaveBeenCalled();

            // Verify no payment was saved
            expect(Payment).not.toHaveBeenCalled();

            // Verify no SMS was sent (intent reused)
            expect(sendSmsNotification).not.toHaveBeenCalled();
        });

        it('should avoid duplicate intents by reusing valid ones', async () => {
            // GIVEN: Existing payment with requires_payment_method status
            const paymentData = {
                orderId: 'ORDER-AVOID-DUPLICATE',
                userId: 'USER-AVOID-DUP',
                amount: 100.00,
                email: 'avoiddup@example.com',
                phone: '+4444444444'
            };

            const existingPayment = {
                _id: 'payment_avoid_dup',
                orderId: 'ORDER-AVOID-DUPLICATE',
                status: 'Pending',
                stripePaymentIntentId: 'pi_reusable',
                stripeClientSecret: 'pi_reusable_secret'
            };

            Payment.findOne.mockResolvedValue(existingPayment);

            mockPaymentIntents.retrieve.mockResolvedValue({
                id: 'pi_reusable',
                status: 'requires_payment_method'
            });

            // WHEN: Processing payment
            const response = await request(app)
                .post('/api/payment/process')
                .send(paymentData);

            // THEN: Should reuse intent and not create new one
            expect(response.status).toBe(200);
            expect(mockPaymentIntents.create).not.toHaveBeenCalled();
            expect(mockPaymentIntents.retrieve).toHaveBeenCalledWith('pi_reusable');
        });

        it('should create new intent if existing one is not requires_payment_method', async () => {
            // GIVEN: Existing payment with succeeded intent (not reusable)
            const paymentData = {
                orderId: 'ORDER-NEW-INTENT-NEEDED',
                userId: 'USER-NEW-INTENT',
                amount: 125.00,
                email: 'newintent@example.com',
                phone: '+5555555555'
            };

            const existingPayment = {
                orderId: 'ORDER-NEW-INTENT-NEEDED',
                status: 'Pending',
                stripePaymentIntentId: 'pi_old_succeeded',
                stripeClientSecret: 'pi_old_secret'
            };

            Payment.findOne.mockResolvedValue(existingPayment);

            // Mock retrieve to return non-reusable intent
            mockPaymentIntents.retrieve.mockResolvedValue({
                id: 'pi_old_succeeded',
                status: 'succeeded' // Not requires_payment_method
            });

            // Mock cancel old intent
            mockPaymentIntents.cancel.mockResolvedValue({ id: 'pi_old_succeeded' });

            // Mock deleteOne
            Payment.deleteOne.mockResolvedValue({ deletedCount: 1 });

            // Mock new intent creation
            const newIntent = {
                id: 'pi_new_123',
                client_secret: 'pi_new_123_secret'
            };
            mockPaymentIntents.create.mockResolvedValue(newIntent);

            const mockNewPayment = {
                _id: 'new_payment_id',
                save: jest.fn().mockResolvedValue(this)
            };
            Payment.mockImplementation(() => mockNewPayment);

            // WHEN: Processing payment
            const response = await request(app)
                .post('/api/payment/process')
                .send(paymentData);

            // THEN: Should create new intent after cancelling old one
            expect(response.status).toBe(200);
            expect(mockPaymentIntents.cancel).toHaveBeenCalledWith('pi_old_succeeded');
            expect(Payment.deleteOne).toHaveBeenCalledWith({ orderId: 'ORDER-NEW-INTENT-NEEDED' });
            expect(mockPaymentIntents.create).toHaveBeenCalled();
        });
    });

    // ============================================================================
    // Test 5: POST /process - Stripe create throws error (Error Path)
    // ============================================================================
    describe('Test 5: POST /process - Stripe PaymentIntent Creation Error (Error Path)', () => {
        it('should return 500 error when stripe.paymentIntents.create throws', async () => {
            // GIVEN: Valid payment data but Stripe fails
            const paymentData = {
                orderId: 'ORDER-STRIPE-FAIL',
                userId: 'USER-STRIPE-FAIL',
                amount: 99.99,
                email: 'stripefail@example.com',
                phone: '+1234567890'
            };

            // Mock no existing payment
            Payment.findOne.mockResolvedValue(null);

            // Mock Stripe create to throw error
            const stripeError = new Error('Stripe API error: Invalid API key');
            mockPaymentIntents.create.mockRejectedValue(stripeError);

            // WHEN: Processing payment with Stripe failure
            const response = await request(app)
                .post('/api/payment/process')
                .send(paymentData);

            // THEN: Should return 500 with error message
            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty('error', '❌ Payment processing failed. Please try again.');

            // Verify Stripe create was called
            expect(mockPaymentIntents.create).toHaveBeenCalled();

            // Verify no payment was saved
            expect(Payment).not.toHaveBeenCalled();

            // Verify no SMS was sent
            expect(sendSmsNotification).not.toHaveBeenCalled();
        });

        it('should handle stripe network timeout errors', async () => {
            // GIVEN: Payment data and Stripe timeout
            const paymentData = {
                orderId: 'ORDER-TIMEOUT',
                userId: 'USER-TIMEOUT',
                amount: 50.00,
                email: 'timeout@example.com',
                phone: '+9999999999'
            };

            Payment.findOne.mockResolvedValue(null);

            const timeoutError = new Error('Request timeout');
            mockPaymentIntents.create.mockRejectedValue(timeoutError);

            // WHEN: Processing payment with timeout
            const response = await request(app)
                .post('/api/payment/process')
                .send(paymentData);

            // THEN: Should return 500 error
            expect(response.status).toBe(500);
            expect(response.body.error).toBe('❌ Payment processing failed. Please try again.');
        });

        it('should handle stripe invalid amount errors', async () => {
            // GIVEN: Invalid amount causing Stripe error
            const paymentData = {
                orderId: 'ORDER-INVALID-AMOUNT',
                userId: 'USER-INVALID',
                amount: -50.00, // Negative amount
                email: 'invalid@example.com',
                phone: '+8888888888'
            };

            Payment.findOne.mockResolvedValue(null);

            const invalidAmountError = new Error('Invalid integer: -5000');
            mockPaymentIntents.create.mockRejectedValue(invalidAmountError);

            // WHEN: Processing payment with invalid amount
            const response = await request(app)
                .post('/api/payment/process')
                .send(paymentData);

            // THEN: Should return 500 error
            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty('error');
        });

        it('should handle stripe authentication failures', async () => {
            // GIVEN: Stripe authentication error
            const paymentData = {
                orderId: 'ORDER-AUTH-FAIL',
                userId: 'USER-AUTH-FAIL',
                amount: 75.00,
                email: 'authfail@example.com',
                phone: '+7777777777'
            };

            Payment.findOne.mockResolvedValue(null);

            const authError = new Error('Invalid API Key provided');
            mockPaymentIntents.create.mockRejectedValue(authError);

            // WHEN: Processing payment with auth failure
            const response = await request(app)
                .post('/api/payment/process')
                .send(paymentData);

            // THEN: Should return 500 error
            expect(response.status).toBe(500);
            expect(response.body.error).toContain('failed');
        });
    });

    // ============================================================================
    // Test 6: POST /process - Duplicate key error handling (Error Path)
    // ============================================================================
    describe('Test 6: POST /process - Duplicate Key Error (Code 11000) Handling (Error Path)', () => {
        it('should handle duplicate key error when concurrent requests create same orderId', async () => {
            // GIVEN: Concurrent requests causing duplicate key error
            const paymentData = {
                orderId: 'ORDER-DUPLICATE-KEY',
                userId: 'USER-DUPLICATE',
                amount: 100.00,
                email: 'duplicate@example.com',
                phone: '+1234567890'
            };

            // Mock no existing payment initially
            Payment.findOne.mockResolvedValueOnce(null);

            // Mock Stripe success
            const mockIntent = {
                id: 'pi_duplicate',
                client_secret: 'pi_duplicate_secret'
            };
            mockPaymentIntents.create.mockResolvedValue(mockIntent);

            // Mock payment save to throw duplicate key error
            const duplicateError = new Error('E11000 duplicate key error');
            duplicateError.code = 11000;

            const mockPayment = {
                save: jest.fn().mockRejectedValue(duplicateError)
            };
            Payment.mockImplementation(() => mockPayment);

            // Mock findOne again to return existing paid payment
            const existingPaidPayment = {
                orderId: 'ORDER-DUPLICATE-KEY',
                status: 'Paid',
                stripePaymentIntentId: 'pi_existing',
                stripeClientSecret: 'pi_existing_secret'
            };
            Payment.findOne.mockResolvedValueOnce(existingPaidPayment);

            // WHEN: Processing payment with duplicate key error
            const response = await request(app)
                .post('/api/payment/process')
                .send(paymentData);

            // THEN: Should return 200 with paid status
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('message', '✅ This order has already been paid successfully.');
            expect(response.body).toHaveProperty('paymentStatus', 'Paid');
            expect(response.body).toHaveProperty('disablePayment', true);

            // Verify findOne was called twice (initial check + recovery)
            expect(Payment.findOne).toHaveBeenCalledTimes(2);
        });

        it('should return existing valid intent when duplicate error for pending payment', async () => {
            // GIVEN: Duplicate error but existing payment is pending with valid intent
            const paymentData = {
                orderId: 'ORDER-DUP-PENDING',
                userId: 'USER-DUP-PENDING',
                amount: 75.00,
                email: 'duppending@example.com',
                phone: '+2222222222'
            };

            Payment.findOne.mockResolvedValueOnce(null);

            mockPaymentIntents.create.mockResolvedValue({
                id: 'pi_new',
                client_secret: 'pi_new_secret'
            });

            const duplicateError = new Error('Duplicate key');
            duplicateError.code = 11000;

            const mockPayment = {
                save: jest.fn().mockRejectedValue(duplicateError)
            };
            Payment.mockImplementation(() => mockPayment);

            // Mock findOne to return pending payment
            const existingPendingPayment = {
                _id: 'existing_pending_id',
                orderId: 'ORDER-DUP-PENDING',
                status: 'Pending',
                stripePaymentIntentId: 'pi_existing_pending',
                stripeClientSecret: 'pi_existing_pending_secret'
            };
            Payment.findOne.mockResolvedValueOnce(existingPendingPayment);

            // Mock retrieve to return valid intent
            mockPaymentIntents.retrieve.mockResolvedValue({
                id: 'pi_existing_pending',
                status: 'requires_payment_method'
            });

            // WHEN: Processing payment with duplicate error for pending
            const response = await request(app)
                .post('/api/payment/process')
                .send(paymentData);

            // THEN: Should return existing client secret
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('clientSecret', 'pi_existing_pending_secret');
            expect(response.body).toHaveProperty('paymentId', 'existing_pending_id');
            expect(response.body).toHaveProperty('disablePayment', false);
        });

        it('should return 409 when duplicate error and existing intent is invalid', async () => {
            // GIVEN: Duplicate error with expired intent
            const paymentData = {
                orderId: 'ORDER-DUP-EXPIRED',
                userId: 'USER-DUP-EXPIRED',
                amount: 50.00,
                email: 'dupexpired@example.com',
                phone: '+3333333333'
            };

            Payment.findOne.mockResolvedValueOnce(null);

            mockPaymentIntents.create.mockResolvedValue({
                id: 'pi_new',
                client_secret: 'pi_new_secret'
            });

            const duplicateError = new Error('Duplicate');
            duplicateError.code = 11000;

            const mockPayment = {
                save: jest.fn().mockRejectedValue(duplicateError)
            };
            Payment.mockImplementation(() => mockPayment);

            const existingPayment = {
                orderId: 'ORDER-DUP-EXPIRED',
                status: 'Pending',
                stripePaymentIntentId: 'pi_expired',
                stripeClientSecret: 'pi_expired_secret'
            };
            Payment.findOne.mockResolvedValueOnce(existingPayment);

            // Mock retrieve to throw error (expired)
            mockPaymentIntents.retrieve.mockRejectedValue(new Error('Intent expired'));

            // WHEN: Processing with expired intent
            const response = await request(app)
                .post('/api/payment/process')
                .send(paymentData);

            // THEN: Should return 409 with retry message
            expect(response.status).toBe(409);
            expect(response.body).toHaveProperty('error', 'Payment intent expired. Please refresh the page and try again.');
            expect(response.body).toHaveProperty('shouldRetry', true);
        });

        it('should return 500 when duplicate error but no payment record found', async () => {
            // GIVEN: Duplicate error but findOne returns null
            const paymentData = {
                orderId: 'ORDER-DUP-NO-RECORD',
                userId: 'USER-DUP-NO-RECORD',
                amount: 25.00,
                email: 'dupnorecord@example.com',
                phone: '+4444444444'
            };

            Payment.findOne.mockResolvedValueOnce(null);

            mockPaymentIntents.create.mockResolvedValue({
                id: 'pi_test',
                client_secret: 'pi_test_secret'
            });

            const duplicateError = new Error('Duplicate');
            duplicateError.code = 11000;

            const mockPayment = {
                save: jest.fn().mockRejectedValue(duplicateError)
            };
            Payment.mockImplementation(() => mockPayment);

            // Mock findOne to return null (no existing payment found)
            Payment.findOne.mockResolvedValueOnce(null);

            // WHEN: Processing with duplicate error but no record
            const response = await request(app)
                .post('/api/payment/process')
                .send(paymentData);

            // THEN: Should return 500 error
            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty('error', 'Duplicate key error but no payment record found.');
        });
    });
});
