<script lang="ts">
  export let sessionId = '';
  export let isConnecting = false;
  export let isMockMode = true;
  export let onToggleMode: () => void = () => {};

  let copied = false;

  async function copySessionId() {
    if (!sessionId) return;
    try {
      await navigator.clipboard.writeText(sessionId);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  }
</script>

<header class="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 bg-slate-900/60 px-6 py-4 backdrop-blur-md gap-3 z-10">
  <div class="flex items-center gap-3">
    <!-- Pulse indicator -->
    <div class="relative flex h-3.5 w-3.5">
      {#if isConnecting}
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 shadow-md shadow-amber-500/50"></span>
      {:else if sessionId}
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 shadow-md shadow-emerald-500/50"></span>
      {:else}
        <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-slate-600 shadow-md"></span>
      {/if}
    </div>

    <div>
      <h1 class="text-base font-bold tracking-tight text-slate-100 font-display">
        AI Customer Support
      </h1>
    </div>
  </div>

  <div class="flex flex-wrap items-center gap-3 text-xs">
    <!-- Mode Toggle Button -->
    <button
      on:click={onToggleMode}
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/60 hover:border-indigo-500/50 hover:bg-indigo-950/20 active:scale-95 transition duration-200"
      title="Click to toggle between Mock and Live API mode"
    >
      <span class="h-2 w-2 rounded-full {isMockMode ? 'bg-indigo-400 shadow-sm shadow-indigo-400/50' : 'bg-rose-400 shadow-sm shadow-rose-400/50'}"></span>
      <span class="text-[10px] font-mono uppercase tracking-wider text-slate-300">
        {isMockMode ? 'Mock Simulator' : 'Live Express API'}
      </span>
    </button>

    <!-- Session details -->
    {#if sessionId}
      <button
        on:click={copySessionId}
        class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950/40 font-mono text-[10px] text-slate-400 hover:text-slate-200 hover:border-slate-700 active:scale-98 transition duration-200"
      >
        <span class="truncate max-w-[120px] sm:max-w-[200px]">Session: {sessionId}</span>
        {#if copied}
          <span class="text-emerald-400 text-[9px] font-semibold">Copied!</span>
        {:else}
          <svg class="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
        {/if}
      </button>
    {:else}
      <div class="px-3 py-1.5 rounded-lg bg-slate-950/40 text-slate-500 font-mono text-[10px]">
        Establishing session...
      </div>
    {/if}
  </div>
</header>
