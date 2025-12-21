<script setup lang="ts">
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'
import { storeToRefs } from 'pinia'

const pcbStore = usePcbGeneratorStore()
const { settings } = storeToRefs(pcbStore)

// Switch footprint options
const switchFootprintOptions = [
  { value: 'Switch_Keyboard_Cherry_MX:SW_Cherry_MX_PCB_{:.2f}u', label: 'Cherry MX PCB' },
  { value: 'Switch_Keyboard_Cherry_MX:SW_Cherry_MX_Plate_{:.2f}u', label: 'Cherry MX Plate' },
  { value: 'Switch_Keyboard_Kailh:SW_Kailh_Choc_V1V2_{:.2f}u', label: 'Kailh Choc V1/V2' },
  { value: 'Switch_Keyboard_Hotswap_Kailh:SW_Kailh_Choc_{:.2f}u', label: 'Kailh Choc Hotswap' },
]

// Diode footprint options
const diodeFootprintOptions = [
  { value: 'Diode_SMD:D_SOD-123F', label: 'SOD-123F' },
  { value: 'Diode_SMD:D_SOD-123', label: 'SOD-123' },
  { value: 'Diode_THT:D_DO-35_SOD27_P7.62mm_Horizontal', label: 'DO-35 (THT)' },
  { value: 'Diode_SMD:D_0805_2012Metric', label: '0805 (SMD)' },
]

// Routing options
const routingOptions = [
  { value: 'Full', label: 'Full' },
  { value: 'Stub', label: 'Stub' },
]
</script>

<template>
  <div class="pcb-generator-settings">
    <h5>PCB Settings</h5>

    <!-- Switch Footprint -->
    <div class="mb-3">
      <label class="form-label">Switch Footprint</label>
      <div v-for="option in switchFootprintOptions" :key="option.value" class="form-check">
        <input
          :id="`switch-${option.value}`"
          v-model="settings.switchFootprint"
          class="form-check-input"
          type="radio"
          :value="option.value"
        />
        <label class="form-check-label" :for="`switch-${option.value}`">
          {{ option.label }}
        </label>
      </div>
    </div>

    <!-- Diode Footprint -->
    <div class="mb-3">
      <label class="form-label">Diode Footprint</label>
      <div v-for="option in diodeFootprintOptions" :key="option.value" class="form-check">
        <input
          :id="`diode-${option.value}`"
          v-model="settings.diodeFootprint"
          class="form-check-input"
          type="radio"
          :value="option.value"
        />
        <label class="form-check-label" :for="`diode-${option.value}`">
          {{ option.label }}
        </label>
      </div>
    </div>

    <!-- Routing -->
    <div class="mb-3">
      <label class="form-label">Routing</label>
      <div v-for="option in routingOptions" :key="option.value" class="form-check">
        <input
          :id="`routing-${option.value}`"
          v-model="settings.routing"
          class="form-check-input"
          type="radio"
          :value="option.value"
        />
        <label class="form-check-label" :for="`routing-${option.value}`">
          {{ option.label }}
        </label>
      </div>
    </div>

    <!-- Key Distance -->
    <div class="mb-3">
      <label class="form-label">
        Key Distance (mm)
        <i
          class="bi bi-question-circle ms-1"
          title="Distance between key centers in millimeters. Default is 19.05mm (0.75 inches)"
        ></i>
      </label>
      <div class="row g-2">
        <div class="col">
          <label for="keyDistanceX" class="form-label small">X (Horizontal)</label>
          <input
            id="keyDistanceX"
            v-model.number="settings.keyDistanceX"
            type="number"
            class="form-control"
            min="10"
            max="30"
            step="0.01"
          />
        </div>
        <div class="col">
          <label for="keyDistanceY" class="form-label small">Y (Vertical)</label>
          <input
            id="keyDistanceY"
            v-model.number="settings.keyDistanceY"
            type="number"
            class="form-control"
            min="10"
            max="30"
            step="0.01"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pcb-generator-settings {
  padding: 1rem;
}

.form-check {
  margin-bottom: 0.5rem;
}

.bi-question-circle {
  cursor: help;
  color: var(--bs-secondary);
}
</style>
