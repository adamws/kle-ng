<script setup lang="ts">
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'
import { storeToRefs } from 'pinia'
import PcbRenderViewer from './PcbRenderViewer.vue'

const pcbStore = usePcbGeneratorStore()
const { renders, isTaskSuccess, isTaskFailed, taskStatus } = storeToRefs(pcbStore)

function getDownloadUrl(): string | null {
  return pcbStore.getResultDownloadUrl()
}

function hasRenders(): boolean {
  return (
    renders.value.front !== null || renders.value.back !== null || renders.value.schematic !== null
  )
}
</script>

<template>
  <div class="pcb-generator-results">
    <!-- Success State with Renders -->
    <div v-if="isTaskSuccess && hasRenders()">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h5 class="mb-0">Results</h5>
        <a v-if="getDownloadUrl()" :href="getDownloadUrl()!" class="btn btn-success" download>
          <i class="bi bi-download me-2"></i>
          Download ZIP
        </a>
      </div>

      <PcbRenderViewer
        :front-svg="renders.front"
        :back-svg="renders.back"
        :schematic-svg="renders.schematic"
      />
    </div>

    <!-- Failed State -->
    <div v-else-if="isTaskFailed" class="alert alert-danger" role="alert">
      <h6 class="alert-heading">
        <i class="bi bi-exclamation-triangle-fill me-2"></i>
        Task Failed
      </h6>
      <p class="mb-0">
        {{ taskStatus?.task_result?.error || 'An error occurred while generating the PCB.' }}
      </p>
    </div>

    <!-- No Results State -->
    <div v-else-if="isTaskSuccess && !hasRenders()" class="text-muted text-center p-4">
      <i class="bi bi-info-circle fs-3 d-block mb-2"></i>
      Task completed but no renders are available.
    </div>
  </div>
</template>

<style scoped>
.pcb-generator-results {
  padding: 1rem;
}
</style>
