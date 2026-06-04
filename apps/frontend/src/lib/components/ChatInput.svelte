<script lang="ts">
  export let disabled = false;
  export let onSend: (text: string) => void;

  let inputMessage = '';
  let textareaEl: HTMLTextAreaElement;

  const suggestionPills = [
    { label: 'Refund policy', query: 'What is your refund policy?' },
    { label: 'Standard shipping', query: 'How long does shipping take?' },
    { label: 'Plan pricing', query: 'What are your pricing plans?' },
    { label: 'SDK setup', query: 'How do I install the SDK?' }
  ];

  function handleSubmit() {
    if (!inputMessage.trim() || disabled) return;
    onSend(inputMessage.trim());
    inputMessage = '';
    // Reset textarea height
    if (textareaEl) {
      textareaEl.style.height = 'auto';
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  function autoResize() {
    if (textareaEl) {
      textareaEl.style.height = 'auto';
      textareaEl.style.height = `${Math.min(textareaEl.scrollHeight, 160)}px`;
    }
  }

  function selectSuggestion(query: string) {
    if (disabled) return;
    inputMessage = query;
    if (textareaEl) {
      textareaEl.focus();
      // Wait for DOM to update then resize
      setTimeout(autoResize, 10);
    }
  }
</script>

<footer class="border-t border-slate-800/80 bg-slate-900/40 p-6 backdrop-blur-md">
  <div class="mx-auto max-w-3xl">
    <!-- Suggestion Pills -->
    <div class="flex flex-wrap gap-2 mb-4 justify-start overflow-x-auto pb-1 max-w-full">
      {#each suggestionPills as pill}
        <button
          on:click={() => selectSuggestion(pill.query)}
          disabled={disabled}
          class="text-xs px-3 py-1.5 rounded-full border border-slate-800 bg-slate-950/30 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/30 active:scale-95 disabled:pointer-events-none disabled:opacity-40 transition duration-200 select-none whitespace-nowrap"
        >
          {pill.label}
        </button>
      {/each}
    </div>

    <!-- Message Form -->
    <form on:submit|preventDefault={handleSubmit} class="flex items-end gap-3 bg-slate-950/80 border border-slate-800 rounded-2xl p-2 focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/10 transition duration-200">
      <textarea
        bind:this={textareaEl}
        bind:value={inputMessage}
        on:keydown={handleKeyDown}
        on:input={autoResize}
        placeholder="Type your message here..."
        disabled={disabled}
        rows="1"
        class="flex-1 resize-none bg-transparent pl-3 pr-2 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none disabled:opacity-50 min-h-[38px] max-h-[160px] overflow-y-auto"
      ></textarea>
      
      <button
        type="submit"
        disabled={disabled || !inputMessage.trim()}
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 font-semibold text-white shadow-lg shadow-indigo-600/10 hover:from-indigo-400 hover:to-indigo-600 active:scale-95 disabled:pointer-events-none disabled:opacity-30 transition duration-200"
      >
        <svg class="h-4.5 w-4.5 rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 19V5M5 12l7-7 7 7"/>
        </svg>
      </button>
    </form>
    
    <div class="mt-2 text-center text-[10px] text-slate-500 select-none">
      Responses are simulated with support scenarios. Max input 2,000 characters.
    </div>
  </div>
</footer>
