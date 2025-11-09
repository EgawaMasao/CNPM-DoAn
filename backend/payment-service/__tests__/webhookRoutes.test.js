// backend/payment-service/__tests__/webhookRoutes.test.js
const request = require('supertest');
const express = require('express');

// Mock external dependencies BEFORE requiring webhookRoutes
jest.mock('../models/PaymentModel');
jest.mock('../utils/twilioService');
jest.mock('../utils/emailService');
jest.mock('../config/db', () => jest.fn());

// Mock Stripe with proper structure
const mockWebhooks = {
    constructEvent: jest.fn()
};

jest.mock('stripe', () => {
    return jest.fn().mockImplementation(() => ({
        webhooks: mockWebhooks
    }));
});

const Payment = require('../models/PaymentModel');
const { sendSmsNotification } = require('../utils/twilioService');
const { sendEmailNotification } = require('../utils/emailService');
const webhookRoutes = require('../routes/webhookRoutes');

// Setup Express app for testing
const app = express();
app.use('/api/payment/webhook', webhookRoutes);

describe('WebhookRoutes Unit Tests - Shopee QA Standards', () => {
    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();

        // Setup default mocks
        Payment.findOne = jest.fn();
        sendSmsNotification.mockResolvedValue(undefined);
        sendEmailNotification.mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // ============================================================================
    // Test 1: POST /webhook - payment_intent.succeeded with valid signature (Happy Path)
    // ============================================================================
    describe('Test 1: POST /webhook - Payment Intent Succeeded with Valid Signature (Happy Path)', () => {
        it('should process payment_intent.succeeded event and update status to Paid', async () => {
            // GIVEN: Valid webhook event with payment_intent.succeeded
            const mockEvent = {
                type: 'payment_intent.succeeded',
                data: {
                    object: {
                        id: 'pi_test_succeeded_123',
                        metadata: {
                            orderId: 'ORDER-SUCCESS-001'
                        }
                    }
                }
            };

            // Mock Stripe webhook verification to return valid event
            mockWebhooks.constructEvent.mockReturnValue(mockEvent);

            // Mock existing payment with Pending status
            const mockPayment = {
                _id: 'payment_id_001',
                orderId: 'ORDER-SUCCESS-001',
                status: 'Pending',
                amount: 99.99,
                currency: 'usd',
                phone: '+1234567890',
                email: 'customer@example.com',
                createdAt: new Date('2025-01-01'),
                save: jest.fn().mockResolvedValue(true)
            };

            Payment.findOne.mockResolvedValue(mockPayment);

            const rawBody = JSON.stringify(mockEvent);

            // WHEN: Sending webhook POST request with valid signature
            const response = await request(app)
                .post('/api/payment/webhook')
                .set('stripe-signature', 'valid_signature_token')
                .set('Content-Type', 'application/json')
                .send(rawBody);

            // THEN: Should return 200 and update payment status to Paid
            expect(response.status).toBe(200);
            expect(response.body).toEqual({ received: true });

            // Verify Stripe webhook verification was called
            expect(mockWebhooks.constructEvent).toHaveBeenCalledWith(
                expect.any(Buffer),
                'valid_signature_token',
                process.env.STRIPE_WEBHOOK_SECRET
            );

            // Verify payment was found by orderId
            expect(Payment.findOne).toHaveBeenCalledWith({ orderId: 'ORDER-SUCCESS-001' });

            // Verify payment status was updated to Paid
            expect(mockPayment.status).toBe('Paid');
            expect(mockPayment.save).toHaveBeenCalled();

            // Verify SMS notification was sent
            expect(sendSmsNotification).toHaveBeenCalledWith(
                '+1234567890',
                'Your payment for Order ORDER-SUCCESS-001 was successful!'
            );

            // Verify Email notification was sent
            expect(sendEmailNotification).toHaveBeenCalledWith(
                'customer@example.com',
                'Payment Confirmation for Your Order',
                expect.stringContaining('ORDER-SUCCESS-001'),
                expect.stringContaining('ORDER-SUCCESS-001')
            );
        });

        it('should send both SMS and email notifications on successful payment', async () => {
            // GIVEN: Webhook event with customer phone and email
            const mockEvent = {
                type: 'payment_intent.succeeded',
                data: {
                    object: {
                        id: 'pi_notifications_test',
                        metadata: { orderId: 'ORDER-NOTIFY-001' }
                    }
                }
            };

            mockWebhooks.constructEvent.mockReturnValue(mockEvent);

            const mockPayment = {
                orderId: 'ORDER-NOTIFY-001',
                status: 'Pending',
                amount: 150.50,
                currency: 'usd',
                phone: '+9876543210',
                email: 'notify@example.com',
                createdAt: new Date(),
                save: jest.fn().mockResolvedValue(true)
            };

            Payment.findOne.mockResolvedValue(mockPayment);

            // WHEN: Processing successful payment webhook
            const response = await request(app)
                .post('/api/payment/webhook')
                .set('stripe-signature', 'valid_sig')
                .send(JSON.stringify(mockEvent));

            // THEN: Both SMS and email should be sent
            expect(response.status).toBe(200);
            expect(sendSmsNotification).toHaveBeenCalledTimes(1);
            expect(sendEmailNotification).toHaveBeenCalledTimes(1);
            expect(sendSmsNotification).toHaveBeenCalledWith(
                '+9876543210',
                expect.stringContaining('successful')
            );
            expect(sendEmailNotification).toHaveBeenCalledWith(
                'notify@example.com',
                expect.any(String),
                expect.stringContaining('$150.50'),
                expect.any(String)
            );
        });

        it('should not update payment if already marked as Paid', async () => {
            // GIVEN: Payment already in Paid status
            const mockEvent = {
                type: 'payment_intent.succeeded',
                data: {
                    object: {
                        id: 'pi_already_paid',
                        metadata: { orderId: 'ORDER-ALREADY-PAID' }
                    }
                }
            };

            mockWebhooks.constructEvent.mockReturnValue(mockEvent);

            const mockPayment = {
                orderId: 'ORDER-ALREADY-PAID',
                status: 'Paid', // Already paid
                phone: '+1111111111',
                email: 'paid@example.com',
                save: jest.fn()
            };

            Payment.findOne.mockResolvedValue(mockPayment);

            // WHEN: Processing webhook for already paid order
            const response = await request(app)
                .post('/api/payment/webhook')
                .set('stripe-signature', 'valid_sig')
                .send(JSON.stringify(mockEvent));

            // THEN: Should not update or send notifications
            expect(response.status).toBe(200);
            expect(mockPayment.save).not.toHaveBeenCalled();
            expect(sendSmsNotification).not.toHaveBeenCalled();
            expect(sendEmailNotification).not.toHaveBeenCalled();
        });

        it('should fallback to finding payment by stripePaymentIntentId when orderId missing', async () => {
            // GIVEN: Webhook without orderId in metadata (null pointer risk #4)
            const mockEvent = {
                type: 'payment_intent.succeeded',
                data: {
                    object: {
                        id: 'pi_no_orderid_123',
                        metadata: {} // No orderId
                    }
                }
            };

            mockWebhooks.constructEvent.mockReturnValue(mockEvent);

            // Mock payment to be found by paymentIntentId
            const mockPayment = {
                orderId: 'ORDER-FALLBACK-001',
                status: 'Pending',
                stripePaymentIntentId: 'pi_no_orderid_123',
                phone: '+1234567890',
                email: 'fallback@example.com',
                amount: 50.00,
                currency: 'usd',
                createdAt: new Date(),
                save: jest.fn().mockResolvedValue(true)
            };

            // Since orderId is undefined, code skips first findOne and only calls with paymentIntentId
            Payment.findOne.mockResolvedValueOnce(mockPayment);

            // WHEN: Processing webhook without orderId
            const response = await request(app)
                .post('/api/payment/webhook')
                .set('stripe-signature', 'valid_sig')
                .send(JSON.stringify(mockEvent));

            // THEN: Should find payment by paymentIntentId and process
            expect(response.status).toBe(200);
            expect(Payment.findOne).toHaveBeenCalledTimes(1); // Only called once with paymentIntentId
            expect(Payment.findOne).toHaveBeenCalledWith({ stripePaymentIntentId: 'pi_no_orderid_123' });
            expect(mockPayment.status).toBe('Paid');
            expect(mockPayment.save).toHaveBeenCalled();
        });
    });

    // ============================================================================
    // Test 2: POST /webhook - Invalid Stripe signature (Error Path)
    // ============================================================================
    describe('Test 2: POST /webhook - Invalid Stripe Signature Verification (Error Path)', () => {
        it('should return 400 error when signature verification fails', async () => {
            // GIVEN: Invalid webhook signature
            const invalidSignature = 'invalid_signature_token';
            const webhookBody = JSON.stringify({
                type: 'payment_intent.succeeded',
                data: { object: { id: 'pi_invalid' } }
            });

            // Mock Stripe to throw signature verification error
            const signatureError = new Error('Invalid signature');
            mockWebhooks.constructEvent.mockImplementation(() => {
                throw signatureError;
            });

            // WHEN: Sending webhook with invalid signature
            const response = await request(app)
                .post('/api/payment/webhook')
                .set('stripe-signature', invalidSignature)
                .send(webhookBody);

            // THEN: Should return 400 error and prevent processing
            expect(response.status).toBe(400);
            expect(response.text).toContain('Webhook Error: Invalid signature');

            // Verify constructEvent was called but threw error
            expect(mockWebhooks.constructEvent).toHaveBeenCalled();

            // Verify no database operations were performed
            expect(Payment.findOne).not.toHaveBeenCalled();

            // Verify no notifications were sent (security critical)
            expect(sendSmsNotification).not.toHaveBeenCalled();
            expect(sendEmailNotification).not.toHaveBeenCalled();
        });

        it('should prevent unauthorized webhook processing with missing signature', async () => {
            // GIVEN: Webhook request without signature header
            const webhookBody = JSON.stringify({
                type: 'payment_intent.succeeded',
                data: { object: { id: 'pi_no_sig' } }
            });

            mockWebhooks.constructEvent.mockImplementation(() => {
                throw new Error('No signatures found matching the expected signature');
            });

            // WHEN: Sending webhook without signature
            const response = await request(app)
                .post('/api/payment/webhook')
                // No stripe-signature header
                .send(webhookBody);

            // THEN: Should reject with 400 error
            expect(response.status).toBe(400);
            expect(response.text).toContain('Webhook Error');

            // Verify no payment operations occurred
            expect(Payment.findOne).not.toHaveBeenCalled();
        });

        it('should handle malformed signature gracefully', async () => {
            // GIVEN: Malformed signature
            const malformedSignature = 'malformed_sig_###@@@';
            const webhookBody = JSON.stringify({
                type: 'payment_intent.succeeded'
            });

            mockWebhooks.constructEvent.mockImplementation(() => {
                throw new Error('Unable to extract timestamp and signatures from header');
            });

            // WHEN: Processing webhook with malformed signature
            const response = await request(app)
                .post('/api/payment/webhook')
                .set('stripe-signature', malformedSignature)
                .send(webhookBody);

            // THEN: Should return 400 with error message
            expect(response.status).toBe(400);
            expect(response.text).toContain('Webhook Error');
            expect(Payment.findOne).not.toHaveBeenCalled();
        });

        it('should log security error when signature verification fails', async () => {
            // GIVEN: Security breach attempt with wrong secret
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            
            mockWebhooks.constructEvent.mockImplementation(() => {
                throw new Error('Webhook signature verification failed');
            });

            // WHEN: Attempting to send webhook with wrong secret
            const response = await request(app)
                .post('/api/payment/webhook')
                .set('stripe-signature', 'wrong_secret')
                .send(JSON.stringify({ type: 'payment_intent.succeeded' }));

            // THEN: Should log error and return 400
            expect(response.status).toBe(400);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Webhook signature verification failed'),
                expect.any(String)
            );

            consoleErrorSpy.mockRestore();
        });
    });

    // ============================================================================
    // Test 3: POST /webhook - payment_intent.payment_failed event (Happy Path)
    // ============================================================================
    describe('Test 3: POST /webhook - Payment Intent Failed Event (Happy Path)', () => {
        it('should update payment status to Failed and send failure notifications', async () => {
            // GIVEN: Valid webhook with payment_intent.payment_failed event
            const mockEvent = {
                type: 'payment_intent.payment_failed',
                data: {
                    object: {
                        id: 'pi_failed_123',
                        metadata: { orderId: 'ORDER-FAILED-001' }
                    }
                }
            };

            mockWebhooks.constructEvent.mockReturnValue(mockEvent);

            // Mock payment with Pending status
            const mockPayment = {
                orderId: 'ORDER-FAILED-001',
                status: 'Pending',
                phone: '+1234567890',
                email: 'failed@example.com',
                amount: 75.00,
                currency: 'usd',
                save: jest.fn().mockResolvedValue(true)
            };

            Payment.findOne.mockResolvedValue(mockPayment);

            // WHEN: Processing payment_failed webhook
            const response = await request(app)
                .post('/api/payment/webhook')
                .set('stripe-signature', 'valid_sig')
                .send(JSON.stringify(mockEvent));

            // THEN: Should update status to Failed
            expect(response.status).toBe(200);
            expect(response.body).toEqual({ received: true });

            // Verify payment status updated to Failed
            expect(mockPayment.status).toBe('Failed');
            expect(mockPayment.save).toHaveBeenCalled();

            // Verify failure SMS notification sent
            expect(sendSmsNotification).toHaveBeenCalledWith(
                '+1234567890',
                'Your payment for Order ORDER-FAILED-001 failed. Please try again. ❌'
            );

            // Verify failure email notification sent
            expect(sendEmailNotification).toHaveBeenCalledWith(
                'failed@example.com',
                'Payment Failure for Your Order',
                expect.stringContaining('ORDER-FAILED-001'),
                expect.stringContaining('failed')
            );
        });

        it('should send failure notifications to customer on payment failure', async () => {
            // GIVEN: Payment failed event with customer contact info
            const mockEvent = {
                type: 'payment_intent.payment_failed',
                data: {
                    object: {
                        id: 'pi_fail_notify',
                        metadata: { orderId: 'ORDER-FAIL-NOTIFY' }
                    }
                }
            };

            mockWebhooks.constructEvent.mockReturnValue(mockEvent);

            const mockPayment = {
                orderId: 'ORDER-FAIL-NOTIFY',
                status: 'Pending',
                phone: '+9999999999',
                email: 'notify-fail@example.com',
                save: jest.fn().mockResolvedValue(true)
            };

            Payment.findOne.mockResolvedValue(mockPayment);

            // WHEN: Processing failed payment
            const response = await request(app)
                .post('/api/payment/webhook')
                .set('stripe-signature', 'valid_sig')
                .send(JSON.stringify(mockEvent));

            // THEN: Both failure notifications should be sent
            expect(response.status).toBe(200);
            expect(sendSmsNotification).toHaveBeenCalledWith(
                '+9999999999',
                expect.stringContaining('failed')
            );
            expect(sendEmailNotification).toHaveBeenCalledWith(
                'notify-fail@example.com',
                expect.stringContaining('Failure'),
                expect.any(String),
                expect.any(String)
            );
        });

        it('should not update payment if already marked as Failed', async () => {
            // GIVEN: Payment already in Failed status
            const mockEvent = {
                type: 'payment_intent.payment_failed',
                data: {
                    object: {
                        id: 'pi_already_failed',
                        metadata: { orderId: 'ORDER-ALREADY-FAILED' }
                    }
                }
            };

            mockWebhooks.constructEvent.mockReturnValue(mockEvent);

            const mockPayment = {
                orderId: 'ORDER-ALREADY-FAILED',
                status: 'Failed', // Already failed
                phone: '+1111111111',
                email: 'alreadyfailed@example.com',
                save: jest.fn()
            };

            Payment.findOne.mockResolvedValue(mockPayment);

            // WHEN: Processing webhook for already failed payment
            const response = await request(app)
                .post('/api/payment/webhook')
                .set('stripe-signature', 'valid_sig')
                .send(JSON.stringify(mockEvent));

            // THEN: Should not update or send duplicate notifications
            expect(response.status).toBe(200);
            expect(mockPayment.save).not.toHaveBeenCalled();
            expect(sendSmsNotification).not.toHaveBeenCalled();
            expect(sendEmailNotification).not.toHaveBeenCalled();
        });

        it('should handle payment failure with missing phone gracefully', async () => {
            // GIVEN: Failed payment without phone number (null pointer risk #6)
            const mockEvent = {
                type: 'payment_intent.payment_failed',
                data: {
                    object: {
                        id: 'pi_fail_no_phone',
                        metadata: { orderId: 'ORDER-FAIL-NO-PHONE' }
                    }
                }
            };

            mockWebhooks.constructEvent.mockReturnValue(mockEvent);

            const mockPayment = {
                orderId: 'ORDER-FAIL-NO-PHONE',
                status: 'Pending',
                phone: null, // No phone number
                email: 'nophone@example.com',
                save: jest.fn().mockResolvedValue(true)
            };

            Payment.findOne.mockResolvedValue(mockPayment);

            // WHEN: Processing failed payment without phone
            const response = await request(app)
                .post('/api/payment/webhook')
                .set('stripe-signature', 'valid_sig')
                .send(JSON.stringify(mockEvent));

            // THEN: Should update status and send email only
            expect(response.status).toBe(200);
            expect(mockPayment.status).toBe('Failed');
            expect(mockPayment.save).toHaveBeenCalled();

            // SMS should not be sent
            expect(sendSmsNotification).not.toHaveBeenCalled();

            // Email should still be sent
            expect(sendEmailNotification).toHaveBeenCalled();
        });
    });

    // ============================================================================
    // Test 4: POST /webhook - Database save error (Error Path)
    // ============================================================================
    describe('Test 4: POST /webhook - Database Save Error Handling (Error Path)', () => {
        it('should return 500 when payment.save() throws database error', async () => {
            // GIVEN: Valid webhook but database fails to save
            const mockEvent = {
                type: 'payment_intent.succeeded',
                data: {
                    object: {
                        id: 'pi_db_error',
                        metadata: { orderId: 'ORDER-DB-ERROR' }
                    }
                }
            };

            mockWebhooks.constructEvent.mockReturnValue(mockEvent);

            // Mock payment with save() that throws error
            const dbError = new Error('MongoDB connection lost');
            const mockPayment = {
                orderId: 'ORDER-DB-ERROR',
                status: 'Pending',
                phone: '+1234567890',
                email: 'dberror@example.com',
                amount: 100.00,
                currency: 'usd',
                createdAt: new Date(),
                save: jest.fn().mockRejectedValue(dbError)
            };

            Payment.findOne.mockResolvedValue(mockPayment);

            // WHEN: Processing webhook with database failure
            const response = await request(app)
                .post('/api/payment/webhook')
                .set('stripe-signature', 'valid_sig')
                .send(JSON.stringify(mockEvent));

            // THEN: Should return 500 with error message
            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: 'Database update failed' });

            // Verify save was attempted
            expect(mockPayment.save).toHaveBeenCalled();

            // Verify notifications were not sent (incomplete state)
            expect(sendSmsNotification).not.toHaveBeenCalled();
            expect(sendEmailNotification).not.toHaveBeenCalled();
        });

        it('should handle database timeout error gracefully', async () => {
            // GIVEN: Database timeout during save operation
            const mockEvent = {
                type: 'payment_intent.succeeded',
                data: {
                    object: {
                        id: 'pi_timeout',
                        metadata: { orderId: 'ORDER-TIMEOUT' }
                    }
                }
            };

            mockWebhooks.constructEvent.mockReturnValue(mockEvent);

            const timeoutError = new Error('Operation timed out after 5000ms');
            const mockPayment = {
                orderId: 'ORDER-TIMEOUT',
                status: 'Pending',
                phone: '+1234567890',
                email: 'timeout@example.com',
                amount: 50.00,
                currency: 'usd',
                createdAt: new Date(),
                save: jest.fn().mockRejectedValue(timeoutError)
            };

            Payment.findOne.mockResolvedValue(mockPayment);

            // WHEN: Processing webhook with timeout
            const response = await request(app)
                .post('/api/payment/webhook')
                .set('stripe-signature', 'valid_sig')
                .send(JSON.stringify(mockEvent));

            // THEN: Should return 500 error
            expect(response.status).toBe(500);
            expect(response.body.error).toBe('Database update failed');
        });

        it('should prevent incomplete state when save fails', async () => {
            // GIVEN: Payment update fails mid-transaction
            const mockEvent = {
                type: 'payment_intent.succeeded',
                data: {
                    object: {
                        id: 'pi_incomplete',
                        metadata: { orderId: 'ORDER-INCOMPLETE' }
                    }
                }
            };

            mockWebhooks.constructEvent.mockReturnValue(mockEvent);

            const validationError = new Error('Validation failed: status is required');
            const mockPayment = {
                orderId: 'ORDER-INCOMPLETE',
                status: 'Pending',
                phone: '+1234567890',
                email: 'incomplete@example.com',
                amount: 75.00,
                currency: 'usd',
                createdAt: new Date(),
                save: jest.fn().mockRejectedValue(validationError)
            };

            Payment.findOne.mockResolvedValue(mockPayment);

            // WHEN: Save fails with validation error
            const response = await request(app)
                .post('/api/payment/webhook')
                .set('stripe-signature', 'valid_sig')
                .send(JSON.stringify(mockEvent));

            // THEN: Should return 500 and not send notifications
            expect(response.status).toBe(500);
            expect(response.body.error).toBe('Database update failed');

            // Verify no notifications sent (prevents inconsistent state)
            expect(sendSmsNotification).not.toHaveBeenCalled();
            expect(sendEmailNotification).not.toHaveBeenCalled();
        });

        it('should log database error when save fails', async () => {
            // GIVEN: Database error during payment save
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            const mockEvent = {
                type: 'payment_intent.succeeded',
                data: {
                    object: {
                        id: 'pi_log_error',
                        metadata: { orderId: 'ORDER-LOG-ERROR' }
                    }
                }
            };

            mockWebhooks.constructEvent.mockReturnValue(mockEvent);

            const dbError = new Error('Disk full');
            const mockPayment = {
                orderId: 'ORDER-LOG-ERROR',
                status: 'Pending',
                phone: '+1234567890',
                email: 'logerror@example.com',
                amount: 25.00,
                currency: 'usd',
                createdAt: new Date(),
                save: jest.fn().mockRejectedValue(dbError)
            };

            Payment.findOne.mockResolvedValue(mockPayment);

            // WHEN: Processing webhook with database error
            const response = await request(app)
                .post('/api/payment/webhook')
                .set('stripe-signature', 'valid_sig')
                .send(JSON.stringify(mockEvent));

            // THEN: Should log error
            expect(response.status).toBe(500);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Error updating payment status in DB'),
                'Disk full'
            );

            consoleErrorSpy.mockRestore();
        });

        it('should return 404 when payment record not found', async () => {
            // GIVEN: Webhook for non-existent payment (null pointer risk #5)
            const mockEvent = {
                type: 'payment_intent.succeeded',
                data: {
                    object: {
                        id: 'pi_not_found',
                        metadata: { orderId: 'ORDER-NOT-FOUND' }
                    }
                }
            };

            mockWebhooks.constructEvent.mockReturnValue(mockEvent);

            // Mock findOne to return null for both queries
            Payment.findOne.mockResolvedValue(null);

            // WHEN: Processing webhook for non-existent payment
            const response = await request(app)
                .post('/api/payment/webhook')
                .set('stripe-signature', 'valid_sig')
                .send(JSON.stringify(mockEvent));

            // THEN: Should return 404 error
            expect(response.status).toBe(404);
            expect(response.body).toEqual({ error: 'Payment record not found' });

            // Verify findOne was called twice (orderId and paymentIntentId)
            expect(Payment.findOne).toHaveBeenCalledTimes(2);

            // Verify no notifications sent
            expect(sendSmsNotification).not.toHaveBeenCalled();
            expect(sendEmailNotification).not.toHaveBeenCalled();
        });
    });
});
