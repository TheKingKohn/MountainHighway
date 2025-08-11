import express from 'express';
import cors from 'cors';
import path from 'path';
import { PrismaClient } from '@prisma/client';

// Import environment configuration (this loads and validates all env vars)
import { config } from './config/environment';
import { initializeDatabase, checkDatabaseHealth } from './config/database';
import RBACService from './services/rbac';

// Import security and performance middleware
import { 
  securityHeaders, 
  responseCompression, 
  corsOptions, 
  requestSizeLimits,
  sanitizeInput,
  requestLogger,
  errorHandler
} from './middleware/security';
import { 
  dynamicRateLimit, 
  slowDownMiddleware, 
  rateLimitAnalytics 
} from './middleware/rateLimiting';
import { cacheMonitoring } from './services/cache';
import { performanceMiddleware, createPerformanceRoutes } from './services/performance';

// Import API documentation
import { setupSwagger } from './documentation/swagger';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import stripeRoutes from './routes/stripe';
import paymentRoutes from './routes/payments';
import listingRoutes from './routes/listings';
import orderRoutes from './routes/orders';
import webhookRoutes from './routes/webhooks';
import testRoutes from './routes/test';
import messageRoutes from './routes/messages';
import adminRoutes from './routes/admin';
import communityRoutes from './routes/community';

const app = express();
const prisma = new PrismaClient();

// Security headers (must be first)
app.use(securityHeaders);

// Response compression
app.use(responseCompression);

// Enhanced CORS
app.use(cors(corsOptions));

// Request logging
app.use(requestLogger);

// Rate limiting and analytics
app.use(rateLimitAnalytics); // Track rate limiting events
app.use(dynamicRateLimit); // Intelligent rate limiting based on user status
app.use(slowDownMiddleware); // Progressive slowdown for repeated requests

// Cache monitoring
app.use(cacheMonitoring);

// Performance monitoring
app.use(performanceMiddleware);

// Request size limits and body parsing
app.use(express.json(requestSizeLimits.json));
app.use(express.urlencoded(requestSizeLimits.urlencoded));
app.use(express.raw(requestSizeLimits.raw));

// Input sanitization
app.use(sanitizeInput);

// Webhook routes (before express.json() middleware for raw body parsing)
app.use('/webhooks', webhookRoutes);

// JSON middleware for all other routes
app.use(express.json());

// Static file serving for uploads
app.use('/uploads', express.static(path.join(process.cwd(), config.UPLOAD_DIR)));

// Routes
app.use('/auth', authRoutes);
app.use('/stripe', stripeRoutes);
app.use('/payments', paymentRoutes);
app.use('/listings', listingRoutes);
app.use('/orders', orderRoutes);
app.use('/orders', messageRoutes);
app.use('/admin', adminRoutes);
app.use('/community', communityRoutes);

// Conditional routes based on environment
if (config.ENABLE_DEV_ROUTES) {
  app.use('/test', testRoutes);
  app.use('/performance', createPerformanceRoutes());
}

// Setup API documentation
setupSwagger(app);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    ok: true,
    environment: config.NODE_ENV,
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Database test endpoint
app.get('/db-test', async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    const listingCount = await prisma.listing.count();
    res.json({
      database: 'connected',
      userCount,
      listingCount,
      environment: config.NODE_ENV,
    });
  } catch (error) {
    const errorMessage = config.DETAILED_ERRORS && error instanceof Error 
      ? error.message 
      : 'Database connection failed';
    
    res.status(500).json({
      database: 'error',
      error: errorMessage,
    });
  }
});

// User routes (includes /me)
app.use('/', userRoutes);

// Basic API info
app.get('/', (req, res) => {
  res.json({
    name: 'Mountain Highway API',
    version: '1.0.0',
    status: 'running',
    environment: config.NODE_ENV,
    database: {
      provider: config.DATABASE_PROVIDER,
      ready: true
    }
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Enhanced health check with database status
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
      database: dbHealth,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
      error: error instanceof Error ? error.message : 'Unknown error',
      uptime: process.uptime()
    });
  }
});

// Keep-alive endpoint for preventing cold starts
app.get('/keep-alive', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    message: 'Service is warm and ready'
  });
});

// Start server
app.listen(config.PORT, async () => {
  // Initialize database connection
  await initializeDatabase();
  
  // Initialize RBAC system
  console.log('🔐 Initializing Role-Based Access Control...');
  try {
    await RBACService.initializeDefaultRoles();
    await RBACService.migrateAdminUsers();
    console.log('✅ RBAC system ready');
  } catch (error) {
    console.error('❌ RBAC initialization failed:', error);
  }
  
  console.log(`🚀 API server running on http://localhost:${config.PORT}`);
  console.log(`📋 Health check available at http://localhost:${config.PORT}/health`);
  console.log(`🌍 Accepting requests from: ${config.FRONTEND_ORIGIN}`);
  
  if (config.NODE_ENV === 'development') {
    console.log(`🧪 Development mode - Test routes enabled`);
    console.log(`📊 Database test: http://localhost:${config.PORT}/db-test`);
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});
