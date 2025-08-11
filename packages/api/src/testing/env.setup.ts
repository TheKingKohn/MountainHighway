/**
 * Test Environment Setup
 * Configures environment variables for testing
 */

process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Use random available port
process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.FRONTEND_ORIGIN = 'http://localhost:3000';
process.env.UPLOAD_DIR = './test-uploads';
process.env.STRIPE_SECRET_KEY = 'sk_test_123456789';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123456789';
process.env.MOCK_PAYMENTS = 'true';
process.env.DETAILED_ERRORS = 'true';
process.env.ENABLE_DEV_ROUTES = 'true';
