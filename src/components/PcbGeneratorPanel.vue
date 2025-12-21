<script setup lang="ts">
import { onUnmounted } from 'vue'
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'
import PcbWorkerStatus from './PcbWorkerStatus.vue'
import PcbGeneratorSettings from './PcbGeneratorSettings.vue'
import PcbGeneratorControls from './PcbGeneratorControls.vue'
import PcbGeneratorResults from './PcbGeneratorResults.vue'

const pcbStore = usePcbGeneratorStore()

// Cleanup on component unmount
onUnmounted(() => {
  pcbStore.cleanup()
})
</script>

<template>
  <div class="pcb-generator-panel">
    <!-- Two Column Layout: Controls | Output -->
    <div class="row g-3">
      <!-- Left Column: All Controls -->
      <div class="col-md-4">
        <PcbGeneratorSettings />
        <PcbGeneratorControls />
      </div>

      <!-- Right Column: All Output -->
      <div class="col-md-8">
        <PcbWorkerStatus />
        <PcbGeneratorResults />
      </div>
    </div>
  </div>
</template>

<style scoped>
.pcb-generator-panel {
  padding: 1rem;
  background-color: white;
  border-radius: 0.5rem;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
}

.panel-header {
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--bs-border-color);
}
</style>
