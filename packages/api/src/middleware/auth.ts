/**
 * Authentication and Authorization Middleware for Mountain Highway
 * Updated to support Role-Based Access Control (RBAC)
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from '../config/environment';
import RBACService, { AuthContext, ROLE_LEVELS } from '../services/rbac';
import { AuthenticatedRequest } from '../types/auth';

const prisma = new PrismaClient();

// Extend Express Request type to include auth context
declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
    user?: AuthContext['user'];
  }
}

export interface JWTPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    const decoded = jwt.verify(token, config.JWT_SECRET) as JWTPayload;
    
    // Get user with roles and permissions using RBAC service
    const userWithRoles = await RBACService.getUserWithRoles(decoded.userId);

    if (!userWithRoles) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // TODO: Add isActive check once Prisma types are updated
    // if (!userWithRoles.isActive) {
    //   res.status(403).json({ error: 'Account is inactive' });
    //   return;
    // }

    // Create authentication context
    const authContext = RBACService.createAuthContext(userWithRoles);
    
    // Ensure user exists in context
    if (!authContext.user) {
      res.status(401).json({ error: 'User not found in authentication context' });
      return;
    }
    
    // Add to request object
    req.auth = authContext;
    req.user = authContext.user;

    // Log successful authentication
    await RBACService.logAction(
      decoded.userId,
      'auth_success',
      'user',
      decoded.userId,
      null,
      req.ip,
      req.get('User-Agent')
    );

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Optional authentication - doesn't fail if no token provided
 */
export const optionalAuth = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    // No token provided, continue without auth
    req.auth = RBACService.createAuthContext(null);
    next();
    return;
  }

  // Token provided, validate it
  await requireAuth(req as AuthenticatedRequest, res, next);
};

/**
 * Require admin role (replaces hardcoded admin email check)
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.auth) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (!req.auth.isAdmin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
};

/**
 * Require specific permission
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!RBACService.hasPermission(req.auth, permission)) {
      res.status(403).json({ 
        error: `Permission required: ${permission}`,
        required: permission,
        userPermissions: req.auth.permissions
      });
      return;
    }

    next();
  };
};
