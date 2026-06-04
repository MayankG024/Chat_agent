import { z } from 'zod';
import { sanitizeInput } from '../utils/sanitize.js';

export const createSessionSchema = {
  body: z.object({
    metadata: z.record(z.unknown()).optional(),
  }).optional(),
};

export const sendMessageSchema = {
  params: z.object({
    sessionId: z.string().min(1, 'Session ID is required'),
  }),
  body: z.object({
    content: z.string().transform(sanitizeInput).refine((val) => val.length >= 1, {
      message: 'Message content cannot be empty after sanitization',
    }),
  }),
};

export const getMessagesSchema = {
  params: z.object({
    sessionId: z.string().min(1, 'Session ID is required'),
  }),
};

export const chatMessageSchema = {
  body: z.object({
    message: z.string().transform(sanitizeInput).refine((val) => val.length >= 1, {
      message: 'Message content cannot be empty after sanitization',
    }).refine((val) => val.length <= 2000, {
      message: 'Message cannot exceed 2000 characters',
    }),
    sessionId: z.string().uuid('Session ID must be a valid UUID').optional(),
  }),
};

export const chatHistorySchema = {
  params: z.object({
    sessionId: z.string().uuid('Session ID must be a valid UUID'),
  }),
};

