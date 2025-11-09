// Jest Setup File - Load environment variables for tests
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.test if it exists, otherwise fall back to .env
const envPath = resolve(__dirname, '.env.test');
dotenv.config({ path: envPath });

// Set default values if not provided
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key_for_integration_tests_ci_cd';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/Restaurant';
process.env.PORT = process.env.PORT || '5002';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

console.log('🔧 Jest Environment Setup:');
console.log('  - JWT_SECRET:', process.env.JWT_SECRET ? '[SET]' : '[NOT SET]');
console.log('  - MONGO_URI:', process.env.MONGO_URI);
console.log('  - NODE_ENV:', process.env.NODE_ENV);
