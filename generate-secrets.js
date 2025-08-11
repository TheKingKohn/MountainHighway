#!/usr/bin/env node

/**
 * Generate secure secrets for production deployment
 * Run this script to get random secure values for your environment variables
 */

const crypto = require('crypto');

console.log('🔐 GENERATING SECURE SECRETS FOR PRODUCTION DEPLOYMENT\n');

// JWT Secret (64 characters)
const jwtSecret = crypto.randomBytes(32).toString('hex');
console.log('JWT_SECRET (copy this to Render environment variables):');
console.log(jwtSecret);
console.log('');

// Session Secret (64 characters)
const sessionSecret = crypto.randomBytes(32).toString('hex');
console.log('SESSION_SECRET (optional, for session management):');
console.log(sessionSecret);
console.log('');

// Webhook Secret (32 characters)
const webhookSecret = crypto.randomBytes(16).toString('hex');
console.log('WEBHOOK_SECRET (for Stripe webhooks):');
console.log('whsec_' + webhookSecret);
console.log('');

// Database Encryption Key (64 characters)
const dbEncryptionKey = crypto.randomBytes(32).toString('hex');
console.log('DB_ENCRYPTION_KEY (optional, for sensitive data):');
console.log(dbEncryptionKey);
console.log('');

console.log('✅ SECRETS GENERATED SUCCESSFULLY!');
console.log('');
console.log('📋 COPY THESE TO YOUR RENDER.COM ENVIRONMENT VARIABLES:');
console.log('');
console.log(`NODE_ENV=production`);
console.log(`PORT=4000`);
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`SESSION_SECRET=${sessionSecret}`);
console.log(`WEBHOOK_SECRET=whsec_${webhookSecret}`);
console.log(`FRONTEND_ORIGIN=https://mountain-highway.onrender.com`);
console.log(`PLATFORM_FEE_PERCENTAGE=8`);
console.log(`ENABLE_TEST_ROUTES=false`);
console.log(`ENABLE_MOCK_PAYMENTS=true`);
console.log('');
console.log('⚠️  IMPORTANT: Keep these secrets secure and never commit them to git!');
console.log('🔒 These secrets are one-time use only. Run this script again if needed.');

// Create a simple checklist
console.log('\n📝 DEPLOYMENT CHECKLIST:');
console.log('□ Push code to GitHub');
console.log('□ Create Render.com account');
console.log('□ Deploy PostgreSQL database');
console.log('□ Deploy API service with above environment variables');
console.log('□ Deploy frontend static site');
console.log('□ Test all functionality');
console.log('□ Share URL with friends!');
