import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { stripe, FRONTEND_ORIGIN, isTestMode, releaseFundsToSeller, refundPayment } from '../services/stripe';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types/auth';
import { z } from 'zod';
import { stripeConfig } from '../config/environment';

const prisma = new PrismaClient();
const router = Router();

// Platform fee in basis points (800 = 8%)
const PLATFORM_FEE_BPS = stripeConfig.PLATFORM_FEE_BPS;

// POST /orders/:listingId/checkout - Create Stripe Checkout Session for escrow payment
router.post('/:listingId/checkout', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { listingId } = req.params;

    // Validate listing exists and is available
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: { 
        seller: true,
        orders: {
          where: {
            status: {
              in: ['PENDING', 'HELD', 'PAID']
            }
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

    if (listing.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: 'Listing is not available for purchase'
      });
    }

    if (listing.sellerId === user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot purchase your own listing'
      });
    }

    // Check if listing already has a pending/held/paid order
    if (listing.orders.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'This listing is already being purchased or has been sold'
      });
    }

    // Create pending order first
    const order = await prisma.order.create({
      data: {
        listingId,
        buyerId: user.id,
        amountCents: listing.priceCents,
        paymentMethod: 'stripe',
        status: 'PENDING'
      }
    });

    // Calculate platform fee
    const platformFee = Math.floor(listing.priceCents * PLATFORM_FEE_BPS / 10000);

    let session;
    
    if (isTestMode) {
      // Mock checkout session for testing
      session = {
        id: `cs_test_mock_${Date.now()}`,
        url: `${FRONTEND_ORIGIN}/mock-checkout?session_id=cs_test_mock_${Date.now()}&order_id=${order.id}`,
        payment_intent: `pi_mock_${Date.now()}`,
        metadata: {
          orderId: order.id,
          listingId: listing.id,
          sellerId: listing.sellerId,
          buyerId: user.id,
          platformFee: platformFee.toString()
        }
      };
    } else {
      // Create Stripe Checkout Session
      // NOTE: We do NOT use transfer_data here - funds go to platform first
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: listing.title,
                description: listing.description,
                images: listing.photos ? JSON.parse(listing.photos).slice(0, 1) : [] // First image only
              },
              unit_amount: listing.priceCents
            },
            quantity: 1
          }
        ],
        success_url: `${FRONTEND_ORIGIN}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${FRONTEND_ORIGIN}/checkout/cancel`,
        metadata: {
          orderId: order.id,
          listingId: listing.id,
          sellerId: listing.sellerId,
          buyerId: user.id,
          platformFee: platformFee.toString()
        }
      });
    }

    // Update order with checkout session ID
    await prisma.order.update({
      where: { id: order.id },
      data: { 
        stripePaymentIntentId: session.id // We'll update this with actual payment intent ID from webhook
      }
    });

    res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      order: {
        id: order.id,
        status: order.status,
        amountCents: order.amountCents,
        platformFee
      }
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create checkout session'
    });
  }
});

// GET /orders/:id - Get order details
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        listing: {
          include: {
            seller: {
              select: { id: true, email: true }
            }
          }
        },
        buyer: {
          select: { id: true, email: true }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check if user is buyer or seller
    if (order.buyerId !== user.id && order.listing.sellerId !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'You can only view your own orders'
      });
    }

    res.json({
      success: true,
      order: {
        id: order.id,
        status: order.status,
        amountCents: order.amountCents,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
        stripePaymentIntentId: order.stripePaymentIntentId,
        listing: {
          id: order.listing.id,
          title: order.listing.title,
          priceCents: order.listing.priceCents,
          seller: order.listing.seller
        },
        buyer: order.buyer
      }
    });

  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order'
    });
  }
});

