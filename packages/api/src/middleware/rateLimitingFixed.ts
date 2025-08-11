/**
 * Fixed Rate Limiting Middleware for Mountain Highway
 * 
 * Implements comprehensive rate limiting with proper IPv6 support:
 * - Role-based dynamic limits
 * - Endpoint-specific rate limiting  
 * - DDoS protection with proper key generation
 * - Progressive slowdown for repeated requests
 * - IPv6-safe key generators
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
    message: 'Too many requests from this IP, please register or try again later.'
  },
  USER: {
    windowMs: 15 * 60 * 1000,
    max: 200, // 200 requests per window for registered users
    message: 'Rate limit exceeded. Please try again later.'
  },
  VIP_SELLER: {
    windowMs: 15 * 60 * 1000,
    max: 500, // Higher limits for VIP sellers
    message: 'Rate limit exceeded. Please try again later.'
  },
  MODERATOR: {
    windowMs: 15 * 60 * 1000,
    max: 1000, // High limits for moderators
    message: 'Moderator rate limit exceeded.'
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
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 messages per minute
    message: 'Too many messages sent, please slow down.'
  },
  ORDER_CREATE: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // 5 orders per 5 minutes
    message: 'Too many order attempts, please try again later.'
  }
} as const;

/**
 * Secure key generator that handles IPv6 properly
 */
function createSecureKeyGenerator(prefix: string = '') {
  return (req: Request): string => {
    // Use user ID if authenticated
    if (req.auth?.user?.id) {
      return `${prefix}user:${req.auth.user.id}`;
    }
    
    // Use forwarded IP if available (from load balancer)
    const forwardedIp = req.get('X-Forwarded-For')?.split(',')[0]?.trim();
    if (forwardedIp) {
      return `${prefix}ip:${forwardedIp}`;
    }
    
    // Use connection remote address
    if (req.connection?.remoteAddress) {
      return `${prefix}ip:${req.connection.remoteAddress}`;
    }
    
    // Use socket remote address
    if (req.socket?.remoteAddress) {
      return `${prefix}ip:${req.socket.remoteAddress}`;
    }
    
    // Use req.ip as last resort
    return `${prefix}ip:${req.ip || 'unknown'}`;
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
  windowMs: 15 * 60 * 1000, // Default window
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
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(limits.windowMs / 1000),
      userLevel,
      limit: limits.max
    };
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createSecureKeyGenerator('dynamic:'),
  skip: (req: Request): boolean => {
    // Skip rate limiting in development for localhost
    if (config.NODE_ENV === 'development' && 
        (req.ip === '::1' || req.ip === '127.0.0.1' || req.ip?.includes('localhost'))) {
      return true;
    }
    return false;
  }
});

/**
 * Strict rate limit for authentication endpoints
 */
export const authRateLimit = rateLimit({
  ...ENDPOINT_LIMITS.LOGIN,
  keyGenerator: (req: Request) => {
    // Use email + secure IP for login attempts
    const email = req.body?.email || '';
    const secureKey = createSecureKeyGenerator('auth:')(req);
    return `${email}:${secureKey}`;
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many login attempts',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(ENDPOINT_LIMITS.LOGIN.windowMs / 1000),
      message: 'Please try again later or reset your password.'
    });
  }
});

/**
 * Registration rate limiting
 */
export const registerRateLimit = rateLimit({
  ...ENDPOINT_LIMITS.REGISTER,
  keyGenerator: createSecureKeyGenerator('register:'),
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many registration attempts',
      code: 'REGISTER_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(ENDPOINT_LIMITS.REGISTER.windowMs / 1000),
      message: 'Please wait before creating another account.'
    });
  }
});

/**
 * Password reset rate limiting
 */
export const passwordResetRateLimit = rateLimit({
  ...ENDPOINT_LIMITS.PASSWORD_RESET,
  keyGenerator: (req: Request) => {
    // Use email + secure IP for password reset attempts
    const email = req.body?.email || '';
    const secureKey = createSecureKeyGenerator('reset:')(req);
    return `${email}:${secureKey}`;
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many password reset attempts',
      code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(ENDPOINT_LIMITS.PASSWORD_RESET.windowMs / 1000),
      message: 'Please wait before requesting another password reset.'
    });
  }
});

