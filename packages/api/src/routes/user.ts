import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { requireAuth } from '../middleware/auth';
import { config } from '../config/environment';

const router = Router();

// GET /me - Get current user profile
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Get admin status from auth context
    const isAdmin = req.auth?.isAdmin || false;

    res.status(200).json({
      id: req.user.id,
      email: req.user.email,
      stripeAccountId: req.user.stripeAccountId,
      isAdmin,
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /debug-admin - Debug admin configuration (temporary endpoint)
router.get('/debug-admin', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const adminEmails = config.ADMIN_EMAILS ? config.ADMIN_EMAILS.split(',').map(email => email.trim()) : [];
    
    res.status(200).json({
      currentUser: req.user.email,
      adminEmails,
      isAdminFromContext: req.auth?.isAdmin || false,
      hasAdminEmailsConfigured: adminEmails.length > 0,
      isEmailInAdminList: adminEmails.includes(req.user.email),
    });
  } catch (error) {
    console.error('Debug admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
