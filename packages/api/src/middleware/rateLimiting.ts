/**
 * Enterprise Rate Limiting & Security Middleware
 * IPv6-compatible with advanced features for production deployment
 * Includes intelligent rate limiting, user-based limits, and abuse protection
 */

import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/environment';

// Import proper IPv6 helper
const { ipKeyGenerator } = require('express-rate-limit');

/**
 * Enhanced key generator with proper IPv6 support
 * Uses express-rate-limit's built-in IPv6 helper
 */
const createSecureKeyGenerator = (prefix: string = '') => {
  return (req: Request): string => {
    // Use express-rate-limit's IPv6-safe key generator
    const ipKey = ipKeyGenerator(req);
    
    // Add user-based limiting for authenticated requests
    if (req.user?.id) {
      return `${prefix}user:${req.user.id}`;
    }
    
    // Fallback to IP-based with IPv6 support
    return `${prefix}ip:${ipKey}`;
  };
};

/**
 * Rate limiting configuration by endpoint type
 */
const ENDPOINT_LIMITS = {
  // Authentication endpoints
  LOGIN: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per IP
    message: {
      error: 'Too many login attempts',
      message: 'Please try again in 15 minutes',
      retryAfter: 900,
      type: 'AUTH_RATE_LIMIT'
    }
  },
  
  REGISTER: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 registrations per IP per hour
    message: {
      error: 'Too many registration attempts',
      message: 'Please try again in 1 hour',
      retryAfter: 3600,
      type: 'REGISTER_RATE_LIMIT'
    }
  },
  
  PASSWORD_RESET: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 password resets per hour
    message: {
      error: 'Too many password reset attempts',
      message: 'Please try again in 1 hour',
      retryAfter: 3600,
      type: 'PASSWORD_RESET_RATE_LIMIT'
    }
  },
  
  // API endpoints
  API_GENERAL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2000, // 2000 requests per 15 minutes
    message: {
      error: 'Too many API requests',
      message: 'Please try again later',
      retryAfter: 900,
      type: 'API_RATE_LIMIT'
    }
  },
  
  // File operations
  FILE_UPLOAD: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 uploads per 15 minutes
    message: {
      error: 'Too many file uploads',
      message: 'Please try again later',
      retryAfter: 900,
      type: 'UPLOAD_RATE_LIMIT'
    }
  },
  
  // Messaging
  MESSAGING: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50, // 50 messages per 5 minutes
    message: {
      error: 'Too many messages sent',
      message: 'Please slow down your messaging',
      retryAfter: 300,
      type: 'MESSAGING_RATE_LIMIT'
    }
  },
  
  // Sensitive operations
  ADMIN_ACTIONS: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // 100 admin actions per hour
    message: {
      error: 'Too many admin actions',
      message: 'Admin rate limit exceeded',
      retryAfter: 3600,
      type: 'ADMIN_RATE_LIMIT'
    }
  }
};

/**
 * Dynamic rate limiting based on user authentication status and role
 * Higher limits for authenticated users, even higher for premium users
 */
export const dynamicRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req: Request) => {
    // Test environment bypass
    if (config.NODE_ENV === 'test') return 10000;
    
    // Higher limits for authenticated users
    if (req.user?.id) {
      // Check if user has admin role
      const hasAdminRole = req.user.roleAssignments?.some(
        ra => ra.role.name === 'ADMIN' || ra.role.level >= 100
      );
      if (hasAdminRole) return 5000;
      
      // Check if user has VIP seller role
      const hasVipRole = req.user.roleAssignments?.some(
        ra => ra.role.name === 'VIP_SELLER' || ra.role.level >= 25
      );
      if (hasVipRole) return 3000;
      
      // Regular authenticated users
      return 2000;
    }
    
    // Anonymous users get standard limits
    return 1000;
  },
  message: (req: Request) => ({
    error: 'Rate limit exceeded',
    message: req.user?.id 
      ? 'You have exceeded your rate limit. Please try again later.'
      : 'Anonymous rate limit exceeded. Consider registering for higher limits.',
    retryAfter: 900,
    type: 'DYNAMIC_RATE_LIMIT',
    upgrade: !req.user?.id ? 'Register for higher rate limits' : undefined
  }),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createSecureKeyGenerator('dynamic:'),
  skip: (req: Request): boolean => {
    return config.NODE_ENV === 'test' || 
           req.path === '/health' ||
           req.path === '/api-docs';
  }
});

/**
 * Authentication-specific rate limiting
 * Stricter limits for login attempts to prevent brute force attacks
 */
