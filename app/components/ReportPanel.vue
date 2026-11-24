<script setup lang="ts">
const { t, text } = useI18n()
const props = defineProps<{ contentType: 'site' | 'resource' | 'media' | 'article'; contentId: string }>()
const open = ref(false)
const pending = ref(false)
const message = ref('')
const error = ref('')
const form = reactive({ reason: 'broken_link', details: '', reporterName: '', contactEmail: '' })
const reasonId = useId()
const reasonOpen = ref(false)
const activeReason = ref(0)
const reasonTrigger = ref<HTMLButtonElement | null>(null)
const reasonOptions = computed(() => [
  { value: 'broken_link', label: text('链接失效', 'Broken link') },
  { value: 'wrong_content', label: text('内容不准确', 'Incorrect content') },
  { value: 'spam', label: text('垃圾内容', 'Spam') },
  { value: 'copyright', label: text('版权问题', 'Copyright concern') },
  { value: 'other', label: text('其他', 'Other') }
])
const reasonLabel = computed(() => reasonOptions.value.find(option => option.value === form.reason)?.label)
function toggleReasons() {
  activeReason.value = reasonOptions.value.findIndex(option => option.value === form.reason)
  reasonOpen.value = !reasonOpen.value
}
function selectReason(index: number) {
  const option = reasonOptions.value[index]
  if (!option) return
  form.reason = option.value
  reasonOpen.value = false
  reasonTrigger.value?.focus()
}
function reasonKeydown(event: KeyboardEvent) {
  if (event.key === 'Tab') { reasonOpen.value = false; return }
  if (event.key === 'Escape') { event.preventDefault(); reasonOpen.value = false; return }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    if (reasonOpen.value) selectReason(activeReason.value)
    else toggleReasons()
    return
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  if (!reasonOpen.value) { toggleReasons(); return }
  if (event.key === 'Home') activeReason.value = 0
  else if (event.key === 'End') activeReason.value = reasonOptions.value.length - 1
  else activeReason.value = (activeReason.value + (event.key === 'ArrowDown' ? 1 : -1) + reasonOptions.value.length) % reasonOptions.value.length
}
watch(open, () => { reasonOpen.value = false })
async function submit() {
  pending.value = true; message.value = ''; error.value = ''
  try {
    await $fetch('/api/public/reports', { method: 'POST', body: { ...form, contentType: props.contentType, contentId: props.contentId } })
    message.value = text('举报已提交，管理员会尽快处理。', 'Report submitted for review.')
    Object.assign(form, { reason: 'broken_link', details: '', reporterName: '', contactEmail: '' })
    open.value = false
  } catch { error.value = t('common.failed') }
  finally { pending.value = false }
}
</script>

<template>
  <section class="report-panel" :aria-label="text('内容举报', 'Report content')">
    <button type="button" class="button-secondary" :aria-expanded="open" @click="open = !open">{{ open ? text('收起举报', 'Close report') : text('举报内容', 'Report content') }}</button>
    <form v-if="open" class="public-form" @submit.prevent="submit">
      <h2 id="report-heading">{{ text('举报内容', 'Report content') }}</h2>
      <div class="reason-field">
        <label :id="`${reasonId}-label`" :for="reasonId">{{ text('举报原因', 'Reason') }}</label>
        <div class="reason-select">
          <button :id="reasonId" ref="reasonTrigger" type="button" role="combobox" aria-haspopup="listbox" :aria-labelledby="`${reasonId}-label`" :aria-expanded="reasonOpen" :aria-controls="`${reasonId}-list`" :aria-activedescendant="reasonOpen ? `${reasonId}-option-${activeReason}` : undefined" class="reason-trigger" @click="toggleReasons" @keydown="reasonKeydown" @blur="reasonOpen = false"><span>{{ reasonLabel }}</span><AppIcon name="down" :size="16" /></button>
          <div v-if="reasonOpen" class="reason-dismiss" aria-hidden="true" @pointerdown.prevent="reasonOpen = false"></div>
          <div v-if="reasonOpen" :id="`${reasonId}-list`" class="reason-options" role="listbox" :aria-labelledby="`${reasonId}-label`">
            <div v-for="(option, index) in reasonOptions" :id="`${reasonId}-option-${index}`" :key="option.value" role="option" :aria-selected="form.reason === option.value" :class="{ highlighted: activeReason === index }" @pointerdown.prevent @pointermove="activeReason = index" @click="selectReason(index)"><span>{{ option.label }}</span><span v-if="form.reason === option.value" class="reason-selected" aria-hidden="true"></span></div>
          </div>
        </div>
      </div>
      <label>{{ text('补充说明（可选）', 'Details (optional)') }}<textarea v-model="form.details" maxlength="2000" rows="3" /></label>
      <label>{{ t('common.optionalName') }}<input v-model="form.reporterName" maxlength="80" /></label>
      <label>{{ t('common.optionalEmail') }}<input v-model="form.contactEmail" type="email" maxlength="254" /></label>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <button type="submit" :disabled="pending">{{ pending ? t('common.submitting') : text('提交举报', 'Submit report') }}</button>
    </form>
    <p v-if="message" class="success-message" role="status">{{ message }}</p>
  </section>
</template>

<style scoped>
.public-form .reason-field > label { margin: 16px 0 6px; }
.reason-select { position: relative; }
.reason-trigger { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 48px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 7px; color: var(--ink); background: var(--card); font-weight: 400; text-align: left; }
.reason-trigger:hover { background: var(--card); }
.reason-dismiss { position: fixed; inset: 0; z-index: 29; }
.reason-options { position: absolute; top: calc(100% + 6px); inset-inline: 0; z-index: 30; padding: 5px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); box-shadow: var(--shadow); }
.reason-options > div { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; padding: 10px 12px; border-radius: 6px; color: var(--ink); font-weight: 400; cursor: pointer; }
.reason-options > div.highlighted { color: var(--accent-ink); background: var(--accent-soft); }
.reason-selected { width: 7px; height: 12px; margin-right: 4px; border: solid var(--accent); border-width: 0 2px 2px 0; transform: rotate(45deg); }
</style>
