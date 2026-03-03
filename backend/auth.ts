import { Request, Response, NextFunction } from 'express';

// Mock Clerk Authentication Middleware
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // In a real app, we would use clerk-sdk-node to verify the session
  // For this mock, we'll look for user info in headers or default to a demo creator
  const userId = req.headers['x-clerk-id'] as string || 'user_demo_123';
  const email = req.headers['x-clerk-email'] as string || 'demo@cylive.com';
  
  // Attach user info to request
  (req as any).auth = {
    userId,
    email,
  };
  
  next();
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!(req as any).auth?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};
