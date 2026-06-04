import { Request, Response, NextFunction } from 'express';
import { CacheService } from '../services/cache.service.js';
import { TooManyRequestsError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

/**
 * Express middleware to enforce IP-based rate limiting (20 requests per minute).
 * Falls open if Redis is down.
 */
export async function rateLimiterMiddleware(req: Request, res: Response, next: NextFunction) {
  // Extract client IP (checking x-forwarded-for header for proxy setups, falling back to remoteAddress)
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  try {
    const isLimited = await CacheService.isRateLimited(ip, 20, 60);
    if (isLimited) {
      logger.warn({ ip }, 'Rate limit exceeded');
      return next(new TooManyRequestsError());
    }
    next();
  } catch (error) {
    // Fail-open strategy to prevent Redis availability issues from blocking user service
    logger.error(error, `Rate limiting check failed for IP: ${ip}`);
    next();
  }
}
