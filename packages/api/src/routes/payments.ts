import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { paymentService } from '../services/payment';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types/auth';
import { z } from 'zod';

const prisma = new PrismaClient();
const router = Router();

// Validation schemas
const createPaymentSchema = z.object({
  listingId: z.string(),
  amount: z.number().positive(),
  currency: z.string().default('usd'),
  paymentMethod: z.enum(['stripe', 'paypal']),
});

const capturePaymentSchema = z.object({
  orderId: z.string(),
  paymentIntentId: z.string().optional(),
  paypalOrderId: z.string().optional(),
});

const refundSchema = z.object({
  orderId: z.string(),
  amount: z.number().positive().optional(),
  reason: z.string().optional(),
});

// POST /payments/create - Create a payment intent
router.post('/create', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { listingId, amount, currency, paymentMethod } = createPaymentSchema.parse(req.body);

    // Verify listing exists and get seller info
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: { seller: true }
    });

    if (!listing) {
      return res.status(404).json({
        success: false,
        error: 'Listing not found'
      });
    }

    if (listing.sellerId === user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot purchase your own listing'
      });
    }

    // Create order record
    const order = await prisma.order.create({
      data: {
        listingId,
        buyerId: user.id,
        amountCents: Math.round(amount * 100),
        paymentMethod,
        status: 'PENDING'
      }
    });

    let paymentIntent;
    if (paymentMethod === 'stripe') {
      paymentIntent = await paymentService.createStripePaymentIntent(
        amount,
        currency,
        listing.seller.stripeAccountId || undefined
      );

      // Update order with Stripe payment intent ID
      await prisma.order.update({
        where: { id: order.id },
        data: { stripePaymentIntentId: paymentIntent.id }
      });
    } else if (paymentMethod === 'paypal') {
      paymentIntent = await paymentService.createPayPalOrder(
        amount,
        currency,
        `Payment for ${listing.title}`,
        listing.seller.stripeAccountId || undefined
      );

      // Update order with PayPal order ID
      await prisma.order.update({
        where: { id: order.id },
        data: { paypalOrderId: paymentIntent.id }
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment method'
      });
    }

    res.json({
      success: true,
      orderId: order.id,
      paymentIntent: {
        id: paymentIntent.id,
        clientSecret: paymentIntent.clientSecret,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        paymentMethod: paymentIntent.paymentMethod,
        approvalUrl: paymentIntent.approvalUrl
      }
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to create payment'
    });
  }
});

// POST /payments/capture - Capture/confirm a payment
router.post('/capture', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { orderId, paymentIntentId, paypalOrderId } = capturePaymentSchema.parse(req.body);

    // Verify order belongs to user
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

    if (order.buyerId !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to capture this payment'
      });
    }

    let result;
    if (order.paymentMethod === 'stripe' && paymentIntentId) {
      result = await paymentService.captureStripePayment(paymentIntentId);
    } else if (order.paymentMethod === 'paypal' && paypalOrderId) {
      result = await paymentService.capturePayPalPayment(paypalOrderId);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment method or missing payment ID'
      });
    }

    if (result.success) {
      // Update order status
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'PAID',
          paidAt: new Date()
        }
      });
    }

    res.json({
      success: result.success,
      paymentId: result.paymentId,
      status: result.status,
      amount: result.amount,
      currency: result.currency,
      error: result.error
    });
  } catch (error) {
    console.error('Error capturing payment:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to capture payment'
    });
  }
});

// POST /payments/refund - Refund a payment
router.post('/refund', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { orderId, amount, reason } = refundSchema.parse(req.body);

    // Verify order and that user is the seller or admin
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

    if (order.listing.sellerId !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to refund this payment'
      });
    }

    if (order.status !== 'PAID') {
      return res.status(400).json({
        success: false,
        error: 'Order is not in a state that can be refunded'
      });
    }

    const result = await paymentService.refundPayment(orderId, amount, reason);

    if (result.success) {
      // Update order status
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'REFUNDED' }
      });
    }

    res.json({
      success: result.success,
      refundId: result.paymentId,
      status: result.status,
      amount: result.amount,
      currency: result.currency,
      error: result.error
    });
  } catch (error) {
    console.error('Error processing refund:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to process refund'
    });
  }
});

// GET /payments/orders - Get user's orders (buyer or seller)
router.get('/orders', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { role } = req.query; // 'buyer' or 'seller'

    let whereClause: any = {};
    if (role === 'buyer') {
      whereClause.buyerId = user.id;
    } else if (role === 'seller') {
      whereClause.listing = { sellerId: user.id };
    } else {
      // Get both buyer and seller orders
      whereClause = {
        OR: [
          { buyerId: user.id },
          { listing: { sellerId: user.id } }
        ]
      };
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            priceCents: true,
            photos: true,
            sellerId: true
          }
        },
        buyer: {
          select: {
            id: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      orders: orders.map(order => ({
        id: order.id,
        listingId: order.listingId,
        listingTitle: order.listing.title,
        listingPrice: order.listing.priceCents,
        listingPhotos: order.listing.photos,
        buyerEmail: order.buyer.email,
        amountCents: order.amountCents,
        paymentMethod: order.paymentMethod,
        status: order.status,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
        role: order.buyerId === user.id ? 'buyer' : 'seller'
      }))
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
});

// GET /payments/methods - Get available payment methods for user
router.get('/methods', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;

    res.json({
      success: true,
      methods: {
        stripe: {
          enabled: true,
          name: 'Credit/Debit Card',
          description: 'Pay securely with Visa, Mastercard, American Express, and more',
          types: ['card']
        },
        paypal: {
          enabled: true,
          name: 'PayPal',
          description: 'Pay with your PayPal account or PayPal Credit',
          types: ['paypal']
        }
      },
      sellerInfo: {
        hasStripeAccount: !!user.stripeAccountId,
        canReceivePayments: !!user.stripeAccountId
      }
    });
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment methods'
    });
  }
});

// GET /payments/test - Test payment integration without requiring a listing
router.get('/test', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;

    // Create a test listing first
    const testListing = await prisma.listing.create({
      data: {
        title: 'Test Payment Item',
        description: 'Test item for payment integration testing',
        priceCents: 2000, // $20.00
        photos: JSON.stringify(['test-photo.jpg']),
        sellerId: user.id,
        status: 'ACTIVE'
      }
    });

    // Test Stripe payment intent creation
    const stripeTest = await paymentService.createStripePaymentIntent(
      20.00, // $20
      'usd'
    );

    // Test PayPal order creation  
    const paypalTest = await paymentService.createPayPalOrder(
      15.00, // $15
      'USD',
      'Test payment integration'
    );

    // Clean up test listing
    await prisma.listing.delete({
      where: { id: testListing.id }
    });

    res.json({
      success: true,
      tests: {
        stripe: {
          id: stripeTest.id,
          amount: stripeTest.amount,
          currency: stripeTest.currency,
          status: stripeTest.status
        },
        paypal: {
          id: paypalTest.id,
          status: paypalTest.status
        }
      },
      message: 'Payment integration test successful'
    });
  } catch (error) {
    console.error('Error testing payments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test payment integration'
    });
  }
});

export default router;
