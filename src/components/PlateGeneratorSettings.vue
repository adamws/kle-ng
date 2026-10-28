<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePlateGeneratorStore } from '@/stores/plateGenerator'
import { storeToRefs } from 'pinia'
import {
  getCutoutOptions,
  getStabilizerOptions,
  getCutoutGenerator,
  validateFilletRadius,
  validateStabilizerFilletRadius,
  getMaxStabilizerFilletRadius,
  validateCustomCutoutDimension,
} from '@/utils/plate/cutout-generator'
import CustomNumberInput from './CustomNumberInput.vue'
import RotaryEncoderHelpModal from './RotaryEncoderHelpModal.vue'
import BiQuestionCircle from 'bootstrap-icons/icons/question-circle.svg'

const plateStore = usePlateGeneratorStore()
const { settings } = storeToRefs(plateStore)

// Rotary encoder mount help modal
const isEncoderHelpVisible = ref(false)
const showEncoderHelp = () => {
  isEncoderHelpVisible.value = true
}
const closeEncoderHelp = () => {
  isEncoderHelpVisible.value = false
}

// Get cutout options for dropdown
const cutoutOptions = getCutoutOptions()

// Get stabilizer options for dropdown
const stabilizerOptions = getStabilizerOptions()

// Fillet radius validation (switch)
const filletError = computed(() =>
  validateFilletRadius(
    settings.value.cutoutType,
    settings.value.filletRadius,
    settings.value.customCutoutWidth,
    settings.value.customCutoutHeight,
  ),
)

const maxFilletRadius = computed(
  () =>
    getCutoutGenerator(
      settings.value.cutoutType,
      settings.value.customCutoutWidth,
      settings.value.customCutoutHeight,
    ).maxFilletRadius,
)

const filletInputClass = computed(() =>
  filletError.value ? 'form-control form-control-sm is-invalid' : 'form-control form-control-sm',
)

// Fillet radius validation (stabilizer)
const stabilizerFilletError = computed(() =>
  validateStabilizerFilletRadius(
    settings.value.stabilizerType,
    settings.value.stabilizerFilletRadius,
  ),
)

const maxStabilizerFilletRadius = computed(() =>
  getMaxStabilizerFilletRadius(settings.value.stabilizerType),
)

const stabilizerFilletInputClass = computed(() =>
  stabilizerFilletError.value
    ? 'form-control form-control-sm is-invalid'
    : 'form-control form-control-sm',
)

// Custom cutout dimension validation
const customWidthError = computed(() =>
  settings.value.cutoutType === 'custom-rectangle'
    ? validateCustomCutoutDimension(settings.value.customCutoutWidth, 'width')
    : null,
)

const customHeightError = computed(() =>
  settings.value.cutoutType === 'custom-rectangle'
    ? validateCustomCutoutDimension(settings.value.customCutoutHeight, 'height')
    : null,
)

const customWidthInputClass = computed(() =>
  customWidthError.value
    ? 'form-control form-control-sm is-invalid'
    : 'form-control form-control-sm',
)

const customHeightInputClass = computed(() =>
  customHeightError.value
    ? 'form-control form-control-sm is-invalid'
    : 'form-control form-control-sm',
)
</script>

