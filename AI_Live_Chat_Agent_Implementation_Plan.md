# AI Live Chat Agent - End-to-End Implementation Plan

## Project Goal
Build a customer support chat application where users interact with an AI support agent through a web chat interface.

## Tech Stack
- Frontend: SvelteKit, TypeScript, TailwindCSS
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL + Prisma
- Cache: Redis
- Validation: Zod
- Logging: Pino
- LLM: NVIDIA NIM API (Llama 3.3 70B Instruct)

## Phases

### Phase 0: Architecture Design
- Design folder structure
- Define API contracts
- Define DB schema
- Define Redis strategy
- Define service layer and request flow

### Phase 1: Repository Initialization
- Create monorepo structure
- Setup frontend/backend/shared packages
- Configure ESLint, Prettier, TypeScript

### Phase 2: Database Layer
- Prisma schema
- Conversation table
- Message table
- Migrations

### Phase 3: Redis Infrastructure
- Redis client
- Cache service
- Conversation cache
- Message cache
- Rate limit storage

### Phase 4: Backend Foundation
- Express setup
- Zod validation
- Pino logging
- Health endpoints
- Error handling

### Phase 5: Repository Layer
- ConversationRepository
- MessageRepository

### Phase 6: LLM Provider Layer
- Provider abstraction
- NVIDIA NIM integration
- Retry and timeout handling

### Phase 7: Prompt Management
- Support prompt
- Knowledge base
- Prompt builder

### Phase 8: Chat Service
- Conversation orchestration
- Persistence
- Prompt building
- LLM calls
- Cache updates

### Phase 9: Chat API
POST /chat/message
GET /chat/history/:sessionId

### Phase 10: Rate Limiting
- Redis-based
- 20 requests/minute/IP

### Phase 11: Frontend Foundation
- Chat UI
- Message bubbles
- Typing indicator
- Auto-scroll

### Phase 12: Frontend Integration
- Backend integration
- Session persistence
- History restoration

### Phase 13: Resilience & Hardening
- Input sanitization
- Failure handling
- Fallbacks

### Phase 14: Testing
- Vitest
- Repository tests
- Service tests
- Route tests

### Phase 15: Documentation
- README
- Setup guide
- API docs
- Architecture docs

## Required Environment Variables

```env
PORT=4000
DATABASE_URL=
REDIS_URL=
NVIDIA_API_KEY=
NODE_ENV=development
```
