import type { LLMMessage } from './llm.service.js';

export const SUPPORT_KNOWLEDGE = {
  shipping: 'USA 5-7 business days',
  returns: '30-day refund policy',
  supportHours: 'Mon-Fri 9am-6pm EST',
};

export const SUPPORT_SYSTEM_PROMPT = `You are a helpful and professional customer support assistant for our store.
Your goal is to assist customers using only the verified facts from the support knowledge base below.

Support Knowledge Base:
- Shipping: ${SUPPORT_KNOWLEDGE.shipping}
- Returns: ${SUPPORT_KNOWLEDGE.returns}
- Support hours: ${SUPPORT_KNOWLEDGE.supportHours}

Guidelines:
1. Only answer queries using the support knowledge base provided above.
2. If the user asks about something not covered in the knowledge base, politely inform them that you cannot answer that query and advise them to contact support during business hours.
3. Be concise, polite, and helpful.`;

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
