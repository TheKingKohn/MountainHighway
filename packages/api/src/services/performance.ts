/**
 * Performance Monitoring Service for Mountain Highway
 * 
 * Tracks and reports on:
 * - Response times
 * - Memory usage
 * - Database query performance
 * - Cache hit rates
 * - Error rates
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../config/environment';

interface PerformanceMetrics {
  responseTime: {
    total: number;
    count: number;
    average: number;
    p95: number;
    p99: number;
  };
  requests: {
    total: number;
    successful: number;
    errors: number;
    errorRate: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  database: {
    queryCount: number;
    slowQueries: number;
    averageQueryTime: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
}

interface RequestMetric {
  path: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: number;
  userId?: string;
  userAgent?: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private requests: RequestMetric[] = [];
  private dbQueryTimes: number[] = [];
  private maxStoredRequests = 1000;

  constructor() {
    this.metrics = {
      responseTime: {
        total: 0,
        count: 0,
        average: 0,
        p95: 0,
        p99: 0
      },
      requests: {
        total: 0,
        successful: 0,
        errors: 0,
        errorRate: 0
      },
      memory: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0
      },
      database: {
        queryCount: 0,
        slowQueries: 0,
        averageQueryTime: 0
      },
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0
      }
    };

    // Update memory metrics every 30 seconds
    setInterval(() => this.updateMemoryMetrics(), 30000);

    // Clean up old requests every 5 minutes
    setInterval(() => this.cleanupOldRequests(), 5 * 60 * 1000);

    // Log performance summary every 15 minutes
    if (config.NODE_ENV === 'development') {
      setInterval(() => this.logPerformanceSummary(), 15 * 60 * 1000);
    }
  }

  /**
   * Record a request metric
   */
  recordRequest(req: Request, res: Response, responseTime: number): void {
    const metric: RequestMetric = {
      path: req.route?.path || req.path,
      method: req.method,
      responseTime,
      statusCode: res.statusCode,
      timestamp: Date.now(),
      userId: req.auth?.user?.id,
      userAgent: req.get('User-Agent')
    };

    this.requests.push(metric);

    // Keep only recent requests
    if (this.requests.length > this.maxStoredRequests) {
      this.requests = this.requests.slice(-this.maxStoredRequests);
    }

    // Update metrics
    this.updateResponseTimeMetrics();
    this.updateRequestMetrics();
  }

  /**
   * Record database query time
   */
  recordDatabaseQuery(queryTime: number): void {
    this.dbQueryTimes.push(queryTime);
    this.metrics.database.queryCount++;

    // Track slow queries (> 100ms)
    if (queryTime > 100) {
      this.metrics.database.slowQueries++;
    }

    // Update average
    this.metrics.database.averageQueryTime = 
      this.dbQueryTimes.reduce((sum, time) => sum + time, 0) / this.dbQueryTimes.length;

    // Keep only recent query times
    if (this.dbQueryTimes.length > 1000) {
      this.dbQueryTimes = this.dbQueryTimes.slice(-1000);
    }
  }

  /**
   * Record cache hit/miss
   */
  recordCacheHit(): void {
    this.metrics.cache.hits++;
    this.updateCacheHitRate();
  }

  recordCacheMiss(): void {
    this.metrics.cache.misses++;
    this.updateCacheHitRate();
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    this.updateMemoryMetrics();
    return { ...this.metrics };
  }

  /**
   * Get detailed request analysis
   */
  getRequestAnalysis(timeframe: number = 15 * 60 * 1000): any {
    const cutoff = Date.now() - timeframe;
    const recentRequests = this.requests.filter(req => req.timestamp > cutoff);

    if (recentRequests.length === 0) {
      return { message: 'No requests in timeframe' };
    }

    // Group by endpoint
    const endpointStats = recentRequests.reduce((acc, req) => {
      const key = `${req.method} ${req.path}`;
      if (!acc[key]) {
        acc[key] = {
          count: 0,
          totalTime: 0,
          errors: 0,
          responseTimes: []
        };
      }
      
      acc[key].count++;
      acc[key].totalTime += req.responseTime;
      acc[key].responseTimes.push(req.responseTime);
      
      if (req.statusCode >= 400) {
        acc[key].errors++;
      }
      
      return acc;
    }, {} as any);

    // Calculate statistics for each endpoint
    Object.keys(endpointStats).forEach(endpoint => {
      const stats = endpointStats[endpoint];
      stats.averageTime = stats.totalTime / stats.count;
      stats.errorRate = (stats.errors / stats.count) * 100;
      
      // Calculate percentiles
      const sorted = stats.responseTimes.sort((a: number, b: number) => a - b);
      stats.p95 = this.calculatePercentile(sorted, 95);
      stats.p99 = this.calculatePercentile(sorted, 99);
      
      delete stats.responseTimes; // Remove raw data
    });

    return {
      timeframe: `${timeframe / 1000 / 60} minutes`,
      totalRequests: recentRequests.length,
      endpointStats
    };
  }

  /**
   * Get slowest endpoints
   */
  getSlowestEndpoints(limit: number = 10): any[] {
    const endpointTimes = this.requests.reduce((acc, req) => {
      const key = `${req.method} ${req.path}`;
      if (!acc[key]) {
        acc[key] = {
          endpoint: key,
          totalTime: 0,
          count: 0,
          maxTime: 0
        };
      }
      
      acc[key].totalTime += req.responseTime;
      acc[key].count++;
      acc[key].maxTime = Math.max(acc[key].maxTime, req.responseTime);
      
      return acc;
    }, {} as any);

    return Object.values(endpointTimes)
      .map((stats: any) => ({
        ...stats,
        averageTime: stats.totalTime / stats.count
      }))
      .sort((a: any, b: any) => b.averageTime - a.averageTime)
      .slice(0, limit);
  }

  /**
   * Check if system is healthy
   */
  isHealthy(): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check response time
    if (this.metrics.responseTime.average > 2000) {
      issues.push('High average response time');
    }
    
    // Check error rate
    if (this.metrics.requests.errorRate > 5) {
      issues.push('High error rate');
    }
    
    // Check memory usage
    const memUsagePercent = (this.metrics.memory.heapUsed / this.metrics.memory.heapTotal) * 100;
    if (memUsagePercent > 90) {
      issues.push('High memory usage');
    }
    
    // Check slow database queries
    if (this.metrics.database.slowQueries > this.metrics.database.queryCount * 0.1) {
      issues.push('Too many slow database queries');
    }
    
    return {
      healthy: issues.length === 0,
      issues
    };
  }

  /**
   * Update response time metrics
   */
  private updateResponseTimeMetrics(): void {
    if (this.requests.length === 0) return;

    const responseTimes = this.requests.map(req => req.responseTime);
    
    this.metrics.responseTime.total = responseTimes.reduce((sum, time) => sum + time, 0);
    this.metrics.responseTime.count = responseTimes.length;
    this.metrics.responseTime.average = this.metrics.responseTime.total / this.metrics.responseTime.count;
    
    const sorted = responseTimes.sort((a, b) => a - b);
    this.metrics.responseTime.p95 = this.calculatePercentile(sorted, 95);
    this.metrics.responseTime.p99 = this.calculatePercentile(sorted, 99);
  }

  /**
   * Update request metrics
   */
  private updateRequestMetrics(): void {
    this.metrics.requests.total = this.requests.length;
    this.metrics.requests.successful = this.requests.filter(req => req.statusCode < 400).length;
    this.metrics.requests.errors = this.requests.filter(req => req.statusCode >= 400).length;
    this.metrics.requests.errorRate = this.metrics.requests.total > 0 
      ? (this.metrics.requests.errors / this.metrics.requests.total) * 100 
      : 0;
  }

  /**
   * Update memory metrics
   */
  private updateMemoryMetrics(): void {
    const memUsage = process.memoryUsage();
    this.metrics.memory = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss
    };
  }

  /**
   * Update cache hit rate
   */
  private updateCacheHitRate(): void {
    const total = this.metrics.cache.hits + this.metrics.cache.misses;
    this.metrics.cache.hitRate = total > 0 ? (this.metrics.cache.hits / total) * 100 : 0;
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(sorted: number[], percentile: number): number {
    if (sorted.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  /**
   * Clean up old requests
   */
  private cleanupOldRequests(): void {
    const cutoff = Date.now() - (60 * 60 * 1000); // Keep 1 hour of data
    this.requests = this.requests.filter(req => req.timestamp > cutoff);
    this.updateResponseTimeMetrics();
    this.updateRequestMetrics();
  }

  /**
   * Log performance summary
   */
  private logPerformanceSummary(): void {
    const health = this.isHealthy();
    const memUsageMB = Math.round(this.metrics.memory.heapUsed / 1024 / 1024);
    
    console.log('📊 Performance Summary:', {
      healthy: health.healthy,
      issues: health.issues,
      requests: {
        total: this.metrics.requests.total,
        errorRate: `${this.metrics.requests.errorRate.toFixed(2)}%`
      },
      responseTime: {
        average: `${this.metrics.responseTime.average.toFixed(0)}ms`,
        p95: `${this.metrics.responseTime.p95.toFixed(0)}ms`
      },
      memory: `${memUsageMB}MB`,
      database: {
        queries: this.metrics.database.queryCount,
        slowQueries: this.metrics.database.slowQueries,
        avgTime: `${this.metrics.database.averageQueryTime.toFixed(1)}ms`
      },
      cache: `${this.metrics.cache.hitRate.toFixed(1)}% hit rate`
    });
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Express middleware for performance monitoring
 */
export const performanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    performanceMonitor.recordRequest(req, res, responseTime);
  });

  next();
};

/**
 * Database query performance wrapper
 */
export const monitorDatabaseQuery = async <T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> => {
  const startTime = Date.now();
  
  try {
    const result = await queryFn();
    const queryTime = Date.now() - startTime;
    
    performanceMonitor.recordDatabaseQuery(queryTime);
    
    // Log slow queries in development
    if (config.NODE_ENV === 'development' && queryTime > 100) {
      console.warn(`🐌 Slow query detected: ${queryName} (${queryTime}ms)`);
    }
    
    return result;
  } catch (error) {
    const queryTime = Date.now() - startTime;
    performanceMonitor.recordDatabaseQuery(queryTime);
    throw error;
  }
};

/**
 * Performance monitoring routes
 */
export const createPerformanceRoutes = () => {
  const router = require('express').Router();

  // Get current metrics
  router.get('/metrics', (req: Request, res: Response) => {
    res.json(performanceMonitor.getMetrics());
  });

  // Get request analysis
  router.get('/analysis', (req: Request, res: Response) => {
    const timeframe = req.query.timeframe ? parseInt(req.query.timeframe as string) : undefined;
    res.json(performanceMonitor.getRequestAnalysis(timeframe));
  });

  // Get slowest endpoints
  router.get('/slow-endpoints', (req: Request, res: Response) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    res.json(performanceMonitor.getSlowestEndpoints(limit));
  });

  // Health check
  router.get('/health', (req: Request, res: Response) => {
    const health = performanceMonitor.isHealthy();
    res.status(health.healthy ? 200 : 503).json(health);
  });

  return router;
};

export default {
  performanceMonitor,
  performanceMiddleware,
  monitorDatabaseQuery,
  createPerformanceRoutes
};
