<script setup lang="ts">
import type { PublicTag } from '#shared/types/discovery'
const { data, error } = await useFetch<PublicTag[]>('/api/public/tags')
useSeoMeta({ title: '标签 - NavHub', description: '通过标签探索已发布的网站、资源、书影音、文章与有效公告。' })
</script>

<template>
  <section class="content-width page-section">
    <p class="eyebrow">NavHub</p><h1>标签</h1>
    <p v-if="error" role="alert" class="form-error">标签暂时无法加载，请稍后重试。</p>
    <div v-else-if="data?.length" class="content-grid">
      <article v-for="tag in data" :key="tag.id" class="content-card">
        <h2><NuxtLink :to="`/tags/${encodeURIComponent(tag.slug)}`">{{ tag.name }}</NuxtLink></h2>
        <p>{{ tag.description }}</p><p class="muted">{{ tag.count }} 条公开内容</p>
      </article>
    </div>
    <p v-else class="muted">暂无公开标签。</p>
  </section>
</template>
