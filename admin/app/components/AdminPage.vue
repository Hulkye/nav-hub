<script setup lang="ts">
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <UDashboardPanel :id="useRoute().path">
    <template #header>
      <UDashboardNavbar :title="title">
        <template #leading><UDashboardSidebarCollapse /></template>
        <template #right><slot name="actions" /></template>
      </UDashboardNavbar>
      <slot name="toolbar" />
    </template>
    <template #body><slot /></template>
  </UDashboardPanel>
</template>
