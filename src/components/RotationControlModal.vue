<template>
  <div
    v-if="visible"
    class="rotation-panel"
    data-testid="modal-rotation-panel"
    ref="panelRef"
    :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
    @mousedown="handleMouseDown"
  >
    <div class="panel-content">
      <div class="panel-header" @mousedown="handleHeaderMouseDown">
        <div class="panel-title">
          <BiGripVertical class="me-2 drag-handle" />
          <BiArrowRepeat class="me-2" />
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
        <div class="rotation-info mb-3" data-testid="modal-rotation-info">
          <div v-if="!rotationOrigin" class="text-center">
            <div class="text-warning mb-1">
              <BiCrosshair2 style="width: 24px; height: 24px" />
            </div>
            <div>
              <p><b>Select rotation anchor point</b></p>
              <p class="small text-muted">
                Click on a key corner or center to choose rotation origin
              </p>
            </div>
          </div>
          <div v-else>
            <div class="small d-flex align-items-center gap-2">
              <BiCrosshair2 />
              Origin: ({{ formatNumber(rotationOrigin.x) }}, {{ formatNumber(rotationOrigin.y) }})
            </div>
          </div>
        </div>

        <!-- Current angle display and direct input -->
        <div v-if="rotationOrigin" class="angle-input mb-3">
          <div class="d-flex align-items-center gap-3">
            <label class="form-label small mb-0 text-nowrap">Rotation Change:</label>
            <CustomNumberInput
              ref="angleInputRef"
              :model-value="currentAngle"
              @update:modelValue="updateAngle"
              @change="updateAngle"
              :step="1"
              :ctrl-step="5"
              :min="-360"
              :max="360"
              :wrap-around="true"
              :wrap-min="-360"
              :wrap-max="360"
              :disabled="!rotationOrigin"
            >
              <template #suffix>degrees</template>
            </CustomNumberInput>
          </div>
          <small class="form-text text-muted">
            <span v-if="rotationOrigin"> Mouse wheel: ±1°, Ctrl+wheel: ±5° </span>
            <span v-else class="text-warning">
              Select an anchor point first to enable rotation controls
            </span>
          </small>
        </div>
      </div>

      <div class="panel-footer">
        <button
          type="button"
          class="btn btn-secondary btn-sm d-flex align-items-center gap-1"
          @click="handleCancel"
          @mousedown.stop
        >
          <BiXCircle />
          Cancel
        </button>
        <button
          v-if="rotationOrigin"
          type="button"
          class="btn btn-primary btn-sm d-flex align-items-center gap-1"
          :disabled="!rotationOrigin"
          @click="handleApply"
          @mousedown.stop
        >
          <BiCheckCircle />
          Apply
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useDraggablePanel } from '@/composables/useDraggablePanel'
import CustomNumberInput from './CustomNumberInput.vue'
import BiGripVertical from 'bootstrap-icons/icons/grip-vertical.svg'
import BiArrowRepeat from 'bootstrap-icons/icons/arrow-repeat.svg'
import BiCrosshair2 from 'bootstrap-icons/icons/crosshair2.svg'
import BiXCircle from 'bootstrap-icons/icons/x-circle.svg'
import BiCheckCircle from 'bootstrap-icons/icons/check-circle.svg'

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
// Ref to the angle input component
const angleInputRef = ref<InstanceType<typeof CustomNumberInput>>()
// Dragging functionality with viewport bounds checking
const { position, panelRef, handleMouseDown, handleHeaderMouseDown, initializePosition } =
  useDraggablePanel({
    defaultPosition: { x: 100, y: 100 },
    margin: 10,
    headerHeight: 45, // Approximate height of the panel header
  })

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

// Update angle value and emit change
const updateAngle = (value: number | undefined) => {
  if (value !== undefined) {
    currentAngle.value = value
    // Emit the delta for immediate application
    emit('angleChange', currentAngle.value)
  }
}

const handleApply = () => {
  // Always apply, even if angle is 0
  emit('apply', currentAngle.value)
}

const handleCancel = () => {
  emit('cancel')
}

// Dragging functionality is now handled by the useDraggablePanel composable

// Watch for visibility changes to reset angle
watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) {
      currentAngle.value = 0
      // Position panel near the center-right of the screen
      initializePosition({ x: window.innerWidth - 400, y: 100 })
    }
  },
)

// Watch for rotation origin changes to auto-focus the input
watch(
  () => props.rotationOrigin,
  async (newOrigin, oldOrigin) => {
    // Focus the input when rotation origin is set (changes from null to a value)
    if (newOrigin && !oldOrigin) {
      // Wait for DOM update to complete
      await nextTick()

      // Auto-focus and select the angle input for better UX
      const angleInput = document.querySelector(
        '.rotation-panel input[type="number"]',
      ) as HTMLInputElement
      if (angleInput) {
        angleInput.focus()
        angleInput.select() // Select the text for easy replacement
      }
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

/* Mobile anchoring - similar to Key Properties panel */
@media (max-width: 767px) {
  .rotation-panel {
    position: fixed !important;
    top: auto !important;
    bottom: 0 !important;
    left: 0 !important;
    right: 0 !important;
    width: 100% !important;
    height: auto !important;
    max-height: 50vh !important;
    transform: none !important;
    margin: 0 !important;
    border-radius: 0 !important;
    border-left: none !important;
    border-right: none !important;
    border-bottom: none !important;
  }

  .rotation-panel .panel-content {
    border-radius: 0 !important;
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
  }

  .rotation-panel .panel-body {
    flex: 1 !important;
    overflow-y: auto !important;
    max-height: none !important;
  }
}

.panel-content {
  background-color: var(--bs-body-bg);
  border-radius: 8px;
  box-shadow: var(--bs-box-shadow-lg);
  border: 1px solid var(--bs-border-color);
  overflow: hidden;
}

.panel-header {
  background: var(--bs-tertiary-bg);
  border-bottom: 1px solid var(--bs-border-color);
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
  color: var(--bs-text-primary);
  display: flex;
  align-items: center;
}

.drag-handle {
  color: var(--bs-secondary-color);
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
  border-top: 1px solid var(--bs-border-color);
  padding: 8px 12px;
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  background: var(--bs-tertiary-bg);
}

.rotation-info {
  background: var(--bs-tertiary-bg);
  padding: 8px 12px;
  border-radius: 4px;
  border-left: 3px solid var(--bs-primary);
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
  border-color: var(--bs-primary);
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}
</style>
