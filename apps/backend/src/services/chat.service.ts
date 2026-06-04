import crypto from 'crypto';
import { ConversationRepository, MessageRepository } from '../repositories/index.js';
import { CacheService } from './cache.service.js';
import { NvidiaProvider } from './llm.service.js';
import { buildPrompt } from './prompt.service.js';
import { NotFoundError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';
import { runWithRetryAndTimeout } from '../utils/retry.js';
import { fallbackStore } from '../utils/fallbackStore.js';
import { generateLlmFallbackResponse } from '../utils/llmFallback.js';
import type { Message } from '@chat-agent/shared';
import type { Conversation } from '@prisma/client';

export class ChatService {
  private static readonly llmProvider = new NvidiaProvider();

  /**
   * Creates a new conversation and persists it in the database.
   * Falls back to memory-capped store if database is down.
   */
  static async createConversation(): Promise<Conversation> {
    logger.info('Creating new conversation');
    
    try {
      // 1. Try PostgreSQL database first, with retry and timeout protection
      const conversation = await runWithRetryAndTimeout(
        () => ConversationRepository.create(),
        { label: 'CreateConversationDatabase', retries: 2, timeoutMs: 3000 }
      );
      
      // Cache it in Redis (fails-open)
      await CacheService.setConversation(conversation.id, conversation);
      return conversation;
    } catch (error) {
      logger.error(error, 'Database failure while creating conversation. Falling back to Cache & In-Memory Store.');
      
      // 2. Database fails fallback: Generate a new ID and store in Redis and in-memory store
      const fallbackId = crypto.randomUUID();
      const fallbackConv: Conversation = {
        id: fallbackId,
        createdAt: new Date(),
      };
      
      // Cache in Redis (fails-open)
      try {
        await CacheService.setConversation(fallbackId, fallbackConv);
      } catch (cacheError) {
        logger.error(cacheError, 'Failed to save fallback conversation to Redis');
      }
      
      // Store in local in-memory fallback store
      fallbackStore.saveConversation(fallbackId, fallbackConv);
      
      return fallbackConv;
    }
  }

  /**
   * Fetches history for a conversation.
   * Uses Redis cache when available.
   * If not cached, fetches from database with timeout/retry.
   * If database is down, falls back to in-memory fallback cache.
   */
  static async getHistory(conversationId: string, limit = 10): Promise<Message[]> {
    logger.info({ conversationId, limit }, 'Fetching conversation history');

    // 1. Attempt to fetch from Redis cache
    try {
      const cached = await CacheService.getChatHistory(conversationId);
      if (cached) {
        logger.info({ conversationId }, 'Cache hit for conversation history');
        return cached;
      }
    } catch (cacheError) {
      logger.error(cacheError, 'Redis Cache read failed in getHistory');
    }

    logger.info({ conversationId }, 'Cache miss (or Redis failed) for conversation history. Fetching from database');

    // 2. Cache miss: retrieve from PostgreSQL database with retry/timeout protection
    try {
      const dbMessages = await runWithRetryAndTimeout(
        () => MessageRepository.getLatest(conversationId, limit),
        { label: 'GetLatestMessagesDatabase', retries: 1, timeoutMs: 3000 }
      );

      // 3. Map database messages to shared Message interface
      const messages: Message[] = dbMessages.map((msg) => ({
        id: msg.id,
        conversationId: msg.conversationId,
        role: msg.sender as 'user' | 'assistant' | 'system',
        content: msg.text,
        createdAt: msg.createdAt.toISOString(),
      }));

      // 4. Update the Redis cache (fails-open)
      try {
        await CacheService.setChatHistory(conversationId, messages);
      } catch (cacheError) {
        logger.error(cacheError, 'Failed to update Redis cache with message history');
      }

      // 5. Update local fallback cache in case DB or Redis fails next time
      fallbackStore.saveHistory(conversationId, messages);

      return messages;
    } catch (dbError) {
      logger.error(dbError, 'Database failed to fetch message history. Trying local in-memory fallback.');
      
      // 6. Database fails fallback: Try local in-memory fallback store
      const memoryMessages = fallbackStore.getHistory(conversationId);
      if (memoryMessages) {
        logger.info({ conversationId }, 'In-memory fallback hit for conversation history');
        return memoryMessages;
      }

      // If we have absolutely nothing, return an empty array to allow the chat to proceed
      logger.warn({ conversationId }, 'No history found in database, Redis, or in-memory fallback store. Returning empty list.');
      return [];
    }
  }

  /**
   * Processes a user message:
   * - Saves user message to database (or fallback store)
   * - Builds prompt context from history
   * - Calls LLM to generate response (with rule-based fallback if offline)
   * - Saves assistant response to database (or fallback store)
   * - Updates Redis cache and in-memory store
   */
  static async sendMessage(conversationId: string, content: string): Promise<{
    userMessage: Message;
    assistantMessage: Message;
  }> {
    logger.info({ conversationId }, 'Processing new user message');

    // 1. Verify that the conversation exists
    let conversationExists = false;
    try {
      const conversation = await runWithRetryAndTimeout(
        () => ConversationRepository.findById(conversationId),
        { label: 'FindConversationDatabase', retries: 1, timeoutMs: 3000 }
      );
      if (conversation) {
        conversationExists = true;
      }
    } catch (dbError) {
      logger.error(dbError, 'Database failed during findById. Checking Redis and in-memory cache.');
    }

    // Check cache / memory fallback if database search failed or returned null
    if (!conversationExists) {
      try {
        const cachedConv = await CacheService.getConversation(conversationId);
        if (cachedConv) {
          conversationExists = true;
        }
      } catch (cacheError) {
        logger.error(cacheError, 'Failed to fetch conversation from Redis');
      }
      
      if (!conversationExists) {
        const memoryConv = fallbackStore.getConversation(conversationId);
        if (memoryConv) {
          conversationExists = true;
        }
      }
    }

    // Throw standard operational 404 if conversation is completely invalid
    if (!conversationExists) {
      throw new NotFoundError(`Session not found: ${conversationId}`);
    }

    // 2. Fetch history (last 10 messages) using cache if available (uses failover methods internally)
    const history = await ChatService.getHistory(conversationId, 10);

    // 3. Save user message to PostgreSQL with retry/timeout
    let dbUserMsg: any = null;
    try {
      dbUserMsg = await runWithRetryAndTimeout(
        () => MessageRepository.create({
          conversationId,
          sender: 'user',
          text: content,
        }),
        { label: 'CreateUserMessageDatabase', retries: 1, timeoutMs: 3000 }
      );
    } catch (dbError) {
      logger.error(dbError, 'Database failed to save user message. Proceeding with virtual message.');
    }

    const userMessage: Message = {
      id: dbUserMsg?.id || crypto.randomUUID(),
      conversationId,
      role: 'user',
      content,
      createdAt: dbUserMsg?.createdAt?.toISOString() || new Date().toISOString(),
    };

    // 4. Build prompt using promptBuilder
    const llmHistory = history.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
    const promptMessages = buildPrompt(llmHistory, content);

    // 5. Call LLM provider with fallback
    let aiReply = '';
    try {
      aiReply = await this.llmProvider.generateReply(promptMessages);
    } catch (llmError) {
      logger.error(llmError, 'LLM provider failed completely. Generating rule-based fallback response.');
      // LLM fallback responder
      aiReply = generateLlmFallbackResponse(content);
    }

    // 6. Save assistant response to PostgreSQL with retry/timeout
    let dbAssistantMsg: any = null;
    try {
      dbAssistantMsg = await runWithRetryAndTimeout(
        () => MessageRepository.create({
          conversationId,
          sender: 'assistant',
          text: aiReply,
        }),
        { label: 'CreateAssistantMessageDatabase', retries: 1, timeoutMs: 3000 }
      );
    } catch (dbError) {
      logger.error(dbError, 'Database failed to save assistant message. Proceeding with virtual message.');
    }

    const assistantMessage: Message = {
      id: dbAssistantMsg?.id || crypto.randomUUID(),
      conversationId,
      role: 'assistant',
      content: aiReply,
      createdAt: dbAssistantMsg?.createdAt?.toISOString() || new Date().toISOString(),
    };

    // 7. Update Redis cache and local fallback cache
    const updatedHistory = [...history, userMessage, assistantMessage].slice(-10);
    try {
      await CacheService.setChatHistory(conversationId, updatedHistory);
    } catch (cacheError) {
      logger.error(cacheError, 'Failed to update Redis cache with history');
    }
    
    // Always update local fallback cache in case DB or Redis fails next time
    fallbackStore.saveHistory(conversationId, updatedHistory);

    return {
      userMessage,
      assistantMessage,
    };
  }
}
