import { prisma } from '../prisma.js';
import type { Conversation } from '@prisma/client';

export class ConversationRepository {
  /**
   * Persists a new conversation record in PostgreSQL.
   */
  static async create(): Promise<Conversation> {
    return prisma.conversation.create({
      data: {},
    });
  }

  /**
   * Fetches a conversation record by its unique UUID.
   */
  static async findById(id: string): Promise<Conversation | null> {
    return prisma.conversation.findUnique({
      where: { id },
    });
  }
}
