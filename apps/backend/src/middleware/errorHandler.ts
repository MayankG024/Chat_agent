import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import type { ApiErrorResponse } from '@chat-agent/shared';

/**
 * Centralized error handler that formats all errors into a standard format
 * and outputs structured error logs using Pino.
 */
export function errorHandlerMiddleware(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details: unknown = undefined;

  // Classify standard operational errors, Zod validation errors, or fallback to internal server error
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.errorCode;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
  } else if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
    statusCode = 400;
    errorCode = 'INVALID_JSON';
    message = 'The request payload contains malformed or invalid JSON syntax.';
    details = env.NODE_ENV === 'production' ? undefined : { rawMessage: err.message };
  } else if (
    err.name?.startsWith('Prisma') ||
    err.message?.includes('prisma') ||
    err.message?.includes('Prisma')
  ) {
    statusCode = 503;
    errorCode = 'DATABASE_ERROR';
    message = 'The database service is temporarily unavailable or encountered a query error.';
    if (env.NODE_ENV !== 'production') {
      details = {
        name: err.name,
        message: err.message,
        code: (err as any).code,
        meta: (err as any).meta,
      };
    }
  } else {
    // Hide native error details in production to prevent leakage
    message = env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message;
  }

  // Log error using structured Pino logger (mixes in context reqId automatically)
  logger.error({
    err: {
      message: err.message,
      stack: err.stack,
      ...(err instanceof AppError && err.details ? { details: err.details } : {}),
    },
    url: req.originalUrl || req.url,
    method: req.method,
  }, `Error handling request: ${err.message}`);

  const errorResponse: ApiErrorResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      ...(details ? { details } : {}),
    },
  };

  res.status(statusCode).json(errorResponse);
}
