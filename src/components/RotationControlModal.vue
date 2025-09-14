<template>
  <div
    v-if="visible"
    class="rotation-panel"
    ref="panelRef"
    :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
    @mousedown="handleMouseDown"
  >
    <div class="panel-content">
      <div class="panel-header" @mousedown="handleHeaderMouseDown">
        <div class="panel-title">
          <i class="bi bi-grip-vertical me-2 drag-handle"></i>
          <i class="bi bi-arrow-repeat me-2"></i>
          Rotate Selection
        </div>
        <button
          type="button"
          class="btn-close"
          @click="handleCancel"
          @mousedown.stop
          aria-label="Close"
        ></button>
      </div>

      <div class="panel-body">
        <!-- Rotation info - different content based on whether anchor is selected -->
        <div class="rotation-info mb-3">
          <div v-if="!rotationOrigin" class="text-center">
            <div class="mb-2">
              <i class="bi bi-crosshair2 text-warning" style="font-size: 1.5rem"></i>
            </div>
            <div class="text-muted">
              <strong>Select rotation anchor point</strong><br />
              <small>Click on a key corner or center to choose rotation origin</small>
            </div>
          </div>
          <div v-else>
            <div class="d-flex justify-content-between align-items-center">
              <small class="text-muted">
                <i class="bi bi-crosshair2 me-1"></i>
                Origin: ({{ formatNumber(rotationOrigin.x) }}, {{ formatNumber(rotationOrigin.y) }})
              </small>
            </div>
          </div>
        </div>

        <!-- Current angle display and direct input -->
        <div v-if="rotationOrigin" class="angle-input mb-3">
          <div class="d-flex align-items-center gap-3">
            <label class="form-label small mb-0 text-nowrap">Rotation Change (degrees):</label>
            <div class="input-group flex-grow-1">
              <input
                ref="angleInputRef"
                v-model.number="currentAngle"
                type="number"
                class="form-control"
                step="1"
                min="-360"
                max="360"
                :disabled="!rotationOrigin"
                @input="handleAngleInput"
                @wheel="handleAngleWheel"
                @focus="handleAngleFocus"
                @blur="handleAngleBlur"
              />
            </div>
          </div>
          <small class="form-text text-muted">
            <span v-if="rotationOrigin"> Focus and scroll: ±1°, Ctrl+scroll: ±5° </span>
            <span v-else class="text-warning">
              Select an anchor point first to enable rotation controls
            </span>
          </small>
        </div>
      </div>

      <div class="panel-footer">
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          @click="handleCancel"
          @mousedown.stop
        >
          <i class="bi bi-x-circle me-1"></i>
          Cancel
        </button>
        <button
          v-if="rotationOrigin"
          type="button"
          class="btn btn-primary btn-sm"
          :disabled="!rotationOrigin"
          @click="handleApply"
          @mousedown.stop
        >
          <i class="bi bi-check-circle me-1"></i>
          Apply
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'

// Props
interface Props {
  visible?: boolean
  rotationOrigin?: { x: number; y: number } | null
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  rotationOrigin: null,
})

// Emits
interface Emits {
  (e: 'apply', angle: number): void
  (e: 'cancel'): void
  (e: 'angleChange', angle: number): void
}

const emit = defineEmits<Emits>()

// Local state - this represents the rotation DELTA (change), not absolute angle
const currentAngle = ref(0)
const panelRef = ref<HTMLDivElement>()
const angleInputRef = ref<HTMLInputElement>()
const position = ref({ x: 100, y: 100 }) // Default position
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
const inputFocused = ref(false)

// Watch for modal visibility - reset delta when modal opens
watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) {
      currentAngle.value = 0 // Reset to 0 delta when modal opens
    }
  },
)

// Methods
const formatNumber = (value: number): string => {
  return value.toFixed(2).replace(/\.?0+$/, '')
}

const handleAngleInput = () => {
  // Directly emit the delta for immediate application
  emit('angleChange', currentAngle.value)
}

