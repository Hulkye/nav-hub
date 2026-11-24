<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
definePageMeta({ layout: 'default' })
type Site = { id: string; title: string; slug: string; description: string; target_url: string; status: string; category_ids: string[]; link_health_failed: boolean; duplicate_site: boolean }
type Category = { id: string; name: string; parent_id: string | null; sort_order: number }
type Tag = { id: string; name: string }
type SiteList = { items: Site[]; total: number; page: number; pageSize: number; pageCount: number }
const page = ref(1)
const pageSize = ref(20)
const q = ref('')
const status = ref('all')
const categoryId = ref('all')
const qualityIssue = ref('all')
const query = computed(() => ({ page: page.value, pageSize: pageSize.value, q: q.value || undefined, status: status.value === 'all' ? undefined : status.value, categoryId: categoryId.value === 'all' ? undefined : categoryId.value, qualityIssue: qualityIssue.value === 'all' ? undefined : qualityIssue.value }))
const { data, refresh, error: loadError, status: loadStatus } = await useFetch<{ sites: SiteList; quality: Record<string, number> }>('/api/admin/sites', { query })
const { data: categoryData } = await useFetch<{ categories: Category[] }>('/api/admin/categories')
const { data: tagData } = await useFetch<{ tags: Tag[] }>('/api/admin/tags')
const list = computed(() => data.value?.sites ?? { items: [], total: 0, page: 1, pageSize: 20, pageCount: 0 })
watch([q, status, categoryId, pageSize], () => { page.value = 1; selectedIds.value = [] })
watch(qualityIssue, () => { page.value = 1; selectedIds.value = [] })
watch(page, () => { selectedIds.value = [] })
const error = ref('')
const selectedIds = ref<string[]>([])
const taxonomyOpen = ref(false)
const replaceDomainOpen = ref(false)
const bulkCategoryIds = ref<string[]>([])
const bulkTagIds = ref<string[]>([])
const oldHost = ref('')
const newHost = ref('')
const bulkBusy = ref(false)
function toggleRow(id: string) { selectedIds.value = selectedIds.value.includes(id) ? selectedIds.value.filter(value => value !== id) : [...selectedIds.value, id] }
function togglePage(checked: boolean) { const ids = list.value.items.map(site => site.id); selectedIds.value = checked ? [...new Set([...selectedIds.value, ...ids])] : selectedIds.value.filter(id => !ids.includes(id)) }
async function bulkStatus(nextStatus: 'draft' | 'published' | 'offline') {
  if (!selectedIds.value.length || !confirm(`将 ${selectedIds.value.length} 个网站设为 ${nextStatus}？`)) return
  error.value = ''
  try { await $fetch('/api/admin/sites/bulk', { method: 'PATCH', body: { ids: selectedIds.value, status: nextStatus } }); selectedIds.value = []; await refresh() } catch (err: unknown) { error.value = err && typeof err === 'object' && 'data' in err ? String((err as { data?: { message?: string } }).data?.message ?? '批量操作失败') : '批量操作失败' }
}
async function bulkTaxonomy() {
  if (!selectedIds.value.length || bulkBusy.value || !confirm(`将为所选 ${selectedIds.value.length} 个网站统一设置分类和标签？未选择的分类/标签关联也会被清除。`)) return
  bulkBusy.value = true; error.value = ''
  try { await $fetch('/api/admin/sites/bulk-taxonomy', { method: 'PATCH', body: { ids: selectedIds.value, categoryIds: bulkCategoryIds.value, tagIds: bulkTagIds.value } }); selectedIds.value = []; taxonomyOpen.value = false; await refresh() }
  catch (err: unknown) { error.value = err && typeof err === 'object' && 'data' in err ? String((err as { data?: { message?: string } }).data?.message ?? '批量更新分类和标签失败') : '批量更新分类和标签失败' }
  finally { bulkBusy.value = false }
}
async function replaceDomain() {
  if (!selectedIds.value.length || bulkBusy.value || !confirm(`仅替换所选网站主地址、备用地址和预览地址中主机名完全为「${oldHost.value}」的链接；继续吗？`)) return
  bulkBusy.value = true; error.value = ''
  try { await $fetch('/api/admin/sites/replace-domain', { method: 'PATCH', body: { ids: selectedIds.value, oldHost: oldHost.value, newHost: newHost.value } }); selectedIds.value = []; replaceDomainOpen.value = false; oldHost.value = ''; newHost.value = ''; await refresh() }
  catch (err: unknown) { error.value = err && typeof err === 'object' && 'data' in err ? String((err as { data?: { message?: string } }).data?.message ?? '批量替换域名失败') : '批量替换域名失败' }
  finally { bulkBusy.value = false }
}
async function remove(site: Site) {
  if (!confirm(`确定删除「${site.title}」吗？`)) return
  error.value = ''
  try { await $fetch(String(`/api/admin/sites/${site.id}`), { method: 'DELETE' }); if (list.value.items.length === 1 && page.value > 1) page.value--; await refresh() } catch (err: unknown) { error.value = err && typeof err === 'object' && 'data' in err ? String((err as { data?: { message?: string } }).data?.message ?? '删除失败') : '删除失败' }
}
const columns: TableColumn<Site>[] = [
  { accessorKey: 'title', header: '网站' },
  { accessorKey: 'target_url', header: '网址' },
  { accessorKey: 'status', header: '状态' },
  { id: 'actions', header: '操作', enableHiding: false }
]
function rowActions(site: Site) {
  return [
    { label: '编辑', icon: 'i-lucide-pencil', to: { path: '/sites/update', query: { id: site.id } } },
    { label: '删除', icon: 'i-lucide-trash', color: 'error' as const, onSelect: () => remove(site) }
  ]
}
</script>
<template>
  <AdminPage title="网站管理">
    <template #actions><AdminContentTransfer collection="sites" :export-query="{ q: q || undefined, status: status === 'all' ? undefined : status, categoryId: categoryId === 'all' ? undefined : categoryId, qualityIssue: qualityIssue === 'all' ? undefined : qualityIssue }" @imported="refresh()" /><UButton to="/sites/update" icon="i-lucide-plus">新增网站</UButton></template>
    <UAlert v-if="error || loadError" color="error" :description="error || '网站加载失败，请重试。'" />
    <AdminTable v-model:page="page" v-model:selected="selectedIds" :data="list.items" :columns="columns" :total="list.total" :page-size="pageSize" :loading="loadStatus === 'pending'" :empty-title="'暂无网站'" :empty-description="q || status !== 'all' || categoryId !== 'all' || qualityIssue !== 'all' ? '调整筛选条件，再试一次。' : '值得收藏的世界很大，这里正等待第一颗星光。'" selectable>
      <template #search><UInput v-model="q" icon="i-lucide-search" placeholder="搜索名称、Slug 或网址…" class="max-w-sm" aria-label="搜索网站" /></template>
      <template #filters>
        <USelect v-model="status" :items="[{ label: '全部状态', value: 'all' }, { label: '草稿', value: 'draft' }, { label: '已发布', value: 'published' }, { label: '已下线', value: 'offline' }]" class="min-w-28" aria-label="筛选状态" />
        <USelect v-model="categoryId" :items="[{ label: '全部分类', value: 'all' }, ...(categoryData?.categories ?? []).map(item => ({ label: item.name, value: item.id }))]" class="min-w-28" aria-label="筛选分类" />
        <USelect v-model="qualityIssue" :items="[{ label: '全部质量', value: 'all' }, { label: `缺少描述 · ${data?.quality.missing_description ?? 0}`, value: 'missing_description' }, { label: `分类为空 · ${data?.quality.missing_category ?? 0}`, value: 'missing_category' }, { label: `URL 失效 · ${data?.quality.broken_url ?? 0}`, value: 'broken_url' }, { label: `重复站点 · ${data?.quality.duplicate_site ?? 0}`, value: 'duplicate_site' }]" class="min-w-36" aria-label="内容质量筛选" />
      </template>
      <template #page-size><USelect v-model="pageSize" :items="[10, 20, 50, 100]" class="w-20" aria-label="每页数量" /></template>
      <template #bulk><div v-if="selectedIds.length" class="flex flex-wrap gap-1.5"><UButton color="neutral" variant="outline" @click="taxonomyOpen = true">批量改分类/标签</UButton><UButton color="neutral" variant="outline" @click="replaceDomainOpen = true">批量替换域名</UButton><UButton color="neutral" variant="outline" @click="bulkStatus('published')">批量发布</UButton><UButton color="neutral" variant="outline" @click="bulkStatus('offline')">批量下线</UButton><UButton color="neutral" variant="outline" @click="bulkStatus('draft')">转为草稿</UButton></div></template>
      <template #title-cell="{ row }"><div class="font-medium text-highlighted">{{ row.original.title }}</div><div class="text-xs text-muted">{{ row.original.slug }}</div></template>
      <template #target_url-cell="{ row }"><span class="block truncate" :title="row.original.target_url">{{ row.original.target_url }}</span></template>
      <template #status-cell="{ row }"><UBadge :color="row.original.status === 'published' ? 'success' : row.original.status === 'offline' ? 'error' : 'neutral'" variant="subtle">{{ { published: '已发布', draft: '草稿', offline: '已下线' }[row.original.status] ?? row.original.status }}</UBadge></template>
      <template #actions-cell="{ row }"><UDropdownMenu :items="rowActions(row.original)" :content="{ align: 'end' }"><UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" aria-label="网站操作" /></UDropdownMenu></template>
    </AdminTable>
    <UModal v-model:open="taxonomyOpen" title="批量设置分类和标签" description="所选网站将统一替换为下面选中的关联；留空表示清除该类关联。">
      <template #body><div class="space-y-4"><UFormField label="分类"><AdminCategoryCascader v-model="bulkCategoryIds" :categories="categoryData?.categories ?? []" /></UFormField><UFormField label="标签"><USelect v-model="bulkTagIds" :items="tagData?.tags.map(item => ({ label: item.name, value: item.id })) ?? []" multiple class="w-full" /></UFormField><div class="flex justify-end gap-2"><UButton color="neutral" variant="outline" @click="taxonomyOpen = false">取消</UButton><UButton :loading="bulkBusy" @click="bulkTaxonomy">应用到所选</UButton></div></div></template>
    </UModal>
    <UModal v-model:open="replaceDomainOpen" title="批量替换域名" description="仅匹配主机名完全一致的主地址、备用地址和预览地址，不修改路径、正文或其他文字。">
      <template #body><div class="space-y-4"><UFormField label="原域名" description="例如 old.example.com"><UInput v-model="oldHost" placeholder="old.example.com" class="w-full" /></UFormField><UFormField label="新域名" description="不填写协议或路径"><UInput v-model="newHost" placeholder="new.example.com" class="w-full" /></UFormField><div class="flex justify-end gap-2"><UButton color="neutral" variant="outline" @click="replaceDomainOpen = false">取消</UButton><UButton color="warning" :loading="bulkBusy" :disabled="!oldHost || !newHost" @click="replaceDomain">替换所选网站</UButton></div></div></template>
    </UModal>
  </AdminPage>
</template>
