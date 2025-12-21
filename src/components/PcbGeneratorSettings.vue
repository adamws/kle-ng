<script setup lang="ts">
import { computed } from 'vue'
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'
import { storeToRefs } from 'pinia'

const pcbStore = usePcbGeneratorStore()
const { settings } = storeToRefs(pcbStore)

// Validation constants
const KEY_DISTANCE_MIN = 10
const KEY_DISTANCE_MAX = 30

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

// Validation computed properties
const isKeyDistanceXValid = computed(() => {
  const val = settings.value.keyDistanceX
  return (
    typeof val === 'number' && !isNaN(val) && val >= KEY_DISTANCE_MIN && val <= KEY_DISTANCE_MAX
  )
})

const isKeyDistanceYValid = computed(() => {
  const val = settings.value.keyDistanceY
  return (
    typeof val === 'number' && !isNaN(val) && val >= KEY_DISTANCE_MIN && val <= KEY_DISTANCE_MAX
  )
})

const keyDistanceXError = computed(() => {
  if (!isKeyDistanceXValid.value) {
    return `Must be between ${KEY_DISTANCE_MIN} and ${KEY_DISTANCE_MAX} mm`
  }
  return null
})

const keyDistanceYError = computed(() => {
  if (!isKeyDistanceYValid.value) {
    return `Must be between ${KEY_DISTANCE_MIN} and ${KEY_DISTANCE_MAX} mm`
  }
  return null
})
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

    <!-- Key Distance -->
    <div class="mb-3">
      <label class="form-label form-label-sm">
        Key Distance (mm)
        <i
          class="bi bi-question-circle ms-1"
          title="Distance between key centers in millimeters. Default is 19.05mm (0.75 inches)"
        ></i>
      </label>
      <div class="row g-2">
        <div class="col">
          <input
            id="keyDistanceX"
            v-model.number="settings.keyDistanceX"
            type="number"
            class="form-control form-control-sm"
            :class="{ 'is-invalid': !isKeyDistanceXValid }"
            placeholder="X"
            min="10"
            max="30"
            step="0.01"
            aria-label="Key distance X"
            aria-describedby="keyDistanceXError"
          />
          <div v-if="keyDistanceXError" id="keyDistanceXError" class="invalid-feedback">
            {{ keyDistanceXError }}
          </div>
        </div>
        <div class="col">
          <input
            id="keyDistanceY"
            v-model.number="settings.keyDistanceY"
            type="number"
            class="form-control form-control-sm"
            :class="{ 'is-invalid': !isKeyDistanceYValid }"
            placeholder="Y"
            min="10"
            max="30"
            step="0.01"
            aria-label="Key distance Y"
            aria-describedby="keyDistanceYError"
          />
          <div v-if="keyDistanceYError" id="keyDistanceYError" class="invalid-feedback">
            {{ keyDistanceYError }}
          </div>
        </div>
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

.bi-question-circle {
  cursor: help;
  color: var(--bs-secondary);
  font-size: 0.875rem;
}
</style>
