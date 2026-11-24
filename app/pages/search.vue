<script setup lang="ts">
import type { SearchDiscovery } from '../../shared/schemas/search'
import { addSearchHistory, readSearchHistory, searchHistoryKey } from '../../shared/utils/search-discovery'
const route = useRoute()
const { t, text } = useI18n()
const query = computed(() => String(route.query.q ?? '').trim())
const selectedType = computed(() => String(route.query.type ?? 'all'))
const selectedTag = computed(() => String(route.query.tag ?? ''))
const selectedCategory = computed(() => String(route.query.category ?? ''))
const selectedSort = computed(() => String(route.query.sort ?? 'relevance'))
const page = computed(() => Number(route.query.page ?? 1))
const draft = ref(query.value)
const history = ref<string[]>([])
const discovery = ref<SearchDiscovery | null>(null)
const suggesting = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let requestVersion = 0
async function loadDiscovery() {
  const version = ++requestVersion
  suggesting.value = true
  try {
    const result = await $fetch<SearchDiscovery>('/api/public/search/discovery', { query: { q: draft.value, type: selectedType.value, tag: selectedTag.value, category: selectedCategory.value, sort: selectedSort.value } })
    if (version === requestVersion) discovery.value = result
  } catch { if (version === requestVersion) discovery.value = null }
  finally { if (version === requestVersion) suggesting.value = false }
}
watch([draft, selectedType, selectedTag, selectedCategory, selectedSort], () => {
  clearTimeout(timer)
  requestVersion++
  discovery.value = null
  timer = setTimeout(loadDiscovery, 250)
})
watch(query, value => { draft.value = value })
onBeforeUnmount(() => { clearTimeout(timer); requestVersion++ })
function remember(term: string, resultCount = 0) {
  if (term.trim().length < 2 || term.length > 120) return
  history.value = addSearchHistory(history.value, term)
  try { localStorage.setItem(searchHistoryKey, JSON.stringify(history.value)) } catch { /* Storage may be disabled. */ }
  void $fetch('/api/public/search/record', { method: 'POST', body: { q: term, type: selectedType.value, resultCount } }).catch(() => {})
}
function clearHistory() {
  history.value = []
  try { localStorage.removeItem(searchHistoryKey) } catch { /* Storage may be disabled. */ }
}
function searchLink(term: string) { return { path: '/search', query: { q: term, type: selectedType.value, tag: selectedTag.value || undefined, category: selectedCategory.value || undefined, sort: selectedSort.value === 'relevance' ? undefined : selectedSort.value } } }
onMounted(() => {
  try { history.value = readSearchHistory(localStorage.getItem(searchHistoryKey)) } catch { history.value = [] }
  void loadDiscovery()
  if (page.value === 1) remember(query.value)
})
watch(query, term => { if (import.meta.client && page.value === 1) remember(term, data.value?.total ?? 0) })
const contentRoutes = { site: 'sites', resource: 'resources', media: 'media', article: 'articles', announcement: 'announcements' } as const
const contentLabels = computed(() => ({ site: text('网站', 'Websites'), resource: t('nav.resources'), media: t('nav.media'), article: t('nav.articles'), announcement: t('nav.announcements') }))
const contentIcons = { site: 'home', resource: 'all', media: 'book', article: 'article', announcement: 'category' } as const
const filters = computed(() => [{ value: 'all', label: t('common.all'), icon: 'search' }, ...Object.entries(contentLabels.value).map(([value, label]) => ({ value, label, icon: contentIcons[value as SearchType] }))])
type SearchType = keyof typeof contentRoutes
const { data, error, status } = await useFetch<{ query: string; matchedQuery?: string; total: number; pageSize: number; results: Array<{ id: string; title: string; slug: string; description: string; type: SearchType }> }>('/api/public/search', { query: computed(() => ({ q: query.value, type: selectedType.value, tag: selectedTag.value || undefined, category: selectedCategory.value || undefined, sort: selectedSort.value, page: page.value })) })
watch([query, selectedType, selectedTag, selectedCategory, selectedSort], () => { if (import.meta.client && query.value.length >= 2) remember(query.value, data.value?.total ?? 0) })
function pageLink(value: number) { return { path: '/search', query: { q: query.value, type: selectedType.value, tag: selectedTag.value || undefined, category: selectedCategory.value || undefined, sort: selectedSort.value === 'relevance' ? undefined : selectedSort.value, page: value } } }
function filterLink(key: 'tag' | 'category', value: string) { return { path: '/search', query: { q: query.value, type: selectedType.value, tag: key === 'tag' ? (selectedTag.value === value ? undefined : value) : selectedTag.value || undefined, category: key === 'category' ? (selectedCategory.value === value ? undefined : value) : selectedCategory.value || undefined, sort: selectedSort.value === 'relevance' ? undefined : selectedSort.value } } }
function recordClick(result: { id: string; type: SearchType }) { void $fetch('/api/public/search/click', { method: 'POST', body: { q: query.value, type: selectedType.value, contentType: result.type } }).catch(() => {}) }
function highlightParts(textValue: string) {
  const term = query.value.trim()
  if (!term) return [{ text: textValue, matched: false }]
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return textValue.split(new RegExp(`(${escaped})`, 'ig')).filter(Boolean).map(text => ({ text, matched: text.toLowerCase() === term.toLowerCase() }))
}
</script>

