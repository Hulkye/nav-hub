<script setup lang="ts">
import type { DiscoveryItem } from '#shared/types/discovery'
defineProps<{ items: DiscoveryItem[] }>()
const route = useRoute()
const siteSlug = computed(() => /^\/sites\/[^/]+\/?$/.test(route.path) ? String(route.params.slug) : '')
</script>

<template>
  <DetailTags v-if="siteSlug" type="site" :identifier="siteSlug" />
  <section v-if="items.length" aria-labelledby="related-content-title" class="related-content">
    <h2 id="related-content-title">相关推荐</h2>
    <p class="muted">发现拥有相同标签的网站、资源、书影音和文章。</p>
    <DiscoveryResults :items="items" />
  </section>
</template>

<style scoped>
.related-content { margin: 32px 0; }
</style>
