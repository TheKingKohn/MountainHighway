/**
 * Security Middleware for Mountain Highway
 * 
 * Implements comprehensive security measures including:
 * - Security headers with Helmet.js
 * - Input validation and sanitization
 * - CORS configuration
 * - Request size limits
 * - Content Security Policy
 */

import helmet from 'helmet';
import compression from 'compression';
import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { config } from '../config/environment';

/**
 * Security headers configuration using Helmet.js
 */
export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      connectSrc: ["'self'", "https://api.stripe.com"],
      upgradeInsecureRequests: config.NODE_ENV === 'production' ? [] : null,
    },
    reportOnly: config.NODE_ENV === 'development', // Only report in development
  },
  
  // Cross-Origin Embedder Policy
  crossOriginEmbedderPolicy: false, // Disable for API
  
  // Cross-Origin Resource Policy
  crossOriginResourcePolicy: {
    policy: "cross-origin"
  },
  
  // DNS Prefetch Control
  dnsPrefetchControl: {
    allow: false
  },
  
  // Frameguard (X-Frame-Options)
  frameguard: {
    action: 'deny'
  },
  
  // Hide Powered-By header
  hidePoweredBy: true,
  
  // HTTP Strict Transport Security
  hsts: config.NODE_ENV === 'production' ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  } : false,
  
  // IE No Open
  ieNoOpen: true,
  
  // MIME Type sniffing prevention
  noSniff: true,
  
  // Origin Agent Cluster
  originAgentCluster: true,
  
  // Referrer Policy
  referrerPolicy: {
    policy: ["no-referrer"]
  },
  
  // X-XSS-Protection
  xssFilter: true
});

/**
 * Response compression middleware
 */
export const responseCompression = compression({
  // Only compress responses larger than 1KB
  threshold: 1024,
  
  // Compression filter
  filter: (req: Request, res: Response) => {
    // Don't compress already compressed responses
    if (res.headersSent) {
      return false;
    }
    
    // Compress text-based content types
    const contentType = res.get('Content-Type');
    if (contentType) {
      return /json|text|javascript|css|xml|svg/.test(contentType);
    }
    
    return compression.filter(req, res);
  },
  
  // Compression level (1-9, 6 is default)
  level: 6
});

/**
 * Enhanced CORS configuration
 */
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // List of allowed origins
    const allowedOrigins = [
      config.FRONTEND_ORIGIN,
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000'
    ];
    
    // In development, allow all localhost origins
    if (config.NODE_ENV === 'development') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-API-Key'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'Retry-After'
  ],
  maxAge: 86400 // 24 hours
};

/**
 * Request size limits
 */
export const requestSizeLimits = {
  // JSON body limit
  json: {
    limit: '10mb',
    strict: true,
    type: 'application/json'
  },
  
  // URL-encoded form limit
  urlencoded: {
    limit: '10mb',
    extended: true,
    parameterLimit: 100
  },
  
  // Raw body limit (for file uploads)
  raw: {
    limit: '50mb',
    type: ['application/octet-stream', 'image/*']
  }
};

/**
 * Input validation helpers
 */

// Email validation
export const validateEmail = body('email')
  .isEmail()
  .normalizeEmail()
  .withMessage('Must be a valid email address')
  .isLength({ max: 254 })
  .withMessage('Email too long');

// Password validation
export const validatePassword = body('password')
  .isLength({ min: 8, max: 128 })
  .withMessage('Password must be 8-128 characters long')
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character');

// Username validation
export const validateUsername = body('username')
  .isAlphanumeric()
  .withMessage('Username must contain only letters and numbers')
  .isLength({ min: 3, max: 30 })
  .withMessage('Username must be 3-30 characters long');

// ID parameter validation
export const validateId = param('id')
  .isString()
  .isLength({ min: 1, max: 50 })
  .withMessage('Invalid ID format');

// Listing validation
export const validateListing = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be 3-200 characters long')
    .escape(),
  
  body('description')
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage('Description must be 10-5000 characters long')
    .escape(),
  
  body('priceCents')
    .isInt({ min: 1, max: 100000000 })
    .withMessage('Price must be between $0.01 and $1,000,000'),
  
  body('category')
    .isIn(['electronics', 'clothing', 'books', 'home', 'sports', 'other'])
    .withMessage('Invalid category'),
  
  body('photos')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Maximum 10 photos allowed')
];

// Message validation
export const validateMessage = [
  body('body')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message must be 1-2000 characters long')
    .escape(),
  
  validateId.withMessage('Invalid order ID')
];

// Pagination validation
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be between 1 and 1000'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

/**
 * Validation result handler
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map(error => ({
      field: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? error.value : undefined
    }));
    
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errorDetails
    });
  }
  
  next();
};

/**
 * Input sanitization middleware
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize common XSS patterns
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/javascript:/gi, '') // Remove javascript: URLs
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .trim();
    }
    
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }
    
    if (value && typeof value === 'object') {
      const sanitized: any = {};
      for (const key in value) {
        if (value.hasOwnProperty(key)) {
          sanitized[key] = sanitizeValue(value[key]);
        }
      }
      return sanitized;
    }
    
    return value;
  };
  
  // Sanitize request body
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  
  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }
  
  next();
};

/**
 * File upload security
 */
export const validateFileUpload = (req: Request, res: Response, next: NextFunction) => {
  // Check if file was uploaded
  if (!req.file && !req.files) {
    return next();
  }
  
  const files = req.files ? (Array.isArray(req.files) ? req.files : [req.file]) : [req.file];
  
  for (const file of files) {
    if (!file) continue;
    
    // Check file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      return res.status(400).json({
        error: 'File too large',
        code: 'FILE_TOO_LARGE',
        maxSize: '50MB'
      });
    }
    
    // Check file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/quicktime'
    ];
    
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        error: 'Invalid file type',
        code: 'INVALID_FILE_TYPE',
        allowedTypes
      });
    }
    
    // Check filename for security
    if (!/^[a-zA-Z0-9._-]+$/.test(file.originalname)) {
      return res.status(400).json({
        error: 'Invalid filename',
        code: 'INVALID_FILENAME',
        message: 'Filename can only contain letters, numbers, dots, underscores, and hyphens'
      });
    }
  }
  
  next();
};

/**
 * Request logging middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.auth?.user?.id,
      timestamp: new Date().toISOString()
    };
    
    // Log errors and slow requests
    if (res.statusCode >= 400 || duration > 1000) {
      console.warn('Request:', log);
    } else if (config.NODE_ENV === 'development') {
      console.log('Request:', log);
    }
  });
  
  next();
};

/**
 * Error handling middleware
 */
export const errorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', {
    message: error.message,
    stack: config.NODE_ENV === 'development' ? error.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userId: req.auth?.user?.id,
    timestamp: new Date().toISOString()
  });
  
  // Prisma errors
  if (error.code && error.code.startsWith('P')) {
    return res.status(400).json({
      error: 'Database operation failed',
      code: 'DATABASE_ERROR'
    });
  }
  
  // Validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.details
    });
  }
  
  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
  
  // Default error response
  res.status(error.status || 500).json({
    error: config.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    code: 'INTERNAL_ERROR'
  });
};

export default {
  securityHeaders,
  responseCompression,
  corsOptions,
  requestSizeLimits,
  validateEmail,
  validatePassword,
  validateUsername,
  validateId,
  validateListing,
  validateMessage,
  validatePagination,
  handleValidationErrors,
  sanitizeInput,
  validateFileUpload,
  requestLogger,
  errorHandler
};
