<script setup lang="ts">
const route = useRoute()
</script>
<template><PublicContentDetail :key="route.fullPath" collection="announcements" :identifier="String(route.params.id)" /></template>
