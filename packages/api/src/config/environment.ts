import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

/**
 * Environment Configuration for Mountain Highway API
 * 
 * This module handles environment variable validation and provides
 * typed access to configuration values with safe defaults.
 */

export interface EnvironmentConfig {
  // Server Configuration
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  FRONTEND_ORIGIN: string;

  // Security & Authentication
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  ADMIN_EMAILS: string;

  // Database
  DATABASE_URL: string;
  DATABASE_PROVIDER: 'sqlite' | 'postgresql';

  // Stripe Configuration
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  PLATFORM_FEE_BPS: number;

  // PayPal Configuration
  PAYPAL_CLIENT_ID: string;
  PAYPAL_CLIENT_SECRET: string;
  PAYPAL_ENVIRONMENT: 'sandbox' | 'live';

  // File Upload Configuration
  MAX_FILE_SIZE: number;
  ALLOWED_FILE_TYPES: string[];
  UPLOAD_DIR: string;

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  AUTH_RATE_LIMIT_WINDOW_MS: number;
  AUTH_RATE_LIMIT_MAX_ATTEMPTS: number;

  // Development & Logging
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
  LOG_REQUESTS: boolean;
  ENABLE_MOCK_PAYMENTS: boolean;
  DETAILED_ERRORS: boolean;
  ENABLE_DEV_ROUTES: boolean;
}

/**
 * Required environment variables that must be present
 */
const REQUIRED_ENV_VARS = [
  'JWT_SECRET',
  'DATABASE_URL',
  'STRIPE_SECRET_KEY',
] as const;

/**
 * Get environment variable with fallback
 */
