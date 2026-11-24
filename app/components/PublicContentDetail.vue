<script setup lang="ts">
import { publicContentLabels, safeExternalUrl, type PublicCollection, type PublicContent } from '#shared/types/public-content'
import { articleToc, parseArticleBody, type ArticleBlock, type ArticleInline } from '#shared/types/article-body'
const props = defineProps<{ collection: PublicCollection; identifier: string }>()
const label = computed(() => publicContentLabels[props.collection])
const { data, error } = await useFetch<PublicContent>(`/api/public/${props.collection}/${encodeURIComponent(props.identifier)}`)
if (error.value) throw createError({ statusCode: error.value.statusCode ?? 500, statusMessage: error.value.statusCode === 404 ? '内容不存在' : '内容暂时无法加载' })
const targetUrl = computed(() => safeExternalUrl(data.value?.target_url))
const articleParts = computed(() => data.value?.body && props.collection === 'articles' ? parseArticleBody(data.value.body) : [])
const toc = computed(() => articleToc(articleParts.value))
useSeoMeta({ title: () => data.value ? `${data.value.title} - NavHub` : label.value, description: () => data.value?.summary ?? data.value?.description ?? '' })
</script>

<template>
  <section v-if="data" class="content-width page-section detail-page">
    <p class="eyebrow">{{ label }}详情</p><h1>{{ data.title }}</h1>
    <DetailTags :type="collection === 'resources' ? 'resource' : collection === 'articles' ? 'article' : collection === 'announcements' ? 'announcement' : 'media'" :identifier="data.id" />
    <img v-if="(collection === 'resources' || collection === 'media') && safeExternalUrl(data.cover_url)" :src="safeExternalUrl(data.cover_url)" :alt="data.title + ' 封面'" class="detail-cover" />
    <p v-if="data.summary || data.description" class="hero-copy">{{ data.summary ?? data.description }}</p>
    <p v-if="data.resource_type || data.media_type" class="muted">类型：{{ data.resource_type ?? data.media_type }}</p>
    <p v-if="data.rating != null" class="muted">评分：{{ data.rating }}</p>
    <div v-if="collection === 'resources'" class="detail-enrichment">
      <p v-if="data.version || data.platforms?.length" class="muted"><strong>版本：</strong>{{ data.version || '未标注' }}<span v-if="data.platforms?.length"> · {{ data.platforms.join('、') }}</span></p>
      <div v-if="data.screenshots?.length" class="detail-gallery"><a v-for="(image, index) in data.screenshots.filter(url => safeExternalUrl(url))" :key="image" :href="safeExternalUrl(image)" target="_blank" rel="noopener noreferrer"><img :src="safeExternalUrl(image)" :alt="`${data.title} 截图 ${index + 1}`" loading="lazy" /></a></div>
      <div v-if="data.download_sources?.length" class="detail-links"><strong>下载来源</strong><a v-for="source in data.download_sources.filter(item => safeExternalUrl(item.url))" :key="source.url" :href="safeExternalUrl(source.url)" target="_blank" rel="noopener noreferrer">{{ source.label }}<span v-if="source.extractionCode">（提取码：{{ source.extractionCode }}）</span></a></div>
      <div v-if="data.version_history?.length" class="detail-history"><strong>版本历史</strong><p v-for="release in data.version_history" :key="release.version"><b>{{ release.version }}</b><span v-if="release.releasedAt"> · {{ release.releasedAt }}</span><span v-if="release.notes">：{{ release.notes }}</span></p></div>
    </div>
    <div v-if="collection === 'media'" class="detail-enrichment">
      <p v-if="data.author || data.director || data.publisher || data.release_date" class="muted"><span v-if="data.author">作者：{{ data.author }} </span><span v-if="data.director">导演：{{ data.director }} </span><span v-if="data.publisher">出版/发行：{{ data.publisher }} </span><span v-if="data.release_date">发行日期：{{ data.release_date.slice(0, 10) }}</span></p>
      <div v-if="data.channels?.length" class="detail-links"><strong>可用渠道</strong><a v-for="channel in data.channels.filter(item => safeExternalUrl(item.url))" :key="channel.url" :href="safeExternalUrl(channel.url)" target="_blank" rel="noopener noreferrer">{{ ({ read: '阅读', watch: '观看', listen: '收听', official: '官方网站' } as Record<string, string>)[channel.kind] }} · {{ channel.label }}</a></div>
    </div>
    <nav v-if="collection === 'articles' && toc.length > 2" class="article-toc" aria-label="文章目录"><strong>文章目录</strong><a v-for="heading in toc" :key="heading.id" :href="`#${heading.id}`" :class="`toc-level-${heading.level}`">{{ heading.text }}</a></nav>
    <div v-if="data.body" class="article-body"><template v-if="collection === 'articles'"><template v-for="(part, index) in articleParts" :key="index">
      <component :is="`h${part.level}`" v-if="part.type === 'heading'" :id="part.id" class="article-heading">{{ part.text }}</component>
      <img v-else-if="part.type === 'image'" :src="part.url" :alt="part.alt" loading="lazy" class="article-image" />
      <p v-else-if="part.type === 'paragraph'" class="article-paragraph"><template v-for="(inline, inlineIndex) in part.parts" :key="inlineIndex"><a v-if="inline.type === 'link'" :href="inline.url" target="_blank" rel="noopener noreferrer">{{ inline.text }}</a><span v-else>{{ inline.text }}</span></template></p>
      <component :is="part.ordered ? 'ol' : 'ul'" v-else-if="part.type === 'list'" class="article-list"><li v-for="(item, itemIndex) in part.items" :key="itemIndex"><template v-for="(inline, inlineIndex) in item" :key="inlineIndex"><a v-if="inline.type === 'link'" :href="inline.url" target="_blank" rel="noopener noreferrer">{{ inline.text }}</a><span v-else>{{ inline.text }}</span></template></li></component>
      <pre v-else-if="part.type === 'code'" class="article-code"><code>{{ part.value }}</code></pre>
    </template></template><div v-else class="article-plain">{{ data.body }}</div></div>
    <a v-if="targetUrl" class="button-link" :href="`/out/${data.id}`" target="_blank" rel="noopener noreferrer">{{ collection === 'resources' ? '获取资源' : '查看相关链接' }} <span aria-hidden="true">→</span></a>
    <CommentsPanel v-if="collection !== 'announcements'" :content-type="collection === 'resources' ? 'resource' : collection === 'media' ? 'media' : 'article'" :content-id="data.id" />
    <RelatedContent :items="data.recommendations ?? []" />
    <nav v-if="collection === 'articles' && (data.navigation?.previous || data.navigation?.next)" aria-label="文章导航" class="article-navigation">
      <NuxtLink v-if="data.navigation?.previous" :to="`/articles/${encodeURIComponent(data.navigation.previous.slug)}`" rel="prev">上一篇：{{ data.navigation.previous.title }}</NuxtLink>
      <NuxtLink v-if="data.navigation?.next" :to="`/articles/${encodeURIComponent(data.navigation.next.slug)}`" rel="next">下一篇：{{ data.navigation.next.title }}</NuxtLink>
    </nav>
    <ReportPanel v-if="collection !== 'announcements'" :content-type="collection === 'resources' ? 'resource' : collection === 'media' ? 'media' : 'article'" :content-id="data.id" />
    <p class="detail-slug"><NuxtLink :to="`/${collection}`">返回{{ label }}列表</NuxtLink></p>
  </section>
