<script setup lang="ts">
import { computed } from 'vue'
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'
import { storeToRefs } from 'pinia'
import BiExclamationTriangleFill from 'bootstrap-icons/icons/exclamation-triangle-fill.svg'
import BiClockFill from 'bootstrap-icons/icons/clock-fill.svg'

const pcbStore = usePcbGeneratorStore()
const { downloadTimeRemaining, isDownloadExpired, isDownloadAvailable } = storeToRefs(pcbStore)

// Format milliseconds to MM:SS
function formatTimeRemaining(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Progressive urgency styling
const alertClass = computed(() => {
  if (isDownloadExpired.value) {
    return 'alert-danger'
  }

  const minutesRemaining = downloadTimeRemaining.value / 1000 / 60

  if (minutesRemaining <= 5) {
    return 'alert-danger' // Red when < 5 minutes
  } else if (minutesRemaining <= 15) {
    return 'alert-warning' // Yellow when < 15 minutes
  } else {
    return 'alert-info' // Blue when plenty of time
  }
})

const messageTitle = computed(() => {
  if (isDownloadExpired.value) {
    return 'Download Link Expired'
  }
  return 'Download Available'
})

const messageText = computed(() => {
  if (isDownloadExpired.value) {
    return 'The download link has expired. Generate a new PCB to get a fresh download link.'
  }

  const timeStr = formatTimeRemaining(downloadTimeRemaining.value)
  return `Download will expire in ${timeStr}. The preview will remain visible.`
})

// Only show message when urgent (< 15 minutes) or expired
const shouldShowMessage = computed(() => {
  if (isDownloadExpired.value) return true
  if (!isDownloadAvailable.value) return false
  const minutesRemaining = downloadTimeRemaining.value / 1000 / 60
  return minutesRemaining <= 15
})
</script>

<template>
  <div v-if="shouldShowMessage" class="download-expiration-notice mt-3">
    <div class="alert py-2" :class="alertClass" role="status" aria-live="polite" aria-atomic="true">
      <div class="d-flex align-items-start gap-2">
        <span class="notice-icon flex-shrink-0" aria-hidden="true">
          <BiExclamationTriangleFill v-if="isDownloadExpired" />
          <BiClockFill v-else />
        </span>
        <div class="flex-grow-1">
          <strong class="d-block">{{ messageTitle }}</strong>
          <small>{{ messageText }}</small>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.download-expiration-notice {
  padding: 0;
}

.alert {
  margin-bottom: 0;
  font-size: 0.875rem;
}

.notice-icon {
  font-size: 1rem;
  margin-top: 0.125rem;
}

.alert small {
  display: block;
  line-height: 1.4;
}
</style>
