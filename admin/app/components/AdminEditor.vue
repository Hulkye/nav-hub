<script setup lang="ts">
defineProps<{
  title: string
  description: string
  returnTo: string
  busy: boolean
  error?: string
  publish?: boolean
}>()
const emit = defineEmits<{ save: [publish: boolean] }>()
const formId = useId()
function submit(event: Event) {
  const submitter = (event as SubmitEvent).submitter
  emit('save', submitter?.getAttribute('value') === 'publish')
}
</script>

<template>
  <div class="mx-auto flex w-full flex-col gap-4 sm:gap-6 lg:max-w-2xl lg:py-6">
    <form :id="formId" @submit.prevent="submit">
      <UPageCard :title="title" :description="description" variant="naked" orientation="horizontal" class="mb-4">
        <div class="flex flex-wrap items-center gap-2 lg:ms-auto">
          <UButton :to="returnTo" label="取消" color="neutral" variant="outline" :disabled="busy" />
          <UButton :form="formId" label="保存更改" color="neutral" type="submit" :loading="busy" :disabled="busy" />
          <UButton v-if="publish" :form="formId" label="保存并发布" type="submit" value="publish" :disabled="busy" />
        </div>
      </UPageCard>
      <UAlert v-if="error" color="error" variant="soft" title="保存失败" :description="error" role="alert" class="mb-4" />
      <UPageCard variant="subtle">
        <fieldset :disabled="busy" class="min-w-0 space-y-6">
          <slot />
        </fieldset>
      </UPageCard>
    </form>
  </div>
</template>