</template>

<style scoped>
.detail-enrichment { margin: 24px 0; overflow-wrap: anywhere; }
.article-toc { display: grid; gap: 8px; max-width: 760px; padding: 16px 20px; margin: 24px 0; border-left: 3px solid var(--accent); background: var(--surface); }
.article-toc a { color: var(--muted); overflow-wrap: anywhere; }
.article-toc a:hover { color: var(--accent); }
.toc-level-2 { padding-left: 16px; }
.article-body { max-width: 760px; margin: 28px 0; overflow-wrap: anywhere; line-height: 1.85; }
.article-heading { margin: 1.8em 0 .7em; font-weight: 650; line-height: 1.35; scroll-margin-top: 100px; }
.article-heading:is(h1) { font-size: 1.8rem; }
.article-heading:is(h2) { font-size: 1.45rem; }
.article-heading:is(h3) { font-size: 1.2rem; }
.article-paragraph { margin: 0 0 1em; white-space: pre-wrap; }
.article-paragraph a, .article-list a { color: var(--accent-ink); text-decoration: underline; text-underline-offset: 3px; }
.article-list { padding-left: 1.5em; margin: 0 0 1.25em; }
.article-list li { padding-left: .25em; }
.article-code { overflow-x: auto; padding: 16px; margin: 20px 0; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); font: .875rem/1.65 var(--font-mono); white-space: pre; }
.article-image { display: block; max-width: 100%; height: auto; margin: 20px 0; border-radius: 10px; }
.article-plain { white-space: pre-wrap; }
.article-navigation { display: flex; flex-wrap: wrap; gap: 16px; margin: 24px 0; }
.article-navigation a { padding: 12px; border: 1px solid var(--line); border-radius: 10px; overflow-wrap: anywhere; }
.detail-cover { display: block; width: min(100%, 320px); max-height: 360px; object-fit: contain; margin: 24px 0; border-radius: 12px; }
.detail-gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 16px; margin: 24px 0; }
.detail-gallery img { display: block; width: 100%; aspect-ratio: 16/10; object-fit: contain; border-radius: 12px; }
.detail-links { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; margin: 24px 0; }
.detail-links a { padding: 12px 16px; border: 1px solid currentColor; border-radius: 10px; }
.detail-history { margin: 24px 0; white-space: pre-wrap; }
</style>
