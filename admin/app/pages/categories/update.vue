<script setup lang="ts">
definePageMeta({ layout: 'default' })
const route = useRoute()
const kind = route.query.kind === 'tags' ? 'tags' : 'categories'
const id = typeof route.query.id === 'string' ? route.query.id : undefined
type Category = { id: string; name: string; slug: string; description: string; parent_id: string | null; sort_order: number; icon_name: string | null }
type Tag = { id: string; name: string; slug: string; description: string; sort_order: number; icon_name: string | null }
const { data: categoryData, error: categoryError } = await useFetch<{ categories: Category[] }>('/api/admin/categories')
const { data: tagData, error: tagError } = await useFetch<{ tags: Tag[] }>('/api/admin/tags')
const categories = computed(() => categoryData.value?.categories ?? [])
const tags = computed(() => tagData.value?.tags ?? [])
const categoryForm = reactive({ name: '', slug: '', description: '', parentId: 'all', sortOrder: 0, iconName: null as string | null })
const tagForm = reactive({ name: '', slug: '', description: '', sortOrder: 0, iconName: null as string | null })
const editingCategory = ref<string | null>(null)
const parentSelection = computed({
  get: () => categoryForm.parentId === 'all' ? [] : [categoryForm.parentId],
  set: (ids: string[]) => { categoryForm.parentId = ids[0] ?? 'all' }
})
const parentCategories = computed(() => {
  const excluded = new Set<string>()
  if (editingCategory.value) excluded.add(editingCategory.value)
  let previousSize = -1
  while (previousSize !== excluded.size) {
    previousSize = excluded.size
    for (const category of categories.value) {
      if (category.parent_id && excluded.has(category.parent_id)) excluded.add(category.id)
    }
  }
  return categories.value.filter(category => !excluded.has(category.id))
})
const editingTag = ref<string | null>(null)
const busy = ref(false)
const error = ref('')
function editCategory(category: Category) {
  editingCategory.value = category.id
  Object.assign(categoryForm, { name: category.name, slug: category.slug, description: category.description, parentId: category.parent_id ?? 'all', sortOrder: category.sort_order, iconName: category.icon_name })
}
function editTag(tag: Tag) { editingTag.value = tag.id; Object.assign(tagForm, { name: tag.name, slug: tag.slug, description: tag.description, sortOrder: tag.sort_order, iconName: tag.icon_name }) }
function message(err: unknown) {
  if (err && typeof err === 'object' && 'data' in err) return String((err as { data?: { message?: string } }).data?.message ?? '操作失败')
  return '操作失败，请稍后重试'
}
async function saveCategory() {
  busy.value = true; error.value = ''
  try {
    await $fetch(editingCategory.value ? `/api/admin/categories/${editingCategory.value}` : '/api/admin/categories', { method: editingCategory.value ? 'PATCH' : 'POST', body: { ...categoryForm, parentId: categoryForm.parentId === 'all' ? null : categoryForm.parentId } })
    await navigateTo(kind === 'tags' ? '/tags' : '/categories')
  } catch (err) { error.value = message(err) } finally { busy.value = false }
}
async function saveTag() {
  busy.value = true; error.value = ''
  try {
    await $fetch(editingTag.value ? `/api/admin/tags/${editingTag.value}` : '/api/admin/tags', { method: editingTag.value ? 'PATCH' : 'POST', body: tagForm })
    await navigateTo('/tags')
  } catch (err) { error.value = message(err) } finally { busy.value = false }
}

if (categoryError.value) throw categoryError.value
if (tagError.value) throw tagError.value
if (id) {
  if (kind === 'categories') {
    const item = categories.value.find(item => item.id === id)
    if (!item) throw createError({ statusCode: 404, statusMessage: '分类不存在' })
    editCategory(item)
  } else {
    const item = tags.value.find(item => item.id === id)
    if (!item) throw createError({ statusCode: 404, statusMessage: '标签不存在' })
    editTag(item)
  }
}
</script>
<template>
  <AdminPage :title="(id ? '编辑' : '新增') + (kind === 'tags' ? '标签' : '分类')">
    <template #toolbar><UDashboardToolbar><UButton :to="kind === 'tags' ? '/tags' : '/categories'" color="neutral" variant="link" icon="i-lucide-arrow-left">{{ kind === 'tags' ? '标签' : '分类' }}列表</UButton></UDashboardToolbar></template>
    <AdminEditor :title="kind === 'tags' ? '标签信息' : '分类信息'" description="设置名称、详情页标识和展示顺序。" :return-to="kind === 'tags' ? '/tags' : '/categories'" :busy="busy" :error="error" @save="kind === 'tags' ? saveTag() : saveCategory()">
      <template v-if="kind === 'categories'">
          <AdminEditorField label="图标" description="使用 IconPark 图标，首页一级分类导航展示此图标。"><AdminIconPicker v-model="categoryForm.iconName" /></AdminEditorField>
          <AdminEditorField label="名称" description="显示在公开页面和管理列表中的名称。"><UInput class="w-full" v-model="categoryForm.name" required maxlength="100" /></AdminEditorField>
          <AdminEditorField label="Slug" description="用于详情页 URL，仅支持小写字母、数字和连字符。"><UInput class="w-full" v-model="categoryForm.slug" required maxlength="120" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></AdminEditorField>
          <AdminEditorField label="描述" description="简要说明该分类或标签的用途。" wide><UTextarea class="w-full" v-model="categoryForm.description" maxlength="500" :rows="3" /></AdminEditorField>
          <AdminEditorField label="父分类" description="级联选择上级分类；选择“无（顶级）”创建顶级分类。"><AdminCategoryCascader v-model="parentSelection" :categories="parentCategories" single empty-label="无（顶级）" /></AdminEditorField>
          <AdminEditorField label="排序" description="数值越小，展示位置越靠前。"><UInput class="w-full" v-model.number="categoryForm.sortOrder" type="number" min="0" max="999999" /></AdminEditorField>
          </template>
<template v-if="kind === 'tags'">
          <AdminEditorField label="图标" description="选择标签的 IconPark 图标。"><AdminIconPicker v-model="tagForm.iconName" /></AdminEditorField>
          <AdminEditorField label="名称" description="显示在公开页面和管理列表中的名称。"><UInput class="w-full" v-model="tagForm.name" required maxlength="100" /></AdminEditorField>
          <AdminEditorField label="Slug" description="用于详情页 URL，仅支持小写字母、数字和连字符。"><UInput class="w-full" v-model="tagForm.slug" required maxlength="120" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></AdminEditorField>
          <AdminEditorField label="描述" description="简要说明该分类或标签的用途。" wide><UTextarea class="w-full" v-model="tagForm.description" maxlength="500" :rows="3" /></AdminEditorField>
          <AdminEditorField label="排序" description="数值越小，展示位置越靠前。"><UInput class="w-full" v-model.number="tagForm.sortOrder" type="number" min="0" max="999999" /></AdminEditorField></template>
    </AdminEditor>
  </AdminPage>
</template>