<template>
  <div class="search-page">
    <section class="search-hero home-hero">
      <div class="search-hero-inner content-width">
        <p class="search-eyebrow"><AppIcon name="all" :size="16" />{{ text('让每一次寻找，都有收获', 'A little curiosity goes a long way') }}</p>
        <h1>{{ text('你的下一个好发现，', 'Find something useful.') }}<span>{{ text('从这里开始。', 'Start here.') }}</span></h1>
        <p class="search-intro">{{ text('网站、实用资源与灵感内容，一个关键词就能找到。', 'Discover websites, useful resources and fresh inspiration in one search.') }}</p>
        <SearchBox v-model="draft" input-id="search-query" :content-type="selectedType" :minlength="2" multi-source :placeholder="text('想找点什么？输入名称、关键词…', 'What are you looking for? Enter a name or keyword…')" />
        <nav class="search-filters" :aria-label="text('按内容类型搜索', 'Search by content type')"><NuxtLink v-for="filter in filters" :key="filter.value" :to="{ path: '/search', query: { q: draft.trim(), type: filter.value, tag: selectedTag || undefined, category: selectedCategory || undefined, sort: selectedSort === 'relevance' ? undefined : selectedSort } }" :class="{ selected: selectedType === filter.value }" :aria-current="selectedType === filter.value ? 'true' : undefined"><AppIcon :name="filter.icon" :size="17" />{{ filter.label }}</NuxtLink></nav>
      </div>
    </section>
    <div class="search-body content-width">
      <section v-if="draft !== query && draft.trim().length >= 2 && discovery && (discovery.suggestions.length || discovery.results.length)" class="suggestion-panel">
        <h2>{{ text('搜索建议', 'Search suggestions') }}</h2><div v-if="discovery.suggestions.length" class="search-chips"><NuxtLink v-for="term in discovery.suggestions" :key="term" :to="searchLink(term)"><AppIcon name="search" :size="15" />{{ term }}</NuxtLink></div>
        <div v-if="discovery.results.length" class="result-grid instant-grid"><SearchResultItem v-for="item in discovery.results" :key="`${item.type}-${item.id}`" :item="item" :query="draft" :label="contentLabels[item.type]" :icon="contentIcons[item.type]" /></div>
      </section>
      <div v-if="history.length || discovery?.popular.length" class="search-discovery">
        <section v-if="history.length" class="discovery-section"><div class="discovery-heading"><h2>{{ text('最近搜索', 'Recent searches') }}</h2><button type="button" @click="clearHistory">{{ text('清空历史', 'Clear history') }}</button></div><div class="search-chips"><NuxtLink v-for="term in history" :key="term" :to="searchLink(term)">{{ term }}<AppIcon name="arrow-up-right" :size="14" /></NuxtLink></div></section>
        <section v-if="discovery?.popular.length" class="discovery-section"><div class="discovery-heading"><h2>{{ text('大家都在搜', 'Popular searches') }}</h2><AppIcon name="search" :size="17" /></div><div class="search-chips"><NuxtLink v-for="term in discovery.popular" :key="term" :to="searchLink(term)">{{ term }}<AppIcon name="arrow-up-right" :size="14" /></NuxtLink></div></section>
      </div>
      <p v-if="suggesting && draft !== query" role="status" class="suggestion-status">{{ text('正在查找相关内容…', 'Finding suggestions…') }}</p>
      <p v-if="error" class="search-state form-error" role="alert">{{ t('common.unavailable') }}</p>
      <section v-else-if="query.length >= 2" class="search-result-section" :aria-busy="status === 'pending'" aria-labelledby="search-results-heading">
        <div class="results-heading"><h2 id="search-results-heading">{{ text('搜索结果', 'Search results') }}</h2><p role="status">{{ status === 'pending' ? text('正在搜索…', 'Searching…') : text(`“${query}” · ${data?.total ?? 0} 条结果`, `“${query}” · ${data?.total ?? 0} results`) }}</p></div>
        <div class="search-controls">
          <UFormField :label="text('标签', 'Tag')"><USelect :model-value="selectedTag || 'all'" :items="[{ label: text('全部标签', 'All tags'), value: 'all' }, ...(discovery?.tags ?? []).map(tag => ({ label: `${tag.name} (${tag.count})`, value: tag.slug }))]" class="min-w-40" @update:model-value="(value: string) => navigateTo({ path: '/search', query: { q: query, type: selectedType, category: selectedCategory || undefined, tag: value === 'all' ? undefined : value, sort: selectedSort === 'relevance' ? undefined : selectedSort } })" /></UFormField>
          <UFormField :label="text('分类', 'Category')"><USelect :model-value="selectedCategory || 'all'" :items="[{ label: text('全部分类', 'All categories'), value: 'all' }, ...(discovery?.categories ?? []).map(category => ({ label: `${category.name} (${category.count})`, value: category.slug }))]" class="min-w-44" @update:model-value="(value: string) => navigateTo({ path: '/search', query: { q: query, type: selectedType, tag: selectedTag || undefined, category: value === 'all' ? undefined : value, sort: selectedSort === 'relevance' ? undefined : selectedSort } })" /></UFormField>
          <UFormField :label="text('排序', 'Sort')"><USelect :model-value="selectedSort" :items="[{ label: text('相关度', 'Relevance'), value: 'relevance' }, { label: text('热度', 'Popularity'), value: 'popular' }, { label: text('最新', 'Latest'), value: 'latest' }]" class="min-w-32" @update:model-value="(value: string) => navigateTo({ path: '/search', query: { q: query, type: selectedType, tag: selectedTag || undefined, category: selectedCategory || undefined, sort: value === 'relevance' ? undefined : value } })" /></UFormField>
        </div>
        <div v-if="selectedTag || selectedCategory" class="active-filters"><NuxtLink v-if="selectedTag" :to="filterLink('tag', selectedTag)" class="filter-chip">{{ discovery?.tags.find(tag => tag.slug === selectedTag)?.name ?? selectedTag }} ×</NuxtLink><NuxtLink v-if="selectedCategory" :to="filterLink('category', selectedCategory)" class="filter-chip">{{ discovery?.categories.find(category => category.slug === selectedCategory)?.name ?? selectedCategory }} ×</NuxtLink></div>
        <p v-if="data?.matchedQuery" class="muted">{{ text(`已使用“${data.matchedQuery}”查找相关结果。`, `Showing related results for “${data.matchedQuery}”.`) }}</p>
        <div v-if="data && data.total === 0 && status !== 'pending'" class="search-state"><span class="state-icon"><AppIcon name="search" :size="28" /></span><h3>{{ text('暂时没有找到相关内容', 'No matches just yet') }}</h3><p>{{ text('试试更简短的关键词，或切换上方的内容分类。', 'Try a shorter keyword or a different content type above.') }}</p><div v-if="discovery?.suggestions.length" class="search-chips"><NuxtLink v-for="term in discovery.suggestions" :key="term" :to="searchLink(term)">{{ term }}</NuxtLink></div></div>
        <div class="result-grid"><SearchResultItem v-for="result in data?.results" :key="`${result.type}-${result.id}`" :item="result" :query="query" :label="contentLabels[result.type]" :icon="contentIcons[result.type]" @select="recordClick" /></div>
        <section v-if="data?.total === 0 && discovery" class="search-recommendations">
          <h2>{{ text('试试按分类发现', 'Explore by category') }}</h2><div class="search-chips"><NuxtLink v-for="category in discovery.categories.slice(0, 8)" :key="category.id" :to="{ path: '/search', query: { q: query, type: 'site', category: category.slug } }">{{ category.name }}<span>{{ category.count }}</span></NuxtLink></div>
          <h2 class="recommend-heading">{{ text('热门标签', 'Popular tags') }}</h2><div class="search-chips"><NuxtLink v-for="tag in discovery.tags.slice(0, 8)" :key="tag.slug" :to="{ path: '/search', query: { q: query, type: selectedType, tag: tag.slug } }">{{ tag.name }}<span>{{ tag.count }}</span></NuxtLink></div>
          <h2 class="recommend-heading">{{ text('也可以看看', 'You may also like') }}</h2><div class="result-grid instant-grid"><SearchResultItem v-for="item in discovery.recommendations" :key="`${item.type}-${item.id}`" :item="item" :query="query" :label="contentLabels[item.type]" :icon="contentIcons[item.type]" /></div>
        </section>
        <nav v-if="data && data.total > data.pageSize" :aria-label="text('搜索结果分页', 'Search result pages')" class="search-pagination"><NuxtLink v-if="page > 1" :to="pageLink(page - 1)"><AppIcon name="right" class="previous-icon" :size="16" />{{ t('common.previous') }}</NuxtLink><span>{{ text(`第 ${page} 页 / 共 ${Math.ceil(data.total / data.pageSize)} 页`, `Page ${page} / ${Math.ceil(data.total / data.pageSize)}`) }}</span><NuxtLink v-if="page * data.pageSize < data.total" :to="pageLink(page + 1)">{{ t('common.next') }}<AppIcon name="right" :size="16" /></NuxtLink></nav>
      </section>
      <div v-else class="search-state search-welcome"><span class="state-icon"><AppIcon name="search" :size="28" /></span><h2>{{ text('好内容，等你来发现', 'Something good is waiting') }}</h2><p>{{ text('输入至少两个字符，或点击上方关键词开始探索。', 'Enter at least two characters, or choose a keyword above.') }}</p></div>
    </div>
  </div>
