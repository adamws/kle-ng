<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'
import { useKeyboardStore } from '@/stores/keyboard'
import { storeToRefs } from 'pinia'
import { ApiError } from '@/utils/pcbApi'

const pcbStore = usePcbGeneratorStore()
const { settings, taskStatus, isTaskActive, isBackendAvailable, workerStatusError } =
  storeToRefs(pcbStore)

const keyboardStore = useKeyboardStore()
const {
  isViaAnnotated,
  hasInvalidMatrixDuplicates,
  matrixDuplicateValidation,
  hasMalformedLayoutOptionLabels,
  malformedLayoutOptionKeys,
} = storeToRefs(keyboardStore)

const errorMessage = ref<string | null>(null)
const isSubmitting = ref(false)

// Track presets are drawn for a front-side switch, the backend can't flip
// them, so a preset with back-side switches is rejected up front.
const hasTrackPreset = computed(() => (settings.value.trackPreset?.items.length ?? 0) > 0)
const isTrackPresetOnBackSwitch = computed(
  () => hasTrackPreset.value && settings.value.switchSide === 'BACK',
)
const isTrackPresetIgnored = computed(
  () => hasTrackPreset.value && settings.value.routing === 'Disabled',
)

// Button should show when no task is active (taskStatus is null)
const showGenerateButton = computed(() => !taskStatus.value)

const isGenerateDisabled = computed(
  () =>
    isSubmitting.value ||
    isTaskActive.value ||
    !isBackendAvailable.value ||
    !isViaAnnotated.value ||
    hasInvalidMatrixDuplicates.value ||
    hasMalformedLayoutOptionLabels.value ||
    isTrackPresetOnBackSwitch.value,
)

const buttonTooltip = computed(() => {
  if (!isViaAnnotated.value) {
    return 'Layout requires VIA annotations to generate PCB'
  }
  if (hasInvalidMatrixDuplicates.value) {
    return 'Layout has duplicate matrix positions without option,choice labels'
  }
  if (hasMalformedLayoutOptionLabels.value) {
    return 'Layout has invalid layout-option labels'
  }
  if (isTrackPresetOnBackSwitch.value) {
    return 'Track presets support only front-side switches'
  }
  if (!isBackendAvailable.value) {
    if (workerStatusError.value) {
      return workerStatusError.value
    }
    return 'Backend is not available or all workers are busy'
  }
  return 'Generate PCB from current layout'
})

// Get list of duplicate positions for display
const duplicatePositions = computed(() => {
  if (!hasInvalidMatrixDuplicates.value) return []
  // Defensive check in case validation result is not yet available
  const validation = matrixDuplicateValidation.value
  if (!validation?.duplicatesWithoutOption) return []
  return validation.duplicatesWithoutOption.map((d) => d.position)
})

// Summary of keys with malformed layout-option labels, truncated so the
// warning stays readable when many keys are affected.
const MAX_MALFORMED_LABELS_SHOWN = 8
const malformedLayoutOptionSummary = computed(() => {
  const entries = malformedLayoutOptionKeys.value
  const shown = entries
    .slice(0, MAX_MALFORMED_LABELS_SHOWN)
    .map((e) => `${e.position} ("${e.rawLabel}")`)
    .join(', ')
  const remaining = entries.length - MAX_MALFORMED_LABELS_SHOWN
  return remaining > 0 ? `${shown}, ...and ${remaining} more` : shown
})

async function handleGeneratePcb() {
  errorMessage.value = null
  isSubmitting.value = true

  try {
    await pcbStore.startTask()
  } catch (error) {
    if (error instanceof ApiError) {
      errorMessage.value = error.userMessage
    } else {
      errorMessage.value = 'An unexpected error occurred.'
    }
  } finally {
    isSubmitting.value = false
  }
}

function handleNewTask() {
  errorMessage.value = null
  pcbStore.resetTask()
}
</script>

<template>
  <div class="pcb-generator-controls">
    <!-- Error Alert -->
    <div v-if="errorMessage" class="alert alert-danger alert-dismissible py-2 mb-2" role="alert">
      <small>{{ errorMessage }}</small>
      <button
        type="button"
        class="btn-close btn-close-sm"
        aria-label="Close"
        @click="errorMessage = null"
      ></button>
    </div>

    <!-- Control Buttons -->
    <div class="d-grid gap-2">
      <button
        v-if="showGenerateButton"
        type="button"
        class="btn btn-primary btn-sm"
        :disabled="isGenerateDisabled"
        @click="handleGeneratePcb"
        :title="buttonTooltip"
      >
        <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-2" role="status">
          <span class="visually-hidden">Loading...</span>
        </span>
        Generate PCB
      </button>

      <button
        v-if="!showGenerateButton"
        type="button"
        class="btn btn-secondary btn-sm"
        :disabled="isTaskActive"
        @click="handleNewTask"
      >
        New Task
      </button>
    </div>

    <!-- Annotation Required Message -->
    <div
      v-if="!isViaAnnotated && showGenerateButton"
      class="alert alert-warning py-2 mt-2 mb-0"
      role="alert"
    >
      <small>
        Layout requires VIA annotations. Use
        <strong>Tools &rarr; Add Switch Matrix Coordinates</strong> to annotate.
      </small>
    </div>

    <!-- Invalid Duplicates Warning -->
    <div
      v-if="isViaAnnotated && hasInvalidMatrixDuplicates && showGenerateButton"
      class="alert alert-warning py-2 mt-2 mb-0"
      role="alert"
    >
      <small>
        <strong>Duplicate matrix positions detected:</strong> {{ duplicatePositions.join(', ') }}
        <br />
        Per VIA spec, keys sharing a matrix position must have
        <code>option,choice</code> labels in the bottom-right position. Use
        <strong>Tools &rarr; Add Switch Matrix Coordinates</strong> to fix.
      </small>
    </div>

    <!-- Malformed Layout-Option Label Warning -->
    <div
      v-if="isViaAnnotated && hasMalformedLayoutOptionLabels && showGenerateButton"
      class="alert alert-warning py-2 mt-2 mb-0"
      role="alert"
    >
      <small>
        <strong>Invalid layout-option labels detected:</strong>
        {{ malformedLayoutOptionSummary }}
        <br />
        Edit the key labels so the legend is in the front-left position and the bottom-right
        position is empty or a valid <code>option,choice</code> value.
      </small>
    </div>

    <!-- Track Preset Messages -->
    <div
      v-if="isTrackPresetOnBackSwitch && showGenerateButton"
      class="alert alert-danger py-2 mt-2 mb-0"
      role="alert"
      data-testid="pcb-track-preset-back-switch"
    >
      <small>
        <strong>Track presets support only front-side switches.</strong>
        Set the switch side to front, or remove the <code>tracks</code> group in the JSON settings.
      </small>
    </div>
    <div
      v-if="isTrackPresetIgnored && showGenerateButton"
      class="alert alert-info py-2 mt-2 mb-0"
      role="status"
      data-testid="pcb-track-preset-ignored"
    >
      <small>Routing is disabled, the track preset is ignored.</small>
    </div>
  </div>
</template>

<style scoped>
.pcb-generator-controls {
  padding: 0;
}

.btn-primary:disabled {
  cursor: not-allowed !important;
  pointer-events: auto !important;
}
</style>
