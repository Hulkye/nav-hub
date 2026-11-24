<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
definePageMeta({ layout: 'default' })
type StatsItem = { event_type: string; content_type: string; content_id: string; title?: string; count: number }
type Stats = { days: number; start: string; end: string; totals: Array<{ event_type: string; count: number }>; items: StatsItem[] }
const days = ref(7)
const { data, status, error } = await useFetch<Stats>('/api/admin/stats', { query: computed(() => ({ days: days.value })) })
const views = computed(() => data.value?.totals.find(item => item.event_type === 'view')?.count ?? 0)
const clicks = computed(() => data.value?.totals.find(item => item.event_type === 'outbound_click')?.count ?? 0)
const labels: Record<string, string> = { site: '网站', resource: '资源', media: '媒体', article: '文章', announcement: '公告' }
const q = ref('')
const page = ref(1)
const pageSize = ref(20)
const rows = computed(() => (data.value?.items ?? []).filter(item => (item.title ?? item.content_id).toLowerCase().includes(q.value.toLowerCase())).map(item => ({ ...item, id: `${item.event_type}:${item.content_type}:${item.content_id}` })))
const visible = computed(() => rows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
watch([q, days, pageSize], () => { page.value = 1 })
const columns: TableColumn<StatsItem & { id: string }>[] = [{ accessorKey: 'title', header: '内容' }, { accessorKey: 'content_type', header: '类型' }, { accessorKey: 'event_type', header: '事件' }, { accessorKey: 'count', header: '次数' }]
</script>

<template>
  <AdminPage title="访问统计">
    <template #toolbar>
      <UDashboardToolbar>
        <USelect v-model="days"
          :items="[{ label: '最近 7 天', value: 7 }, { label: '最近 30 天', value: 30 }, { label: '最近 90 天', value: 90 }]"
          aria-label="统计周期" />
      </UDashboardToolbar>
    </template>
    <div class="grid gap-4 sm:grid-cols-2">
      <UCard
        v-for="item in [{ label: '详情访问', count: views, icon: 'i-lucide-eye' }, { label: '外链点击', count: clicks, icon: 'i-lucide-mouse-pointer-click' }]"
        :key="item.label">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-muted">{{ item.label }}</p>
            <p class="mt-2 text-3xl font-semibold tabular-nums">{{ item.count }}</p>
          </div>
          <UIcon :name="item.icon" class="size-6 text-primary" />
        </div>
      </UCard>
    </div>
    <UAlert v-if="error" color="error" description="统计加载失败，请重试。" />
    <AdminTable v-model:page="page" :data="visible" :columns="columns" :total="rows.length" :page-size="pageSize"
      :loading="status === 'pending'" empty-title="暂无统计数据" empty-description="所选周期内还没有详情访问或外链点击记录。">
      <template #search>
        <UInput v-model="q" icon="i-lucide-search" placeholder="搜索热门内容…" aria-label="搜索统计内容" class="max-w-sm" />
      </template>
      <template #filters>
      </template>
      <template #page-size><USelect v-model="pageSize" :items="[10, 20, 50, 100]" aria-label="每页数量" class="w-20" /></template>
      <template #title-cell="{ row }"><span class="font-medium text-highlighted">{{ row.original.title ??
        row.original.content_id }}</span></template>
      <template #content_type-cell="{ row }">{{ labels[row.original.content_type] ?? row.original.content_type
        }}</template>
      <template #event_type-cell="{ row }">
        <UBadge color="neutral" variant="subtle">{{ row.original.event_type === 'view' ? '详情访问' : '外链点击' }}</UBadge>
      </template>
    </AdminTable>
  </AdminPage>
</template>
