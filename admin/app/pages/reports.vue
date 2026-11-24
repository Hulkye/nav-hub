<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
definePageMeta({ layout: 'default' })
type Report = { id: string; content_title: string; content_type: string; content_id: string; reason: string; details: string; status: string; review_note: string | null; reviewed_at: string | null; created_at: string }
type List = { items: Report[]; total: number; page: number }
const status = ref('pending'); const page = ref(1); const pageSize = ref(20); const busy = ref(false); const error = ref('')
const { data, refresh, error: loadError, status: loadStatus } = await useFetch<{ reports: List }>('/api/admin/reports', { query: computed(() => ({ status: status.value === 'all' ? undefined : status.value, page: page.value, pageSize: pageSize.value })) })
watch([status, pageSize], () => { page.value = 1 })
const reports = computed(() => data.value?.reports.items ?? [])
const selected = ref<Report | null>(null)
const detailOpen = computed({ get: () => selected.value !== null, set: (value: boolean) => { if (!value) selected.value = null } })
const reasonLabels: Record<string, string> = { broken_link: '链接失效', wrong_content: '内容不准确', spam: '垃圾内容', copyright: '版权问题', other: '其他' }
const typeLabels: Record<string, string> = { site: '网站', resource: '资源', media: '媒体', article: '文章' }
const statusLabels: Record<string, string> = { pending: '待处理', reviewed: '已处理', dismissed: '已驳回' }
function message(err: unknown) { return err && typeof err === 'object' && 'data' in err ? String((err as { data?: { message?: string } }).data?.message ?? '操作失败') : '操作失败，请重试' }
async function review(item: Report, next: 'reviewed' | 'dismissed') {
  const note = window.prompt('处理备注（可留空，最多 1000 字）'); if (note === null || busy.value) return
  if (note.length > 1000) { error.value = '处理备注最多 1000 字'; return }
  busy.value = true; error.value = ''
  try { await $fetch(`/api/admin/reports/${item.id}`, { method: 'PATCH', body: { status: next, note: note || null } }); selected.value = null; await refresh() } catch (err) { error.value = message(err) } finally { busy.value = false }
}
const columns: TableColumn<Report>[] = [{ accessorKey: 'content_title', header: '内容' }, { accessorKey: 'content_type', header: '类型' }, { accessorKey: 'reason', header: '原因' }, { accessorKey: 'details', header: '说明' }, { accessorKey: 'status', header: '状态' }, { accessorKey: 'created_at', header: '提交时间' }, { id: 'actions', header: '操作', enableHiding: false }]
function rowActions(item: Report) { return [{ label: '查看详情', icon: 'i-lucide-eye', onSelect: () => { selected.value = item } }, ...(item.status === 'pending' ? [{ label: '已处理', icon: 'i-lucide-check', onSelect: () => review(item, 'reviewed') }, { label: '驳回', icon: 'i-lucide-x', color: 'error' as const, onSelect: () => review(item, 'dismissed') }] : [])] }
</script>
<template>
  <AdminPage title="举报处理">
    <UAlert v-if="error || loadError" color="error" :description="error || '举报加载失败，请重试。'" />
    <AdminTable v-model:page="page" :data="reports" :columns="columns" :total="data?.reports.total ?? 0" :page-size="20"
      :loading="busy || loadStatus === 'pending'" empty-title="暂无举报" empty-description="公开页面提交的举报会显示在这里。">
      <template #filters>
        <USelect v-model="status"
          :items="[{ label: '待处理', value: 'pending' }, { label: '全部', value: 'all' }, { label: '已处理', value: 'reviewed' }, { label: '已驳回', value: 'dismissed' }]"
          class="min-w-28" aria-label="筛选举报状态" />
      </template>
      <template #page-size><USelect v-model="pageSize" :items="[10, 20, 50, 100]" aria-label="每页数量" class="w-20" /></template>
      <template #content_title-cell="{ row }"><span class="font-medium text-highlighted">{{ row.original.content_title
        || '内容已删除' }}</span></template>
      <template #content_type-cell="{ row }">{{ typeLabels[row.original.content_type] }}</template>
      <template #reason-cell="{ row }">{{ reasonLabels[row.original.reason] }}</template>
      <template #status-cell="{ row }">
        <UBadge
          :color="row.original.status === 'pending' ? 'warning' : row.original.status === 'reviewed' ? 'success' : 'neutral'"
          variant="subtle">{{ statusLabels[row.original.status] }}</UBadge>
      </template>
      <template #details-cell="{ row }">
        <p class="max-w-xl truncate" :title="row.original.details">{{ row.original.details || '未填写' }}</p>
      </template>
      <template #created_at-cell="{ row }"><span class="whitespace-nowrap text-muted">{{ new
        Date(row.original.created_at).toLocaleString('zh-CN') }}</span></template>
      <template #actions-cell="{ row }">
        <UDropdownMenu :items="rowActions(row.original)" :content="{ align: 'end' }">
          <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" aria-label="举报操作"
            :disabled="busy" />
        </UDropdownMenu>
      </template>
    </AdminTable>
    <UModal v-model:open="detailOpen" title="举报详情" description="查看举报说明和处理结果">
      <template #body>
        <div v-if="selected" class="space-y-4 break-words">
          <p class="font-medium">{{ selected.content_title || '内容已删除' }} · {{ typeLabels[selected.content_type] }}</p>
          <p>{{ reasonLabels[selected.reason] }} · {{ statusLabels[selected.status] }}</p>
          <p class="whitespace-pre-wrap">{{ selected.details || '未填写补充说明' }}</p>
          <p v-if="selected.review_note" class="whitespace-pre-wrap">处理备注：{{ selected.review_note }}</p>
          <p v-if="selected.reviewed_at">处理时间：{{ new Date(selected.reviewed_at).toLocaleString('zh-CN') }}</p>
          <div v-if="selected.status === 'pending'" class="flex flex-wrap gap-2">
            <UButton :disabled="busy" @click="review(selected, 'reviewed')">标记已处理</UButton>
            <UButton color="neutral" variant="outline" :disabled="busy" @click="review(selected, 'dismissed')">驳回举报
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </AdminPage>
</template>
