<script setup lang="ts">
import type { PublicPage } from '#shared/schemas/public-list'
defineProps<{ page: PublicPage<unknown> }>()
const route = useRoute()
const { t, text } = useI18n()
const link = (page: number) => ({ path: route.path, query: { ...route.query, page } })
</script>
<template>
  <nav v-if="page.total > page.pageSize || page.page > 1" class="public-pagination" :aria-label="text('内容分页', 'Content pages')">
    <NuxtLink v-if="page.page > 1" :to="link(page.page - 1)">{{ t('common.previous') }}</NuxtLink>
    <span>{{ text(`第 ${page.page} 页 / 共 ${Math.max(1, Math.ceil(page.total / page.pageSize))} 页`, `Page ${page.page} / ${Math.max(1, Math.ceil(page.total / page.pageSize))}`) }}</span>
    <NuxtLink v-if="page.page * page.pageSize < page.total" :to="link(page.page + 1)">{{ t('common.next') }}</NuxtLink>
  </nav>
</template>
<style scoped>
.public-pagination { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 16px; margin: 32px 0; color: var(--muted); }
a { min-height: 44px; padding: 10px 16px; border: 1px solid var(--line); border-radius: 8px; background: var(--card); }
</style>
