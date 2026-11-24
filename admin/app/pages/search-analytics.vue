<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
definePageMeta({ layout: 'default' })
type Term = { term: string; content_type: string; searches: number; clicks?: number; zero_results?: number }
type Analytics = { days: number; searches: number; clicks: number; zero_results: number; conversion_rate: number; zero_result_terms: Term[]; top_terms: Term[] }
const { data, status, error } = await useFetch<Analytics>('/api/admin/search-analytics')
const labels: Record<string, string> = { all: '全部', site: '网站', resource: '资源', media: '书影音', article: '文章', announcement: '公告' }
const activeTab = ref('zero')
type TermRow = Term & { id: string }
const columns: TableColumn<TermRow>[] = [{ accessorKey: 'term', header: '关键词' }, { accessorKey: 'content_type', header: '类型' }, { accessorKey: 'searches', header: '搜索次数' }, { accessorKey: 'clicks', header: '点击次数' }]
const zeroRows = computed<TermRow[]>(() => (data.value?.zero_result_terms ?? []).map((item, index) => ({ ...item, id: `${item.term}:${item.content_type}:${index}`, clicks: item.zero_results })))
const topRows = computed<TermRow[]>(() => (data.value?.top_terms ?? []).map((item, index) => ({ ...item, id: `${item.term}:${item.content_type}:${index}` })))
</script>
<template>
  <AdminPage title="搜索分析" description="过去 30 天的搜索与点击汇总；不记录访客身份。">
    <UAlert v-if="error" color="error" description="搜索分析加载失败，请稍后重试。" />
    <div class="grid gap-4 sm:grid-cols-3">
      <UCard v-for="item in [{ label: '搜索次数', value: data?.searches ?? 0 }, { label: '结果点击', value: data?.clicks ?? 0 }, { label: '搜索转化率', value: `${((data?.conversion_rate ?? 0) * 100).toFixed(1)}%` }]" :key="item.label">
        <p class="text-sm text-muted">{{ item.label }}</p><p class="mt-2 text-2xl font-semibold tabular-nums">{{ item.value }}</p>
      </UCard>
    </div>
    <UCard class="mt-6">
      <template #header><UTabs v-model="activeTab" :items="[{ label: '无结果关键词', value: 'zero' }, { label: '热门搜索词', value: 'popular' }]" :content="false" size="sm" class="w-fit" :ui="{ root: 'w-fit flex-col', list: 'w-fit', trigger: 'grow-0 min-h-11 px-5 py-3' }" /></template>
      <AdminTable v-if="activeTab === 'zero'" :data="zeroRows" :columns="columns" :total="zeroRows.length" :page-size="50" :loading="status === 'pending'" empty-title="暂无无结果关键词" empty-description="访客搜索无匹配结果的关键词会汇总在这里。">
        <template #content_type-cell="{ row }">{{ labels[row.original.content_type] ?? row.original.content_type }}</template>
      </AdminTable>
      <AdminTable v-else :data="topRows" :columns="columns" :total="topRows.length" :page-size="50" :loading="status === 'pending'" empty-title="暂无搜索记录" empty-description="搜索统计还没有数据。">
        <template #content_type-cell="{ row }">{{ labels[row.original.content_type] ?? row.original.content_type }}</template>
      </AdminTable>
    </UCard>
  </AdminPage>
</template>
