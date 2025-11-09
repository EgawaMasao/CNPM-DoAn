// Load test environment variables
require('dotenv').config({ path: '.env.test' });

// Set NODE_ENV explicitly
process.env.NODE_ENV = 'test';

// Increase timeout for integration tests
jest.setTimeout(30000);
