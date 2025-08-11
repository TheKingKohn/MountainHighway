import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types/auth';

const prisma = new PrismaClient();
const router = Router();

// Validation schemas
const createPostSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200, 'Title too long'),
  content: z.string().min(10, 'Content must be at least 10 characters').max(5000, 'Content too long'),
  type: z.enum(['discussion', 'trade_request', 'local_event', 'review']).default('discussion')
});

const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(1000, 'Comment too long')
});

// GET /community/posts - Get all community posts with pagination
router.get('/posts', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = (page - 1) * limit;
    
    const type = req.query.type as string;
    const whereClause = type ? { type } : {};

    const [posts, totalCount] = await Promise.all([
      prisma.communityPost.findMany({
        where: whereClause,
        include: {
          author: {
            select: {
              id: true,
              username: true,
              fullName: true,
              profileImage: true
            }
          },
          comments: {
            include: {
              author: {
                select: {
                  id: true,
                  username: true,
                  fullName: true,
                  profileImage: true
                }
              }
            },
            orderBy: { createdAt: 'asc' },
            take: 3 // Show first 3 comments
          },
          _count: {
            select: {
              comments: true,
              likes: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.communityPost.count({ where: whereClause })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      posts,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching community posts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch community posts'
    });
  }
});

// POST /community/posts - Create a new community post (auth required)
router.post('/posts', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const validation = createPostSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.error.errors
      });
    }

    const { title, content, type } = validation.data;

    const post = await prisma.communityPost.create({
      data: {
        title,
        content,
        type,
        authorId: userId
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            fullName: true,
            profileImage: true
          }
        },
        _count: {
          select: {
            comments: true,
            likes: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      post
    });
  } catch (error) {
    console.error('Error creating community post:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create post'
    });
  }
});

// POST /community/posts/:postId/comments - Add comment to post (auth required)
router.post('/posts/:postId/comments', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const validation = createCommentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.error.errors
      });
    }

    const { content } = validation.data;

    // Verify post exists
    const post = await prisma.communityPost.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    const comment = await prisma.communityComment.create({
      data: {
        content,
        postId,
        authorId: userId
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            fullName: true,
            profileImage: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      comment
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create comment'
    });
  }
});

// POST /community/posts/:postId/like - Like/unlike a post (auth required)
router.post('/posts/:postId/like', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check if user already liked this post
    const existingLike = await prisma.communityLike.findUnique({
      where: {
        userId_postId: {
          userId,
          postId
        }
      }
    });

    let liked = false;
    if (existingLike) {
      // Unlike the post
      await prisma.communityLike.delete({
        where: { id: existingLike.id }
      });
      liked = false;
    } else {
      // Like the post
      await prisma.communityLike.create({
        data: {
          userId,
          postId
        }
      });
      liked = true;
    }

    // Get updated like count
    const likeCount = await prisma.communityLike.count({
      where: { postId }
    });

    res.json({
      success: true,
      liked,
      likeCount
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle like'
    });
  }
});

// GET /community/stats - Get community statistics
router.get('/stats', async (req, res) => {
  try {
    const [totalUsers, totalPosts, totalComments, activeUsers] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.communityPost.count(),
      prisma.communityComment.count(),
      prisma.user.count({
        where: {
          isActive: true,
          lastLoginAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        }
      })
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalPosts,
        totalComments,
        activeUsers
      }
    });
  } catch (error) {
    console.error('Error fetching community stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats'
    });
  }
});

export default router;
