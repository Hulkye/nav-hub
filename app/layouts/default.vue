<script setup lang="ts">
const mobileMenuOpen = ref(false)
const settings = await useSiteSettings()
useHead(() => ({
  title: settings.value.seo.title || settings.value.name,
  style: [{ id: 'site-safe-css-variables', textContent: [settings.value.customCss.cardRadius !== 'default' ? `:root{--site-card-radius:${settings.value.customCss.cardRadius}}` : '', settings.value.customCss.cardShadow === 'none' ? ':root{--shadow:none}' : settings.value.customCss.cardShadow === 'soft' ? ':root{--shadow:0 8px 24px #182a4b14}' : ''].filter(Boolean).join('') }],
  link: [
    ...(settings.value.faviconUrl ? [{ rel: 'icon' as const, href: settings.value.faviconUrl }] : []),
    { rel: 'alternate' as const, type: 'application/rss+xml', title: 'NavHub RSS', href: '/rss.xml' }
  ],
  meta: [
    { name: 'description', content: settings.value.seo.description || settings.value.description },
    { name: 'keywords', content: settings.value.seo.keywords },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: settings.value.name },
    { property: 'og:title', content: settings.value.seo.title || settings.value.name },
    { property: 'og:description', content: settings.value.seo.description || settings.value.description },
    ...(settings.value.seo.imageUrl ? [{ property: 'og:image', content: settings.value.seo.imageUrl }] : [])
  ]
}))
const { preference, cycleTheme } = useTheme(settings)
const { locale, setLocale, t } = useI18n(settings)
const themeLabel = computed(() => t(`common.${preference.value}`))
const builtInLinks: Record<string, [string, string, string]> = { '/': ['首页', 'home', 'home'], '/resources': ['资源', 'resources', 'all'], '/articles': ['文章', 'articles', 'article'], '/media': ['书影音', 'media', 'book'], '/search': ['搜索', 'search', 'search'], '/submit': ['投稿', 'submit', 'upload'], '/rankings': ['排行榜', 'rankings', 'all'], '/my-navigation': ['我的导航', 'myNavigation', 'category'] }
function navigationLink(link: { label: string; to: string }) {
  const builtin = builtInLinks[link.to]
  return { ...link, label: builtin && link.label === builtin[0] ? t(`nav.${builtin[1]}`) : link.label, icon: builtin?.[2] ?? 'arrow-up-right' }
}
const primaryLinks = computed(() => settings.value.navigation.map(navigationLink))
const mobileTabs = computed(() => settings.value.mobileTabs.map(navigationLink))
function toggleLocale() { setLocale(locale.value === 'zh-CN' ? 'en-US' : 'zh-CN') }

const closeMobileMenu = () => {
  mobileMenuOpen.value = false
}
</script>

<template>
  <div class="site-shell" :class="{ 'has-mobile-tabs': mobileTabs.length }">
    <a class="skip-link" href="#main-content">{{ locale === 'zh-CN' ? '跳至主要内容' : 'Skip to content' }}</a>
    <header class="site-header">
      <div class="site-header-inner">
        <NuxtLink class="brand" to="/" @click="closeMobileMenu">
          <img v-if="settings.logoUrl" :src="settings.logoUrl" alt="" width="40" height="40" style="object-fit: contain" />
          <span v-else class="brand-mark" aria-hidden="true">n.</span>
          <span>{{ settings.name }}<span class="brand-caption">{{ locale === 'zh-CN' ? '网址手册' : 'Web directory' }}</span></span>
        </NuxtLink>
        <nav class="desktop-nav" :aria-label="t('common.mainNavigation')">
          <NuxtLink v-for="link in primaryLinks" :key="link.to" :to="link.to"><AppIcon :name="link.icon" :size="18" /><span>{{ link.label }}</span></NuxtLink>
        </nav>
        <div class="header-actions">
          <NuxtLink class="submit-link" to="/submit"><AppIcon name="upload" :size="18" /><span>{{ t('nav.submit') }}</span></NuxtLink>
           <button class="locale-toggle" type="button" :aria-label="t('common.language')" @click="toggleLocale"><AppIcon name="translate" :size="18" /><span>{{ locale === 'zh-CN' ? 'EN' : '中' }}</span></button>
          <a class="admin-link" href="/admin/login">{{ t('nav.admin') }}</a>
          <button class="theme-toggle" type="button" :aria-label="`${t('common.theme')}: ${themeLabel}. ${t('common.switchTheme')}`" :title="themeLabel" @click="cycleTheme">
            <AppIcon :name="preference === 'dark' ? 'moon' : 'sun'" :size="19" />
          </button>
          <button class="menu-toggle" type="button" :aria-expanded="mobileMenuOpen" aria-controls="mobile-navigation" :aria-label="t('common.toggleMenu')" @click="mobileMenuOpen = !mobileMenuOpen">
            <AppIcon :name="mobileMenuOpen ? 'close' : 'menu'" :size="21" />
          </button>
        </div>
      </div>
      <nav v-if="mobileMenuOpen" id="mobile-navigation" class="mobile-nav" :aria-label="t('common.mainNavigation')">
        <NuxtLink v-for="link in primaryLinks" :key="link.to" :to="link.to" @click="closeMobileMenu"><AppIcon :name="link.icon" :size="18" /><span>{{ link.label }}</span></NuxtLink>
        <NuxtLink to="/submit" @click="closeMobileMenu"><AppIcon name="upload" :size="18" /><span>{{ t('nav.submit') }}</span></NuxtLink>
        <a href="/admin/login" @click="closeMobileMenu">{{ t('nav.admin') }}</a>
      </nav>
    </header>
    <main id="main-content" tabindex="-1"><slot /></main>
    <footer class="site-footer">
      <div class="footer-inner">
        <span>{{ settings.footer }}</span>
        <nav :aria-label="t('common.footerNavigation')"><NuxtLink to="/submit">{{ t('home.submit') }}</NuxtLink><NuxtLink to="/search">{{ t('nav.search') }}</NuxtLink><NuxtLink to="/tags">{{ t('nav.tags') }}</NuxtLink><a href="/rss.xml">RSS</a></nav>
      </div>
    </footer>
    <nav v-if="mobileTabs.length" class="mobile-bottom-nav" :aria-label="t('common.quickNavigation')">
      <NuxtLink v-for="(tab, index) in mobileTabs" :key="index" :to="tab.to" active-class="" exact-active-class="active" @click="closeMobileMenu"><AppIcon :name="tab.icon" :size="20" /><small>{{ tab.label }}</small></NuxtLink>
    </nav>
  </div>
</template>
