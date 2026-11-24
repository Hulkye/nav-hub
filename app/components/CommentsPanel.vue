<script setup lang="ts">
const { t, text } = useI18n()
const props = defineProps<{ contentType: 'site' | 'resource' | 'media' | 'article'; contentId: string }>()
const form = reactive({ displayName: '', email: '', body: '' })
const message = ref('')
const error = ref('')
const pending = ref(false)
const formOpen = ref(false)
const formId = useId()
const { data, refresh } = await useFetch<{ comments: Array<{ id: string; display_name: string; body: string; created_at: string }> }>(`/api/public/content/${props.contentType}/${props.contentId}/comments`)
async function submit() {
  pending.value = true; message.value = ''; error.value = ''
  try {
    await $fetch('/api/public/comments', { method: 'POST', body: { ...form, contentType: props.contentType, contentId: props.contentId } })
    Object.assign(form, { displayName: '', email: '', body: '' }); message.value = text('评论已提交，审核通过后显示。', 'Comment submitted. It will appear after approval.')
  } catch { error.value = t('common.failed') }
  finally { pending.value = false; await refresh() }
}
</script>
<template>
  <section class="comments-panel" aria-labelledby="comments-heading">
    <h2 id="comments-heading">{{ text('评论', 'Comments') }}</h2>
    <article v-for="comment in data?.comments" :key="comment.id" class="comment-row"><strong>{{ comment.display_name }}</strong><p>{{ comment.body }}</p></article>
    <p v-if="!data?.comments.length" class="muted">{{ text('暂无已审核评论。', 'No approved comments yet.') }}</p>
    <div class="comment-composer">
    <button class="button-secondary" type="button" :aria-expanded="formOpen" :aria-controls="formId" @click="formOpen = !formOpen">{{ formOpen ? text('收起评论', 'Close comment') : text('发表评论', 'Write a comment') }}</button>
    <form v-if="formOpen" :id="formId" class="public-form" @submit.prevent="submit"><label>{{ t('common.name') }}<input v-model="form.displayName" required maxlength="80" /></label><label>{{ t('common.optionalEmail') }}<input v-model="form.email" type="email" maxlength="254" /></label><label>{{ text('评论', 'Comment') }}<textarea v-model="form.body" required minlength="3" maxlength="2000" rows="4" /></label><p v-if="message" class="success-message" role="status">{{ message }}</p><p v-if="error" class="form-error" role="alert">{{ error }}</p><button type="submit" :disabled="pending">{{ pending ? t('common.submitting') : text('提交评论', 'Submit comment') }}</button></form>
    </div>
  </section>
</template>

<style scoped>
.comment-composer { margin-top: 20px; padding: 20px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
.comment-composer .public-form { width: 100%; margin-top: 16px; }
.comment-composer .public-form input, .comment-composer .public-form textarea { background: var(--card); }
</style>
