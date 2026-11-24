<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
definePageMeta({ layout: 'default' })
const route = useRoute()
const id = String(route.query.id ?? '')
const { data, error: loadError, refresh } = await useFetch<{ category: { id: string; name: string }; items: Array<{ id: string; title: string; slug: string; target_url: string; pinned: boolean; sort_order: number }> }>(`/api/admin/categories/${encodeURIComponent(id)}/sites`)
if (loadError.value?.statusCode === 404) throw createError({ statusCode: 404, statusMessage: '分类不存在' })
const rows = ref(data.value?.items.map(item => ({ ...item })) ?? [])
watch(() => data.value?.items, items => { if (items) rows.value = items.map(item => ({ ...item })) })
const busy = ref(false)
const error = ref('')
const columns: TableColumn<(typeof rows.value)[number]>[] = [
  { accessorKey: 'title', header: '网站' }, { accessorKey: 'target_url', header: '目标地址' },
  { accessorKey: 'pinned', header: '置顶' }, { accessorKey: 'sort_order', header: '分类内排序' }
]
function move(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= rows.value.length) return
  ;[rows.value[index], rows.value[target]] = [rows.value[target]!, rows.value[index]!]
  rows.value.forEach((item, order) => { item.sort_order = order })
}
async function save() {
  if (busy.value) return
  busy.value = true; error.value = ''
  try {
    rows.value.forEach((item, index) => { if (!Number.isInteger(item.sort_order) || item.sort_order < 0) throw new Error('排序必须为非负整数') })
    await $fetch(`/api/admin/categories/${encodeURIComponent(id)}/sites`, { method: 'PUT', body: { items: rows.value.map(item => ({ id: item.id, pinned: item.pinned, sortOrder: item.sort_order })) } })
    await refresh()
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '保存失败，请重试' }
  finally { busy.value = false }
}
</script>
<template>
  <AdminPage :title="`${data?.category.name ?? '分类'} · 网站排序`" description="置顶优先；其余按分类内排序值排列。同一网站在其他分类中的顺序不受影响。">
    <template #actions><UButton :loading="busy" @click="save">保存排序</UButton></template>
    <template #toolbar><UDashboardToolbar><UButton to="/categories" color="neutral" variant="link" icon="i-lucide-arrow-left">分类管理</UButton></UDashboardToolbar></template>
    <UAlert v-if="loadError || error" color="error" variant="soft" role="alert" :description="error || '分类网站加载失败，请刷新重试。'" />
    <AdminTable :data="rows" :columns="columns" :total="rows.length" :page-size="100" :loading="!data" :empty-title="'该分类暂无已发布网站'" :empty-description="'发布并关联网站后，可在这里调整此分类中的显示顺序。'">
      <template #title-cell="{ row }"><NuxtLink :to="`/sites/update?id=${row.original.id}`" class="font-medium">{{ row.original.title }}</NuxtLink></template>
      <template #target_url-cell="{ row }"><span class="block max-w-96 truncate" :title="row.original.target_url">{{ row.original.target_url }}</span></template>
      <template #pinned-cell="{ row }"><UCheckbox v-model="row.original.pinned" :aria-label="`置顶${row.original.title}`" /></template>
      <template #sort_order-cell="{ row }"><div class="flex items-center gap-2"><UInput v-model.number="row.original.sort_order" type="number" min="0" max="999999" class="w-24" :aria-label="`${row.original.title}的分类内排序`" /><UButton color="neutral" variant="ghost" icon="i-lucide-arrow-up" :disabled="row.index === 0" :aria-label="`${row.original.title}上移`" @click="move(row.index, -1)" /><UButton color="neutral" variant="ghost" icon="i-lucide-arrow-down" :disabled="row.index === rows.length - 1" :aria-label="`${row.original.title}下移`" @click="move(row.index, 1)" /></div></template>
    </AdminTable>
  </AdminPage>
</template>
