<script setup lang="ts">
import { defaultSiteSettings, siteSettingsSchema, type SiteSettings } from '#shared/schemas/settings'
import { translationKeys } from '#shared/i18n'
import { settingsSections } from '~/utils/settings-sections'

definePageMeta({ layout: 'default', key: route => route.path })
const route = useRoute()
const section = settingsSections.find(item => item.id === route.params.section)
if (!section) throw createError({ statusCode: 404, statusMessage: 'Settings page not found' })
const editableKeys = section.keys
const { data, error: loadError, refresh } = await useFetch<{ settings: SiteSettings }>('/api/admin/settings')
const settings = ref<SiteSettings>(siteSettingsSchema.parse(data.value?.settings ?? defaultSiteSettings))
const busy = ref(false)
const error = ref('')
const saved = ref(false)
watchEffect(() => { if (data.value?.settings) settings.value = siteSettingsSchema.parse(data.value.settings) })
async function save() {
  busy.value = true
  error.value = ''
  saved.value = false
  try {
    const latest = await $fetch<{ settings: SiteSettings }>('/api/admin/settings')
    const changes = Object.fromEntries(editableKeys.map(key => [key, settings.value[key]]))
    const input = siteSettingsSchema.parse({ ...latest.settings, ...changes })
    await $fetch('/api/admin/settings', { method: 'PUT', body: input })
    await refresh()
    saved.value = true
  }
  catch (reason) { error.value = reason instanceof Error ? reason.message : '保存失败' }
  finally { busy.value = false }
}
function addNavigation() { settings.value.navigation.push({ label: '', to: '/' }) }
const themeModes = [{ label: '浅色', value: 'light' }, { label: '深色', value: 'dark' }, { label: '跟随系统', value: 'system' }]
const accentChoices = [{ label: '蓝色', value: 'blue' }, { label: '紫色', value: 'violet' }, { label: '翠绿', value: 'emerald' }, { label: '玫红', value: 'rose' }]
const searchSourceChoices = computed(() => [{ label: '站内', value: 'internal' }, ...settings.value.searchSources.filter(source => source.enabled).map(source => ({ label: source.label, value: source.id }))])
function moveSource(index: number, direction: number) {
  const target = index + direction
  if (target < 0 || target >= settings.value.searchSources.length) return
  const sources = settings.value.searchSources
  ;[sources[index], sources[target]] = [sources[target]!, sources[index]!]
}
function moveTab(index: number, direction: number) {
  const target = index + direction
  if (target < 0 || target >= settings.value.mobileTabs.length) return
  const tabs = settings.value.mobileTabs
  ;[tabs[index], tabs[target]] = [tabs[target]!, tabs[index]!]
}
function addTranslation() {
  const key = translationKeys.find(key => !settings.value.translations.some(item => item.key === key))
  if (key) settings.value.translations.push({ key, zhCN: '', enUS: '' })
}
</script>

