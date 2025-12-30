<script setup lang="ts">
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'
import { storeToRefs } from 'pinia'
import CustomNumberInput from './CustomNumberInput.vue'

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
  {
    value: 'Switch_Keyboard_Hotswap_Kailh:SW_Hotswap_Kailh_Choc_V1V2_{:.2f}u',
    label: 'Hotswap Kailh Choc',
  },
]

// Diode footprint options
const diodeFootprintOptions = [
  { value: 'Diode_SMD:D_SOD-123', label: 'SOD-123' },
  { value: 'Diode_SMD:D_SOD-123F', label: 'SOD-123F' },
  { value: 'Diode_THT:D_SOD-323', label: 'SOD-323' },
  { value: 'Diode_SMD:D_SOD-323F', label: 'SOD-323F' },
]

// Rotation options
const rotationOptions = [
  { value: 0, label: '0°' },
  { value: 90, label: '90°' },
  { value: 180, label: '180°' },
  { value: 270, label: '270°' },
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
    <!-- Switch Configuration Section -->
    <div class="settings-section">
      <div class="section-title">Switch Configuration</div>

      <!-- Switch Footprint -->
      <div class="mb-2">
        <label for="switchFootprint" class="form-label form-label-sm">Footprint</label>
        <select
          id="switchFootprint"
          v-model="settings.switchFootprint"
          class="form-select form-select-sm"
          aria-label="Select switch footprint type"
        >
          <option
            v-for="option in switchFootprintOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </div>

      <!-- Switch Rotation -->
      <div class="mb-2">
        <label for="switchRotation" class="form-label form-label-sm">Rotation</label>
        <select
          id="switchRotation"
          v-model.number="settings.switchRotation"
          class="form-select form-select-sm"
          aria-label="Select switch rotation angle"
        >
          <option v-for="option in rotationOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- Diode Configuration Section -->
    <div class="settings-section">
      <div class="section-title">Diode Configuration</div>

      <!-- Diode Footprint -->
      <div class="mb-2">
        <label for="diodeFootprint" class="form-label form-label-sm">Footprint</label>
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

      <!-- Diode Position X & Y (side-by-side with CustomNumberInput) -->
      <div class="row g-2 mb-2">
        <div class="col-6">
          <label for="diodePositionX" class="form-label form-label-sm">Position X</label>
          <CustomNumberInput
            id="diodePositionX"
            v-model="settings.diodePositionX"
            :step="0.1"
            size="default"
            title="Diode horizontal offset in millimeters"
          >
            <template #suffix>mm</template>
          </CustomNumberInput>
        </div>
        <div class="col-6">
          <label for="diodePositionY" class="form-label form-label-sm">Position Y</label>
          <CustomNumberInput
            id="diodePositionY"
            v-model="settings.diodePositionY"
            :step="0.1"
            size="default"
            title="Diode vertical offset in millimeters"
          >
            <template #suffix>mm</template>
          </CustomNumberInput>
        </div>
      </div>

      <!-- Diode Rotation -->
      <div class="mb-2">
        <label for="diodeRotation" class="form-label form-label-sm">Rotation</label>
        <select
          id="diodeRotation"
          v-model.number="settings.diodeRotation"
          class="form-select form-select-sm"
          aria-label="Select diode rotation angle"
        >
          <option v-for="option in rotationOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- Others Section -->
    <div class="settings-section">
      <div class="section-title">Others</div>

      <!-- Routing -->
      <div class="mb-2">
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

.settings-section {
  padding-top: 0;
  padding-bottom: 0.5rem;
}

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--bs-emphasis-color);
}

/* Ensure consistent spacing */
.mb-2:last-child {
  margin-bottom: 0 !important;
}
</style>
