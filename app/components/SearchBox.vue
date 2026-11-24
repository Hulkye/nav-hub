<script setup lang="ts">
import { searchSourceUrl } from '#shared/schemas/search-sources'
const props = withDefaults(defineProps<{
  inputId?: string
  placeholder: string
  contentType?: string
  shortcut?: boolean
  minlength?: number
  multiSource?: boolean
}>(), { shortcut: false })
const model = defineModel<string>({ default: '' })
const { t, text } = useI18n()
const settings = await useSiteSettings()
const sourceCookie = useCookie<string | null>('navhub-search-source', { default: () => null, sameSite: 'lax', maxAge: 31536000 })
const sources = computed(() => [{ id: 'internal', label: text('站内', 'NavHub') }, ...settings.value.searchSources.filter(source => source.enabled)])
const savedSource = sourceCookie.value ?? settings.value.defaultSearchSource
const sourceId = ref(sources.value.some(source => source.id === savedSource) ? savedSource : 'internal')
const storageError = ref('')
watch(sources, () => { if (!sources.value.some(source => source.id === sourceId.value)) sourceId.value = 'internal' })
function chooseSource(id: string) {
  sourceId.value = id
  sourceCookie.value = id
  storageError.value = ''
}
function submit(event: SubmitEvent) {
  if (!props.multiSource || sourceId.value === 'internal') return
  event.preventDefault()
  const source = settings.value.searchSources.find(source => source.id === sourceId.value && source.enabled)
  if (!source) { storageError.value = text('搜索源已停用，请重新选择。', 'Search source is unavailable. Choose another.'); return }
  window.location.assign(searchSourceUrl(source.urlTemplate, model.value.trim()))
}
const generatedId = useId()
const input = ref<HTMLInputElement | null>(null)
function focusSearch(event: KeyboardEvent) {
  if (props.shortcut && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    input.value?.focus()
  }
}
onMounted(() => window.addEventListener('keydown', focusSearch))
onBeforeUnmount(() => window.removeEventListener('keydown', focusSearch))
</script>

<template>
  <form class="search-box" action="/search" method="get" role="search" @submit="submit">
    <div v-if="multiSource" class="search-sources" role="group" :aria-label="text('搜索源', 'Search source')"><button
        v-for="source in sources" :key="source.id" type="button" :aria-pressed="sourceId === source.id"
        @click="chooseSource(source.id)">{{ source.label }}</button></div>
    <p v-if="storageError" role="alert" class="form-error">{{ storageError }}</p>
    <label class="sr-only" :for="inputId ?? generatedId">{{ placeholder }}</label>
    <div class="search-box-input">
      <AppIcon name="search" :size="22" />
      <input :id="inputId ?? generatedId" ref="input" v-model="model" name="q" type="search" :minlength="minlength"
        :required="multiSource && sourceId !== 'internal'" maxlength="120" autocomplete="off"
        :placeholder="placeholder" />
      <kbd v-if="shortcut" aria-hidden="true">⌘ / Ctrl K</kbd>
      <button type="submit"><span>{{ t('nav.search') }}</span>
        <AppIcon name="right" :size="18" />
      </button>
    </div>
    <input v-if="contentType" type="hidden" name="type" :value="contentType" />
  </form>
</template>

<style scoped>
.search-box {
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
}

.search-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.search-sources button {
  min-height: 44px;
  padding: 8px 16px;
  border: 1px solid transparent;
  color: var(--hero-muted);
  background: transparent;
}

.search-sources button[aria-pressed="true"] {
  border-color: var(--hero-line);
  color: var(--accent-ink);
  background: var(--card);
}

.search-box-input {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 8px 8px 20px;
  border: 1px solid var(--hero-line);
  border-radius: 12px;
  color: var(--muted);
  background: var(--input-bg);
  box-shadow: 0 6px 0 -2px var(--hero-decoration);
}

.search-box-input input {
  font-size: 1rem;
  padding: 0;
}

.search-box-input button {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 48px;
  padding-inline: 24px;
  border-radius: 8px;
}

kbd {
  flex-shrink: 0;
  padding: 2px 5px;
  color: var(--muted);
  font: 11px var(--font-mono);
}

@media (max-width: 1120px) {
  kbd {
    display: none;
  }
}

@media (max-width: 600px) {
  .search-box-input {
    gap: 8px;
    padding-left: 12px;
  }

  .search-box-input button {
    padding-inline: 16px;
  }

  .search-box-input button>.icon-park {
    display: none;
  }
}
</style>
