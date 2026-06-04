import { Redis } from 'ioredis';
import { logger } from './utils/logger.js';
import { env } from './config/env.js';

const redisUrl = env.REDIS_URL;

// Configure Redis with auto-reconnection and robust defaults
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    // Retry connection after a delay that increases, capping at 10 seconds
    const delay = Math.min(times * 100, 10000);
    return delay;
  },
});

// Setup event listeners for connection monitoring and debugging
redis.on('connect', () => {
  logger.info('Connecting to Redis server...');
});

redis.on('ready', () => {
  logger.info('Redis client is ready and connected successfully.');
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis client error');
});

redis.on('close', () => {
  logger.warn('Redis client connection closed.');
});

redis.on('reconnecting', (delay: number) => {
  logger.info(`Redis client reconnecting in ${delay}ms...`);
});

redis.on('end', () => {
  logger.error('Redis connection has ended. No more retries.');
});
