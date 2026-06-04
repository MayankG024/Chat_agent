<script lang="ts">
  import { onMount } from 'svelte';
  import type { Message, CreateSessionResponse } from '@chat-agent/shared';

  let sessionId = '';
  let messages: Message[] = [];
  let inputMessage = '';
  let isStreaming = false;
  let currentStreamText = '';
  let chatEndEl: HTMLDivElement;

  const API_BASE = 'http://localhost:4000/api/v1';

  // Automatically scroll to bottom on message updates
  function scrollToBottom() {
    if (chatEndEl) {
      chatEndEl.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // Create session on mount
  onMount(async () => {
    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: { source: 'web_client' } })
      });
      if (res.ok) {
        const data = (await res.json()) as CreateSessionResponse;
        sessionId = data.sessionId;
        
        // Push initial greeting from bot
        messages = [
          {
            id: 'msg_init',
            conversationId: 'default',
            role: 'assistant',
            content: 'Hello! I am your AI support assistant. How can I help you today?',
            createdAt: new Date().toISOString()
          }
        ];
      }
    } catch (e) {
      console.error('Failed to create support session:', e);
    }
  });

  // Handle message submission with SSE streaming
  async function sendMessage() {
    if (!inputMessage.trim() || !sessionId || isStreaming) return;

    const userText = inputMessage;
    inputMessage = '';

    // Add user message to UI
    const userMessage: Message = {
      id: `msg_user_${Date.now()}`,
      conversationId: 'default',
      role: 'user',
      content: userText,
      createdAt: new Date().toISOString()
    };
    messages = [...messages, userMessage];
    setTimeout(scrollToBottom, 50);

    // Prepare streaming state
    isStreaming = true;
    currentStreamText = '';

    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({ content: userText })
      });

      if (!response.ok || !response.body) {
        throw new Error('API returned an error');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last partial line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('event: content')) {
            // Next line will contain data
            continue;
          }

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            try {
              const dataObj = JSON.parse(dataStr);
              if (dataObj.text) {
                currentStreamText += dataObj.text;
                // Force reactivity
                messages = messages;
                setTimeout(scrollToBottom, 20);
              }
            } catch (e) {
              // Ignore parse errors or check for done event
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.userMessageId && parsed.assistantMessageId) {
                  // Stream done event payload
                  messages = [
                    ...messages,
                    {
                      id: parsed.assistantMessageId,
                      conversationId: 'default',
                      role: 'assistant',
                      content: currentStreamText,
                      createdAt: parsed.createdAt || new Date().toISOString()
                    }
                  ];
                  currentStreamText = '';
                }
              } catch (innerErr) {
                // Ignore incomplete structures
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Streaming failed:', err);
      messages = [
        ...messages,
        {
          id: `msg_err_${Date.now()}`,
          conversationId: 'default',
          role: 'assistant',
          content: '⚠️ I encountered an error while processing your request. Please try again.',
          createdAt: new Date().toISOString()
        }
      ];
    } finally {
      isStreaming = false;
      currentStreamText = '';
      setTimeout(scrollToBottom, 50);
    }
  }
</script>

<div class="flex h-screen flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 font-sans">
  <!-- Top header bar -->
  <header class="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-6 py-4 backdrop-blur-md">
    <div class="flex items-center gap-3">
      <div class="h-3 w-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50"></div>
      <h1 class="text-lg font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
        AI Customer Support
      </h1>
    </div>
    <div class="text-xs text-slate-400 font-mono select-all">
      {#if sessionId}
        Session: {sessionId}
      {:else}
        Connecting...
      {/if}
    </div>
  </header>

  <!-- Message log window -->
  <main class="flex-1 overflow-y-auto px-6 py-8 space-y-6">
    <div class="mx-auto max-w-3xl space-y-6">
      {#each messages as msg (msg.id)}
        <div class="flex gap-4 {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
          <!-- Bot Avatar -->
          {#if msg.role !== 'user'}
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 font-semibold text-white shadow-md shadow-indigo-600/30">
              AI
            </div>
          {/if}

          <!-- Message box -->
          <div class="relative max-w-[80%] rounded-2xl px-5 py-3.5 shadow-sm {
            msg.role === 'user'
              ? 'bg-gradient-to-r from-indigo-600 to-brand-600 text-white rounded-tr-none'
              : 'bg-slate-800/80 border border-slate-700/50 backdrop-blur-sm rounded-tl-none'
          }">
            <p class="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
            <span class="absolute bottom-1 right-2 text-[10px] opacity-40 select-none">
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <!-- User Avatar placeholder if needed -->
        </div>
      {/each}

      <!-- Current stream display -->
      {#if isStreaming && currentStreamText}
        <div class="flex gap-4 justify-start">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 font-semibold text-white shadow-md shadow-indigo-600/30">
            AI
          </div>
          <div class="relative max-w-[80%] rounded-2xl px-5 py-3.5 shadow-sm bg-slate-800/80 border border-slate-700/50 backdrop-blur-sm rounded-tl-none">
            <p class="whitespace-pre-wrap text-sm leading-relaxed">{currentStreamText}</p>
            <!-- Animated blinking cursor -->
            <span class="inline-block w-1.5 h-4 ml-0.5 bg-indigo-400 animate-pulse align-middle"></span>
          </div>
        </div>
      {/if}

      <!-- Typing indicator if streaming has started but no content yet -->
      {#if isStreaming && !currentStreamText}
        <div class="flex gap-4 justify-start">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 font-semibold text-white shadow-md shadow-indigo-600/30">
            AI
          </div>
          <div class="flex items-center gap-1.5 rounded-2xl bg-slate-800/80 border border-slate-700/50 px-5 py-3.5 backdrop-blur-sm rounded-tl-none">
            <div class="h-2 w-2 animate-bounce rounded-full bg-slate-400" style="animation-delay: 0ms"></div>
            <div class="h-2 w-2 animate-bounce rounded-full bg-slate-400" style="animation-delay: 150ms"></div>
            <div class="h-2 w-2 animate-bounce rounded-full bg-slate-400" style="animation-delay: 300ms"></div>
          </div>
        </div>
      {/if}

      <div bind:this={chatEndEl}></div>
    </div>
  </main>

  <!-- Input control section -->
  <footer class="border-t border-slate-800/80 bg-slate-900/40 p-6 backdrop-blur-md">
    <div class="mx-auto max-w-3xl">
      <form on:submit|preventDefault={sendMessage} class="flex items-center gap-3">
        <input
          type="text"
          bind:value={inputMessage}
          placeholder="Ask the support assistant..."
          disabled={!sessionId || isStreaming}
          class="flex-1 rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3.5 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 transition"
        />
        <button
          type="submit"
          disabled={!sessionId || isStreaming || !inputMessage.trim()}
          class="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 active:scale-95 disabled:pointer-events-none disabled:opacity-40 transition"
        >
          <svg class="h-5 w-5 rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 19V5M5 12l7-7 7 7"/>
          </svg>
        </button>
      </form>
      <div class="mt-2 text-center text-[10px] text-slate-500">
        AI responses are simulated for demonstrative support queries.
      </div>
    </div>
  </footer>
</div>
