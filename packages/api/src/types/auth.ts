import { Request } from 'express';
import type { UserWithRoles, AuthContext } from '../services/rbac';

export interface AuthenticatedRequest extends Request {
  user?: UserWithRoles | null;
  auth?: AuthContext;
  file?: any;
  files?: any;
}

// Type for requests where we know the user is authenticated
export interface AuthenticatedRequestWithUser extends Request {
  user: UserWithRoles;
  auth: AuthContext;
}

export interface JWTPayload {
  userId: string;
  email: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    stripeAccountId?: string | null;
  };
}
