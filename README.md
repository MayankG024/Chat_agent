# AI Customer Support Live Chat Agent

A production-grade, highly resilient AI customer support chat application built using a monorepo architecture. It integrates a SvelteKit frontend, an Express backend, PostgreSQL (via Prisma), Redis caching, and the NVIDIA NIM LLM API.

---

## 1. Architecture Overview

The codebase is organized as a monorepo using npm workspaces:

```
├── apps/
│   ├── frontend/     # SvelteKit client interface & Mock Simulator
│   └── backend/      # Express application server
└── packages/
    └── shared/       # Shared TypeScript interfaces & types
```

### Backend Structure (Layers & Modules)

The backend follows a layered, decoupled service architecture designed for performance and extreme resilience:

*   **API / Route Layer (`src/index.ts`)**: Defines endpoint routes for session management, message history, and live chat.
*   **Validation Layer (`src/validations/`)**: Validates query/param/body shapes with Zod schemas. Automatically performs HTML sanitization on text payloads using custom transformer logic.
*   **Middleware Layer (`src/middleware/`)**: Encapsulates rate limiting, request logging with Pino, context tracking via `AsyncLocalStorage`, and centralized error classification.
*   **Service Layer (`src/services/`)**:
    *   `ChatService`: Orchestrates flow between history lookup, prompt compilation, LLM calling, and database/cache persistence.
    *   `CacheService`: Handles Redis storage reads/writes, transactional IP rate limits, and connection monitoring.
    *   `llm.service.ts`: Implements the connection interface and Nvidia NIM API client.
    *   `prompt.service.ts`: Configures support knowledge, system prompt templates, and compiles prompt vectors.
*   **Repository Layer (`src/repositories/`)**: Wraps database client transactions (PostgreSQL via Prisma Client).
*   **Resilience & Fallback Module (`src/utils/`)**:
    *   `retry.ts`: Reusable timeout/exponential backoff wrapper for asynchronous operations.
    *   `fallbackStore.ts`: Local memory-capped store used when database/Redis are unreachable.
    *   `llmFallback.ts`: Keyword-based local backup responder.

### Key Design Decisions

1.  **Multi-Tier Failover (Self-Healing)**:
    *   *Database Down*: Fallback to Redis cache read/writes. If Redis is also offline, fall back to the sliding-window `InMemoryFallbackStore` so users can continue conversing without data-loss during their active session.
    *   *LLM Offline*: If the NVIDIA NIM API is unreachable or times out, the service intercepts the error and routes the query to `llmFallback.ts` to answer common FAQs (billing, pricing, refunds, hours) instead of failing.
2.  **Request Correlation Log Tracking**:
    *   Generates a unique request ID (`reqId`) for every incoming transaction, propagated down all logs using Node's `AsyncLocalStorage` for easy production diagnostics.
3.  **Active Input Sanitization Shield**:
    *   Integrates HTML tag stripping and entity escaping into the Zod parsing pipeline. Malicious scripts or styling hacks are stripped before reaching database repository write calls.

---

## 2. Environment Variables Configuration

Copy `.env.example` in the root directory to `.env` and configure the following variables:

```bash
# Backend server port
PORT=4000
NODE_ENV=development

# Database Settings (PostgreSQL Connection String)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chat_agent?schema=public"

# Cache Settings (Redis Connection URL)
REDIS_URL="redis://localhost:6379"

# NVIDIA NIM API Settings
NVIDIA_API_KEY="your_nvidia_api_key_here"
NVIDIA_MODEL="mistralai/mistral-large-3-675b-instruct-2512"

# Frontend Configuration (Vite API Gateway URL)
VITE_API_URL="http://localhost:4000/api/v1"
```

---

## 3. Database & Local Setup

### Step-by-Step Installation

1.  **Clone and Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Set Up Environment**:
    Create `.env` based on `.env.example` as detailed above.

3.  **Deploy Database migrations**:
    Make sure your PostgreSQL server is running. Then deploy database tables using Prisma:
    ```bash
    npm run db:migrate
    ```

4.  **Generate Prisma Client**:
    ```bash
    npm run db:generate
    ```

5.  **Build Workspaces**:
    Build shared types and the applications:
    ```bash
    npm run build
    ```

6.  **Run Development Servers**:
    To launch both backend and frontend applications concurrently:
    ```bash
    npm run dev
    ```
    *   Frontend runs at: `http://localhost:5173`
    *   Backend API runs at: `http://localhost:4000`

---

## 4. LLM Prompting & System Configuration

### LLM Provider
- **Provider**: NVIDIA NIM API (`https://integrate.api.nvidia.com/v1`).
- **Model**: `mistralai/mistral-large-3-675b-instruct-2512` (by default, configured via `NVIDIA_MODEL`).

### Prompting Strategy
The prompt compiler formats the system directive and the last 10 messages of conversation history.
- **System Directives**: Instructs the agent to act as a customer support assistant.
- **Knowledge-Grounded Retrieval**: Embeds a factual knowledge base directly into the system prompt context:
  - *Shipping Policy*: USA 5-7 business days
  - *Returns Policy*: 30-day refund policy
  - *Support Hours*: Mon-Fri 9am-6pm EST
- **Strict Guidelines**:
  1. Rely exclusively on the embedded facts.
  2. If the query falls outside this dataset (e.g. general knowledge, unrelated product features), politely refuse to answer and redirect them to support.
  3. Respond concisely.

---

## 5. Trade-offs & Future Improvements

### Trade-offs
*   **Memory Eviction Fallback**: The `InMemoryFallbackStore` prevents crashes when the database and Redis fail, but it lives in the application's RAM. If the application server process restarts before database recovery, the active virtual history is lost.
*   **Static LLM Fallback**: The rule-based offline backup responder successfully keeps the chat alive but is limited to simple keyword queries (e.g. refunds, pricing). Complex questions will receive a standard offline notification message.
*   **Simple Request-Response vs Streaming**: The live Express backend chat routes currently use standard JSON HTTP responses for the NVIDIA connection, while the mock simulator supports real-time token streaming.

### If I Had More Time...
*   **SQLite Local Disk Fallback**: Replace the in-memory fallback store with a local file-based SQLite database. This ensures conversation data survives server restarts if PostgreSQL has an extended outage.
*   **Full SSE SSE Chat Stream**: Refactor the live backend endpoint to support Server-Sent Events (SSE) streaming for NVIDIA responses, improving initial user response latency.
*   **Agent Control Dashboard**: Implement a WebSockets-based handover protocol so human customer support agents can take over conversations when the bot signals it cannot resolve a customer query.