// GET /orders/user/me - Get current user's orders (as buyer or seller)
router.get('/user/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;

    // Get orders where user is buyer
    const buyerOrders = await prisma.order.findMany({
      where: { buyerId: user.id },
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
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get orders where user is seller
    const sellerOrders = await prisma.order.findMany({
      where: {
        listing: {
          sellerId: user.id
        }
      },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            priceCents: true,
            photos: true
          }
        },
        buyer: {
          select: { id: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      orders: {
        asBuyer: buyerOrders.map(order => ({
          ...order,
          listing: {
            ...order.listing,
            photos: order.listing.photos ? JSON.parse(order.listing.photos) : []
          }
        })),
        asSeller: sellerOrders.map(order => ({
          ...order,
          listing: {
            ...order.listing,
            photos: order.listing.photos ? JSON.parse(order.listing.photos) : []
          }
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
});

// POST /orders/:orderId/mark-shipped - Mark order as shipped (seller only)
router.post('/:orderId/mark-shipped', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { orderId } = req.params;

    // Find the order with listing details
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        listing: {
          select: { sellerId: true, title: true }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Only seller can mark as shipped
    if (order.listing.sellerId !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'Only the seller can mark an order as shipped'
      });
    }

    // Order must be HELD to be shipped
    if (order.status !== 'HELD') {
      return res.status(400).json({
        success: false,
        error: 'Order must be in HELD status to mark as shipped'
      });
    }

    // Update order with shipped status
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        deliveryStatus: 'SHIPPED',
        shippedAt: new Date()
      },
      include: {
        listing: {
          select: { title: true }
        },
        buyer: {
          select: { email: true }
        }
      }
    });

    res.json({
      success: true,
      message: 'Order marked as shipped',
      order: {
        id: updatedOrder.id,
        deliveryStatus: updatedOrder.deliveryStatus,
        shippedAt: updatedOrder.shippedAt,
        listing: updatedOrder.listing
      }
    });

  } catch (error) {
    console.error('Error marking order as shipped:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark order as shipped'
    });
  }
});

// POST /orders/:orderId/mark-delivered - Mark order as delivered (seller only)
router.post('/:orderId/mark-delivered', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { orderId } = req.params;

    // Find the order with listing details
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        listing: {
          select: { sellerId: true, title: true }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Only seller can mark as delivered
    if (order.listing.sellerId !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'Only the seller can mark an order as delivered'
      });
    }

    // Order must be shipped first
    if (order.deliveryStatus !== 'SHIPPED') {
      return res.status(400).json({
        success: false,
        error: 'Order must be shipped before marking as delivered'
      });
    }

    // Update order with delivered status
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        deliveryStatus: 'DELIVERED',
        deliveredAt: new Date()
      },
      include: {
        listing: {
          select: { title: true }
        },
        buyer: {
          select: { email: true }
        }
      }
    });

    res.json({
      success: true,
      message: 'Order marked as delivered',
      order: {
        id: updatedOrder.id,
        deliveryStatus: updatedOrder.deliveryStatus,
        deliveredAt: updatedOrder.deliveredAt,
        listing: updatedOrder.listing
      }
    });

  } catch (error) {
    console.error('Error marking order as delivered:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark order as delivered'
    });
  }
});

// POST /orders/:orderId/confirm-delivery - Confirm delivery (buyer only)
router.post('/:orderId/confirm-delivery', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { orderId } = req.params;

    // Find the order with listing details
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        listing: {
          select: { sellerId: true, title: true }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Only buyer can confirm delivery
    if (order.buyerId !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'Only the buyer can confirm delivery'
      });
    }

    // Order must be marked as delivered by seller first
    if (order.deliveryStatus !== 'DELIVERED') {
      return res.status(400).json({
        success: false,
        error: 'Order must be marked as delivered by seller before buyer can confirm'
      });
    }

    // Update order with confirmed status
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        deliveryStatus: 'CONFIRMED',
        confirmedAt: new Date()
      },
      include: {
        listing: {
          select: { title: true }
        }
      }
    });

    res.json({
      success: true,
      message: 'Delivery confirmed',
      order: {
        id: updatedOrder.id,
        deliveryStatus: updatedOrder.deliveryStatus,
        confirmedAt: updatedOrder.confirmedAt,
        listing: updatedOrder.listing
      }
    });

  } catch (error) {
    console.error('Error confirming delivery:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm delivery'
    });
  }
});

