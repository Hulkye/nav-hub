<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
definePageMeta({ layout: 'default' })
type Check = { id: string; title: string; target_url: string; content_type: 'site' | 'resource'; checked_at: string | null; result_category: string | null; status_code: number | null; error_summary: string | null; ignored_at: string | null }
const failedOnly = ref(false)
const includeIgnored = ref(false)
const query = computed(() => ({ failedOnly: String(failedOnly.value), includeIgnored: String(includeIgnored.value) }))
const { data, refresh } = await useFetch<{ items: Check[]; schedule: { failures: { total: number; longstanding: number }; runs: Array<{ id: string; started_at: string; status: string; checked_count: number; failed_count: number }> } }>('/api/admin/link-health', { query })
const selected = ref<string[]>([])
const busy = ref(false)
const error = ref('')
const resultLabels: Record<string, string> = { pending: '待检查', ok: '正常', http_error: 'HTTP 错误', timeout: '超时', dns_error: 'DNS 错误', unsafe_target: '地址不安全', redirect_error: '重定向异常', network_error: '网络错误' }
const items = computed(() => data.value?.items ?? [])
function key(item: Check) { return `${item.content_type === 'site' ? 'sites' : 'resources'}:${item.id}` }
function splitKey(value: string) { const [type, ...id] = value.split(':'); return { type, id: id.join(':') } }
async function run(ids: string[], retryFailed = false) {
  if (busy.value || !ids.length) return
  busy.value = true; error.value = ''
  try { await $fetch('/api/admin/link-health', { method: 'POST', body: { ids: ids.map(value => splitKey(value).id), retryFailed } }); selected.value = []; await refresh() }
  catch (err) { error.value = err && typeof err === 'object' && 'data' in err ? String((err as { data?: { message?: string } }).data?.message ?? '检查失败') : '检查失败，请稍后重试' }
  finally { busy.value = false }
}
async function toggleIgnored(item: Check) {
  busy.value = true; error.value = ''
  try { await $fetch(`/api/admin/link-health/${item.content_type === 'site' ? 'sites' : 'resources'}/${item.id}`, { method: 'PATCH', body: { ignored: !item.ignored_at } }); await refresh() }
  catch (err) { error.value = err && typeof err === 'object' && 'data' in err ? String((err as { data?: { message?: string } }).data?.message ?? '更新失败') : '更新失败，请稍后重试' }
  finally { busy.value = false }
}
const q = ref('')
const page = ref(1)
const pageSize = ref(20)
const filtered = computed(() => items.value.filter(item => (item.title + ' ' + item.target_url).toLowerCase().includes(q.value.toLowerCase())))
const visible = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
watch([q, failedOnly, includeIgnored, pageSize], () => { page.value = 1; selected.value = [] })
const columns: TableColumn<Check>[] = [{ accessorKey: 'title', header: '内容' }, { accessorKey: 'target_url', header: '链接' }, { accessorKey: 'result_category', header: '检查结果' }, { accessorKey: 'checked_at', header: '检查时间' }, { id: 'actions', header: '操作', enableHiding: false }]
function rowActions(item: Check) { return [
  { label: '重试检查', icon: 'i-lucide-refresh-cw', onSelect: () => run([key(item)], true) },
  { label: item.ignored_at ? '取消忽略' : '忽略', icon: 'i-lucide-eye-off', onSelect: () => toggleIgnored(item) }
] }
</script>
<template>
  <AdminPage title="链接健康检查" description="检查已发布网站与资源的链接可用性">
    <template #actions><UButton :disabled="busy || !selected.length" icon="i-lucide-heart-pulse" @click="run(selected)">检查所选</UButton></template>
    <UAlert v-if="error" color="error" :description="error" />
    <UAlert v-if="data?.schedule.failures.total" color="warning" title="发现失效链接" :description="`${data.schedule.failures.total} 个链接检查失败，${data.schedule.failures.longstanding} 个失败结果超过 7 天未复查。请筛选失败项后重试、修正或忽略。`" />
    <p v-if="data?.schedule.runs[0]" class="text-sm text-muted">最近定时巡检：{{ data.schedule.runs[0].started_at }} · {{ data.schedule.runs[0].status === 'completed' ? '完成' : data.schedule.runs[0].status === 'running' ? '运行中' : '失败' }} · 检查 {{ data.schedule.runs[0].checked_count }} 项，失败 {{ data.schedule.runs[0].failed_count }} 项</p>
    <AdminTable v-model:page="page" v-model:selected="selected" :row-key="key" :data="visible" :columns="columns" :total="filtered.length" :page-size="pageSize" :loading="busy" empty-title="暂无待检查链接" empty-description="已发布的网站和资源链接会显示在这里。" selectable>
      <template #search><UInput v-model="q" icon="i-lucide-search" placeholder="搜索内容或链接…" class="max-w-sm" aria-label="搜索链接" /></template>
      <template #filters><UCheckbox v-model="failedOnly" label="仅失败链接" /><UCheckbox v-model="includeIgnored" label="包含已忽略" /></template>
      <template #page-size><USelect v-model="pageSize" :items="[10,20,50,100]" aria-label="每页数量" class="w-20" /></template>
      <template #bulk><div class="flex flex-wrap gap-1.5"><UButton color="neutral" variant="outline" :disabled="busy" @click="run(items.filter(item => !item.result_category || item.result_category === 'pending').map(key))">检查未检查项</UButton><UButton color="neutral" variant="outline" :disabled="busy" @click="run(items.filter(item => item.result_category && item.result_category !== 'ok' && item.result_category !== 'pending' && !item.ignored_at).map(key), true)">重试失败项</UButton></div></template>
      <template #target_url-cell="{ row }"><span class="block truncate" :title="row.original.target_url">{{ row.original.target_url }}</span></template>
      <template #result_category-cell="{ row }"><UBadge :color="row.original.result_category === 'ok' ? 'success' : 'neutral'" variant="subtle">{{ resultLabels[row.original.result_category ?? ''] ?? '未检查' }}</UBadge><p class="text-xs text-muted">{{ row.original.error_summary }}{{ row.original.status_code ? ' · HTTP ' + row.original.status_code : '' }}{{ row.original.ignored_at ? ' · 已忽略' : '' }}</p></template>
      <template #actions-cell="{ row }"><UDropdownMenu :items="rowActions(row.original)" :content="{ align: 'end' }"><UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" aria-label="链接操作" :disabled="busy" /></UDropdownMenu></template>
    </AdminTable>
  </AdminPage>
</template>