export const authRateLimit = rateLimit({
  ...ENDPOINT_LIMITS.LOGIN,
  keyGenerator: (req: Request) => {
    // For auth endpoints, use email + IP for more granular control
    const email = req.body?.email;
    const ipKey = ipKeyGenerator(req);
    return email ? `auth:email:${email}:${ipKey}` : `auth:ip:${ipKey}`;
  },
  handler: (req: Request, res: Response) => {
    const remainingTime = Math.ceil(ENDPOINT_LIMITS.LOGIN.windowMs / 1000 / 60);
    res.status(429).json({
      ...ENDPOINT_LIMITS.LOGIN.message,
      remainingTime: `${remainingTime} minutes`,
      endpoint: req.path,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Registration rate limiting
 * Prevents automated account creation
 */
export const registerRateLimit = rateLimit({
  ...ENDPOINT_LIMITS.REGISTER,
  keyGenerator: createSecureKeyGenerator('register:'),
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      ...ENDPOINT_LIMITS.REGISTER.message,
      hint: 'If you need to create multiple accounts, please contact support.',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Password reset rate limiting
 * Prevents password reset spam
 */
export const passwordResetRateLimit = rateLimit({
  ...ENDPOINT_LIMITS.PASSWORD_RESET,
  keyGenerator: createSecureKeyGenerator('password_reset:'),
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      ...ENDPOINT_LIMITS.PASSWORD_RESET.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * File upload rate limiting
 * Prevents storage abuse and DOS attacks
 */
export const fileUploadRateLimit = rateLimit({
  ...ENDPOINT_LIMITS.FILE_UPLOAD,
  keyGenerator: createSecureKeyGenerator('upload:'),
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      ...ENDPOINT_LIMITS.FILE_UPLOAD.message,
      hint: 'Consider uploading multiple files in batches',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Messaging rate limiting
 * Prevents spam in the messaging system
 */
export const messagingRateLimit = rateLimit({
  ...ENDPOINT_LIMITS.MESSAGING,
  keyGenerator: createSecureKeyGenerator('messaging:'),
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      ...ENDPOINT_LIMITS.MESSAGING.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Slowdown middleware for gradual response delays
 * Makes brute force attacks less effective
 */
export const slowDownMiddleware = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 100, // Allow 100 requests per window at full speed
  delayMs: (hits) => hits * 100, // Add 100ms delay per request after delayAfter
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  keyGenerator: createSecureKeyGenerator('slowdown:'),
  skip: (req: Request): boolean => {
    // Check if user has admin role for slowdown bypass
    const hasAdminRole = req.user?.roleAssignments?.some(
      ra => ra.role.name === 'ADMIN' || ra.role.level >= 100
    ) || false;
    
    return config.NODE_ENV === 'test' ||
           req.path === '/health' ||
           hasAdminRole; // Admins bypass slowdown
  }
});

/**
 * API-wide rate limiting
 * General protection for all API endpoints
 */
export const apiRateLimit = rateLimit({
  ...ENDPOINT_LIMITS.API_GENERAL,
  keyGenerator: createSecureKeyGenerator('api:'),
  skip: (req: Request): boolean => {
    return config.NODE_ENV === 'test' ||
           req.path === '/health' ||
           req.path === '/api-docs' ||
           req.path.startsWith('/api-docs');
  }
});

/**
 * Strict rate limiting for admin and sensitive endpoints
 * Higher security for administrative functions
 */
export const strictRateLimit = rateLimit({
  ...ENDPOINT_LIMITS.ADMIN_ACTIONS,
  keyGenerator: createSecureKeyGenerator('admin:'),
  skip: (req: Request): boolean => {
    return config.NODE_ENV === 'test';
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      ...ENDPOINT_LIMITS.ADMIN_ACTIONS.message,
      endpoint: req.path,
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Rate limiting middleware factory
 * Creates custom rate limiters for specific use cases
 */
export const createCustomRateLimit = (options: {
  windowMs: number;
  max: number;
  message: string;
  keyPrefix?: string;
}): RateLimitRequestHandler => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      error: 'Custom rate limit exceeded',
      message: options.message,
      retryAfter: Math.ceil(options.windowMs / 1000)
    },
    keyGenerator: createSecureKeyGenerator(options.keyPrefix || 'custom:'),
    standardHeaders: true,
    legacyHeaders: false
  });
};

/**
 * Rate limiting analytics middleware
 * Tracks rate limiting events for monitoring
 */
export const rateLimitAnalytics = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.json;
  
  res.json = function(data: any) {
    // Log rate limiting events for analytics
    if (res.statusCode === 429) {
      console.warn('Rate limit triggered:', {
        ip: ipKeyGenerator(req),
        path: req.path,
        userAgent: req.headers['user-agent'],
        userId: req.user?.id,
        timestamp: new Date().toISOString()
      });
    }
    
    return originalSend.call(this, data);
  };
  
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
  strictRateLimit,
  createCustomRateLimit,
  rateLimitAnalytics
};
