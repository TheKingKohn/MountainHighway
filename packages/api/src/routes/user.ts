import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { requireAuth } from '../middleware/auth';
import RBACService from '../services/rbac';

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

export default router;
