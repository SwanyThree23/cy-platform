import { Request, Response, NextFunction } from 'express';
import { ClerkExpressWithAuth } from '@clerk/clerk-sdk-node';

// Setup Clerk middleware
// Note: CLERK_SECRET_KEY must be in environment
export const authMiddleware = ClerkExpressWithAuth({
  // No options needed for basic session validation
});

// Helper component to check if a request is authenticated
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const auth = (req as any).auth;
  
  if (!auth || !auth.userId) {
    return res.status(401).json({ error: 'Unauthorized: No active session' });
  }
  
  // Make sure we have email (Clerk session might need to sync this)
  if (!auth.sessionClaims?.email && !auth.userEmail) {
     // In development or if claims are missing, we might need to fetch full user
     // but for now we'll allow it if userId exists
  }
  
  next();
};

// Optional: More advanced middleware to fetch full user profile from database
// This can be used as a second layer after authMiddleware
export const withCreatorProfile = async (req: Request, res: Response, next: NextFunction) => {
  // Logic already exists in server.ts ensureCreator, but could be moved here
  next();
};
