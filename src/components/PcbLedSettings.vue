<script setup lang="ts">
import { computed } from 'vue'
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'
import { storeToRefs } from 'pinia'
import CustomNumberInput from './CustomNumberInput.vue'

const pcbStore = usePcbGeneratorStore()
const { settings } = storeToRefs(pcbStore)

// LED footprint options — only one for now, extended later.
const ledFootprintOptions = [
  {
    value: 'LED_SMD:LED_SK6812MINI-E_3.2x2.8mm_P1.5mm_ReverseMount',
    label: 'SK6812MINI-E Reverse Mount',
  },
]

// LED decoupling capacitor footprint options — only one for now, extended later.
const capacitorFootprintOptions = [
  { value: 'Capacitor_SMD:C_01005_0402Metric', label: 'C 01005 (0402 metric)' },
  { value: 'Capacitor_SMD:C_0201_0603Metric', label: 'C 0201 (0603 metric)' },
  { value: 'Capacitor_SMD:C_0402_1005Metric', label: 'C 0402 (1005 metric)' },
  { value: 'Capacitor_SMD:C_0603_1608Metric', label: 'C 0603 (1608 metric)' },
  { value: 'Capacitor_SMD:C_0805_2012Metric', label: 'C 0805 (2012 metric)' },
  { value: 'Capacitor_SMD:C_1206_3216Metric', label: 'C 1206 (3216 metric)' },
]

// Rotation options (shared convention with switch/diode)
const rotationOptions = [
  { value: 0, label: '0°' },
  { value: 90, label: '90°' },
  { value: 180, label: '180°' },
  { value: 270, label: '270°' },
]

// Side options
const sideOptions = [
  { value: 'FRONT', label: 'Front' },
  { value: 'BACK', label: 'Back' },
]

// Decoupling is expressed to the backend as `skipLedDecoupling`; the UI checkbox
// is the friendlier positive form ("add decoupling capacitors").
const addDecoupling = computed({
  get: () => !settings.value.skipLedDecoupling,
  set: (value: boolean) => {
    settings.value.skipLedDecoupling = !value
  },
})

// Fields stay visible but are disabled when not applicable (Plate Generator approach).
const ledDisabled = computed(() => !settings.value.createLedSchFile)
const capacitorDisabled = computed(
  () => !settings.value.createLedSchFile || settings.value.skipLedDecoupling,
)
</script>

