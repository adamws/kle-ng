<script setup lang="ts">
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'
import { storeToRefs } from 'pinia'
import PcbRenderViewer from './PcbRenderViewer.vue'
import PcbBuildLog from './PcbBuildLog.vue'
import FootprintPreview from './FootprintPreview.vue'
import DownloadExpirationNotice from './DownloadExpirationNotice.vue'
import BiExclamationTriangleFill from 'bootstrap-icons/icons/exclamation-triangle-fill.svg'
import BiInfoCircle from 'bootstrap-icons/icons/info-circle.svg'

const pcbStore = usePcbGeneratorStore()
const { renders, isTaskSuccess, isTaskFailed, taskStatus, isTaskActive, buildLogs } =
  storeToRefs(pcbStore)

function hasRenders(): boolean {
  return (
    renders.value.front !== null ||
    renders.value.back !== null ||
    renders.value.schematics.some((schematic) => schematic.url !== null)
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
    default:
      return ''
  }
}
</script>

<template>
  <div class="pcb-generator-results">
    <!-- Progress Bar (indeterminate — the live log shows real activity) -->
    <div v-if="isTaskActive" class="progress-wrapper">
      <div
        class="progress"
        role="progressbar"
        aria-label="PCB generation in progress"
        aria-valuetext="Generating…"
      >
        <div
          class="progress-bar progress-bar-striped progress-bar-animated progress-bar-indeterminate"
        ></div>
      </div>
      <p class="text-muted text-center mb-0" aria-live="polite" aria-atomic="true">
        {{ getStatusMessage() }}
      </p>

      <!-- Live build log terminal (fills the remaining vertical space) -->
      <PcbBuildLog fill />
    </div>

    <!-- Success State with Renders -->
    <div v-else-if="isTaskSuccess && hasRenders()" class="success-wrapper">
      <PcbRenderViewer
        :front-svg="renders.front"
        :back-svg="renders.back"
        :schematics="renders.schematics"
        :has-logs="buildLogs.length > 0"
      />
      <DownloadExpirationNotice />
    </div>

    <!-- Failed State -->
    <div v-else-if="isTaskFailed" class="failed-wrapper">
      <div class="alert alert-danger py-2 mb-0" role="alert">
        <div class="d-flex align-items-start gap-2">
          <BiExclamationTriangleFill />
          <div>
            <strong class="d-block">Task Failed</strong>
            <small>{{
              taskStatus?.task_result?.error || 'An error occurred while generating the PCB.'
            }}</small>
          </div>
        </div>
      </div>

      <!-- Keep the build log visible after failure so the error output persists -->
      <PcbBuildLog fill />
    </div>

    <!-- No Results State -->
    <div v-else-if="isTaskSuccess && !hasRenders()" class="text-muted text-center py-3">
      <BiInfoCircle class="d-block mb-2" />
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
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}

.progress-wrapper {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  gap: 0.75rem;
  padding: 1.5rem;
  max-width: 100%;
  box-sizing: border-box;
  /* Let the build log fill remaining height and scroll internally. */
  overflow: hidden;
}

.progress-wrapper .progress {
  width: 100%;
  height: 8px;
  overflow: hidden;
}

/* Indeterminate loader: a partial bar sliding across, since the backend no
   longer reports a percentage and the live log conveys real progress. */
.progress-bar-indeterminate {
  width: 40%;
  border-radius: inherit;
  animation: pcb-indeterminate 1.4s ease-in-out infinite;
}

@keyframes pcb-indeterminate {
  0% {
    margin-left: -40%;
  }
  100% {
    margin-left: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .progress-bar-indeterminate {
    width: 100%;
    animation: none;
  }
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

.failed-wrapper {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  gap: 0.75rem;
  padding: 1rem;
  /* Let the build log fill remaining height and scroll internally. */
  overflow: hidden;
}

.success-wrapper {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.idle-preview-container {
  width: 100%;
  flex-grow: 1;
  display: flex;
  align-items: stretch;
  justify-content: center;
}
</style>