function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Get environment variable as number
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(`Invalid number for ${key}: ${value}, using default: ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

/**
 * Get environment variable as boolean
 */
function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true';
}

/**
 * Validate critical environment variables
 */
function validateEnvironment(): void {
  const errors: string[] = [];

  // Check required variables
  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }

  // Validate JWT_SECRET strength
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret.length < 32) {
    errors.push('JWT_SECRET should be at least 32 characters long for security');
  }

  // Validate NODE_ENV
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv && !['development', 'production', 'test'].includes(nodeEnv)) {
    errors.push('NODE_ENV must be one of: development, production, test');
  }

  // Validate production-specific requirements
  if (nodeEnv === 'production') {
    if (jwtSecret === 'dev-jwt-secret-key-change-in-production-use-256-bit-random-string') {
      errors.push('JWT_SECRET must be changed from default value in production');
    }

    if (process.env.STRIPE_SECRET_KEY === 'sk_test_51234567890abcdef_test_key_here') {
      errors.push('STRIPE_SECRET_KEY must be set to real value in production');
    }

    if (process.env.FRONTEND_ORIGIN === 'http://localhost:5173') {
      errors.push('FRONTEND_ORIGIN must be set to production domain');
    }

    if (getEnvBoolean('DETAILED_ERRORS', true)) {
      console.warn('⚠️  DETAILED_ERRORS should be false in production for security');
    }

    if (getEnvBoolean('ENABLE_DEV_ROUTES', true)) {
      console.warn('⚠️  ENABLE_DEV_ROUTES should be false in production');
    }
  }

  // If there are errors, provide helpful guidance
  if (errors.length > 0) {
    console.error('❌ Environment Configuration Errors:');
    console.error('=====================================');
    errors.forEach((error, index) => {
      console.error(`${index + 1}. ${error}`);
    });
    console.error('');
    console.error('📋 Quick Setup Guide:');
    console.error('1. Copy .env.example to .env');
    console.error('2. Update the required values in .env');
    console.error('3. Restart the server');
    console.error('');
    console.error('For detailed setup instructions, see the .env.example file');
    process.exit(1);
  }
}

/**
 * Load and validate environment configuration
 */
function loadEnvironmentConfig(): EnvironmentConfig {
  // Validate environment before loading
  validateEnvironment();

  const config: EnvironmentConfig = {
    // Server Configuration
    PORT: getEnvNumber('PORT', 4000),
    NODE_ENV: (getEnvVar('NODE_ENV', 'development') as any),
    FRONTEND_ORIGIN: getEnvVar('FRONTEND_ORIGIN', 'http://localhost:5173'),

    // Security & Authentication
    JWT_SECRET: getEnvVar('JWT_SECRET'),
    JWT_EXPIRES_IN: getEnvVar('JWT_EXPIRES_IN', '7d'),
    ADMIN_EMAILS: getEnvVar('ADMIN_EMAILS', ''),

    // Database
    DATABASE_URL: getEnvVar('DATABASE_URL'),
    DATABASE_PROVIDER: (getEnvVar('DATABASE_PROVIDER', 'sqlite') as 'sqlite' | 'postgresql'),

    // Stripe Configuration
    STRIPE_SECRET_KEY: getEnvVar('STRIPE_SECRET_KEY'),
    STRIPE_WEBHOOK_SECRET: getEnvVar('STRIPE_WEBHOOK_SECRET', ''),
    PLATFORM_FEE_BPS: getEnvNumber('PLATFORM_FEE_BPS', 800),

    // PayPal Configuration
    PAYPAL_CLIENT_ID: getEnvVar('PAYPAL_CLIENT_ID', 'your_paypal_client_id_here'),
    PAYPAL_CLIENT_SECRET: getEnvVar('PAYPAL_CLIENT_SECRET', 'your_paypal_client_secret_here'),
    PAYPAL_ENVIRONMENT: (getEnvVar('PAYPAL_ENVIRONMENT', 'sandbox') as any),

    // File Upload Configuration
    MAX_FILE_SIZE: getEnvNumber('MAX_FILE_SIZE', 10485760), // 10MB
    ALLOWED_FILE_TYPES: getEnvVar('ALLOWED_FILE_TYPES', 'jpg,jpeg,png,gif,webp,mp4,mov,avi').split(','),
    UPLOAD_DIR: getEnvVar('UPLOAD_DIR', 'uploads'),

    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: getEnvNumber('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000), // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100),
    AUTH_RATE_LIMIT_WINDOW_MS: getEnvNumber('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    AUTH_RATE_LIMIT_MAX_ATTEMPTS: getEnvNumber('AUTH_RATE_LIMIT_MAX_ATTEMPTS', 5),

    // Development & Logging
    LOG_LEVEL: (getEnvVar('LOG_LEVEL', 'info') as any),
    LOG_REQUESTS: getEnvBoolean('LOG_REQUESTS', false),
    ENABLE_MOCK_PAYMENTS: getEnvBoolean('ENABLE_MOCK_PAYMENTS', true),
    DETAILED_ERRORS: getEnvBoolean('DETAILED_ERRORS', true),
    ENABLE_DEV_ROUTES: getEnvBoolean('ENABLE_DEV_ROUTES', true),
  };

  // Log configuration summary
  console.log('🔧 Environment Configuration Loaded:');
  console.log(`   Environment: ${config.NODE_ENV}`);
  console.log(`   Port: ${config.PORT}`);
  console.log(`   Frontend Origin: ${config.FRONTEND_ORIGIN}`);
  console.log(`   Database: ${config.DATABASE_URL.includes('postgresql') ? 'PostgreSQL' : 'SQLite'}`);
  console.log(`   Stripe Mode: ${config.STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'Live' : 'Test'}`);
  console.log(`   Mock Payments: ${config.ENABLE_MOCK_PAYMENTS ? 'Enabled' : 'Disabled'}`);
  console.log(`   Platform Fee: ${config.PLATFORM_FEE_BPS / 100}%`);

  return config;
}

// Export the loaded configuration
export const config = loadEnvironmentConfig();

// Helper functions for common checks
export const isDevelopment = () => config.NODE_ENV === 'development';
export const isProduction = () => config.NODE_ENV === 'production';
export const isTest = () => config.NODE_ENV === 'test';

// Export individual config sections for convenience
export const serverConfig = {
  PORT: config.PORT,
  NODE_ENV: config.NODE_ENV,
  FRONTEND_ORIGIN: config.FRONTEND_ORIGIN,
};

export const authConfig = {
  JWT_SECRET: config.JWT_SECRET,
  JWT_EXPIRES_IN: config.JWT_EXPIRES_IN,
};

export const stripeConfig = {
  STRIPE_SECRET_KEY: config.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: config.STRIPE_WEBHOOK_SECRET,
  PLATFORM_FEE_BPS: config.PLATFORM_FEE_BPS,
};

export const paypalConfig = {
  PAYPAL_CLIENT_ID: config.PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET: config.PAYPAL_CLIENT_SECRET,
  PAYPAL_ENVIRONMENT: config.PAYPAL_ENVIRONMENT,
};

export default config;
