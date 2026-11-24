<script setup lang="ts">
import { homepageModulesSchema, type HomepageModuleInput } from '#shared/schemas/homepage'

definePageMeta({ layout: 'default' })
type ModuleRow = HomepageModuleInput & { id: string; module_type?: string; content_type?: HomepageModuleInput['contentType']; sort_order?: number; item_limit?: number; category_id?: string | null; content_ids?: string[]; banner_text?: string; banner_url?: string; background?: HomepageModuleInput['background']; density?: HomepageModuleInput['density'] }
type Category = { id: string; name: string }
type ContentChoice = { id: string; title: string; status: string }
const [{ data, error: loadError, refresh }, { data: categoryData }] = await Promise.all([
  useFetch<{ modules: ModuleRow[] }>('/api/admin/homepage'),
  useFetch<{ categories: Category[] }>('/api/admin/categories')
])
const modules = ref<HomepageModuleInput[]>([])
const busy = ref(false)
const error = ref('')
const saved = ref(false)
watchEffect(() => {
  modules.value = (data.value?.modules ?? []).map(item => ({ id: item.id, moduleType: (item.module_type ?? item.moduleType) as HomepageModuleInput['moduleType'], placement: item.placement ?? 'top', contentType: item.content_type ?? item.contentType ?? 'site', title: item.title, enabled: item.enabled, sortOrder: item.sort_order ?? item.sortOrder, itemLimit: item.item_limit ?? item.itemLimit, categoryId: item.category_id ?? item.categoryId ?? null, contentIds: item.content_ids ?? item.contentIds ?? [], bannerText: item.banner_text ?? item.bannerText ?? '', bannerUrl: item.banner_url ?? item.bannerUrl ?? '', background: item.background ?? 'default', density: item.density ?? 'comfortable' }))
})
const categories = computed(() => categoryData.value?.categories ?? [])
const contentPaths = { site: 'sites', resource: 'resources', media: 'media', article: 'articles', announcement: 'announcements' } as const
const contentChoices = ref<Record<string, ContentChoice[]>>({})
const loadingTypes = new Set<string>()
async function loadChoices(type: string) {
  if (contentChoices.value[type] || loadingTypes.has(type)) return
  loadingTypes.add(type)
  try {
    const path = contentPaths[type as keyof typeof contentPaths]
    const choices: ContentChoice[] = []
    let pageCount = 1
    for (let page = 1; page <= pageCount; page++) {
      const result = await $fetch<{ [key: string]: { items: ContentChoice[]; pageCount: number } }>(`/api/admin/${path}`, { query: { page, pageSize: 100 } })
      const collection = result[path]
      choices.push(...(collection?.items ?? []))
      pageCount = collection?.pageCount ?? 1
    }
    contentChoices.value[type] = choices
  } catch { error.value = '内容选项加载失败，请重试' }
  finally { loadingTypes.delete(type) }
}
watch(() => modules.value.map(item => item.contentType), types => { for (const type of new Set(types)) void loadChoices(type) }, { immediate: true })
function changeType(item: HomepageModuleInput) {
  if (item.moduleType === 'category') item.contentType = 'site'
  if (item.moduleType === 'popular_categories') item.contentType = 'site'
  if (item.moduleType === 'announcement') item.contentType = 'announcement'
  if (item.moduleType !== 'category') item.categoryId = null
  if (item.moduleType !== 'featured') item.contentIds = []
}
function addModule() { modules.value.push({ moduleType: 'latest', placement: 'top', contentType: 'site', title: '最新内容', enabled: true, sortOrder: modules.value.length, itemLimit: 12, categoryId: null, contentIds: [], bannerText: '', bannerUrl: '', background: 'default', density: 'comfortable' }) }
function removeModule(index: number) { modules.value.splice(index, 1); modules.value.forEach((item, order) => { item.sortOrder = order }) }
function moveModule(index: number, direction: -1 | 1) { const target = index + direction; if (target < 0 || target >= modules.value.length) return; [modules.value[index], modules.value[target]] = [modules.value[target]!, modules.value[index]!]; modules.value.forEach((item, order) => { item.sortOrder = order }) }
async function save() {
  busy.value = true; error.value = ''; saved.value = false
  try { const input = homepageModulesSchema.parse({ modules: modules.value }); await $fetch('/api/admin/homepage', { method: 'PUT', body: input }); await refresh(); saved.value = true } catch (err) { error.value = err instanceof Error ? err.message : '保存失败，请检查配置' } finally { busy.value = false }
}
</script>

