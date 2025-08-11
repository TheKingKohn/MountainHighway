/**
 * Minimal Rate Limiting for Deployment
 * Temporarily disabled advanced features for IPv6 compatibility
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { config } from '../config/environment';

/**
 * Basic rate limiting without custom keyGenerator (IPv6 safe)
 */
export const dynamicRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window
  message: {
    error: 'Too many requests',
    message: 'Please try again later',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request): boolean => {
    return config.NODE_ENV === 'test';
  }
});

/**
 * Authentication rate limiting
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 auth attempts per 15 minutes
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again later',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Registration rate limiting
 */
export const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registration attempts per hour
  message: {
    error: 'Too many registration attempts',
    message: 'Please try again later',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Password reset rate limiting
 */
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 password reset attempts per hour
  message: {
    error: 'Too many password reset attempts',
    message: 'Please try again later',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * File upload rate limiting
 */
export const fileUploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 file uploads per 15 minutes
  message: {
    error: 'Too many file uploads',
    message: 'Please try again later',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Message sending rate limiting
 */
export const messagingRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // 50 messages per 5 minutes
  message: {
    error: 'Too many messages sent',
    message: 'Please slow down',
    retryAfter: 300
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * API-wide rate limiting
 */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // 2000 requests per window for API
  message: {
    error: 'Too many API requests',
    message: 'Please try again later',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request): boolean => {
    return config.NODE_ENV === 'test';
  }
});

/**
 * Strict rate limiting for sensitive endpoints
 */
export const strictRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 requests per hour
  message: {
    error: 'Rate limit exceeded for sensitive endpoint',
    message: 'Please try again later',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request): boolean => {
    return config.NODE_ENV === 'test';
  }
});

// Placeholder for slowdown (disabled for deployment)
export const slowDownMiddleware = (req: Request, res: Response, next: any) => {
  next();
};

export default {
  dynamicRateLimit,
  authRateLimit,
  registerRateLimit,
  passwordResetRateLimit,
  fileUploadRateLimit,
  messagingRateLimit,
  slowDownMiddleware,
  apiRateLimit,
  strictRateLimit
};
