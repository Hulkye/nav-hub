<script setup lang="ts">
const props = withDefaults(defineProps<{ title: string; iconUrl?: string | null; targetUrl?: string | null; size?: number; loading?: 'lazy' | 'eager' }>(), { size: 28, loading: 'lazy' })
const failedSources = ref<string[]>([])
const sources = computed(() => {
  const result = props.iconUrl ? [props.iconUrl] : []
  if (props.targetUrl) {
    try {
      const target = new URL(props.targetUrl)
      if (['http:', 'https:'].includes(target.protocol) && !target.username && !target.password) {
        result.push(`/api/public/favicon?${new URLSearchParams({ url: target.origin }).toString()}`)
      }
    } catch { /* Invalid destinations have no favicon source. */ }
  }
  return [...new Set(result)]
})
const source = computed(() => sources.value.find(url => !failedSources.value.includes(url)))
watch(() => [props.iconUrl, props.targetUrl], () => { failedSources.value = [] })
function imageFailed(event: Event) {
  const image = event.target
  if (image instanceof HTMLImageElement) {
    const failed = image.getAttribute('src')
    if (failed) failedSources.value.push(failed)
  }
}
</script>

<template>
  <span class="site-icon" aria-hidden="true">
    <img v-if="source" :key="source" :src="source" alt="" :width="size" :height="size" :loading="loading"
      referrerpolicy="no-referrer" @error="imageFailed" />
    <span v-else>{{ Array.from(title.trim())[0]?.toUpperCase() }}</span>
  </span>
</template>

<style scoped>
.site-icon {
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  width: var(--site-icon-size, 40px);
  height: var(--site-icon-size, 40px);
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--site-icon-radius, 10px);
  color: var(--accent-ink);
  background: var(--site-icon-background, var(--accent-soft));
  font: 600 var(--site-icon-font-size, 1.3rem) var(--font-sans);
}

img {
  display: block;
  width: v-bind('`${size}px`');
  height: v-bind('`${size}px`');
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
</style>
