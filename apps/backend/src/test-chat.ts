import './loadEnv.js';
import { ChatService } from './services/chat.service.js';
import { prisma } from './prisma.js';
import { redis } from './redis.js';

async function test() {
  console.log('--- Starting ChatService Test ---');
  try {
    // 1. Create a conversation session
    const conversation = await ChatService.createConversation();
    console.log('Created conversation:', conversation);

    // 2. Send user query
    console.log('Sending message...');
    const result = await ChatService.sendMessage(conversation.id, 'What is your shipping policy?');
    console.log('User message saved:', result.userMessage);
    console.log('AI response generated & saved:', result.assistantMessage);

    // 3. Fetch recent history (should trigger Redis cache hit now)
    console.log('Fetching history...');
    const history = await ChatService.getHistory(conversation.id);
    console.log('Fetched history count:', history.length);
    console.log('History details:', JSON.stringify(history, null, 2));

    console.log('--- Test Completed Successfully ---');
  } catch (error) {
    console.error('Test failed with error:', error);
  } finally {
    // Clean up connections
    await prisma.$disconnect();
    redis.disconnect();
  }
}

test();
