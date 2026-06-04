import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger, requestContextStorage } from '../utils/logger.js';

/**
 * Middleware that establishes a request execution context using AsyncLocalStorage
 * and assigns a unique Request ID (UUID) if not already provided by the client.
 */
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const reqId = (req.headers['x-request-id'] as string) || randomUUID();
  
  // Set X-Request-ID response header
  res.setHeader('x-request-id', reqId);
  
  // Attach request ID to the Express request object
  req.id = reqId;

  // Execute downstream handlers inside the context scope
  requestContextStorage.run({ reqId }, () => {
    next();
  });
}

/**
 * Middleware that logs incoming HTTP requests and their corresponding outgoing responses.
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const url = req.originalUrl || req.url;

  logger.info({
    method: req.method,
    url,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }, `Incoming request: ${req.method} ${url}`);

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const statusCode = res.statusCode;
    const logData = {
      method: req.method,
      url,
      statusCode,
      durationMs,
    };

    const message = `Completed request: ${req.method} ${url} ${statusCode} in ${durationMs}ms`;

    if (statusCode >= 500) {
      logger.error(logData, message);
    } else if (statusCode >= 400) {
      logger.warn(logData, message);
    } else {
      logger.info(logData, message);
    }
  });

  next();
}
