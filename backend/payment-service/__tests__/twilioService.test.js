// Mock Twilio API before requiring twilioService
const mockMessagesCreate = jest.fn();
const mockTwilioClient = {
  messages: {
    create: mockMessagesCreate
  }
};

jest.mock('twilio', () => {
  return jest.fn(() => mockTwilioClient);
});

// Now require twilioService after the mock is set up
const { sendSmsNotification } = require('../utils/twilioService');

describe('TwilioService - sendSmsNotification', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Suppress console logs during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console after each test
    console.log.mockRestore();
    console.error.mockRestore();
  });

  describe('Happy Path Tests', () => {
    it('should send SMS successfully with valid phoneNumber and message', async () => {
      // GIVEN: Valid phone number and message
      const phoneNumber = '+1234567890';
      const message = 'Your payment of $50.00 has been processed successfully!';
      
      const mockResponse = {
        sid: 'SM1234567890abcdef',
        status: 'queued',
        to: phoneNumber,
        from: process.env.TWILIO_PHONE_NUMBER,
        body: message
      };
      
      mockMessagesCreate.mockResolvedValue(mockResponse);

      // WHEN: sendSmsNotification is called with valid parameters
      await sendSmsNotification(phoneNumber, message);

      // THEN: Twilio client.messages.create() should be called with correct parameters
      expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
      expect(mockMessagesCreate).toHaveBeenCalledWith({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });
      
      // THEN: Success message should be logged with correct format
      expect(console.log).toHaveBeenCalledWith(`SMS sent to ${phoneNumber}: ${mockResponse.sid}`);
    });

    it('should log success message with response.sid when SMS is sent', async () => {
      // GIVEN: Valid parameters and successful Twilio response with sid
      const phoneNumber = '+9876543210';
      const message = 'Order #12345 confirmed';
      
      const mockResponse = {
        sid: 'SMabcdef1234567890',
        status: 'sent'
      };
      
      mockMessagesCreate.mockResolvedValue(mockResponse);

      // WHEN: sendSmsNotification is called
      await sendSmsNotification(phoneNumber, message);

      // THEN: Console log should display correct format with sid
      expect(console.log).toHaveBeenCalledWith(`SMS sent to ${phoneNumber}: ${mockResponse.sid}`);
      expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Path Tests - Null/Missing Parameters', () => {
    it('should handle null phoneNumber parameter without crashing (null pointer risk #1)', async () => {
      // GIVEN: Null phoneNumber parameter
      const phoneNumber = null;
      const message = 'Test message';
      
      const expectedError = new Error('Invalid phone number');
      mockMessagesCreate.mockRejectedValue(expectedError);

      // WHEN: sendSmsNotification is called with null phoneNumber
      // THEN: Should catch error, log it, and NOT re-throw (no crash)
      await expect(sendSmsNotification(phoneNumber, message)).resolves.not.toThrow();
      
      // THEN: Error should be logged with proper format
      expect(console.error).toHaveBeenCalledWith('❌ Error sending SMS:', expectedError.message);
      expect(mockMessagesCreate).toHaveBeenCalledWith({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: null
      });
    });

    it('should handle null message parameter without crashing (null pointer risk #2)', async () => {
      // GIVEN: Null message parameter
      const phoneNumber = '+1234567890';
      const message = null;
      
      const expectedError = new Error('Message body is required');
      mockMessagesCreate.mockRejectedValue(expectedError);

      // WHEN: sendSmsNotification is called with null message
      // THEN: Should catch error, log it, and NOT re-throw (no crash)
      await expect(sendSmsNotification(phoneNumber, message)).resolves.not.toThrow();
      
      // THEN: Error should be logged with proper format
      expect(console.error).toHaveBeenCalledWith('❌ Error sending SMS:', expectedError.message);
      expect(mockMessagesCreate).toHaveBeenCalledWith({
        body: null,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });
    });

    it('should handle undefined phoneNumber parameter', async () => {
      // GIVEN: Undefined phoneNumber parameter
      const phoneNumber = undefined;
      const message = 'Test message';
      
      const expectedError = new Error('Phone number is required');
      mockMessagesCreate.mockRejectedValue(expectedError);

      // WHEN: sendSmsNotification is called with undefined phoneNumber
      // THEN: Should catch error and log it without crashing
      await expect(sendSmsNotification(phoneNumber, message)).resolves.not.toThrow();
      
      expect(console.error).toHaveBeenCalledWith('❌ Error sending SMS:', expectedError.message);
    });
  });

  describe('Error Path Tests - Twilio API Failures', () => {
    it('should catch and log error when client.messages.create() throws API error without re-throwing', async () => {
      // GIVEN: Valid parameters but Twilio API throws network/service error
      const phoneNumber = '+1234567890';
      const message = 'Payment confirmation';
      
      const apiError = new Error('Twilio service temporarily unavailable');
      apiError.code = 500;
      mockMessagesCreate.mockRejectedValue(apiError);

      // WHEN: sendSmsNotification is called and API fails
      // THEN: Error should be caught and logged but NOT re-thrown (no crash)
      await expect(sendSmsNotification(phoneNumber, message)).resolves.not.toThrow();
      
      expect(console.error).toHaveBeenCalledWith('❌ Error sending SMS:', apiError.message);
      expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    });

    it('should handle Twilio authentication failure without crashing', async () => {
      // GIVEN: Invalid accountSid/authToken causing authentication failure
      const phoneNumber = '+1234567890';
      const message = 'Payment confirmation';
      
      const authError = new Error('Authentication failed: Invalid credentials');
      authError.code = 20003;
      authError.status = 401;
      mockMessagesCreate.mockRejectedValue(authError);

      // WHEN: sendSmsNotification is called with invalid credentials
      // THEN: Error should be logged with proper message format and NOT re-thrown
      await expect(sendSmsNotification(phoneNumber, message)).resolves.not.toThrow();
      
      expect(console.error).toHaveBeenCalledWith('❌ Error sending SMS:', authError.message);
      expect(mockMessagesCreate).toHaveBeenCalledWith({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });
    });

    it('should handle invalid phone number format error', async () => {
      // GIVEN: Invalid phone number format
      const phoneNumber = 'invalid-phone';
      const message = 'Test message';
      
      const formatError = new Error('Invalid phone number format');
      formatError.code = 21211;
      mockMessagesCreate.mockRejectedValue(formatError);

      // WHEN: sendSmsNotification is called with invalid format
      // THEN: Should catch error, log it, and NOT throw
      await expect(sendSmsNotification(phoneNumber, message)).resolves.not.toThrow();
      
      expect(console.error).toHaveBeenCalledWith('❌ Error sending SMS:', formatError.message);
    });

    it('should handle Twilio rate limit error', async () => {
      // GIVEN: Rate limit exceeded error from Twilio
      const phoneNumber = '+1234567890';
      const message = 'Test message';
      
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.code = 20429;
      rateLimitError.status = 429;
      mockMessagesCreate.mockRejectedValue(rateLimitError);

      // WHEN: sendSmsNotification is called and rate limit is hit
      // THEN: Error should be caught and logged without throwing
      await expect(sendSmsNotification(phoneNumber, message)).resolves.not.toThrow();
      
      expect(console.error).toHaveBeenCalledWith('❌ Error sending SMS:', rateLimitError.message);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string parameters', async () => {
      // GIVEN: Empty string parameters (edge case)
      const phoneNumber = '';
      const message = '';
      
      const emptyError = new Error('Invalid parameters: empty strings');
      mockMessagesCreate.mockRejectedValue(emptyError);

      // WHEN: sendSmsNotification is called with empty strings
      // THEN: Should catch error and log it without throwing
      await expect(sendSmsNotification(phoneNumber, message)).resolves.not.toThrow();
      
      expect(console.error).toHaveBeenCalledWith('❌ Error sending SMS:', emptyError.message);
      expect(mockMessagesCreate).toHaveBeenCalledWith({
        body: '',
        from: process.env.TWILIO_PHONE_NUMBER,
        to: ''
      });
    });

    it('should handle very long message content', async () => {
      // GIVEN: Very long message exceeding SMS limits
      const phoneNumber = '+1234567890';
      const message = 'A'.repeat(2000); // Very long message
      
      const mockResponse = {
        sid: 'SM_long_message_123',
        status: 'queued'
      };
      
      mockMessagesCreate.mockResolvedValue(mockResponse);

      // WHEN: sendSmsNotification is called with long message
      await sendSmsNotification(phoneNumber, message);

      // THEN: Should successfully send and log
      expect(mockMessagesCreate).toHaveBeenCalledWith({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });
      expect(console.log).toHaveBeenCalledWith(`SMS sent to ${phoneNumber}: ${mockResponse.sid}`);
    });

    it('should handle international phone numbers', async () => {
      // GIVEN: International phone number format
      const phoneNumber = '+44123456789'; // UK number
      const message = 'International payment confirmed';
      
      const mockResponse = {
        sid: 'SM_international_123',
        status: 'sent'
      };
      
      mockMessagesCreate.mockResolvedValue(mockResponse);

      // WHEN: sendSmsNotification is called with international number
      await sendSmsNotification(phoneNumber, message);

      // THEN: Should successfully send
      expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(`SMS sent to ${phoneNumber}: ${mockResponse.sid}`);
    });
  });
});
