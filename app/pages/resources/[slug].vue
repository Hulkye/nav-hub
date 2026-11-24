<script setup lang="ts">
const route = useRoute()
</script>
<template><PublicContentDetail :key="route.fullPath" collection="resources" :identifier="String(route.params.slug)" /></template>
