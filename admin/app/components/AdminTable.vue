<script setup lang="ts" generic="T extends { id: string }">
import type { TableColumn } from '@nuxt/ui'

const props = withDefaults(defineProps<{
  data: T[]
  columns: TableColumn<T>[]
  total: number
  pageSize?: number
  loading?: boolean
  selectable?: boolean
  rowKey?: (row: T) => string
  getSubRows?: (row: T) => T[] | undefined
  totalLabel?: string
  emptyTitle?: string
  emptyDescription?: string
}>(), { pageSize: 20, selectable: false, emptyTitle: '暂无记录', emptyDescription: '没有符合条件的记录。' })
const page = defineModel<number>('page', { default: 1 })
const selected = defineModel<string[]>('selected', { default: () => [] })
const expanded = defineModel<true | Record<string, boolean>>('expanded', { default: () => ({}) })
const slots = useSlots()
const columnSlots = computed(() => Object.fromEntries(Object.entries(slots).filter(([name]) => /-(cell|header)$/.test(name))))
const table = useTemplateRef('table')
const columnVisibility = ref<Record<string, boolean>>({})
const UCheckbox = resolveComponent('UCheckbox')
const rowId = (row: T) => props.rowKey ? props.rowKey(row) : row.id
const columns = computed<TableColumn<T>[]>(() => props.selectable ? [{
  id: 'select',
  enableHiding: false,
  enableSorting: false,
  size: 48,
  header: () => h(UCheckbox, {
    modelValue: props.data.length > 0 && props.data.every(item => selected.value.includes(rowId(item)))
      ? true : props.data.some(item => selected.value.includes(rowId(item))) ? 'indeterminate' : false,
    'onUpdate:modelValue': (value: boolean | 'indeterminate') => {
      const ids = new Set(props.data.map(rowId))
      selected.value = value === true ? [...new Set([...selected.value, ...ids])] : selected.value.filter(id => !ids.has(id))
    },
    ariaLabel: '选择本页'
  }),
  cell: ({ row }) => h(UCheckbox, {
    modelValue: selected.value.includes(rowId(row.original)),
    'onUpdate:modelValue': (value: boolean | 'indeterminate') => {
      selected.value = value === true ? [...new Set([...selected.value, rowId(row.original)])] : selected.value.filter(id => id !== rowId(row.original))
    },
    ariaLabel: '选择记录'
  })
}, ...props.columns] : props.columns)
const displayItems = computed(() => table.value?.tableApi.getAllColumns().filter(column => column.getCanHide()).map(column => ({
  label: typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id,
  type: 'checkbox' as const,
  checked: column.getIsVisible(),
  onUpdateChecked: (checked: boolean) => column.toggleVisibility(checked),
  onSelect: (event: Event) => event.preventDefault()
})) ?? [])
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4">
  <div class="flex flex-wrap items-center justify-between gap-1.5">
    <slot name="search" />
    <div class="flex flex-wrap items-center gap-1.5">
      <slot name="filters" />
      <UDropdownMenu :items="displayItems" :content="{ align: 'end' }">
        <UButton label="显示列" color="neutral" variant="outline" trailing-icon="i-lucide-settings-2" />
      </UDropdownMenu>
    </div>
  </div>
  <slot name="bulk" />
  <div class="min-h-0 flex-1 overflow-auto">
  <UTable
    ref="table"
    v-model:column-visibility="columnVisibility"
    v-model:expanded="expanded"
    :data="data"
    :columns="columns"
    :loading="loading"
    :get-row-id="rowId"
    :get-sub-rows="getSubRows"
    class="shrink-0"
    :ui="{
      base: 'table-fixed border-separate border-spacing-0',
      thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
      tbody: '[&>tr]:last:[&>td]:border-b-0',
      // UTable also renders a detail row for expanded tree nodes, even without an expanded slot.
      tr: getSubRows ? '[&:has(>td[data-slot=td][colspan])]:hidden' : undefined,
      th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
      td: 'border-b border-default',
      separator: 'h-0'
    }"
  >
    <template v-for="(_, name) in columnSlots" #[name]="scope"><slot :name="name" v-bind="scope" /></template>
    <template #empty><AdminEmpty :title="emptyTitle" :description="emptyDescription" /></template>
    <template #loading><div class="grid gap-3 p-6"><USkeleton v-for="index in 4" :key="index" class="h-10 w-full" /></div></template>
  </UTable>
  </div>
  <div class="sticky bottom-0 z-10 mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-default bg-default/95 py-4 backdrop-blur supports-[backdrop-filter]:bg-default/80">
    <div class="text-sm text-muted">{{ selectable ? `已选择 ${selected.length} 项 · ` : '' }}{{ totalLabel ?? `共 ${total} 条记录` }}</div>
    <div class="flex flex-wrap items-center gap-3">
      <slot name="page-size" />
      <UPagination v-model:page="page" :items-per-page="pageSize" :total="total" />
    </div>
  </div>
  </div>
</template>