<template>
  <div class="pcb-led-settings">
    <!-- Master enable -->
    <div class="settings-section">
      <div class="row g-2">
        <div class="col-6">
          <div class="form-check">
            <input
              id="createLedSchFile"
              v-model="settings.createLedSchFile"
              class="form-check-input"
              type="checkbox"
              data-testid="led-enable"
            />
            <label class="form-check-label form-label-sm" for="createLedSchFile">
              Add per-key LED
            </label>
          </div>
        </div>
        <div class="col-6">
          <div class="form-check">
            <input
              id="ledDecoupling"
              v-model="addDecoupling"
              class="form-check-input"
              type="checkbox"
              :disabled="ledDisabled"
              data-testid="led-decoupling"
            />
            <label class="form-check-label form-label-sm" for="ledDecoupling">
              Add capacitors
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- LED configuration -->
    <div class="settings-section" :class="{ disabled: ledDisabled }">
      <div class="section-title">LED Configuration</div>

      <!-- Footprint (full width) -->
      <div class="mb-2">
        <label for="ledFootprint" class="form-label form-label-sm">Footprint</label>
        <select
          id="ledFootprint"
          v-model="settings.ledFootprint"
          class="form-select form-select-sm"
          :disabled="ledDisabled"
          aria-label="Select LED footprint type"
        >
          <option v-for="option in ledFootprintOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>

      <!-- Position X & Y -->
      <div class="row g-2 mb-2">
        <div class="col-6">
          <label for="ledPositionX" class="form-label form-label-sm">Position X</label>
          <CustomNumberInput
            id="ledPositionX"
            v-model="settings.ledPositionX"
            :step="0.1"
            :disabled="ledDisabled"
            size="default"
            title="LED horizontal offset from key center in millimeters"
          >
            <template #suffix>mm</template>
          </CustomNumberInput>
        </div>
        <div class="col-6">
          <label for="ledPositionY" class="form-label form-label-sm">Position Y</label>
          <CustomNumberInput
            id="ledPositionY"
            v-model="settings.ledPositionY"
            :step="0.1"
            :disabled="ledDisabled"
            size="default"
            title="LED vertical offset from key center in millimeters"
          >
            <template #suffix>mm</template>
          </CustomNumberInput>
        </div>
      </div>

      <!-- Side + Rotation -->
      <div class="row g-2 mb-2">
        <div class="col-6">
          <label for="ledSide" class="form-label form-label-sm">Side</label>
          <select
            id="ledSide"
            v-model="settings.ledSide"
            class="form-select form-select-sm"
            :disabled="ledDisabled"
            aria-label="Select LED board side"
          >
            <option v-for="option in sideOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
        <div class="col-6">
          <label for="ledRotation" class="form-label form-label-sm">Rotation</label>
          <select
            id="ledRotation"
            v-model.number="settings.ledRotation"
            class="form-select form-select-sm"
            :disabled="ledDisabled"
            aria-label="Select LED rotation angle"
          >
            <option v-for="option in rotationOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Decoupling capacitor -->
    <div class="settings-section">
      <div class="mt-1" :class="{ disabled: capacitorDisabled }">
        <div class="section-title">Decoupling Capacitor Configuration</div>
        <!-- Footprint (full width) -->
        <div class="mb-2">
          <label for="ledCapacitorFootprint" class="form-label form-label-sm">Footprint</label>
          <select
            id="ledCapacitorFootprint"
            v-model="settings.ledCapacitorFootprint"
            class="form-select form-select-sm"
            :disabled="capacitorDisabled"
            aria-label="Select LED capacitor footprint type"
          >
            <option
              v-for="option in capacitorFootprintOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </div>

        <!-- Position X & Y -->
        <div class="row g-2 mb-2">
          <div class="col-6">
            <label for="ledCapacitorPositionX" class="form-label form-label-sm">Position X</label>
            <CustomNumberInput
              id="ledCapacitorPositionX"
              v-model="settings.ledCapacitorPositionX"
              :step="0.1"
              :disabled="capacitorDisabled"
              size="default"
              title="Capacitor horizontal offset from key center in millimeters"
            >
              <template #suffix>mm</template>
            </CustomNumberInput>
          </div>
          <div class="col-6">
            <label for="ledCapacitorPositionY" class="form-label form-label-sm">Position Y</label>
            <CustomNumberInput
              id="ledCapacitorPositionY"
              v-model="settings.ledCapacitorPositionY"
              :step="0.1"
              :disabled="capacitorDisabled"
              size="default"
              title="Capacitor vertical offset from key center in millimeters"
            >
              <template #suffix>mm</template>
            </CustomNumberInput>
          </div>
        </div>

        <!-- Side + Rotation -->
        <div class="row g-2 mb-2">
          <div class="col-6">
            <label for="ledCapacitorSide" class="form-label form-label-sm">Side</label>
            <select
              id="ledCapacitorSide"
              v-model="settings.ledCapacitorSide"
              class="form-select form-select-sm"
              :disabled="capacitorDisabled"
              aria-label="Select LED capacitor board side"
            >
              <option v-for="option in sideOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
          <div class="col-6">
            <label for="ledCapacitorRotation" class="form-label form-label-sm">Rotation</label>
            <select
              id="ledCapacitorRotation"
              v-model.number="settings.ledCapacitorRotation"
              class="form-select form-select-sm"
              :disabled="capacitorDisabled"
              aria-label="Select LED capacitor rotation angle"
            >
              <option v-for="option in rotationOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pcb-led-settings {
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
  margin-bottom: 0.5rem;
}

/* Dim (but keep visible) sections whose inputs are not applicable */
.settings-section.disabled,
.disabled {
  opacity: 0.6;
}

/* Ensure consistent spacing */
.mb-2:last-child {
  margin-bottom: 0 !important;
}
</style>
