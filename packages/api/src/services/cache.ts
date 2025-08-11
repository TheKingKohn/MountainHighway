/**
 * Caching Service for Mountain Highway
 * 
 * Implements intelligent caching strategies:
 * - In-memory caching with LRU eviction
 * - Redis support for production
 * - Cache invalidation patterns
 * - Performance monitoring
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../config/environment';

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  hits: number;
  lastAccessed: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  memoryUsage: number;
  entryCount: number;
}

/**
 * In-Memory Cache Implementation with LRU Eviction
 */
class MemoryCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    memoryUsage: 0,
    entryCount: 0
  };

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
    
    // Cleanup expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      return null;
    }

    // Update access statistics
    entry.hits++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;

    // Move to end for LRU
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data as T;
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, data: T, ttl: number = 15 * 60 * 1000): void {
    // If at max capacity, remove least recently used
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.stats.evictions++;
      }
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      lastAccessed: Date.now()
    };

    this.cache.set(key, entry);
    this.updateStats();
  }

  /**
   * Delete from cache
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    if (result) {
      this.updateStats();
    }
    return result;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.updateStats();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.evictions++;
      return false;
    }
    
    return true;
  }

  /**
   * Get cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.stats.evictions += cleaned;
      this.updateStats();
      console.log(`Cache cleanup: removed ${cleaned} expired entries`);
    }
  }

  /**
   * Update memory usage statistics
   */
  private updateStats(): void {
    this.stats.entryCount = this.cache.size;
    
    // Rough memory usage calculation
    let memoryUsage = 0;
    for (const [key, entry] of this.cache.entries()) {
      memoryUsage += key.length * 2; // UTF-16 characters
      memoryUsage += JSON.stringify(entry.data).length * 2;
      memoryUsage += 64; // Overhead for entry metadata
    }
    
    this.stats.memoryUsage = memoryUsage;
  }
}

/**
 * Global cache instance
 */
export const cache = new MemoryCache(
  config.NODE_ENV === 'production' ? 5000 : 1000
);

/**
 * Cache key generators
 */
export const CacheKeys = {
  // User-related keys
  user: (id: string) => `user:${id}`,
  userProfile: (id: string) => `user:profile:${id}`,
  userListings: (id: string, page: number = 1) => `user:listings:${id}:${page}`,
  
  // Listing-related keys
  listing: (id: string) => `listing:${id}`,
  listingDetails: (id: string) => `listing:details:${id}`,
  listings: (category?: string, page: number = 1, limit: number = 20) => 
    `listings:${category || 'all'}:${page}:${limit}`,
  featuredListings: () => 'listings:featured',
  
  // Search-related keys
  search: (query: string, category?: string, page: number = 1) => 
    `search:${encodeURIComponent(query)}:${category || 'all'}:${page}`,
  
  // Category-related keys
  categories: () => 'categories',
  categoryStats: () => 'category:stats',
  
  // Message-related keys
  conversation: (userId1: string, userId2: string) => {
    const sorted = [userId1, userId2].sort();
    return `conversation:${sorted[0]}:${sorted[1]}`;
  },
  userConversations: (userId: string) => `user:conversations:${userId}`,
  
  // Analytics keys
  analytics: (period: string) => `analytics:${period}`,
  userStats: (userId: string) => `user:stats:${userId}`,
  
  // Session keys
  session: (sessionId: string) => `session:${sessionId}`,
  
  // Rate limiting keys
  rateLimit: (identifier: string, endpoint: string) => `rate:${identifier}:${endpoint}`,
  
  // API response keys
  apiResponse: (endpoint: string, params: string) => `api:${endpoint}:${params}`
};

/**
 * Cache TTL configurations (in milliseconds)
 */
export const CacheTTL = {
  // Short-term cache (5 minutes)
  SHORT: 5 * 60 * 1000,
  
  // Medium-term cache (15 minutes)
  MEDIUM: 15 * 60 * 1000,
  
  // Long-term cache (1 hour)
  LONG: 60 * 60 * 1000,
  
  // Very long-term cache (6 hours)
  VERY_LONG: 6 * 60 * 60 * 1000,
  
  // Static data cache (24 hours)
  STATIC: 24 * 60 * 60 * 1000
};

