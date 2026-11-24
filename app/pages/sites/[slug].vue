<script setup lang="ts">
import { shareDetail } from '#shared/utils/detail-sharing'
import type { DiscoveryItem } from '#shared/types/discovery'
import { articleToc, parseArticleBody } from '#shared/types/article-body'

type RelatedSite = { id: string; title: string; slug: string; description: string; icon_url: string | null; target_url: string; shared_tags?: number }
type SiteDetail = {
  id: string; title: string; description: string; body: string; target_url: string; backup_url: string | null; preview_url: string | null; icon_url: string | null; slug: string
  related_sites: RelatedSite[]
  related_tag_sites: RelatedSite[]
  stats?: { views: number; clicks: number }
  updated_at?: string
  link_health?: { status: 'ok' | 'slow' | 'unavailable'; checked_at: string; elapsed_ms: number | null } | null
}
function downloadQr() {
  if (!qrDataUrl.value) return
  const anchor = document.createElement('a')
  anchor.href = qrDataUrl.value
  anchor.download = `${data.value?.slug ?? 'site'}-qr.png`
  anchor.click()
}

const route = useRoute()
const { data, error } = await useFetch<SiteDetail>(`/api/public/sites/${route.params.slug}`)
if (error.value) throw createError({ statusCode: 404, statusMessage: '网站不存在' })
const { data: relatedContent } = await useFetch<{ results: DiscoveryItem[] }>(`/api/public/content/site/${data.value!.id}/related`, { query: { limit: 6 } })
useSeoMeta({ title: () => data.value ? `${data.value.title} - NavHub` : '网站详情', description: () => data.value?.description ?? '' })

const navigation = useLocalNavigation()
const { ready, storageError } = navigation
const qrDataUrl = ref('')
const feedback = ref('')
const shareMenuOpen = ref(false)
const shareTrigger = ref<HTMLButtonElement | null>(null)
function safeUrl(value?: string | null) {
  try { const url = new URL(value ?? ''); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined } catch { return undefined }
}
const backupUrl = computed(() => safeUrl(data.value?.backup_url))
const previewUrl = computed(() => safeUrl(data.value?.preview_url))
const bodyParts = computed(() => parseArticleBody(data.value?.body || data.value?.description || ''))
const bodyToc = computed(() => articleToc(bodyParts.value))
const siteDomain = computed(() => {
  const url = safeUrl(data.value?.target_url)
  return url ? new URL(url).hostname.replace(/^www\./, '') : ''
})
function closeShareMenu() { shareMenuOpen.value = false; shareTrigger.value?.focus() }
const shareUrl = computed(() => import.meta.client ? `${location.origin}/sites/${data.value?.slug ?? ''}` : '')
const healthLabel = computed(() => {
  const status = data.value?.link_health?.status
  return status === 'ok' ? '正常' : status === 'slow' ? '较慢' : status === 'unavailable' ? '失效' : '待检查'
})
const healthClass = computed(() => data.value?.link_health?.status ?? 'pending')
const backupDomain = computed(() => backupUrl.value ? new URL(backupUrl.value).hostname.replace(/^www\./, '') : '')

async function createQr() {
  if (!shareUrl.value) return
  try { const { default: QRCode } = await import('qrcode'); qrDataUrl.value = await QRCode.toDataURL(shareUrl.value, { width: 192, margin: 1 }) }
  catch { feedback.value = '无法生成二维码，请使用复制链接分享。' }
}
async function copyLink() {
  try { await navigator.clipboard.writeText(shareUrl.value); feedback.value = '分享链接已复制'; shareMenuOpen.value = false }
  catch { feedback.value = '复制失败，请从地址栏复制页面链接。' }
}
async function sharePage() {
  if (!data.value) return
  try {
    const result = await shareDetail({ title: data.value.title, url: shareUrl.value }, { share: navigator.share?.bind(navigator), copy: text => navigator.clipboard.writeText(text) })
    if (result === 'shared') feedback.value = '已打开系统分享'
    if (result === 'copied') feedback.value = '分享链接已复制'
    shareMenuOpen.value = false
  } catch { feedback.value = '分享失败，请复制链接后分享。' }
}
function formatCheckedAt(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : `最近检查：${date.toLocaleDateString('zh-CN')}`
}
watch([data, ready], ([site, loaded]) => { if (site && loaded) navigation.addRecent({ slug: site.slug, title: site.title, url: site.target_url }) }, { immediate: true })
onMounted(createQr)
</script>

