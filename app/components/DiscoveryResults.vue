<script setup lang="ts">
import { discoveryHref, discoveryLabels, type DiscoveryItem } from '#shared/types/discovery'
defineProps<{ items: DiscoveryItem[] }>()
</script>

<template>
  <div class="content-grid">
    <article v-for="item in items" :key="`${item.type}:${item.id}`" class="content-card">
      <p class="eyebrow">{{ discoveryLabels[item.type] }}</p>
      <h3><NuxtLink :to="discoveryHref(item)">{{ item.title }}</NuxtLink></h3>
      <p>{{ item.summary }}</p>
    </article>
  </div>
</template>

<style scoped>
.content-card { overflow-wrap: anywhere; }
</style>
