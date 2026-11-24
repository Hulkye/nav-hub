<script setup lang="ts">
const props = defineProps<{ site: { id: string; title: string; slug?: string; description?: string; target_url?: string | null; icon_url?: string | null } }>()
const { text } = useI18n()
const settings = await useSiteSettings()
const direct = computed(() => settings.value.siteCardBehavior === 'direct' && !!props.site.target_url)
const arrowDirect = computed(() => settings.value.siteCardArrowBehavior === 'direct' && !!props.site.target_url)
const host = computed(() => {
  try { return new URL(props.site.target_url ?? '').hostname.replace(/^www\./, '') } catch { return '' }
})
</script>
<template>
  <article class="site-card">
    <NuxtLink v-if="!direct" :to="`/sites/${site.slug}`" class="site-card-main"
      :aria-label="`${site.title} · ${text('查看详情', 'View details')}`">
      <SiteIcon class="site-card-icon" :title="site.title" :icon-url="site.icon_url" :target-url="site.target_url ?? undefined" />
      <h3>{{ site.title }}</h3>
      <p>{{ site.description }}</p><span class="site-domain">{{ host }}</span>
    </NuxtLink>
    <a v-else class="site-card-main" :href="site.target_url!" target="_blank" rel="noopener noreferrer"
      :aria-label="`${site.title} · ${text('打开网站', 'Open website')}`">
      <SiteIcon class="site-card-icon" :title="site.title" :icon-url="site.icon_url" :target-url="site.target_url ?? undefined" />
      <h3>{{ site.title }}</h3>
      <p>{{ site.description }}</p><span class="site-domain">{{ host }}</span>
    </a>
    <a v-if="arrowDirect && site.target_url" class="site-card-visit" :href="site.target_url" target="_blank" rel="noopener noreferrer" :aria-label="`${site.title} · ${text('访问网站', 'Visit website')}`">
      <AppIcon name="arrow-up-right" :size="17" /><span class="sr-only">{{ text('访问网站', 'Visit website') }}</span>
    </a>
    <NuxtLink v-else class="site-card-visit" :to="`/sites/${site.slug}`" :aria-label="`${site.title} · ${text('查看详情', 'View details')}`">
      <AppIcon name="arrow-up-right" :size="17" /><span class="sr-only">{{ text('查看详情', 'View details') }}</span>
    </NuxtLink>
  </article>
</template>
<style scoped>
.site-card {
  position: relative;
  background: var(--surface);
}

.site-card-main {
  display: contents;
}

.site-card-icon { --site-icon-background: var(--surface); }

.site-card:hover h3 {
  color: var(--accent);
}

.site-card-visit {
  position: absolute;
  z-index: 2;
  top: -8px;
  right: 12px;
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 50%;
  color: var(--muted);
  background: var(--surface);
}

.site-card-visit:hover {
  color: var(--accent-ink);
  background: var(--accent-soft);
}
</style>
