<script setup lang="ts">
definePageMeta({ layout: 'default' })
const { data, refresh, error } = await useFetch<{ items: Array<{ id: string; submission_id: string; recipient: string; review_status: string; created_at: string }>; delivery: string }>('/api/admin/submission-notifications')
const pending = ref(false)
const failure = ref('')
async function handle(id: string) {
  pending.value = true; failure.value = ''
  try { await $fetch(`/api/admin/submission-notifications/${id}`, { method: 'PATCH' }); await refresh() }
  catch { failure.value = '操作失败，请重试' }
  finally { pending.value = false }
}
</script>
<template>
  <AdminPage title="审核结果通知待办">
    <p>有联系邮箱的投稿审核后自动进入此列表。当前仅人工处理，不会自动发送邮件。每次显示最早的 100 条待办。</p>
    <p v-if="error || failure" role="alert">{{ failure || '无法加载通知，请刷新重试' }}</p>
    <p v-if="data && !data.items.length">暂无待处理通知。</p>
    <article v-for="item in data?.items" :key="item.id">
      <p>{{ item.recipient }} · {{ item.review_status === 'approved' ? '审核通过' : '审核未通过' }}</p>
      <p>投稿编号：{{ item.submission_id }}</p>
      <button :disabled="pending" @click="handle(item.id)">已人工通知，标记处理</button>
    </article>
  </AdminPage>
</template>
