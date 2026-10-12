<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'
import { usePcbTracksStore } from '@/stores/pcbTracks'
import { storeToRefs } from 'pinia'
import CustomNumberInput from './CustomNumberInput.vue'
import {
  ROUTING_MODES,
  routingMode,
  routingModeOption,
  type RoutingMode,
} from '@/utils/pcb/routing-mode'

const pcbStore = usePcbGeneratorStore()
const { settings } = storeToRefs(pcbStore)
const tracks = usePcbTracksStore()

// Stabilizer footprint options
const stabilizerFootprintOptions = [
  { value: '', label: 'None' },
  { value: 'Mounting_Keyboard_Stabilizer:Stabilizer_Cherry_MX_{:.2f}u', label: 'Cherry MX' },
]

// Switch footprint options
const switchFootprintOptions = [
  { value: 'Switch_Keyboard_Cherry_MX:SW_Cherry_MX_PCB_{:.2f}u', label: 'Cherry MX' },
  { value: 'Switch_Keyboard_Alps_Matias:SW_Alps_Matias_{:.2f}u', label: 'Alps/Matias' },
  {
    value: 'Switch_Keyboard_Hybrid:SW_Hybrid_Cherry_MX_Alps_{:.2f}u',
    label: 'Cherry MX/Alps Hybrid',
  },
  {
    value: 'Switch_Keyboard_Kailh:SW_Kailh_Choc_V1_{:.2f}u',
    label: 'Kailh Choc V1',
  },
  {
    value: 'Switch_Keyboard_Kailh:SW_Kailh_Choc_V2_{:.2f}u',
    label: 'Kailh Choc V2',
  },
  {
    value: 'Switch_Keyboard_Kailh:SW_Kailh_Choc_V1V2_{:.2f}u',
    label: 'Kailh Choc V1/V2',
  },
  { value: 'Switch_Keyboard_Kailh:SW_Kailh_Choc_Mini_{:.2f}u', label: 'Kailh Choc Mini' },
  {
    value: 'Switch_Keyboard_Hotswap_Kailh:SW_Hotswap_Kailh_Choc_V1_{:.2f}u',
    label: 'Hotswap Kailh Choc V1',
  },
  {
    value: 'Switch_Keyboard_Hotswap_Kailh:SW_Hotswap_Kailh_Choc_V2_{:.2f}u',
    label: 'Hotswap Kailh Choc V2',
  },
  {
    value: 'Switch_Keyboard_Hotswap_Kailh:SW_Hotswap_Kailh_Choc_V1V2_{:.2f}u',
    label: 'Hotswap Kailh Choc V1/V2',
  },
  { value: 'Switch_Keyboard_Hotswap_Kailh:SW_Hotswap_Kailh_MX_{:.2f}u', label: 'Hotswap Kailh MX' },
]

// Diode footprint options: SMD, and horizontal through-hole packages by lead
// spacing (KiCad's Diode_THT names; the backend resolves any `lib:name`).
const THT_PACKAGES = [
  { name: 'DO-34_SOD68', label: 'DO-34' },
  { name: 'DO-35_SOD27', label: 'DO-35 (1N4148)' },
  { name: 'DO-41_SOD81', label: 'DO-41 (1N400x)' },
]
const THT_SPACINGS = ['7.62', '10.16', '12.70']

const diodeFootprintGroups = [
  {
    label: 'SMD',
    options: [
      { value: 'Diode_SMD:D_SOD-123', label: 'SOD-123' },
      { value: 'Diode_SMD:D_SOD-123F', label: 'SOD-123F' },
      { value: 'Diode_SMD:D_SOD-323', label: 'SOD-323' },
      { value: 'Diode_SMD:D_SOD-323F', label: 'SOD-323F' },
    ],
  },
  {
    // the position is pin 1 (the cathode), the footprint origin
    label: 'Through-hole, lead spacing (position = pin 1)',
    options: THT_PACKAGES.flatMap((pkg) =>
      THT_SPACINGS.map((spacing) => ({
        value: `Diode_THT:D_${pkg.name}_P${spacing}mm_Horizontal`,
        label: `${pkg.label}, ${spacing} mm`,
      })),
    ),
  },
]

// Side options
const sideOptions = [
  { value: 'FRONT', label: 'Front' },
  { value: 'BACK', label: 'Back' },
]

// Rotation options
const rotationOptions = [
  { value: 0, label: '0°' },
  { value: 90, label: '90°' },
  { value: 180, label: '180°' },
  { value: 270, label: '270°' },
]

// Routing: the backend's routing value, with switch-diode tracks from its
// router (automatic) or drawn in the footprint preview (preset)
const currentRoutingMode = computed(() => routingMode(settings.value))
const presetUnavailable = computed(() => settings.value.switchSide !== 'FRONT')
const drawnItemCount = computed(() => settings.value.trackPreset?.items.length ?? 0)
/** A mode change that would remove drawn tracks, waiting for confirmation. */
const pendingRoutingMode = ref<RoutingMode | null>(null)