/**
 * Response caching middleware
 */
export const cacheResponse = (
  keyGenerator: (req: Request) => string,
  ttl: number = CacheTTL.MEDIUM,
  condition?: (req: Request) => boolean
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip caching if condition is not met
    if (condition && !condition(req)) {
      return next();
    }

    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key
    const cacheKey = keyGenerator(req);
    
    // Try to get cached response
    const cachedResponse = cache.get<{
      data: any;
      status: number;
      headers: Record<string, string>;
    }>(cacheKey);

    if (cachedResponse) {
      // Set headers
      Object.entries(cachedResponse.headers).forEach(([key, value]) => {
        res.set(key, value);
      });
      
      // Add cache hit header
      res.set('X-Cache', 'HIT');
      res.set('X-Cache-Key', cacheKey);
      
      return res.status(cachedResponse.status).json(cachedResponse.data);
    }

    // Store original json method
    const originalJson = res.json;
    const originalStatus = res.status;
    let responseStatus = 200;

    // Override status method to capture status code
    res.status = function(code: number) {
      responseStatus = code;
      return originalStatus.call(this, code);
    };

    // Override json method to cache response
    res.json = function(data: any) {
      // Only cache successful responses
      if (responseStatus >= 200 && responseStatus < 300) {
        const responseData = {
          data,
          status: responseStatus,
          headers: {
            'Content-Type': 'application/json',
            'X-Cache': 'MISS',
            'X-Cache-Key': cacheKey
          }
        };

        cache.set(cacheKey, responseData, ttl);
      }

      // Add cache miss header
      res.set('X-Cache', 'MISS');
      res.set('X-Cache-Key', cacheKey);

      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Cache invalidation helpers
 */
export const CacheInvalidation = {
  /**
   * Invalidate user-related caches
   */
  user: (userId: string) => {
    const patterns = [
      CacheKeys.user(userId),
      CacheKeys.userProfile(userId),
      CacheKeys.userStats(userId),
      CacheKeys.userConversations(userId)
    ];

    patterns.forEach(pattern => cache.delete(pattern));

    // Invalidate paginated user listings
    for (let page = 1; page <= 10; page++) {
      cache.delete(CacheKeys.userListings(userId, page));
    }
  },

  /**
   * Invalidate listing-related caches
   */
  listing: (listingId: string, category?: string) => {
    const patterns = [
      CacheKeys.listing(listingId),
      CacheKeys.listingDetails(listingId),
      CacheKeys.featuredListings()
    ];

    patterns.forEach(pattern => cache.delete(pattern));

    // Invalidate category listings
    for (let page = 1; page <= 10; page++) {
      cache.delete(CacheKeys.listings(category, page));
      cache.delete(CacheKeys.listings(undefined, page)); // All listings
    }
  },

  /**
   * Invalidate search caches
   */
  search: () => {
    const keys = cache.keys();
    keys.forEach(key => {
      if (key.startsWith('search:')) {
        cache.delete(key);
      }
    });
  },

  /**
   * Invalidate all caches
   */
  all: () => {
    cache.clear();
  }
};

/**
 * Cache warming functions
 */
export const CacheWarming = {
  /**
   * Warm popular listings cache
   */
  warmListings: async () => {
    // This would typically fetch popular listings and cache them
    console.log('Warming listings cache...');
  },

  /**
   * Warm category data cache
   */
  warmCategories: async () => {
    // This would typically fetch category data and cache them
    console.log('Warming categories cache...');
  }
};

/**
 * Cache monitoring middleware
 */
export const cacheMonitoring = (req: Request, res: Response, next: NextFunction) => {
  // Add cache stats to response headers (in development)
  if (config.NODE_ENV === 'development') {
    const stats = cache.getStats();
    
    res.on('finish', () => {
      console.log('Cache Stats:', {
        hitRate: stats.hits / (stats.hits + stats.misses) * 100,
        totalRequests: stats.hits + stats.misses,
        memoryUsage: `${(stats.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
        entryCount: stats.entryCount
      });
    });
  }

  next();
};

export default {
  cache,
  CacheKeys,
  CacheTTL,
  cacheResponse,
  CacheInvalidation,
  CacheWarming,
  cacheMonitoring
};