</template>

<style scoped>
.search-hero { border-bottom: 1px solid var(--hero-line); background: var(--hero-bg); }
.search-hero-inner { position: relative; z-index: 1; padding-block: 48px 32px; text-align: center; }
.search-eyebrow { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 0 0 16px; color: var(--hero-muted); font-size: .8rem; }
.search-hero h1 { max-width: none; color: var(--hero-ink); font-size: clamp(1.8rem, 3.4vw, 3rem); font-weight: 750; letter-spacing: -.04em; }
.search-hero h1 span { color: var(--accent); }
.search-intro { margin: 16px 0 28px; color: var(--hero-muted); font-size: .9rem; }
.search-filters { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; margin-top: 24px; }
.search-filters a { display: inline-flex; align-items: center; gap: 7px; min-height: 44px; padding: 8px 16px; border: 1px solid transparent; border-radius: 8px; color: var(--hero-muted); font-size: .85rem; }
.search-filters a:hover { color: var(--accent-ink); background: var(--accent-soft); }
.search-filters a.selected { border-color: var(--hero-line); color: var(--accent-ink); background: var(--card); font-weight: 650; }
.search-body { padding-block: 28px 64px; }
.search-discovery { display: grid; gap: 12px; margin-bottom: 24px; }
.discovery-section { display: flex; align-items: center; gap: 14px; min-width: 0; }
.suggestion-panel { min-width: 0; padding: 16px 20px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
.discovery-heading { display: flex; flex: 0 0 auto; align-items: center; gap: 10px; }
.discovery-heading h2 { color: var(--muted); font-size: .78rem; font-weight: 600; white-space: nowrap; }
.suggestion-panel h2 { font-size: .95rem; }
.discovery-heading button { min-height: 32px; padding: 0 4px; color: var(--muted); background: transparent; font-size: .72rem; font-weight: 400; white-space: nowrap; }
.discovery-heading button:hover { color: var(--accent); }
.search-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.search-chips a { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; max-width: 100%; padding: 5px 10px; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); background: var(--surface); font-size: .76rem; overflow-wrap: anywhere; }
.search-chips a:hover { border-color: var(--accent); color: var(--accent-ink); background: var(--accent-soft); }
.suggestion-panel { margin-bottom: 24px; }
.suggestion-panel h2 { margin-bottom: 16px; }
.instant-results { display: grid; gap: 8px; margin-top: 16px; }
.instant-results > a { display: flex; align-items: center; gap: 14px; min-height: 56px; padding: 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--card); }
.instant-results > a:hover { border-color: var(--accent); background: var(--accent-soft); }
.instant-results > a > span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.instant-results small { display: block; margin-top: 2px; color: var(--muted); font-size: .75rem; }
.instant-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 16px; }
.suggestion-status { color: var(--muted); font-size: .8rem; }
.results-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding-bottom: 18px; margin-bottom: 24px; border-bottom: 1px solid var(--line); }
.results-heading h2 { font-size: 1.15rem; }
.results-heading p { margin: 0; color: var(--muted); font-size: .85rem; overflow-wrap: anywhere; }
.search-controls { display: flex; flex-wrap: wrap; align-items: end; gap: 12px; margin: 0 0 16px; }
.active-filters { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 16px; }
.filter-chip { display: inline-flex; align-items: center; min-height: 36px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 999px; color: var(--accent-ink); background: var(--accent-soft); font-size: .8rem; }
.search-result-card mark { padding: 0 .08em; color: var(--accent-ink); background: var(--accent-soft); border-radius: 2px; }
.recommend-heading { margin: 24px 0 12px; font-size: 1rem; }
.result-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
.search-result-card { display: flex; flex-direction: column; min-width: 0; min-height: 242px; padding: 24px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); box-shadow: var(--shadow); }
.search-result-card:hover { border-color: var(--accent); }
.result-card-top { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.result-icon, .state-icon { display: grid; place-items: center; flex-shrink: 0; width: 48px; height: 48px; border-radius: 12px; color: var(--accent-ink); background: var(--accent-soft); }
.content-type { flex: 1; color: var(--muted); font-size: .75rem; }
.result-card-top > .icon-park { color: var(--muted); }
.search-result-card h3 { font-size: 1.05rem; overflow-wrap: anywhere; }
.search-result-card > p { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 3; margin: 12px 0 20px; color: var(--muted); font-size: .85rem; line-height: 1.8; overflow-wrap: anywhere; }
.result-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: auto; padding-top: 14px; border-top: 1px solid var(--line); color: var(--accent-ink); font-size: .8rem; }
.search-state { display: grid; justify-items: center; gap: 16px; padding: 48px 24px; border: 1px dashed var(--line); border-radius: 12px; text-align: center; }
.search-state p { max-width: 540px; margin: 0; color: var(--muted); font-size: .9rem; }
.search-state h2, .search-state h3 { margin: 0; font-size: 1.1rem; }
.search-welcome { border: 0; padding-top: 36px; }
.search-state .search-chips { justify-content: center; }
.search-recommendations { margin-top: 32px; }
.search-pagination { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 24px; margin-top: 32px; color: var(--muted); font-size: .85rem; }
.search-pagination a { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 8px 16px; border: 1px solid var(--line); border-radius: 8px; background: var(--card); }
.previous-icon { transform: rotate(180deg); }
@media (max-width: 1000px) { .result-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) { .search-hero-inner { padding-block: 32px 24px; } .search-hero h1 span { display: block; margin-top: 4px; } .search-intro { font-size: .85rem; } .search-filters { gap: 4px; } .search-filters a { padding-inline: 12px; } .discovery-section { align-items: flex-start; gap: 10px; } .discovery-heading { gap: 4px; } .discovery-heading h2 { font-size: .72rem; } .suggestion-panel { padding: 16px; } .search-discovery { gap: 12px; } .result-grid, .instant-grid { grid-template-columns: 1fr; } .results-heading { align-items: start; flex-direction: column; gap: 8px; } }
</style>
