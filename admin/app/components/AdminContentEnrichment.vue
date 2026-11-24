<script setup lang="ts">
import type { z } from 'zod'
import type { resourceSchema, mediaSchema } from '#shared/schemas/admin-content'
type Resource = z.infer<typeof resourceSchema>
type Media = z.infer<typeof mediaSchema>
const props = defineProps<{ collection: 'resources' | 'media'; mediaType: string }>()
const model = defineModel<Record<string, unknown>>({ required: true })
const version = computed({ get: () => String(model.value.version ?? ''), set: value => { model.value.version = value } })
const platforms = computed({ get: () => (model.value.platforms as string[] ?? []).join(', '), set: value => { model.value.platforms = value.split(/[,，]/).map(item => item.trim()).filter(Boolean) } })
const screenshots = computed(() => model.value.screenshots as string[] ?? [])
const sources = computed(() => model.value.downloadSources as Resource['downloadSources'] ?? [])
const history = computed(() => model.value.versionHistory as Resource['versionHistory'] ?? [])
const channels = computed(() => model.value.channels as Media['channels'] ?? [])
const kinds = computed(() => (props.mediaType === 'book' ? ['read', 'official'] : props.mediaType === 'movie' ? ['watch', 'official'] : props.mediaType === 'music' ? ['listen', 'official'] : ['read', 'watch', 'listen', 'official']).map(value => ({ value, label: ({ read: '阅读', watch: '观看', listen: '收听', official: '官方网站' } as Record<string, string>)[value] ?? value })))
watch(() => props.mediaType, () => { model.value.channels = channels.value.map(channel => ({ ...channel, kind: kinds.value.some(kind => kind.value === channel.kind) ? channel.kind : kinds.value[0]!.value })) })
function add(field: string, value: unknown) { model.value[field] = [...(model.value[field] as unknown[] ?? []), value] }
function remove(field: string, index: number) { model.value[field] = (model.value[field] as unknown[]).filter((_, position) => position !== index) }
function updateItem(field: string, index: number, key: string, value: unknown) {
  const items = [...(model.value[field] as Array<Record<string, unknown>> ?? [])]
  items[index] = { ...items[index], [key]: value }
  model.value[field] = items
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="collection === 'resources'">
      <AdminEditorField label="适用平台" description="用逗号分隔，例如 Windows, macOS, Linux；最多 12 项。"><UInput v-model="platforms" class="w-full" aria-label="适用平台" /></AdminEditorField>
      <AdminEditorField label="当前版本"><UInput v-model="version" class="w-full" maxlength="80" aria-label="当前版本" /></AdminEditorField>
      <fieldset class="space-y-3"><legend class="font-semibold">资源截图</legend><p class="text-sm text-muted">最多 12 张，可上传或选择已有图片。</p>
        <div v-for="(_, index) in screenshots" :key="index" class="space-y-2 rounded-lg border border-default p-3"><AdminImagePicker v-model="screenshots[index]!" /><UButton color="neutral" variant="outline" type="button" @click="remove('screenshots', index)">删除截图 {{ index + 1 }}</UButton></div>
        <UButton color="neutral" variant="outline" type="button" :disabled="screenshots.length >= 12" @click="add('screenshots', '')">添加截图</UButton>
      </fieldset>
      <fieldset class="space-y-3"><legend class="font-semibold">下载来源</legend><p class="text-sm text-muted">最多 12 个 HTTP(S) 来源；提取码会公开展示。目标地址仍作为主要入口。</p>
        <div v-for="(source, sourceIndex) in sources" :key="sourceIndex" class="space-y-3 rounded-lg border border-default p-3">
          <label class="block space-y-1"><span>来源名称（必填）</span><UInput :model-value="sources[sourceIndex]?.label ?? ''" required maxlength="80" class="w-full" @update:model-value="updateItem('downloadSources', sourceIndex, 'label', $event)" /></label>
          <label class="block space-y-1"><span>下载地址（必填）</span><UInput :model-value="sources[sourceIndex]?.url ?? ''" type="url" required maxlength="2048" class="w-full" placeholder="下载链接" @update:model-value="updateItem('downloadSources', sourceIndex, 'url', $event)" /></label>
          <label class="block space-y-1"><span>提取码（可选）</span><UInput :model-value="sources[sourceIndex]?.extractionCode ?? ''" maxlength="80" class="w-full" @update:model-value="updateItem('downloadSources', sourceIndex, 'extractionCode', $event)" /></label>
          <UButton type="button" color="neutral" variant="outline" @click="remove('downloadSources', sourceIndex)">删除来源 {{ sourceIndex + 1 }}</UButton>
        </div>
        <UButton type="button" color="neutral" variant="outline" :disabled="sources.length >= 12" @click="add('downloadSources', { label: '', url: '', extractionCode: '' })">添加下载来源</UButton>
      </fieldset>
      <fieldset class="space-y-3"><legend class="font-semibold">版本历史</legend><p class="text-sm text-muted">最多 30 条，按填写顺序展示。</p>
        <div v-for="(release, index) in history" :key="index" class="space-y-3 rounded-lg border border-default p-3">
          <label class="block space-y-1"><span>版本号（必填）</span><UInput :model-value="history[index]?.version ?? ''" required maxlength="80" class="w-full" @update:model-value="updateItem('versionHistory', index, 'version', $event)" /></label>
          <label class="block space-y-1"><span>发布日期（可选）</span><UInput :model-value="history[index]?.releasedAt ?? ''" type="date" @update:model-value="updateItem('versionHistory', index, 'releasedAt', String($event) || null)" /></label>
          <label class="block space-y-1"><span>更新说明</span><UTextarea :model-value="history[index]?.notes ?? ''" maxlength="2000" class="w-full" @update:model-value="updateItem('versionHistory', index, 'notes', $event)" /></label>
          <UButton type="button" color="neutral" variant="outline" @click="remove('versionHistory', index)">删除历史 {{ index + 1 }}</UButton>
        </div>
        <UButton type="button" color="neutral" variant="outline" :disabled="history.length >= 30" @click="add('versionHistory', { version: '', releasedAt: null, notes: '' })">添加版本历史</UButton>
      </fieldset>
    </template>
    <template v-else>
      <AdminEditorField :label="mediaType === 'music' ? '作者 / 音乐人' : '作者'" v-if="mediaType !== 'movie'"><UInput :model-value="String(model.author ?? '')" maxlength="160" class="w-full" aria-label="作者" @update:model-value="model.author = $event" /></AdminEditorField>
      <AdminEditorField label="导演" v-if="mediaType === 'movie' || mediaType === 'other'"><UInput :model-value="String(model.director ?? '')" maxlength="160" class="w-full" aria-label="导演" @update:model-value="model.director = $event" /></AdminEditorField>
      <AdminEditorField :label="mediaType === 'book' ? '出版社' : '发行方'"><UInput :model-value="String(model.publisher ?? '')" maxlength="160" class="w-full" aria-label="出版或发行方" @update:model-value="model.publisher = $event" /></AdminEditorField>
      <AdminEditorField label="发行日期"><UInput :model-value="String(model.releaseDate ?? '')" type="date" aria-label="发行日期" @update:model-value="model.releaseDate = String($event) || null" /></AdminEditorField>
      <fieldset class="space-y-3"><legend class="font-semibold">阅读 / 观看 / 收听渠道</legend><p class="text-sm text-muted">最多 12 项，请填写合法公开渠道。</p>
        <div v-for="(channel, channelIndex) in channels" :key="channelIndex" class="space-y-3 rounded-lg border border-default p-3">
          <label class="block space-y-1"><span>渠道类型</span><USelect :model-value="channels[channelIndex]?.kind" :items="kinds" class="w-full" @update:model-value="updateItem('channels', channelIndex, 'kind', $event)" /></label>
          <label class="block space-y-1"><span>渠道名称（必填）</span><UInput :model-value="channels[channelIndex]?.label ?? ''" required maxlength="80" class="w-full" @update:model-value="updateItem('channels', channelIndex, 'label', $event)" /></label>
          <label class="block space-y-1"><span>渠道地址（必填）</span><UInput :model-value="channels[channelIndex]?.url ?? ''" type="url" required maxlength="2048" class="w-full" placeholder="下载链接" @update:model-value="updateItem('channels', channelIndex, 'url', $event)" /></label>
          <UButton type="button" color="neutral" variant="outline" @click="remove('channels', channelIndex)">删除渠道 {{ channelIndex + 1 }}</UButton>
        </div>
        <UButton type="button" color="neutral" variant="outline" :disabled="channels.length >= 12" @click="add('channels', { kind: kinds[0]!.value, label: '', url: '' })">添加渠道</UButton>
      </fieldset>
    </template>
  </div>
</template>
