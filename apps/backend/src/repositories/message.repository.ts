import { prisma } from '../prisma.js';
import type { Message } from '@prisma/client';

export interface CreateMessageData {
  conversationId: string;
  sender: string;
  text: string;
}

export class MessageRepository {
  /**
   * Persists a new message in PostgreSQL.
   */
  static async create(data: CreateMessageData): Promise<Message> {
    return prisma.message.create({
      data: {
        conversationId: data.conversationId,
        sender: data.sender,
        text: data.text,
      },
    });
  }

  /**
   * Retrieves messages for a conversation ordered chronologically (oldest first).
   * Supports limiting and paging via cursor.
   */
  static async getRecent(conversationId: string, limit = 50, cursor?: string): Promise<Message[]> {
    return prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      ...(cursor ? {
        skip: 1, // Skip the cursor message itself
        cursor: { id: cursor },
      } : {}),
    });
  }

  /**
   * Retrieves the most recent messages for a conversation, ordered chronologically (oldest first).
   */
  static async getLatest(conversationId: string, limit = 10): Promise<Message[]> {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return messages.reverse();
  }
}