function onRoutingChange(event: Event) {
  const select = event.target as HTMLSelectElement
  const mode = select.value as RoutingMode
  if (!routingModeOption(mode).preset && drawnItemCount.value > 0) {
    // the select shows the current mode until confirmed
    select.value = currentRoutingMode.value
    pendingRoutingMode.value = mode
    return
  }
  tracks.setRoutingMode(mode)
}

// focus the dialog so Esc and Enter work right away
const cancelButton = ref<HTMLButtonElement | null>(null)
watch(pendingRoutingMode, (mode) => {
  if (mode) nextTick(() => cancelButton.value?.focus())
})

function confirmRoutingMode() {
  if (pendingRoutingMode.value) tracks.setRoutingMode(pendingRoutingMode.value)
  pendingRoutingMode.value = null
}
</script>

<template>
  <div class="pcb-generator-settings">
    <!-- Switch Configuration Section -->
    <div class="settings-section">
      <div class="section-title">Switch Configuration</div>

      <!-- Switch + Stabilizer Footprints -->
      <div class="row g-2 mb-2">
        <div class="col-6">
          <label for="switchFootprint" class="form-label form-label-sm">Switch Footprint</label>
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
        <div class="col-6">
          <label for="stabilizerFootprint" class="form-label form-label-sm"
            >Stabilizer Footprint</label
          >
          <select
            id="stabilizerFootprint"
            v-model="settings.stabilizerFootprint"
            class="form-select form-select-sm"
            aria-label="Select stabilizer footprint type"
          >
            <option
              v-for="option in stabilizerFootprintOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </div>
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
          <optgroup v-for="group in diodeFootprintGroups" :key="group.label" :label="group.label">
            <option v-for="option in group.options" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </optgroup>
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
            :value-on-clear="0"
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
            :value-on-clear="0"
            size="default"
            title="Diode vertical offset in millimeters"
          >
            <template #suffix>mm</template>
          </CustomNumberInput>
        </div>
      </div>

      <!-- Diode Side + Rotation -->
      <div class="row g-2 mb-2">
        <div class="col-6">
          <label for="diodeSide" class="form-label form-label-sm">Side</label>
          <select
            id="diodeSide"
            v-model="settings.diodeSide"
            class="form-select form-select-sm"
            aria-label="Select diode board side"
          >
            <option v-for="option in sideOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
        <div class="col-6">
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
    </div>

    <!-- Others Section -->
    <div class="settings-section">
      <div class="section-title">Others</div>

      <!-- Routing -->
      <div class="mb-2">
        <label for="routing" class="form-label form-label-sm">Routing</label>
        <select
          id="routing"
          :value="currentRoutingMode"
          class="form-select form-select-sm"
          aria-label="Select routing mode"
          data-testid="pcb-routing-select"
          @change="onRoutingChange"
        >
          <option
            v-for="option in ROUTING_MODES"
            :key="option.value"
            :value="option.value"
            :disabled="option.preset && presetUnavailable && option.value !== currentRoutingMode"
          >
            {{ option.label }}
          </option>
        </select>
        <div class="form-text">
          <template v-if="presetUnavailable"> Preset tracks need a front-side switch. </template>
          <template v-else-if="routingModeOption(currentRoutingMode).preset">
            Draw the switch-diode tracks in the preview, they are copied to every key.
          </template>
          <template v-else-if="settings.routing !== 'Disabled'">
            The generator routes switch-diode tracks itself; a (preset) option lets you draw them.
          </template>
          <template v-else>No tracks are routed.</template>
        </div>
      </div>
    </div>

    <!-- Leaving a preset mode removes the drawn tracks -->
    <template v-if="pendingRoutingMode">
      <div
        class="modal fade show d-block"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        data-testid="pcb-routing-confirm"
        @keydown.esc="pendingRoutingMode = null"
      >
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Remove drawn tracks?</h5>
              <button
                type="button"
                class="btn-close"
                aria-label="Close"
                @click="pendingRoutingMode = null"
              ></button>
            </div>
            <div class="modal-body">
              <p class="mb-0">
                <strong>{{ routingModeOption(pendingRoutingMode).label }}</strong> doesn't use drawn
                tracks. Switching removes the {{ drawnItemCount }} drawn
                {{ drawnItemCount === 1 ? 'item' : 'items' }}.
              </p>
            </div>
            <div class="modal-footer">
              <button
                type="button"
                ref="cancelButton"
                class="btn btn-secondary"
                data-testid="pcb-routing-confirm-cancel"
                @click="pendingRoutingMode = null"
              >
                Cancel
              </button>
              <button
                type="button"
                class="btn btn-danger"
                data-testid="pcb-routing-confirm-ok"
                @click="confirmRoutingMode"
              >
                Remove tracks
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop fade show"></div>
    </template>
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
