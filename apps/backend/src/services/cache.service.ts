import { redis } from '../redis.js';
import { logger } from '../utils/logger.js';
import type { Message } from '@chat-agent/shared';

export class CacheService {
  /**
   * Fetch conversation from cache.
   * Fails gracefully and returns null if Redis is unavailable.
   */
  static async getConversation(id: string): Promise<any | null> {
    try {
      const data = await redis.get(`conversation:${id}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(error, `Cache Read Error (getConversation:${id})`);
      return null;
    }
  }

  /**
   * Cache conversation data.
   * Fails gracefully on Redis errors.
   */
  static async setConversation(id: string, data: any, ttlSeconds = 3600): Promise<void> {
    try {
      await redis.setex(`conversation:${id}`, ttlSeconds, JSON.stringify(data));
    } catch (error) {
      logger.error(error, `Cache Write Error (setConversation:${id})`);
    }
  }

  /**
   * Invalidate conversation cache.
   */
  static async deleteConversation(id: string): Promise<void> {
    try {
      await redis.del(`conversation:${id}`);
    } catch (error) {
      logger.error(error, `Cache Invalidation Error (deleteConversation:${id})`);
    }
  }

  /**
   * Fetch temporary chat history from cache.
   */
  static async getChatHistory(sessionId: string): Promise<Message[] | null> {
    try {
      const data = await redis.get(`history:${sessionId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(error, `Cache Read Error (getChatHistory:${sessionId})`);
      return null;
    }
  }

  /**
   * Cache temporary chat history messages.
   */
  static async setChatHistory(sessionId: string, messages: Message[], ttlSeconds = 1800): Promise<void> {
    try {
      await redis.setex(`history:${sessionId}`, ttlSeconds, JSON.stringify(messages));
    } catch (error) {
      logger.error(error, `Cache Write Error (setChatHistory:${sessionId})`);
    }
  }

  /**
   * Invalidate chat history cache.
   */
  static async deleteChatHistory(sessionId: string): Promise<void> {
    try {
      await redis.del(`history:${sessionId}`);
    } catch (error) {
      logger.error(error, `Cache Invalidation Error (deleteChatHistory:${sessionId})`);
    }
  }

  /**
   * Atomic sliding-window rate limit checker using Redis transaction pipeline.
   * Returns true if rate limited, false otherwise.
   * Fails open (returns false) if Redis is down to preserve app usability.
   */
  static async isRateLimited(ip: string, limit = 20, windowSeconds = 60): Promise<boolean> {
    const key = `ratelimit:${ip}`;
    try {
      const pipeline = redis.pipeline();
      pipeline.incr(key);
      pipeline.ttl(key);
      
      const results = await pipeline.exec();
      if (!results) {
        return false;
      }

      // results is an array of [err, result] pairs
      const countResult = results[0];
      const ttlResult = results[1];

      if (countResult[0] || ttlResult[0]) {
        logger.error({ err: countResult[0] || ttlResult[0] }, 'Rate Limiter Pipeline Error');
        return false;
      }

      const count = countResult[1] as number;
      const ttl = ttlResult[1] as number;

      // Set expiry on key creation or if it somehow lost its TTL
      if (count === 1 || ttl === -1) {
        await redis.expire(key, windowSeconds);
      }

      return count > limit;
    } catch (error) {
      logger.error(error, `Rate Limiter Connection Error for ${ip}`);
      return false; // Fail open
    }
  }
}