<template>
  <AdminPage :title="section.title" :description="section.description">
    <template #toolbar><UDashboardToolbar><UButton to="/settings" color="neutral" variant="link" icon="i-lucide-arrow-left">全局设置</UButton></UDashboardToolbar></template>
    <AdminEditor :title="section.title" :description="section.description" return-to="/settings" :busy="busy" :error="error" @save="save">
      <UAlert v-if="loadError" color="error" variant="soft" role="alert"><template #description>设置加载失败，请刷新页面后重试。</template></UAlert>
      <UAlert v-if="saved" color="success" variant="soft" icon="i-lucide-circle-check" title="设置已保存" role="status" />
      <div v-if="section.id === 'brand'" class="space-y-6"><div class="space-y-6">
        <AdminEditorField label="网站名称"><UInput v-model="settings.name" maxlength="100" class="w-full" /></AdminEditorField>
        <AdminEditorField label="Logo"><AdminImagePicker v-model="settings.logoUrl" /></AdminEditorField>
        <AdminEditorField label="Favicon"><AdminImagePicker v-model="settings.faviconUrl" /></AdminEditorField>
        <AdminEditorField label="网站描述" wide><UTextarea v-model="settings.description" maxlength="500" class="w-full" /></AdminEditorField>
        <AdminEditorField label="页脚文字" wide><UTextarea v-model="settings.footer" maxlength="1000" class="w-full" /></AdminEditorField>
      </div></div>
      <div v-if="section.id === 'navigation'" class="space-y-6"><div class="flex flex-wrap items-center justify-between gap-3"><span class="text-sm text-muted">{{ settings.navigation.length }} / 12</span><UButton size="sm" color="neutral" variant="outline" icon="i-lucide-plus" :disabled="settings.navigation.length >= 12" @click="addNavigation">添加链接</UButton></div>
        <div class="space-y-3"><div v-for="(item, index) in settings.navigation" :key="index" class="grid gap-3 sm:grid-cols-[1fr_2fr_auto]"><UFormField label="名称" class="[&_[data-slot=base]]:mt-2"><UInput v-model="item.label" maxlength="80" class="w-full" /></UFormField><UFormField label="站内路径或 URL" class="[&_[data-slot=base]]:mt-2"><UInput v-model="item.to" maxlength="2048" class="w-full" /></UFormField><UButton class="self-end" color="error" variant="soft" aria-label="删除导航链接" icon="i-lucide-trash-2" @click="settings.navigation.splice(index, 1)" /></div></div>
      </div>
      <div v-if="section.id === 'theme'" class="space-y-6">
        <p class="mb-4 text-sm text-muted">默认主题仅用于未选择主题的访客；已有访客偏好优先。强调色使用经过配对的浅色与深色方案。</p>
        <div class="space-y-6"><AdminEditorField label="默认主题"><USelect v-model="settings.theme.defaultMode" :items="themeModes" class="w-full" /></AdminEditorField><AdminEditorField label="强调色"><USelect v-model="settings.theme.accent" :items="accentChoices" class="w-full" /></AdminEditorField><AdminEditorField label="卡片圆角"><USelect v-model="settings.customCss.cardRadius" :items="[{ label: '默认', value: 'default' }, { label: '8px', value: '8px' }, { label: '12px', value: '12px' }, { label: '16px', value: '16px' }]" class="w-full" /></AdminEditorField><AdminEditorField label="卡片阴影"><USelect v-model="settings.customCss.cardShadow" :items="[{ label: '默认', value: 'default' }, { label: '无阴影', value: 'none' }, { label: '柔和', value: 'soft' }]" class="w-full" /></AdminEditorField></div>
      </div>
      <div v-if="section.id === 'site-cards'" class="space-y-6">
        <p class="mb-4 text-sm text-muted">分别设置网站卡片主体和右上角箭头的点击行为。</p>
        <div class="space-y-6"><AdminEditorField label="卡片点击行为"><USelect v-model="settings.siteCardBehavior" :items="[{ label: '打开网站详情', value: 'detail' }, { label: '直接打开网站', value: 'direct' }]" class="w-full" /></AdminEditorField>
        <AdminEditorField label="右上角箭头点击行为"><USelect v-model="settings.siteCardArrowBehavior" :items="[{ label: '直接打开目标网站', value: 'direct' }, { label: '打开网站详情', value: 'detail' }]" class="w-full" /></AdminEditorField></div>
      </div>
      <div v-if="section.id === 'search'" class="space-y-6"><div class="flex flex-wrap items-center justify-between gap-3"><span class="text-sm text-muted">{{ settings.searchSources.length }} / 12</span><UButton color="neutral" variant="outline" icon="i-lucide-plus" :disabled="settings.searchSources.length >= 12" @click="settings.searchSources.push({ id: '', label: '', enabled: true, urlTemplate: '' })">添加搜索源</UButton></div>
        <p class="mb-4 text-sm text-muted">站内搜索始终可用；外部搜索在提交后跳转至目标网站。模板须为 HTTPS，包含一个 {query}。ID 使用小写字母、数字和连字符，以字母开头；列表顺序即前台顺序。</p>
        <UFormField label="默认搜索源"><USelect v-model="settings.defaultSearchSource" :items="searchSourceChoices" class="w-full sm:max-w-xs" /></UFormField>
        <div v-for="(source, index) in settings.searchSources" :key="index" class="mt-6 grid gap-4 rounded-lg border border-default bg-elevated/30 p-4 sm:grid-cols-2">
          <UFormField label="ID"><UInput v-model="source.id" maxlength="40" class="w-full" /></UFormField><UFormField label="名称"><UInput v-model="source.label" maxlength="40" class="w-full" /></UFormField>
          <UFormField label="搜索 URL 模板" class="sm:col-span-2"><UInput v-model="source.urlTemplate" maxlength="2048" class="w-full" /></UFormField>
          <div class="flex flex-wrap items-center justify-between gap-4 sm:col-span-2"><UCheckbox v-model="source.enabled" label="启用" /><div class="flex flex-wrap gap-2"><UButton color="neutral" variant="outline" :disabled="index === 0" @click="moveSource(index, -1)">上移</UButton><UButton color="neutral" variant="outline" :disabled="index === settings.searchSources.length - 1" @click="moveSource(index, 1)">下移</UButton><UButton color="error" variant="soft" @click="settings.searchSources.splice(index, 1)">删除</UButton></div></div>
        </div>
      </div>
      <div v-if="section.id === 'translations'" class="space-y-6"><div class="flex flex-wrap items-center justify-between gap-3"><h2 class="font-semibold">内置文案覆盖</h2><UButton size="sm" color="neutral" variant="outline" icon="i-lucide-plus" :disabled="settings.translations.length >= Math.min(80, translationKeys.length)" @click="addTranslation">添加文案</UButton></div>
        <p class="mb-4 text-sm text-muted">仅可覆盖现有 {{ translationKeys.length }} 个内置文案键，不可重复；每项中英文均需填写，最多 240 字。未覆盖的文案继续使用内置翻译。适用于使用文案键的控件，不翻译内容正文或其他页面内文案。</p>
        <div v-if="!settings.translations.length" class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted">暂无文案覆盖，当前使用内置翻译。点击“添加文案”开始自定义。</div>
        <div class="space-y-4"><div v-for="(item, index) in settings.translations" :key="index" class="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <UFormField label="文案键"><USelect v-model="item.key" :items="translationKeys" class="w-full" /></UFormField>
          <UFormField label="简体中文"><UInput v-model="item.zhCN" maxlength="240" class="w-full" /></UFormField>
          <UFormField label="English"><UInput v-model="item.enUS" maxlength="240" class="w-full" /></UFormField>
          <UButton class="self-end" color="error" variant="soft" aria-label="删除文案覆盖" icon="i-lucide-trash-2" @click="settings.translations.splice(index, 1)" />
        </div></div>
      </div>
      <div v-if="section.id === 'mobile-navigation'" class="space-y-6"><div class="flex flex-wrap items-center justify-between gap-3"><h2 class="font-semibold">移动端底部导航 <span class="ml-2 text-sm font-normal text-muted">{{ settings.mobileTabs.length }} / 5</span></h2><UButton size="sm" color="neutral" variant="outline" icon="i-lucide-plus" :disabled="settings.mobileTabs.length >= 5" @click="settings.mobileTabs.push({ label: '', to: '/' })">添加标签</UButton></div>
        <p class="mb-4 text-sm text-muted">最多 5 项，清空后隐藏。支持站内路径与 HTTP(S) 地址，图标按目标路径自动匹配；名称最多 80 字，地址最多 2048 字。内置导航的默认名称随访客语言切换，自定义名称原样显示。</p>
        <div class="mx-auto mt-6 w-full max-w-sm rounded-2xl border-4 border-default bg-default p-3 shadow-lg"><p class="mb-3 text-xs text-muted">移动端底部导航预览</p><div class="h-28 rounded-lg bg-elevated/50 p-3 text-xs text-muted">NavHub 内容区域</div><div v-if="settings.mobileTabs.length" class="mt-3 flex justify-around gap-1 rounded-lg border border-default bg-default p-2"><div v-for="(tab, index) in settings.mobileTabs" :key="index" class="flex min-w-0 flex-1 flex-col items-center gap-1 text-center text-[10px] text-muted"><UIcon :name="{ '/': 'i-lucide-house', '/search': 'i-lucide-search', '/submit': 'i-lucide-upload', '/resources': 'i-lucide-folder-open', '/articles': 'i-lucide-file-text', '/media': 'i-lucide-image', '/rankings': 'i-lucide-chart-no-axes-combined', '/my-navigation': 'i-lucide-bookmark' }[tab.to] ?? 'i-lucide-arrow-up-right'" class="size-4" /><span class="max-w-full truncate">{{ tab.label || `标签 ${index + 1}` }}</span></div></div><p v-else class="mt-3 text-center text-xs text-muted">未配置时，移动端底部导航不显示。</p></div>
        <div v-if="!settings.mobileTabs.length" class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted">暂无导航标签，移动端底部导航已隐藏。</div>
        <div class="space-y-4"><div v-for="(tab, index) in settings.mobileTabs" :key="index" class="grid gap-4 rounded-lg border border-default bg-elevated/30 p-4 sm:grid-cols-2">
          <UFormField :label="`标签 ${index + 1} 名称`"><UInput v-model="tab.label" maxlength="80" class="w-full" /></UFormField>
          <UFormField label="站内路径或 URL"><UInput v-model="tab.to" maxlength="2048" class="w-full" /></UFormField>
          <div class="flex gap-2"><UButton color="neutral" variant="outline" :disabled="index === 0" @click="moveTab(index, -1)">上移</UButton><UButton color="neutral" variant="outline" :disabled="index === settings.mobileTabs.length - 1" @click="moveTab(index, 1)">下移</UButton><UButton color="error" variant="soft" @click="settings.mobileTabs.splice(index, 1)">删除</UButton></div>
        </div></div>
        <div class="mt-6 rounded-xl border border-default bg-elevated/30 p-4"><p class="mb-3 text-sm font-semibold">移动端预览</p><div class="mx-auto max-w-sm rounded-2xl border-4 border-default bg-default p-3 shadow-lg"><div class="h-40 rounded-lg bg-elevated/50 p-3 text-xs text-muted">NavHub 内容区域</div><div class="mt-3 grid grid-cols-5 gap-1 rounded-lg border border-default bg-default p-2"><div v-for="(tab, index) in settings.mobileTabs" :key="index" class="min-w-0 text-center text-[10px] text-muted"><UIcon name="i-lucide-circle" class="mx-auto size-4" /><span class="block truncate">{{ tab.label || `标签 ${index + 1}` }}</span></div></div></div></div>
      </div>
      <div v-if="section.id === 'seo'" class="space-y-6"><div class="space-y-6"><AdminEditorField label="标题"><UInput v-model="settings.seo.title" maxlength="160" class="w-full" /></AdminEditorField><AdminEditorField label="关键词"><UInput v-model="settings.seo.keywords" maxlength="500" class="w-full" /></AdminEditorField><AdminEditorField label="描述" wide><UTextarea v-model="settings.seo.description" maxlength="500" class="w-full" /></AdminEditorField><AdminEditorField label="OG 分享图片"><AdminImagePicker v-model="settings.seo.imageUrl" /></AdminEditorField></div></div>
    </AdminEditor>
  </AdminPage>
</template>
