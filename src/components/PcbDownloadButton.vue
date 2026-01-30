<script setup lang="ts">
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'
import { storeToRefs } from 'pinia'
import BiDownload from 'bootstrap-icons/icons/download.svg'

const pcbStore = usePcbGeneratorStore()
const { isTaskSuccess, isDownloadAvailable } = storeToRefs(pcbStore)

function getDownloadUrl(): string | null {
  return pcbStore.getResultDownloadUrl()
}

function handleDownload() {
  const url = getDownloadUrl()
  if (url && isDownloadAvailable.value) {
    const link = document.createElement('a')
    link.href = url
    link.download = ''
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.click()
  }
}
</script>

<template>
  <div class="pcb-download-button">
    <button
      v-if="isTaskSuccess && getDownloadUrl()"
      type="button"
      class="btn btn-sm w-100 d-flex align-items-center justify-content-center gap-2"
      :class="isDownloadAvailable ? 'btn-primary' : 'btn-secondary'"
      :disabled="!isDownloadAvailable"
      @click="handleDownload"
      :aria-label="
        isDownloadAvailable ? 'Download generated PCB project as ZIP file' : 'Download link expired'
      "
    >
      <BiDownload aria-hidden="true" />
      {{ isDownloadAvailable ? 'Download ZIP' : 'Download Expired' }}
    </button>
  </div>
</template>

<style scoped>
.pcb-download-button {
  padding: 0;
  margin-top: 1.5rem;
}
</style>
