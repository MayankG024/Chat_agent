import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
pool.on('error', (err) => {
  logger.error(err, 'Unexpected error on idle PostgreSQL client pool');
});
const adapter = new PrismaPg(pool);

export const prisma = globalThis.prisma || new PrismaClient({
  adapter,
  log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

