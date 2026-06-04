import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import type { 
  CreateSessionResponse, 
  SendMessageRequest, 
  HistoryResponse,
  Message
} from '@chat-agent/shared';

// Load environment variables from root directory
dotenv.config({ path: '../../.env' });

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Basic health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create a session route
app.post('/api/v1/sessions', (req, res) => {
  const response: CreateSessionResponse = {
    sessionId: `sess_${Math.random().toString(36).substring(2, 15)}`,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours expiry
  };
  
  res.status(201).json(response);
});

// Send a message and stream (or return simple mock response)
app.post('/api/v1/sessions/:sessionId/messages', (req, res) => {
  const sessionId = req.params.sessionId;
  const body = req.body as SendMessageRequest;

  if (!body.content) {
    return res.status(400).json({ 
      success: false, 
      error: { code: 'BAD_REQUEST', message: 'Message content is required' } 
    });
  }

  // Set headers for SSE streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let chunkCount = 0;
  const mockText = `Hello! This is a mock stream response for your session ${sessionId}. You said: "${body.content}".`;
  const chunks = mockText.split(' ');

  const interval = setInterval(() => {
    if (chunkCount < chunks.length) {
      res.write(`event: content\ndata: ${JSON.stringify({ text: chunks[chunkCount] + ' ' })}\n\n`);
      chunkCount++;
    } else {
      const doneData = {
        userMessageId: `msg_user_${Math.random().toString(36).substring(2, 9)}`,
        assistantMessageId: `msg_bot_${Math.random().toString(36).substring(2, 9)}`,
        createdAt: new Date().toISOString()
      };
      res.write(`event: done\ndata: ${JSON.stringify(doneData)}\n\n`);
      clearInterval(interval);
      res.end();
    }
  }, 200);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

// Fetch history mock route
app.get('/api/v1/sessions/:sessionId/messages', (req, res) => {
  const sessionId = req.params.sessionId;
  
  const mockMessages: Message[] = [
    {
      id: 'msg_1',
      conversationId: 'conv_1',
      role: 'user',
      content: 'Hello, I need some customer support.',
      createdAt: new Date(Date.now() - 60000).toISOString()
    },
    {
      id: 'msg_2',
      conversationId: 'conv_1',
      role: 'assistant',
      content: 'Sure! I am here to help you. What seems to be the issue?',
      createdAt: new Date(Date.now() - 30000).toISOString()
    }
  ];

  const response: HistoryResponse = {
    messages: mockMessages,
    nextCursor: null
  };

  res.json(response);
});

// Global Error Handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred'
    }
  });
});

app.listen(port, () => {
  console.log(`Backend server is running on http://localhost:${port}`);
});
