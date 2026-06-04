import type { Message } from '@chat-agent/shared';
import type { Conversation } from '@prisma/client';

export class InMemoryFallbackStore {
  private conversations = new Map<string, Conversation>();
  private histories = new Map<string, Message[]>();
  private readonly MAX_ENTRIES = 1000;

  private evictIfFull() {
    if (this.conversations.size >= this.MAX_ENTRIES) {
      const oldestKey = this.conversations.keys().next().value;
      if (oldestKey !== undefined) {
        this.conversations.delete(oldestKey);
        this.histories.delete(oldestKey);
      }
    }
  }

  saveConversation(id: string, conversation: Conversation) {
    this.evictIfFull();
    this.conversations.set(id, conversation);
  }

  getConversation(id: string): Conversation | null {
    return this.conversations.get(id) || null;
  }

  saveHistory(sessionId: string, messages: Message[]) {
    this.histories.set(sessionId, messages);
  }

  getHistory(sessionId: string): Message[] | null {
    return this.histories.get(sessionId) || null;
  }
}

export const fallbackStore = new InMemoryFallbackStore();
