<script setup lang="ts">
import type { PublicPage } from '#shared/schemas/public-list'
import type { PublicContent } from '#shared/types/public-content'
const route = useRoute()
const { t, text } = useI18n()
const { data, error, status } = await useFetch<PublicPage<PublicContent & { icon_url?: string | null }> & { name: string; description: string; parent_name: string | null; parent_slug: string | null; children: Array<{ id: string; name: string; slug: string }> }>(() => `/api/public/categories/${encodeURIComponent(String(route.params.slug))}`, { query: computed(() => route.query) })
if (error.value?.statusCode === 404) throw createError({ statusCode: 404, statusMessage: '分类不存在' })
useSeoMeta({ title: () => `${data.value?.name ?? '分类'} - NavHub`, description: () => data.value?.description ?? '' })
</script>
<template>
  <section class="content-width page-section category-page">
    <header v-if="data" class="category-header">
      <div class="category-header-content">
        <nav class="category-breadcrumb" :aria-label="text('分类路径', 'Category path')">
          <NuxtLink v-if="data.parent_slug && data.parent_name" :to="{ path: `/categories/${data.parent_slug}`, query: { ...route.query, page: 1 } }">{{ data.parent_name }}</NuxtLink>
          <AppIcon v-if="data.parent_slug" name="right" :size="15" aria-hidden="true" />
          <span aria-current="page">{{ data.name }}</span>
        </nav>
        <nav v-if="data.children.length" class="category-children" :aria-label="text('子分类', 'Subcategories')">
          <NuxtLink v-for="child in data.children" :key="child.id" :to="{ path: `/categories/${child.slug}`, query: { ...route.query, page: 1 } }">{{ child.name }}</NuxtLink>
        </nav>
        <PublicListControls :show-category="false" />
      </div>
    </header>
    <p v-if="error" role="alert" class="form-error">{{ t('common.unavailable') }}</p>
    <p v-else-if="status === 'pending'" role="status">{{ text('正在加载…', 'Loading…') }}</p>
    <template v-else-if="data"><div v-if="data.items.length" class="content-grid site-grid"><DirectorySiteCard v-for="site in data.items" :key="site.id" :site="site" /></div><EmptyState v-else compact>{{ t('common.empty') }}</EmptyState><PublicPagination :page="data" /></template>
  </section>
</template>
<style scoped>
.category-page { padding-top: 0; }
.category-page :deep(.site-card) { background: var(--card); }
.category-page :deep(.site-grid) { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.category-header { position: relative; z-index: 1; isolation: isolate; margin-bottom: 28px; padding-block: 12px 14px; color: var(--hero-ink); }
.category-header::before { position: absolute; z-index: -1; top: 0; bottom: 0; left: 50%; width: 100vw; border-bottom: 1px solid var(--hero-line); background: radial-gradient(ellipse at 86% 0%, color-mix(in srgb, var(--hero-decoration) 70%, transparent), transparent 48%), var(--hero-bg); content: ''; transform: translateX(-50%); }
@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .category-header::before { background: radial-gradient(ellipse at 86% 0%, color-mix(in srgb, var(--hero-decoration) 55%, transparent), transparent 58%), color-mix(in srgb, var(--hero-bg) 72%, transparent); -webkit-backdrop-filter: blur(24px) saturate(130%); backdrop-filter: blur(24px) saturate(130%); box-shadow: inset 0 1px 0 color-mix(in srgb, var(--card) 45%, transparent); }
}
.category-header-content { min-width: 0; }
.category-breadcrumb { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; min-height: 36px; color: var(--hero-muted); font-size: .85rem; overflow-wrap: anywhere; }
.category-breadcrumb a { display: inline-flex; align-items: center; min-height: 44px; color: inherit; text-decoration: none; }
.category-breadcrumb a:hover { color: var(--hero-ink); text-decoration: underline; text-underline-offset: 3px; }
.category-breadcrumb [aria-current="page"] { color: var(--hero-ink); font-weight: 600; }
.category-children { display: flex; flex-wrap: wrap; gap: 4px 24px; }
.category-children a { display: inline-flex; align-items: center; min-height: 40px; padding: 6px 0; color: var(--hero-muted); font-size: .85rem; text-decoration: none; }
.category-children a:hover { color: var(--hero-ink); }
.category-header :deep(.list-controls) { gap: 8px; margin: 12px 0 0; }
.category-header :deep(.keyword-search) { flex: 0 1 260px; border-color: var(--hero-line); background: var(--card); }
.category-header :deep(.public-select .select-trigger) { min-height: 40px; padding: 6px 12px; border-color: var(--hero-line); border-radius: 8px; background: color-mix(in srgb, var(--card) 78%, transparent); font-size: .82rem; }
.category-header :deep(.filter-actions) { gap: 6px; }
.category-header :deep(.apply-filters) { min-height: 40px; padding: 7px 14px; border-radius: 8px; }
.category-header :deep(.reset-filters) { min-height: 40px; }
@media (max-width: 600px) {
  .category-header { margin-bottom: 20px; padding-block: 8px 12px; }
  .category-header :deep(.list-controls) { gap: 8px; }
  .category-header :deep(.keyword-search) { flex-basis: 100%; }
  .category-header :deep(.filter-actions) { margin-left: auto; }
  .category-page :deep(.site-grid) { grid-template-columns: 1fr; }
}
@media (min-width: 601px) and (max-width: 1120px) { .category-page :deep(.site-grid) { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