<template>
<AdminPage title="首页编排" description="模块仅展示已发布内容"><template #actions><UButton color="neutral" variant="outline" icon="i-lucide-plus" :disabled="busy" @click="addModule">新增模块</UButton><UButton :loading="busy" :disabled="!!loadError" icon="i-lucide-save" @click="save">保存配置</UButton></template><div class="space-y-6"><p class="text-sm text-muted">模块仅展示已发布内容；无结果或失效关联会自动显示为空模块。</p><p v-if="saved" role="status" class="text-sm text-muted">配置已保存</p><UAlert color="error" variant="soft" v-if="error || loadError" role="alert"><template #description>{{ error || '配置加载失败，请刷新页面后重试。' }}</template></UAlert><section class="grid gap-4">
    <UCard v-for="(item, index) in modules" :key="index" :ui="{ body: 'space-y-4' }">
      <div class="grid min-w-0 flex-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <UFormField label="类型"><USelect class="w-full" :items="[{ label: '精选内容', value: 'featured' }, { label: '最新内容', value: 'latest' }, { label: '最近更新', value: 'updated' }, { label: '热门内容', value: 'popular' }, { label: '热门分类', value: 'popular_categories' }, { label: '分类网站', value: 'category' }, { label: '公告', value: 'announcement' }, { label: '横幅公告', value: 'banner' }]" v-model="item.moduleType" @update:model-value="changeType(item)" /></UFormField>
        <UFormField label="内容类型" v-if="item.moduleType !== 'category' && item.moduleType !== 'announcement'"><USelect class="w-full" :items="[{label:'网站',value:'site'},{label:'资源',value:'resource'},{label:'媒体',value:'media'},{label:'文章',value:'article'},{label:'公告',value:'announcement'}]" v-model="item.contentType" @update:model-value="item.contentIds = []" /></UFormField>
        <UFormField label="标题"><UInput class="w-full" v-model="item.title" maxlength="160" /></UFormField>
        <UFormField label="插入位置"><USelect class="w-full" v-model="item.placement" :items="[{ label: '目录顶部（第一个分类之前）', value: 'top' }, ...categories.map(category => ({ label: `分类「${category.name}」之前`, value: category.id }))]" /></UFormField>
        <UFormField label="展示数量"><UInput class="w-full" v-model.number="item.itemLimit" type="number" min="1" max="48" /></UFormField>
        <UFormField label="内容密度"><USelect class="w-full" v-model="item.density" :items="[{ label: '紧凑', value: 'compact' }, { label: '舒适', value: 'comfortable' }, { label: '宽松', value: 'relaxed' }]" /></UFormField>
        <template v-if="item.moduleType === 'banner'"><UFormField label="横幅文字"><UInput class="w-full" v-model="item.bannerText" maxlength="500" /></UFormField><UFormField label="横幅链接"><UInput class="w-full" v-model="item.bannerUrl" maxlength="2048" /></UFormField></template>
        <UFormField label="分类" v-if="item.moduleType === 'category'"><USelect class="w-full" :items="categories.map(category => ({ label: category.name, value: category.id }))" placeholder="请选择分类" :model-value="item.categoryId ?? undefined" @update:model-value="item.categoryId = $event" /></UFormField>
        <UFormField label="精选内容" v-if="item.moduleType === 'featured'"><USelect class="w-full" :items="(contentChoices[item.contentType] ?? []).map(choice => ({ label: choice.title + (choice.status !== 'published' ? '（未发布）' : ''), value: choice.id }))" v-model="item.contentIds" multiple @focus="loadChoices(item.contentType)" /></UFormField>
        <label class="flex items-center gap-2"><UCheckbox v-model="item.enabled" aria-label="选择项目" /> 启用</label>
      </div>
      <div class="flex flex-wrap items-center gap-2"><UButton color="neutral" variant="outline"  :disabled="index === 0" @click="moveModule(index, -1)">上移</UButton><UButton color="neutral" variant="outline"  :disabled="index === modules.length - 1" @click="moveModule(index, 1)">下移</UButton><UButton color="error" variant="soft"  @click="removeModule(index)">删除</UButton></div>
    </UCard>
    <AdminEmpty v-if="!modules.length" title="暂无首页模块" description="首页还是一张白纸，留给每一种灵感自由生长。未配置时将展示默认网站列表。" />
  </section></div></AdminPage>
</template>


