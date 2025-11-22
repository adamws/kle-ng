<template>
  <div class="card-footer canvas-footer">
    <div
      class="d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center justify-content-lg-between gap-2 gap-lg-3"
    >
      <!-- Left side: Keys status -->
      <div
        class="canvas-status d-flex flex-wrap align-items-center gap-1 gap-sm-2 justify-content-center justify-content-lg-start"
      >
        <div class="canvas-focus-indicator d-flex align-items-center gap-1">
          <div
            class="focus-status-dot"
            :class="{ active: canvasFocused }"
            :title="
              canvasFocused
                ? 'Canvas is active (accepts keyboard shortcuts)'
                : 'Canvas is inactive (click to activate)'
            "
          ></div>
          <span class="small">{{ canvasFocused ? 'Active' : 'Inactive' }}</span>
        </div>
        <div class="keys-counter small" data-testid="counter-keys">
          Keys: <span class="fw-semibold">{{ keyboardStore.keys.length }}</span>
        </div>
        <div class="selected-counter small" data-testid="counter-selected">
          Selected: <span class="fw-semibold">{{ keyboardStore.selectedKeys.length }}</span>
        </div>
        <!-- Move Step Control -->
        <div class="move-step-control d-flex align-items-center gap-1">
          <label class="move-step-label small mb-0">Step:</label>
          <CustomNumberInput
            :model-value="keyboardStore.moveStep"
            @change="updateMoveStep"
            :step="0.05"
            :min="0.05"
            :max="5"
            :value-on-clear="0.25"
            :disable-wheel="true"
            size="compact"
          >
            <template #suffix>U</template>
          </CustomNumberInput>
        </div>
        <!-- Lock Rotations Control -->
        <div class="lock-rotations-control d-flex align-items-center gap-1">
          <input
            id="lockRotations"
            type="checkbox"
            :checked="keyboardStore.lockRotations"
            @change="toggleLockRotations"
            class="form-check-input lock-rotations-checkbox"
          />
          <label
            for="lockRotations"
            class="form-check-label small mb-0"
            title="When enabled, rotation origins move with keys to maintain relative offset"
          >
            Lock rotations
          </label>
        </div>
      </div>

      <!-- Right side: Zoom controls and mouse position -->
      <div
        class="d-flex flex-wrap align-items-center gap-1 gap-sm-2 justify-content-center justify-content-lg-end"
      >
        <!-- Zoom Controls -->
        <div class="zoom-control d-flex align-items-center gap-1">
          <label class="zoom-label small mb-0">Zoom:</label>
          <CustomNumberInput
            :model-value="zoomPercent"
            @change="updateZoom"
            :step="10"
            :min="10"
            :max="500"
            :value-on-clear="100"
            :disable-wheel="true"
            size="compact"
          >
            <template #suffix>%</template>
          </CustomNumberInput>
        </div>

        <!-- Mouse position display -->
        <div class="position-indicator">
          <span class="position-label">Mouse:</span>
          <span class="position-values">
            {{ `${formatPosition(mousePosition.x)}, ${formatPosition(mousePosition.y)}` }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useKeyboardStore } from '@/stores/keyboard'
import CustomNumberInput from './CustomNumberInput.vue'

const keyboardStore = useKeyboardStore()

// Refs for component state
const zoom = ref(1)
const minZoom = 0.1
const maxZoom = 5
const mousePosition = ref({ x: 0, y: 0, visible: false })
const canvasFocused = ref(false)

// Computed property to convert zoom to percentage for the input
const zoomPercent = computed(() => Math.round(zoom.value * 100))

// Helper function to request canvas focus
const requestCanvasFocus = () => {
  window.dispatchEvent(new CustomEvent('request-canvas-focus'))
}

// Zoom controls
const updateZoom = (value: number | undefined) => {
  if (value !== undefined) {
    const newZoom = Math.max(minZoom, Math.min(maxZoom, value / 100))
    zoom.value = newZoom
    window.dispatchEvent(new CustomEvent('canvas-zoom', { detail: newZoom }))
    requestCanvasFocus()
  }
}

// Move step control
const updateMoveStep = (value: number | undefined) => {
  // The CustomNumberInput already handles validation and constraints
  if (value !== undefined) {
    keyboardStore.setMoveStep(value)
  }
  requestCanvasFocus()
}

// Lock rotations control
const toggleLockRotations = () => {
  keyboardStore.setLockRotations(!keyboardStore.lockRotations)
  requestCanvasFocus()
}

// Position formatting
const formatPosition = (value: number): string => {
  return value.toFixed(2).padStart(6, ' ')
}

// Event listeners
window.addEventListener('canvas-zoom-update', (event: Event) => {
  const customEvent = event as CustomEvent
  zoom.value = customEvent.detail
})

window.addEventListener('canvas-mouse-position', (event: Event) => {
  const customEvent = event as CustomEvent
  mousePosition.value = customEvent.detail
})

window.addEventListener('canvas-focus-change', (event: Event) => {
  const customEvent = event as CustomEvent
  canvasFocused.value = customEvent.detail.focused
})
</script>

<style scoped>
/* Canvas footer theme support */
.canvas-footer {
  background-color: var(--bs-tertiary-bg);
}

/* Base styles - flexible approach */
.zoom-control,
.move-step-control {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  white-space: nowrap;
}

.zoom-label,
.move-step-label {
  font-size: 0.75rem;
  flex-shrink: 0;
}

.position-indicator {
  background-color: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 0.75rem;
  font-weight: 500;
  font-family: monospace;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  min-width: 150px;
  justify-content: space-between;
}

.position-label {
  font-weight: normal;
  white-space: nowrap;
  flex-shrink: 0;
}

.position-values {
  font-weight: 600;
  text-align: right;
  white-space: nowrap;
  flex-shrink: 0;
}

/* Lock Rotations Checkbox Alignment */
.lock-rotations-checkbox {
  margin-top: 0 !important;
  margin-bottom: 0 !important;
}

.lock-rotations-control {
  flex-shrink: 0;
  white-space: nowrap;
}

/* Canvas Focus Indicator */
.canvas-focus-indicator {
  font-size: 0.75rem;
  flex-shrink: 0;
  white-space: nowrap;
  min-width: 55px;
}

.focus-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #dc3545;
  transition: background-color 0.2s ease;
}

.focus-status-dot.active {
  background-color: #28a745;
}

/* Keys counters - flexible */
.keys-counter,
.selected-counter {
  flex-shrink: 0;
  white-space: nowrap;
}

/* Responsive input sizing - set appropriate sizes for all screens */
.move-step-control .custom-number-input,
.zoom-control .custom-number-input {
  width: 75px;
  min-width: 75px;
  flex-shrink: 0;
}
</style>
