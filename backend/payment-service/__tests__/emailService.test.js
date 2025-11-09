// Mock Resend API before requiring emailService
const mockEmailsSend = jest.fn();
const mockResendInstance = {
  emails: {
    send: mockEmailsSend
  }
};

jest.mock('resend', () => {
  return {
    Resend: jest.fn(() => mockResendInstance)
  };
});

// Now require emailService after the mock is set up
const { sendEmailNotification } = require('../utils/emailService');

describe('EmailService - sendEmailNotification', () => {
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
    it('should send email successfully with all valid parameters (to, subject, html, text)', async () => {
      // GIVEN: Valid email parameters and successful Resend API response
      const to = 'customer@example.com';
      const subject = 'Payment Confirmation';
      const html = '<h1>Payment Successful</h1><p>Thank you for your payment!</p>';
      const text = 'Payment Successful. Thank you for your payment!';
      
      const mockResponse = {
        id: 'email_123456789',
        from: 'SkyDish <onboarding@resend.dev>',
        to: to,
        created_at: new Date().toISOString()
      };
      
      mockEmailsSend.mockResolvedValue(mockResponse);

      // WHEN: sendEmailNotification is called with valid parameters
      await sendEmailNotification(to, subject, html, text);

      // THEN: Resend API should be called with correct data
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
      expect(mockEmailsSend).toHaveBeenCalledWith({
        from: 'SkyDish <onboarding@resend.dev>',
        to: to,
        subject: subject,
        html: html
      });
      
      // THEN: Success message should be logged
      expect(console.log).toHaveBeenCalledWith('Resend API Response:', mockResponse);
      expect(console.log).toHaveBeenCalledWith(`Email sent to ${to}: ${mockResponse.id}`);
    });
  });

  describe('Error Path Tests - Null/Missing Parameters', () => {
    it('should throw error when "to" parameter is null (null pointer risk #1)', async () => {
      // GIVEN: Missing 'to' parameter (null)
      const to = null;
      const subject = 'Test Subject';
      const html = '<p>Test HTML</p>';

      // Mock Resend to throw error for null 'to'
      const expectedError = new Error('Invalid recipient email address');
      mockEmailsSend.mockRejectedValue(expectedError);

      // WHEN: sendEmailNotification is called with null 'to'
      // THEN: Should throw error and log it
      await expect(sendEmailNotification(to, subject, html)).rejects.toThrow('Invalid recipient email address');
      
      expect(console.error).toHaveBeenCalledWith('❌ Error sending email:', expectedError.message);
      expect(mockEmailsSend).toHaveBeenCalledWith({
        from: 'SkyDish <onboarding@resend.dev>',
        to: null,
        subject: subject,
        html: html
      });
    });

    it('should throw error when "to" parameter is undefined', async () => {
      // GIVEN: Missing 'to' parameter (undefined)
      const to = undefined;
      const subject = 'Test Subject';
      const html = '<p>Test HTML</p>';

      // Mock Resend to throw error for undefined 'to'
      const expectedError = new Error('Recipient email is required');
      mockEmailsSend.mockRejectedValue(expectedError);

      // WHEN: sendEmailNotification is called with undefined 'to'
      // THEN: Should throw error and log it
      await expect(sendEmailNotification(to, subject, html)).rejects.toThrow('Recipient email is required');
      
      expect(console.error).toHaveBeenCalledWith('❌ Error sending email:', expectedError.message);
    });

    it('should throw error when "subject" parameter is null', async () => {
      // GIVEN: Missing 'subject' parameter (null)
      const to = 'customer@example.com';
      const subject = null;
      const html = '<p>Test HTML</p>';

      // Mock Resend to throw error for null 'subject'
      const expectedError = new Error('Subject is required');
      mockEmailsSend.mockRejectedValue(expectedError);

      // WHEN: sendEmailNotification is called with null 'subject'
      // THEN: Should throw error and log it
      await expect(sendEmailNotification(to, subject, html)).rejects.toThrow('Subject is required');
      
      expect(console.error).toHaveBeenCalledWith('❌ Error sending email:', expectedError.message);
    });
  });

  describe('Error Path Tests - API Failures', () => {
    it('should catch and re-throw error when resend.emails.send() throws API error', async () => {
      // GIVEN: Valid parameters but Resend API throws error
      const to = 'customer@example.com';
      const subject = 'Payment Confirmation';
      const html = '<h1>Payment Successful</h1>';
      
      const apiError = new Error('Resend API service temporarily unavailable');
      mockEmailsSend.mockRejectedValue(apiError);

      // WHEN: sendEmailNotification is called and API fails
      // THEN: Error should be caught, logged, and re-thrown to caller
      await expect(sendEmailNotification(to, subject, html)).rejects.toThrow('Resend API service temporarily unavailable');
      
      expect(console.error).toHaveBeenCalledWith('❌ Error sending email:', apiError.message);
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    });

    it('should throw error when Resend API authentication fails (invalid API key)', async () => {
      // GIVEN: Invalid API key causing authentication failure
      const to = 'customer@example.com';
      const subject = 'Payment Confirmation';
      const html = '<h1>Payment Successful</h1>';
      
      const authError = new Error('Authentication failed: Invalid API key');
      authError.statusCode = 401;
      mockEmailsSend.mockRejectedValue(authError);

      // WHEN: sendEmailNotification is called with invalid credentials
      // THEN: Error message should be logged and thrown
      await expect(sendEmailNotification(to, subject, html)).rejects.toThrow('Authentication failed: Invalid API key');
      
      expect(console.error).toHaveBeenCalledWith('❌ Error sending email:', authError.message);
      expect(mockEmailsSend).toHaveBeenCalledWith({
        from: 'SkyDish <onboarding@resend.dev>',
        to: to,
        subject: subject,
        html: html
      });
    });

    it('should catch and re-throw error when Resend API rate limit is exceeded', async () => {
      // GIVEN: Rate limit exceeded error from Resend API
      const to = 'customer@example.com';
      const subject = 'Payment Confirmation';
      const html = '<h1>Payment Successful</h1>';
      
      const rateLimitError = new Error('Rate limit exceeded. Please try again later.');
      rateLimitError.statusCode = 429;
      mockEmailsSend.mockRejectedValue(rateLimitError);

      // WHEN: sendEmailNotification is called and rate limit is hit
      // THEN: Error should be caught and re-thrown with proper error message
      await expect(sendEmailNotification(to, subject, html)).rejects.toThrow('Rate limit exceeded. Please try again later.');
      
      expect(console.error).toHaveBeenCalledWith('❌ Error sending email:', rateLimitError.message);
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string parameters', async () => {
      // GIVEN: Empty string parameters (edge case)
      const to = '';
      const subject = '';
      const html = '';
      
      const emptyError = new Error('Invalid email parameters: empty strings');
      mockEmailsSend.mockRejectedValue(emptyError);

      // WHEN: sendEmailNotification is called with empty strings
      // THEN: Should throw error
      await expect(sendEmailNotification(to, subject, html)).rejects.toThrow('Invalid email parameters: empty strings');
      
      expect(console.error).toHaveBeenCalledWith('❌ Error sending email:', emptyError.message);
    });

    it('should handle successful response without id field', async () => {
      // GIVEN: Valid parameters but response missing id field
      const to = 'customer@example.com';
      const subject = 'Payment Confirmation';
      const html = '<h1>Payment Successful</h1>';
      
      const mockResponse = {
        // Missing 'id' field
        from: 'SkyDish <onboarding@resend.dev>',
        to: to
      };
      
      mockEmailsSend.mockResolvedValue(mockResponse);

      // WHEN: sendEmailNotification is called and response has no id
      await sendEmailNotification(to, subject, html);

      // THEN: Should still succeed but log "No ID returned"
      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith('Resend API Response:', mockResponse);
      expect(console.log).toHaveBeenCalledWith(`Email sent to ${to}: No ID returned`);
    });
  });
});