<template>
  <div class="plate-generator-settings">
    <!-- Cutout Configuration Section -->
    <div class="settings-section">
      <!-- Cutout Type -->
      <div class="mb-2">
        <label for="cutoutType" class="form-label form-label-sm">Switch Cutout Type</label>
        <select
          id="cutoutType"
          v-model="settings.cutoutType"
          class="form-select form-select-sm"
          aria-label="Select switch cutout type"
        >
          <option
            v-for="option in cutoutOptions"
            :key="option.value"
            :value="option.value"
            :title="option.description"
          >
            {{ option.label }}
          </option>
        </select>
      </div>

      <!-- Custom Cutout Dimensions -->
      <div v-if="settings.cutoutType === 'custom-rectangle'" class="mb-2">
        <div class="d-flex gap-2">
          <div class="flex-grow-1">
            <label for="customCutoutWidth" class="form-label form-label-sm fillet-sub-label"
              >Width</label
            >
            <CustomNumberInput
              id="customCutoutWidth"
              v-model="settings.customCutoutWidth"
              :step="0.01"
              :min="0.01"
              :max="50"
              :value-on-clear="14"
              :class="customWidthInputClass"
              size="default"
              title="Custom cutout width in millimeters"
            >
              <template #suffix>mm</template>
            </CustomNumberInput>
            <div class="field-error">
              <span
                class="field-error-text"
                :class="{ 'is-visible': customWidthError }"
                :title="customWidthError || undefined"
                >{{ customWidthError }}</span
              >
            </div>
          </div>
          <div class="flex-grow-1">
            <label for="customCutoutHeight" class="form-label form-label-sm fillet-sub-label"
              >Height</label
            >
            <CustomNumberInput
              id="customCutoutHeight"
              v-model="settings.customCutoutHeight"
              :step="0.01"
              :min="0.01"
              :max="50"
              :value-on-clear="14"
              :class="customHeightInputClass"
              size="default"
              title="Custom cutout height in millimeters"
            >
              <template #suffix>mm</template>
            </CustomNumberInput>
            <div class="field-error">
              <span
                class="field-error-text"
                :class="{ 'is-visible': customHeightError }"
                :title="customHeightError || undefined"
                >{{ customHeightError }}</span
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Stabilizer Type -->
      <div class="mb-2">
        <label for="stabilizerType" class="form-label form-label-sm">Stabilizer Cutout Type</label>
        <select
          id="stabilizerType"
          v-model="settings.stabilizerType"
          class="form-select form-select-sm"
          aria-label="Select stabilizer cutout type"
        >
          <option
            v-for="option in stabilizerOptions"
            :key="option.value"
            :value="option.value"
            :title="option.description"
          >
            {{ option.label }}
          </option>
        </select>
      </div>

      <!-- Rotary Encoder Mount -->
      <div class="mb-2">
        <div class="d-flex align-items-center gap-2">
          <div class="form-check mb-0">
            <input
              id="rotaryEncoderHandwired"
              v-model="settings.rotaryEncoderHandwired"
              class="form-check-input"
              type="checkbox"
            />
            <label class="form-check-label form-label-sm" for="rotaryEncoderHandwired"
              >Handwired rotary encoder mount</label
            >
          </div>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary help-btn"
            title="Rotary encoder mount help"
            @click="showEncoderHelp"
          >
            <BiQuestionCircle />
          </button>
        </div>
      </div>

      <!-- Fillet Radius -->
      <div class="mb-2">
        <label class="form-label form-label-sm">Fillet Radius</label>
        <div class="d-flex gap-2">
          <div class="flex-grow-1">
            <label for="filletRadius" class="form-label form-label-sm fillet-sub-label"
              >Switch</label
            >
            <CustomNumberInput
              id="filletRadius"
              v-model="settings.filletRadius"
              :step="0.01"
              :min="0"
              :max="maxFilletRadius"
              :value-on-clear="0"
              :class="filletInputClass"
              size="default"
              title="Corner rounding radius for switch cutouts in millimeters"
            >
              <template #suffix>mm</template>
            </CustomNumberInput>
            <div class="field-error">
              <span
                class="field-error-text"
                :class="{ 'is-visible': filletError }"
                :title="filletError || undefined"
                >{{ filletError }}</span
              >
            </div>
          </div>
          <div class="flex-grow-1">
            <label for="stabilizerFilletRadius" class="form-label form-label-sm fillet-sub-label"
              >Stabilizer</label
            >
            <CustomNumberInput
              id="stabilizerFilletRadius"
              v-model="settings.stabilizerFilletRadius"
              :step="0.01"
              :min="0"
              :max="maxStabilizerFilletRadius"
              :value-on-clear="0"
              :class="stabilizerFilletInputClass"
              size="default"
              title="Corner rounding radius for stabilizer cutouts in millimeters"
            >
              <template #suffix>mm</template>
            </CustomNumberInput>
            <div class="field-error">
              <span
                class="field-error-text"
                :class="{ 'is-visible': stabilizerFilletError }"
                :title="stabilizerFilletError || undefined"
                >{{ stabilizerFilletError }}</span
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Size Adjustment -->
      <div class="mb-2">
        <label for="sizeAdjust" class="form-label form-label-sm">Size Adjustment (Kerf)</label>
        <CustomNumberInput
          id="sizeAdjust"
          v-model="settings.sizeAdjust"
          :step="0.001"
          :min="-0.5"
          :max="0.5"
          :value-on-clear="0"
          class="form-control form-control-sm"
          size="default"
          title="Cutout size adjustment in millimeters"
        >
          <template #suffix>mm</template>
        </CustomNumberInput>
        <div class="form-text small">Positive = shrink, negative = expand</div>
      </div>

      <!-- Merge Cutouts -->
      <div class="mb-2">
        <div class="form-check">
          <input
            id="mergeCutouts"
            v-model="settings.mergeCutouts"
            class="form-check-input"
            type="checkbox"
          />
          <label class="form-check-label form-label-sm" for="mergeCutouts">Merge Cutouts</label>
        </div>
        <div class="form-text small">Combine overlapping cutouts into simplified paths</div>
      </div>
    </div>

    <RotaryEncoderHelpModal :is-visible="isEncoderHelpVisible" @close="closeEncoderHelp" />
  </div>
</template>

<style scoped>
.plate-generator-settings {
  padding: 0;
}

.form-label-sm {
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.settings-section {
  padding-top: 0;
  padding-bottom: 0;
}

.fillet-sub-label {
  font-weight: 400;
  font-size: 0.8rem;
  margin-bottom: 0.1rem;
}

/* Two-column rows (Width/Height, Switch/Stabilizer fillet): CustomNumberInput
   grows its input's padding-right when invalid (to make room for the
   validation icon), which otherwise inflates that column's flex-basis and
   steals width from its sibling. min-width: 0 lets the column stay pinned to
   its equal flex-grow share instead of expanding to fit that content. */
.d-flex.gap-2 > .flex-grow-1 {
  min-width: 0;
  flex-basis: 0;
}

/* Reserve space for the error line so it doesn't shift layout when it
   appears/disappears. The message itself is taken out of normal flow
   (position: absolute) so its unwrapped text never contributes to this
   column's intrinsic width and forces the row/panel to widen. */
.field-error {
  position: relative;
  min-height: 1.2em;
  margin-top: 0.25rem;
}

.field-error-text {
  position: absolute;
  inset: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 0.875em;
  color: var(--bs-form-invalid-color, #dc3545);
  visibility: hidden;
}

.field-error-text.is-visible {
  visibility: visible;
}

.help-btn {
  font-size: 0.875rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  padding: 4px;
}

.form-check-label.form-label-sm {
  margin-bottom: 0;
}

/* Ensure consistent spacing */
.mb-2:last-child {
  margin-bottom: 0 !important;
}
</style>
