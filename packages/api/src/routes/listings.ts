import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types/auth';
import { z } from 'zod';
import { uploadListingFiles, validateListingFiles, getFileUrl, deleteFile } from '../services/upload';

const prisma = new PrismaClient();
const router = Router();

// Validation schemas for non-file data
const createListingSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  priceCents: z.coerce.number().int().positive()
});

const updateListingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(2000).optional(),
  priceCents: z.coerce.number().int().positive().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SOLD']).optional()
});

// POST /listings - Create a new listing with file uploads (auth required)
router.post('/', requireAuth, uploadListingFiles, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    
    // Validate uploaded files
    const fileErrors = validateListingFiles(req.files);
    if (fileErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'File validation failed',
        details: fileErrors
      });
    }
    
    // Parse form data
    const { title, description, priceCents } = createListingSchema.parse(req.body);
    
    // Process uploaded files
    const files = req.files as { photos?: Express.Multer.File[], video?: Express.Multer.File[] };
    
    // Build photo paths array
    const photoPaths: string[] = [];
    if (files.photos) {
      files.photos.forEach(photo => {
        photoPaths.push(`images/${photo.filename}`);
      });
    }
    
    // Get video path if uploaded
    let videoPath: string | null = null;
    if (files.video && files.video[0]) {
      videoPath = `videos/${files.video[0].filename}`;
    }

    // Create listing in database
    const listing = await prisma.listing.create({
      data: {
        sellerId: user.id,
        title,
        description,
        priceCents,
        photos: JSON.stringify(photoPaths),
        video: videoPath,
        status: 'ACTIVE'
      },
      include: {
        seller: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    // Convert file paths to URLs for response
    const photoUrls = photoPaths.map(path => getFileUrl(path, req));
    const videoUrl = videoPath ? getFileUrl(videoPath, req) : null;

    res.status(201).json({
      success: true,
      listing: {
        id: listing.id,
        title: listing.title,
        description: listing.description,
        priceCents: listing.priceCents,
        photos: photoUrls,
        video: videoUrl,
        status: listing.status,
        createdAt: listing.createdAt,
        sellerId: listing.sellerId
      }
    });

  } catch (error) {
    console.error('Error creating listing:', error);
    
    // Clean up uploaded files on error
    if (req.files) {
      const files = req.files as { photos?: Express.Multer.File[], video?: Express.Multer.File[] };
      if (files.photos) {
        files.photos.forEach(photo => deleteFile(`images/${photo.filename}`));
      }
      if (files.video && files.video[0]) {
        deleteFile(`videos/${files.video[0].filename}`);
      }
    }
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid input data',
        details: error.errors
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to create listing'
      });
    }
  }
});

// GET /listings - List all active listings
router.get('/', async (req, res) => {
  try {
    const { 
      limit = '20', 
      offset = '0', 
      search,
      minPrice,
      maxPrice 
    } = req.query;

    const limitNum = Math.min(parseInt(limit as string) || 20, 100);
    const offsetNum = parseInt(offset as string) || 0;

    // Build where clause
    const where: any = {
      status: 'ACTIVE'
    };

    // Add search filter
    if (search) {
      where.OR = [
        { title: { contains: search as string } },
        { description: { contains: search as string } }
      ];
    }

    // Add price filters
    if (minPrice || maxPrice) {
      where.priceCents = {};
      if (minPrice) where.priceCents.gte = parseInt(minPrice as string);
      if (maxPrice) where.priceCents.lte = parseInt(maxPrice as string);
    }

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        include: {
          seller: {
            select: {
              id: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limitNum,
        skip: offsetNum
      }),
      prisma.listing.count({ where })
    ]);

    // Parse photos and convert to URLs for all listings
    const listingsWithUrls = listings.map(listing => {
      const photoPaths = JSON.parse(listing.photos) as string[];
      const photoUrls = photoPaths.map(path => getFileUrl(path, req));
      const videoUrl = (listing as any).video ? getFileUrl((listing as any).video, req) : null;
      
      return {
        ...listing,
        photos: photoUrls,
        video: videoUrl
      };
    });

    res.json({
      success: true,
      listings: listingsWithUrls,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total
      }
    });
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch listings'
    });
  }
});

