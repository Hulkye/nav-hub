<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({ layout: 'default' })
type ReportRow = { rowNumber: number; status: string; id?: string; errors?: string[] }
type Batch = { id: string; collection: string; collection_label: string; total_rows: number; imported_rows: number; rejected_rows: number; created_at: string; row_results: ReportRow[] }
const { data, status, error, refresh } = await useFetch<{ batches: Batch[] }>('/api/admin/imports')
const route = useRoute()
const collections = ['sites', 'resources', 'media', 'articles', 'announcements']
const filter = computed({
  get: () => typeof route.query.collection === 'string' && collections.includes(route.query.collection) ? route.query.collection : 'all',
  set: (collection: string) => {
    void navigateTo({ path: '/imports', query: { ...route.query, collection: collection === 'all' ? undefined : collection } })
  }
})
const page = ref(1)
const pageSize = ref(20)
const batches = computed(() => (data.value?.batches ?? []).filter(batch => filter.value === 'all' || batch.collection === filter.value).map(batch => ({ ...batch, id: batch.id })))
watch(filter, () => { page.value = 1 })
function download(batch: Batch) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(batch, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `import-${batch.id}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
const columns: TableColumn<Batch>[] = [
  { accessorKey: 'created_at', header: '导入时间' },
  { accessorKey: 'collection_label', header: '内容类型' },
  { accessorKey: 'total_rows', header: '总行数' },
  { accessorKey: 'imported_rows', header: '成功' },
  { accessorKey: 'rejected_rows', header: '失败' },
  { id: 'actions', header: '操作', enableHiding: false }
]
</script>

<template>
  <AdminPage title="导入记录" description="查看网站、资源、媒体、文章和公告的批量导入结果。">
    <UAlert v-if="error" color="error" description="导入记录加载失败，请刷新重试。" />
    <AdminTable v-model:page="page" :data="batches" :columns="columns" :total="batches.length" :page-size="pageSize" :loading="status === 'pending'" empty-title="暂无导入记录" empty-description="从各内容列表导入数据后，批次和逐行结果会显示在这里。">
      <template #filters>
        <USelect v-model="filter" :items="[{ label: '全部类型', value: 'all' }, { label: '网站', value: 'sites' }, { label: '资源', value: 'resources' }, { label: '媒体', value: 'media' }, { label: '文章', value: 'articles' }, { label: '公告', value: 'announcements' } ]" class="min-w-32" aria-label="筛选内容类型" />
        <UButton color="neutral" variant="outline" icon="i-lucide-refresh-cw" :loading="status === 'pending'" @click="refresh()">刷新</UButton>
      </template>
      <template #page-size><USelect v-model="pageSize" :items="[10, 20, 50, 100]" class="w-20" aria-label="每页数量" /></template>
      <template #created_at-cell="{ row }"><span class="whitespace-nowrap">{{ new Date(row.original.created_at).toLocaleString('zh-CN') }}</span></template>
      <template #imported_rows-cell="{ row }"><UBadge color="success" variant="subtle">{{ row.original.imported_rows }}</UBadge></template>
      <template #rejected_rows-cell="{ row }"><UBadge :color="row.original.rejected_rows ? 'error' : 'neutral'" variant="subtle">{{ row.original.rejected_rows }}</UBadge></template>
      <template #actions-cell="{ row }"><UButton color="neutral" variant="outline" icon="i-lucide-download" @click="download(row.original)">下载报告</UButton></template>
    </AdminTable>
  </AdminPage>
</template>
