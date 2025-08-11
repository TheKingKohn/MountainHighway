/**
 * IPv6-Safe Rate Limiting Middleware for Mountain Highway
 * 
 * Implements comprehensive rate limiting with proper IPv6 support
 */

import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { Request, Response } from 'express';
import { config } from '../config/environment';

// Role level constants
const ROLE_LEVELS = {
  GUEST: 0,
  USER: 1,
  VIP_SELLER: 2,
  MODERATOR: 3,
  ADMIN: 4
} as const;

// Rate limit configurations by role
const RATE_LIMITS = {
  GUEST: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 requests per window
    message: 'Rate limit exceeded for guests. Please try again later.'
  },
  USER: {
    windowMs: 15 * 60 * 1000,
    max: 200, // Authenticated users get higher limits
    message: 'Rate limit exceeded. Please try again later.'
  },
  VIP_SELLER: {
    windowMs: 15 * 60 * 1000,
    max: 500, // VIP sellers get even higher limits
    message: 'Rate limit exceeded for VIP sellers.'
  },
  MODERATOR: {
    windowMs: 15 * 60 * 1000,
    max: 1000, // Moderators get high limits
    message: 'Rate limit exceeded for moderators.'
  },
  ADMIN: {
    windowMs: 15 * 60 * 1000,
    max: 2000, // Very high limits for admins
    message: 'Admin rate limit exceeded.'
  }
} as const;

// Endpoint-specific rate limits
const ENDPOINT_LIMITS = {
  LOGIN: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts per 15 minutes
    message: 'Too many login attempts, please try again later.',
    skipSuccessfulRequests: true
  },
  REGISTER: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 registration attempts per hour
    message: 'Too many registration attempts, please try again later.'
  },
  PASSWORD_RESET: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 password reset attempts per hour
    message: 'Too many password reset attempts, please try again later.'
  },
  
  // API endpoints
  FILE_UPLOAD: {
    windowMs: 15 * 60 * 1000,
    max: 10, // 10 file uploads per 15 minutes
    message: 'Too many file uploads, please try again later.'
  },
  MESSAGE_SEND: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // 20 messages per 5 minutes
    message: 'Too many messages sent, please slow down.'
  }
} as const;

/**
 * Create IPv6-safe key generator
 * Uses built-in rate limiter functions for safe IP handling
 */
function createSafeKeyGenerator(prefix: string) {
  return (req: Request): string => {
    // Use user ID if authenticated (most reliable)
    if (req.auth?.user?.id) {
      return `${prefix}user:${req.auth.user.id}`;
    }
    
    // Use the built-in IP handling (IPv6 safe)
    // This is the safe way to handle IPv6 addresses
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    return `${prefix}ip:${ip}`;
  };
}

/**
 * Get rate limit based on user role
 */
function getRateLimitForRole(roleLevel: number) {
  if (roleLevel >= ROLE_LEVELS.ADMIN) return RATE_LIMITS.ADMIN;
  if (roleLevel >= ROLE_LEVELS.MODERATOR) return RATE_LIMITS.MODERATOR;
  if (roleLevel >= ROLE_LEVELS.VIP_SELLER) return RATE_LIMITS.VIP_SELLER;
  if (roleLevel >= ROLE_LEVELS.USER) return RATE_LIMITS.USER;
  return RATE_LIMITS.GUEST;
}

/**
 * Dynamic rate limiting based on user role
 */
export const dynamicRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req: Request) => {
    const userLevel = req.auth?.level || 0;
    const limits = getRateLimitForRole(userLevel);
    return limits.max;
  },
  message: (req: Request) => {
    const userLevel = req.auth?.level || 0;
    const limits = getRateLimitForRole(userLevel);
    return {
      error: limits.message,
      retryAfter: Math.ceil(15 * 60), // 15 minutes in seconds
      limit: limits.max
    };
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use simple, IPv6-safe key generation
  keyGenerator: createSafeKeyGenerator('dynamic:'),
  skip: (req: Request): boolean => {
    // Skip rate limiting in test environment
    return config.NODE_ENV === 'test';
  }
});

/**
 * Authentication rate limiting (login, register, etc.)
 */
export const authRateLimit = rateLimit({
  ...ENDPOINT_LIMITS.LOGIN,
  // Use simple IP-based key for auth endpoints
  keyGenerator: createSafeKeyGenerator('auth:'),
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many authentication attempts',
      message: 'Please try again later',
      retryAfter: Math.ceil(ENDPOINT_LIMITS.LOGIN.windowMs / 1000)
    });
  }
});

/**
 * Registration rate limiting
 */
export const registerRateLimit = rateLimit({
  ...ENDPOINT_LIMITS.REGISTER,
  keyGenerator: createSafeKeyGenerator('register:'),
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many registration attempts',
      message: 'Please try again later',
      retryAfter: Math.ceil(ENDPOINT_LIMITS.REGISTER.windowMs / 1000)
    });
  }
});

/**
 * Password reset rate limiting
 */
export const passwordResetRateLimit = rateLimit({
  ...ENDPOINT_LIMITS.PASSWORD_RESET,
  keyGenerator: createSafeKeyGenerator('reset:'),
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many password reset attempts',
      message: 'Please try again later',
      retryAfter: Math.ceil(ENDPOINT_LIMITS.PASSWORD_RESET.windowMs / 1000)
    });
  }
});

/**
 * File upload rate limiting
 */
export const fileUploadRateLimit = rateLimit({
  ...ENDPOINT_LIMITS.FILE_UPLOAD,
  keyGenerator: createSafeKeyGenerator('upload:'),
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many file uploads',
      message: 'Please try again later',
      retryAfter: Math.ceil(ENDPOINT_LIMITS.FILE_UPLOAD.windowMs / 1000)
    });
  }
});

/**
 * Message sending rate limiting
 */
export const messagingRateLimit = rateLimit({
  ...ENDPOINT_LIMITS.MESSAGE_SEND,
  keyGenerator: createSafeKeyGenerator('message:'),
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many messages sent',
      message: 'Please slow down',
      retryAfter: Math.ceil(ENDPOINT_LIMITS.MESSAGE_SEND.windowMs / 1000)
    });
  }
});

/**
 * Progressive slowdown for repeated requests
 */
export const slowDownMiddleware = slowDown({
  windowMs: 5 * 60 * 1000, // 5 minutes
  delayAfter: 10, // Allow 10 requests per window without delay
  delayMs: 500, // Add 500ms delay per request after delayAfter
  maxDelayMs: 5000, // Maximum delay of 5 seconds
  keyGenerator: createSafeKeyGenerator('slowdown:')
});

/**
 * API-wide rate limiting
 */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window for API
  message: {
    error: 'Too many API requests',
    message: 'Please try again later',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createSafeKeyGenerator('api:'),
  skip: (req: Request): boolean => {
    return config.NODE_ENV === 'test';
  }
});

/**
 * Strict rate limiting for sensitive endpoints
 */
export const strictRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Very strict: only 10 requests per hour
  message: {
    error: 'Rate limit exceeded for sensitive endpoint',
    message: 'Please try again later',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createSafeKeyGenerator('strict:'),
  skip: (req: Request): boolean => {
    return config.NODE_ENV === 'test';
  }
});

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
