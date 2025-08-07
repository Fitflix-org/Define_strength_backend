import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';

// Generic validation middleware factory
export const validate = (schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }

      // Validate query parameters
      if (schema.query) {
        req.query = schema.query.parse(req.query);
      }

      // Validate route parameters
      if (schema.params) {
        req.params = schema.params.parse(req.params);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
          ...(err.code === 'invalid_type' && 'received' in err && { received: err.received })
        }));

        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid input data',
          details: errorMessages
        });
      }

      // If not a Zod error, pass to general error handler
      next(error);
    }
  };
};

// Common validation schemas
export const commonSchemas = {
  // Pagination
  pagination: z.object({
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
    limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 10),
  }).refine(data => data.page > 0, {
    message: "Page must be greater than 0",
    path: ["page"]
  }).refine(data => data.limit > 0 && data.limit <= 100, {
    message: "Limit must be between 1 and 100",
    path: ["limit"]
  }),

  // ID validation
  id: z.object({
    id: z.string().min(1, "ID is required")
  }),

  // Email
  email: z.string().email("Invalid email format").toLowerCase(),

  // Password
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 
      "Password must contain at least one lowercase letter, one uppercase letter, and one number"),

  // Phone number
  phone: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format")
    .optional(),

  // Search query
  search: z.string().min(1).max(100).optional(),

  // Currency amount
  amount: z.number().positive("Amount must be positive"),

  // Quantity
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
};
