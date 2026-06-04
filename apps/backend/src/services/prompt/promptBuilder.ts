import type { LLMMessage } from '../llm/llm.provider.js';
import { SUPPORT_SYSTEM_PROMPT } from './supportPrompt.js';

/**
 * Compiles system prompt directives, preceding conversation logs, and the current user message
 * into a single unified array of messages formatted for consumption by LLM providers.
 */
export function buildPrompt(history: LLMMessage[], userMessage: string): LLMMessage[] {
  return [
    { role: 'system', content: SUPPORT_SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userMessage },
  ];
}
