import { logger } from './logger.js';

interface RetryOptions {
  retries?: number;
  delayMs?: number;
  timeoutMs?: number;
  label?: string;
}

/**
 * Executes a function with a specified timeout and retry attempts using exponential backoff.
 */
export async function runWithRetryAndTimeout<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    retries = 2,
    delayMs = 500,
    timeoutMs = 5000,
    label = 'Operation',
  } = options;

  let attempt = 0;

  while (true) {
    attempt++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error(`${label} timed out after ${timeoutMs}ms`));
          });
        }),
      ]);

      clearTimeout(timeoutId);
      return result;
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      const isTimeout = error.message?.includes('timed out') || error.name === 'AbortError';
      const errorMessage = isTimeout ? `${label} timed out after ${timeoutMs}ms` : (error.message || String(error));
      
      logger.warn(
        { err: errorMessage, attempt, label, retriesRemaining: retries - attempt + 1 },
        `${label} attempt ${attempt} failed`
      );

      if (attempt > retries) {
        logger.error(
          { err: errorMessage, totalAttempts: attempt, label },
          `${label} failed after exhausting all ${attempt} attempts`
        );
        throw error;
      }

      const backoffDelay = delayMs * Math.pow(2, attempt - 1);
      logger.info({ backoffDelayMs: backoffDelay, label }, `Waiting before retrying ${label}...`);
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }
  }
}
