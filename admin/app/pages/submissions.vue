<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
definePageMeta({ layout: 'default' })
type Submission = { id: string; content_type: string; payload: Record<string, unknown>; status: string; created_at: string; submitter_name?: string | null; contact_email?: string | null; review_note?: string | null; published_content_id?: string | null; duplicate_url?: boolean; similar_title?: boolean }
type List = { items: Submission[]; total: number; page: number; pageSize: number; pageCount: number }
const status = ref('pending')
const contentType = ref('all')
const page = ref(1)
const pageSize = ref(20)
const from = ref('')
const to = ref('')
const { data, refresh, error: loadError, status: loadStatus } = await useFetch<{ submissions: List }>('/api/admin/submissions', { query: computed(() => ({ status: status.value === 'all' ? undefined : status.value, contentType: contentType.value === 'all' ? undefined : contentType.value, from: from.value || undefined, to: to.value || undefined, page: page.value, pageSize: pageSize.value })) })
watch([status, contentType, from, to, pageSize], () => { page.value = 1 })
watch(page, () => { selectedIds.value = [] })
const submissions = computed(() => data.value?.submissions.items ?? [])
const itemForEdit = computed(() => submissions.value.find(item => item.id === editingId.value))
const categories = ref<Array<{ id: string; name: string; parent_id: string | null; sort_order: number }>>([])
const tags = ref<Array<{ id: string; name: string }>>([])
const selectedCategory = ref<string[]>([])
const selectedTags = ref<string[]>([])
const busy = ref(false)
const error = ref('')
const selectedIds = ref<string[]>([])
const previewItem = ref<Submission | null>(null)
const payloadDraft = ref<Record<string, string | number | null>>({})
const editingId = ref<string | null>(null)
const history = ref<Array<{ previous_status: string; status: string; note: string | null; created_at: string }>>([])
async function loadDetail(item: Submission) {
  editingId.value = item.id; error.value = ''; payloadDraft.value = normalizePayload(item.payload); selectedCategory.value = []; selectedTags.value = []
  try {
    const detail = await $fetch<Submission & { history: typeof history.value }>(`/api/admin/submissions/${item.id}`)
    payloadDraft.value = normalizePayload(detail.payload); history.value = detail.history
    const [cats, tagsResult] = await Promise.all([$fetch<{ categories: typeof categories.value }>('/api/admin/categories'), $fetch<{ tags: Array<{ id: string; name: string }> }>('/api/admin/tags')])
    categories.value = cats.categories; tags.value = tagsResult.tags
  } catch (err) { error.value = message(err) }
}
async function bulkReview(nextStatus: 'approved' | 'rejected' | 'spam' | 'offline') {
  if (!selectedIds.value.length || busy.value) return
  const note = window.prompt(nextStatus === 'approved' ? '批量通过备注（可留空）' : '批量处理备注（可留空）')
  if (note === null) return
  busy.value = true; error.value = ''
  try { await $fetch('/api/admin/submissions/bulk', { method: 'PATCH', body: { ids: selectedIds.value, status: nextStatus, note: note || null } }); selectedIds.value = []; await refresh() }
  catch (err) { error.value = message(err) } finally { busy.value = false }
}
function normalizePayload(payload: Record<string, unknown>) { return Object.fromEntries(Object.entries(payload).filter((entry): entry is [string, string | number | null] => entry[1] === null || typeof entry[1] === 'string' || typeof entry[1] === 'number')) }
function message(err: unknown) { return err && typeof err === 'object' && 'data' in err ? String((err as { data?: { message?: string } }).data?.message ?? '操作失败') : '操作失败，请重试' }
async function review(item: Submission, nextStatus: 'approved' | 'rejected' | 'spam' | 'offline') {
  if (busy.value) return
  const note = window.prompt(nextStatus === 'approved' ? '审核备注（可留空）' : '处理备注（可留空）')
  if (note === null) return
  busy.value = true; error.value = ''
  try {
    await $fetch(`/api/admin/submissions/${item.id}`, { method: 'PATCH', body: { status: nextStatus, note: note || null, payload: nextStatus === 'approved' ? payloadDraft.value : undefined, categoryIds: item.content_type === 'site' && nextStatus === 'approved' ? selectedCategory.value : [], tagIds: selectedTags.value } })
    editingId.value = null; await refresh()
  } catch (err) { error.value = message(err) } finally { busy.value = false }
}
const columns: TableColumn<Submission>[] = [
  { accessorKey: 'payload', header: '投稿内容' },
  { accessorKey: 'content_type', header: '类型' },
  { accessorKey: 'submitter_name', header: '投稿者' },
  { accessorKey: 'created_at', header: '提交时间' },
  { accessorKey: 'status', header: '状态' },
  { id: 'actions', header: '操作', enableHiding: false }
]
function rowActions(item: Submission) {
  return [
    ...(item.published_content_id ? [{ label: '查看已发布内容', icon: 'i-lucide-external-link', to: item.content_type === 'site' ? `/sites/${String(item.payload.slug ?? '')}` : `/${item.content_type === 'resource' ? 'resources' : item.content_type === 'media' ? 'media' : 'articles'}/${String(item.payload.slug ?? '')}`, external: true, target: '_blank' }] : []),
    ...(item.status === 'approved' && item.published_content_id ? [{ label: '下线', icon: 'i-lucide-eye-off', color: 'error' as const, onSelect: () => review(item, 'offline') }] : []),
    ...(item.status === 'pending' ? [
      { label: '审核前预览', icon: 'i-lucide-eye', onSelect: () => { previewItem.value = item } },
      { label: '查看 / 修订', icon: 'i-lucide-pencil', onSelect: () => loadDetail(item) },
      { label: '通过并发布', icon: 'i-lucide-check', disabled: editingId.value !== item.id, onSelect: () => review(item, 'approved') },
      { label: '拒绝', icon: 'i-lucide-x', color: 'error' as const, onSelect: () => review(item, 'rejected') },
      { label: '标记垃圾', icon: 'i-lucide-ban', color: 'error' as const, onSelect: () => review(item, 'spam') }
    ] : [])
  ]
}
</script>

