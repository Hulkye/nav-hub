<script setup lang="ts">
import type { ImageAsset } from '#shared/types/assets'
defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const open = ref(false)
function choose(asset: ImageAsset) { emit('update:modelValue', asset.url); open.value = false }
</script>

<template>
  <div class="space-y-3">
    <UInput :model-value="modelValue" type="url" maxlength="2048" placeholder="https://" aria-label="图片地址" class="w-full" @update:model-value="emit('update:modelValue', String($event))" />
    <img v-if="modelValue" :src="modelValue" alt="已选择的图片" class="size-20 rounded border border-default object-contain" width="80" height="80" />
    <div class="flex flex-wrap gap-2">
      <UButton color="neutral" variant="outline" icon="i-lucide-images" @click="open = true">上传或选择图片</UButton>
      <UButton v-if="modelValue" color="neutral" variant="ghost" @click="emit('update:modelValue', '')">清除图片</UButton>
    </div>
    <UModal v-model:open="open" title="选择图片" description="上传新图片或从图片库选择。">
      <template #body><AdminAssetLibrary v-if="open" selectable @select="choose" /></template>
    </UModal>
  </div>
</template>
