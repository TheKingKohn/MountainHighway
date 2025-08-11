import { Router } from 'express';
import { stripe } from '../services/stripe';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import { stripeConfig } from '../config/environment';

const prisma = new PrismaClient();
const router = Router();

// Stripe webhook endpoint - must use raw body for signature verification
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = stripeConfig.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(400).send('Webhook secret not configured');
  }

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Handle checkout session completed
async function handleCheckoutSessionCompleted(session: any) {
  console.log('Processing checkout.session.completed:', session.id);

  const orderId = session.metadata?.orderId;
  if (!orderId) {
    console.error('No orderId in session metadata');
    return;
  }

  // Find the order
  const order = await prisma.order.findUnique({
    where: { id: orderId }
  });

  if (!order) {
    console.error(`Order not found: ${orderId}`);
    return;
  }

  // Get the payment intent from the session
  const paymentIntentId = session.payment_intent;
  
  // Update order status to HELD and store payment intent ID
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

  console.log(`Order ${orderId} updated to HELD status with payment intent ${paymentIntentId}`);
}

// Handle payment intent succeeded (additional confirmation)
async function handlePaymentIntentSucceeded(paymentIntent: any) {
  console.log('Processing payment_intent.succeeded:', paymentIntent.id);

  // Find order by payment intent ID
  const order = await prisma.order.findFirst({
    where: { stripePaymentIntentId: paymentIntent.id }
  });

  if (!order) {
    console.log(`No order found for payment intent: ${paymentIntent.id}`);
    return;
  }

  // Ensure order is in HELD status
  if (order.status === 'PENDING') {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'HELD',
        paidAt: new Date()
      }
    });
    console.log(`Order ${order.id} updated to HELD status from payment_intent.succeeded`);
  }
}

export default router;
