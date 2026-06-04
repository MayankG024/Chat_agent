<script lang="ts">
  // No complex state needed for static display, but we can allow custom avatar label or delay
  export let name = 'AI';
</script>

<div class="flex gap-4 justify-start items-end mb-4 animate-fade-in">
  <!-- Avatar -->
  <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 font-bold text-white text-xs shadow-md shadow-indigo-500/20 select-none">
    {name}
  </div>

  <!-- Typing bubbles -->
  <div class="flex items-center gap-1.5 rounded-2xl rounded-tl-none bg-slate-800/80 border border-slate-700/50 px-5 py-4 backdrop-blur-md shadow-lg shadow-black/10">
    <div class="h-2.5 w-2.5 animate-bounce rounded-full bg-cyan-400 opacity-80" style="animation-delay: 0ms; animation-duration: 1s"></div>
    <div class="h-2.5 w-2.5 animate-bounce rounded-full bg-indigo-400 opacity-85" style="animation-delay: 150ms; animation-duration: 1s"></div>
    <div class="h-2.5 w-2.5 animate-bounce rounded-full bg-purple-400 opacity-90" style="animation-delay: 300ms; animation-duration: 1s"></div>
  </div>
</div>

<style>
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .animate-fade-in {
    animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
</style>
