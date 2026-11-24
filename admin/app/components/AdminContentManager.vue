<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AdminContentCollection } from '#shared/schemas/admin-content'
import { resourceSchema, mediaSchema } from '#shared/schemas/admin-content'
const props = defineProps<{ collection: AdminContentCollection; title: string; editor?: boolean }>()
const route = useRoute()
const returnTo = `/${props.collection}`
type Row = { id: string; title: string; status: string; [key: string]: unknown }
type ListResponse = Record<string, { items: Row[]; total: number; page: number; pageSize: number; pageCount: number }>
const endpoint = `/api/admin/${props.collection}`
const page = ref(1)
const pageSize = ref(20)
const q = ref('')
const status = ref('all')
const selectedIds = ref<string[]>([])
const previewItem = ref<Row | null>(null)
const previewOpen = computed({ get: () => previewItem.value !== null, set: (open: boolean) => { if (!open) previewItem.value = null } })
const tagIds = ref<string[]>([])
const categoryIds = ref<string[]>([])
const [{ data: tagData }, { data: categoryData }] = await Promise.all([
  useFetch<{ tags: Array<{ id: string; name: string }> }>('/api/admin/tags'),
  useFetch<{ categories: Array<{ id: string; name: string; parent_id: string | null; sort_order: number }> }>('/api/admin/categories')
])
const query = computed(() => ({ page: page.value, pageSize: pageSize.value, q: q.value || undefined, status: status.value === 'all' ? undefined : status.value }))
const { data, error: loadError, status: loadStatus, refresh } = await useFetch<ListResponse>(endpoint, { query, immediate: !props.editor })
const list = computed(() => data.value?.[props.collection] ?? { items: [], total: 0, page: 1, pageSize: 20, pageCount: 0 })
const rows = computed(() => list.value.items)
watch([q, status, pageSize], () => { page.value = 1; selectedIds.value = [] })
watch(page, () => { selectedIds.value = [] })
const editingId = ref<string | null>(null)
function create() { return navigateTo(`${returnTo}/update`) }
const busy = ref(false)
const error = ref('')
const defaults = () => ({ title: '', slug: '', description: '', summary: '', body: '', coverUrl: '', targetUrl: '', resourceType: 'software', mediaType: 'book', rating: '', status: 'draft', startsAt: '', endsAt: '' })
const form = ref(defaults())
const enrichment = ref<Record<string, unknown>>({})
const statusLabels = ref<Record<string, string>>({ draft: '草稿', published: '已发布', offline: '已下线' })
function reset() { editingId.value = null; Object.assign(form.value, defaults()); enrichment.value = {}; tagIds.value = []; categoryIds.value = []; error.value = '' }
function localDate(value: unknown) {
  if (!value) return ''
  const date = new Date(String(value))
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
function edit(row: Row) {
  reset()
  editingId.value = row.id
  Object.assign(form.value, { title: row.title, slug: row.slug ?? '', description: row.description ?? '', summary: row.summary ?? '', body: row.body ?? '', coverUrl: row.cover_url ?? '', targetUrl: row.target_url ?? '', resourceType: row.resource_type ?? 'software', mediaType: row.media_type ?? 'book', rating: row.rating == null ? '' : String(row.rating), status: row.status, startsAt: localDate(row.starts_at), endsAt: localDate(row.ends_at) })
  tagIds.value = Array.isArray(row.tag_ids) ? row.tag_ids.map(String) : []
  categoryIds.value = Array.isArray(row.category_ids) ? row.category_ids.map(String) : []
  enrichment.value = props.collection === 'resources' ? { platforms: row.platforms ?? [], version: row.version ?? '', screenshots: row.screenshots ?? [], downloadSources: row.download_sources ?? [], versionHistory: row.version_history ?? [] } : { author: row.author ?? '', director: row.director ?? '', publisher: row.publisher ?? '', releaseDate: row.release_date ? new Date(String(row.release_date)).toISOString().slice(0, 10) : null, channels: row.channels ?? [] }
}
if (props.editor && route.query.id) {
  const row = await useRequestFetch()<Row>(`${endpoint}/${String(route.query.id)}`)
  edit(row)
}
function openEdit(row: Row) { return navigateTo({ path: `${returnTo}/update`, query: { id: row.id } }) }
function payload() {
  const base = { title: form.value.title, status: form.value.status, tagIds: tagIds.value, categoryIds: categoryIds.value }
  if (props.collection === 'announcements') return { ...base, body: form.value.body, targetUrl: form.value.targetUrl || null, startsAt: form.value.startsAt ? new Date(form.value.startsAt).toISOString() : null, endsAt: form.value.endsAt ? new Date(form.value.endsAt).toISOString() : null }
  const content = { ...base, slug: form.value.slug, coverUrl: form.value.coverUrl || null }
  if (props.collection === 'resources') return resourceSchema.parse({ ...content, ...enrichment.value, description: form.value.description, resourceType: form.value.resourceType, targetUrl: form.value.targetUrl })
  if (props.collection === 'media') return mediaSchema.parse({ ...content, ...enrichment.value, description: form.value.description, mediaType: form.value.mediaType, rating: form.value.rating === '' ? null : Number(form.value.rating) })
  return { ...content, summary: form.value.summary, body: form.value.body }
}
function message(err: unknown) {
  if (err && typeof err === 'object' && 'issues' in err) return (err as { issues: Array<{ path: PropertyKey[]; message: string }> }).issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('；')
  if (err && typeof err === 'object' && 'data' in err) {
    const value = (err as { data?: { message?: string; statusMessage?: string } }).data
    return value?.message ?? value?.statusMessage ?? '操作失败，请稍后重试'
  }
  return '操作失败，请检查输入后重试'
}
async function save(publish = false) {
  if (busy.value) return
  busy.value = true; error.value = ''
  try {
    if (publish) form.value.status = 'published'
    await $fetch(editingId.value ? `${endpoint}/${editingId.value}` : endpoint, { method: editingId.value ? 'PATCH' : 'POST', body: payload() })
    await navigateTo(returnTo)
  } catch (err) { error.value = message(err) } finally { busy.value = false }
}
async function preview(row: Row) {
  busy.value = true; error.value = ''
  try { previewItem.value = await $fetch<Row>(`${endpoint}/${row.id}`) } catch (err) { error.value = message(err) } finally { busy.value = false }
}
function toggleRow(id: string) {
  selectedIds.value = selectedIds.value.includes(id) ? selectedIds.value.filter(value => value !== id) : [...selectedIds.value, id]
}
function togglePage(checked: boolean) {
  const current = rows.value.map(row => row.id)
  selectedIds.value = checked ? [...new Set([...selectedIds.value, ...current])] : selectedIds.value.filter(id => !current.includes(id))
}
async function bulkStatus(nextStatus: 'draft' | 'published' | 'offline') {
  if (busy.value || !selectedIds.value.length) return
  if (!confirm(`将 ${selectedIds.value.length} 项内容设为「${statusLabels.value[nextStatus]}」？`)) return
  busy.value = true; error.value = ''
  try {
    await $fetch(`${endpoint}/bulk`, { method: 'PATCH', body: { ids: selectedIds.value, status: nextStatus } })
    selectedIds.value = []; await refresh()
  } catch (err) { error.value = message(err) } finally { busy.value = false }
}
async function remove(row: Row) {
  if (busy.value || !confirm(`确定删除「${row.title}」吗？`)) return
  busy.value = true; error.value = ''
  try {
    await $fetch(`${endpoint}/${row.id}`, { method: 'DELETE' })
    if (editingId.value === row.id) reset()
    if (rows.value.length === 1 && page.value > 1) page.value--
    await refresh()
  } catch (err) { error.value = message(err) } finally { busy.value = false }
}
const columns: TableColumn<Row>[] = [
  { accessorKey: 'title', header: '标题' },
  { accessorKey: 'slug', header: 'Slug' },
  { accessorKey: 'status', header: '状态' },
  { id: 'actions', header: '操作', enableHiding: false }
]
function rowActions(row: Row) {
  return [
    { label: '预览', icon: 'i-lucide-eye', onSelect: () => preview(row) },
    { label: '编辑', icon: 'i-lucide-pencil', onSelect: () => openEdit(row) },
    { label: '删除', icon: 'i-lucide-trash', color: 'error' as const, onSelect: () => remove(row) }
  ]
}
</script>

<template>
<AdminPage :title="editor ? `${editingId ? '编辑' : '新增'}${title}` : `${title}管理`">
  <template #actions><AdminContentTransfer v-if="!editor" :collection="collection" @imported="refresh()" /><UButton v-if="!editor" icon="i-lucide-plus" @click="create">新增{{ title }}</UButton></template>
  <template v-if="editor" #toolbar><UDashboardToolbar><UButton :to="returnTo" color="neutral" variant="link" icon="i-lucide-arrow-left">{{ title }}列表</UButton></UDashboardToolbar></template>
  <div class="contents">
  <UAlert v-if="loadError" color="error" variant="soft" title="加载失败" description="请刷新重试。" />
  <UAlert v-if="error && !editor" color="error" :description="error" />
  <div class="contents">
    <AdminEditor v-if="editor" :title="(editingId ? '编辑' : '新增') + title" :description="'维护' + title + '内容与发布设置。'" :return-to="returnTo" :busy="busy" :error="error" publish @save="save">

        <AdminEditorField label="标题" description="显示在公开页面和内容列表中的标题。"><UInput class="w-full" v-model="form.title" required maxlength="160" /></AdminEditorField>
        <AdminEditorField label="Slug" v-if="collection !== 'announcements'" description="用于详情页 URL，仅支持小写字母、数字和连字符。"><UInput class="w-full" v-model="form.slug" required maxlength="120" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></AdminEditorField>
        <AdminEditorField label="资源类型" v-if="collection === 'resources'" description="选择资源的内容类型。"><USelect class="w-full" :items="[{ label: '软件', value: 'software' }, { label: '网站', value: 'website' }, { label: '文档', value: 'document' }, { label: '其他', value: 'other' }]" v-model="form.resourceType" /></AdminEditorField>
        <AdminEditorField label="媒体类型" v-if="collection === 'media'" description="选择书籍、电影、音乐或其他媒体。"><USelect class="w-full" :items="[{ label: '图书', value: 'book' }, { label: '电影', value: 'movie' }, { label: '音乐', value: 'music' }, { label: '其他', value: 'other' }]" v-model="form.mediaType" /></AdminEditorField>
        <AdminEditorField :label="(String(collection === 'resources' ? '目标地址' : '跳转地址（可选）'))" v-if="collection === 'resources' || collection === 'announcements'"><UInput class="w-full" v-model="form.targetUrl" type="url" :required="collection === 'resources'" maxlength="2048" placeholder="https://" /></AdminEditorField>
        <AdminEditorField label="封面图片（可选）" v-if="collection !== 'announcements'" description="上传或从图片库选择，图片会自动转换为 WebP。"><AdminImagePicker v-model="form.coverUrl" /></AdminEditorField>
        <AdminEditorField label="评分（0–10，可选）" v-if="collection === 'media'" description="可选，支持 0 到 10 分。"><UInput class="w-full" v-model="form.rating" type="number" min="0" max="10" step="0.1" /></AdminEditorField>
        <AdminEditorField label="简介" v-if="collection === 'resources' || collection === 'media'" description="简要介绍内容，帮助访客了解其用途。" wide><UTextarea class="w-full" v-model="form.description" :rows="4" maxlength="2000" /></AdminEditorField>
        <AdminContentEnrichment v-if="collection === 'resources' || collection === 'media'" v-model="enrichment" :collection="collection" :media-type="form.mediaType" />
        <AdminEditorField label="分类" v-if="collection !== 'announcements'" description="支持多选一级分类和子分类。"><AdminCategoryCascader v-model="categoryIds" :categories="categoryData?.categories ?? []" /></AdminEditorField>
        <AdminEditorField label="摘要" v-if="collection === 'articles'" description="用于文章列表和预览的简短介绍。" wide><UTextarea class="w-full" v-model="form.summary" :rows="3" maxlength="2000" /></AdminEditorField>
        <AdminEditorField label="正文" v-if="collection === 'articles' || collection === 'announcements'" description="填写公开展示的完整内容。" wide><AdminArticleBody v-if="collection === 'articles'" v-model="form.body" /><UTextarea v-else class="w-full" v-model="form.body" :rows="10" required maxlength="50000" /></AdminEditorField>
        <template v-if="collection === 'announcements'"><AdminEditorField label="开始时间（本地时间，可选）" description="留空表示发布后立即生效。"><UInput class="w-full" v-model="form.startsAt" type="datetime-local" /></AdminEditorField><AdminEditorField label="结束时间（本地时间，可选）" description="留空表示不限制展示时间。"><UInput class="w-full" v-model="form.endsAt" type="datetime-local" /></AdminEditorField><p class="text-sm text-muted">发布后在起止时间内公开；留空表示不限制。</p></template>
        <AdminEditorField label="标签" v-if="collection !== 'announcements'" description="为内容添加标签，便于访客查找。"><USelect class="w-full" :items="(tagData?.tags ?? []).map(tag => ({ label: tag.name, value: tag.id }))" v-model="tagIds" multiple /></AdminEditorField>
        <AdminEditorField label="状态" description="草稿和下线内容不会在前台公开。"><USelect class="w-full" :items="[{ label: '草稿', value: 'draft' }, { label: '发布', value: 'published' }, { label: '下线', value: 'offline' }]" v-model="form.status" /></AdminEditorField>

    </AdminEditor>
    <AdminTable v-else v-model:page="page" v-model:selected="selectedIds" :data="rows" :columns="columns" :total="list.total" :page-size="pageSize" :loading="loadStatus === 'pending'" :empty-title="`暂无${title}`" :empty-description="q || status !== 'all' ? '调整搜索词或筛选条件，再试一次。' : `属于${title}的故事还未开始，下一份精彩正在路上。`" selectable>
      <template #search><UInput v-model="q" class="max-w-sm" icon="i-lucide-search" placeholder="搜索标题或关键词…" aria-label="搜索内容" /></template>
      <template #filters>
        <USelect v-model="status" :items="[{ label: '全部状态', value: 'all' }, { label: '草稿', value: 'draft' }, { label: '已发布', value: 'published' }, { label: '已下线', value: 'offline' }]" class="min-w-28" aria-label="筛选状态" />
      </template>
      <template #page-size><USelect v-model="pageSize" :items="[10, 20, 50, 100]" class="w-20" aria-label="每页数量" /></template>
      <template #bulk><div v-if="selectedIds.length" class="flex flex-wrap gap-1.5"><UButton color="neutral" variant="outline" :disabled="busy" @click="bulkStatus('published')">批量发布</UButton><UButton color="neutral" variant="outline" :disabled="busy" @click="bulkStatus('offline')">批量下线</UButton><UButton color="neutral" variant="outline" :disabled="busy" @click="bulkStatus('draft')">转为草稿</UButton></div></template>
      <template #title-cell="{ row }"><span class="font-medium text-highlighted">{{ row.original.title }}</span></template>
      <template #status-cell="{ row }"><UBadge :color="row.original.status === 'published' ? 'success' : row.original.status === 'offline' ? 'error' : 'neutral'" variant="subtle">{{ statusLabels[row.original.status] ?? row.original.status }}</UBadge></template>
      <template #actions-cell="{ row }"><UDropdownMenu :items="rowActions(row.original)" :content="{ align: 'end' }"><UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" aria-label="记录操作" :disabled="busy" /></UDropdownMenu></template>
    </AdminTable>
  </div>
  <UModal v-model:open="previewOpen" :title="previewItem?.title ?? `${title}预览`" :description="`${title}内容预览`" ><template #body><div v-if="previewItem" class="space-y-4"><UBadge color="neutral" variant="subtle">{{ statusLabels[previewItem.status] ?? previewItem.status }}</UBadge><p v-if="previewItem.description">{{ previewItem.description }}</p><p v-if="previewItem.summary">{{ previewItem.summary }}</p><pre v-if="previewItem.body" class="whitespace-pre-wrap break-words font-sans">{{ previewItem.body }}</pre><ULink v-if="previewItem.target_url" :to="String(previewItem.target_url)" target="_blank" class="break-all">{{ previewItem.target_url }}</ULink></div></template></UModal>
</div></AdminPage>
</template>


