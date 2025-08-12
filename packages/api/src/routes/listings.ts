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
  priceCents: z.coerce.number().int().positive(),
  category: z.enum(['electronics', 'fashion', 'home', 'collectibles', 'automotive', 'services', 'other']).default('other'),
  subcategory: z.string().max(100).optional(),
  condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']).default('good'),
  brand: z.string().max(100).optional(),
  location: z.string().max(200).optional()
});

const updateListingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(2000).optional(),
  priceCents: z.coerce.number().int().positive().optional(),
  category: z.enum(['electronics', 'fashion', 'home', 'collectibles', 'automotive', 'services', 'other']).optional(),
  subcategory: z.string().max(100).optional(),
  condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']).optional(),
  brand: z.string().max(100).optional(),
  location: z.string().max(200).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SOLD']).optional()
});

// POST /listings - Create a new listing with file uploads (auth required)
router.post('/', requireAuth, uploadListingFiles, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    
    // Validate uploaded files
    const reqAny = req as any;
    const fileErrors = validateListingFiles(reqAny.files);
    if (fileErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'File validation failed',
        details: fileErrors
      });
    }
    
    // Parse form data
    const { title, description, priceCents, category, subcategory, condition, brand, location } = createListingSchema.parse(req.body);
    
    // Process uploaded files
    const files = reqAny.files as any;
    
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
        category,
        subcategory: subcategory || null,
        condition,
        brand: brand || null,
        location: location || null,
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
        category: listing.category,
        subcategory: listing.subcategory,
        condition: listing.condition,
        brand: listing.brand,
        location: listing.location,
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
    const reqAny = req as any;
    if (reqAny.files) {
      const files = reqAny.files as any;
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

// GET /listings - List all active listings with enhanced search and filtering
router.get('/', async (req, res) => {
  try {
    const { 
      limit = '20', 
      offset = '0', 
      search,
      category,
      condition,
      brand,
      location,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const limitNum = Math.min(parseInt(limit as string) || 20, 100);
    const offsetNum = parseInt(offset as string) || 0;

    // Build where clause
    const where: any = {
      status: 'ACTIVE'
    };

    // Add search filter (searches in title, description, brand)
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
        { brand: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    // Add category filter
    if (category && category !== 'all') {
      where.category = category as string;
    }

    // Add condition filter
    if (condition) {
      where.condition = condition as string;
    }

    // Add brand filter
    if (brand) {
      where.brand = { contains: brand as string, mode: 'insensitive' };
    }

    // Add location filter
    if (location) {
      where.location = { contains: location as string, mode: 'insensitive' };
    }

    // Add price filters
    if (minPrice || maxPrice) {
      where.priceCents = {};
      if (minPrice) where.priceCents.gte = parseInt(minPrice as string);
      if (maxPrice) where.priceCents.lte = parseInt(maxPrice as string);
    }

    // Build order by clause
    const orderBy: any = {};
    const validSortFields = ['createdAt', 'priceCents', 'title'];
    const sortField = validSortFields.includes(sortBy as string) ? sortBy as string : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';
    orderBy[sortField] = order;

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
        orderBy,
        take: limitNum,
        skip: offsetNum
      }),
      prisma.listing.count({ where })
    ]);

    // Parse photos and convert to URLs for all listings
    const listingsWithUrls = listings.map(listing => {
      let photoPaths: string[] = [];
      
      // Handle photos field - it might be a JSON string or already parsed
      if (listing.photos) {
        try {
          // If it's a string, parse it as JSON
          if (typeof listing.photos === 'string') {
            photoPaths = JSON.parse(listing.photos);
          } else {
            // If it's already an array, use it directly
            photoPaths = listing.photos as any;
          }
        } catch (e) {
          console.error('Error parsing photos for listing', listing.id, ':', e);
          photoPaths = [];
        }
      }
      
      const photoUrls = photoPaths.map(path => getFileUrl(path, req));
      const videoUrl = listing.video ? getFileUrl(listing.video, req) : null;
      
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
      },
      filters: {
        search: search || null,
        category: category || null,
        condition: condition || null,
        brand: brand || null,
        location: location || null,
        minPrice: minPrice ? parseInt(minPrice as string) : null,
        maxPrice: maxPrice ? parseInt(maxPrice as string) : null,
        sortBy: sortField,
        sortOrder: order
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

// GET /listings/filters - Get available filter options
router.get('/filters', async (req, res) => {
  try {
    // Get unique categories, conditions, brands, and locations from active listings
    const [categories, conditions, brands, locations] = await Promise.all([
      prisma.listing.findMany({
        where: { status: 'ACTIVE' },
        select: { category: true },
        distinct: ['category']
      }),
      prisma.listing.findMany({
        where: { status: 'ACTIVE' },
        select: { condition: true },
        distinct: ['condition']
      }),
      prisma.listing.findMany({
        where: { 
          status: 'ACTIVE',
          brand: { not: null }
        },
        select: { brand: true },
        distinct: ['brand']
      }),
      prisma.listing.findMany({
        where: { 
          status: 'ACTIVE',
          location: { not: null }
        },
        select: { location: true },
        distinct: ['location']
      })
    ]);

    // Get price range
    const priceStats = await prisma.listing.aggregate({
      where: { status: 'ACTIVE' },
      _min: { priceCents: true },
      _max: { priceCents: true },
      _avg: { priceCents: true }
    });

    res.json({
      success: true,
      filters: {
        categories: [
          { value: 'electronics', label: 'Electronics', icon: '📱' },
          { value: 'fashion', label: 'Fashion', icon: '👕' },
          { value: 'home', label: 'Home & Garden', icon: '🏠' },
          { value: 'collectibles', label: 'Collectibles', icon: '🎨' },
          { value: 'automotive', label: 'Automotive', icon: '🚗' },
          { value: 'services', label: 'Services', icon: '🛠️' },
          { value: 'other', label: 'Other', icon: '📦' }
        ],
        conditions: [
          { value: 'new', label: 'New' },
          { value: 'like_new', label: 'Like New' },
          { value: 'good', label: 'Good' },
          { value: 'fair', label: 'Fair' },
          { value: 'poor', label: 'Poor' }
        ],
        brands: brands.map(b => b.brand).filter(Boolean).sort(),
        locations: locations.map(l => l.location).filter(Boolean).sort(),
        priceRange: {
          min: priceStats._min.priceCents || 0,
          max: priceStats._max.priceCents || 100000,
          average: Math.round(priceStats._avg.priceCents || 0)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch filter options'
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
