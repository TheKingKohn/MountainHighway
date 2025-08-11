import { stripe, isTestMode as isStripeTestMode } from './stripe';
import { paypalService, isPayPalTestMode } from './paypal';
import { PrismaClient } from '@prisma/client';
import { stripeConfig } from '../config/environment';

const prisma = new PrismaClient();

export interface PaymentIntent {
  id: string;
  clientSecret?: string;
  status: string;
  amount: number;
  currency: string;
  paymentMethod: 'stripe' | 'paypal';
  approvalUrl?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId: string;
  status: string;
  amount?: number;
  currency?: string;
  error?: string;
}

export class PaymentService {
  // Create a payment intent for Stripe (card payments)
  async createStripePaymentIntent(
    amount: number,
    currency: string = 'usd',
    sellerAccountId?: string
  ): Promise<PaymentIntent> {
    if (isStripeTestMode) {
      // Mock Stripe payment intent
      return {
        id: `pi_mock_${Date.now()}`,
        clientSecret: `pi_mock_${Date.now()}_secret_mock`,
        status: 'requires_payment_method',
        amount,
        currency,
        paymentMethod: 'stripe'
      };
    }

    const paymentIntentData: any = {
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
    };

    // If seller has Connect account, add application fee
    if (sellerAccountId) {
      const platformFeeBps = stripeConfig.PLATFORM_FEE_BPS;
      const applicationFee = Math.round((amount * platformFeeBps) / 10000 * 100);
      
      paymentIntentData.application_fee_amount = applicationFee;
      paymentIntentData.transfer_data = {
        destination: sellerAccountId,
      };
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

    return {
      id: paymentIntent.id,
      clientSecret: paymentIntent.client_secret!,
      status: paymentIntent.status,
      amount,
      currency,
      paymentMethod: 'stripe'
    };
  }

  // Create a PayPal order
  async createPayPalOrder(
    amount: number,
    currency: string = 'USD',
    description?: string,
    sellerAccountId?: string
  ): Promise<PaymentIntent> {
    const order = await paypalService.createOrder({
      amount: amount.toFixed(2),
      currency: currency.toUpperCase(),
      description,
      sellerAccountId
    });

    const approvalLink = order.links?.find((link: any) => link.rel === 'approve');

    return {
      id: order.id,
      status: order.status,
      amount,
      currency,
      paymentMethod: 'paypal',
      approvalUrl: approvalLink?.href
    };
  }

  // Capture/confirm a Stripe payment
  async captureStripePayment(paymentIntentId: string): Promise<PaymentResult> {
    if (isStripeTestMode) {
      // Mock successful capture
      return {
        success: true,
        paymentId: paymentIntentId,
        status: 'succeeded',
        amount: 1000, // Mock amount in cents
        currency: 'usd'
      };
    }

    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status === 'succeeded') {
        return {
          success: true,
          paymentId: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency
        };
      }

      return {
        success: false,
        paymentId: paymentIntent.id,
        status: paymentIntent.status,
        error: 'Payment not successful'
      };
    } catch (error) {
      return {
        success: false,
        paymentId: paymentIntentId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Capture a PayPal payment
  async capturePayPalPayment(orderId: string): Promise<PaymentResult> {
    try {
      const result = await paypalService.captureOrder(orderId);
      
      if (result.status === 'COMPLETED') {
        const capture = result.purchase_units?.[0]?.payments?.captures?.[0];
        return {
          success: true,
          paymentId: result.id,
          status: result.status,
          amount: capture ? parseFloat(capture.amount.value) * 100 : undefined, // Convert to cents
          currency: capture?.amount.currency_code.toLowerCase()
        };
      }

      return {
        success: false,
        paymentId: result.id,
        status: result.status,
        error: 'PayPal payment not completed'
      };
    } catch (error) {
      return {
        success: false,
        paymentId: orderId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Refund a payment (works for both Stripe and PayPal)
  async refundPayment(
    orderId: string,
    amount?: number,
    reason?: string
  ): Promise<PaymentResult> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId }
      });

      if (!order) {
        return {
          success: false,
          paymentId: orderId,
          status: 'failed',
          error: 'Order not found'
        };
      }

      if (order.paymentMethod === 'stripe' && order.stripePaymentIntentId) {
        if (isStripeTestMode) {
          return {
            success: true,
            paymentId: order.stripePaymentIntentId,
            status: 'refunded',
            amount: amount || order.amountCents
          };
        }

        const refund = await stripe.refunds.create({
          payment_intent: order.stripePaymentIntentId,
          amount: amount ? Math.round(amount * 100) : undefined,
          reason: reason as any
        });

        return {
          success: true,
          paymentId: refund.id,
          status: refund.status || 'unknown',
          amount: refund.amount,
          currency: refund.currency
        };
      } else if (order.paymentMethod === 'paypal' && order.paypalOrderId) {
        // For PayPal, we'd need the capture ID, which we'd store separately
        // This is a simplified version
        const refund = await paypalService.refundCapture(
          order.paypalOrderId,
          amount ? {
            currency_code: 'USD',
            value: amount.toFixed(2)
          } : undefined
        );

        return {
          success: true,
          paymentId: refund.id,
          status: refund.status,
          amount: parseFloat(refund.amount.value) * 100,
          currency: refund.amount.currency_code.toLowerCase()
        };
      }

      return {
        success: false,
        paymentId: orderId,
        status: 'failed',
        error: 'Invalid payment method or missing payment ID'
      };
    } catch (error) {
      return {
        success: false,
        paymentId: orderId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const paymentService = new PaymentService();
