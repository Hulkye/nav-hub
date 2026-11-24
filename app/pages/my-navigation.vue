<script setup lang="ts">
const { favorites, recent, ready, storageError, removeFavorite, clearRecent, clearFavorites, init } = useLocalNavigation()
useSeoMeta({ title: '我的导航 - NavHub' })
</script>
<template>
  <section class="content-width page-section navigation-page">
    <header class="navigation-hero">
      <div>
        <p class="eyebrow">本地导航</p>
        <h1>我的导航</h1>
      </div>
    </header>
    <div v-if="storageError" class="navigation-alert" role="alert"><AppIcon name="warning" :size="20" /><p>{{ storageError }}</p><button type="button" @click="init">重试读取</button><button type="button" @click="clearFavorites(); clearRecent()">清空本地记录</button></div>
    <p v-if="!ready" class="navigation-loading" role="status">正在读取本地导航…</p>
    <div class="navigation-summary" aria-label="导航统计"><span><strong>{{ favorites.length }}</strong><small>收藏网站</small></span><span><strong>{{ recent.length }}</strong><small>最近访问</small></span><span><strong>70</strong><small>本地容量</small></span></div>
    <div class="navigation-grid">
      <section class="navigation-panel" aria-labelledby="favorites-heading">
        <header class="panel-header"><div><p class="panel-kicker">已保存</p><h2 id="favorites-heading">收藏网站 <span>{{ favorites.length }}/50</span></h2></div></header>
        <p v-if="!favorites.length" class="navigation-empty"><AppIcon name="heart" :size="30" /><span>暂无收藏</span></p>
        <ul v-else class="navigation-list"><li v-for="item in favorites" :key="item.slug"><a class="navigation-item" :href="`/sites/${item.slug}`"><SiteIcon :title="item.title" :target-url="item.url" :size="28" /><span><strong>{{ item.title }}</strong><small>{{ item.url }}</small></span></a><button class="icon-action" type="button" aria-label="移除收藏" @click="removeFavorite(item.slug)"><AppIcon name="close" :size="16" /></button></li></ul>
      </section>
      <section class="navigation-panel" aria-labelledby="recent-heading">
        <header class="panel-header"><div><p class="panel-kicker">浏览足迹</p><h2 id="recent-heading">最近访问 <span>{{ recent.length }}/20</span></h2></div><button v-if="recent.length" class="clear-action" type="button" @click="clearRecent">清空</button></header>
        <p v-if="!recent.length" class="navigation-empty"><AppIcon name="history" :size="30" /><span>暂无记录</span></p>
        <ul v-else class="navigation-list"><li v-for="item in recent" :key="item.slug"><a class="navigation-item" :href="`/sites/${item.slug}`"><SiteIcon :title="item.title" :target-url="item.url" :size="28" /><span><strong>{{ item.title }}</strong><small>{{ item.url }}</small></span><AppIcon class="item-arrow" name="right" :size="16" /></a></li></ul>
      </section>
    </div>
  </section>
</template>
<style scoped>
.navigation-page { max-width: 1120px; }
.navigation-hero { display: flex; align-items: end; justify-content: space-between; gap: 32px; padding: 12px 0 36px; border-bottom: 1px solid var(--line); }
.navigation-hero h1 { margin: 0; }
.navigation-alert { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 24px; padding: 14px 16px; border: 1px solid color-mix(in srgb, #b42318 28%, var(--line)); border-radius: 10px; color: #8f1d14; background: color-mix(in srgb, #b42318 8%, var(--card)); }
.navigation-alert p { flex: 1 1 280px; margin: 0; font-size: .9rem; }
.navigation-alert button { min-height: 40px; padding-inline: 12px; color: inherit; background: transparent; border: 1px solid currentColor; }
.navigation-loading { margin: 24px 0; color: var(--muted); }
.navigation-summary { display: flex; gap: 1px; margin: 28px 0; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: var(--line); }
.navigation-summary span { display: grid; flex: 1; gap: 2px; padding: 16px 20px; background: var(--card); }
.navigation-summary strong { font: 600 1.45rem var(--font-mono); }
.navigation-summary small { color: var(--muted); font-size: .78rem; }
.navigation-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.navigation-panel { min-width: 0; border: 1px solid var(--line); border-radius: 12px; background: var(--card); box-shadow: var(--shadow); }
.panel-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px; border-bottom: 1px solid var(--line); }
.panel-header h2 { margin: 0; font-size: 1.1rem; }
.panel-header h2 span { color: var(--muted); font: .75rem var(--font-mono); }
.panel-header > .icon-park { color: var(--accent); }
.panel-kicker { margin: 0 0 4px; color: var(--muted); font-size: .7rem; letter-spacing: .08em; }
.clear-action { min-height: 36px; padding: 0 10px; color: var(--muted); background: transparent; }
.clear-action:hover { color: var(--ink); background: var(--surface); }
.navigation-empty { display: grid; justify-items: center; align-content: center; gap: 8px; min-height: 190px; margin: 0; padding: 28px 24px; color: var(--muted); text-align: center; }
.navigation-empty > .icon-park { color: var(--accent); }
.navigation-empty span { font-size: .85rem; }
.navigation-list { margin: 0; padding: 8px; list-style: none; }
.navigation-list li { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 8px; border-radius: 8px; }
.navigation-list li:hover { background: var(--surface); }
.navigation-item { display: flex; align-items: center; flex: 1; min-width: 0; gap: 12px; min-height: 48px; }
.navigation-item :deep(.site-icon) { --site-icon-size: 40px; --site-icon-radius: 9px; }
.navigation-item > span:last-of-type { display: grid; min-width: 0; gap: 2px; }
.navigation-item strong, .navigation-item small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.navigation-item small { color: var(--muted); font-size: .72rem; }
.item-arrow { flex-shrink: 0; margin-left: auto; color: var(--muted); }
.icon-action { display: grid; flex-shrink: 0; width: 36px; height: 36px; min-height: 36px; place-items: center; padding: 0; color: var(--muted); background: transparent; }
.icon-action:hover { color: #b42318; background: color-mix(in srgb, #b42318 10%, transparent); }
@media (max-width: 760px) {
  .navigation-hero { align-items: start; flex-direction: column; gap: 20px; }
  .navigation-cta { width: 100%; justify-content: center; }
  .navigation-grid { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) { .navigation-list li { transition: none; } }
</style>