// Platform fee in basis points (800 = 8%)
const PLATFORM_FEE_BPS_RELEASE = stripeConfig.PLATFORM_FEE_BPS;

// POST /orders/:orderId/release-funds - Release funds to seller (admin/platform only)
router.post('/:orderId/release-funds', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { orderId } = req.params;

    // TODO: Add proper admin role check
    // For now, we'll use a simple email check - replace with proper role system
    const adminEmails = ['admin@mountainhighway.com', 'platform@mountainhighway.com'];
    const isAdmin = adminEmails.includes(user.email.toLowerCase());

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only platform administrators can release funds'
      });
    }

    // Find the order with all necessary details
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        listing: {
          include: {
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
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Order must be in HELD status to release funds
    if (order.status !== 'HELD') {
      return res.status(400).json({
        success: false,
        error: 'Order must be in HELD status to release funds'
      });
    }

    // Seller must have Stripe Connect account
    if (!order.listing.seller.stripeAccountId) {
      return res.status(400).json({
        success: false,
        error: 'Seller must complete Stripe onboarding before funds can be released'
      });
    }

    // Calculate amounts
    const platformFee = Math.floor(order.amountCents * PLATFORM_FEE_BPS_RELEASE / 10000);
    const sellerAmount = order.amountCents - platformFee;

    // Release funds to seller
    const transfer = await releaseFundsToSeller({
      amount: sellerAmount,
      stripeAccountId: order.listing.seller.stripeAccountId,
      orderId: order.id,
      description: `Payment for "${order.listing.title}" - Order ${order.id}`
    });

    // Update order status to PAID
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'PAID',
        releasedAt: new Date()
      },
      include: {
        listing: {
          select: {
            title: true,
            seller: {
              select: {
                email: true
              }
            }
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Funds released successfully',
      transfer: {
        transferId: transfer.transferId,
        sellerAmount: sellerAmount,
        platformFee: platformFee,
        totalAmount: order.amountCents,
        releasedAt: updatedOrder.releasedAt
      },
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        listing: updatedOrder.listing
      }
    });

  } catch (error) {
    console.error('Error releasing funds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to release funds'
    });
  }
});

// POST /orders/:orderId/refund - Process refund (admin only)
router.post('/:orderId/refund', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { orderId } = req.params;
    const { reason = 'requested_by_customer', amount } = req.body;

    // Admin check (same as above - replace with proper role system)
    const adminEmails = ['admin@mountainhighway.com', 'platform@mountainhighway.com'];
    const isAdmin = adminEmails.includes(user.email.toLowerCase());

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only platform administrators can process refunds'
      });
    }

    // Find the order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        listing: {
          select: {
            title: true
          }
        },
        buyer: {
          select: {
            email: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Order must be HELD or PAID to refund
    if (!['HELD', 'PAID'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        error: 'Order must be HELD or PAID to process refund'
      });
    }

    // Must have payment intent ID
    if (!order.stripePaymentIntentId) {
      return res.status(400).json({
        success: false,
        error: 'No payment intent found for this order'
      });
    }

    // Process the refund
    const refund = await refundPayment({
      paymentIntentId: order.stripePaymentIntentId,
      amount: amount || undefined, // Full refund if no amount specified
      reason: reason,
      orderId: order.id
    });

    // Update order status to REFUNDED
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'REFUNDED'
      }
    });

    res.json({
      success: true,
      message: 'Refund processed successfully',
      refund: {
        refundId: refund.refundId,
        amount: refund.amount,
        status: refund.status
      },
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        listing: order.listing
      }
    });

  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process refund'
    });
  }
});

export default router;
