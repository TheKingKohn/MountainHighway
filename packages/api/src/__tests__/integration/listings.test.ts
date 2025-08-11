/**
 * Listings Integration Tests
 * Tests all listing-related endpoints and functionality
 */

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import {
  createTestUser,
  createTestListing,
  generateTestToken,
  testData,
  assertResponseStructure,
  assertErrorResponse,
  assertListingStructure
} from '../../testing/helpers';

const prisma = global.testPrisma;

// Mock Express app for testing
const createTestApp = () => {
  const express = require('express');
  const app = express();
  app.use(express.json());
  
  // Mock JWT middleware
  app.use('/listings', (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const token = authHeader.substring(7);
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
        req.user = payload;
        next();
      } catch (error) {
        return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Invalid token' });
      }
    } else {
      return res.status(401).json({ error: 'MISSING_TOKEN', message: 'Missing token' });
    }
  });
  
  // Mock listing routes
  app.get('/listings', async (req: any, res: any) => {
    try {
      const { page = 1, limit = 10, search, status } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const where: any = {};
      if (search) {
        where.OR = [
          { title: { contains: search } },
          { description: { contains: search } }
        ];
      }
      if (status) {
        where.status = status;
      }
      
      const listings = await global.testPrisma.listing.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          seller: {
            select: {
              id: true,
              username: true,
              fullName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      const total = await global.testPrisma.listing.count({ where });
      
      res.json({
        listings,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch listings' });
    }
  });
  
  app.post('/listings', async (req: any, res: any) => {
    try {
      const { title, description, priceCents, photos } = req.body;
      
      // Basic validation
      if (!title || title.length < 3) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Title too short' });
      }
      
      if (!description || description.length < 10) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Description too short' });
      }
      
      if (!priceCents || priceCents < 100) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Price too low' });
      }
      
      const listing = await global.testPrisma.listing.create({
        data: {
          title,
          description,
          priceCents,
          photos: photos || JSON.stringify([]),
          sellerId: req.user.userId,
          status: 'ACTIVE'
        },
        include: {
          seller: {
            select: {
              id: true,
              username: true,
              fullName: true
            }
          }
        }
      });
      
      res.status(201).json({
        listing,
        message: 'Listing created successfully'
      });
    } catch (error) {
      res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to create listing' });
    }
  });
  
  app.get('/listings/:id', async (req: any, res: any) => {
    try {
      const listing = await global.testPrisma.listing.findUnique({
        where: { id: req.params.id },
        include: {
          seller: {
            select: {
              id: true,
              username: true,
              fullName: true,
              email: true
            }
          }
        }
      });
      
      if (!listing) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Listing not found' });
      }
      
      res.json(listing);
    } catch (error) {
      res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch listing' });
    }
  });
  
  app.put('/listings/:id', async (req: any, res: any) => {
    try {
      const listing = await global.testPrisma.listing.findUnique({
        where: { id: req.params.id }
      });
      
      if (!listing) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Listing not found' });
      }
      
      if (listing.sellerId !== req.user.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to edit this listing' });
      }
      
      const updatedListing = await global.testPrisma.listing.update({
        where: { id: req.params.id },
        data: req.body,
        include: {
          seller: {
            select: {
              id: true,
              username: true,
              fullName: true
            }
          }
        }
      });
      
      res.json(updatedListing);
    } catch (error) {
      res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update listing' });
    }
  });
  
  app.delete('/listings/:id', async (req: any, res: any) => {
    try {
      const listing = await global.testPrisma.listing.findUnique({
        where: { id: req.params.id }
      });
      
      if (!listing) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Listing not found' });
      }
      
      if (listing.sellerId !== req.user.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to delete this listing' });
      }
      
      await global.testPrisma.listing.delete({
        where: { id: req.params.id }
      });
      
      res.json({ message: 'Listing deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to delete listing' });
    }
  });
  
  return app;
};

