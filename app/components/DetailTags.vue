<script setup lang="ts">
import type { DetailTag, DiscoveryType } from '#shared/types/discovery'
const props = defineProps<{ type: DiscoveryType; identifier: string }>()
const { data } = await useFetch<{ tags: DetailTag[] }>(() => `/api/public/content/${props.type}/${encodeURIComponent(props.identifier)}/tags`)
</script>

<template>
  <nav v-if="data?.tags.length" aria-label="内容标签" class="detail-tags">
    <NuxtLink v-for="tag in data.tags" :key="tag.id" :to="`/tags/${encodeURIComponent(tag.slug)}`">{{ tag.name }}</NuxtLink>
  </nav>
</template>

<style scoped>
.detail-tags { display: flex; flex-wrap: wrap; gap: 8px; margin: 20px 0; }
.detail-tags a { padding: 10px 14px; border: 1px solid var(--line); border-radius: 999px; color: var(--accent); overflow-wrap: anywhere; max-width: 100%; }
.detail-tags a:hover { background: var(--accent-soft); }
</style>
