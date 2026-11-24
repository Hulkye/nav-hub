<script setup lang="ts">
definePageMeta({ layout: false })
const username = ref('')
const password = ref('')
const error = ref('')
const pending = ref(false)
const rememberUsername = ref(false)
const route = useRoute()

onMounted(() => {
  try {
    const savedUsername = localStorage.getItem('navhub-admin-username')
    if (savedUsername) {
      username.value = savedUsername
      rememberUsername.value = true
    }
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
})

const login = async () => {
  error.value = ''
  pending.value = true
  try {
    await $fetch('/api/admin/auth/login', { method: 'POST', body: { username: username.value, password: password.value } })
    try {
      if (rememberUsername.value) localStorage.setItem('navhub-admin-username', username.value)
      else localStorage.removeItem('navhub-admin-username')
    } catch {
      // Keep login successful even when browser storage is unavailable.
    }
    const redirect = route.query.redirect
    await navigateTo(typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//') && !redirect.includes('\\') && !redirect.startsWith('/login') && !redirect.startsWith('/admin/login') ? redirect : '/')
  } catch (cause) {
    error.value = cause && typeof cause === 'object' && 'data' in cause
      ? (cause.data as { message?: string })?.message || '登录失败，请稍后重试。'
      : '网络异常，请稍后重试。'
  } finally { pending.value = false }
}
</script>

<template>
  <main class="login-page relative isolate grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
    <div class="floating-elements" aria-hidden="true">
      <span v-for="element in 10" :key="element" class="floating-element" />
    </div>
    <section class="login-panel relative w-full max-w-[440px]">
      <UCard class="login-card" :ui="{ body: 'p-6 sm:p-9' }">
        <form class="space-y-5" @submit.prevent="login">
          <UFormField label="账号" name="username">
            <UInput v-model="username" autocomplete="username" required class="w-full" size="xl" placeholder="请输入管理员账号" />
          </UFormField>
          <UFormField label="密码" name="password">
            <UInput v-model="password" type="password" autocomplete="current-password" required class="w-full" size="xl" placeholder="请输入登录密码" />
          </UFormField>
          <label class="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-muted">
            <input v-model="rememberUsername" type="checkbox" class="size-4 cursor-pointer accent-[var(--ui-primary)]" />
            <span>记住账号</span>
          </label>
          <UAlert v-if="error" color="error" variant="soft" title="登录失败" :description="error" role="alert" />
          <UButton type="submit" block size="xl" :loading="pending" class="login-button">
            {{ pending ? '登录中…' : '登录' }}
            <UIcon v-if="!pending" name="i-lucide-arrow-right" class="size-4" aria-hidden="true" />
          </UButton>
        </form>
      </UCard>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  background: linear-gradient(135deg, #101b31, #17233b 48%, #12343b);
}

.floating-elements {
  position: absolute;
  z-index: -1;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.floating-element {
  position: absolute;
  width: 54px;
  height: 54px;
  border: 1px solid rgb(255 255 255 / 24%);
  /* border-radius: 50%; */
  /* background: radial-gradient(circle at 30% 28%, rgb(255 255 255 / 38%), rgb(255 255 255 / 12%) 45%, rgb(255 255 255 / 5%) 75%); */
  box-shadow: inset -6px -8px 16px rgb(255 255 255 / 5%), 0 0 24px rgb(125 211 252 / 10%);
  animation: float-random 20s ease-in-out infinite alternate;
}

.floating-element:nth-child(1) { top: 12%; left: 9%; width: 42px; height: 42px; animation-duration: 17s; animation-delay: -2s; }
.floating-element:nth-child(2) { top: 22%; left: 24%; width: 92px; height: 92px; animation-duration: 23s; animation-delay: -8s; }
.floating-element:nth-child(3) { top: 8%; left: 48%; width: 24px; height: 24px; animation-duration: 15s; animation-delay: -5s; }
.floating-element:nth-child(4) { top: 18%; right: 12%; width: 68px; height: 68px; animation-duration: 21s; animation-delay: -11s; }
.floating-element:nth-child(5) { top: 54%; left: 6%; width: 76px; height: 76px; animation-duration: 24s; animation-delay: -14s; }
.floating-element:nth-child(6) { top: 66%; left: 28%; width: 32px; height: 32px; animation-duration: 18s; animation-delay: -7s; }
.floating-element:nth-child(7) { top: 72%; right: 8%; width: 112px; height: 112px; animation-duration: 26s; animation-delay: -16s; }
.floating-element:nth-child(8) { top: 42%; right: 22%; width: 38px; height: 38px; animation-duration: 16s; animation-delay: -3s; }
.floating-element:nth-child(9) { top: 82%; left: 52%; width: 62px; height: 62px; animation-duration: 22s; animation-delay: -10s; }
.floating-element:nth-child(10) { top: 38%; left: 78%; width: 20px; height: 20px; animation-duration: 19s; animation-delay: -6s; }

.login-card { animation: enter 650ms cubic-bezier(0.2, 0.75, 0.25, 1) 80ms both; }
.login-button { transition: transform 180ms ease, box-shadow 180ms ease; }
.login-button:hover { transform: translateY(-1px); box-shadow: 0 8px 24px color-mix(in srgb, var(--ui-primary) 25%, transparent); }

@keyframes enter {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes float-random {
  0% { transform: translate3d(0, 0, 0) rotate(0deg); }
  50% { transform: translate3d(44px, 28px, 0) rotate(180deg); }
  100% { transform: translate3d(20px, 54px, 0) rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
}
</style>
