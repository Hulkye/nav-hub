<script setup lang="ts">
defineProps<{ label: string; description?: string; name?: string; required?: boolean; wide?: boolean }>()
</script>

<template>
  <div class="space-y-6 [&:last-child>.editor-separator]:hidden">
    <UFormField
      :label="label"
      :description="description"
      :name="name"
      :required="required"
      class="flex items-start justify-between gap-4 max-sm:flex-col"
      :class="wide ? 'sm:flex-col' : ''"
      :ui="{ container: wide ? 'w-full' : 'w-full sm:w-64 sm:shrink-0' }"
    >
      <slot />
    </UFormField>
    <USeparator class="editor-separator" />
  </div>
</template>
