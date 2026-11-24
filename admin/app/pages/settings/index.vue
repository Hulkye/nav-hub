<script setup lang="ts">
import { settingsSections } from '~/utils/settings-sections'

definePageMeta({ layout: 'default' })
</script>

<template>
  <AdminPage title="全局设置" description="管理网站外观、导航与访问体验">
    <div class="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <h2 class="text-xl font-semibold text-highlighted">网站设置</h2>
        <p class="mt-1 text-sm text-muted">选择需要调整的功能，在独立页面中编辑并保存。</p>
      </div>
      <nav aria-label="设置功能" class="grid gap-4 md:grid-cols-2">
        <NuxtLink
          v-for="section in settingsSections"
          :key="section.id"
          :to="`/settings/${section.id}`"
          class="group flex min-w-0 items-center gap-4 rounded-xl border border-default bg-default p-5 transition-colors hover:border-primary hover:bg-elevated/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none sm:p-6"
        >
          <span class="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UIcon :name="section.icon" class="size-5" aria-hidden="true" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block font-semibold text-highlighted">{{ section.title }}</span>
            <span class="mt-1 block text-sm leading-6 text-muted">{{ section.description }}</span>
          </span>
          <UIcon name="i-lucide-chevron-right" class="size-5 shrink-0 text-dimmed group-hover:text-primary" aria-hidden="true" />
        </NuxtLink>
      </nav>
    </div>
  </AdminPage>
</template>
