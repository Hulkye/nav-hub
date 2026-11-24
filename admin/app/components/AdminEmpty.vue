<script setup lang="ts">
withDefaults(defineProps<{ title?: string; description?: string }>(), {
  title: '故事还未落笔',
  description: '这里留着一片空白，等待下一份灵感抵达。'
})
</script>

<template>
  <div class="empty-scene">
    <svg class="empty-scene__art" viewBox="0 0 360 230" fill="none" aria-hidden="true">
      <ellipse cx="180" cy="198" rx="90" ry="9" fill="currentColor" opacity=".045" />
      <ellipse cx="180" cy="119" rx="132" ry="66" stroke="currentColor" stroke-opacity=".1" stroke-dasharray="3 8" transform="rotate(-16 180 119)" />
      <circle cx="180" cy="109" r="80" fill="currentColor" opacity=".025" />
      <circle cx="180" cy="109" r="103" stroke="currentColor" stroke-opacity=".045" />
      <g class="empty-scene__paper">
        <rect x="123" y="54" width="106" height="132" rx="13" transform="rotate(-12 123 54)" fill="var(--ui-bg-elevated)" stroke="currentColor" stroke-opacity=".14" />
        <path d="M144 49H213L237 73V164C237 171 232 176 225 176H144C137 176 132 171 132 164V61C132 54 137 49 144 49Z" fill="var(--ui-bg)" stroke="currentColor" stroke-opacity=".25" stroke-width="1.5" />
        <path d="M213 49V64C213 69 217 73 222 73H237" fill="var(--ui-bg-elevated)" />
        <path d="M213 49V64C213 69 217 73 222 73H237" stroke="currentColor" stroke-opacity=".22" stroke-width="1.5" />
        <rect x="150" y="77" width="30" height="30" rx="9" fill="currentColor" opacity=".08" />
        <path d="M159 97L165 87L171 97M161 94H169" stroke="currentColor" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M151 123H218M151 134H201M151 145H185" stroke="currentColor" stroke-opacity=".17" stroke-width="3" stroke-linecap="round" />
        <circle cx="229" cy="159" r="20" fill="var(--ui-bg)" stroke="currentColor" stroke-opacity=".2" />
        <path d="M221 159C221 159 224 163 229 163C234 163 237 159 237 159" stroke="currentColor" stroke-opacity=".6" stroke-width="1.7" stroke-linecap="round" />
        <circle cx="224" cy="153" r="1.5" fill="currentColor" opacity=".6" />
        <circle cx="234" cy="153" r="1.5" fill="currentColor" opacity=".6" />
      </g>
      <g class="empty-scene__spark">
        <path d="M271 60V76M263 68H279" stroke="currentColor" stroke-opacity=".65" stroke-width="2" stroke-linecap="round" />
        <path d="M88 132V142M83 137H93" stroke="currentColor" stroke-opacity=".35" stroke-width="1.5" stroke-linecap="round" />
        <circle cx="99" cy="68" r="4" fill="currentColor" opacity=".2" />
        <circle cx="277" cy="146" r="3" fill="currentColor" opacity=".3" />
        <circle cx="245" cy="30" r="2" fill="currentColor" opacity=".25" />
        <path d="M67 106L76 102L73 111" stroke="currentColor" stroke-opacity=".25" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </svg>
    <div class="empty-scene__copy">
      <p class="empty-scene__title">{{ title }}</p>
      <p class="empty-scene__description">{{ description }}</p>
    </div>
    <span class="empty-scene__trail" aria-hidden="true"><i /><i /><i /></span>
  </div>
</template>

<style scoped>
.empty-scene { display: flex; min-height: 380px; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px 36px; white-space: normal; text-align: center; }
.empty-scene__art { width: min(360px, 100%); height: auto; color: var(--ui-primary); overflow: visible; }
.empty-scene__copy { max-width: 360px; margin-top: 4px; }
.empty-scene__title { margin: 0; color: var(--ui-text-highlighted); font-size: 19px; font-weight: 600; letter-spacing: .025em; line-height: 1.5; }
.empty-scene__description { margin: 12px 0 0; color: var(--ui-text-muted); font-size: 14px; line-height: 1.9; text-wrap: pretty; }
.empty-scene__trail { display: flex; gap: 6px; margin-top: 24px; color: var(--ui-primary); }
.empty-scene__trail i { width: 4px; height: 4px; border-radius: 50%; background: currentColor; opacity: .18; }
.empty-scene__trail i:nth-child(2) { opacity: .4; }
.empty-scene__paper { animation: paper-drift 6s ease-in-out infinite; }
.empty-scene__spark { animation: spark-drift 7s ease-in-out infinite; transform-origin: center; }
@keyframes paper-drift { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@keyframes spark-drift { 0%, 100% { opacity: .65; transform: translateY(0); } 50% { opacity: 1; transform: translateY(3px); } }
@media (max-width: 640px) { .empty-scene { min-height: 320px; padding: 28px 16px; } .empty-scene__art { max-width: 280px; } }
@media (prefers-reduced-motion: reduce) { .empty-scene__paper, .empty-scene__spark { animation: none; } }
</style>
