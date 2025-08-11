import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types/auth';
import { stripeConfig, config } from '../config/environment';

const prisma = new PrismaClient();
const router = Router();

// Platform fee in basis points (800 = 8%)
const PLATFORM_FEE_BPS = stripeConfig.PLATFORM_FEE_BPS;

// Admin middleware - check if user is platform admin
const requireAdmin = (req: AuthenticatedRequest, res: any, next: any) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  // Check admin status from auth context (set by RBAC middleware)
  const isAdmin = req.auth?.isAdmin || false;
  
  // Fallback: check against ADMIN_EMAILS environment variable
  if (!isAdmin) {
    const adminEmails = config.ADMIN_EMAILS ? config.ADMIN_EMAILS.split(',').map(email => email.trim().toLowerCase()) : [];
    const userIsInAdminEmails = adminEmails.includes(user.email.toLowerCase());
    
    if (!userIsInAdminEmails) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
  }

  next();
};

// GET /admin/orders/held - Get all orders awaiting fund release
router.get('/orders/held', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const heldOrders = await prisma.order.findMany({
      where: { status: 'HELD' },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            priceCents: true,
            seller: {
              select: {
                id: true,
                email: true,
                stripeAccountId: true
              }
            }
          }
        },
        buyer: {
          select: {
            id: true,
            email: true
          }
        }
      },
      orderBy: { paidAt: 'desc' }
    });

    // Calculate platform fees and seller amounts
    const ordersWithFinancials = heldOrders.map(order => {
      const platformFee = Math.floor(order.amountCents * PLATFORM_FEE_BPS / 10000);
      const sellerAmount = order.amountCents - platformFee;
      
      return {
        ...order,
        financials: {
          totalAmount: order.amountCents,
          platformFee,
          sellerAmount,
          canRelease: !!order.listing.seller.stripeAccountId
        }
      };
    });

    // Calculate summary statistics
    const totalHeld = ordersWithFinancials.reduce((sum, order) => sum + order.amountCents, 0);
    const totalPlatformFees = ordersWithFinancials.reduce((sum, order) => sum + order.financials.platformFee, 0);
    const totalSellerPayouts = ordersWithFinancials.reduce((sum, order) => sum + order.financials.sellerAmount, 0);

    res.json({
      success: true,
      orders: ordersWithFinancials,
      summary: {
        totalOrders: heldOrders.length,
        totalHeldAmount: totalHeld,
        totalPlatformFees,
        totalSellerPayouts,
        averageOrderValue: heldOrders.length > 0 ? Math.round(totalHeld / heldOrders.length) : 0
      }
    });

  } catch (error) {
    console.error('Error fetching held orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch held orders'
    });
  }
});

// GET /admin/orders/stats - Platform statistics and metrics
router.get('/orders/stats', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (timeframe) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Get order statistics
    const [
      totalOrders,
      paidOrders,
      heldOrders,
      cancelledOrders,
      refundedOrders,
      recentOrders
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PAID' } }),
      prisma.order.count({ where: { status: 'HELD' } }),
      prisma.order.count({ where: { status: 'CANCELLED' } }),
      prisma.order.count({ where: { status: 'REFUNDED' } }),
      prisma.order.findMany({
        where: {
          createdAt: { gte: startDate }
        },
        select: {
          amountCents: true,
          status: true,
          createdAt: true
        }
      })
    ]);

    // Calculate revenue metrics
    const recentRevenue = recentOrders
      .filter(order => ['PAID', 'HELD'].includes(order.status))
      .reduce((sum, order) => sum + order.amountCents, 0);

    const recentPlatformFees = Math.floor(recentRevenue * PLATFORM_FEE_BPS / 10000);

    // Get user counts
    const [totalUsers, totalListings, activeListings] = await Promise.all([
      prisma.user.count(),
      prisma.listing.count(),
      prisma.listing.count({ where: { status: 'ACTIVE' } })
    ]);

    res.json({
      success: true,
      timeframe,
      orders: {
        total: totalOrders,
        paid: paidOrders,
        held: heldOrders,
        cancelled: cancelledOrders,
        refunded: refundedOrders,
        recent: recentOrders.length
      },
      revenue: {
        totalRevenue: recentRevenue,
        platformFees: recentPlatformFees,
        averageOrderValue: recentOrders.length > 0 ? Math.round(recentRevenue / recentOrders.length) : 0
      },
      platform: {
        totalUsers,
        totalListings,
        activeListings,
        conversionRate: totalListings > 0 ? Math.round((totalOrders / totalListings) * 100) : 0
      }
    });

  } catch (error) {
    console.error('Error fetching platform stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch platform statistics'
    });
  }
});

// GET /admin/users/stats - User activity and verification stats
router.get('/users/stats', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const [
      totalUsers,
      usersWithStripeAccounts,
      sellersWithListings,
      buyersWithOrders
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { stripeAccountId: { not: null } } }),
      prisma.user.count({
        where: {
          listings: {
            some: {}
          }
        }
      }),
      prisma.user.count({
        where: {
          orders: {
            some: {}
          }
        }
      })
    ]);

    res.json({
      success: true,
      users: {
        total: totalUsers,
        withStripeAccounts: usersWithStripeAccounts,
        sellers: sellersWithListings,
        buyers: buyersWithOrders,
        stripeOnboardingRate: totalUsers > 0 ? Math.round((usersWithStripeAccounts / totalUsers) * 100) : 0
      }
    });

  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user statistics'
    });
  }
});

export default router;
