<script setup lang="ts">
defineProps<{ collapsed?: boolean }>()
</script>

<template>
  <UButton to="/" icon="i-lucide-compass" :label="collapsed ? undefined : 'NavHub Admin'" color="neutral" variant="ghost" block :square="collapsed" class="font-semibold" />
</template>
