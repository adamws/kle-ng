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
    <!-- Header -->
    <div class="panel-header">
      <h4>PCB Generator</h4>
      <p class="text-muted">
        Generate KiCad PCB files from your keyboard layout. Configure settings below and click
        "Generate PCB" to start.
      </p>
    </div>

    <!-- Worker Status -->
    <PcbWorkerStatus />

    <!-- Settings and Controls in Two Columns -->
    <div class="row">
      <div class="col-md-6">
        <PcbGeneratorSettings />
      </div>
      <div class="col-md-6">
        <PcbGeneratorControls />
      </div>
    </div>

    <!-- Results -->
    <PcbGeneratorResults />
  </div>
</template>

<style scoped>
.pcb-generator-panel {
  padding: 1.5rem;
  background-color: white;
  border-radius: 0.5rem;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
}

.panel-header {
  margin-bottom: 1.5rem;
}

.panel-header h4 {
  margin-bottom: 0.5rem;
}
</style>
