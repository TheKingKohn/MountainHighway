/**
 * Minimal Rate Limiting for Deployment - No IPv6 issues
 * Simplest possible implementation to get app running
 */

import rateLimit from 'express-rate-limit';

// Global rate limit - very basic, IPv6 safe
export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Auth rate limit - basic
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many authentication attempts',
  standardHeaders: true,
  legacyHeaders: false
});

// Registration rate limit - basic  
export const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many registration attempts',
  standardHeaders: true,
  legacyHeaders: false
});

// API rate limit - basic
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: 'API rate limit exceeded',
  standardHeaders: true,
  legacyHeaders: false
});

// Payment rate limit - basic
export const paymentRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Payment rate limit exceeded',
  standardHeaders: true,
  legacyHeaders: false
});

// Upload rate limit - basic
export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  message: 'Upload rate limit exceeded',
  standardHeaders: true,
  legacyHeaders: false
});

// Message rate limit - basic
export const messageRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Message rate limit exceeded',
  standardHeaders: true,
  legacyHeaders: false
});

// Search rate limit - basic
export const searchRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Search rate limit exceeded',
  standardHeaders: true,
  legacyHeaders: false
});

// Export aliases for compatibility
export const dynamicRateLimit = globalRateLimit;
export const adminRateLimit = authRateLimit;
export const reportingRateLimit = apiRateLimit;
export const slowDown = globalRateLimit; // Simplified
