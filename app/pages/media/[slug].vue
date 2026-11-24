<script setup lang="ts">
const route = useRoute()
</script>
<template><PublicContentDetail :key="route.fullPath" collection="media" :identifier="String(route.params.slug)" /></template>
