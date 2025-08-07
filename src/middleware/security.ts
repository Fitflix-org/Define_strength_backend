import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

// Track failed login attempts per IP
const failedAttempts = new Map<string, { count: number; lastAttempt: Date }>();

// Account lockout tracking (use database in production)
const lockedAccounts = new Map<string, Date>();

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Maximum 5 login attempts per window
  message: {
    error: 'Too Many Login Attempts',
    message: 'Too many login attempts, please try again later',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests
  skipSuccessfulRequests: true,
});

export const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // More restrictive for admin routes
  message: {
    error: 'Rate Limit Exceeded',
    message: 'Too many admin requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const trackFailedLogin = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.connection.remoteAddress || '';
  const now = new Date();
  
  // Clean up old attempts (older than 1 hour)
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  for (const [key, value] of failedAttempts.entries()) {
    if (value.lastAttempt < oneHourAgo) {
      failedAttempts.delete(key);
    }
  }
  
  const attempts = failedAttempts.get(ip) || { count: 0, lastAttempt: now };
  
  // If too many failed attempts, block IP
  if (attempts.count >= 10) {
    return res.status(429).json({
      error: 'Too Many Failed Attempts',
      message: 'IP temporarily blocked due to too many failed login attempts',
      retryAfter: '1 hour'
    });
  }
  
  next();
};

export const recordFailedLogin = (ip: string, email?: string) => {
  const now = new Date();
  
  // Track by IP
  const ipAttempts = failedAttempts.get(ip) || { count: 0, lastAttempt: now };
  ipAttempts.count++;
  ipAttempts.lastAttempt = now;
  failedAttempts.set(ip, ipAttempts);
  
  // Track by email (account lockout)
  if (email) {
    const emailKey = `email_${email}`;
    const emailAttempts = failedAttempts.get(emailKey) || { count: 0, lastAttempt: now };
    emailAttempts.count++;
    emailAttempts.lastAttempt = now;
    failedAttempts.set(emailKey, emailAttempts);
    
    // Lock account after 5 failed attempts
    if (emailAttempts.count >= 5) {
      const lockUntil = new Date(now.getTime() + 30 * 60 * 1000); // Lock for 30 minutes
      lockedAccounts.set(email, lockUntil);
    }
  }
};

export const resetFailedLogin = (ip: string, email?: string) => {
  failedAttempts.delete(ip);
  if (email) {
    failedAttempts.delete(`email_${email}`);
    lockedAccounts.delete(email);
  }
};

export const isAccountLocked = (email: string): boolean => {
  const lockUntil = lockedAccounts.get(email);
  if (!lockUntil) return false;
  
  if (new Date() > lockUntil) {
    lockedAccounts.delete(email);
    return false;
  }
  
  return true;
};

// IP whitelist for admin routes
const allowedAdminIps = process.env.ADMIN_IP_WHITELIST?.split(',') || [];

export const adminIpWhitelist = (req: Request, res: Response, next: NextFunction) => {
  // Skip IP check in development
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  
  // If no whitelist is configured, allow all (not recommended for production)
  if (allowedAdminIps.length === 0) {
    console.warn('WARNING: No admin IP whitelist configured for production');
    return next();
  }
  
  const clientIp = req.ip || req.connection.remoteAddress || '';
  
  if (!allowedAdminIps.includes(clientIp)) {
    console.warn(`Blocked admin access attempt from IP: ${clientIp}`);
    return res.status(403).json({
      error: 'Access Denied',
      message: 'Admin access not allowed from this IP address'
    });
  }
  
  next();
};

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Add additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Prevent caching of sensitive data
  if (req.path.includes('/api/admin') || req.path.includes('/api/auth')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
};

// Request logging for security monitoring
export const securityLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length') || '0'
    };
    
    // Log suspicious activity
    if (res.statusCode >= 400) {
      console.warn('Security Alert:', logData);
    }
    
    // Log admin access
    if (req.url.includes('/api/admin')) {
      console.log('Admin Access:', logData);
    }
  });
  
  next();
};