const handleAngleWheel = (event: WheelEvent) => {
  // Only handle wheel events when input is focused
  if (!inputFocused.value) return

  event.preventDefault()

  // Determine scroll direction and step size
  const delta = event.deltaY > 0 ? -1 : 1
  const step = event.ctrlKey ? 5 : 1

  currentAngle.value += delta * step

  // Normalize angle to -360 to 360 range
  if (currentAngle.value > 360) {
    currentAngle.value -= 360
  } else if (currentAngle.value < -360) {
    currentAngle.value += 360
  }

  // Emit the DELTA for preview (same as input)
  emit('angleChange', currentAngle.value)
}

const handleAngleFocus = () => {
  inputFocused.value = true
}

const handleAngleBlur = () => {
  inputFocused.value = false
}

const handleApply = () => {
  // Always apply, even if angle is 0
  emit('apply', currentAngle.value)
}

const handleCancel = () => {
  emit('cancel')
}

// Dragging functionality
const handleMouseDown = (event: MouseEvent) => {
  // Only handle mousedown on the panel itself (not header or buttons)
  if (event.target === panelRef.value) {
    event.preventDefault()
  }
}

const handleHeaderMouseDown = (event: MouseEvent) => {
  // Start dragging when clicking on header
  isDragging.value = true

  const rect = panelRef.value?.getBoundingClientRect()
  if (rect) {
    dragOffset.value = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  document.addEventListener('mousemove', handleDocumentMouseMove)
  document.addEventListener('mouseup', handleDocumentMouseUp)
  event.preventDefault()
}

const handleDocumentMouseMove = (event: MouseEvent) => {
  if (isDragging.value) {
    position.value = {
      x: event.clientX - dragOffset.value.x,
      y: event.clientY - dragOffset.value.y,
    }
  }
}

const handleDocumentMouseUp = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handleDocumentMouseMove)
  document.removeEventListener('mouseup', handleDocumentMouseUp)
}

// Watch for visibility changes to reset angle
watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) {
      currentAngle.value = 0
      // Position panel near the center-right of the screen
      position.value = { x: window.innerWidth - 400, y: 100 }
    }
  },
)

// Watch for keyboard escape key
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.visible) {
    handleCancel()
  } else if (event.key === 'Enter' && props.visible) {
    handleApply()
  }
}

// Add keyboard event listeners when component mounts

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('mousemove', handleDocumentMouseMove)
  document.removeEventListener('mouseup', handleDocumentMouseUp)
})
</script>

<style scoped>
.rotation-panel {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
  width: 320px;
  user-select: none;
}

.panel-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  border: 1px solid #ddd;
  overflow: hidden;
}

.panel-header {
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: move;
  user-select: none;
}

.panel-title {
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0;
  color: #495057;
  display: flex;
  align-items: center;
}

.drag-handle {
  color: #6c757d;
  cursor: grab;
}

.drag-handle:active {
  cursor: grabbing;
}

.panel-body {
  padding: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.panel-footer {
  border-top: 1px solid #dee2e6;
  padding: 8px 12px;
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  background: #f8f9fa;
}

.rotation-info {
  background: #f8f9fa;
  padding: 8px 12px;
  border-radius: 4px;
  border-left: 3px solid #007bff;
}

.angle-buttons .btn {
  font-size: 0.8rem;
  padding: 4px 8px;
  border-width: 1px;
}

.angle-buttons .btn:hover {
  transform: translateY(-1px);
}

.angle-input .form-control {
  text-align: center;
  font-weight: 500;
}

.fine-controls .btn {
  font-size: 0.8rem;
}

.fine-controls .btn i {
  font-size: 0.9rem;
}

/* Responsive adjustments */
@media (max-width: 576px) {
  .modal-dialog {
    margin: 10px;
    max-width: none;
  }

  .angle-buttons .btn {
    font-size: 0.7rem;
    padding: 3px 6px;
  }
}

/* Animation for button press feedback */
.btn:active {
  transform: translateY(1px);
}

/* Highlight current angle input when focused */
.angle-input .form-control:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}
</style>
