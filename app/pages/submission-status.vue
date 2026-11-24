<script setup lang="ts">
useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }, { name: 'referrer', content: 'no-referrer' }] })
type Status = { contentType: string; payload: Record<string, unknown>; status: string; createdAt: string; reviewedAt: string | null; editable: boolean }
const receipt = ref('')
const loadedReceipt = ref('')
const result = ref<Status | null>(null)
const payload = ref('')
const title = ref('')
const url = ref('')
const description = ref('')
const pending = ref(false)
const error = ref('')
const message = ref('')
const statuses: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '未通过', spam: '未通过' }
watch(receipt, () => { result.value = null; message.value = ''; error.value = '' })
async function request(edit = false) {
  pending.value = true; error.value = ''; message.value = ''
  const token = receipt.value.trim()
  try {
    if (edit && result.value && token === loadedReceipt.value) {
      const nextPayload = result.value.contentType === 'site' ? { ...result.value.payload, title: title.value, targetUrl: url.value, description: description.value } : JSON.parse(payload.value)
      const saved = await $fetch<{ accepted: boolean; status: string; newReview: boolean }>('/api/public/submissions/edit', { method: 'POST', body: { receipt: token, submission: { contentType: result.value.contentType, payload: nextPayload } } })
      message.value = saved.newReview ? '修改已创建新的审核请求，原公开内容保持不变。' : '修改已保存，等待审核。'
    }
    const status = await $fetch<Status>('/api/public/submissions/status', { method: 'POST', body: { receipt: token } })
    if (receipt.value.trim() !== token) return
    result.value = status; loadedReceipt.value = token
    payload.value = JSON.stringify(status.payload, null, 2)
    title.value = String(status.payload.title ?? '')
    url.value = String(status.payload.targetUrl ?? '')
    description.value = String(status.payload.description ?? '')
  } catch (err: unknown) {
    error.value = err && typeof err === 'object' && 'data' in err ? String((err as { data?: { message?: string } }).data?.message ?? '请求失败，请检查回执或稍后重试') : '请求失败，请检查输入内容'
  } finally { pending.value = false }
}
</script>
<template>
  <section class="content-width page-section form-page">
    <p class="eyebrow">Submission status</p><h1>投稿审核结果</h1>
    <p>无需账号，输入回执即可查询。回执可用于修改投稿，请妥善保管。邮箱和内部审核备注不会在此展示。</p>
    <NuxtLink to="/submit">提交新投稿</NuxtLink>
    <form class="public-form" @submit.prevent="request()">
      <label>投稿回执<input v-model="receipt" required minlength="64" maxlength="64" autocomplete="off" spellcheck="false" :disabled="pending" /></label>
      <button :disabled="pending">{{ pending ? '处理中…' : '查询 / 刷新结果' }}</button>
    </form>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="message" role="status">{{ message }}</p>
    <div v-if="result">
      <p role="status">审核状态：{{ statuses[result.status] ?? '未知' }}</p>
      <p>投稿时间：{{ new Date(result.createdAt).toLocaleString() }}</p>
      <p v-if="result.reviewedAt">审核时间：{{ new Date(result.reviewedAt).toLocaleString() }}</p>
      <p v-if="result.status === 'approved'">修改将创建新的审核请求，原公开内容保持不变。</p>
      <form v-if="result.editable" class="public-form" @submit.prevent="request(true)">
        <template v-if="result.contentType === 'site'">
          <label>网站名称<input v-model="title" required maxlength="160" /></label>
          <label>网站地址<input v-model="url" type="url" required maxlength="2048" /></label>
          <label>简介<textarea v-model="description" maxlength="2000" rows="5" /></label>
        </template>
        <label v-else>投稿内容（JSON）<textarea v-model="payload" required maxlength="100000" rows="12" /></label>
        <button :disabled="pending">{{ pending ? '保存中…' : '保存并提交审核' }}</button>
      </form>
    </div>
  </section>
</template>
