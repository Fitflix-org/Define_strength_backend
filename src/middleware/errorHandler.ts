import { Request, Response, NextFunction } from 'express';

interface ErrorWithStatus extends Error {
  status?: number;
  code?: string;
  details?: any;
}

// Standardized error codes
// Consolidated error handler
class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export const errorHandler = (
  err: ErrorWithStatus,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error for debugging
  console.error(`Error ${err.status || 500}: ${err.message}`);
  console.error(err.stack);

  // Authorization checks
  if (err instanceof AuthenticationError) return res.status(401).json({
    error: 'Unauthorized',
    message: err.message
  });

  if (err instanceof AuthorizationError) return res.status(403).json({
    error: 'Forbidden',
    message: err.message
  });

  // Mongoose/Prisma validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      details: err.details
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid Token',
      message: 'Your session has expired. Please log in again.'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Expired Token',
      message: 'Your session has expired. Please log in again.'
    });
  }

  // Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    // Handle specific Prisma errors
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A record with this information already exists.'
      });
    }
    
    if (err.code === 'P2025') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found.'
      });
    }

    return res.status(400).json({
      error: 'Database Error',
      message: 'An error occurred while processing your request.'
    });
  }

  // CORS errors
  if (err.name === 'CORSError') {
    return res.status(403).json({
      error: 'CORS Error',
      message: 'Cross-Origin Request Blocked'
    });
  }

  // Rate limit errors
  if (err.name === 'RateLimitError') {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Please try again later.'
    });
  }

  // Default error response
  const statusCode = err.status || 500;
  const errorMessage = statusCode === 500 
    ? 'An unexpected error occurred' 
    : err.message;

  res.status(statusCode).json({
    error: statusCode === 500 ? 'Server Error' : 'Request Error',
    message: errorMessage
  });
};
