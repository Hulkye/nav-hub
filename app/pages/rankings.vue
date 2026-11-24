<script setup lang="ts">
const route = useRoute()
const days = computed(() => String(route.query.days ?? '7'))
const routes: Record<string, string> = { site: 'sites', resource: 'resources', media: 'media', article: 'articles' }
const labels: Record<string, string> = { site: '网站', resource: '资源', media: '书影音', article: '文章' }
const { data, error } = await useFetch<{ days: number; items: Array<{ id: string; title: string; slug: string; type: string; icon_url: string | null; target_url: string | null; views: number; clicks: number }> }>('/api/public/rankings', { query: { days } })
useSeoMeta({ title: '热门榜单' })
</script>

<template>
  <div class="ranking-backdrop">
  <section class="content-width page-section ranking-page">
    <header class="ranking-header">
      <div class="ranking-title">
        <svg v-for="side in ['left', 'right']" :key="side" class="ranking-wheat" :class="side" viewBox="0 0 64 112" fill="none" aria-hidden="true">
          <path d="M53 104C22 84 17 51 34 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <g fill="currentColor"><ellipse cx="31" cy="18" rx="4" ry="10" transform="rotate(20 31 18)" /><ellipse cx="22" cy="34" rx="5" ry="11" transform="rotate(-25 22 34)" /><ellipse cx="39" cy="31" rx="5" ry="11" transform="rotate(50 39 31)" /><ellipse cx="17" cy="52" rx="5" ry="12" transform="rotate(-38 17 52)" /><ellipse cx="35" cy="49" rx="5" ry="11" transform="rotate(55 35 49)" /><ellipse cx="19" cy="72" rx="5" ry="12" transform="rotate(-52 19 72)" /><ellipse cx="38" cy="68" rx="5" ry="11" transform="rotate(40 38 68)" /><ellipse cx="29" cy="90" rx="5" ry="12" transform="rotate(-60 29 90)" /><ellipse cx="46" cy="86" rx="5" ry="10" transform="rotate(25 46 86)" /></g>
        </svg>
        <p class="eyebrow">NAVHUB · 人气精选</p><h1>热门榜单</h1><p class="ranking-subtitle">发现值得关注的好内容</p>
      </div>
      <nav aria-label="榜单时间范围" class="ranking-tabs"><NuxtLink to="/rankings?days=7" :aria-current="days === '7' ? 'page' : undefined">周榜 <span>近 7 天</span></NuxtLink><NuxtLink to="/rankings?days=30" :aria-current="days === '30' ? 'page' : undefined">月榜 <span>近 30 天</span></NuxtLink></nav>
    </header>
    <p class="ranking-note">按详情访问与外链点击排序，最多展示 50 项。短时间重复事件会去重，统计数字不代表独立访客数。</p>
    <p v-if="error" role="alert" class="form-error">榜单暂时不可用，请稍后重试。</p>
    <ol v-else-if="data?.items.length" class="ranking-list"><li v-for="(item, index) in data.items" :key="`${item.type}:${item.id}`"><NuxtLink class="ranking-item" :to="`/${routes[item.type]}/${encodeURIComponent(item.slug)}`"><span class="ranking-position" :class="{ top: index < 3 }">{{ String(index + 1).padStart(2, '0') }}</span><span class="ranking-icon"><SiteIcon :title="item.title" :icon-url="item.icon_url" :target-url="item.target_url" :size="28" /></span><span class="ranking-info"><strong>{{ item.title }}</strong><span>{{ labels[item.type] ?? '内容' }}</span></span><span class="ranking-stats"><span><strong>{{ item.views.toLocaleString() }}</strong><small>次访问</small></span><span><strong>{{ item.clicks.toLocaleString() }}</strong><small>次外链点击</small></span></span><AppIcon class="ranking-arrow" name="right" :size="18" /></NuxtLink></li></ol>
    <div v-else class="ranking-empty"><AppIcon name="chart" :size="28" /><p>当前时段暂无统计数据。</p></div>
  </section>
  </div>
</template>

