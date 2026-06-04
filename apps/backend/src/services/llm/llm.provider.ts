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
