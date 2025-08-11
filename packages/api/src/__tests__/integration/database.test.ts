/**
 * Basic Database Test
 * Tests that our testing infrastructure is working
 */

import { createTestUser, testData } from '../../testing/helpers';

describe('Database Integration Test', () => {
  it('should connect to test database', async () => {
    expect(global.testPrisma).toBeDefined();
    
    // Test basic database connection
    const result = await global.testPrisma.$queryRaw`SELECT 1 as test`;
    expect(result).toBeDefined();
  });

  it('should create a test user', async () => {
    const user = await createTestUser({
      email: testData.email(),
      fullName: 'Test User'
    });

    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.email).toMatch(/@example\.com$/);
  });

  it('should clean up between tests', async () => {
    // Create a user
    await createTestUser();
    
    // After this test, the afterEach hook should clean up the user
    // The next test will verify this
  });

  it('should have cleaned up previous test data', async () => {
    const userCount = await global.testPrisma.user.count();
    expect(userCount).toBe(0);
  });
});
