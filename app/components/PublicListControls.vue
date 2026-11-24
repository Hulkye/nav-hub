<script setup lang="ts">
defineProps<{ subtypes?: Array<{ value: string; label: string }>; showCategory?: boolean }>()
const route = useRoute()
const { text } = useI18n()
const field = (name: string, fallback = '') => typeof route.query[name] === 'string' ? String(route.query[name]) : fallback
const q = ref(field('q'))
const sort = ref(field('sort', 'latest'))
const subtype = ref(field('subtype', 'all'))
const tag = ref(field('tag'))
const category = ref(field('category'))
const pageSize = ref(field('pageSize', '20'))
const { data: tags } = await useFetch<Array<{ slug: string; name: string }>>('/api/public/tags')
const { data: categories } = await useFetch<{ categories: Array<{ slug: string; name: string; parent_id: string | null }> }>('/api/public/categories')
const categoryOptions = computed(() => categories.value?.categories.filter(item => !item.parent_id).map(item => ({ value: item.slug, label: item.name })) ?? [])
watch(() => route.query, () => {
  q.value = field('q'); sort.value = field('sort', 'latest'); subtype.value = field('subtype', 'all'); tag.value = field('tag'); category.value = field('category'); pageSize.value = field('pageSize', '20')
})
</script>

<template>
  <form class="list-controls" :action="route.path" method="get" role="search">
    <label class="keyword-search"><span class="sr-only">{{ text('关键词', 'Keyword') }}</span><AppIcon name="search" :size="18" aria-hidden="true" /><input v-model="q" name="q" type="search" maxlength="120" :placeholder="text('搜索分类内容…', 'Search content…')" /><button type="submit" :aria-label="text('搜索', 'Search')"><AppIcon name="right" :size="16" aria-hidden="true" /></button></label>
    <PublicSelect v-if="subtypes?.length" v-model="subtype" name="subtype" :label="text('类型', 'Type')" :options="[{ value: 'all', label: text('全部类型', 'All types') }, ...subtypes]" />
    <PublicSelect v-model="tag" name="tag" :label="text('标签', 'Tag')" :options="[{ value: '', label: text('全部标签', 'All tags') }, ...(tags ?? []).map(item => ({ value: item.slug, label: item.name }))]" />
    <PublicSelect v-if="showCategory" v-model="category" name="category" :label="text('分类', 'Category')" :options="[{ value: '', label: text('全部分类', 'All categories') }, ...categoryOptions]" />
    <PublicSelect v-model="sort" name="sort" :label="text('排序', 'Sort')" :options="[{ value: 'latest', label: text('最新发布', 'Latest') }, { value: 'updated', label: text('最近更新', 'Updated') }, { value: 'popular', label: text('近 30 天热门', 'Popular in 30 days') }, { value: 'title', label: text('名称', 'Title') }]" />
    <PublicSelect v-model="pageSize" name="pageSize" :label="text('每页条数', 'Page size')" :options="[10, 20, 50].map(size => ({ value: String(size), label: text(`${size} 条 / 页`, `${size} / page`) }))" />
    <div class="filter-actions"><button type="submit" class="apply-filters">{{ text('应用', 'Apply') }}</button><NuxtLink class="reset-filters" :to="route.path">{{ text('重置', 'Reset') }}</NuxtLink></div>
  </form>
</template>

<style scoped>
.list-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin: 20px 0 12px; }
label { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: .8rem; }
.filter-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.keyword-search { display: flex; flex: 1 1 220px; max-width: 320px; min-width: 0; gap: 8px; min-height: 44px; padding: 0 6px 0 14px; border: 1px solid var(--line); border-radius: 999px; background: var(--card); }
.keyword-search input { min-width: 0; width: 100%; padding: 8px 0; border: 0; color: var(--ink); background: transparent; font-size: .9rem; }
.keyword-search button { display: grid; flex: 0 0 36px; width: 36px; min-height: 36px; padding: 0; place-items: center; border-radius: 50%; color: var(--accent-ink); background: var(--accent-soft); }
.apply-filters, .reset-filters { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 8px 12px; border: 0; border-radius: 6px; font-size: .85rem; }
.apply-filters { color: var(--accent-ink); background: var(--accent-soft); }
.reset-filters { color: var(--muted); background: transparent; }
.reset-filters:hover { color: var(--ink); }
@media (max-width: 600px) { .keyword-search { flex-basis: 100%; max-width: none; } .keyword-search input { font-size: 1rem; } .list-controls { gap: 8px 12px; } }
</style>
