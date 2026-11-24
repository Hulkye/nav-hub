<script setup lang="ts">
type Category = { id: string; name: string; parent_id: string | null; sort_order: number }
const props = defineProps<{ categories: Category[]; single?: boolean; emptyLabel?: string }>()
const model = defineModel<string[]>({ required: true })
const open = ref(false)
const activeParent = ref<string>()
const roots = computed(() => props.categories.filter(item => !item.parent_id).sort((a, b) => a.sort_order - b.sort_order))
const children = computed(() => props.categories.filter(item => item.parent_id === activeParent.value).sort((a, b) => a.sort_order - b.sort_order))
const label = computed(() => {
  const byId = new Map(props.categories.map(item => [item.id, item]))
  return props.categories.filter(item => model.value.includes(item.id)).map(item => {
    const parent = item.parent_id ? byId.get(item.parent_id) : undefined
    return parent ? `${parent.name}-${item.name}` : item.name
  }).join('、')
})
function toggle(id: string) {
  if (props.single) {
    model.value = [id]
    open.value = false
    return
  }
  model.value = model.value.includes(id) ? model.value.filter(value => value !== id) : [...model.value, id]
}
</script>

<template>
  <UPopover v-model:open="open" :content="{ align: 'start' }">
    <UButton color="neutral" variant="outline" class="w-full justify-between" trailing-icon="i-lucide-chevron-down" aria-label="选择分类">
      <span class="truncate" :title="label">{{ label || emptyLabel || '请选择分类' }}</span>
    </UButton>
    <template #content>
      <div class="flex max-w-[calc(100vw-2rem)] p-1">
        <div class="max-h-72 w-44 overflow-y-auto" aria-label="一级分类">
          <button v-if="emptyLabel" type="button" class="min-h-9 w-full rounded px-2 text-left text-sm hover:bg-elevated" @click="model = []; open = false">{{ emptyLabel }}</button>
          <div v-for="category in roots" :key="category.id" class="flex items-center gap-2 rounded px-2 hover:bg-elevated" :class="{ 'bg-elevated': activeParent === category.id }">
            <UCheckbox v-if="!single" :model-value="model.includes(category.id)" :aria-label="`选择${category.name}`" @update:model-value="toggle(category.id)" />
            <button type="button" class="flex min-h-9 min-w-0 flex-1 items-center justify-between gap-2 text-left text-sm" :aria-pressed="single ? model.includes(category.id) : undefined" @click="single ? toggle(category.id) : activeParent = category.id">
              <span class="truncate">{{ category.name }}</span><UIcon v-if="!single" name="i-lucide-chevron-right" class="shrink-0" />
            </button>
            <button v-if="single && categories.some(item => item.parent_id === category.id)" type="button" class="grid min-h-9 w-9 shrink-0 place-items-center rounded hover:bg-accented" :aria-label="`展开${category.name}的二级分类`" :aria-expanded="activeParent === category.id" @click="activeParent = category.id"><UIcon name="i-lucide-chevron-right" /></button>
          </div>
        </div>
        <div v-if="activeParent" class="max-h-72 w-44 overflow-y-auto border-l border-default px-2" aria-label="二级分类">
          <template v-for="category in children" :key="category.id">
            <button v-if="single" type="button" class="min-h-9 w-full rounded px-2 text-left text-sm hover:bg-elevated" :aria-pressed="model.includes(category.id)" @click="toggle(category.id)">{{ category.name }}</button>
            <label v-else class="flex min-h-9 cursor-pointer items-center gap-2 rounded px-2 text-sm hover:bg-elevated">
              <UCheckbox :model-value="model.includes(category.id)" @update:model-value="toggle(category.id)" />{{ category.name }}
            </label>
          </template>
          <p v-if="!children.length" class="p-2 text-sm text-muted">暂无二级分类，可直接选择一级分类。</p>
        </div>
      </div>
    </template>
  </UPopover>
</template>
