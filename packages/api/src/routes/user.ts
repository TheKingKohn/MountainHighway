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

// POST /force-admin-migration - Force admin role assignment (temporary endpoint)
router.post('/force-admin-migration', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const adminEmails = config.ADMIN_EMAILS ? config.ADMIN_EMAILS.split(',').map(email => email.trim()) : [];
    
    if (!adminEmails.includes(req.user.email)) {
      res.status(403).json({ error: 'User not in admin emails list' });
      return;
    }

    // Directly assign admin role without importing RBACService
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      // Get or create admin role
      let adminRole = await prisma.role.findUnique({
        where: { name: 'admin' }
      });

      if (!adminRole) {
        adminRole = await prisma.role.create({
          data: {
            name: 'admin',
            description: 'Administrator with full system access',
            level: 100
          }
        });
      }

      // Check if user already has admin role
      const existingAssignment = await prisma.roleAssignment.findFirst({
        where: {
          userId: req.user.id,
          roleId: adminRole.id
        }
      });

      if (!existingAssignment) {
        // Assign admin role to user
        await prisma.roleAssignment.create({
          data: {
            userId: req.user.id,
            roleId: adminRole.id,
            assignedBy: req.user.id
          }
        });
      }

      await prisma.$disconnect();
      
      res.status(200).json({ 
        message: 'Admin role assigned successfully',
        userEmail: req.user.email,
        success: true
      });
    } catch (dbError) {
      await prisma.$disconnect();
      throw dbError;
    }
  } catch (error) {
    console.error('Force admin migration error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
