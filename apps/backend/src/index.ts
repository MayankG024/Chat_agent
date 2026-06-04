import './config/env.js'; // Must be first to load environment variables
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { prisma } from './prisma.js';
import { redis } from './redis.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { requestContextMiddleware, requestLoggerMiddleware } from './middleware/requestLogger.js';
import { errorHandlerMiddleware } from './middleware/errorHandler.js';
import { validate } from './middleware/validate.js';
import { rateLimiterMiddleware } from './middleware/rateLimiter.js';
import { 
  createSessionSchema, 
  sendMessageSchema, 
  getMessagesSchema,
  chatMessageSchema,
  chatHistorySchema 
} from './validations/chat.validation.js';
import { ConversationRepository, MessageRepository } from './repositories/index.js';
import { ChatService, CacheService } from './services/index.js';
import { NotFoundError } from './errors/AppError.js';
import { runWithRetryAndTimeout } from './utils/retry.js';
import { fallbackStore } from './utils/fallbackStore.js';
import type { 
  CreateSessionResponse, 
  SendMessageRequest, 
  HistoryResponse,
  Message
} from '@chat-agent/shared';

const app = express();
const port = env.PORT;

app.use(cors());
app.use(express.json());
app.use(requestContextMiddleware);
app.use(requestLoggerMiddleware);

app.get('/health', async (req, res) => {
  let dbStatus = 'unhealthy';
  let redisStatus = 'unhealthy';
  let isHealthy = true;

  try {
    // Check Postgres connection by running a simple query with retry & timeout
    await runWithRetryAndTimeout(
      async () => {
        await prisma.$queryRaw`SELECT 1`;
      },
      { label: 'HealthCheckDatabase', retries: 0, timeoutMs: 2000 }
    );
    dbStatus = 'ok';
  } catch (error) {
    logger.error(error, 'Health Check - Database Error');
    dbStatus = `unhealthy: ${(error as Error).message}`;
    isHealthy = false;
  }

  try {
    // Check Redis connection by pinging
    const pingResponse = await redis.ping();
    if (pingResponse === 'PONG') {
      redisStatus = 'ok';
    } else {
      redisStatus = `unhealthy: Unexpected ping response "${pingResponse}"`;
      isHealthy = false;
    }
  } catch (error) {
    logger.error(error, 'Health Check - Redis Error');
    redisStatus = `unhealthy: ${(error as Error).message}`;
    isHealthy = false;
  }

  const response = {
    status: isHealthy ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      redis: redisStatus,
    },
  };

  if (isHealthy) {
    res.json(response);
  } else {
    res.status(503).json(response);
  }
});