<template><section v-if="data" class="content-width page-section detail-page">
  <nav class="detail-breadcrumb" aria-label="面包屑"><NuxtLink to="/">首页</NuxtLink><AppIcon name="right" :size="14" /><span>网站详情</span></nav>
  <header class="detail-hero">
  <div class="detail-heading">
    <SiteIcon class="detail-logo" :title="data.title" :icon-url="data.icon_url" :target-url="data.target_url" :size="80" loading="eager" />
    <div class="detail-intro"><p class="eyebrow">网站导航 <span aria-hidden="true">/</span> {{ siteDomain }}</p><h1>{{ data.title }}</h1><p class="detail-description">{{ data.description }}</p>
      <div class="detail-health"><span class="signal-badge" :class="healthClass"><span aria-hidden="true">●</span> {{ healthLabel }}</span><span class="signal-muted">{{ data.link_health ? formatCheckedAt(data.link_health.checked_at) : '尚未检查' }}<template v-if="data.link_health?.elapsed_ms !== null && data.link_health?.elapsed_ms !== undefined"> · {{ (data.link_health.elapsed_ms / 1000).toFixed(1) }} 秒</template></span></div>
    </div>
  </div>
  <div class="detail-actions">
    <div class="visit-group"><span class="action-group-label">访问主站</span><a class="button-link visit-button" :href="data.target_url" target="_blank" rel="noopener noreferrer">访问主站 <AppIcon name="arrow-up-right" :size="19" /></a></div>
    <div v-if="backupUrl" class="visit-group"><span class="action-group-label">备用地址 · {{ backupDomain }}</span><a class="button-link secondary" :href="backupUrl" target="_blank" rel="noopener noreferrer">打开备用地址 <AppIcon name="arrow-up-right" :size="17" /></a></div>
    <button class="button-link secondary" type="button" :disabled="!ready" :aria-pressed="navigation.isFavorite(data.slug)" @click="navigation.toggleFavorite({ slug: data.slug, title: data.title, url: data.target_url })">{{ navigation.isFavorite(data.slug) ? '取消收藏' : '收藏' }}</button>
    <button class="button-link secondary" type="button" @click="copyLink">复制链接</button>
    <div class="share-menu" @keydown.esc.prevent="closeShareMenu"><button ref="shareTrigger" class="button-link secondary" type="button" :aria-expanded="shareMenuOpen" aria-controls="site-share-options" @click="shareMenuOpen = !shareMenuOpen">分享 <AppIcon name="down" :size="16" /></button><div v-if="shareMenuOpen" id="site-share-options" class="share-options"><button type="button" @click="sharePage">系统分享</button><a href="#phone-share" @click="shareMenuOpen = false">在手机上打开</a><button type="button" @click="closeShareMenu">关闭</button></div></div>
  </div>
  <p v-if="feedback" class="detail-feedback" role="status">{{ feedback }}</p>
  <p v-if="storageError" class="form-error" role="alert">{{ storageError }}</p>
  </header>

  <div class="detail-layout">
  <div class="detail-main">
    <section class="detail-panel about-panel" aria-labelledby="about-site"><p class="panel-kicker">关于这个网站</p><h2 id="about-site">认识 {{ data.title }}</h2><nav v-if="bodyToc.length > 2" class="article-toc" aria-label="正文目录"><strong>正文目录</strong><a v-for="heading in bodyToc" :key="heading.id" :href="`#site-${heading.id}`" :class="`toc-level-${heading.level}`">{{ heading.text }}</a></nav><div class="article-body"><template v-for="(part, index) in bodyParts" :key="index"><component :is="`h${part.level}`" v-if="part.type === 'heading'" :id="`site-${part.id}`" class="article-heading">{{ part.text }}</component><img v-else-if="part.type === 'image'" :src="part.url" :alt="part.alt" loading="lazy" class="article-image" /><p v-else-if="part.type === 'paragraph'" class="article-paragraph"><template v-for="(inline, inlineIndex) in part.parts" :key="inlineIndex"><a v-if="inline.type === 'link'" :href="inline.url" target="_blank" rel="noopener noreferrer">{{ inline.text }}</a><span v-else>{{ inline.text }}</span></template></p><component :is="part.ordered ? 'ol' : 'ul'" v-else-if="part.type === 'list'" class="article-list"><li v-for="(item, itemIndex) in part.items" :key="itemIndex"><template v-for="(inline, inlineIndex) in item" :key="inlineIndex"><a v-if="inline.type === 'link'" :href="inline.url" target="_blank" rel="noopener noreferrer">{{ inline.text }}</a><span v-else>{{ inline.text }}</span></template></li></component><pre v-else-if="part.type === 'code'" class="article-code"><code>{{ part.value }}</code></pre></template></div></section>
    <section v-if="previewUrl" class="detail-panel preview-box"><h2>网站预览</h2><a :href="previewUrl" target="_blank" rel="noopener noreferrer" aria-label="在新窗口查看完整网站截图"><img class="site-preview" :src="previewUrl" :alt="`${data.title} 网站截图`" loading="lazy" referrerpolicy="no-referrer"></a></section>
    <div class="detail-panel"><CommentsPanel content-type="site" :content-id="data.id" /></div>
    <div class="detail-panel report-area"><h2>信息反馈</h2><p class="muted">发现链接失效或内容有误？请提交反馈，帮助我们完善网站信息。</p><ReportPanel content-type="site" :content-id="data.id" /></div>
  </div>
  <aside class="detail-sidebar" aria-label="网站信息与分享">
    <section class="detail-panel site-info"><h2>网站信息</h2><dl><div><dt>网站域名</dt><dd>{{ siteDomain }}</dd></div><div v-if="data.updated_at"><dt>最近更新</dt><dd>{{ new Date(data.updated_at).toLocaleDateString('zh-CN') }}</dd></div></dl><div v-if="data.stats" class="detail-stats"><div><strong>{{ data.stats.views.toLocaleString() }}</strong><span>详情访问</span></div><div><strong>{{ data.stats.clicks.toLocaleString() }}</strong><span>外链点击</span></div></div><NuxtLink class="navigation-link" to="/my-navigation"><AppIcon name="category" :size="18" />我的收藏与最近访问<AppIcon name="right" :size="16" /></NuxtLink></section>
    <section id="phone-share" class="detail-panel share-box" tabindex="-1"><h2>在手机上打开</h2><img v-if="qrDataUrl" :src="qrDataUrl" :alt="`${data.title} 分享二维码`" width="192" height="192"><p class="muted">扫描二维码，随时继续探索。</p><button v-if="qrDataUrl" class="button-link secondary qr-download" type="button" @click="downloadQr">下载二维码</button></section>
  </aside>
  </div>
  <div class="detail-related">
  <section v-if="data.related_sites?.length" class="related-sites"><h2>同类网站</h2><div class="related-site-grid"><DirectorySiteCard v-for="site in data.related_sites" :key="site.id" :site="site" /></div></section>
  <section v-if="data.related_tag_sites?.length" class="related-sites"><h2>同标签网站</h2><div class="related-site-grid"><DirectorySiteCard v-for="site in data.related_tag_sites" :key="site.id" :site="site" /></div></section>
  <RelatedContent :items="relatedContent?.results ?? []" />
  </div>
