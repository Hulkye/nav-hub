<script setup lang="ts">
import type { ImageAsset } from '#shared/types/assets'

defineProps<{ selectable?: boolean }>()
const emit = defineEmits<{ select: [asset: ImageAsset] }>()
const file = ref<File | null>(null)
const page = ref(1)
const q = ref('')
const deleting = ref(false)
const references = ref<Array<{ content_type: string; content_id: string; title: string; field: string }> | null>(null)
const referencesOpen = computed({ get: () => references.value !== null, set: (value: boolean) => { if (!value) references.value = null } })
const uploading = ref(false)
const error = ref('')
const toast = useToast()
const { data, error: loadError, status, refresh } = await useFetch<{ items: ImageAsset[]; total: number }>('/api/admin/assets', { query: { page, q } })
watch(q, () => { page.value = 1 })
async function copy(asset: ImageAsset) {
  try { await navigator.clipboard.writeText(asset.url); toast.add({ title: '图片地址已复制', color: 'success' }) }
  catch { error.value = '复制失败，请检查浏览器剪贴板权限。' }
}
async function showReferences(asset: ImageAsset) {
  try { references.value = (await $fetch<{ references: NonNullable<typeof references.value> }>(`/api/admin/assets/${asset.id}`)).references }
  catch { error.value = '引用详情加载失败，请重试。' }
}
async function remove(asset: ImageAsset) {
  if (deleting.value || !confirm(`确定永久删除「${asset.filename}」吗？此操作不可撤销。`)) return
  deleting.value = true; error.value = ''
  try {
    await $fetch(`/api/admin/assets/${asset.id}`, { method: 'DELETE' })
    if (data.value?.items.length === 1 && page.value > 1) page.value--
    await refresh()
    toast.add({ title: '图片已删除', color: 'success' })
  } catch (cause) {
    error.value = cause && typeof cause === 'object' && 'data' in cause ? String((cause.data as { message?: string })?.message ?? '删除失败，请重试。') : '删除失败，请重试。'
  } finally { deleting.value = false }
}
async function upload(value: File | null | undefined) {
  if (!value || uploading.value) return
  error.value = ''
  if (value.size > 5 * 1024 * 1024) { error.value = '图片不能超过 5 MiB，请缩小后重试。'; return }
  uploading.value = true
  try {
    const body = new FormData()
    body.append('file', value)
    const asset = await $fetch<ImageAsset>('/api/admin/assets', { method: 'POST', body })
    file.value = null
    toast.add({ title: '上传成功', description: '图片已保存到图片库。', color: 'success' })
    page.value = 1
    await refresh()
    emit('select', asset)
  } catch (cause) {
    error.value = cause && typeof cause === 'object' && 'data' in cause
      ? String((cause.data as { message?: string })?.message ?? '图片上传失败，请重试。') : '图片上传失败，请重试。'
  } finally { uploading.value = false }
}
</script>

<template>
  <div class="space-y-4">
    <UFileUpload v-model="file" accept="image/jpeg,image/png,image/webp" :disabled="uploading" :loading="uploading" label="上传图片" description="JPEG、PNG 或 WebP，最大 5 MiB；上传后公开可访问，请勿上传私密图片。" @update:model-value="upload" />
    <p v-if="uploading" role="status" class="text-sm text-muted">正在处理并上传图片…</p>
    <UInput v-model="q" placeholder="按图片名称搜索" aria-label="按图片名称搜索" maxlength="120" icon="i-lucide-search" />
    <UAlert v-if="error" color="error" :description="error" role="alert" />
    <UAlert v-if="loadError" color="error" title="图片列表加载失败"><template #actions><UButton color="neutral" variant="outline" @click="refresh()">重试</UButton></template></UAlert>
    <p v-else-if="status === 'pending'" role="status" class="py-8 text-center text-muted">加载中…</p>
    <div v-else-if="data?.items.length" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <figure v-for="asset in data.items" :key="asset.id" class="min-w-0 rounded-lg border border-default p-2 text-left">
        <img :src="asset.url" :alt="asset.filename" class="aspect-square w-full rounded object-contain" loading="lazy" width="160" height="160" />
        <p class="mt-2 text-sm [overflow-wrap:anywhere]">{{ asset.filename }}</p>
        <p class="text-xs text-muted">{{ asset.width }} × {{ asset.height }} · {{ Math.ceil(asset.byte_size / 1024) }} KiB</p>
        <p class="mt-1 text-xs text-muted">{{ new Date(asset.created_at).toLocaleString('zh-CN') }}</p>
        <UButton color="neutral" variant="link" @click="showReferences(asset)">{{ asset.reference_count ?? 0 }} 处引用</UButton>
        <div class="flex flex-wrap gap-2">
          <UButton v-if="selectable" :disabled="uploading" @click="emit('select', asset)">选择</UButton>
          <UButton color="neutral" variant="outline" @click="copy(asset)">复制地址</UButton>
          <UButton color="error" variant="ghost" :disabled="deleting || uploading || !!asset.reference_count" @click="remove(asset)">删除</UButton>
        </div>
      </figure>
    </div>
    <AdminEmpty v-else title="图片库为空" description="上传图片后，可用于网站图标和内容封面。" />
    <UPagination v-if="data && data.total > 24" v-model:page="page" :total="data.total" :items-per-page="24" :disabled="uploading" />
    <UModal v-model:open="referencesOpen" title="图片引用" description="草稿、发布及下线内容的引用均会阻止删除。"><template #body><ul v-if="references?.length" class="space-y-3"><li v-for="item in references" :key="`${item.content_type}-${item.content_id}-${item.field}`">{{ item.title }} · {{ item.content_type }} · {{ item.field }}</li></ul><p v-else>暂未被内容引用。</p></template></UModal>
  </div>
</template>
