<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
defineProps<{ collapsed?: boolean }>()
const colorMode = useColorMode()
const toast = useToast()
const loginPath = `${useRuntimeConfig().app.baseURL}login`.replace(/\/{2,}/g, '/')
const { data: session } = await useFetch<{ username: string }>('/api/admin/session')
async function logout() {
  try {
    await $fetch('/api/admin/auth/logout', { method: 'POST' })
    window.location.assign(loginPath)
  } catch {
    toast.add({ title: '退出失败，请重试', color: 'error' })
  }
}
const items = computed<DropdownMenuItem[][]>(() => [[{ type: 'label', label: session.value?.username ?? '管理员' }], [
  { label: '浅色模式', icon: 'i-lucide-sun', type: 'checkbox', checked: colorMode.value === 'light', onSelect: () => { colorMode.preference = 'light' } },
  { label: '深色模式', icon: 'i-lucide-moon', type: 'checkbox', checked: colorMode.value === 'dark', onSelect: () => { colorMode.preference = 'dark' } }
], [{ label: '退出登录', icon: 'i-lucide-log-out', onSelect: logout }]])
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'center', collisionPadding: 12 }" :ui="{ content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)' }">
    <UButton icon="i-lucide-user-circle" :label="collapsed ? undefined : session?.username ?? '管理员'" :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'" color="neutral" variant="ghost" block :square="collapsed" class="data-[state=open]:bg-elevated" />
  </UDropdownMenu>
</template>
