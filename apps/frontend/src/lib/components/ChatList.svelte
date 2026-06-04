<script lang="ts">
  import { tick } from 'svelte';
  import type { Message } from '@chat-agent/shared';
  import ChatBubble from './ChatBubble.svelte';
  import TypingIndicator from './TypingIndicator.svelte';

  export let messages: Message[] = [];
  export let isStreaming = false;
  export let isThinking = false;
  export let currentStreamText = '';

  let listEl: HTMLElement;
  let showScrollButton = false;
  let isNearBottom = true;

  // Handles smooth scroll to the bottom of the container
  export async function scrollToBottom(behavior: 'auto' | 'smooth' = 'smooth') {
    await tick();
    if (listEl) {
      listEl.scrollTo({
        top: listEl.scrollHeight,
        behavior
      });
      isNearBottom = true;
      showScrollButton = false;
    }
  }

  // Handle scroll events to detect if user has scrolled up
  function handleScroll() {
    if (!listEl) return;
    const { scrollTop, scrollHeight, clientHeight } = listEl;
    // If user is within 150px of the bottom, we consider them at the bottom
    const fromBottom = scrollHeight - scrollTop - clientHeight;
    isNearBottom = fromBottom < 150;
    
    // Show "Scroll to bottom" button if we are not at bottom
    showScrollButton = fromBottom > 300;
  }

  // React to message log changes and stream updates
  $: if (messages && isNearBottom) {
    scrollToBottom('smooth');
  }

  $: if (currentStreamText && isNearBottom) {
    scrollToBottom('auto'); // Use fast auto scroll during streaming
  }

  // If a new message arrives but user is scrolled up, prompt with scroll button
  $: if (messages && !isNearBottom) {
    showScrollButton = true;
  }
</script>

<div class="relative flex-1 min-h-0 w-full flex flex-col">
  <!-- Scrollable Log -->
  <main
    bind:this={listEl}
    on:scroll={handleScroll}
    class="flex-1 overflow-y-auto px-4 md:px-6 py-8 space-y-4"
  >
    <div class="mx-auto max-w-3xl">
      {#each messages as msg (msg.id)}
        <ChatBubble message={msg} />
      {/each}

      <!-- Streaming Assistant bubble -->
      {#if isStreaming && currentStreamText}
        <ChatBubble
          message={{
            id: 'streaming_msg',
            conversationId: 'default',
            role: 'assistant',
            content: currentStreamText,
            createdAt: new Date().toISOString()
          }}
          isStreaming={true}
        />
      {/if}

      <!-- Thinking Indicator -->
      {#if isThinking}
        <TypingIndicator />
      {/if}
      
      <!-- Anchor block -->
      <div class="h-2"></div>
    </div>
  </main>

  <!-- Floating Jump-to-Bottom Button -->
  {#if showScrollButton}
    <button
      on:click={() => scrollToBottom('smooth')}
      class="absolute bottom-4 right-1/2 translate-x-1/2 flex items-center gap-1.5 px-4 py-2 rounded-full bg-indigo-600/90 text-white font-medium text-xs shadow-lg shadow-indigo-600/20 border border-indigo-500/40 backdrop-blur-sm hover:bg-indigo-500 active:scale-95 transition duration-200 animate-bounce-slow"
    >
      <span>Recent activity below</span>
      <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 13l-7 7-7-7m14-6l-7 7-7-7" />
      </svg>
    </button>
  {/if}
</div>

<style>
  @keyframes bounceSlow {
    0%, 100% {
      transform: translate(50%, 0);
    }
    50% {
      transform: translate(50%, -4px);
    }
  }
  .animate-bounce-slow {
    animation: bounceSlow 2s infinite ease-in-out;
  }
</style>
