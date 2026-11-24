<script setup lang="ts">
import { tagQuerySchema } from '#shared/schemas/discovery'
import { discoveryLabels, type TagContentPage } from '#shared/types/discovery'
const route = useRoute()
definePageMeta({ key: route => route.path })
const parsed = computed(() => tagQuerySchema.safeParse(route.query))
const query = computed(() => parsed.value.success ? parsed.value.data : tagQuerySchema.parse({}))
const { data, error } = await useFetch<TagContentPage>(() => `/api/public/tags/${encodeURIComponent(String(route.params.slug))}`, { query })
if (error.value?.statusCode === 404) throw createError({ statusCode: 404, statusMessage: '标签不存在' })
useSeoMeta({ title: () => `${data.value?.tag.name ?? '标签'} - NavHub`, description: () => data.value?.tag.description ?? '' })
</script>

<template>
  <section class="content-width page-section">
    <NuxtLink to="/tags">全部标签</NuxtLink>
    <template v-if="data">
      <p class="eyebrow">标签</p><h1>{{ data.tag.name }}</h1><p class="hero-copy">{{ data.tag.description }}</p>
      <nav aria-label="按内容类型筛选" class="tag-filters">
        <NuxtLink :to="{ path: route.path, query: { type: 'all' } }" :aria-current="query.type === 'all' ? 'page' : undefined">全部</NuxtLink>
        <NuxtLink v-for="(label, type) in discoveryLabels" :key="type" :to="{ path: route.path, query: { type } }" :aria-current="query.type === type ? 'page' : undefined">{{ label }}</NuxtLink>
      </nav>
    </template>
    <p v-if="error" role="alert" class="form-error">内容暂时无法加载，请稍后重试。</p>
    <template v-else-if="data">
      <h2 class="sr-only">标签内容</h2>
      <p class="muted">共 {{ data.total }} 条公开内容</p>
      <DiscoveryResults v-if="data.results.length" :items="data.results" />
      <p v-else class="muted">暂无符合条件的公开内容。</p>
      <nav v-if="data.page > 1 || data.page * data.pageSize < data.total" aria-label="内容分页" class="tag-filters">
        <NuxtLink v-if="data.page > 1" :to="{ path: route.path, query: { ...query, page: data.page - 1 } }">上一页</NuxtLink>
        <NuxtLink v-if="data.page * data.pageSize < data.total" :to="{ path: route.path, query: { ...query, page: data.page + 1 } }">下一页</NuxtLink>
      </nav>
    </template>
  </section>
</template>

<style scoped>
.tag-filters { display: flex; flex-wrap: wrap; gap: 12px; margin: 24px 0; }
.tag-filters a { padding: 12px 16px; border: 1px solid currentColor; border-radius: 10px; }
.tag-filters a[aria-current] { font-weight: 700; text-decoration: underline; }
</style>
