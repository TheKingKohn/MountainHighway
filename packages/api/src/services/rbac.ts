/**
 * Role-Based Access Control (RBAC) Service for Mountain Highway
 * 
 * This service manages user roles, permissions, and authorization checks.
 * It replaces the hardcoded admin email system with a flexible role-based approach.
 */

import { PrismaClient } from '@prisma/client';
import { config } from '../config/environment';

const prisma = new PrismaClient();

// Explicit user type for deployment compatibility
export interface UserWithRoles {
  id: string;
  email: string;
  password: string;
  stripeAccountId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  roleAssignments: Array<{
    role: {
      id: string;
      name: string;
      level: number;
      permissions: Array<{
        permission: {
          id: string;
          name: string;
          resource: string;
          action: string;
        };
      }>;
    };
  }>;
}

export interface AuthContext {
  user: UserWithRoles | null;
  roles: string[];
  permissions: string[];
  isAdmin: boolean;
  isModerator: boolean;
  level: number;
}

// System role levels
export const ROLE_LEVELS = {
  USER: 0,
  VIP_SELLER: 25,
  MODERATOR: 50,
  ADMIN: 100
} as const;

// Standard permissions
export const PERMISSIONS = {
  // User management
  'users.read': 'View user profiles and information',
  'users.write': 'Edit user profiles and settings',
  'users.delete': 'Delete user accounts',
  'users.ban': 'Ban or suspend user accounts',
  'users.roles': 'Assign and manage user roles',
  
  // Listing management
  'listings.read': 'View all listings including hidden ones',
  'listings.write': 'Create and edit listings',
  'listings.moderate': 'Moderate, hide, or remove listings',
  'listings.feature': 'Feature listings prominently',
  
  // Order management
  'orders.read': 'View all orders and transactions',
  'orders.write': 'Create and modify orders',
  'orders.refund': 'Process refunds and cancellations',
  'orders.resolve': 'Resolve order disputes',
  
  // System administration
  'system.settings': 'Modify system settings and configuration',
  'system.analytics': 'Access system analytics and reports',
  'system.maintenance': 'Perform system maintenance tasks',
  'system.audit': 'View audit logs and security information',
  
  // Platform management
  'platform.fees': 'Modify platform fees and pricing',
  'platform.payments': 'Manage payment configurations',
  'platform.content': 'Manage site content and announcements'
} as const;

/**
 * Role-Based Access Control Service
 */
export class RBACService {
  
  /**
   * Initialize default roles and permissions in the database
   */
  static async initializeDefaultRoles(): Promise<void> {
    console.log('🔐 Initializing RBAC system...');
    
    try {
      // Create default permissions
      const permissionData = Object.entries(PERMISSIONS).map(([name, description]) => {
        const [resource, action] = name.split('.');
        return {
          name,
          resource,
          action,
          description,
          isSystem: true
        };
      });

      // Upsert permissions (create if not exists, update if exists)
      for (const permission of permissionData) {
        await prisma.permission.upsert({
          where: { name: permission.name },
          update: { description: permission.description },
          create: permission
        });
      }

      // Create default roles
      const defaultRoles = [
        {
          name: 'user',
          description: 'Standard user with basic permissions',
          level: ROLE_LEVELS.USER,
          isSystem: true,
          permissions: ['listings.read', 'listings.write', 'users.read']
        },
        {
          name: 'vip_seller',
          description: 'VIP seller with enhanced listing capabilities',
          level: ROLE_LEVELS.VIP_SELLER,
          isSystem: true,
          permissions: ['listings.read', 'listings.write', 'listings.feature', 'users.read']
        },
        {
          name: 'moderator',
          description: 'Moderator with content management permissions',
          level: ROLE_LEVELS.MODERATOR,
          isSystem: true,
          permissions: [
            'listings.read', 'listings.write', 'listings.moderate',
            'users.read', 'users.ban',
            'orders.read', 'orders.resolve'
          ]
        },
        {
          name: 'admin',
          description: 'Administrator with full system access',
          level: ROLE_LEVELS.ADMIN,
          isSystem: true,
          permissions: Object.keys(PERMISSIONS) // All permissions
        }
      ];

      // Create roles and assign permissions
      for (const roleData of defaultRoles) {
        const { permissions, ...roleInfo } = roleData;
        
        // Upsert role
        const role = await prisma.role.upsert({
          where: { name: roleData.name },
          update: { 
            description: roleData.description,
            level: roleData.level
          },
          create: roleInfo
        });

        // Assign permissions to role
        for (const permissionName of permissions) {
          const permission = await prisma.permission.findUnique({
            where: { name: permissionName }
          });

          if (permission) {
            await prisma.rolePermission.upsert({
              where: {
                roleId_permissionId: {
                  roleId: role.id,
                  permissionId: permission.id
                }
              },
              update: {},
              create: {
                roleId: role.id,
                permissionId: permission.id
              }
            });
          }
        }
      }

      console.log('✅ RBAC system initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize RBAC system:', error);
      throw error;
    }
  }

