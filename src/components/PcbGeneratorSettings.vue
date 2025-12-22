<script setup lang="ts">
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'
import { storeToRefs } from 'pinia'

const pcbStore = usePcbGeneratorStore()
const { settings } = storeToRefs(pcbStore)

// Switch footprint options
const switchFootprintOptions = [
  { value: 'Switch_Keyboard_Cherry_MX:SW_Cherry_MX_PCB_{:.2f}u', label: 'Cherry MX' },
  { value: 'Switch_Keyboard_Alps_Matias:SW_Alps_Matias_{:.2f}u', label: 'Alps' },
  {
    value: 'Switch_Keyboard_Hybrid:SW_Hybrid_Cherry_MX_Alps_{:.2f}u',
    label: 'Cherry MX/Alps Hybrid',
  },
  { value: 'Switch_Keyboard_Hotswap_Kailh:SW_Hotswap_Kailh_MX_{:.2f}u', label: 'Hotswap Kailh MX' },
]

// Diode footprint options
const diodeFootprintOptions = [
  { value: 'Diode_SMD:D_SOD-123', label: 'SOD-123' },
  { value: 'Diode_SMD:D_SOD-123F', label: 'SOD-123F' },
  { value: 'Diode_THT:D_SOD-323', label: 'SOD-323' },
  { value: 'Diode_SMD:D_SOD-323F', label: 'SOD-323F' },
]

// Routing options
const routingOptions = [
  { value: 'Disabled', label: 'Disabled' },
  { value: 'Switch-Diode only', label: 'Switch-Diode only' },
  { value: 'Full', label: 'Full' },
]
</script>

<template>
  <div class="pcb-generator-settings">
    <!-- Switch Footprint -->
    <div class="mb-3">
      <label for="switchFootprint" class="form-label form-label-sm">Switch Footprint</label>
      <select
        id="switchFootprint"
        v-model="settings.switchFootprint"
        class="form-select form-select-sm"
        aria-label="Select switch footprint type"
      >
        <option v-for="option in switchFootprintOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>

    <!-- Diode Footprint -->
    <div class="mb-3">
      <label for="diodeFootprint" class="form-label form-label-sm">Diode Footprint</label>
      <select
        id="diodeFootprint"
        v-model="settings.diodeFootprint"
        class="form-select form-select-sm"
        aria-label="Select diode footprint type"
      >
        <option v-for="option in diodeFootprintOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>

    <!-- Routing -->
    <div class="mb-3">
      <label for="routing" class="form-label form-label-sm">Routing</label>
      <select
        id="routing"
        v-model="settings.routing"
        class="form-select form-select-sm"
        aria-label="Select routing mode"
      >
        <option v-for="option in routingOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.pcb-generator-settings {
  padding: 0;
}

.form-label-sm {
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.bi-question-circle {
  cursor: help;
  color: var(--bs-secondary);
  font-size: 0.875rem;
}
</style>
