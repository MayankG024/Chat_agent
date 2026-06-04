export type MessageRole = 'system' | 'user' | 'assistant';
export interface Message {
    id: string;
    conversationId: string;
    role: MessageRole;
    content: string;
    createdAt: string;
}
export interface Session {
    id: string;
    status: 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
    createdAt: string;
    expiresAt: string;
}
export interface CreateSessionRequest {
    metadata?: {
        userAgent?: string;
        referrer?: string;
        [key: string]: unknown;
    };
}
export interface CreateSessionResponse {
    sessionId: string;
    status: string;
    createdAt: string;
    expiresAt: string;
}
export interface SendMessageRequest {
    content: string;
}
export interface HistoryResponse {
    messages: Message[];
    nextCursor: string | null;
}
export interface ApiErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}
