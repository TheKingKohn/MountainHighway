/**
 * Jest Setup File
 * Runs before each test suite
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Global test database instance
let prisma: PrismaClient | undefined;

// Setup before all tests
beforeAll(async () => {
  // Clean up any existing test database
  const testDbPath = path.join(process.cwd(), 'test.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  
  // Create new Prisma client for testing
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'file:./test.db'
      }
    }
  });
  
  // Make prisma available globally in tests
  global.testPrisma = prisma;
  
  // Run database migrations
  try {
    execSync('npx prisma migrate deploy', { 
      stdio: 'ignore',
      env: { ...process.env, DATABASE_URL: 'file:./test.db' }
    });
  } catch (error) {
    console.warn('Migration warning (may be expected in test environment)');
  }
  
  // Connect to database
  await prisma.$connect();
  
  // Clean up test uploads directory
  const testUploadsDir = path.join(process.cwd(), 'test-uploads');
  if (fs.existsSync(testUploadsDir)) {
    fs.rmSync(testUploadsDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testUploadsDir, { recursive: true });
}, 30000);

// Cleanup after each test
afterEach(async () => {
  if (!prisma) return;
  
  // Disable foreign key checks temporarily
  await prisma.$executeRaw`PRAGMA foreign_keys = OFF;`;
  
  try {
    // Delete in correct order to handle foreign key constraints
    // 1. Delete dependent records first
    await prisma.$executeRaw`DELETE FROM "orders" WHERE 1=1;`;
    await prisma.$executeRaw`DELETE FROM "listings" WHERE 1=1;`;
    await prisma.$executeRaw`DELETE FROM "users" WHERE 1=1;`;
  } catch (error) {
    console.warn('Database cleanup error:', error);
  } finally {
    // Re-enable foreign key checks
    await prisma.$executeRaw`PRAGMA foreign_keys = ON;`;
  }
});

// Cleanup after all tests
afterAll(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
  
  // Clean up test database
  const testDbPath = path.join(process.cwd(), 'test.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  
  // Clean up test uploads
  const testUploadsDir = path.join(process.cwd(), 'test-uploads');
  if (fs.existsSync(testUploadsDir)) {
    fs.rmSync(testUploadsDir, { recursive: true, force: true });
  }
});

// Make prisma available globally in tests
declare global {
  var testPrisma: PrismaClient;
}

// Extend Jest matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  },
  
  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid email`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid email`,
        pass: false,
      };
    }
  }
});

// Type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeValidEmail(): R;
    }
  }
}
