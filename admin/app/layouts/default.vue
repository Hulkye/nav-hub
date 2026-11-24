<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const open = ref(false)
const links = [[
  { label: '运营概览', icon: 'i-lucide-house', to: '/', exact: true },
  { label: '首页编排', icon: 'i-lucide-panels-top-left', to: '/homepage' },
  { label: '全局设置', icon: 'i-lucide-settings-2', to: '/settings' },
  { label: '访问统计', icon: 'i-lucide-chart-no-axes-combined', to: '/stats' },
  { label: '搜索分析', icon: 'i-lucide-search-check', to: '/search-analytics' },
  { label: '链接健康', icon: 'i-lucide-heart-pulse', to: '/link-health' }
], [
  { label: '网站', icon: 'i-lucide-globe', to: '/sites' },
  { label: '资源', icon: 'i-lucide-folder-open', to: '/resources' },
  { label: '媒体', icon: 'i-lucide-image', to: '/media' },
  { label: '文章', icon: 'i-lucide-file-text', to: '/articles' },
  { label: '公告', icon: 'i-lucide-megaphone', to: '/announcements' },
  { label: '导入记录', icon: 'i-lucide-file-clock', to: '/imports' },
  { label: '投稿审核', icon: 'i-lucide-inbox', to: '/submissions' },
  { label: '审核通知待办', icon: 'i-lucide-mail', to: '/submission-notifications' },
  { label: '评论审核', icon: 'i-lucide-message-square', to: '/comments' },
  { label: '举报处理', icon: 'i-lucide-flag', to: '/reports' }
], [
  { label: '分类', icon: 'i-lucide-tags', to: '/categories' },
  { label: '标签', icon: 'i-lucide-tag', to: '/tags' },
  { label: '图片库', icon: 'i-lucide-images', to: '/assets' }
]] satisfies NavigationMenuItem[][]
const groups = computed(() => [{ id: 'overview', label: '概览与运营', items: links[0] }, { id: 'content', label: '内容管理', items: links[1] }, { id: 'resources', label: '分类与资源', items: links[2] }])
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar id="default" v-model:open="open" collapsible resizable class="bg-elevated/25" :ui="{ footer: 'lg:border-t lg:border-default' }">
      <template #header="{ collapsed }"><TeamsMenu :collapsed="collapsed" /></template>
      <template #default="{ collapsed }">
        <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" />
        <UNavigationMenu :collapsed="collapsed" :items="links[0]" orientation="vertical" tooltip popover />
        <UNavigationMenu :collapsed="collapsed" :items="links[1]" orientation="vertical" tooltip popover class="mt-3" />
        <UNavigationMenu :collapsed="collapsed" :items="links[2]" orientation="vertical" tooltip popover class="mt-3" />
      </template>
      <template #footer="{ collapsed }"><UserMenu :collapsed="collapsed" /></template>
    </UDashboardSidebar>
    <UDashboardSearch :groups="groups" />
    <slot />
  </UDashboardGroup>
</template>