</section></template>

<style scoped>
.detail-page { padding-top: 28px; }
.detail-breadcrumb { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; color: var(--muted); font-size: .8rem; }
.detail-breadcrumb a { display: inline-flex; align-items: center; min-height: 44px; }
.detail-breadcrumb a:hover { color: var(--accent); }
.detail-hero { padding: 36px; border: 1px solid var(--hero-line); border-radius: 16px; background: var(--hero-bg); }
.detail-heading { display: flex; align-items: start; gap: 24px; }
.detail-logo { flex: 0 0 auto; display: grid; place-items: center; width: 104px; height: 104px; border: 1px solid var(--hero-line); border-radius: 24px; color: var(--accent-ink); background: var(--card); }
.detail-logo { --site-icon-font-size: 3rem; }
.detail-intro { min-width: 0; max-width: 820px; }
.detail-intro .eyebrow { color: var(--hero-muted); overflow-wrap: anywhere; }
.detail-intro .eyebrow span { margin-inline: 8px; }
.detail-intro h1 { color: var(--hero-ink); font-size: clamp(2rem, 3.5vw, 3rem); font-weight: 750; overflow-wrap: anywhere; }
.detail-description { margin: 16px 0 0; color: var(--hero-muted); line-height: 1.8; }
.detail-health { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 20px; font-size: .8rem; }
.detail-actions { display: flex; flex-wrap: wrap; align-items: end; gap: 10px; margin-top: 28px; padding-left: 128px; }
.visit-group { display: grid; gap: 5px; }
.action-group-label { color: var(--hero-muted); font-size: .7rem; }
.detail-actions .button-link { font-size: .85rem; font-weight: 600; }
.visit-button { min-width: 160px; justify-content: space-between; }
.detail-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; align-items: start; gap: 28px; margin-top: 28px; }
.detail-main, .detail-sidebar { display: grid; gap: 24px; min-width: 0; }
.detail-panel { padding: 28px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
.detail-panel h2 { font-size: 1.15rem; }
.panel-kicker { margin: 0 0 8px; color: var(--accent); font-size: .75rem; }
.about-description { margin: 20px 0 0; color: var(--muted); line-height: 1.9; overflow-wrap: anywhere; white-space: pre-line; }
.article-toc { display: grid; gap: 8px; padding: 16px 20px; margin: 20px 0; border-left: 3px solid var(--accent); background: var(--surface); }
.article-toc a { color: var(--muted); }
.toc-level-2 { padding-left: 16px; }
.article-body { overflow-wrap: anywhere; line-height: 1.85; }
.article-heading { margin: 1.8em 0 .7em; font-weight: 650; line-height: 1.35; scroll-margin-top: 100px; }
.article-heading:is(h1) { font-size: 1.8rem; }
.article-heading:is(h2) { font-size: 1.45rem; }
.article-heading:is(h3) { font-size: 1.2rem; }
.article-paragraph { margin: 0 0 1em; white-space: pre-wrap; }
.article-paragraph a, .article-list a { color: var(--accent-ink); text-decoration: underline; text-underline-offset: 3px; }
.article-list { padding-left: 1.5em; margin: 0 0 1.25em; }
.article-code { overflow-x: auto; padding: 16px; margin: 20px 0; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); font: .875rem/1.65 var(--font-mono); white-space: pre; }
.article-image { display: block; max-width: 100%; height: auto; margin: 20px 0; border-radius: 10px; }
.site-info dl { margin: 22px 0; font-size: .85rem; }
.site-info dl > div { display: flex; justify-content: space-between; gap: 16px; margin-top: 14px; }
.site-info dt { flex-shrink: 0; color: var(--muted); }
.site-info dd { margin: 0; text-align: right; overflow-wrap: anywhere; }
.detail-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding-block: 20px; border-block: 1px solid var(--line); }
.detail-stats strong, .detail-stats span { display: block; }
.detail-stats strong { font-family: var(--font-mono); font-size: 1.6rem; font-variant-numeric: tabular-nums; }
.detail-stats span { margin-top: 4px; color: var(--muted); font-size: .75rem; }
.navigation-link { display: flex; align-items: center; gap: 8px; min-height: 44px; margin-top: 16px; color: var(--accent); font-size: .8rem; }
.navigation-link > :last-child { margin-left: auto; }
.share-box { text-align: center; scroll-margin-top: 100px; }
.share-box > img { display: block; max-width: 100%; height: auto; margin: 20px auto 12px; padding: 8px; border: 1px solid var(--line); border-radius: 10px; background: white; }
.share-box .muted { font-size: .8rem; }
.qr-download { margin: 4px auto 0; }
.report-area { min-width: 0; }
.report-area > .muted { margin-top: 12px; }
.report-area :deep(.report-panel) { width: 100%; min-width: 0; margin-top: 20px; padding: 20px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
.report-area :deep(.report-panel .public-form input), .report-area :deep(.report-panel .public-form textarea), .report-area :deep(.report-panel .public-form select) { background: var(--card); }
.report-area :deep(.report-panel .public-form) { margin-top: 16px; }
.report-area :deep(.report-panel .public-form > h2) { margin-bottom: 18px; }
.detail-related { margin-top: 40px; }
.detail-main :deep(.public-form) { width: 100%; }
.detail-main :deep(.public-form input), .detail-main :deep(.public-form textarea) { background: var(--surface); font-weight: 400; }
.detail-main :deep(.comment-row) { margin-block: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--line); }
.secondary { color: var(--ink); background: var(--card); border: 1px solid var(--line); }
.secondary:hover { background: var(--accent-soft); }
.share-menu { position: relative; }
.share-options { position: absolute; top: calc(100% + 6px); right: 0; z-index: 5; min-width: 150px; padding: 6px; border: 1px solid var(--line); background: var(--card); box-shadow: var(--shadow); }
.share-options button, .share-options a { display: flex; align-items: center; min-height: 44px; padding: 0 16px; width: 100%; color: var(--ink); background: transparent; text-align: left; }
.share-options button:hover, .share-options a:hover { background: var(--accent-soft); }
.detail-feedback { margin: 16px 0 0; color: var(--accent-dark); font-weight: 600; }
.detail-signals { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; margin-top: 18px; font-size: .8rem; }
.signal-badge { padding: 4px 9px; border: 1px solid var(--line); border-radius: 999px; font-weight: 650; }
.signal-badge.ok { color: #166534; background: #dcfce7; border-color: #86efac; }
.signal-badge.slow { color: #854d0e; background: #fef9c3; border-color: #fde047; }
.signal-badge.unavailable { color: #991b1b; background: #fee2e2; border-color: #fca5a5; }
.signal-badge.pending { color: var(--muted); background: var(--surface); }
.signal-muted { color: var(--muted); }
.related-sites { margin-top: 2rem; }
.related-sites h2 { margin-bottom: 16px; }
.site-preview { display: block; width: 100%; max-height: 560px; aspect-ratio: 16 / 9; object-fit: contain; margin-top: 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
.related-site-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.related-site-grid :deep(.site-card) { min-width: 0; background: var(--card); }
@media (max-width: 1000px) { .detail-layout { grid-template-columns: minmax(0, 1fr) 280px; gap: 20px; } .detail-panel { padding: 24px; } .related-site-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 800px) { .detail-layout { grid-template-columns: 1fr; } .detail-sidebar { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; } .report-area { grid-column: 1 / -1; } .detail-hero { padding: 24px; } .detail-actions { padding-left: 0; } }
@media (max-width: 480px) { .detail-page { padding-top: 16px; } .detail-breadcrumb { margin-bottom: 12px; } .detail-heading { gap: 16px; } .detail-logo { width: 64px; height: 64px; border-radius: 16px; } .detail-icon { width: 48px; height: 48px; border-radius: 8px; } .detail-logo > span { font-size: 2rem; } .detail-intro h1 { font-size: 1.8rem; } .detail-hero { padding: 20px; } .detail-intro .eyebrow { font-size: .7rem; } .detail-description { font-size: .9rem; } .detail-sidebar { grid-template-columns: 1fr; } .detail-panel { padding: 20px; } .visit-button { flex: 1 1 100%; } .share-options { left: 0; right: auto; } .related-site-grid { grid-template-columns: 1fr; } }
</style>