/**
 * File upload rate limiting
 */
export const fileUploadRateLimit = rateLimit({
  ...ENDPOINT_LIMITS.FILE_UPLOAD,
  keyGenerator: createSecureKeyGenerator('upload:'),
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many file uploads',
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(ENDPOINT_LIMITS.FILE_UPLOAD.windowMs / 1000),
      message: 'Please wait before uploading more files.'
    });
  }
});

/**
 * Message sending rate limiting
 */
export const messageRateLimit = rateLimit({
  ...ENDPOINT_LIMITS.MESSAGE_SEND,
  keyGenerator: createSecureKeyGenerator('message:'),
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many messages sent',
      code: 'MESSAGE_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(ENDPOINT_LIMITS.MESSAGE_SEND.windowMs / 1000),
      message: 'Please slow down when sending messages.'
    });
  }
});

/**
 * Order creation rate limiting
 */
export const orderRateLimit = rateLimit({
  ...ENDPOINT_LIMITS.ORDER_CREATE,
  keyGenerator: createSecureKeyGenerator('order:'),
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many order attempts',
      code: 'ORDER_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(ENDPOINT_LIMITS.ORDER_CREATE.windowMs / 1000),
      message: 'Please wait before creating another order.'
    });
  }
});

/**
 * Progressive slow down for repeated requests
 */
export const progressiveSlowDown = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per window at full speed
  delayMs: (hits: number) => {
    // Progressive delay: 500ms * (hits - delayAfter)
    return Math.min(500 * (hits - 50), 10000); // Max 10 second delay
  },
  keyGenerator: createSecureKeyGenerator('slow:'),
  skip: (req: Request): boolean => {
    // Skip in development
    if (config.NODE_ENV === 'development' && 
        (req.ip === '::1' || req.ip === '127.0.0.1' || req.ip?.includes('localhost'))) {
      return true;
    }
    return false;
  }
});

/**
 * DDoS protection for public endpoints
 */
export const ddosProtection = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: {
    error: 'Too many requests from this IP',
    code: 'DDOS_PROTECTION',
    message: 'Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createSecureKeyGenerator('ddos:'),
  skip: (req: Request): boolean => {
    // Skip for authenticated users with good standing
    if (req.auth?.user && req.auth.level >= ROLE_LEVELS.USER) {
      return true;
    }
    // Skip in development
    if (config.NODE_ENV === 'development' && 
        (req.ip === '::1' || req.ip === '127.0.0.1' || req.ip?.includes('localhost'))) {
      return true;
    }
    return false;
  }
});

/**
 * Admin endpoint protection (very strict)
 */
export const adminRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // 100 admin requests per 5 minutes
  message: {
    error: 'Admin rate limit exceeded',
    code: 'ADMIN_RATE_LIMIT_EXCEEDED',
    message: 'Too many admin operations, please slow down.'
  },
  keyGenerator: createSecureKeyGenerator('admin:'),
  skip: (req: Request): boolean => {
    // Only apply to admin endpoints
    return !req.auth?.isAdmin;
  }
});

/**
 * Rate limit middleware that logs violations
 */
export function createLoggingRateLimit(limitConfig: any, logMessage: string) {
  return rateLimit({
    ...limitConfig,
    keyGenerator: limitConfig.keyGenerator || createSecureKeyGenerator('log:'),
    handler: (req: Request, res: Response) => {
      // Log rate limit violation
      console.warn(`Rate limit exceeded: ${logMessage}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.path,
        userId: req.auth?.user?.id,
        timestamp: new Date().toISOString()
      });

      // Send appropriate response
      if (limitConfig.handler) {
        limitConfig.handler(req, res);
      } else {
        res.status(429).json({
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          message: limitConfig.message || 'Too many requests, please try again later.'
        });
      }
    }
  });
}

export default {
  dynamicRateLimit,
  authRateLimit,
  registerRateLimit,
  passwordResetRateLimit,
  fileUploadRateLimit,
  messageRateLimit,
  orderRateLimit,
  progressiveSlowDown,
  ddosProtection,
  adminRateLimit,
  createLoggingRateLimit
};
