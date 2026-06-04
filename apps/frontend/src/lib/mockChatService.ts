import type { Message, CreateSessionResponse } from '@chat-agent/shared';

// Simulated latency configuration (ms)
const THINKING_DELAY = 1000;
const STREAMING_INTERVAL = 70;

const RESPONSES: Record<string, string> = {
  default: `I'm here to help you resolve any issues with your account or order. Could you please provide more details or your order number?`,
  refund: `We offer a 30-day money-back guarantee on all our products. If you are unsatisfied, please provide your order ID, and we can process a full refund to your original payment method.`,
  shipping: `Standard shipping takes 3-5 business days. Express shipping is available and takes 1-2 business days. You can track your package details directly in your profile dashboard under "Orders".`,
  pricing: `Our pricing starts at $15/month for the Starter plan, $49/month for the Professional plan, and custom pricing for Enterprises. Annual billing saves you 20% on any tier!`,
  integration: `To set up our SDK, install the package via npm: \`npm install @chat-agent/client\`. Then, initialize it with your API key from the developer console. Check out our documentation for full code examples.`,
  hours: `Our support team is available 24/7. Response times for the Free tier can take up to 2 hours, while Premium users get priority response in under 15 minutes.`
};

function getResponseForMessage(text: string): string {
  const normalized = text.toLowerCase();
  if (normalized.includes('refund') || normalized.includes('money back') || normalized.includes('return')) {
    return RESPONSES.refund;
  }
  if (normalized.includes('shipping') || normalized.includes('delivery') || normalized.includes('track')) {
    return RESPONSES.shipping;
  }
  if (normalized.includes('pricing') || normalized.includes('cost') || normalized.includes('plan') || normalized.includes('subscription')) {
    return RESPONSES.pricing;
  }
  if (normalized.includes('sdk') || normalized.includes('integration') || normalized.includes('install') || normalized.includes('setup')) {
    return RESPONSES.integration;
  }
  if (normalized.includes('hour') || normalized.includes('time') || normalized.includes('days') || normalized.includes('open')) {
    return RESPONSES.hours;
  }
  return RESPONSES.default;
}

export class MockChatService {
  private static mockHistory: Map<string, Message[]> = new Map();

  static async createSession(): Promise<CreateSessionResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 600));
    const sessionId = `mock_session_${Math.random().toString(36).substring(2, 11)}`;
    const now = new Date().toISOString();
    
    // Store initial assistant greeting
    const initialGreeting: Message = {
      id: `mock_msg_init_${Date.now()}`,
      conversationId: sessionId,
      role: 'assistant',
      content: 'Hello! I am your AI support assistant. How can I help you today?',
      createdAt: now
    };
    this.mockHistory.set(sessionId, [initialGreeting]);

    return {
      sessionId,
      status: 'ACTIVE',
      createdAt: now,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
  }

  static async getHistory(sessionId: string): Promise<Message[]> {
    await new Promise(resolve => setTimeout(resolve, 400));
    return this.mockHistory.get(sessionId) || [];
  }

  /**
   * Simulates the message sending and triggers a callback for each streamed word chunk
   */
  static async sendMessageStream(
    sessionId: string,
    content: string,
    onChunk: (chunk: string) => void,
    onDone: (assistantMsg: Message) => void
  ): Promise<void> {
    const userMsg: Message = {
      id: `mock_msg_user_${Date.now()}`,
      conversationId: sessionId,
      role: 'user',
      content,
      createdAt: new Date().toISOString()
    };

    // Store user message
    const history = this.mockHistory.get(sessionId) || [];
    history.push(userMsg);
    this.mockHistory.set(sessionId, history);

    // Simulate thinking delay
    await new Promise(resolve => setTimeout(resolve, THINKING_DELAY));

    const fullResponse = getResponseForMessage(content);
    
    // Split by words to simulate chunk-by-chunk stream
    const words = fullResponse.split(/(\s+)/); 
    let currentText = '';

    for (let i = 0; i < words.length; i++) {
      await new Promise(resolve => setTimeout(resolve, STREAMING_INTERVAL));
      const chunk = words[i];
      currentText += chunk;
      onChunk(chunk);
    }

    const assistantMsg: Message = {
      id: `mock_msg_assistant_${Date.now()}`,
      conversationId: sessionId,
      role: 'assistant',
      content: currentText,
      createdAt: new Date().toISOString()
    };

    history.push(assistantMsg);
    this.mockHistory.set(sessionId, history);
    
    onDone(assistantMsg);
  }
}
