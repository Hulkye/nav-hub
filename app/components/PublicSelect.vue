<script setup lang="ts">
const props = defineProps<{ name: string; label: string; options: Array<{ value: string; label: string }> }>()
const model = defineModel<string>({ required: true })
const id = useId()
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const open = ref(false)
const active = ref(0)
const selected = computed(() => props.options.find(option => option.value === model.value)?.label ?? model.value)
function show(last = false) {
  active.value = last ? props.options.length - 1 : Math.max(0, props.options.findIndex(option => option.value === model.value))
  open.value = true
}
function choose(index: number) {
  const option = props.options[index]
  if (!option) return
  model.value = option.value
  open.value = false
  trigger.value?.focus()
}
function keydown(event: KeyboardEvent) {
  if (event.key === 'Tab') { open.value = false; return }
  if (event.key === 'Escape') { open.value = false; event.preventDefault(); return }
  if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
    event.preventDefault()
    if (!open.value) { show(event.key === 'End'); return }
    if (event.key === 'Enter' || event.key === ' ') { choose(active.value); return }
    const count = props.options.length
    if (!count) return
    active.value = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : (active.value + (event.key === 'ArrowUp' ? -1 : 1) + count) % count
    nextTick(() => document.getElementById(`${id}-${active.value}`)?.scrollIntoView({ block: 'nearest' }))
  } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
    const index = props.options.findIndex(option => option.label.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()))
    if (index >= 0) { event.preventDefault(); open.value = true; active.value = index }
  }
}
function outside(event: PointerEvent) {
  if (event.target instanceof Node && !root.value?.contains(event.target)) open.value = false
}
onMounted(() => document.addEventListener('pointerdown', outside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
</script>

<template>
  <div ref="root" class="public-select" :class="{ 'is-open': open }" @focusout="event => { if (!root?.contains(event.relatedTarget as Node | null)) open = false }">
    <input type="hidden" :name="name" :value="model" />
    <button ref="trigger" type="button" class="select-trigger" role="combobox" :aria-label="label" :aria-expanded="open" aria-haspopup="listbox" :aria-controls="`${id}-options`" :aria-activedescendant="open ? `${id}-${active}` : undefined" @click="open ? open = false : show()" @keydown="keydown"><span>{{ selected }}</span><AppIcon name="down" :size="14" aria-hidden="true" /></button>
    <ul v-if="open" :id="`${id}-options`" role="listbox" :aria-label="label" class="select-options">
      <li v-for="(option, index) in options" :id="`${id}-${index}`" :key="option.value" role="option" :aria-selected="model === option.value" :class="{ active: active === index }" @pointermove="active = index" @mousedown.prevent @click="choose(index)">{{ option.label }}<span v-if="model === option.value" aria-hidden="true">✓</span></li>
    </ul>
  </div>
</template>

<style scoped>
.public-select { position: relative; min-width: 0; }
.public-select.is-open { z-index: 30; }
.select-trigger { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 44px; max-width: 100%; padding: 8px 14px; border: 1px solid var(--line); border-radius: 10px; color: var(--ink); background: var(--card); font-size: .875rem; font-weight: 400; }
.select-trigger > span { overflow-wrap: anywhere; text-align: left; }
.select-trigger[aria-expanded="true"] { border-color: var(--accent); }
.select-options { position: absolute; z-index: 20; top: calc(100% + 6px); left: 0; width: max-content; min-width: 100%; max-width: min(280px, 80vw); max-height: 264px; overflow-y: auto; margin: 0; padding: 6px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); box-shadow: var(--shadow); list-style: none; }
.select-options li { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 44px; padding: 8px 12px; border-radius: 7px; color: var(--ink); font-size: .875rem; overflow-wrap: anywhere; cursor: pointer; }
.select-options li.active { color: var(--accent-ink); background: var(--accent-soft); }
.select-options li[aria-selected="true"] { font-weight: 600; }
</style>
