import { PrismaClient, User, Listing } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';

/**
 * Test data generators
 */
export const testData = {
  email: () => `test.${randomUUID()}@example.com`,
  username: () => `user_${randomUUID().replace(/-/g, '').substring(0, 8)}`,
  phone: () => `+1${Math.random().toString().substring(2, 12)}`,
  title: () => `Test Item ${randomUUID().substring(0, 8)}`,
  description: () => `Test description for ${randomUUID()}`,
  priceCents: () => Math.floor(Math.random() * 10000) + 100,
  photos: () => JSON.stringify([`https://picsum.photos/400/300?random=${Math.random()}`]),
  location: () => `Test City ${Math.floor(Math.random() * 100)}`,
  imageUrl: () => `https://picsum.photos/400/300?random=${Math.random()}`
};

/**
 * User creation utilities
 */
export const createTestUser = async (overrides: any = {}): Promise<any> => {
  const defaultPassword = 'TestPassword123!';
  const passwordHash = overrides.passwordHash || await bcrypt.hash(defaultPassword, 10);
  
  return await global.testPrisma.user.create({
    data: {
      email: testData.email(),
      passwordHash,
      username: testData.username(),
      fullName: 'Test User',
      ...overrides
    }
  });
};

export const createTestAdmin = async (overrides: any = {}): Promise<any> => {
  return await createTestUser({
    fullName: 'Test Admin',
    ...overrides
  });
};

export const createTestModerator = async (overrides: any = {}): Promise<any> => {
  return await createTestUser({
    fullName: 'Test Moderator',
    ...overrides
  });
};

/**
 * Listing creation utilities
 */
export const createTestListing = async (
  userId?: string,
  overrides: any = {}
): Promise<any> => {
  let sellerId = userId;
  
  if (!sellerId) {
    const seller = await createTestUser();
    sellerId = seller.id;
  }

  return await global.testPrisma.listing.create({
    data: {
      title: testData.title(),
      description: testData.description(),
      priceCents: testData.priceCents(),
      photos: testData.photos(),
      sellerId: sellerId as string,
      status: 'ACTIVE',
      ...overrides
    }
  });
};

/**
 * Authentication utilities
 */
export const generateTestToken = (user: any): string => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role || 'user',
    isAdmin: (user.role || 'user') === 'admin',
    isModerator: (user.role || 'user') === 'moderator' || (user.role || 'user') === 'admin'
  };

  return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', {
    expiresIn: '1h'
  });
};

export const generateExpiredToken = (user: any): string => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role || 'user'
  };

  return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', {
    expiresIn: '-1h' // Already expired
  });
};

/**
 * Database utilities
 */
export const cleanupTestData = async (): Promise<void> => {
  await global.testPrisma.listing.deleteMany({});
  await global.testPrisma.user.deleteMany({});
};

export const getTestUserCount = async (): Promise<number> => {
  return await global.testPrisma.user.count();
};

export const getTestListingCount = async (): Promise<number> => {
  return await global.testPrisma.listing.count();
};

/**
 * Response validation utilities
 */
export const assertResponseStructure = (responseBody: any, expectedFields: string[]): void => {
  for (const field of expectedFields) {
    expect(responseBody).toHaveProperty(field);
  }
};

export const assertErrorResponse = (responseBody: any, expectedErrorCode?: string): void => {
  expect(responseBody).toHaveProperty('error');
  expect(responseBody).toHaveProperty('message');
  
  if (expectedErrorCode) {
    expect(responseBody.error).toBe(expectedErrorCode);
  }
};

export const assertListingStructure = (listing: any): void => {
  expect(listing).toHaveProperty('id');
  expect(listing).toHaveProperty('title');
  expect(listing).toHaveProperty('description');
  expect(listing).toHaveProperty('priceCents');
  expect(listing).toHaveProperty('sellerId');
  expect(listing).toHaveProperty('status');
  expect(listing).toHaveProperty('createdAt');
};

export const assertUserStructure = (user: any): void => {
  expect(user).toHaveProperty('id');
  expect(user).toHaveProperty('email');
  expect(user).toHaveProperty('username');
  expect(user).not.toHaveProperty('passwordHash');
};

/**
 * Mock utilities
 */
export const mockStripePayment = {
  success: () => ({
    id: `pi_test_${randomUUID()}`,
    status: 'succeeded',
    amount: 2000,
    currency: 'usd'
  }),
  
  failure: () => ({
    id: `pi_test_${randomUUID()}`,
    status: 'failed',
    amount: 2000,
    currency: 'usd',
    last_payment_error: {
      message: 'Your card was declined.'
    }
  })
};

export const mockS3Upload = {
  success: (filename: string) => ({
    Location: `https://test-bucket.s3.amazonaws.com/${filename}`,
    Key: filename,
    Bucket: 'test-bucket'
  }),
  
  failure: () => {
    throw new Error('S3 upload failed');
  }
};

/**
 * Performance testing utilities
 */
export const measureExecutionTime = async <T>(
  fn: () => Promise<T>
): Promise<{ result: T; executionTime: number }> => {
  const start = Date.now();
  const result = await fn();
  const executionTime = Date.now() - start;
  
  return { result, executionTime };
};

export const assertExecutionTime = (
  executionTime: number,
  maxTime: number,
  operation: string
): void => {
  expect(executionTime).toBeLessThan(maxTime);
  console.log(`${operation} completed in ${executionTime}ms (max: ${maxTime}ms)`);
};

export default {
  testData,
  createTestUser,
  createTestAdmin,
  createTestModerator,
  createTestListing,
  generateTestToken,
  generateExpiredToken,
  cleanupTestData,
  getTestUserCount,
  getTestListingCount,
  assertResponseStructure,
  assertErrorResponse,
  assertUserStructure,
  assertListingStructure,
  mockStripePayment,
  mockS3Upload,
  measureExecutionTime,
  assertExecutionTime
};
