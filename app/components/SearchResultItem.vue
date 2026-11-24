<script setup lang="ts">
import type { SearchDiscoveryItem } from '#shared/schemas/search'

const props = defineProps<{ item: SearchDiscoveryItem; query?: string; label: string; icon: string }>()
const emit = defineEmits<{ select: [item: SearchDiscoveryItem] }>()
const routeForType = { site: 'sites', resource: 'resources', media: 'media', article: 'articles', announcement: 'announcements' } as const
const href = computed(() => `/${routeForType[props.item.type]}/${encodeURIComponent(props.item.slug)}`)
function parts(value: string) {
  const term = props.query?.trim()
  if (!term) return [{ text: value, matched: false }]
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return value.split(new RegExp(`(${escaped})`, 'ig')).filter(Boolean).map(text => ({ text, matched: text.toLowerCase() === term.toLowerCase() }))
}
</script>

<template>
  <NuxtLink :to="href" class="search-result-item" @click="emit('select', item)">
    <span class="item-icon"><SiteIcon v-if="item.type === 'site'" :title="item.title" :icon-url="item.icon_url" :target-url="item.target_url" :size="40" /><AppIcon v-else :name="icon" :size="20" /></span>
    <span class="item-copy"><span class="item-heading"><strong><template v-for="(part, index) in parts(item.title)" :key="`${index}-${part.text}`"><mark v-if="part.matched">{{ part.text }}</mark><span v-else>{{ part.text }}</span></template></strong><small>{{ label }}</small></span><span class="item-description"><template v-for="(part, index) in parts(item.description)" :key="`${index}-${part.text}`"><mark v-if="part.matched">{{ part.text }}</mark><span v-else>{{ part.text }}</span></template></span></span>
    <AppIcon class="item-arrow" name="arrow-up-right" :size="18" />
  </NuxtLink>
</template>

<style scoped>
.search-result-item { display: flex; align-items: center; gap: 14px; min-width: 0; min-height: 88px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 12px; color: var(--ink); background: var(--card); transition: border-color .16s ease, background-color .16s ease, transform .16s ease; }
.search-result-item:hover { border-color: var(--accent); background: var(--accent-soft); transform: translateY(-1px); }
.item-icon { display: grid; flex: 0 0 44px; place-items: center; width: 44px; height: 44px; overflow: hidden; border: 1px solid var(--line); border-radius: 12px; color: var(--accent-ink); background: var(--surface); }
.item-copy { display: grid; flex: 1; min-width: 0; gap: 5px; }
.item-heading { display: flex; align-items: center; gap: 10px; min-width: 0; }
.item-heading strong { min-width: 0; overflow: hidden; font-size: .95rem; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.item-heading small { flex: 0 0 auto; padding: 2px 7px; border-radius: 999px; color: var(--muted); background: var(--surface); font-size: .7rem; }
.item-description { display: -webkit-box; overflow: hidden; color: var(--muted); font-size: .8rem; line-height: 1.6; overflow-wrap: anywhere; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.item-description mark, .item-heading mark { color: var(--accent-ink); background: var(--accent-soft); border-radius: 2px; }
.item-arrow { flex: 0 0 auto; color: var(--muted); }
@media (prefers-reduced-motion: reduce) { .search-result-item { transition: none; } .search-result-item:hover { transform: none; } }
</style>
