/**
 * Admin Routes for Mountain Highway
 * Updated to use Role-Based Access Control (RBAC)
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireAdmin, requirePermission } from '../middleware/auth';
import RBACService from '../services/rbac';

const router = Router();
const prisma = new PrismaClient();

// Apply authentication to all admin routes
router.use(requireAuth);

/**
 * Get admin dashboard data
 */
router.get('/dashboard', requireAdmin, async (req: Request, res: Response) => {
  try {
    // Get system statistics
    const stats = {
      users: await prisma.user.count(),
      listings: await prisma.listing.count(),
      orders: await prisma.order.count(),
      messages: await prisma.message.count()
    };

    res.json({
      message: 'Admin dashboard data',
      stats,
      user: req.user,
      permissions: req.auth?.permissions || []
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

/**
 * Get all users (admin only)
 */
router.get('/users', requirePermission('users.read'), async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        isActive: true,
        isEmailVerified: true,
        role: true,
        createdAt: true,
        lastLoginAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * Assign role to user
 */
router.post('/users/:userId/roles', requirePermission('users.roles'), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { roleName, expiresAt } = req.body;

    if (!roleName) {
      res.status(400).json({ error: 'Role name is required' });
      return;
    }

    await RBACService.assignRole(
      userId, 
      roleName, 
      req.user!.id,
      expiresAt ? new Date(expiresAt) : undefined
    );

    res.json({ 
      message: `Role '${roleName}' assigned to user`,
      userId,
      roleName,
      assignedBy: req.user!.email
    });
  } catch (error) {
    console.error('Assign role error:', error);
    res.status(500).json({ error: 'Failed to assign role' });
  }
});

/**
 * Remove role from user
 */
router.delete('/users/:userId/roles/:roleName', requirePermission('users.roles'), async (req: Request, res: Response) => {
  try {
    const { userId, roleName } = req.params;

    await RBACService.removeRole(userId, roleName, req.user!.id);

    res.json({ 
      message: `Role '${roleName}' removed from user`,
      userId,
      roleName,
      removedBy: req.user!.email
    });
  } catch (error) {
    console.error('Remove role error:', error);
    res.status(500).json({ error: 'Failed to remove role' });
  }
});

/**
 * Get user roles and permissions
 */
router.get('/users/:userId/roles', requirePermission('users.read'), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const userWithRoles = await RBACService.getUserWithRoles(userId);
    
    if (!userWithRoles) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const authContext = RBACService.createAuthContext(userWithRoles);

    res.json({
      userId,
      email: userWithRoles.email,
      roles: authContext.roles,
      permissions: authContext.permissions,
      level: authContext.level,
      isAdmin: authContext.isAdmin,
      isModerator: authContext.isModerator
    });
  } catch (error) {
    console.error('Get user roles error:', error);
    res.status(500).json({ error: 'Failed to fetch user roles' });
  }
});

/**
 * Get audit logs
 */
router.get('/audit-logs', requirePermission('system.audit'), async (req: Request, res: Response) => {
  try {
    const { userId, resource, action, limit = 100 } = req.query;

    const logs = await RBACService.getAuditLogs({
      userId: userId as string,
      resource: resource as string,
      action: action as string,
      limit: parseInt(limit as string)
    });

    res.json({ logs });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

/**
 * Get all roles and permissions
 */
router.get('/roles', requirePermission('system.settings'), async (req: Request, res: Response) => {
  try {
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true
          }
        },
        _count: {
          select: {
            assignments: true
          }
        }
      },
      orderBy: {
        level: 'asc'
      }
    });

    res.json({ roles });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

/**
 * Test endpoint to check current user's permissions
 */
router.get('/whoami', async (req: Request, res: Response) => {
  res.json({
    user: req.user,
    auth: req.auth,
    message: 'RBAC system working correctly'
  });
});

export default router;