describe('Listings Integration Tests', () => {
  let app: any;
  
  beforeAll(() => {
    app = createTestApp();
  });

  describe('GET /listings', () => {
    it('should fetch listings with valid token', async () => {
      const user = await createTestUser();
      const token = generateTestToken({ ...user, role: 'user' });
      
      // Create test listings
      await createTestListing(user.id);
      await createTestListing(user.id);

      const response = await request(app)
        .get('/listings')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      assertResponseStructure(response.body, [
        'listings',
        'pagination'
      ]);

      expect(Array.isArray(response.body.listings)).toBe(true);
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination.total).toBeGreaterThanOrEqual(2);
    });

    it('should support pagination', async () => {
      const user = await createTestUser();
      const token = generateTestToken({ ...user, role: 'user' });

      const response = await request(app)
        .get('/listings?page=1&limit=5')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
    });

    it('should support search functionality', async () => {
      const user = await createTestUser();
      const token = generateTestToken({ ...user, role: 'user' });
      
      await createTestListing(user.id, { title: 'Unique Test Item' });

      const response = await request(app)
        .get('/listings?search=Unique')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.listings.length).toBeGreaterThan(0);
      expect(response.body.listings[0].title).toContain('Unique');
    });

    it('should reject requests without token', async () => {
      const response = await request(app)
        .get('/listings')
        .expect(401);

      assertErrorResponse(response.body, 'MISSING_TOKEN');
    });
  });

  describe('POST /listings', () => {
    it('should create a new listing successfully', async () => {
      const user = await createTestUser();
      const token = generateTestToken({ ...user, role: 'user' });

      const listingData = {
        title: 'Test Listing',
        description: 'This is a test listing description',
        priceCents: 2500,
        photos: JSON.stringify(['photo1.jpg', 'photo2.jpg'])
      };

      const response = await request(app)
        .post('/listings')
        .set('Authorization', `Bearer ${token}`)
        .send(listingData)
        .expect(201);

      assertResponseStructure(response.body, [
        'listing',
        'message'
      ]);

      assertListingStructure(response.body.listing);
      expect(response.body.listing.title).toBe(listingData.title);
      expect(response.body.listing.sellerId).toBe(user.id);
    });

    it('should reject listing with invalid data', async () => {
      const user = await createTestUser();
      const token = generateTestToken({ ...user, role: 'user' });

      const invalidData = {
        title: 'Hi', // Too short
        description: 'Short',
        priceCents: 50 // Too low
      };

      const response = await request(app)
        .post('/listings')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidData)
        .expect(400);

      assertErrorResponse(response.body, 'VALIDATION_ERROR');
    });
  });

  describe('GET /listings/:id', () => {
    it('should fetch a specific listing', async () => {
      const user = await createTestUser();
      const token = generateTestToken({ ...user, role: 'user' });
      const listing = await createTestListing(user.id);

      const response = await request(app)
        .get(`/listings/${listing.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      assertListingStructure(response.body);
      expect(response.body.id).toBe(listing.id);
      expect(response.body.seller).toBeDefined();
    });

    it('should return 404 for non-existent listing', async () => {
      const user = await createTestUser();
      const token = generateTestToken({ ...user, role: 'user' });

      const response = await request(app)
        .get('/listings/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      assertErrorResponse(response.body, 'NOT_FOUND');
    });
  });

  describe('PUT /listings/:id', () => {
    it('should allow seller to update their listing', async () => {
      const user = await createTestUser();
      const token = generateTestToken({ ...user, role: 'user' });
      const listing = await createTestListing(user.id);

      const updateData = {
        title: 'Updated Title',
        priceCents: 3000
      };

      const response = await request(app)
        .put(`/listings/${listing.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.title).toBe(updateData.title);
      expect(response.body.priceCents).toBe(updateData.priceCents);
    });

    it('should prevent non-seller from updating listing', async () => {
      const seller = await createTestUser();
      const otherUser = await createTestUser();
      const listing = await createTestListing(seller.id);
      const token = generateTestToken({ ...otherUser, role: 'user' });

      const response = await request(app)
        .put(`/listings/${listing.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Hacked Title' })
        .expect(403);

      assertErrorResponse(response.body, 'FORBIDDEN');
    });
  });

  describe('DELETE /listings/:id', () => {
    it('should allow seller to delete their listing', async () => {
      const user = await createTestUser();
      const token = generateTestToken({ ...user, role: 'user' });
      const listing = await createTestListing(user.id);

      const response = await request(app)
        .delete(`/listings/${listing.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.message).toBe('Listing deleted successfully');

      // Verify listing is actually deleted
      const deletedListing = await global.testPrisma.listing.findUnique({
        where: { id: listing.id }
      });
      expect(deletedListing).toBeNull();
    });

    it('should prevent non-seller from deleting listing', async () => {
      const seller = await createTestUser();
      const otherUser = await createTestUser();
      const listing = await createTestListing(seller.id);
      const token = generateTestToken({ ...otherUser, role: 'user' });

      const response = await request(app)
        .delete(`/listings/${listing.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      assertErrorResponse(response.body, 'FORBIDDEN');
    });
  });

  describe('Database Integration', () => {
    it('should create listings with correct relationships', async () => {
      const user = await createTestUser();
      const listing = await createTestListing(user.id);

      expect(listing.sellerId).toBe(user.id);
      expect(listing.status).toBe('ACTIVE');
      expect(listing.createdAt).toBeDefined();
    });

    it('should maintain data integrity', async () => {
      const user = await createTestUser();
      const listing = await createTestListing(user.id, {
        title: 'Test Listing',
        priceCents: 1500
      });

      const fetchedListing = await global.testPrisma.listing.findUnique({
        where: { id: listing.id },
        include: { seller: true }
      });

      expect(fetchedListing?.title).toBe('Test Listing');
      expect(fetchedListing?.priceCents).toBe(1500);
      expect(fetchedListing?.seller.id).toBe(user.id);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple listings efficiently', async () => {
      const user = await createTestUser();
      const token = generateTestToken({ ...user, role: 'user' });

      // Create multiple listings
      const promises = Array(5).fill(null).map(() => createTestListing(user.id));
      await Promise.all(promises);

      const start = Date.now();
      const response = await request(app)
        .get('/listings')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should respond within 1 second
      expect(response.body.listings.length).toBeGreaterThanOrEqual(5);
    });
  });
});
