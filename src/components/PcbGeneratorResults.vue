<script setup lang="ts">
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'
import { storeToRefs } from 'pinia'
import PcbRenderViewer from './PcbRenderViewer.vue'

const pcbStore = usePcbGeneratorStore()
const { renders, isTaskSuccess, isTaskFailed, taskStatus, isTaskActive } = storeToRefs(pcbStore)

function getDownloadUrl(): string | null {
  return pcbStore.getResultDownloadUrl()
}

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
    case 'PROGRESS': {
      const percentage = taskStatus.value.task_result?.percentage ?? 0
      return `Generating PCB... ${percentage}%`
    }
    case 'SUCCESS':
      return 'PCB generated successfully!'
    case 'FAILURE':
      return taskStatus.value.task_result?.error ?? 'Task failed'
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
    <div v-if="isTaskActive" class="mb-3">
      <div class="progress" style="height: 20px" aria-label="PCB generation progress">
        <div
          class="progress-bar progress-bar-striped progress-bar-animated"
          role="progressbar"
          :style="{ width: `${getProgressPercentage()}%` }"
          :aria-valuenow="getProgressPercentage()"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="`${getProgressPercentage()}% complete`"
        >
          {{ getProgressPercentage() }}%
        </div>
      </div>
      <small class="text-muted mt-1 d-block" aria-live="polite" aria-atomic="true">{{
        getStatusMessage()
      }}</small>
    </div>

    <!-- Success State with Renders -->
    <div v-if="isTaskSuccess && hasRenders()">
      <PcbRenderViewer
        :front-svg="renders.front"
        :back-svg="renders.back"
        :schematic-svg="renders.schematic"
      />
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div class="d-flex align-items-center gap-2">
          <i class="bi bi-check-circle-fill text-primary"></i>
          <span class="fw-medium">{{ getStatusMessage() }}</span>
        </div>
        <a
          v-if="getDownloadUrl()"
          :href="getDownloadUrl()!"
          class="btn btn-primary btn-sm"
          download
          aria-label="Download generated PCB project as ZIP file"
        >
          <i class="bi bi-download me-1" aria-hidden="true"></i>
          Download ZIP
        </a>
      </div>
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

    <!-- Idle State -->
    <div v-else-if="!taskStatus" class="text-muted text-center py-4">
      <i class="bi bi-cpu d-block mb-2 fs-3 opacity-25"></i>
      <small>Configure settings and click "Generate PCB" to start.</small>
    </div>
  </div>
</template>

<style scoped>
.pcb-generator-results {
  padding: 0;
}
</style>
