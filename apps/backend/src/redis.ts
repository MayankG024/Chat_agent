import { Redis } from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

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
  console.log('Connecting to Redis server...');
});

redis.on('ready', () => {
  console.log('Redis client is ready and connected successfully.');
});

redis.on('error', (err) => {
  console.error('Redis client error:', err);
});

redis.on('close', () => {
  console.warn('Redis client connection closed.');
});

redis.on('reconnecting', (delay) => {
  console.log(`Redis client reconnecting in ${delay}ms...`);
});

redis.on('end', () => {
  console.error('Redis connection has ended. No more retries.');
});