// Create a session route with database failure fallback
app.post('/api/v1/sessions', validate(createSessionSchema), async (req, res, next) => {
  try {
    let conversation;
    try {
      conversation = await runWithRetryAndTimeout(
        () => ConversationRepository.create(),
        { label: 'CreateConversationDatabase', retries: 2, timeoutMs: 3000 }
      );
      // Cache it in Redis (fails-open)
      await CacheService.setConversation(conversation.id, conversation);
    } catch (error) {
      logger.error(error, 'Database failure while creating session. Falling back to Cache & In-Memory Store.');
      
      const fallbackId = crypto.randomUUID();
      conversation = {
        id: fallbackId,
        createdAt: new Date(),
      };
      
      try {
        await CacheService.setConversation(fallbackId, conversation);
      } catch (cacheError) {
        logger.error(cacheError, 'Failed to save fallback conversation to Redis');
      }
      fallbackStore.saveConversation(fallbackId, conversation);
    }

    const response: CreateSessionResponse = {
      sessionId: conversation.id,
      status: 'ACTIVE',
      createdAt: conversation.createdAt.toISOString(),
      expiresAt: new Date(conversation.createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString() // 24 hours expiry
    };
    
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

// Send a message and stream (with database / cache resilience)
app.post('/api/v1/sessions/:sessionId/messages', validate(sendMessageSchema), async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId;
    const body = req.body as SendMessageRequest;

    // Verify conversation exists in DB, Redis cache, or In-Memory store
    let conversationExists = false;
    try {
      const conversation = await runWithRetryAndTimeout(
        () => ConversationRepository.findById(sessionId),
        { label: 'FindConversationDatabase', retries: 1, timeoutMs: 3000 }
      );
      if (conversation) {
        conversationExists = true;
      }
    } catch (dbError) {
      logger.error(dbError, 'Database failed during findById in API routes.');
    }

    if (!conversationExists) {
      try {
        const cachedConv = await CacheService.getConversation(sessionId);
        if (cachedConv) {
          conversationExists = true;
        }
      } catch (cacheError) {
        logger.error(cacheError, 'Failed to fetch conversation from Redis');
      }

      if (!conversationExists) {
        const memoryConv = fallbackStore.getConversation(sessionId);
        if (memoryConv) {
          conversationExists = true;
        }
      }
    }

    if (!conversationExists) {
      throw new NotFoundError('Session not found');
    }

    // Save user message in DB (or proceed virtually if database is down)
    let userMsg = null;
    try {
      userMsg = await runWithRetryAndTimeout(
        () => MessageRepository.create({
          conversationId: sessionId,
          sender: 'user',
          text: body.content,
        }),
        { label: 'CreateUserMessageDatabase', retries: 1, timeoutMs: 3000 }
      );
    } catch (dbError) {
      logger.error(dbError, 'Database failed to save user message in API routes.');
    }

    const userMsgId = userMsg?.id || crypto.randomUUID();
    const userMsgCreatedAt = userMsg?.createdAt || new Date();

    // Set headers for SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let chunkCount = 0;
    const mockText = `Hello! This is a mock stream response for your session ${sessionId}. You said: "${body.content}".`;
    const chunks = mockText.split(' ');

    const interval = setInterval(async () => {
      try {
        if (chunkCount < chunks.length) {
          res.write(`event: content\ndata: ${JSON.stringify({ text: chunks[chunkCount] + ' ' })}\n\n`);
          chunkCount++;
        } else {
          // Save assistant message in DB (or proceed virtually if database is down)
          let botMsg = null;
          try {
            botMsg = await runWithRetryAndTimeout(
              () => MessageRepository.create({
                conversationId: sessionId,
                sender: 'assistant',
                text: mockText,
              }),
              { label: 'CreateAssistantMessageDatabase', retries: 1, timeoutMs: 3000 }
            );
          } catch (dbError) {
            logger.error(dbError, 'Database failed to save assistant message in API routes.');
          }

          const botMsgId = botMsg?.id || crypto.randomUUID();
          const botMsgCreatedAt = botMsg?.createdAt || new Date();

          // Update cache & fallback store with these messages
          const userMessage: Message = {
            id: userMsgId,
            conversationId: sessionId,
            role: 'user',
            content: body.content,
            createdAt: userMsgCreatedAt.toISOString(),
          };
          const assistantMessage: Message = {
            id: botMsgId,
            conversationId: sessionId,
            role: 'assistant',
            content: mockText,
            createdAt: botMsgCreatedAt.toISOString(),
          };

          let cachedHistory: Message[] = [];
          try {
            cachedHistory = await CacheService.getChatHistory(sessionId) || [];
          } catch (cacheError) {
            logger.error(cacheError, 'Failed to fetch chat history in SSE route');
          }

          if (cachedHistory.length === 0) {
            const memoryHistory = fallbackStore.getHistory(sessionId);
            if (memoryHistory) {
              cachedHistory = memoryHistory;
            }
          }

          const updatedHistory = [...cachedHistory, userMessage, assistantMessage].slice(-10);
          
          try {
            await CacheService.setChatHistory(sessionId, updatedHistory);
          } catch (cacheError) {
            logger.error(cacheError, 'Failed to update Redis cache history in SSE route');
          }
          fallbackStore.saveHistory(sessionId, updatedHistory);

          const doneData = {
            userMessageId: userMsgId,
            assistantMessageId: botMsgId,
            createdAt: botMsgCreatedAt.toISOString()
          };
          res.write(`event: done\ndata: ${JSON.stringify(doneData)}\n\n`);
          clearInterval(interval);
          res.end();
        }
      } catch (err) {
        clearInterval(interval);
        logger.error(err, 'Error in streaming response creation');
        res.end();
      }
    }, 200);

    req.on('close', () => {
      clearInterval(interval);
      res.end();
    });
  } catch (error) {
    next(error);
  }
});

// Fetch history route (with database / cache resilience)
app.get('/api/v1/sessions/:sessionId/messages', validate(getMessagesSchema), async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId;
    
    // Verify conversation exists
    let conversationExists = false;
    try {
      const conversation = await runWithRetryAndTimeout(
        () => ConversationRepository.findById(sessionId),
        { label: 'FindConversationDatabase', retries: 1, timeoutMs: 3000 }
      );
      if (conversation) {
        conversationExists = true;
      }
    } catch (dbError) {
      logger.error(dbError, 'Database failed to find conversation in api/v1 route.');
    }

    if (!conversationExists) {
      try {
        const cachedConv = await CacheService.getConversation(sessionId);
        if (cachedConv) {
          conversationExists = true;
        }
      } catch (cacheError) {
        logger.error(cacheError, 'Failed to fetch conversation from Redis');
      }

      if (!conversationExists) {
        const memoryConv = fallbackStore.getConversation(sessionId);
        if (memoryConv) {
          conversationExists = true;
        }
      }
    }

    if (!conversationExists) {
      throw new NotFoundError('Session not found');
    }

    // Fetch messages
    let messages: Message[] = [];
    try {
      const dbMessages = await runWithRetryAndTimeout(
        () => MessageRepository.getRecent(sessionId),
        { label: 'GetRecentMessagesDatabase', retries: 1, timeoutMs: 3000 }
      );
      
      messages = dbMessages.map(msg => ({
        id: msg.id,
        conversationId: msg.conversationId,
        role: msg.sender as 'user' | 'assistant' | 'system',
        content: msg.text,
        createdAt: msg.createdAt.toISOString()
      }));
    } catch (dbError) {
      logger.error(dbError, 'Database failed to fetch message history. Trying cache and memory fallbacks.');
      // Try Redis history first, then local fallback store
      try {
        const cached = await CacheService.getChatHistory(sessionId);
        if (cached) {
          messages = cached;
        } else {
          messages = fallbackStore.getHistory(sessionId) || [];
        }
      } catch (cacheError) {
        messages = fallbackStore.getHistory(sessionId) || [];
      }
    }

    const response: HistoryResponse = {
      messages,
      nextCursor: null
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Chat Service routes
app.post('/chat/message', rateLimiterMiddleware, validate(chatMessageSchema), async (req, res, next) => {
  try {
    const { message } = req.body;
    let { sessionId } = req.body;

    if (!sessionId) {
      const conversation = await ChatService.createConversation();
      sessionId = conversation.id;
    }

    const result = await ChatService.sendMessage(sessionId, message);

    res.json({
      reply: result.assistantMessage.content,
      sessionId
    });
  } catch (error) {
    next(error);
  }
});

app.get('/chat/history/:sessionId', rateLimiterMiddleware, validate(chatHistorySchema), async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const messages = await ChatService.getHistory(sessionId);

    res.json({
      messages
    });
  } catch (error) {
    next(error);
  }
});

// Centralized Error Handler
app.use(errorHandlerMiddleware);

app.listen(port, () => {
  logger.info(`Backend server is running on http://localhost:${port}`);
});