<style scoped>
.ranking-backdrop { min-height: 100%; background: radial-gradient(ellipse at 50% 0%, color-mix(in srgb, #d6ac59 18%, transparent), transparent 60%), linear-gradient(var(--hero-bg), var(--surface) 600px); }
.ranking-page { max-width: 980px; --ranking-gold: #a77929; --ranking-silver: #687f99; --ranking-bronze: #ac714d; }
.ranking-header { display: grid; justify-items: center; gap: 28px; padding: 24px 0 28px; }
.ranking-title { position: relative; padding: 20px 84px; text-align: center; }
.ranking-header h1 { margin: 0; color: var(--hero-ink); font-family: var(--font-index); font-size: clamp(2rem, 5vw, 3rem); letter-spacing: .1em; }
.ranking-title .eyebrow { color: var(--hero-muted); font-size: .7rem; letter-spacing: .16em; }
.ranking-subtitle { margin: 10px 0 0; color: var(--hero-muted); font-size: .9rem; letter-spacing: .12em; }
.ranking-wheat { position: absolute; top: 50%; width: 62px; height: 112px; color: var(--ranking-gold); transform: translateY(-50%); opacity: .8; }
.ranking-wheat.left { left: 0; }
.ranking-wheat.right { right: 0; transform: translateY(-50%) scaleX(-1); }
.ranking-tabs { display: flex; gap: 8px; padding: 4px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
.ranking-tabs a { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 14px; border-radius: 5px; color: var(--muted); font-weight: 600; }
.ranking-tabs a span { font-size: .75rem; font-weight: 400; }
.ranking-tabs [aria-current] { color: var(--ink); background: var(--card); box-shadow: var(--shadow); }
.ranking-note { margin: 0 0 24px; color: var(--muted); font-size: .78rem; text-align: center; }
.ranking-list { display: grid; gap: 16px; margin: 0; padding: 0; list-style: none; }
.ranking-item { display: grid; grid-template-columns: 42px 44px minmax(0, 1fr) auto 20px; align-items: center; gap: 16px; min-height: 88px; padding: 20px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); box-shadow: var(--shadow); transition: border-color .16s ease, box-shadow .16s ease; }
.ranking-item:hover { box-shadow: 0 0 0 1px var(--line), var(--shadow); }
.ranking-position { color: var(--muted); font: 600 1rem var(--font-index); font-variant-numeric: tabular-nums; }
.ranking-list li:nth-child(1) { --medal-color: var(--ranking-gold); }
.ranking-list li:nth-child(2) { --medal-color: var(--ranking-silver); }
.ranking-list li:nth-child(3) { --medal-color: var(--ranking-bronze); }
.ranking-list li:nth-child(-n+3) .ranking-item { border-color: color-mix(in srgb, var(--medal-color) 42%, var(--line)); background: linear-gradient(110deg, color-mix(in srgb, var(--medal-color) 12%, var(--card)), var(--card) 55%); }
.ranking-position.top { display: grid; place-items: center; width: 38px; height: 46px; color: var(--medal-color); background: color-mix(in srgb, var(--medal-color) 14%, var(--card)); clip-path: polygon(0 0, 100% 0, 100% 80%, 50% 100%, 0 80%); font-size: 1.2rem; }
.ranking-icon { display: grid; width: 44px; height: 44px; place-items: center; --site-icon-size: 44px; --site-icon-radius: 8px; }
.ranking-info { display: grid; min-width: 0; gap: 4px; }
.ranking-info strong { overflow-wrap: anywhere; }
.ranking-info > span, .ranking-stats small { color: var(--muted); font-size: .78rem; }
.ranking-stats { display: flex; gap: 28px; text-align: right; }
.ranking-stats > span { display: grid; gap: 2px; }
.ranking-stats strong { font-variant-numeric: tabular-nums; }
.ranking-arrow { color: var(--muted); }
.ranking-empty { display: grid; justify-items: center; gap: 8px; padding: 56px 20px; border-bottom: 1px solid var(--line); color: var(--muted); text-align: center; }
.ranking-empty p { margin: 0; }
@media (max-width: 600px) {
  .ranking-header { padding-top: 0; }
  .ranking-title { padding-inline: 48px; }
  .ranking-wheat { width: 40px; height: 88px; }
  .ranking-position.top { width: 30px; height: 40px; }
  .ranking-item { grid-template-columns: 32px 40px minmax(0, 1fr) 16px; gap: 10px; padding: 16px; }
  .ranking-icon { width: 40px; height: 40px; --site-icon-size: 40px; }
  .ranking-stats { grid-column: 3; gap: 16px; text-align: left; }
  .ranking-arrow { grid-column: 4; grid-row: 1 / span 2; }
}
@media (prefers-reduced-motion: reduce) { .ranking-item { transition: none; } }
</style>
