<script setup lang="ts">
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'
import { storeToRefs } from 'pinia'
import PcbRenderViewer from './PcbRenderViewer.vue'
import FootprintPreview from './FootprintPreview.vue'
import DownloadExpirationNotice from './DownloadExpirationNotice.vue'

const pcbStore = usePcbGeneratorStore()
const { renders, isTaskSuccess, isTaskFailed, taskStatus, isTaskActive } = storeToRefs(pcbStore)

function hasRenders(): boolean {
  return (
    renders.value.front !== null || renders.value.back !== null || renders.value.schematic !== null
  )
}

function getStatusMessage(): string {
  if (!taskStatus.value) return ''

  switch (taskStatus.value.task_status) {
    case 'PENDING':
      return 'Task is queued...'
    case 'PROGRESS':
      return taskStatus.value.task_result?.message ?? 'Generating PCB...'
    case 'SUCCESS':
      return 'PCB generated successfully!'
    case 'FAILURE':
      return taskStatus.value.task_result?.error ?? 'Task failed'
    case 'RETRY':
      const retries = taskStatus.value.task_result?.retries ?? 0
      const maxRetry = taskStatus.value.task_result?.max_retry ?? 3
      return `Retrying task (${retries}/${maxRetry})...`
    default:
      return ''
  }
}

function getProgressPercentage(): number {
  if (!taskStatus.value || !isTaskActive.value) return 0
  return taskStatus.value.task_result?.percentage ?? 0
}
</script>

<template>
  <div class="pcb-generator-results">
    <!-- Progress Bar -->
    <div v-if="isTaskActive" class="progress-wrapper">
      <div class="progress" aria-label="PCB generation progress">
        <div
          class="progress-bar progress-bar-striped progress-bar-animated"
          role="progressbar"
          :style="{ width: `${getProgressPercentage()}%` }"
          :aria-valuenow="getProgressPercentage()"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="`${getProgressPercentage()}% complete`"
        >
          <span class="progress-text">{{ getProgressPercentage() }}%</span>
        </div>
      </div>
      <p class="text-muted mt-3 text-center" aria-live="polite" aria-atomic="true">
        {{ getStatusMessage() }}
      </p>
    </div>

    <!-- Success State with Renders -->
    <div v-else-if="isTaskSuccess && hasRenders()">
      <PcbRenderViewer
        :front-svg="renders.front"
        :back-svg="renders.back"
        :schematic-svg="renders.schematic"
      />
      <DownloadExpirationNotice />
    </div>

    <!-- Failed State -->
    <div v-else-if="isTaskFailed" class="alert alert-danger py-2" role="alert">
      <div class="d-flex align-items-start gap-2">
        <i class="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
        <div>
          <strong class="d-block">Task Failed</strong>
          <small>{{
            taskStatus?.task_result?.error || 'An error occurred while generating the PCB.'
          }}</small>
        </div>
      </div>
    </div>

    <!-- No Results State -->
    <div v-else-if="isTaskSuccess && !hasRenders()" class="text-muted text-center py-3">
      <i class="bi bi-info-circle d-block mb-2"></i>
      <small>Task completed but no renders are available.</small>
    </div>

    <!-- Idle State with Footprint Preview -->
    <div v-else-if="!taskStatus" class="idle-preview-container">
      <FootprintPreview />
    </div>
  </div>
</template>

<style scoped>
.pcb-generator-results {
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.progress-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 2rem;
  max-width: 100%;
  box-sizing: border-box;
}

.progress-wrapper .progress {
  width: 100%;
  height: 30px;
  font-size: 1.25rem;
  font-weight: 600;
}

.progress-wrapper p {
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
  max-width: 100%;
  max-height: 200px;
  overflow-y: auto;
  margin-left: 1rem;
  margin-right: 1rem;
}

.progress-text {
  line-height: 60px;
}

.alert {
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
  max-width: 100%;
  max-height: 200px;
  overflow-y: auto;
}

.alert small {
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
  display: block;
}

.idle-preview-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: stretch;
  justify-content: center;
}
</style>
