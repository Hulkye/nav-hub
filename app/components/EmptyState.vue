<script setup lang="ts">
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
</script>

<template>
  <div class="empty-state" :class="{ 'empty-state-compact': compact }" role="status">
    <svg class="coffee-cup" viewBox="0 0 160 128" fill="none" role="img" aria-label="一杯咖啡">
      <path class="coffee-steam" d="M56 35c-8-10 7-12 0-23m21 23c-8-10 7-12 0-23m21 23c-8-10 7-12 0-23" />
      <path class="coffee-line" d="M36 47h78l-7 55c-1 8-8 14-16 14H59c-8 0-15-6-16-14l-7-55Z" />
      <path class="coffee-line" d="M114 57h10c13 0 18 10 14 21-3 8-10 12-22 12M44 102h63m-57 14h50" />
      <path class="coffee-line" d="M37 55c19 7 53 7 76 0" />
      <ellipse class="coffee-fill" cx="76" cy="51" rx="37" ry="5" />
    </svg>
    <slot />
  </div>
</template>

<style scoped>
.coffee-cup { width: min(128px, 60%); height: auto; }
.coffee-line, .coffee-steam { stroke: var(--line); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
.coffee-steam { animation: steam-rise 2.8s ease-in-out infinite; opacity: .4; }
:global(.dark) .coffee-line, :global(.dark) .coffee-steam { stroke: var(--line); }
:global(.dark) .coffee-steam { opacity: .3; }
.coffee-fill { fill: var(--card); stroke: var(--line); stroke-width: 1.5; }
:global(.dark) .coffee-fill { fill: var(--card); stroke: var(--line); }
.empty-state-compact { min-height: 198px; align-content: center; padding: 12px; border: 1px dashed var(--line); border-radius: 10px; }
.empty-state-compact .coffee-cup { width: min(96px, 55%); }
@keyframes steam-rise { 0%, 100% { opacity: .35; transform: translateY(3px); } 50% { opacity: .8; transform: translateY(-3px); } }
@media (prefers-reduced-motion: reduce) { .coffee-steam { animation: none; } }
</style>
