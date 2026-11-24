<script setup lang="ts">
import { publicContentHref, type PublicCollection, type PublicContent } from '#shared/types/public-content'
import type { PublicPage } from '#shared/schemas/public-list'
const props = defineProps<{ collection: PublicCollection }>()
const { t, text } = useI18n()
const route = useRoute()
const label = computed(() => t(`nav.${props.collection}`))
const { data, error, status } = await useFetch<PublicContent[] | PublicPage<PublicContent>>(`/api/public/${props.collection}`, { query: computed(() => route.query) })
const page = computed(() => data.value && !Array.isArray(data.value) ? data.value : undefined)
const items = computed(() => Array.isArray(data.value) ? data.value : page.value?.items ?? [])
const subtypes = computed(() => props.collection === 'resources' ? [
  { value: 'software', label: text('软件', 'Software') }, { value: 'website', label: text('网站', 'Website') }, { value: 'document', label: text('文档', 'Document') }, { value: 'other', label: text('其他', 'Other') }
] : props.collection === 'media' ? [
  { value: 'book', label: text('书籍', 'Books') }, { value: 'movie', label: text('影视', 'Movies') }, { value: 'music', label: text('音乐', 'Music') }, { value: 'other', label: text('其他', 'Other') }
] : [])
useSeoMeta({ title: () => `${label.value} - NavHub` })
</script>

<template>
  <section class="content-width page-section">
    <p class="eyebrow">NavHub</p><h1>{{ label }}</h1>
    <PublicListControls v-if="collection !== 'announcements'" :page="page" :subtypes="subtypes" />
    <p v-if="status === 'pending'" role="status">{{ text('正在加载…', 'Loading…') }}</p>
    <p v-if="error" class="form-error" role="alert">{{ t('common.unavailable') }}</p>
    <div v-else-if="items.length" class="search-results" :aria-busy="status === 'pending'">
      <article v-for="item in items" :key="item.id" class="result-row">
        <NuxtLink :to="publicContentHref(collection, item)" class="result-title">{{ item.title }}</NuxtLink>
        <p>{{ item.summary ?? item.description ?? item.body }}</p>
      </article>
    </div>
    <p v-else class="muted">{{ t('common.empty') }}</p>
    <PublicPagination v-if="page && !error" :page="page" />
  </section>
</template>