  /**
   * Get user with all roles and permissions
   */
  static async getUserWithRoles(userId: string): Promise<UserWithRoles | null> {
    return await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roleAssignments: {
          where: {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } }
            ]
          },
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    }) as UserWithRoles | null;
  }

  /**
   * Create authentication context from user
   */
  static createAuthContext(user: UserWithRoles | null): AuthContext {
    if (!user) {
      return {
        user: null,
        roles: [],
        permissions: [],
        isAdmin: false,
        isModerator: false,
        level: 0
      };
    }

    const roles = user.roleAssignments.map(ra => ra.role.name);
    const permissions = user.roleAssignments
      .flatMap(ra => ra.role.permissions.map(rp => rp.permission.name));
    
    const level = Math.max(
      ...user.roleAssignments.map(ra => ra.role.level),
      ROLE_LEVELS.USER
    );

    return {
      user,
      roles,
      permissions: [...new Set(permissions)], // Remove duplicates
      isAdmin: level >= ROLE_LEVELS.ADMIN,
      isModerator: level >= ROLE_LEVELS.MODERATOR,
      level
    };
  }

  /**
   * Assign role to user
   */
  static async assignRole(
    userId: string, 
    roleName: string, 
    assignedBy?: string,
    expiresAt?: Date
  ): Promise<void> {
    const role = await prisma.role.findUnique({
      where: { name: roleName }
    });

    if (!role) {
      throw new Error(`Role '${roleName}' not found`);
    }

    await prisma.roleAssignment.create({
      data: {
        userId,
        roleId: role.id,
        assignedBy,
        expiresAt
      }
    });

    // Log the role assignment
    await this.logAction(assignedBy || 'system', 'role_assigned', 'user', userId, {
      role: roleName,
      expiresAt: expiresAt?.toISOString()
    });
  }

  /**
   * Remove role from user
   */
  static async removeRole(userId: string, roleName: string, removedBy?: string): Promise<void> {
    const role = await prisma.role.findUnique({
      where: { name: roleName }
    });

    if (!role) {
      throw new Error(`Role '${roleName}' not found`);
    }

    await prisma.roleAssignment.deleteMany({
      where: {
        userId,
        roleId: role.id
      }
    });

    // Log the role removal
    await this.logAction(removedBy || 'system', 'role_removed', 'user', userId, {
      role: roleName
    });
  }

  /**
   * Check if user has specific permission
   */
  static hasPermission(authContext: AuthContext, permission: string): boolean {
    return authContext.permissions.includes(permission);
  }

  /**
   * Check if user has any of the specified permissions
   */
  static hasAnyPermission(authContext: AuthContext, permissions: string[]): boolean {
    return permissions.some(permission => authContext.permissions.includes(permission));
  }

  /**
   * Check if user has all of the specified permissions
   */
  static hasAllPermissions(authContext: AuthContext, permissions: string[]): boolean {
    return permissions.every(permission => authContext.permissions.includes(permission));
  }

  /**
   * Check if user has required role level
   */
  static hasRoleLevel(authContext: AuthContext, requiredLevel: number): boolean {
    return authContext.level >= requiredLevel;
  }

  /**
   * Get all users with a specific role
   */
  static async getUsersWithRole(roleName: string): Promise<any[]> {
    const role = await prisma.role.findUnique({
      where: { name: roleName },
      include: {
        assignments: {
          include: {
            user: true
          },
          where: {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } }
            ]
          }
        }
      }
    });

    return role?.assignments.map(assignment => assignment.user) || [];
  }

  /**
   * Migrate existing admin users from hardcoded email system
   */
  static async migrateAdminUsers(): Promise<void> {
    console.log('🔄 Migrating admin users from hardcoded system...');
    
    // Get hardcoded admin emails from environment
    const adminEmails = config.ADMIN_EMAILS ? config.ADMIN_EMAILS.split(',') : [];
    
    for (const email of adminEmails) {
      const user = await prisma.user.findUnique({
        where: { email: email.trim() }
      });

      if (user) {
        // Check if user already has admin role
        const existingAssignment = await prisma.roleAssignment.findFirst({
          where: {
            userId: user.id,
            role: {
              name: 'admin'
            }
          }
        });

        if (!existingAssignment) {
          await this.assignRole(user.id, 'admin', 'system');
          console.log(`✅ Assigned admin role to ${email}`);
        }
      }
    }

    console.log('✅ Admin user migration completed');
  }

  /**
   * Log user action for audit trail
   */
  static async logAction(
    userId: string | null,
    action: string,
    resource?: string,
    resourceId?: string,
    details?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        resource,
        resourceId,
        details: details ? JSON.stringify(details) : null,
        ipAddress,
        userAgent
      }
    });
  }

  /**
   * Get audit logs for a user or resource
   */
  static async getAuditLogs(filters: {
    userId?: string;
    resource?: string;
    resourceId?: string;
    action?: string;
    limit?: number;
  } = {}): Promise<any[]> {
    const { limit = 100, ...where } = filters;
    
    return await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });
  }

  /**
   * Clean up expired role assignments
   */
  static async cleanupExpiredRoles(): Promise<void> {
    const deletedCount = await prisma.roleAssignment.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });

    if (deletedCount.count > 0) {
      console.log(`🧹 Cleaned up ${deletedCount.count} expired role assignments`);
    }
  }
}

export default RBACService;
