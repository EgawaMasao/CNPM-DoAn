/**
 * INTEGRATION TEST: AUTH-02 - No Password Strength Validation
 * 
 * RISK DESCRIPTION:
 * Password field only validates minimum length (6 characters) without checking
 * complexity requirements like uppercase, lowercase, numbers, or special characters.
 * This allows users to create accounts with weak passwords vulnerable to brute-force.
 * 
 * VULNERABILITY LOCATION:
 * - models/Customer.js (lines 28-32) - Password schema definition
 * - controllers/customerController.js (line 17) - Register handler
 * 
 * BUSINESS IMPACT:
 * - User accounts easily compromised through brute-force
 * - Dictionary attacks successful with common passwords
 * - Compliance violations (GDPR, PCI-DSS require strong passwords)
 * - Reputational damage from account breaches
 * 
 * TEST STRATEGY:
 * 1. Register accounts with various weak passwords
 * 2. Verify all weak passwords are accepted (THE VULNERABILITY)
 * 3. Document common weak password patterns
 * 4. Measure password entropy
 */

require('dotenv').config();
const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Customer = require('../../models/Customer');

// Create Express app mimicking auth-service
const createApp = () => {
  const app = express();
  app.use(express.json());

  app.post('/api/auth/register/customer', async (req, res) => {
    try {
      const { firstName, lastName, email, phone, password, location } = req.body;

      if (!firstName || !lastName || !email || !phone || !password) {
        return res.status(400).json({ message: "Please provide all required fields." });
      }

      const existing = await Customer.findOne({ email });
      if (existing) {
        return res.status(409).json({ message: "Email already registered." });
      }

      const newCustomer = await Customer.create({
        firstName,
        lastName,
        email,
        phone,
        password,
        location
      });

      res.status(201).json({
        status: "success",
        data: {
          customer: {
            id: newCustomer._id,
            email: newCustomer.email
          }
        }
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  return app;
};

describe('RISK-AUTH-02: No Password Strength Validation', () => {
  let app;

  beforeAll(async () => {
    await Customer.deleteMany({ email: /^weak_pass_test_/ });
    app = createApp();
  }, 30000);

  afterAll(async () => {
    await Customer.deleteMany({ email: /^weak_pass_test_/ });
  }, 30000);

  describe('Test Case 1: Numeric-Only Passwords (Extremely Weak)', () => {
    const weakNumericPasswords = [
      { password: '111111', description: 'All same digit' },
      { password: '123456', description: 'Sequential numbers (most common password)' },
      { password: '000000', description: 'All zeros' },
      { password: '654321', description: 'Reverse sequential' },
      { password: '123321', description: 'Pattern repeat' },
    ];

    weakNumericPasswords.forEach(({ password, description }, index) => {
      it(`should ACCEPT weak password "${password}" - ${description}`, async () => {
        // GIVEN: Extremely weak numeric password
        const response = await request(app)
          .post('/api/auth/register/customer')
          .send({
            firstName: 'Weak',
            lastName: 'Numeric',
            email: `weak_pass_test_numeric_${index}@test.com`,
            phone: '0901111111',
            password: password, // Only 6 digits, no complexity
            location: 'Test City'
          });

        // THEN: Account created successfully (THE VULNERABILITY)
        expect(response.status).toBe(201);
        expect(response.body.status).toBe('success');
        
        // SHOULD BE: 400 Bad Request - "Password must contain uppercase, lowercase, number, special char"
      });
    });
  });

  describe('Test Case 2: Alphabet-Only Passwords (Very Weak)', () => {
    const weakAlphaPasswords = [
      { password: 'aaaaaa', description: 'All same letter' },
      { password: 'abcdef', description: 'Sequential letters' },
      { password: 'qwerty', description: 'Keyboard pattern' },
      { password: 'asdfgh', description: 'Keyboard row' },
      { password: 'zxcvbn', description: 'Keyboard bottom row' },
    ];

    weakAlphaPasswords.forEach(({ password, description }, index) => {
      it(`should ACCEPT weak password "${password}" - ${description}`, async () => {
        const response = await request(app)
          .post('/api/auth/register/customer')
          .send({
            firstName: 'Weak',
            lastName: 'Alpha',
            email: `weak_pass_test_alpha_${index}@test.com`,
            phone: '0902222222',
            password: password,
            location: 'Test City'
          });

        expect(response.status).toBe(201);
        expect(response.body.status).toBe('success');
      });
    });
  });

  describe('Test Case 3: Common Dictionary Words', () => {
    const commonPasswords = [
      { password: 'password', description: 'Literal "password"' },
      { password: 'welcome', description: 'Common word' },
      { password: 'letmein', description: 'Common phrase' },
      { password: 'monkey', description: 'Common dictionary word' },
      { password: 'dragon', description: 'Top 10 most common' },
    ];

    commonPasswords.forEach(({ password, description }, index) => {
      it(`should ACCEPT dictionary word "${password}" - ${description}`, async () => {
        const response = await request(app)
          .post('/api/auth/register/customer')
          .send({
            firstName: 'Weak',
            lastName: 'Dictionary',
            email: `weak_pass_test_dict_${index}@test.com`,
            phone: '0903333333',
            password: password,
            location: 'Test City'
          });

        expect(response.status).toBe(201);
        expect(response.body.status).toBe('success');
        
        // These are in top 25 most common passwords globally!
      });
    });
  });

  describe('Test Case 4: Minimum Length Boundary Testing', () => {
    it('should REJECT password with less than 6 characters', async () => {
      // GIVEN: Password with 5 characters (below minimum)
      const response = await request(app)
        .post('/api/auth/register/customer')
        .send({
          firstName: 'Short',
          lastName: 'Pass',
          email: 'weak_pass_test_short@test.com',
          phone: '0904444444',
          password: '12345', // Only 5 chars
          location: 'Test City'
        });

      // THEN: Mongoose validation fails
      expect(response.status).toBe(500);
      expect(response.body.message).toContain('shorter than the minimum');
    });

    it('should ACCEPT exactly 6 characters regardless of complexity', async () => {
      // GIVEN: Password with exactly 6 characters (all same)
      const response = await request(app)
        .post('/api/auth/register/customer')
        .send({
          firstName: 'Minimum',
          lastName: 'Length',
          email: 'weak_pass_test_min@test.com',
          phone: '0905555555',
          password: 'aaaaaa', // Exactly 6 chars, no complexity
          location: 'Test City'
        });

      // THEN: Accepted (THE VULNERABILITY)
      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
    });

    it('should ACCEPT long password with no complexity', async () => {
      // GIVEN: Long password but no uppercase/numbers/special chars
      const response = await request(app)
        .post('/api/auth/register/customer')
        .send({
          firstName: 'Long',
          lastName: 'Weak',
          email: 'weak_pass_test_long@test.com',
          phone: '0906666666',
          password: 'aaaaaaaaaaaaaaaaaaaa', // 20 chars, still weak
          location: 'Test City'
        });

      // THEN: Accepted despite being weak
      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
    });
  });

  describe('Test Case 5: Personal Information in Passwords', () => {
    it('should ACCEPT password containing email username', async () => {
      // GIVEN: Password derived from email
      const email = 'weak_pass_test_email@test.com';
      const password = 'weakpass'; // Matches email username

      const response = await request(app)
        .post('/api/auth/register/customer')
        .send({
          firstName: 'Email',
          lastName: 'Based',
          email: email,
          phone: '0907777777',
          password: password,
          location: 'Test City'
        });

      // THEN: Accepted (should check against email/name)
      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
    });

    it('should ACCEPT password containing user name', async () => {
      // GIVEN: Password matches first or last name
      const response = await request(app)
        .post('/api/auth/register/customer')
        .send({
          firstName: 'john',
          lastName: 'doe',
          email: 'weak_pass_test_name@test.com',
          phone: '0908888888',
          password: 'johndoe', // 7 chars, contains name
          location: 'Test City'
        });

      // THEN: Accepted (should reject passwords containing user info)
      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
    });

    it('should ACCEPT password with phone number pattern', async () => {
      // GIVEN: Password derived from phone number
      const response = await request(app)
        .post('/api/auth/register/customer')
        .send({
          firstName: 'Phone',
          lastName: 'Pass',
          email: 'weak_pass_test_phone@test.com',
          phone: '0909999999',
          password: '090999', // 6 digits from phone
          location: 'Test City'
        });

      // THEN: Accepted despite containing personal info
      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
    });
  });

  describe('Test Case 6: Password Entropy Analysis', () => {
    it('should demonstrate low entropy passwords are accepted', async () => {
      // Test passwords with different entropy levels
      const entropyTests = [
        {
          password: '111111',
          description: 'Zero entropy (all same)',
          entropyBits: 0,
          email: 'weak_pass_test_entropy_0@test.com'
        },
        {
          password: 'aaabbb',
          description: 'Very low entropy (2 chars)',
          entropyBits: 6,
          email: 'weak_pass_test_entropy_1@test.com'
        },
        {
          password: 'abc123',
          description: 'Low entropy (common pattern)',
          entropyBits: 15,
          email: 'weak_pass_test_entropy_2@test.com'
        }
      ];

      for (const test of entropyTests) {
        const response = await request(app)
          .post('/api/auth/register/customer')
          .send({
            firstName: 'Entropy',
            lastName: 'Test',
            email: test.email,
            phone: '0909111111',
            password: test.password,
            location: 'Test City'
          });

        // All low entropy passwords accepted
        expect(response.status).toBe(201);
        expect(response.body.status).toBe('success');
      }

      // Note: Strong password should have 60+ bits of entropy
      // These weak passwords have < 20 bits
    });
  });

  describe('Test Case 7: Brute-Force Time Estimation', () => {
    it('should document that weak passwords can be cracked quickly', async () => {
      // Create accounts with passwords of varying strength
      const crackTimeTests = [
        {
          password: '111111',
          estimatedCrackTime: '< 1 second',
          attempts: 1, // First guess
          email: 'weak_pass_test_crack_1@test.com'
        },
        {
          password: '123456',
          estimatedCrackTime: '< 1 second',
          attempts: 10, // Top 10 list
          email: 'weak_pass_test_crack_2@test.com'
        },
        {
          password: 'password',
          estimatedCrackTime: '< 1 second',
          attempts: 100, // Top 100 list
          email: 'weak_pass_test_crack_3@test.com'
        },
        {
          password: 'abcdef',
          estimatedCrackTime: '< 1 minute',
          attempts: 10000, // Simple dictionary
          email: 'weak_pass_test_crack_4@test.com'
        }
      ];

      for (const test of crackTimeTests) {
        const response = await request(app)
          .post('/api/auth/register/customer')
          .send({
            firstName: 'Crack',
            lastName: 'Time',
            email: test.email,
            phone: '0909222222',
            password: test.password,
            location: 'Test City'
          });

        expect(response.status).toBe(201);
        
        // Document: These passwords can be cracked in the estimated time
        console.log(`Password "${test.password}" can be cracked in ${test.estimatedCrackTime} with ~${test.attempts} attempts`);
      }
    });
  });

  describe('Test Case 8: Compliance and Best Practices Violations', () => {
    it('should document NIST SP 800-63B violations', async () => {
      // NIST recommends:
      // - Minimum 8 characters (we allow 6) ❌
      // - Check against compromised password lists ❌
      // - No complexity requirements but longer minimum ❌
      
      const response = await request(app)
        .post('/api/auth/register/customer')
        .send({
          firstName: 'NIST',
          lastName: 'Violation',
          email: 'weak_pass_test_nist@test.com',
          phone: '0909333333',
          password: '123456', // In "Have I Been Pwned" database
          location: 'Test City'
        });

      expect(response.status).toBe(201);
      // Should be rejected as compromised password
    });

    it('should document OWASP ASVS violations', async () => {
      // OWASP ASVS Level 1 requires:
      // - Minimum 8 characters ❌
      // - Maximum 64 characters (we don't check) ⚠️
      // - No truncation ✓
      // - Check against top 3000 passwords ❌
      
      const response = await request(app)
        .post('/api/auth/register/customer')
        .send({
          firstName: 'OWASP',
          lastName: 'Violation',
          email: 'weak_pass_test_owasp@test.com',
          phone: '0909444444',
          password: 'qwerty', // In top 3000
          location: 'Test City'
        });

      expect(response.status).toBe(201);
    });
  });

  describe('Test Case 9: Real-World Attack Scenarios', () => {
    it('should demonstrate credential stuffing vulnerability', async () => {
      // Credential stuffing: Using leaked credentials from other breaches
      const commonLeakedCredentials = [
        { email: 'weak_pass_test_leak_1@test.com', password: 'password123' },
        { email: 'weak_pass_test_leak_2@test.com', password: 'welcome1' },
        { email: 'weak_pass_test_leak_3@test.com', password: 'abc123' },
      ];

      for (const cred of commonLeakedCredentials) {
        const response = await request(app)
          .post('/api/auth/register/customer')
          .send({
            firstName: 'Leaked',
            lastName: 'Credentials',
            email: cred.email,
            phone: '0909555555',
            password: cred.password,
            location: 'Test City'
          });

        // All commonly leaked passwords accepted
        expect(response.status).toBe(201);
      }
    });
  });
});
