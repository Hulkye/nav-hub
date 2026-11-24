<script setup lang="ts">
import { siteSchema } from '#shared/schemas/content'
const route = useRoute()
const id = typeof route.query.id === 'string' ? route.query.id : undefined
type Site = { title: string; slug: string; description: string; body: string; target_url: string; backup_url: string | null; preview_url: string | null; icon_url: string | null; status: 'draft' | 'published' | 'offline'; sort_order: number; category_ids: string[]; tag_ids: string[] }
const form = ref({ title: '', slug: '', description: '', body: '', targetUrl: '', backupUrl: '', previewUrl: '', iconUrl: '', status: 'draft' as Site['status'], sortOrder: 0, categoryIds: [] as string[], tagIds: [] as string[] })
const [{ data: categories }, { data: tags }] = await Promise.all([
  useFetch<{ categories: { id: string; name: string; parent_id: string | null; sort_order: number }[] }>('/api/admin/categories'),
  useFetch<{ tags: { id: string; name: string }[] }>('/api/admin/tags')
])
if (id) {
  const site = await useRequestFetch()<Site>(`/api/admin/sites/${id}`)
  form.value = { title: site.title, slug: site.slug, description: site.description, body: site.body ?? '', targetUrl: site.target_url, backupUrl: site.backup_url ?? '', previewUrl: site.preview_url ?? '', iconUrl: site.icon_url ?? '', status: site.status, sortOrder: site.sort_order, categoryIds: site.category_ids, tagIds: site.tag_ids }
}
const busy = ref(false)
const error = ref('')
async function save() {
  if (busy.value) return
  busy.value = true; error.value = ''
  try {
    const body = siteSchema.parse({ ...form.value, iconUrl: form.value.iconUrl || null, backupUrl: form.value.backupUrl || null, previewUrl: form.value.previewUrl || null })
    await $fetch(id ? `/api/admin/sites/${id}` : '/api/admin/sites', { method: id ? 'PATCH' : 'POST', body })
    await navigateTo('/sites')
  } catch (cause) {
    error.value = cause && typeof cause === 'object' && 'data' in cause ? String((cause.data as { message?: string })?.message ?? '保存失败，请检查输入后重试') : cause instanceof Error ? cause.message : '保存失败，请重试'
  } finally { busy.value = false }
}
</script>

<template>
  <AdminPage :title="id ? '编辑网站' : '新增网站'">
    <template #toolbar><UDashboardToolbar><UButton to="/sites" color="neutral" variant="link" icon="i-lucide-arrow-left">网站列表</UButton></UDashboardToolbar></template>
    <AdminEditor :title="id ? '编辑网站' : '新增网站'" description="维护网站的基本信息、分类关联和发布设置。" return-to="/sites" :busy="busy" :error="error" @save="save">

      <AdminEditorField label="名称" required description="显示在公开页面和管理列表中的名称。"><UInput v-model="form.title" required maxlength="160" class="w-full" /></AdminEditorField>
      <AdminEditorField label="Slug" required description="用于详情页 URL，仅支持小写字母、数字和连字符。"><UInput v-model="form.slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxlength="120" class="w-full" /></AdminEditorField>
      <AdminEditorField label="地址" required description="用户访问该网站时跳转的 HTTP(S) 地址。"><UInput v-model="form.targetUrl" type="url" required class="w-full" /></AdminEditorField>
      <AdminEditorField label="备用地址" description="主地址不可用时显示的备用 HTTP(S) 地址。"><UInput v-model="form.backupUrl" type="url" class="w-full" /></AdminEditorField>
      <AdminEditorField label="预览地址" description="用于详情页预览的 HTTP(S) 地址。"><UInput v-model="form.previewUrl" type="url" class="w-full" /></AdminEditorField>
      <AdminEditorField label="网站图标" description="上传或从图片库选择，图片会自动转换为 WebP。"><AdminImagePicker v-model="form.iconUrl" /></AdminEditorField>
      <AdminEditorField label="简介" description="简要介绍内容，帮助访客了解其用途。" wide><UTextarea v-model="form.description" maxlength="2000" class="w-full" /></AdminEditorField>
      <AdminEditorField label="正文" description="网站详情页展示的 Markdown 正文，支持标题、列表、链接、代码块和图片标记。" wide><AdminArticleBody v-model="form.body" /></AdminEditorField>
      <AdminEditorField label="分类" description="可选择一级分类或其二级分类，支持多选。"><AdminCategoryCascader v-model="form.categoryIds" :categories="categories?.categories ?? []" /></AdminEditorField>
      <AdminEditorField label="标签" description="为内容添加标签，便于访客查找。"><USelect v-model="form.tagIds" :items="tags?.tags.map(item => ({ label: item.name, value: item.id })) ?? []" multiple class="w-full" /></AdminEditorField>
      <AdminEditorField label="状态" description="草稿和下线内容不会在前台公开。"><USelect v-model="form.status" :items="[{ label: '草稿', value: 'draft' }, { label: '已发布', value: 'published' }, { label: '已下线', value: 'offline' }]" class="w-full" /></AdminEditorField>
      <AdminEditorField label="排序" description="数值越小，展示位置越靠前。"><UInput v-model.number="form.sortOrder" type="number" min="0" max="999999" /></AdminEditorField>

    </AdminEditor>
  </AdminPage>
</template>
