<script setup lang="ts">
import type { ImageAsset } from '#shared/types/assets'
import { articleToc, parseArticleBody } from '#shared/types/article-body'
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const open = ref(false)
const preview = ref(false)
const parts = computed(() => parseArticleBody(props.modelValue))
const toc = computed(() => articleToc(parts.value))
const snippets = [
  { label: '标题', value: '\n## 小标题\n' },
  { label: '列表', value: '\n- 列表项\n- 列表项\n' },
  { label: '链接', value: '[链接文字](https://example.com)' },
  { label: '代码块', value: '\n```text\n代码内容\n```\n' }
]
function insertText(value: string) {
  emit('update:modelValue', `${props.modelValue}${props.modelValue ? '\n' : ''}${value}`)
}
function insert(asset: ImageAsset) {
  emit('update:modelValue', `${props.modelValue}${props.modelValue ? '\n\n' : ''}![图片说明](${asset.url})\n`)
  open.value = false
}
</script>
<template>
  <div class="space-y-3">
    <div class="flex flex-wrap gap-2"><UButton v-for="snippet in snippets" :key="snippet.label" color="neutral" variant="outline" @click="insertText(snippet.value)">{{ snippet.label }}</UButton><UButton color="neutral" variant="outline" @click="open = true">插入图片</UButton><UButton color="neutral" variant="ghost" @click="preview = !preview">{{ preview ? '返回编辑' : '预览正文' }}</UButton></div>
    <UTextarea v-if="!preview" :model-value="modelValue" :rows="12" required maxlength="50000" class="w-full" aria-label="文章正文" @update:model-value="emit('update:modelValue', String($event))" />
    <div v-else class="article-preview space-y-3 rounded-lg border border-default p-4"><nav v-if="toc.length > 2" aria-label="文章目录" class="grid gap-1 border-l-2 border-primary pl-3"><strong>文章目录</strong><a v-for="heading in toc" :key="heading.id" :href="`#preview-${heading.id}`" :class="{ 'pl-3': heading.level === 2 }">{{ heading.text }}</a></nav><template v-for="(part, index) in parts" :key="index"><component :is="`h${part.level}`" v-if="part.type === 'heading'" :id="`preview-${part.id}`" class="font-semibold">{{ part.text }}</component><img v-else-if="part.type === 'image'" :src="part.url" :alt="part.alt" class="h-auto max-w-full rounded" loading="lazy" /><p v-else-if="part.type === 'paragraph'" class="whitespace-pre-wrap [overflow-wrap:anywhere]"><template v-for="(inline, itemIndex) in part.parts" :key="itemIndex"><a v-if="inline.type === 'link'" :href="inline.url" target="_blank" rel="noopener noreferrer">{{ inline.text }}</a><span v-else>{{ inline.text }}</span></template></p><component :is="part.ordered ? 'ol' : 'ul'" v-else-if="part.type === 'list'" class="list-inside list-disc"><li v-for="(item, itemIndex) in part.items" :key="itemIndex"><template v-for="(inline, textIndex) in item" :key="textIndex"><a v-if="inline.type === 'link'" :href="inline.url" target="_blank" rel="noopener noreferrer">{{ inline.text }}</a><span v-else>{{ inline.text }}</span></template></li></component><pre v-else-if="part.type === 'code'" class="overflow-x-auto rounded bg-elevated p-3"><code>{{ part.value }}</code></pre></template></div>
    <p class="text-sm text-muted">支持一级至三级标题、列表、HTTP(S)/站内链接、代码块和图片标记；HTML 会作为普通文本显示。</p>
    <UModal v-model:open="open" title="插入正文图片" description="选择图片后追加到正文末尾。"><template #body><AdminAssetLibrary v-if="open" selectable @select="insert" /></template></UModal>
  </div>
</template>
