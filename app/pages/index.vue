<script setup lang="ts">
import TaxonomyIcon from '#shared/components/TaxonomyIcon.vue'
import { categoryDefaultIcons } from '#shared/utils/taxonomy-icons'

type Site = { id: string; title: string; description: string; slug: string; target_url: string; icon_url?: string | null; category_ids?: string[] }
type Category = { id: string; name: string; slug: string; description: string; parent_id: string | null; sort_order: number; site_count: number; icon_name: string | null }
type CategoryPreview = { id: string; total: number; sites: Site[] }
type ModuleItem = { id: string; title: string; slug?: string; description?: string; summary?: string; body?: string; target_url?: string; icon_url?: string | null; cover_url?: string | null; category_ids?: string[] }
type HomepageModule = { id: string; module_type: 'featured' | 'latest' | 'updated' | 'popular' | 'popular_categories' | 'category' | 'announcement' | 'banner'; placement?: string; content_type: 'site' | 'resource' | 'media' | 'article' | 'announcement'; title: string; items: ModuleItem[]; banner_text?: string; banner_url?: string; background?: 'default' | 'surface' | 'accent'; density?: 'compact' | 'comfortable' | 'relaxed' }

const [{ data: homeData, error: sitesError }, { data: categoriesData, error: categoriesError }] = await Promise.all([
  useFetch<{ categories: CategoryPreview[]; total: number; modules: HomepageModule[] }>('/api/public/home'),
  useFetch<{ categories: Category[] }>('/api/public/categories')
])
const siteSettings = await useSiteSettings()
const directSiteLinks = computed(() => siteSettings.value.siteCardBehavior === 'direct')
const { locale, t } = useI18n()
const activeCategory = ref<string | null>(null)
const expandedCategories = ref(new Set<string>())
const sidebarCollapsed = useCookie<boolean>('navhub-sidebar-collapsed', { default: () => false })
const sidebarHovered = ref(false)
const sidebarPreviewExpanded = computed(() => sidebarCollapsed.value && sidebarHovered.value)
const asideScrollEdges = ref({ top: false, bottom: false })
const asideNav = useTemplateRef<HTMLElement>('asideNav')
function updateAsideScrollEdges() {
  const element = asideNav.value
  if (!element) return
  const next = { top: element.scrollTop > 1, bottom: element.scrollTop + element.clientHeight < element.scrollHeight - 1 }
  if (asideScrollEdges.value.top !== next.top || asideScrollEdges.value.bottom !== next.bottom) asideScrollEdges.value = next
}
const sidebarSlot = useTemplateRef('sidebarSlot')
const sidebarStyle = ref<Record<string, string>>({})
watch([sidebarCollapsed, sidebarHovered], () => {
  if (import.meta.client) window.dispatchEvent(new Event('resize'))
})
onMounted(() => {
  const footer = document.querySelector('.site-footer')
  const header = document.querySelector('.site-header')
  let frame = 0
  const update = () => {
    frame = 0
    const slot = sidebarSlot.value
    if (!slot || window.innerWidth <= 800) {
      if (slot) slot.style.minHeight = ''
      sidebarStyle.value = {}
      return
    }
    const bounds = slot.getBoundingClientRect()
    const top = Math.max(bounds.top, (header?.getBoundingClientRect().bottom ?? 0) + 20)
    const bottom = Math.min(window.innerHeight, footer?.getBoundingClientRect().top ?? window.innerHeight) - 20
    const height = Math.max(0, bottom - top)
    slot.style.minHeight = `${height}px`
    const width = sidebarCollapsed.value ? 64 : slot.getBoundingClientRect().width
    const nextStyle: Record<string, string> = {
      position: 'fixed',
      top: `${top}px`,
      left: `${bounds.left}px`,
      width: `${width}px`,
      height: `${height}px`
    }
    if (Object.keys(nextStyle).some(key => sidebarStyle.value[key] !== nextStyle[key])) sidebarStyle.value = nextStyle
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
  const observer = new ResizeObserver(() => { schedule(); updateAsideScrollEdges() })
  observer.observe(document.querySelector('#main-content')!)
  if (sidebarSlot.value) observer.observe(sidebarSlot.value)
  if (footer) observer.observe(footer)
  if (header) observer.observe(header)
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule)
  update()
  updateAsideScrollEdges()
  onBeforeUnmount(() => {
    observer.disconnect()
    window.removeEventListener('scroll', schedule)
    window.removeEventListener('resize', schedule)
    cancelAnimationFrame(frame)
  })
})
onMounted(() => {
  const updateActiveCategory = () => {
    const threshold = (document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0) + 24
    const sections = categoryModules.value
      .map(category => ({ id: category.id, element: document.getElementById(`category-${category.id}`) }))
      .filter((entry): entry is { id: string; element: HTMLElement } => entry.element instanceof HTMLElement)
    let current = sections[0]?.id ?? null
    for (const section of sections) {
      if (section.element.getBoundingClientRect().top <= threshold) current = section.id
      else break
    }
    if (activeCategory.value !== current) activeCategory.value = current
  }
  let frame = 0
  const schedule = () => {
    if (frame) return
    frame = requestAnimationFrame(() => { frame = 0; updateActiveCategory() })
  }
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule)
  updateActiveCategory()
  onBeforeUnmount(() => {
    window.removeEventListener('scroll', schedule)
    window.removeEventListener('resize', schedule)
    cancelAnimationFrame(frame)
  })
})
const categoryTree = computed(() => {
  const all = categoriesData.value?.categories ?? []
  const build = (parentId: string | null, depth: number): Array<Category & { depth: number }> => all
    .filter(category => category.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, locale.value))
    .map(category => ({ ...category, depth, children: build(category.id, depth + 1) }))
    .flatMap(({ children, ...category }) => [category, ...children])
  return build(null, 0)
})
const categories = computed(() => categoryTree.value)
const categoryIds = computed(() => new Set(categories.value.map(category => category.id)))
const parentIds = computed(() => new Set(categories.value.filter(category => category.parent_id).map(category => category.parent_id as string)))
const visibleCategories = computed(() => {
  const byId = new Map(categories.value.map(category => [category.id, category]))
  return categories.value.filter(category => {
    let parent = category.parent_id
    while (parent && categoryIds.value.has(parent)) {
      if (!expandedCategories.value.has(parent)) return false
      parent = byId.get(parent)?.parent_id ?? null
    }
    return true
  })
})
function toggleCategory(id: string) {
  const next = new Set(expandedCategories.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedCategories.value = next
}
const selectedCategoryIds = computed(() => {
  const ids = new Set<string>()
  if (!activeCategory.value) return ids
  const collect = (id: string) => {
    ids.add(id)
    for (const category of categories.value) if (category.parent_id === id) collect(category.id)
  }
  collect(activeCategory.value)
  return ids
})
const configuredModules = computed(() => homeData.value?.modules ?? [])
const modulesAt = (placement: string) => configuredModules.value.filter(module => (module.placement ?? 'top') === placement)
const categoryModules = computed(() => {
  const previews = new Map((homeData.value?.categories ?? []).map(category => [category.id, category]))
  return (categoriesData.value?.categories ?? [])
    .filter(category => !category.parent_id || !categoryIds.value.has(category.parent_id))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, locale.value))
    .map(category => {
      const children = categories.value.filter(child => child.parent_id === category.id)
      const selectedId = selectedSubcategories.value[category.id] ?? category.id
      const selected = categories.value.find(child => child.id === selectedId) ?? category
      const preview = previews.get(selected.id)
      return { ...category, children, selected, sites: preview?.sites ?? [], total: preview?.total ?? 0 }
    })
    .filter(category => category.sites.length || category.children.length)
})
const selectedSubcategories = ref<Record<string, string>>({})
const subcategoryScrollEdges = ref(new Map<string, { left: boolean; right: boolean }>())
const subcategoryRefs = new Map<string, HTMLElement>()
const subcategoryTabRefs = new Map<string, HTMLElement>()
const subcategoryResizeObserver = ref<ResizeObserver | null>(null)
function setSubcategoryTabRef(key: string, element: Element | ComponentPublicInstance | null) {
  if (element instanceof HTMLElement) subcategoryTabRefs.set(key, element)
  else subcategoryTabRefs.delete(key)
}
function selectSubcategory(parentId: string, categoryId: string) {
  selectedSubcategories.value = { ...selectedSubcategories.value, [parentId]: categoryId }
  nextTick(() => {
    const container = subcategoryRefs.get(parentId)
    const tab = subcategoryTabRefs.get(`${parentId}:${categoryId}`)
    if (!container || !tab) return
    const left = tab.offsetLeft - (container.clientWidth - tab.clientWidth) / 2
    container.scrollTo({ left, behavior: 'smooth' })
  })
}
function setSubcategoryRef(id: string, element: Element | ComponentPublicInstance | null) {
  if (element instanceof HTMLElement) {
    subcategoryRefs.set(id, element)
    measureSubcategoryOverflow(id, element)
    subcategoryResizeObserver.value?.observe(element)
  } else {
    const previous = subcategoryRefs.get(id)
    if (previous) subcategoryResizeObserver.value?.unobserve(previous)
    subcategoryRefs.delete(id)
  }
}
function updateSubcategoryOverflow(id: string, event: Event) {
  const element = event.currentTarget
  if (!(element instanceof HTMLElement)) return
  measureSubcategoryOverflow(id, element)
}
function measureSubcategoryOverflow(id: string, element: HTMLElement) {
  const nextEdges = {
    left: element.scrollLeft > 1,
    right: element.scrollLeft + element.clientWidth < element.scrollWidth - 1
  }
  const current = subcategoryScrollEdges.value.get(id)
  if (current?.left === nextEdges.left && current.right === nextEdges.right) return
  const next = new Map(subcategoryScrollEdges.value)
  next.set(id, nextEdges)
  subcategoryScrollEdges.value = next
}
onMounted(() => {
  const observer = new ResizeObserver(() => {
    for (const [id, element] of subcategoryRefs) measureSubcategoryOverflow(id, element)
  })
  subcategoryResizeObserver.value = observer
  for (const element of subcategoryRefs.values()) observer.observe(element)
  const main = document.querySelector('#main-content')
  if (main) observer.observe(main)
  onBeforeUnmount(() => { observer.disconnect(); subcategoryResizeObserver.value = null })
})
const siteCount = computed(() => homeData.value?.total ?? 0)
const error = computed(() => sitesError.value || categoriesError.value)
function goToCategory(id: string) {
  const category = categories.value.find(item => item.id === id)
  if (category && parentIds.value.has(category.id)) return
  let root = category
  while (root?.parent_id) {
    const parent = categories.value.find(item => item.id === root?.parent_id)
    if (!parent) break
    root = parent
  }
  if (root && category) selectedSubcategories.value = { ...selectedSubcategories.value, [root.id]: category.id }
  document.getElementById(`category-${root?.id ?? id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function moduleHref(module: HomepageModule, item: ModuleItem) {
  if (module.module_type === 'popular_categories') return `/categories/${encodeURIComponent(item.slug ?? '')}`
  const paths = { site: 'sites', resource: 'resources', media: 'media', article: 'articles', announcement: 'announcements' }
  return `/${paths[module.content_type]}/${encodeURIComponent(item.slug ?? item.id)}`
}
function siteHost(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}
</script>

<template>
  <div class="home-page">
    <section class="home-hero">
      <div class="home-hero-inner content-width">
        <div class="hero-search-area">
          <h1 class="sr-only">{{ t('home.searchPlaceholder') }}</h1>
          <SearchBox input-id="home-search" :placeholder="t('home.searchPlaceholder')" shortcut multi-source />
        </div>
      </div>
    </section>

    <section class="directory-layout content-width" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }" :aria-label="t('home.categories')">
      <div ref="sidebarSlot" class="category-sidebar-slot">
          <aside class="category-sidebar" :class="{ 'is-collapsed': sidebarCollapsed && !sidebarHovered, 'is-preview-expanded': sidebarPreviewExpanded }" :style="sidebarStyle">
        <nav ref="asideNav" :class="{ 'show-top-fade': asideScrollEdges.top, 'show-bottom-fade': asideScrollEdges.bottom }" :aria-label="t('home.categories')" @pointerenter="sidebarHovered = true" @pointerleave="sidebarHovered = false" @scroll.passive="updateAsideScrollEdges">
          <div v-for="category in visibleCategories" :key="category.id" class="category-nav-row" :class="{ 'is-child': category.depth > 0 }" :style="{ '--category-depth': category.depth }">
            <button type="button" class="category-filter" :title="sidebarCollapsed && !sidebarHovered ? category.name : undefined" :aria-expanded="parentIds.has(category.id) ? expandedCategories.has(category.id) : undefined" @click="parentIds.has(category.id) ? toggleCategory(category.id) : goToCategory(category.id)">
              <TaxonomyIcon v-if="category.depth === 0" :name="category.icon_name" :fallback="categoryDefaultIcons[category.slug]" :size="17" />
              <span v-else class="category-child-mark" aria-hidden="true" />
              <span class="category-name">{{ category.name }}</span>
            </button>
            <AppIcon v-if="parentIds.has(category.id)" class="category-chevron" :name="expandedCategories.has(category.id) ? 'up' : 'down'" :size="14" aria-hidden="true" />
          </div>
        </nav>
        <div class="category-sidebar-footer">
          <button type="button" class="category-sidebar-collapse" :aria-label="sidebarCollapsed ? '展开' : '收起'" :aria-expanded="!sidebarCollapsed" @click="sidebarCollapsed = !sidebarCollapsed">
            <AppIcon :name="sidebarCollapsed ? 'right-expand' : 'left-expand'" :size="16" aria-hidden="true" />
            <span class="category-sidebar-collapse-label">{{ sidebarCollapsed ? '展开' : '收起' }}</span>
          </button>
        </div>
      </aside>
      </div>

      <div class="directory-content">
        <template v-for="module in modulesAt('top')" :key="module.id"><section class="homepage-content-module" :class="[`module-bg-${module.background ?? 'default'}`, `module-density-${module.density ?? 'comfortable'}`]"><div class="section-heading"><h2>{{ module.title || ({ site: '网站', resource: '资源', media: '书影音', article: '文章', announcement: '公告' })[module.content_type] }}</h2></div><NuxtLink v-if="module.module_type === 'banner' && module.banner_url" :to="module.banner_url" class="homepage-banner">{{ module.banner_text }}</NuxtLink><p v-else-if="module.module_type === 'banner'" class="homepage-banner">{{ module.banner_text }}</p><div v-else-if="module.items.length" class="content-grid site-grid"><template v-for="item in module.items" :key="item.id"><DirectorySiteCard v-if="module.content_type === 'site'" :site="item" /><NuxtLink v-else :to="moduleHref(module, item)" class="site-card"><SiteIcon :title="item.title" :icon-url="item.icon_url || item.cover_url" :target-url="undefined" /><h3>{{ item.title }}</h3><AppIcon class="site-card-arrow" name="arrow-up-right" :size="17" aria-hidden="true" /><p>{{ item.description || item.summary || item.body }}</p></NuxtLink></template></div></section></template>
        <p v-if="error" class="form-error" role="alert">{{ locale === 'zh-CN' ? '内容暂时无法加载，请稍后重试。' : 'Content is temporarily unavailable.' }}</p>
        <template v-for="category in categoryModules" :key="category.id"><template v-for="module in modulesAt(category.id)" :key="module.id"><section class="homepage-content-module" :class="[`module-bg-${module.background ?? 'default'}`, `module-density-${module.density ?? 'comfortable'}`]"><div class="section-heading"><h2>{{ module.title || ({ site: '网站', resource: '资源', media: '书影音', article: '文章', announcement: '公告' })[module.content_type] }}</h2></div><NuxtLink v-if="module.module_type === 'banner' && module.banner_url" :to="module.banner_url" class="homepage-banner">{{ module.banner_text }}</NuxtLink><p v-else-if="module.module_type === 'banner'" class="homepage-banner">{{ module.banner_text }}</p><div v-else-if="module.items.length" class="content-grid site-grid"><template v-for="item in module.items" :key="item.id"><DirectorySiteCard v-if="module.content_type === 'site'" :site="item" /><NuxtLink v-else :to="moduleHref(module, item)" class="site-card"><SiteIcon :title="item.title" :icon-url="item.icon_url || item.cover_url" :target-url="undefined" /><h3>{{ item.title }}</h3><p>{{ item.description || item.summary || item.body }}</p></NuxtLink></template></div></section></template><section :id="`category-${category.id}`" class="directory-category" :aria-labelledby="`category-title-${category.id}`">
          <div class="directory-category-card">
          <div class="section-heading directory-heading">
            <div class="directory-title"><TaxonomyIcon :name="category.icon_name" :fallback="categoryDefaultIcons[category.slug]" :size="20" /><h2 :id="`category-title-${category.id}`">{{ category.name }}</h2></div>
            <NuxtLink class="view-all" :to="`/categories/${encodeURIComponent(category.selected.slug)}`">{{ t('home.viewAll') }} ({{ category.total }}) <AppIcon name="right" :size="16" /></NuxtLink>
          </div>
          <div v-if="category.children.length" class="directory-subcategories-wrap" :class="{ 'show-left-fade': subcategoryScrollEdges.get(category.id)?.left, 'show-right-fade': subcategoryScrollEdges.get(category.id)?.right }">
          <div :ref="element => setSubcategoryRef(category.id, element)" class="directory-subcategories" :class="{ 'show-left-fade': subcategoryScrollEdges.get(category.id)?.left, 'show-right-fade': subcategoryScrollEdges.get(category.id)?.right }" role="group" :aria-label="`${category.name}子分类`" @scroll="updateSubcategoryOverflow(category.id, $event)">
            <button type="button" class="directory-subcategory" :class="{ active: category.selected.id === category.id }" :aria-pressed="category.selected.id === category.id" @click="selectSubcategory(category.id, category.id)">{{ t('common.all') }}</button>
            <button v-for="child in category.children" :key="child.id" :ref="element => setSubcategoryTabRef(`${category.id}:${child.id}`, element)" type="button" class="directory-subcategory" :class="{ active: category.selected.id === child.id }" :aria-pressed="category.selected.id === child.id" @click="selectSubcategory(category.id, child.id)">{{ child.name }}</button>
          </div>
          </div>
          <div v-if="category.sites.length" class="content-grid site-grid">
            <DirectorySiteCard v-for="item in category.sites" :key="item.id" :site="item" />
          </div>
          <EmptyState v-else compact :message="locale === 'zh-CN' ? '该分类暂无网站' : 'No sites in this category'" />
          </div>
        </section></template>
        <EmptyState v-if="!error && !categoryModules.length && !modulesAt('top').length"><NuxtLink to="/submit">{{ t('home.submit') }}</NuxtLink></EmptyState>
      </div>
    </section>
    <p v-if="configuredModules.length && error" class="content-width form-error" role="alert">内容暂时无法加载，请稍后重试。</p>
  </div>
</template>

<style scoped>
.homepage-content-module { margin-block: 2rem; }
.directory-content > .homepage-content-module:first-child { margin-top: .5rem; }
.homepage-content-module .section-heading h2 { position: relative; padding-left: 12px; }
.homepage-content-module .section-heading h2::before { position: absolute; top: .12em; bottom: .12em; left: 0; width: 3px; border-radius: 2px; background: var(--accent); content: ''; }
.homepage-content-module .section-heading { margin-bottom: 16px; }
.homepage-content-module.module-bg-surface { padding: 20px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
.homepage-content-module.module-bg-accent { padding: 20px; border: 1px solid var(--hero-line); border-radius: 12px; background: var(--hero-bg); }
.homepage-content-module.module-density-compact .site-grid { gap: 8px; }
.homepage-content-module.module-density-compact :deep(.site-card) { min-height: 150px; padding: 14px; row-gap: 10px; }
.homepage-content-module.module-density-compact :deep(.site-card) { grid-template-columns: 44px minmax(0, 1fr) 24px; grid-template-rows: 44px auto auto; column-gap: 12px; row-gap: 4px; min-height: 100px; padding: 12px 14px; }
.homepage-content-module.module-density-compact :deep(.site-card-icon) { width: 44px; height: 44px; }
.homepage-content-module.module-density-compact :deep(.site-card h3) { grid-column: 2; grid-row: 1; align-self: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.homepage-content-module.module-density-compact :deep(.site-card-arrow) { grid-column: 3; grid-row: 1; }
.homepage-content-module.module-density-compact :deep(.site-card p) { grid-column: 1 / -1; grid-row: 3; -webkit-line-clamp: 2; font-size: .8rem; line-height: 1.5; }
.homepage-content-module.module-density-compact :deep(.site-card .site-domain) { display: none; }
.homepage-content-module.module-density-compact :deep(.site-card-visit) { top: -2px; right: 8px; }
.homepage-content-module.module-density-relaxed .site-grid { gap: 24px; }
.homepage-content-module.module-density-relaxed :deep(.site-card) { min-height: 220px; padding: 28px; row-gap: 20px; }
.directory-category { scroll-margin-top: 96px; margin-bottom: 32px; }
.directory-category:last-child { margin-bottom: 0; }
.directory-category-card { padding: 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); box-shadow: var(--shadow); }
.directory-category-card .site-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.directory-category-card .site-card { background: var(--surface); }
@media (max-width: 1120px) { .directory-category-card .site-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) { .directory-category-card .site-grid { grid-template-columns: 1fr; } }
.directory-title { align-items: center; }
.site-card-arrow { display: grid; min-height: 24px; place-items: center; padding: 3px; border: 0; border-radius: 50%; color: var(--muted); background: var(--surface); cursor: pointer; }
.site-card-arrow:hover { color: var(--accent); }
.category-sidebar-footer { flex: 0 0 auto; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--line); }
.category-sidebar-collapse { display: flex; width: 100%; min-height: 40px; align-items: center; justify-content: center; gap: 9px; padding: 8px; border-radius: 7px; color: var(--muted); background: transparent; font-size: .85rem; font-weight: 500; cursor: pointer; }
.category-sidebar-collapse:hover { color: var(--ink); background: var(--accent-soft); }
.category-sidebar-collapse span { overflow: hidden; white-space: nowrap; }
.category-sidebar.is-collapsed { padding-inline: 6px; }
.category-sidebar.is-collapsed:not(.is-preview-expanded) .category-sidebar-collapse-label,
.category-sidebar.is-collapsed:not(.is-preview-expanded) .category-filter > .category-name,
.category-sidebar.is-collapsed:not(.is-preview-expanded) .category-chevron { display: none; }
.category-sidebar.is-collapsed:not(.is-preview-expanded) .category-nav-row.is-child { display: none; }
.category-sidebar.is-collapsed .category-filter { justify-content: center; padding: 10px 4px; }
.category-sidebar.is-collapsed .category-sidebar-collapse { width: 40px; margin-inline: auto; padding: 8px; }
.category-sidebar.is-preview-expanded { z-index: 30; width: 240px !important; box-shadow: var(--shadow); }
.category-sidebar.is-preview-expanded .category-filter { justify-content: flex-start; padding: 10px; }
.category-sidebar.is-preview-expanded .category-sidebar-collapse { width: 100%; }
.directory-subcategories-wrap { position: relative; min-width: 0; }
.directory-subcategories { display: flex; flex-wrap: nowrap; gap: 0; margin: 0 0 14px; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none; border-bottom: 1px solid var(--line); }
.directory-subcategories.show-left-fade { mask-image: linear-gradient(to right, transparent, #000 52px); }
.directory-subcategories.show-right-fade { mask-image: linear-gradient(to right, #000 calc(100% - 52px), transparent); }
.directory-subcategories.show-left-fade.show-right-fade { mask-image: linear-gradient(to right, transparent, #000 52px, #000 calc(100% - 52px), transparent); }
.directory-subcategories::-webkit-scrollbar { display: none; }
.directory-subcategory { display: inline-flex; position: relative; flex: 0 0 auto; min-height: 42px; align-items: center; gap: 7px; padding: 8px 14px; border: 0; color: var(--muted); background: transparent; font-size: .85rem; font-weight: 500; cursor: pointer; white-space: nowrap; }
.directory-subcategory::after { position: absolute; right: 12px; bottom: -1px; left: 12px; height: 2px; background: transparent; content: ''; }
.directory-subcategory:hover, .directory-subcategory.active { color: var(--accent); background: var(--accent-soft); }
.directory-subcategory.active { font-weight: 600; }
.directory-subcategory.active::after { background: var(--accent); }
.homepage-banner { display: block; padding: 24px; border: 1px solid var(--hero-line); border-radius: 12px; color: var(--hero-ink); background: var(--hero-bg); }
</style>
