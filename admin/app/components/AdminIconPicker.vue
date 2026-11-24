<script setup lang="ts">
import TaxonomyIcon from '#shared/components/TaxonomyIcon.vue'
import { taxonomyIcons } from '#shared/utils/taxonomy-icons'

const model = defineModel<string | null>({ default: null })
const selected = computed({ get: () => model.value ?? '', set: (value: string) => { model.value = value || null } })
const items = Object.entries(taxonomyIcons).map(([value, label]) => ({ label: `${label} · ${value}`, value }))
</script>

<template>
  <div class="space-y-2">
    <USelectMenu v-model="selected" :items="items" value-key="value" placeholder="默认图标" clearable class="w-full" aria-label="IconPark 图标">
      <template #leading><TaxonomyIcon :name="model" :size="18" /></template>
      <template #item-leading="{ item }"><TaxonomyIcon :name="item.value" :size="18" /></template>
    </USelectMenu>
    <a href="https://iconpark.oceanengine.com/official" target="_blank" rel="noopener noreferrer" class="text-sm text-primary hover:underline">IconPark 官方图标库</a>
  </div>
</template>
