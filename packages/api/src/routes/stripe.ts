import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { stripe, FRONTEND_ORIGIN, isTestMode, mockStripeAccount, mockAccountLink, mockLoginLink } from '../services/stripe';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types/auth';

const prisma = new PrismaClient();
const router = Router();

// POST /stripe/create-account - Creates a Standard Connect account for current user
router.post('/create-account', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;

    // Check if user already has a Stripe account
    if (user.stripeAccountId) {
      return res.json({
        success: true,
        accountId: user.stripeAccountId,
        message: 'User already has a Stripe account'
      });
    }

    let account;
    if (isTestMode) {
      // Use mock data for testing
      account = mockStripeAccount;
    } else {
      // Create a Standard Connect account
      account = await stripe.accounts.create({
        type: 'standard',
        email: user.email,
      });
    }

    // Save the Stripe account ID to the user
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeAccountId: account.id },
    });

    res.json({
      success: true,
      accountId: account.id,
      message: isTestMode ? 'Mock Stripe account created successfully' : 'Stripe account created successfully'
    });
  } catch (error) {
    console.error('Error creating Stripe account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create Stripe account'
    });
  }
});

// POST /stripe/account-link - Returns Stripe onboarding link for user's account
router.post('/account-link', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;

    if (!user.stripeAccountId) {
      return res.status(400).json({
        success: false,
        error: 'User does not have a Stripe account. Please create one first.'
      });
    }

    let accountLink;
    if (isTestMode) {
      // Use mock data for testing
      accountLink = mockAccountLink;
    } else {
      // Create an account link for onboarding
      accountLink = await stripe.accountLinks.create({
        account: user.stripeAccountId,
        refresh_url: `${FRONTEND_ORIGIN}/stripe/refresh`,
        return_url: `${FRONTEND_ORIGIN}/stripe/return`,
        type: 'account_onboarding',
      });
    }

    res.json({
      success: true,
      url: accountLink.url,
      expiresAt: accountLink.expires_at
    });
  } catch (error) {
    console.error('Error creating account link:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create account link'
    });
  }
});

// GET /stripe/account - Returns basic account status
router.get('/account', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;

    if (!user.stripeAccountId) {
      return res.json({
        success: true,
        hasAccount: false,
        accountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false
      });
    }

    let account;
    if (isTestMode) {
      // Use mock data for testing
      account = { ...mockStripeAccount, id: user.stripeAccountId };
    } else {
      // Retrieve account information from Stripe
      account = await stripe.accounts.retrieve(user.stripeAccountId);
    }

    res.json({
      success: true,
      hasAccount: true,
      accountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirements: {
        currentlyDue: account.requirements?.currently_due || [],
        eventuallyDue: account.requirements?.eventually_due || [],
        pastDue: account.requirements?.past_due || [],
        pendingVerification: account.requirements?.pending_verification || []
      },
      country: account.country,
      defaultCurrency: account.default_currency
    });
  } catch (error) {
    console.error('Error retrieving Stripe account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve account information'
    });
  }
});

// GET /stripe/login-link - Creates a login link for accessing Stripe Express dashboard
router.post('/login-link', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;

    if (!user.stripeAccountId) {
      return res.status(400).json({
        success: false,
        error: 'User does not have a Stripe account'
      });
    }

    let loginLink;
    if (isTestMode) {
      // Use mock data for testing
      loginLink = mockLoginLink;
    } else {
      // Create a login link for the Express dashboard
      loginLink = await stripe.accounts.createLoginLink(user.stripeAccountId);
    }

    res.json({
      success: true,
      url: loginLink.url
    });
  } catch (error) {
    console.error('Error creating login link:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create login link'
    });
  }
});

export default router;