// GET /listings/:id - Get a specific listing
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: {
        seller: {
          select: {
            id: true,
            email: true,
            stripeAccountId: true
          }
        },
        orders: {
          where: {
            status: 'PAID'
          },
          select: {
            id: true,
            createdAt: true
          }
        }
      }
    });

    if (!listing) {
      return res.status(404).json({
        success: false,
        error: 'Listing not found'
      });
    }

    // Parse photos
    const responseData = {
      ...listing,
      photos: JSON.parse(listing.photos),
      isPurchased: listing.orders.length > 0
    };

    res.json({
      success: true,
      listing: responseData
    });
  } catch (error) {
    console.error('Error fetching listing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch listing'
    });
  }
});

// PATCH /listings/:id - Update a listing (seller only)
router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const updateData = updateListingSchema.parse(req.body);

    // Check if listing exists and user is the seller
    const existingListing = await prisma.listing.findUnique({
      where: { id },
      include: {
        orders: {
          where: {
            status: {
              in: ['HELD', 'PAID']
            }
          }
        }
      }
    });

    if (!existingListing) {
      return res.status(404).json({
        success: false,
        error: 'Listing not found'
      });
    }

    if (existingListing.sellerId !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'You can only update your own listings'
      });
    }

    // Check if listing has orders in HELD or PAID status
    if (existingListing.orders.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot update a listing that has active or completed orders'
      });
    }

    // Prepare update data
    const updatePayload: any = {};
    if (updateData.title) updatePayload.title = updateData.title;
    if (updateData.description) updatePayload.description = updateData.description;
    if (updateData.priceCents) updatePayload.priceCents = updateData.priceCents;
    if (updateData.status) updatePayload.status = updateData.status;

    const updatedListing = await prisma.listing.update({
      where: { id },
      data: updatePayload,
      include: {
        seller: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    // Parse photos for response
    const responseData = {
      ...updatedListing,
      photos: JSON.parse(updatedListing.photos)
    };

    res.json({
      success: true,
      listing: responseData
    });
  } catch (error) {
    console.error('Error updating listing:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update listing'
    });
  }
});

// DELETE /listings/:id - Delete a listing (seller only, only if not sold)
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    // Check if listing exists and user is the seller
    const existingListing = await prisma.listing.findUnique({
      where: { id },
      include: {
        orders: {
          where: {
            status: {
              in: ['HELD', 'PAID']
            }
          }
        }
      }
    });

    if (!existingListing) {
      return res.status(404).json({
        success: false,
        error: 'Listing not found'
      });
    }

    if (existingListing.sellerId !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'You can only delete your own listings'
      });
    }

    // Check if listing has orders in HELD or PAID status
    if (existingListing.orders.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete a listing that has active or completed orders'
      });
    }

    await prisma.listing.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Listing deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting listing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete listing'
    });
  }
});

// GET /listings/user/me - Get current user's listings (auth required)
router.get('/user/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;

    const listings = await prisma.listing.findMany({
      where: {
        sellerId: user.id
      },
      include: {
        orders: {
          where: {
            status: 'PAID'
          },
          select: {
            id: true,
            createdAt: true,
            amountCents: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Parse photos and add sales info
    const listingsWithPhotos = listings.map(listing => ({
      ...listing,
      photos: JSON.parse(listing.photos),
      salesCount: listing.orders.length,
      totalRevenue: listing.orders.reduce((sum, order) => sum + order.amountCents, 0)
    }));

    res.json({
      success: true,
      listings: listingsWithPhotos
    });
  } catch (error) {
    console.error('Error fetching user listings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch your listings'
    });
  }
});

export default router;
