<script lang="ts">
  import type { Message } from '@chat-agent/shared';

  export let message: Message;
  export let isStreaming = false;

  const isUser = message.role === 'user';
  
  function formatTime(isoString: string) {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }
</script>

<div class="flex gap-4 w-full {isUser ? 'justify-end' : 'justify-start'} mb-4 items-end animate-bubble-in">
  <!-- Assistant Avatar -->
  {#if !isUser}
    <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 font-bold text-white text-xs shadow-md shadow-indigo-500/20 select-none">
      AI
    </div>
  {/if}

  <!-- Bubble content -->
  <div class="relative max-w-[75%] md:max-w-[70%] rounded-2xl px-5 py-4 shadow-lg transition-all duration-200 {
    isUser
      ? 'bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 text-white rounded-tr-none shadow-indigo-950/20'
      : 'bg-slate-800/80 border border-slate-700/50 backdrop-blur-md text-slate-100 rounded-tl-none shadow-black/10'
  }">
    <div class="whitespace-pre-wrap text-sm leading-relaxed tracking-wide select-text">
      {message.content}
      {#if isStreaming}
        <span class="inline-block w-1.5 h-4 ml-1 bg-cyan-400 animate-pulse align-middle rounded-sm shadow-sm shadow-cyan-400/50"></span>
      {/if}
    </div>

    <!-- Timestamp -->
    <div class="flex items-center gap-1 mt-2 justify-end text-[10px] select-none opacity-40">
      <span>{formatTime(message.createdAt)}</span>
      {#if isUser}
        <!-- Done / Read icon -->
        <svg class="h-3 w-3 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      {/if}
    </div>
  </div>

  <!-- User Avatar (Optional - hidden by default for cleaner layout, can add placeholder if desired) -->
  {#if isUser}
    <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 font-bold text-slate-300 text-xs border border-slate-700/50 select-none">
      ME
    </div>
  {/if}
</div>

<style>
  @keyframes bubbleIn {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  .animate-bubble-in {
    animation: bubbleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
</style>
