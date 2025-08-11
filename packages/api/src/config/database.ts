/**
 * Database Connection Validation and Management for Mountain Highway
 * 
 * This module provides database connection validation, health checks,
 * and connection utilities for both SQLite and PostgreSQL.
 */

import { PrismaClient } from '@prisma/client';
import { config } from './environment';

// Connection instance management
let prismaClient: PrismaClient | null = null;

export interface DatabaseHealth {
  isConnected: boolean;
  provider: 'sqlite' | 'postgresql';
  latency?: number;
  error?: string;
  uptime?: number;
  version?: string;
}

export interface ConnectionValidationResult {
  isValid: boolean;
  provider: 'sqlite' | 'postgresql';
  url: string;
  issues: string[];
  recommendations: string[];
}

/**
 * Validate database connection configuration
 */
export function validateDatabaseConnection(): ConnectionValidationResult {
  const { DATABASE_URL, DATABASE_PROVIDER } = config;
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Basic validation
  if (!DATABASE_URL) {
    issues.push('DATABASE_URL is not configured');
  }

  if (!['sqlite', 'postgresql'].includes(DATABASE_PROVIDER)) {
    issues.push(`Invalid DATABASE_PROVIDER: ${DATABASE_PROVIDER}. Must be 'sqlite' or 'postgresql'`);
  }

  // Provider-specific validation
  if (DATABASE_PROVIDER === 'sqlite') {
    if (DATABASE_URL && !DATABASE_URL.startsWith('file:')) {
      issues.push('SQLite DATABASE_URL must start with "file:"');
      recommendations.push('Example: file:./dev.db');
    }

    if (config.NODE_ENV === 'production') {
      recommendations.push('Consider using PostgreSQL for production environments');
      recommendations.push('SQLite may have limitations with concurrent connections');
    }
  }

  if (DATABASE_PROVIDER === 'postgresql') {
    if (DATABASE_URL && !DATABASE_URL.startsWith('postgresql://')) {
      issues.push('PostgreSQL DATABASE_URL must start with "postgresql://"');
      recommendations.push('Example: postgresql://user:password@localhost:5432/database');
    }

    if (DATABASE_URL && !DATABASE_URL.includes('@')) {
      issues.push('PostgreSQL URL appears to be missing authentication credentials');
    }

    if (config.NODE_ENV === 'development') {
      recommendations.push('Consider using SQLite for development for easier setup');
    }
  }

  // Production-specific checks
  if (config.NODE_ENV === 'production') {
    if (DATABASE_URL && DATABASE_URL.includes('localhost')) {
      recommendations.push('Production should use external database service, not localhost');
    }

    if (DATABASE_PROVIDER === 'postgresql' && DATABASE_URL && !DATABASE_URL.includes('ssl=true')) {
      recommendations.push('Production PostgreSQL should use SSL connections');
    }
  }

  return {
    isValid: issues.length === 0,
    provider: DATABASE_PROVIDER,
    url: DATABASE_URL || 'not configured',
    issues,
    recommendations
  };
}

/**
 * Get or create Prisma client instance
 */
export function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    // Validate configuration before creating client
    const validation = validateDatabaseConnection();
    if (!validation.isValid) {
      throw new Error(`Database configuration invalid: ${validation.issues.join(', ')}`);
    }

    // Create client with provider-specific options
    const clientOptions: any = {
      log: config.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    };

    // PostgreSQL specific optimizations
    if (config.DATABASE_PROVIDER === 'postgresql') {
      clientOptions.datasources = {
        db: {
          url: config.DATABASE_URL,
        },
      };
    }

    prismaClient = new PrismaClient(clientOptions);
  }

  return prismaClient;
}

/**
 * Test database connection health
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const startTime = Date.now();
  
  try {
    const client = getPrismaClient();
    
    // Test connection with a simple query
    await client.$queryRaw`SELECT 1 as test`;
    
    const latency = Date.now() - startTime;
    
    // Get database version if possible
    let version: string | undefined;
    try {
      if (config.DATABASE_PROVIDER === 'postgresql') {
        const result = await client.$queryRaw<[{ version: string }]>`SELECT version() as version`;
        version = result[0]?.version;
      } else {
        const result = await client.$queryRaw<[{ version: string }]>`SELECT sqlite_version() as version`;
        version = result[0]?.version;
      }
    } catch (versionError) {
      // Version query failed, but connection is still working
      console.warn('Could not retrieve database version:', versionError);
    }

    return {
      isConnected: true,
      provider: config.DATABASE_PROVIDER,
      latency,
      uptime: process.uptime(),
      version
    };

  } catch (error) {
    return {
      isConnected: false,
      provider: config.DATABASE_PROVIDER,
      error: error instanceof Error ? error.message : 'Unknown database error',
      uptime: process.uptime()
    };
  }
}

/**
 * Safely disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = null;
  }
}

/**
 * Initialize database connection on startup
 */
export async function initializeDatabase(): Promise<void> {
  console.log('🔌 Initializing database connection...');
  
  // Validate configuration
  const validation = validateDatabaseConnection();
  
  if (!validation.isValid) {
    console.error('❌ Database configuration validation failed:');
    validation.issues.forEach((issue, index) => {
      console.error(`   ${index + 1}. ${issue}`);
    });
    
    if (validation.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      validation.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }
    
    throw new Error('Database configuration is invalid');
  }

  // Log configuration info
  console.log(`   Provider: ${validation.provider}`);
  console.log(`   Environment: ${config.NODE_ENV}`);
  
  // Show recommendations even if valid
  if (validation.recommendations.length > 0) {
    console.log('\n💡 Configuration recommendations:');
    validation.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
  }

  // Test connection
  const health = await checkDatabaseHealth();
  
  if (!health.isConnected) {
    console.error(`❌ Database connection failed: ${health.error}`);
    
    // Provider-specific troubleshooting
    if (config.DATABASE_PROVIDER === 'postgresql') {
      console.log('\n🔧 PostgreSQL Troubleshooting:');
      console.log('   1. Ensure PostgreSQL server is running');
      console.log('   2. Check connection string format');
      console.log('   3. Verify database exists');
      console.log('   4. Confirm user permissions');
      console.log('   5. Check firewall settings');
    } else {
      console.log('\n🔧 SQLite Troubleshooting:');
      console.log('   1. Check file path permissions');
      console.log('   2. Ensure directory exists');
      console.log('   3. Verify disk space available');
    }
    
    throw new Error(`Failed to connect to ${config.DATABASE_PROVIDER} database`);
  }

  console.log(`✅ Database connected successfully`);
  console.log(`   Latency: ${health.latency}ms`);
  if (health.version) {
    console.log(`   Version: ${health.version}`);
  }
}

/**
 * Create database backup (development utility)
 */
export async function createDatabaseBackup(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  if (config.DATABASE_PROVIDER === 'sqlite') {
    const fs = await import('fs');
    const path = await import('path');
    
    const dbPath = config.DATABASE_URL.replace('file:', '');
    const backupPath = `backup-${timestamp}.db`;
    
    fs.copyFileSync(dbPath, backupPath);
    return backupPath;
  } else {
    // For PostgreSQL, recommend using the migration script
    throw new Error('PostgreSQL backup should be done using the migration script');
  }
}

// Graceful shutdown handler
process.on('beforeExit', async () => {
  await disconnectDatabase();
});

process.on('SIGINT', async () => {
  console.log('\n🔌 Disconnecting from database...');
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🔌 Disconnecting from database...');
  await disconnectDatabase();
  process.exit(0);
});
