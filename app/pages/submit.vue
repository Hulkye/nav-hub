<script setup lang="ts">
import { submissionDraft, submissionDraftKey } from '../../shared/submission-draft'
const { t, text } = useI18n()

const form = reactive({ title: '', url: '', description: '', submitterName: '', contactEmail: '' })
const pending = ref(false)
const message = ref('')
const error = ref('')
const receipt = ref('')
const draftReady = ref(false)

onMounted(() => {
  try { Object.assign(form, submissionDraft(JSON.parse(localStorage.getItem(submissionDraftKey) ?? '{}'))) } catch { error.value = '无法读取本地草稿，浏览器存储可能不可用。' }
  draftReady.value = true
})
watch(form, () => {
  if (!draftReady.value) return
  try { localStorage.setItem(submissionDraftKey, JSON.stringify(submissionDraft(form))) } catch { error.value = '浏览器无法保存草稿，请在离开前自行备份。' }
})
function clearDraft() {
  Object.assign(form, { title: '', url: '', description: '', submitterName: '', contactEmail: '' })
  try { localStorage.removeItem(submissionDraftKey) } catch { error.value = '无法清除本地草稿，请在浏览器设置中清除网站数据。' }
}
async function submit() {
  pending.value = true; error.value = ''; message.value = ''
  try {
    const result = await $fetch<{ accepted: boolean; receipt: string }>('/api/public/submissions', { method: 'POST', body: { contentType: 'site', payload: { title: form.title, targetUrl: form.url, description: form.description }, submitterName: form.submitterName, contactEmail: form.contactEmail } })
    receipt.value = result.receipt
    message.value = '投稿已提交。请保存回执，用于查询审核结果和修改投稿。'
    clearDraft()
  } catch (err: unknown) { error.value = err && typeof err === 'object' && 'data' in err ? String((err as { data?: { message?: string } }).data?.message ?? '提交失败，请稍后重试') : '提交失败，请稍后重试' } finally { pending.value = false }
}
</script>
<template>
  <section class="content-width page-section form-page">
    <p class="eyebrow">Submit</p><h1>{{ text('提交收录', 'Submit a website') }}</h1>
    <p class="hero-copy">{{ text('推荐一个值得长期使用的网站，审核通过后会展示在导航站。', 'Recommend a useful website for the directory. Submissions are reviewed before publication.') }}</p>
    <p>{{ text('草稿自动保存在当前浏览器，不包含邮箱。审核结果请凭回执查询；目前不发送邮件通知。', 'Drafts are saved in this browser without your email. Use your receipt to check review results; email notifications are not sent.') }}</p>
    <NuxtLink to="/submission-status">{{ text('查询审核结果 / 修改投稿', 'Check status / Edit submission') }}</NuxtLink>
    <div v-if="receipt" class="public-form">
      <p role="status">{{ message }}</p>
      <label>{{ text('投稿回执（请复制保存）', 'Submission receipt (copy and save)') }}<input :value="receipt" readonly autocomplete="off" /></label>
      <p>{{ text('回执等同于修改凭证，请勿分享。关闭页面后无法恢复。', 'Your receipt allows editing. Keep it private; it cannot be recovered after closing this page.') }}</p>
      <NuxtLink to="/submission-status">{{ text('使用回执查询', 'Check using receipt') }}</NuxtLink>
    </div>
    <form v-if="!receipt" class="public-form" @submit.prevent="submit">
      <label>{{ text('网站名称', 'Website name') }}<input v-model="form.title" required maxlength="160" /></label>
      <label>{{ text('网站地址', 'Website URL') }}<input v-model="form.url" type="url" required maxlength="2048" placeholder="https://" /></label>
      <label>{{ t('common.description') }}<textarea v-model="form.description" required maxlength="2000" rows="5" /></label>
      <label>{{ t('common.optionalName') }}<input v-model="form.submitterName" maxlength="80" /></label>
      <label>{{ text('联系邮箱（可选，不保存到本地草稿）', 'Email (optional, excluded from local drafts)') }}<input v-model="form.contactEmail" type="email" maxlength="254" /></label>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="form-actions">
        <button type="submit" :disabled="pending">{{ pending ? t('common.submitting') : text('提交审核', 'Submit for review') }}</button>
        <button class="secondary-action" type="button" :disabled="pending" @click="clearDraft">{{ text('清除草稿', 'Clear draft') }}</button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.form-page > .eyebrow { margin-bottom: 10px; color: var(--accent-ink); font-size: .75rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
.form-page > h1 { margin: 0; font-size: clamp(2rem, 4vw, 2.75rem); line-height: 1.2; }
.form-page > .hero-copy { max-width: 58ch; margin: 16px 0 8px; color: var(--ink); font-size: 1.1rem; }
.form-page > p:not(.eyebrow):not(.hero-copy) { max-width: 68ch; color: var(--muted); }
.form-page > a { display: inline-flex; min-height: 40px; align-items: center; margin: 12px 0 28px; color: var(--accent-ink); font-weight: 600; }
.form-page > a:hover { text-decoration: underline; text-underline-offset: 3px; }
.public-form { padding: 24px; border: 1px solid var(--line); border-radius: 14px; background: var(--card); box-shadow: var(--shadow); }
.form-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
.form-actions button { min-height: 44px; }
.form-actions .secondary-action { border: 1px solid var(--line); color: var(--ink); background: var(--surface); }
.form-actions .secondary-action:hover { border-color: var(--muted); background: var(--card); }
@media (max-width: 600px) {
  .public-form { padding: 18px; }
  .form-actions { gap: 10px; }
}
</style>
