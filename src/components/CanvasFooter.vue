<template>
  <div class="card-footer bg-light d-flex justify-content-between align-items-center">
    <!-- Left side: Keys status -->
    <div class="canvas-status d-flex align-items-center gap-3">
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
        <span class="small text-muted">{{ canvasFocused ? 'Active' : 'Inactive' }}</span>
      </div>
      <div class="keys-counter small text-muted">
        Keys: <span class="fw-semibold">{{ keyboardStore.keys.length }}</span>
      </div>
      <div class="selected-counter small text-muted">
        Selected: <span class="fw-semibold">{{ keyboardStore.selectedKeys.length }}</span>
      </div>
      <!-- Move Step Control -->
      <div class="move-step-control d-flex align-items-center gap-1">
        <label class="move-step-label small text-muted mb-0">Step:</label>
        <input
          type="number"
          :value="keyboardStore.moveStep"
          @input="updateMoveStep"
          step="0.05"
          min="0.05"
          max="5"
          class="move-step-input"
        />
        <span class="move-step-unit small text-muted">U</span>
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
          class="form-check-label small text-muted mb-0"
          title="When enabled, rotation origins move with keys to maintain relative offset"
        >
          Lock rotations
        </label>
      </div>
    </div>

    <!-- Right side: Zoom controls and mouse position -->
    <div class="d-flex align-items-center gap-3">
      <!-- Zoom Controls -->
      <div class="btn-group btn-group-sm">
        <button @click="zoomOut" class="btn btn-outline-kle-secondary" title="Zoom Out">
          <i class="bi bi-zoom-out"></i>
        </button>
        <button @click="resetView" class="btn btn-outline-kle-secondary" title="Reset View">
          <i class="bi bi-house"></i>
        </button>
        <button @click="zoomIn" class="btn btn-outline-kle-secondary" title="Zoom In">
          <i class="bi bi-zoom-in"></i>
        </button>
      </div>
      <div class="zoom-indicator">{{ Math.round(zoom * 100) }}%</div>

      <!-- Mouse position display -->
      <div class="position-indicator">
        <span class="position-label">Mouse:</span>
        <span class="position-values">
          {{ `${formatPosition(mousePosition.x)}, ${formatPosition(mousePosition.y)}` }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useKeyboardStore } from '@/stores/keyboard'

const keyboardStore = useKeyboardStore()

// Refs for component state
const zoom = ref(1)
const minZoom = 0.1
const maxZoom = 5
const mousePosition = ref({ x: 0, y: 0, visible: false })
const canvasFocused = ref(false)

// Helper function to request canvas focus
const requestCanvasFocus = () => {
  window.dispatchEvent(new CustomEvent('request-canvas-focus'))
}

// Zoom controls
const zoomIn = () => {
  const newZoom = Math.min(maxZoom, zoom.value * 1.2)
  zoom.value = newZoom
  window.dispatchEvent(new CustomEvent('canvas-zoom', { detail: newZoom }))
  requestCanvasFocus()
}

const zoomOut = () => {
  const newZoom = Math.max(minZoom, zoom.value * 0.8)
  zoom.value = newZoom
  window.dispatchEvent(new CustomEvent('canvas-zoom', { detail: newZoom }))
  requestCanvasFocus()
}

const resetView = () => {
  zoom.value = 1
  window.dispatchEvent(new CustomEvent('canvas-reset-view'))
  requestCanvasFocus()
}

// Move step control
const updateMoveStep = (event: Event) => {
  const input = event.target as HTMLInputElement
  let value = parseFloat(input.value)

  if (isNaN(value)) {
    value = 0.25
  }

  value = Math.max(0.05, Math.min(5, value))

  keyboardStore.setMoveStep(value)

  input.value = value.toString()
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
.zoom-indicator {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 0.75rem;
  text-align: center;
  color: #495057;
  font-weight: 500;
}

.position-indicator {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 0.75rem;
  color: #495057;
  font-weight: 500;
  font-family: monospace;
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 140px;
  justify-content: space-between;
}

.position-label {
  color: #6c757d;
  font-weight: normal;
  white-space: nowrap;
}

.position-values {
  font-weight: 600;
  text-align: right;
  min-width: 85px;
  white-space: nowrap;
}

/* Move Step Control in Status Line */
.move-step-input {
  width: 60px;
  padding: 2px 6px;
  border: 1px solid #ced4da;
  border-radius: 3px;
  font-size: 0.75rem;
  text-align: center;
  background: white;
}

.move-step-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 1px rgba(0, 123, 255, 0.25);
}

/* Lock Rotations Checkbox Alignment */
.lock-rotations-checkbox {
  margin-top: 0 !important;
  margin-bottom: 0 !important;
}

.move-step-label,
.move-step-unit {
  font-size: 0.75rem;
  white-space: nowrap;
}

/* Canvas Focus Indicator */
.canvas-focus-indicator {
  font-size: 0.75rem;
  min-width: 50px; /* Consistent width for "Inactive"/"Active" */
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

/* Keys counters consistent width */
.keys-counter {
  min-width: 60px; /* Assume max ~999 keys */
}

.selected-counter {
  min-width: 80px; /* Assume max ~999 selected */
}
</style>
