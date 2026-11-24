<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
definePageMeta({ layout: 'default' })
type Comment = { id: string; display_name: string; body: string; status: string; created_at: string; content_type: string; content_id: string }
type List = { items: Comment[]; total: number; page: number; pageSize: number; pageCount: number }
const status = ref('pending')
const page = ref(1)
const pageSize = ref(20)
const from = ref('')
const to = ref('')
const { data, refresh, error: loadError, status: loadStatus } = await useFetch<{ comments: List }>('/api/admin/comments', { query: computed(() => ({ status: status.value === 'all' ? undefined : status.value, from: from.value || undefined, to: to.value || undefined, page: page.value, pageSize: pageSize.value })) })
watch([status, from, to, pageSize], () => { page.value = 1 })
const comments = computed(() => data.value?.comments.items ?? [])
const busy = ref(false)
const error = ref('')
const history = ref<Record<string, Array<{ previous_status: string; status: string; created_at: string }>>>({})
function message(err: unknown) { return err && typeof err === 'object' && 'data' in err ? String((err as { data?: { message?: string } }).data?.message ?? '操作失败') : '操作失败，请重试' }
async function review(id: string, next: 'approved' | 'rejected' | 'spam') { if (busy.value) return; const note = window.prompt('审核备注（可留空）'); if (note === null) return; busy.value = true; error.value = ''; try { await $fetch(`/api/admin/comments/${id}`, { method: 'PATCH', body: { status: next, note: note || null } }); await refresh(); await loadHistory(id) } catch (err) { error.value = message(err) } finally { busy.value = false } }
async function loadHistory(id: string) { try { const detail = await $fetch<{ history: Array<{ previous_status: string; status: string; created_at: string }> }>(`/api/admin/comments/${id}`); history.value[id] = detail.history } catch (err) { error.value = message(err) } }
const columns: TableColumn<Comment>[] = [
  { accessorKey: 'display_name', header: '评论者' },
  { accessorKey: 'body', header: '评论' },
  { accessorKey: 'content_type', header: '内容类型' },
  { accessorKey: 'status', header: '状态' },
  { accessorKey: 'created_at', header: '提交时间' },
  { id: 'actions', header: '操作', enableHiding: false }
]
function rowActions(comment: Comment) {
  return [
    { label: '审核历史', icon: 'i-lucide-history', onSelect: () => loadHistory(comment.id) },
    ...(comment.status === 'pending' ? [
      { label: '通过', icon: 'i-lucide-check', onSelect: () => review(comment.id, 'approved') },
      { label: '拒绝', icon: 'i-lucide-x', color: 'error' as const, onSelect: () => review(comment.id, 'rejected') },
      { label: '标记垃圾', icon: 'i-lucide-ban', color: 'error' as const, onSelect: () => review(comment.id, 'spam') }
    ] : [])
  ]
}
</script>
<template>
  <AdminPage title="评论审核">
    <UAlert v-if="error || loadError" color="error" :description="error || '评论加载失败，请重试。'" />
    <AdminTable v-model:page="page" :data="comments" :columns="columns" :total="data?.comments.total ?? 0" :page-size="20" :loading="busy || loadStatus === 'pending'" empty-title="暂无评论" empty-description="公开页面收到的评论会在这里显示并等待审核。">
      <template #filters>
        <USelect v-model="status" :items="[{ label: '全部', value: 'all' }, { label: '待审核', value: 'pending' }, { label: '已通过', value: 'approved' }, { label: '已拒绝', value: 'rejected' }, { label: '垃圾', value: 'spam' }]" class="min-w-28" aria-label="筛选状态" />
        <UInput v-model="from" type="date" aria-label="开始日期" />
        <UInput v-model="to" type="date" aria-label="结束日期" />
      </template>
      <template #page-size><USelect v-model="pageSize" :items="[10, 20, 50, 100]" aria-label="每页数量" class="w-20" /></template>
      <template #display_name-cell="{ row }"><span class="font-medium text-highlighted">{{ row.original.display_name }}</span></template>
      <template #body-cell="{ row }"><p class="max-w-xl truncate" :title="row.original.body">{{ row.original.body }}</p></template>
      <template #created_at-cell="{ row }"><span class="whitespace-nowrap text-muted">{{ new Date(row.original.created_at).toLocaleString('zh-CN') }}</span></template>
      <template #status-cell="{ row }"><UBadge :color="row.original.status === 'approved' ? 'success' : row.original.status === 'rejected' || row.original.status === 'spam' ? 'error' : 'warning'" variant="subtle">{{ row.original.status }}</UBadge></template>
      <template #actions-cell="{ row }"><UDropdownMenu :items="rowActions(row.original)" :content="{ align: 'end' }"><UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" aria-label="评论操作" /></UDropdownMenu></template>
    </AdminTable>
    <UAlert v-if="error" color="error" :description="error" />
    <UCard v-for="comment in comments.filter(item => history[item.id])" :key="comment.id"><template #header>{{ comment.display_name }} · 审核历史</template><p v-for="entry in history[comment.id]" :key="entry.created_at" class="text-sm text-muted">{{ entry.previous_status }} → {{ entry.status }} · {{ new Date(entry.created_at).toLocaleString('zh-CN') }}</p></UCard>
  </AdminPage>
</template>

