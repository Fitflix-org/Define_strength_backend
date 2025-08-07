import { verifyAccessToken } from '../utils/tokenUtils';
import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Access token required' 
    });
  }

  try {
    const decoded = verifyAccessToken(token);
    req.userId = decoded.userId;
    req.user = { 
      id: decoded.userId, 
      email: decoded.email,
      role: decoded.role 
    };
    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        return res.status(401).json({ 
          error: 'Token Expired',
          message: 'Access token has expired, please refresh your token' 
        });
      }
    }
    return res.status(403).json({ 
      error: 'Invalid Token',
      message: 'Invalid or malformed token' 
    });
  }
};
