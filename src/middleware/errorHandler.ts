import { Request, Response, NextFunction } from 'express';

interface ErrorWithStatus extends Error {
  status?: number;
  code?: string;
  details?: any;
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
      error: 'Unauthorized',
      message: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token expired'
    });
  }

  // Authorization errors
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  // Prisma errors
  if (err.code === 'P2002') { // Unique constraint error
    return res.status(409).json({
      error: 'Conflict',
      message: 'Resource already exists'
    });
  }

  if (err.code === 'P2025') { // Record not found
    return res.status(404).json({
      error: 'Not Found',
      message: 'Resource not found'
    });
  }

  if (err.code === 'P2003') { // Foreign key constraint error
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid reference to related resource'
    });
  }

  // CORS errors
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'CORS error: Origin not allowed'
    });
  }

  // Rate limit errors
  if (err.status === 429) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.'
    });
  }

  // Default error response
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Something went wrong' 
    : err.message;

  res.status(status).json({
    error: status >= 500 ? 'Internal Server Error' : 'Client Error',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
