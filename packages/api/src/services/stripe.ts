import Stripe from 'stripe';
import { stripeConfig, serverConfig } from '../config/environment';

export const stripe = new Stripe(stripeConfig.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

export const FRONTEND_ORIGIN = serverConfig.FRONTEND_ORIGIN;

// Check if we're using a dummy key for testing
const isDummyKey = stripeConfig.STRIPE_SECRET_KEY.startsWith('sk_test_51234567890abcdef');

// Mock Stripe functions for testing with dummy keys
export const isTestMode = isDummyKey;

export const mockStripeAccount = {
  id: 'acct_test_mock_account_id',
  charges_enabled: false,
  payouts_enabled: false,
  details_submitted: false,
  country: 'US',
  default_currency: 'usd',
  requirements: {
    currently_due: ['external_account', 'business_type'],
    eventually_due: [],
    past_due: [],
    pending_verification: []
  }
};

export const mockAccountLink = {
  url: `${FRONTEND_ORIGIN}/stripe/mock-onboarding?account=acct_test_mock_account_id`,
  expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
};

export const mockLoginLink = {
  url: `${FRONTEND_ORIGIN}/stripe/mock-dashboard?account=acct_test_mock_account_id`
};

// Fund release functionality
export interface FundReleaseParams {
  amount: number; // Amount in cents to transfer to seller
  stripeAccountId: string; // Seller's Stripe Connect account ID
  orderId: string; // For metadata/tracking
  description?: string;
}

export interface FundReleaseResult {
  transferId: string;
  amount: number;
  destination: string;
  created: number;
}

export const releaseFundsToSeller = async (params: FundReleaseParams): Promise<FundReleaseResult> => {
  if (isTestMode) {
    // Mock transfer for testing
    console.log('MOCK: Creating transfer', params);
    
    return {
      transferId: `tr_mock_${Date.now()}`,
      amount: params.amount,
      destination: params.stripeAccountId,
      created: Math.floor(Date.now() / 1000)
    };
  }

  try {
    // Create transfer to seller's Connect account
    const transfer = await stripe.transfers.create({
      amount: params.amount,
      currency: 'usd',
      destination: params.stripeAccountId,
      description: params.description || `Payment for order ${params.orderId}`,
      metadata: {
        orderId: params.orderId,
        type: 'seller_payment'
      }
    });

    return {
      transferId: transfer.id,
      amount: transfer.amount,
      destination: transfer.destination as string,
      created: transfer.created
    };
  } catch (error) {
    console.error('Error creating transfer:', error);
    throw new Error(`Failed to release funds: ${error}`);
  }
};

// Refund functionality for disputes/cancellations
export interface RefundParams {
  paymentIntentId: string;
  amount?: number; // Optional partial refund amount in cents
  reason?: 'requested_by_customer' | 'duplicate' | 'fraudulent';
  orderId: string;
}

export interface RefundResult {
  refundId: string;
  amount: number;
  status: string;
  created: number;
}

export const refundPayment = async (params: RefundParams): Promise<RefundResult> => {
  if (isTestMode) {
    // Mock refund for testing
    console.log('MOCK: Creating refund', params);
    
    return {
      refundId: `re_mock_${Date.now()}`,
      amount: params.amount || 0,
      status: 'succeeded',
      created: Math.floor(Date.now() / 1000)
    };
  }

  try {
    const refundData: Stripe.RefundCreateParams = {
      payment_intent: params.paymentIntentId,
      reason: params.reason || 'requested_by_customer',
      metadata: {
        orderId: params.orderId,
        type: 'order_refund'
      }
    };

    if (params.amount) {
      refundData.amount = params.amount;
    }

    const refund = await stripe.refunds.create(refundData);

    return {
      refundId: refund.id,
      amount: refund.amount,
      status: refund.status || 'pending',
      created: refund.created
    };
  } catch (error) {
    console.error('Error creating refund:', error);
    throw new Error(`Failed to process refund: ${error}`);
  }
};
