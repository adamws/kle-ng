<script setup lang="ts">
import { onUnmounted } from 'vue'
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'
import PcbWorkerStatus from './PcbWorkerStatus.vue'
import PcbGeneratorSettings from './PcbGeneratorSettings.vue'
import PcbGeneratorControls from './PcbGeneratorControls.vue'
import PcbGeneratorResults from './PcbGeneratorResults.vue'
import PcbDownloadButton from './PcbDownloadButton.vue'

const pcbStore = usePcbGeneratorStore()

// Cleanup on component unmount
onUnmounted(() => {
  pcbStore.cleanup()
})
</script>

<template>
  <div class="pcb-generator-panel">
    <!-- Two Column Layout: Controls | Output -->
    <div class="row g-3 h-100">
      <!-- Left Column: All Controls -->
      <div class="col-md-4 d-flex flex-column" style="max-width: 500px">
        <div class="flex-grow-0">
          <PcbGeneratorSettings />
          <PcbGeneratorControls />
          <PcbDownloadButton />
        </div>
        <div class="mt-auto">
          <PcbWorkerStatus />
        </div>
      </div>

      <!-- Right Column: All Output -->
      <div class="col-md-8">
        <div class="results-container">
          <PcbGeneratorResults />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pcb-generator-panel {
  padding: 1rem;
  border-radius: 0.5rem;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
  display: flex;
  flex-direction: column;
}

.panel-header {
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--bs-border-color);
}

.results-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
}
</style>
