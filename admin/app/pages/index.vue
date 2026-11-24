<script setup lang="ts">
definePageMeta({ layout: 'default' })
const session = await useRequestFetch()<{ username: string }>('/api/admin/session')
type Dashboard = {
  counts: { pending_submissions: number; pending_comments: number; published_sites: number; failed_links: number; completeness_issues: number }
  events: { views: number; clicks: number }
  popular_sites: Array<{ id: string; title: string; count: number }>
  popular_searches: Array<{ term: string; searches: number }>
  completeness: Array<{ content_type: string; count: number }>
}
const dashboard = await useRequestFetch()('/api/admin/dashboard') as Dashboard
const homepageModules = await useRequestFetch()<{ modules: Array<{ id: string }> }>('/api/admin/homepage')
const logout = async () => {
  await $fetch('/api/admin/auth/logout', { method: 'POST' })
  const loginPath = `${useRuntimeConfig().app.baseURL}login`.replace(/\/{2,}/g, '/')
  window.location.assign(loginPath)
}
</script>
<template>
<AdminPage title="运营概览"><div class="space-y-6"><div><p class="text-sm text-muted">Dashboard</p><h1 class="text-2xl font-bold">运营概览</h1></div>
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UCard v-for="item in [{ label: '待审核投稿', value: dashboard.counts.pending_submissions, icon: 'i-lucide-inbox', to: '/submissions' }, { label: '待审核评论', value: dashboard.counts.pending_comments, icon: 'i-lucide-message-square', to: '/comments' }, { label: '失效链接', value: dashboard.counts.failed_links, icon: 'i-lucide-heart-pulse', to: '/link-health' }, { label: '近 7 天访问量', value: dashboard.events.views, icon: 'i-lucide-eye', to: '/stats' }, { label: '近 7 天外链点击', value: dashboard.events.clicks, icon: 'i-lucide-mouse-pointer-click', to: '/stats' }, { label: '内容完整度问题', value: dashboard.counts.completeness_issues, icon: 'i-lucide-clipboard-check', to: '/sites' }, { label: '已发布网站', value: dashboard.counts.published_sites, icon: 'i-lucide-globe', to: '/sites' }, { label: '首页模块', value: homepageModules?.modules.length ?? 0, icon: 'i-lucide-panels-top-left', to: '/homepage' }]" :key="item.label"><NuxtLink :to="item.to" class="flex items-center justify-between rounded-lg focus-visible:outline-2 focus-visible:outline-primary"><div><p class="text-sm text-muted">{{ item.label }}</p><p class="mt-2 text-2xl font-semibold tabular-nums">{{ item.value }}</p></div><UIcon :name="item.icon" class="size-6 text-primary" /></NuxtLink></UCard>
    </div>
    <div class="grid gap-6 xl:grid-cols-2">
      <UCard><template #header><h2 class="font-semibold">热门站点（近 7 天）</h2></template><div v-if="dashboard.popular_sites.length" class="space-y-3"><div v-for="item in dashboard.popular_sites" :key="item.id" class="flex items-center justify-between"><span class="truncate">{{ item.title }}</span><UBadge color="neutral" variant="subtle">{{ item.count }}</UBadge></div></div><AdminEmpty v-else title="暂无热门站点" description="积累访问或外链点击后将在这里显示。" /></UCard>
      <UCard><template #header><h2 class="font-semibold">热门搜索词（近 30 天）</h2></template><div v-if="dashboard.popular_searches.length" class="space-y-3"><div v-for="item in dashboard.popular_searches" :key="item.term" class="flex items-center justify-between"><span class="truncate">{{ item.term }}</span><UBadge color="neutral" variant="subtle">{{ item.searches }}</UBadge></div></div><AdminEmpty v-else title="暂无热门搜索词" description="公开搜索记录将在这里汇总。" /></UCard>
    </div>
    <UCard><template #header><h2 class="font-semibold">内容完整度问题</h2></template><div v-if="dashboard.completeness.length" class="flex flex-wrap gap-2"><UBadge v-for="item in dashboard.completeness" :key="item.content_type" color="warning" variant="subtle">{{ { site: '网站', resource: '资源', media: '媒体', article: '文章' }[item.content_type] ?? item.content_type }}：{{ item.count }}</UBadge></div><AdminEmpty v-else title="内容完整" description="已发布内容暂未发现关键字段缺失。" /></UCard>
    <UCard><template #header><h2 class="font-semibold">快速入口</h2></template><div class="flex flex-wrap gap-2"><UButton to="/sites" icon="i-lucide-globe">管理网站</UButton><UButton to="/submissions" color="neutral" variant="outline" icon="i-lucide-inbox">审核投稿</UButton><UButton to="/homepage" color="neutral" variant="outline" icon="i-lucide-panels-top-left">编排首页</UButton></div></UCard>
  </div></AdminPage>
</template>
