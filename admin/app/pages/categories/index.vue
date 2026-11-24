<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import TaxonomyIcon from '#shared/components/TaxonomyIcon.vue'
import { categoryDefaultIcons } from '#shared/utils/taxonomy-icons'
import { buildCategoryTree, filterCategoryTree, flattenCategoryTree } from '#shared/utils/category-tree'
import type { CategoryTreeItem, CategoryNode } from '#shared/utils/category-tree'
definePageMeta({ layout: 'default' })
type Category = CategoryTreeItem
type Tag = { id: string; name: string; slug: string; description: string; sort_order: number; icon_name?: string | null }
const { data: categoryData, refresh: refreshCategories } = await useFetch<{ categories: Category[] }>('/api/admin/categories')
const { data: tagData, refresh: refreshTags } = await useFetch<{ tags: Tag[] }>('/api/admin/tags')
const categories = computed(() => categoryData.value?.categories ?? [])
const tags = computed(() => tagData.value?.tags ?? [])
const orderedCategories = computed(() => [...categories.value].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)))
const categoryTree = computed(() => buildCategoryTree(categories.value))
const orderedTags = computed(() => [...tags.value].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)))
const busy = ref(false)
const error = ref('')
function message(err: unknown) {
  if (err && typeof err === 'object' && 'data' in err) return String((err as { data?: { message?: string } }).data?.message ?? '操作失败')
  return '操作失败，请稍后重试'
}
function moveCategory(category: Category, direction: -1 | 1) {
  const ordered = orderedCategories.value.filter(item => item.parent_id === category.parent_id)
  const index = ordered.findIndex(item => item.id === category.id)
  const target = index + direction
  if (target < 0 || target >= ordered.length) return
  ;[ordered[index], ordered[target]] = [ordered[target]!, ordered[index]!]
  const siblingOrder = new Map(ordered.map((item, order) => [item.id, order]))
  const reordered = categories.value.map(item => siblingOrder.has(item.id) ? { ...item, sort_order: siblingOrder.get(item.id)! } : item)
  categoryData.value = { categories: flattenCategoryTree(buildCategoryTree(reordered)).map((item, sort_order) => ({ ...item, sort_order })) }
}
function moveTag(tag: Tag, direction: -1 | 1) {
  const ordered = [...tags.value].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  const index = ordered.findIndex(item => item.id === tag.id)
  const target = index + direction
  if (target < 0 || target >= ordered.length) return
  ;[ordered[index], ordered[target]] = [ordered[target]!, ordered[index]!]
  ordered.forEach((item, order) => { item.sort_order = order })
  tagData.value = { tags: ordered }
}
async function saveOrder(kind: 'categories' | 'tags') {
  busy.value = true; error.value = ''
  try {
    const items = (kind === 'categories' ? flattenCategoryTree(categoryTree.value) : orderedTags.value).map((item, sortOrder) => ({ id: item.id, sortOrder }))
    await $fetch(`/api/admin/${kind}/order`, { method: 'PUT', body: { items } })
    if (kind === 'categories') await refreshCategories(); else await refreshTags()
  } catch (err) { error.value = message(err) } finally { busy.value = false }
}
async function removeCategory(category: Category) {
  if (!confirm(`删除分类「${category.name}」？站点关联将解除，子分类将移为顶级分类。`)) return
  busy.value = true; error.value = ''
  try { await $fetch(`/api/admin/categories/${category.id}`, { method: 'DELETE' }); await refreshCategories() } catch (err) { error.value = message(err) } finally { busy.value = false }
}
async function removeTag(tag: Tag) {
  if (!confirm(`删除标签「${tag.name}」？站点上的此标签关联将解除。`)) return
  busy.value = true; error.value = ''
  try { await $fetch(`/api/admin/tags/${tag.id}`, { method: 'DELETE' }); await refreshTags() } catch (err) { error.value = message(err) } finally { busy.value = false }
}
const kind = 'categories' as const
const q = ref('')
const page = ref(1)
const pageSize = ref(20)
const expanded = ref<true | Record<string, boolean>>({})
const filteredTree = computed(() => filterCategoryTree(categoryTree.value, q.value))
const getSubRows = (row: Tag & { children?: CategoryNode[] }) => row.children
const source = computed(() => orderedCategories.value)
const filtered = computed(() => filteredTree.value)
const visible = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
const totalLabel = computed(() => `共 ${filteredTree.value.length} 个顶级分类 · ${flattenCategoryTree(filteredTree.value).length} 个分类`)
watch(q, value => { if (value.trim()) expanded.value = true })
watch([q, pageSize], () => { page.value = 1 })
watch(() => filtered.value.length, count => { page.value = Math.min(page.value, Math.max(1, Math.ceil(count / pageSize.value))) })
const columns: TableColumn<Tag>[] = [{ accessorKey: 'name', header: '名称' }, { accessorKey: 'slug', header: 'Slug' }, { accessorKey: 'description', header: '描述' }, { accessorKey: 'sort_order', header: '排序' }, { id: 'actions', header: '操作', enableHiding: false }]
function rowActions(item: Tag) {
  const category = categories.value.find(category => category.id === item.id)
  const siblings = category ? orderedCategories.value.filter(entry => entry.parent_id === category.parent_id) : source.value
  const index = siblings.findIndex(entry => entry.id === item.id)
  return [
    ...(category ? [{ label: '管理网站排序', icon: 'i-lucide-list-ordered', to: { path: '/categories/sites', query: { id: category.id } } }] : []),
    { label: '上移', icon: 'i-lucide-arrow-up', disabled: busy.value || index === 0, onSelect: () => category ? moveCategory(category, -1) : moveTag(item, -1) },
    { label: '下移', icon: 'i-lucide-arrow-down', disabled: busy.value || index === siblings.length - 1, onSelect: () => category ? moveCategory(category, 1) : moveTag(item, 1) },
    { label: '编辑', icon: 'i-lucide-pencil', to: { path: '/categories/update', query: { kind: 'categories', id: item.id } } },
    { label: '删除', icon: 'i-lucide-trash', color: 'error' as const, onSelect: () => removeCategory(category!) }
  ]
}
</script>
<template>
  <AdminPage title="分类管理">
    <template #actions><UButton :to="{ path: '/categories/update', query: { kind: 'categories' } }" icon="i-lucide-plus">新增分类</UButton></template>
    <UAlert v-if="error" color="error" :description="error" />
    <AdminTable v-model:page="page" v-model:expanded="expanded" :data="visible" :columns="columns" :get-sub-rows="getSubRows" :total="filtered.length" :total-label="totalLabel" :page-size="pageSize" :loading="busy" empty-title="暂无分类" :empty-description="q ? '调整搜索词，再试一次。' : '让零散的灵感各有所属，这里正等待新的线索。'">
      <template #search><UInput v-model="q" icon="i-lucide-search" placeholder="搜索名称、Slug…" class="max-w-sm" aria-label="搜索分类" /></template>
      <template #filters>
        <UButton label="全部展开" color="neutral" variant="outline" @click="expanded = true" />
        <UButton label="全部收起" color="neutral" variant="outline" @click="expanded = {}" />
        <UButton label="保存排序" color="neutral" variant="outline" :loading="busy" @click="saveOrder('categories')" />
      </template>
      <template #page-size><USelect v-model="pageSize" :items="[10, 20, 50, 100]" aria-label="每页顶级分类数量" class="w-20" /></template>
      <template #name-cell="{ row }">
        <div class="flex min-w-0 items-center gap-2" :style="{ paddingInlineStart: `${row.depth * 20}px` }">
          <UButton v-if="row.getCanExpand()" :icon="row.getIsExpanded() ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" color="neutral" variant="ghost" size="xs" :aria-label="`${row.getIsExpanded() ? '收起' : '展开'}${row.original.name}`" :aria-expanded="row.getIsExpanded()" @click="row.toggleExpanded()" />
          <span v-else class="w-6 shrink-0" aria-hidden="true" />
          <TaxonomyIcon v-if="row.original.icon_name || row.depth === 0" :name="row.original.icon_name" :fallback="categoryDefaultIcons[row.original.slug]" :size="17" class="shrink-0" />
          <span class="break-words" :class="row.depth > 0 ? 'text-primary' : 'font-semibold text-highlighted'">{{ row.original.name }}</span>
          <UBadge v-if="row.subRows.length" color="neutral" variant="subtle" size="sm">{{ row.subRows.length }}</UBadge>
        </div>
      </template>
      <template #description-cell="{ row }"><span class="block truncate" :title="row.original.description">{{ row.original.description || '—' }}</span></template>
      <template #actions-cell="{ row }"><UDropdownMenu :items="rowActions(row.original)" :content="{ align: 'end' }"><UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" aria-label="分类标签操作" :disabled="busy" /></UDropdownMenu></template>
    </AdminTable>
  </AdminPage>
</template>
