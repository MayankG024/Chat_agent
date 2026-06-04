<script lang="ts">
  import { onMount } from 'svelte';
  import type { Message } from '@chat-agent/shared';
  import SessionStatus from '$lib/components/SessionStatus.svelte';
  import ChatList from '$lib/components/ChatList.svelte';
  import ChatInput from '$lib/components/ChatInput.svelte';

  const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  let sessionId = '';
  let messages: Message[] = [];
  
  // Connection, Streaming & Thinking states
  let isConnecting = false;
  let isThinking = false;
  let isStreaming = false;
  let currentStreamText = '';

  let chatListRef: ChatList;
  let errorMessage = '';

  const INITIAL_GREETING: Message = {
    id: 'msg_init',
    conversationId: 'default',
    role: 'assistant',
    content: 'Hello! I am your AI support assistant. How can I help you today?',
    createdAt: new Date().toISOString()
  };

  // Load session and history on startup
  async function initializeSession() {
    isConnecting = true;
    errorMessage = '';
    isThinking = false;
    isStreaming = false;
    currentStreamText = '';

    // Live mode backend integration
    try {
      const storedSessionId = localStorage.getItem('chat_session_id');
      if (storedSessionId) {
        sessionId = storedSessionId;
        const res = await fetch(`${BACKEND_URL}/chat/history/${sessionId}`);
        
        if (res.ok) {
          const data = await res.json();
          // Backend returns { messages: Message[] }
          if (data && Array.isArray(data.messages)) {
            messages = data.messages;
            if (messages.length === 0) {
              messages = [INITIAL_GREETING];
            }
          } else {
            messages = [INITIAL_GREETING];
          }
        } else if (res.status === 404 || res.status === 400) {
          // If session expired or invalid in database, start fresh
          console.warn('Session expired or not found on server. Starting a new session.');
          localStorage.removeItem('chat_session_id');
          sessionId = '';
          messages = [INITIAL_GREETING];
        } else {
          throw new Error(`Failed to load chat history. Server returned ${res.status}`);
        }
      } else {
        // No session stored yet, start with default greeting
        messages = [INITIAL_GREETING];
      }
    } catch (e) {
      console.error('Error connecting to backend:', e);
      errorMessage = 'Could not load chat history. Showing local sandbox.';
      messages = [
        {
          id: 'error_init',
          conversationId: 'error',
          role: 'assistant',
          content: '⚠️ Unable to connect to the support server. Please make sure the backend is running and reachable.',
          createdAt: new Date().toISOString()
        }
      ];
    } finally {
      isConnecting = false;
      // Scroll to bottom after loading settles
      setTimeout(() => {
        if (chatListRef) chatListRef.scrollToBottom('smooth');
      }, 100);
    }
  }

  // Handle message sending
  async function handleSendMessage(text: string) {
    if (!text.trim() || isStreaming || isThinking || isConnecting) return;

    // Add user message to UI immediately
    const userMessage: Message = {
      id: `user_msg_${Date.now()}`,
      conversationId: sessionId || 'temp',
      role: 'user',
      content: text,
      createdAt: new Date().toISOString()
    };
    messages = [...messages, userMessage];

    // Scroll to bottom
    setTimeout(() => {
      if (chatListRef) chatListRef.scrollToBottom('smooth');
    }, 50);

    // Show loading state (thinking dots) and disable input/send
    isThinking = true;

    // Live mode POST /chat/message call
    try {
      const res = await fetch(`${BACKEND_URL}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId: sessionId || undefined
        })
      });

      if (!res.ok) {
        // Attempt to parse server error payload
        let serverErrorMsg = 'Server error occurred.';
        try {
          const errData = await res.json();
          if (errData && errData.error && errData.error.message) {
            serverErrorMsg = errData.error.message;
          }
        } catch (_) {}
        throw new Error(serverErrorMsg);
      }

      const data = await res.json();
      // Expecting { reply: string, sessionId: string }
      if (data && data.reply) {
        // Save session id if newly generated
        if (data.sessionId && data.sessionId !== sessionId) {
          sessionId = data.sessionId;
          localStorage.setItem('chat_session_id', sessionId);
        }

        const assistantMsg: Message = {
          id: `assistant_msg_${Date.now()}`,
          conversationId: sessionId,
          role: 'assistant',
          content: data.reply,
          createdAt: new Date().toISOString()
        };

        messages = [...messages, assistantMsg];
      } else {
        throw new Error('Invalid response received from server.');
      }
    } catch (err: any) {
      console.error('Failed to send message:', err);
      // Append warning bubble
      const errMsg: Message = {
        id: `err_msg_${Date.now()}`,
        conversationId: sessionId || 'error',
        role: 'assistant',
        content: `⚠️ Failed to receive response: ${err.message || 'Server connection failed.'}`,
        createdAt: new Date().toISOString()
      };
      messages = [...messages, errMsg];
    } finally {
      isThinking = false;
      setTimeout(() => {
        if (chatListRef) chatListRef.scrollToBottom('smooth');
      }, 50);
    }
  }

  // Load session on startup
  onMount(async () => {
    await initializeSession();
  });
</script>

<div class="flex h-screen flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 font-sans antialiased overflow-hidden">
  <!-- Session Header Status -->
  <SessionStatus
    {sessionId}
    {isConnecting}
  />

  {#if isConnecting}
    <!-- Loading workspace skeleton / entry screen -->
    <div class="flex-1 flex flex-col items-center justify-center space-y-4">
      <div class="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500/20 border-t-indigo-500"></div>
      <p class="text-sm text-slate-400 font-mono tracking-wider animate-pulse">
        {sessionId ? 'Loading chat history...' : 'Initializing support environment...'}
      </p>
    </div>
  {:else}
    <!-- Chat List Log Area -->
    <ChatList
      bind:this={chatListRef}
      {messages}
      {isStreaming}
      {isThinking}
      {currentStreamText}
    />
  {/if}

  <!-- Footer control keyboard area -->
  <ChatInput
    disabled={isConnecting || isStreaming || isThinking}
    onSend={handleSendMessage}
  />
</div>
