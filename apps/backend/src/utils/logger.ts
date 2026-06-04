import pino from 'pino';
import { AsyncLocalStorage } from 'async_hooks';
import { env } from '../config/env.js';

export interface RequestContext {
  reqId: string;
}

// Global request context storage for automatic log correlation
export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // Mixin is called on every log statement to automatically merge request context
  mixin() {
    const context = requestContextStorage.getStore();
    return context ? { reqId: context.reqId } : {};
  },
  transport: env.NODE_ENV === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});
export type Logger = typeof logger;
