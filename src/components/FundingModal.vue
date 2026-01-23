<template>
  <BaseHelpModal :is-visible="isVisible" title="Funding" :full-height="true" @close="close">
    <template #icon>
      <i class="bi bi-coin"></i>
    </template>
    <div class="funding-section">
      <p>All tools on this site are and will remain free and open source.</p>
      <p>
        However, running the site is not free. If you’d like to support the project and its core
        maintainer, you can make a voluntary donation at
        <a href="https://ko-fi.com/adamws" target="_blank">ko-fi/adamws</a>.
      </p>
      <p>
        Donations help cover operating costs (domain, server), with any remaining surplus going to
        the maintainer.
      </p>
    </div>
  </BaseHelpModal>
</template>

<script setup lang="ts">
import BaseHelpModal from './BaseHelpModal.vue'

interface Props {
  isVisible: boolean
}

interface Emits {
  (e: 'close'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const close = () => {
  emit('close')
}
</script>

<style scoped></style>
