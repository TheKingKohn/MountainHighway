import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types/auth';

const prisma = new PrismaClient();
const router = Router();

// POST /test/simulate-webhook/:orderId - Simulate webhook completion for testing
router.post('/simulate-webhook/:orderId', requireAuth as any, async (req: any, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;

    // Find the order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { listing: true }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (order.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: 'Order is not in PENDING status'
      });
    }

    // Simulate webhook processing - update order to HELD
    const paymentIntentId = `pi_mock_${Date.now()}`;
    
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'HELD',
        stripePaymentIntentId: paymentIntentId,
        paidAt: new Date()
      }
    });

    // Update listing status to SOLD
    await prisma.listing.update({
      where: { id: order.listingId },
      data: { status: 'SOLD' }
    });

    res.json({
      success: true,
      message: 'Webhook simulation completed',
      order: {
        id: orderId,
        status: 'HELD',
        paymentIntentId,
        paidAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error simulating webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to simulate webhook'
    });
  }
});

// GET /test/orders/held - Get all orders in HELD status
router.get('/orders/held', async (req, res) => {
  try {
    const heldOrders = await prisma.order.findMany({
      where: { status: 'HELD' },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            priceCents: true,
            photos: true,
            seller: {
              select: { id: true, email: true }
            }
          }
        },
        buyer: {
          select: { id: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate platform fees
    const PLATFORM_FEE_BPS = 800;
    const ordersWithFees = heldOrders.map(order => {
      const platformFee = Math.floor(order.amountCents * PLATFORM_FEE_BPS / 10000);
      const sellerAmount = order.amountCents - platformFee;
      
      return {
        ...order,
        platformFee,
        sellerAmount,
        listing: order.listing ? {
          ...order.listing,
          photos: JSON.parse(order.listing.photos || '[]')
        } : null
      };
    });

    res.json({
      success: true,
      heldOrders: ordersWithFees,
      summary: {
        totalOrders: heldOrders.length,
        totalValue: heldOrders.reduce((sum, order) => sum + order.amountCents, 0),
        totalPlatformFees: heldOrders.reduce((sum, order) => {
          const fee = Math.floor(order.amountCents * PLATFORM_FEE_BPS / 10000);
          return sum + fee;
        }, 0)
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

export default router;
