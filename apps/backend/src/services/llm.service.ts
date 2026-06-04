import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMProvider {
  /**
   * Generates a reply string from the given messages list using the LLM.
   */
  generateReply(messages: LLMMessage[]): Promise<string>;
}

export class NvidiaProvider implements LLMProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor() {
    let rawKey = env.NVIDIA_API_KEY.trim();
    // Strip surrounding quotes if present (e.g. from Render/Vercel ENV inputs)
    if ((rawKey.startsWith('"') && rawKey.endsWith('"')) || (rawKey.startsWith("'") && rawKey.endsWith("'"))) {
      rawKey = rawKey.slice(1, -1).trim();
    }
    // Ensure Bearer prefix is present
    this.apiKey = rawKey.startsWith('Bearer ') ? rawKey : `Bearer ${rawKey}`;
    this.model = env.NVIDIA_MODEL;
    // Base URL for the NVIDIA NIM API chat completions
    this.baseUrl = 'https://integrate.api.nvidia.com/v1';
    // 15 seconds request timeout
    this.timeoutMs = 15000;
    // Up to 3 retry attempts
    this.maxRetries = 3;
  }

  /**
   * Sends a request to the NVIDIA NIM API to generate a chat response.
   * Features timeout enforcement and exponential backoff retry logic.
   */
  async generateReply(messages: LLMMessage[]): Promise<string> {
    let attempts = 0;

    while (attempts < this.maxRetries) {
      attempts++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        logger.info({ model: this.model, messagesCount: messages.length, attempt: attempts }, 'Sending request to NVIDIA NIM API');

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': this.apiKey,
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            max_tokens: 2048,
            temperature: 0.15,
            top_p: 1.00,
            stream: false,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`NVIDIA NIM API responded with ${response.status} ${response.statusText}: ${errorText}`);
        }

        const data = (await response.json()) as {
          choices?: Array<{
            message?: {
              content?: string;
            };
          }>;
        };

        const reply = data.choices?.[0]?.message?.content;
        if (reply === undefined || reply === null) {
          throw new Error('NVIDIA NIM API response structure was invalid or empty');
        }

        logger.info({ model: this.model, durationMs: this.timeoutMs }, 'NVIDIA NIM API reply generated successfully');
        return reply;

      } catch (error: any) {
        clearTimeout(timeoutId);
        
        // Formulate friendly warning logs
        const isAbort = error.name === 'AbortError';
        const errorMsg = isAbort ? `Request timed out after ${this.timeoutMs}ms` : (error.message || error);
        
        logger.warn({ err: errorMsg, attempt: attempts, isAbort }, 'NVIDIA NIM API request attempt failed');

        if (attempts >= this.maxRetries) {
          logger.error({ err: errorMsg }, 'NVIDIA NIM API request exhausted all retry attempts');
          throw new Error(`NVIDIA NIM API failed after ${this.maxRetries} attempts: ${errorMsg}`);
        }

        // Exponential backoff wait (e.g. 2s, 4s...)
        const backoffDelay = Math.pow(2, attempts) * 1000;
        logger.info({ backoffDelayMs: backoffDelay }, `Waiting before retrying NVIDIA NIM API...`);
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      }
    }

    throw new Error(`NVIDIA NIM API request failed after ${this.maxRetries} retries`);
  }
}
