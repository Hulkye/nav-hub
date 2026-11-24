<script setup lang="ts">
const props = defineProps<{ collection: 'sites' | 'resources' | 'media' | 'articles' | 'announcements'; exportQuery?: Record<string, string | undefined> }>()
const emit = defineEmits<{ imported: [] }>()
const importTimeoutMs = 15 * 60 * 1000
type ReportRow = { rowNumber: number; status: string; id?: string; errors?: string[] }
type Report = { batchId: string; total: number; imported: number; rejected: number; rows: ReportRow[] }
const busy = ref(false)
const error = ref('')
const report = ref<Report | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const menuOpen = ref(false)
const detailsOpen = ref(false)
function message(err: unknown) {
  if (err && typeof err === 'object' && 'data' in err) {
    const data = (err as { data?: { message?: string } }).data
    if (data?.message) return data.message
  }
  return err instanceof Error ? err.message : '操作失败，请重试'
}
function download(value: string | Blob, filename: string, type = 'application/json') {
  const url = URL.createObjectURL(value instanceof Blob ? value : new Blob([value], { type }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = filename; anchor.click()
  URL.revokeObjectURL(url)
}
async function exportFile(format: 'json' | 'csv', template = false, filtered = false) {
  if (busy.value) return
  busy.value = true; error.value = ''
  try {
    const blob = await $fetch<Blob>(`/api/admin/${props.collection}/${template ? 'template' : 'export'}`, { query: { format, ...(filtered ? props.exportQuery : {}) }, responseType: 'blob' })
    download(blob, `${props.collection}${filtered ? '-filtered' : template ? '-template' : ''}.${format}`)
  } catch (err) { error.value = message(err) } finally { busy.value = false }
}
function chooseImportFile() {
  menuOpen.value = false
  fileInput.value?.click()
}
async function importFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || busy.value) return
  error.value = ''; report.value = null
  if (!/\.(csv|json)$/i.test(file.name)) { error.value = '请选择 JSON 或 CSV 文件'; return }
  if (!confirm(`将「${file.name}」导入为草稿？重复 URL 或 Slug 的行会被拒绝，其他有效行仍会导入。`)) return
  busy.value = true
  try {
    const csv = /\.csv$/i.test(file.name)
    report.value = await $fetch<Report>(`/api/admin/${props.collection}/import`, {
      method: 'POST', body: await file.text(), signal: AbortSignal.timeout(importTimeoutMs), headers: { 'Content-Type': csv ? 'text/csv' : 'application/json' }
    })
    emit('imported')
  } catch (err) { error.value = message(err) } finally { busy.value = false }
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap gap-2">
      <UDropdownMenu :items="[[
        { label: '导出 JSON', icon: 'i-lucide-file-json', disabled: busy, onSelect: () => exportFile('json') },
        { label: '导出 CSV', icon: 'i-lucide-file-spreadsheet', disabled: busy, onSelect: () => exportFile('csv') },
        ...(props.collection === 'sites' ? [
          { label: '导出筛选结果 JSON', icon: 'i-lucide-list-filter', disabled: busy, onSelect: () => exportFile('json', false, true) },
          { label: '导出筛选结果 CSV', icon: 'i-lucide-file-spreadsheet', disabled: busy, onSelect: () => exportFile('csv', false, true) }
        ] : [])
      ]]">
        <UButton color="neutral" variant="outline" icon="i-lucide-download" trailing-icon="i-lucide-chevron-down" :loading="busy" aria-label="导出选项" aria-haspopup="menu">导出</UButton>
      </UDropdownMenu>
      <UDropdownMenu v-model:open="menuOpen" :items="[[
        { label: '导入为草稿', icon: 'i-lucide-upload', disabled: busy, onSelect: chooseImportFile },
        { label: '下载 JSON 模板', icon: 'i-lucide-file-json', disabled: busy, onSelect: () => exportFile('json', true) },
        { label: '下载 CSV 模板', icon: 'i-lucide-file-spreadsheet', disabled: busy, onSelect: () => exportFile('csv', true) }
      ], [
        { label: '导入记录', icon: 'i-lucide-history', to: { path: '/imports', query: { collection: props.collection } } }
      ]]">
        <UButton color="neutral" variant="outline" icon="i-lucide-upload" trailing-icon="i-lucide-chevron-down" :loading="busy" aria-label="导入选项" aria-haspopup="menu">导入</UButton>
      </UDropdownMenu>
      <input ref="fileInput" class="sr-only" tabindex="-1" type="file" accept=".json,.csv" aria-label="选择导入文件" :disabled="busy" @change="importFile" />
    </div>
    <UModal v-model:open="detailsOpen" title="导入与导出" description="导入内容会保存为草稿；导出最多 1000 条记录。CSV 分类和标签填写 ID，多个 ID 用 | 分隔。">
      <template #body><div class="space-y-3">
        <UAlert v-if="error" color="error" :description="error" role="alert" />
        <div v-if="report" class="space-y-2" aria-live="polite">
          <UAlert :color="report.rejected ? 'warning' : 'success'" :title="`导入完成：成功 ${report.imported} 行，失败 ${report.rejected} 行`" :description="`批次：${report.batchId}`" />
          <UButton color="neutral" variant="outline" @click="download(JSON.stringify(report, null, 2), `import-${report.batchId}.json`)">下载逐行报告</UButton>
          <p v-for="row in report.rows.filter(item => item.status === 'rejected')" :key="row.rowNumber" class="text-sm text-error break-words">第 {{ row.rowNumber }} 条数据：{{ row.errors?.join('；') }}</p>
        </div>
      </div></template>
    </UModal>
  </div>
</template>