<template>
  <AdminPage title="投稿审核">
    <UAlert v-if="error || loadError" color="error" :description="error || '投稿加载失败，请重试。'" />
    <AdminTable v-model:page="page" v-model:selected="selectedIds" :data="submissions" :columns="columns"
      :total="data?.submissions.total ?? 0" :page-size="pageSize" :loading="busy || loadStatus === 'pending'"
      empty-title="暂无投稿" empty-description="访客提交的网站和内容会在这里等待审核。" selectable>
      <template #filters>
        <USelect v-model="status"
          :items="[{ label: '全部', value: 'all' }, { label: '待审核', value: 'pending' }, { label: '已通过', value: 'approved' }, { label: '已拒绝', value: 'rejected' }, { label: '垃圾', value: 'spam' }]"
          class="min-w-28" aria-label="筛选状态" />
        <USelect v-model="contentType"
          :items="[{ label: '全部类型', value: 'all' }, { label: '网站', value: 'site' }, { label: '资源', value: 'resource' }, { label: '媒体', value: 'media' }, { label: '文章', value: 'article' }]"
          class="min-w-28" aria-label="筛选类型" />
        <UInput v-model="from" type="date" aria-label="开始日期" />
        <UInput v-model="to" type="date" aria-label="结束日期" />
      </template>
      <template #page-size><USelect v-model="pageSize" :items="[10, 20, 50, 100]" aria-label="每页数量" class="w-20" /></template>
      <template #bulk>
        <div v-if="selectedIds.length" class="flex flex-wrap gap-2">
          <UButton @click="bulkReview('approved')">批量通过并发布</UButton>
          <UButton color="error" variant="soft" @click="bulkReview('rejected')">批量拒绝</UButton>
          <UButton color="error" variant="outline" @click="bulkReview('offline')">批量下线</UButton>
        </div>
      </template>
      <template #payload-cell="{ row }">
        <div class="max-w-lg">
          <p class="font-medium text-highlighted">{{ String(row.original.payload.title ?? '未命名投稿') }}</p>
          <p class="truncate text-sm text-muted">{{ String(row.original.payload.description ??
            row.original.payload.summary ?? '') }}</p>
          <div class="flex flex-wrap gap-1">
            <UBadge v-if="row.original.duplicate_url" color="error" variant="subtle">重复 URL</UBadge>
            <UBadge v-if="row.original.similar_title" color="warning" variant="subtle">标题相似</UBadge>
          </div>
        </div>
      </template>
      <template #created_at-cell="{ row }"><span class="whitespace-nowrap text-muted">{{ new
        Date(row.original.created_at).toLocaleString('zh-CN') }}</span></template>
      <template #status-cell="{ row }">
        <UBadge
          :color="row.original.status === 'approved' ? 'success' : row.original.status === 'pending' ? 'warning' : 'neutral'"
          variant="subtle">{{ row.original.status }}</UBadge>
      </template>
      <template #actions-cell="{ row }">
        <UDropdownMenu :items="rowActions(row.original)" :content="{ align: 'end' }">
          <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" aria-label="投稿操作" />
        </UDropdownMenu>
      </template>
    </AdminTable>
    <UModal :open="!!editingId" title="审核投稿" description="核对并修订投稿内容后进行审核"
      @update:open="value => { if (!value) editingId = null }">
      <template #body>
        <div class="grid gap-4">
          <UAlert v-if="error" color="error" :description="error" />
          <p v-if="itemForEdit?.contact_email" class="text-sm text-muted">联系邮箱：{{ itemForEdit.contact_email }}</p>
          <p v-if="itemForEdit?.review_note" class="text-sm text-muted">审核备注：{{ itemForEdit.review_note }}</p>
          <UFormField label="标题">
            <UInput :model-value="String(payloadDraft.title ?? '')" @update:model-value="payloadDraft.title = $event"
              maxlength="160" class="w-full" />
          </UFormField>
          <UFormField v-if="'description' in payloadDraft" label="描述">
            <UTextarea :model-value="String(payloadDraft.description ?? '')"
              @update:model-value="payloadDraft.description = $event" maxlength="2000" class="w-full" />
          </UFormField>
          <UFormField v-if="'summary' in payloadDraft" label="摘要">
            <UTextarea :model-value="String(payloadDraft.summary ?? '')"
              @update:model-value="payloadDraft.summary = $event" maxlength="2000" class="w-full" />
          </UFormField>
          <UFormField v-if="'body' in payloadDraft" label="正文">
            <UTextarea :model-value="String(payloadDraft.body ?? '')" @update:model-value="payloadDraft.body = $event"
              :rows="6" maxlength="50000" class="w-full" />
          </UFormField>
          <UFormField
            v-for="field in ['targetUrl', 'coverUrl', 'iconUrl', 'slug'].filter(field => field in payloadDraft)"
            :key="field" :label="{ targetUrl: '目标 URL', coverUrl: '封面 URL', iconUrl: '图标 URL', slug: 'Slug' }[field]">
            <UInput :model-value="String(payloadDraft[field] ?? '')" @update:model-value="payloadDraft[field] = $event"
              :type="field === 'slug' ? 'text' : 'url'" class="w-full" />
          </UFormField>
          <UFormField v-if="'resourceType' in payloadDraft" label="资源类型">
            <USelect :model-value="String(payloadDraft.resourceType ?? '')"
              @update:model-value="payloadDraft.resourceType = $event"
              :items="[{ label: '软件', value: 'software' }, { label: '网站', value: 'website' }, { label: '文档', value: 'document' }, { label: '其他', value: 'other' }]" />
          </UFormField>
          <UFormField v-if="'mediaType' in payloadDraft" label="媒体类型">
            <USelect :model-value="String(payloadDraft.mediaType ?? '')"
              @update:model-value="payloadDraft.mediaType = $event"
              :items="[{ label: '书籍', value: 'book' }, { label: '电影', value: 'movie' }, { label: '音乐', value: 'music' }, { label: '其他', value: 'other' }]" />
          </UFormField>
          <UFormField v-if="'rating' in payloadDraft" label="评分">
            <UInput :model-value="String(payloadDraft.rating ?? '')"
              @update:model-value="payloadDraft.rating = $event === '' ? null : Number($event)" type="number" min="0"
              max="10" step="0.1" />
          </UFormField>
          <UFormField v-if="itemForEdit?.content_type === 'site'" label="分类">
            <AdminCategoryCascader v-model="selectedCategory" :categories="categories" />
          </UFormField>
          <UFormField label="标签">
            <USelect v-model="selectedTags" :items="tags.map(tag => ({ label: tag.name, value: tag.id }))" multiple />
          </UFormField>
          <p v-for="entry in history" :key="entry.created_at" class="text-sm text-muted">{{ entry.previous_status }} →
            {{ entry.status }} · {{ entry.created_at }} {{ entry.note }}</p>
          <div class="flex flex-wrap gap-2">
            <UButton :disabled="busy" @click="itemForEdit && review(itemForEdit, 'approved')">通过并发布</UButton>
            <UButton color="error" variant="soft" :disabled="busy"
              @click="itemForEdit && review(itemForEdit, 'rejected')">拒绝</UButton>
            <UButton color="error" variant="outline" :disabled="busy"
              @click="itemForEdit && review(itemForEdit, 'spam')">垃圾</UButton>
          </div>
        </div>
      </template>
    </UModal>
    <UModal :open="!!previewItem" title="审核前预览" description="以下内容按正式页面的公开字段预览，尚未发布。"
      @update:open="value => { if (!value) previewItem = null }">
      <template #body>
        <article v-if="previewItem" class="space-y-4">
          <p class="text-sm text-muted">{{ previewItem.content_type }}</p>
          <h2 class="text-xl font-semibold">{{ String(previewItem.payload.title ?? '未命名投稿') }}</h2>
          <p v-if="previewItem.payload.description || previewItem.payload.summary"
            class="whitespace-pre-wrap text-muted">{{ String(previewItem.payload.description ??
              previewItem.payload.summary ?? '') }}</p>
          <pre v-if="previewItem.payload.body"
            class="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-elevated p-4 text-sm">{{ String(previewItem.payload.body) }}</pre>
          <a v-if="previewItem.payload.targetUrl" :href="String(previewItem.payload.targetUrl)" target="_blank"
            rel="noopener noreferrer" class="text-primary underline">打开目标地址</a>
        </article>
      </template>
    </UModal>
  </AdminPage>
</template>
