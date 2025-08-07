import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
}

const JWT_SECRET = process.env.JWT_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET + '_refresh';

// Store refresh tokens in memory (use Redis in production)
const refreshTokens = new Set<string>();

export const generateTokens = (payload: TokenPayload) => {
  // Short-lived access token (15 minutes)
  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: '15m',
    issuer: 'fitspace-api',
    audience: 'fitspace-client'
  });

  // Long-lived refresh token (7 days)
  const tokenId = randomBytes(16).toString('hex');
  const refreshToken = jwt.sign(
    { userId: payload.userId, tokenId },
    REFRESH_SECRET,
    {
      expiresIn: '7d',
      issuer: 'fitspace-api',
      audience: 'fitspace-client'
    }
  );

  // Store refresh token
  refreshTokens.add(refreshToken);

  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_SECRET, {
    issuer: 'fitspace-api',
    audience: 'fitspace-client'
  }) as TokenPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  // Check if token exists in store
  if (!refreshTokens.has(token)) {
    throw new Error('Invalid refresh token');
  }

  return jwt.verify(token, REFRESH_SECRET, {
    issuer: 'fitspace-api',
    audience: 'fitspace-client'
  }) as RefreshTokenPayload;
};

export const revokeRefreshToken = (token: string): void => {
  refreshTokens.delete(token);
};

export const revokeAllUserTokens = (userId: string): void => {
  // In production, query database for user's tokens and revoke them
  for (const token of refreshTokens) {
    try {
      const decoded = jwt.decode(token) as RefreshTokenPayload;
      if (decoded && decoded.userId === userId) {
        refreshTokens.delete(token);
      }
    } catch (error) {
      // Invalid token, remove it
      refreshTokens.delete(token);
    }
  }
};

export const cleanupExpiredTokens = (): void => {
  for (const token of refreshTokens) {
    try {
      jwt.verify(token, REFRESH_SECRET);
    } catch (error) {
      // Token is expired or invalid, remove it
      refreshTokens.delete(token);
    }
  }
};

// Cleanup expired tokens every hour
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);
