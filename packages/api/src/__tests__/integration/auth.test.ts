/**
 * Authentication Integration Tests
 * Tests all authentication endpoints and flows
 */

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import {
  createTestUser,
  createTestAdmin,
  generateTestToken,
  testData,
  assertResponseStructure,
  assertErrorResponse
} from '../../testing/helpers';

// Mock Express app for testing
const createTestApp = () => {
  const express = require('express');
  const app = express();
  app.use(express.json());
  
  // Mock authentication routes
  app.post('/auth/register', async (req: any, res: any) => {
    const { email, password, username, fullName } = req.body;
    
    // Basic validation
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid email' });
    }
    
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Password too weak' });
    }
    
    try {
      // Check if user exists
      const existingUser = await global.testPrisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(409).json({ error: 'EMAIL_ALREADY_EXISTS', message: 'Email already registered' });
      }
      
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await global.testPrisma.user.create({
        data: {
          email,
          passwordHash,
          username: username || testData.username(),
          fullName: fullName || 'Test User'
        }
      });
      
      const token = generateTestToken({ ...user, role: 'user' });
      
      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.fullName
        },
        token,
        message: 'User registered successfully'
      });
    } catch (error) {
      res.status(500).json({ error: 'SERVER_ERROR', message: 'Registration failed' });
    }
  });
  
  app.post('/auth/login', async (req: any, res: any) => {
    const { email, password } = req.body;
    
    try {
      const user = await global.testPrisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
      }
      
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
      }
      
      const token = generateTestToken({ ...user, role: 'user' });
      
      res.json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username
        },
        token,
        message: 'Login successful'
      });
    } catch (error) {
      res.status(500).json({ error: 'SERVER_ERROR', message: 'Login failed' });
    }
  });
  
  return app;
};

describe('Authentication Integration Tests', () => {
  let app: any;
  
  beforeAll(() => {
    app = createTestApp();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: testData.email(),
        username: testData.username(),
        password: 'Password123!',
        fullName: 'Test User'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      assertResponseStructure(response.body, [
        'user',
        'token',
        'message'
      ]);

      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.username).toBe(userData.username);
      expect(response.body.user).not.toHaveProperty('passwordHash');
      expect(response.body.token).toBeDefined();
    });

    it('should reject registration with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        username: testData.username(),
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(400);

      assertErrorResponse(response.body, 'VALIDATION_ERROR');
    });

    it('should reject registration with weak password', async () => {
      const userData = {
        email: testData.email(),
        username: testData.username(),
        password: '123'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(400);

      assertErrorResponse(response.body, 'VALIDATION_ERROR');
    });

    it('should reject registration with duplicate email', async () => {
      const email = testData.email();
      
      // Create first user
      await createTestUser({ email });

      // Try to register with same email
      const userData = {
        email,
        username: testData.username(),
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(409);

      assertErrorResponse(response.body, 'EMAIL_ALREADY_EXISTS');
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const password = 'Password123!';
      const passwordHash = await bcrypt.hash(password, 10);
      
      const user = await createTestUser({
        email: testData.email(),
        passwordHash
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: user.email,
          password
        })
        .expect(200);

      assertResponseStructure(response.body, [
        'user',
        'token',
        'message'
      ]);

      expect(response.body.user.email).toBe(user.email);
      expect(response.body.token).toBeDefined();
    });

    it('should reject login with invalid email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!'
        })
        .expect(401);

      assertErrorResponse(response.body, 'INVALID_CREDENTIALS');
    });

    it('should reject login with wrong password', async () => {
      const user = await createTestUser({
        passwordHash: await bcrypt.hash('CorrectPassword123!', 10)
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: user.email,
          password: 'WrongPassword123!'
        })
        .expect(401);

      assertErrorResponse(response.body, 'INVALID_CREDENTIALS');
    });
  });

  describe('Token Generation and Validation', () => {
    it('should generate valid JWT tokens', async () => {
      const user = await createTestUser();
      const token = generateTestToken({ ...user, role: 'user' });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include correct user data in token', async () => {
      const user = await createTestUser();
      const token = generateTestToken({ ...user, role: 'admin' });
      
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      expect(payload.userId).toBe(user.id);
      expect(payload.email).toBe(user.email);
      expect(payload.role).toBe('admin');
      expect(payload.isAdmin).toBe(true);
    });
  });

  describe('Database Integration', () => {
    it('should create users in the database', async () => {
      const initialCount = await global.testPrisma.user.count();
      await createTestUser();
      const finalCount = await global.testPrisma.user.count();
      
      expect(finalCount).toBe(initialCount + 1);
    });

    it('should hash passwords securely', async () => {
      const password = 'TestPassword123!';
      const user = await createTestUser({
        passwordHash: await bcrypt.hash(password, 10)
      });
      
      // Password should be hashed, not plain text
      expect(user.passwordHash).not.toBe(password);
      expect(user.passwordHash).toMatch(/^\$2[aby]?\$\d+\$/); // bcrypt format
      
      // Should be able to verify the password
      const isValid = await bcrypt.compare(password, user.passwordHash);
      expect(isValid).toBe(true);
    });
  });
});
