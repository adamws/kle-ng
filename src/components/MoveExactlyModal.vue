<template>
  <div
    v-if="visible"
    class="move-exactly-panel"
    ref="panelRef"
    :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
    @mousedown="handleMouseDown"
  >
    <div class="panel-content">
      <div class="panel-header" @mousedown="handleHeaderMouseDown">
        <div class="panel-title">
          <BiGripVertical class="me-2 drag-handle" />
          <BiArrowsMove class="me-2" />
          Move Exactly
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
        <!-- Unit selection -->
        <div class="unit-selection mb-3">
          <div class="d-flex align-items-center gap-3">
            <label class="form-label small mb-0 text-nowrap">Unit:</label>
            <div class="btn-group" role="group">
              <input
                type="radio"
                class="btn-check"
                id="unit-u"
                value="U"
                v-model="selectedUnit"
                autocomplete="off"
              />
              <label class="btn btn-outline-primary btn-sm" for="unit-u">U</label>

              <input
                type="radio"
                class="btn-check"
                id="unit-mm"
                value="mm"
                v-model="selectedUnit"
                autocomplete="off"
              />
              <label class="btn btn-outline-primary btn-sm" for="unit-mm">mm</label>
            </div>
          </div>
        </div>

        <!-- Spacing configuration (only for mm mode) -->
        <div v-if="selectedUnit === 'mm'" class="spacing-config mb-3">
          <div class="row g-2">
            <div class="col-6">
              <label class="form-label small mb-1">X Spacing:</label>
              <CustomNumberInput
                :model-value="uSpacing.x"
                @update:modelValue="updateUSpacingX"
                @change="updateUSpacingX"
                :step="0.05"
                :min="10"
                :max="30"
              >
                <template #suffix>mm/U</template>
              </CustomNumberInput>
            </div>
            <div class="col-6">
              <label class="form-label small mb-1">Y Spacing:</label>
              <CustomNumberInput
                :model-value="uSpacing.y"
                @update:modelValue="updateUSpacingY"
                @change="updateUSpacingY"
                :step="0.05"
                :min="10"
                :max="30"
              >
                <template #suffix>mm/U</template>
              </CustomNumberInput>
            </div>
          </div>
          <small class="form-text text-muted"> Configure mm-to-U conversion </small>
        </div>

        <!-- X/Y movement inputs -->
        <div class="movement-inputs mb-3">
          <div class="row g-2">
            <div class="col-6">
              <label class="form-label small mb-1">X Movement:</label>
              <CustomNumberInput
                :model-value="movementX"
                @update:modelValue="updateMovementX"
                @change="updateMovementX"
                :step="0.1"
                :value-on-clear="0"
              >
                <template #suffix>{{ selectedUnit }}</template>
              </CustomNumberInput>
            </div>
            <div class="col-6">
              <label class="form-label small mb-1">Y Movement:</label>
              <CustomNumberInput
                :model-value="movementY"
                @update:modelValue="updateMovementY"
                @change="updateMovementY"
                :step="0.1"
                :value-on-clear="0"
              >
                <template #suffix>{{ selectedUnit }}</template>
              </CustomNumberInput>
            </div>
          </div>
          <small class="form-text text-muted">
            <span>
              Focus and scroll: ±0.1{{ selectedUnit }}, Ctrl+scroll: ±1.0{{ selectedUnit }}
            </span>
          </small>
        </div>
      </div>

      <div class="panel-footer">
        <button
          type="button"
          class="btn btn-secondary btn-sm d-flex align-items-center gap-1"
          @mousedown.prevent.stop="handleCancel"
        >
          <BiXCircle />
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-primary btn-sm d-flex align-items-center gap-1"
          @mousedown.prevent.stop="handleApply"
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
import BiArrowsMove from 'bootstrap-icons/icons/arrows-move.svg'
import BiXCircle from 'bootstrap-icons/icons/x-circle.svg'
import BiCheckCircle from 'bootstrap-icons/icons/check-circle.svg'

// Props
interface Props {
  visible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
})

// Emits
interface Emits {
  (e: 'apply', deltaX: number, deltaY: number): void
  (e: 'cancel'): void
  (e: 'movementChange', deltaX: number, deltaY: number): void
}

const emit = defineEmits<Emits>()

// Local state
const movementX = ref(0)
const movementY = ref(0)
const selectedUnit = ref<'U' | 'mm'>('U')
const uSpacing = ref({ x: 19.05, y: 19.05 }) // Default 1U = 19.05mm

// Persistent state for last used values (survives modal close/open cycles)
const lastUsedValues = ref({
  movementX: 0,
  movementY: 0,
  selectedUnit: 'U' as 'U' | 'mm',
  uSpacing: { x: 19.05, y: 19.05 },
})

// Dragging functionality with viewport bounds checking
const { position, panelRef, handleMouseDown, handleHeaderMouseDown, initializePosition } =
  useDraggablePanel({
    defaultPosition: { x: 100, y: 100 },
    margin: 10,
    headerHeight: 45, // Approximate height of the panel header
  })

// Watch for modal visibility - restore last used values and auto-focus
watch(
  () => props.visible,
  async (isVisible) => {
    if (isVisible) {
      // Restore last used values for better UX
      movementX.value = lastUsedValues.value.movementX
      movementY.value = lastUsedValues.value.movementY
      selectedUnit.value = lastUsedValues.value.selectedUnit
      uSpacing.value = { ...lastUsedValues.value.uSpacing }
      initializePosition({ x: window.innerWidth - 400, y: 100 })

      // Modal is now visible and ready for interaction
      await nextTick()

      // Auto-focus the X input for better UX
      const xInput = document.querySelector(
        '.move-exactly-panel input[type="number"]',
      ) as HTMLInputElement
      if (xInput) {
        xInput.focus()
        xInput.select() // Select the text for easy replacement
      }
    }
  },
)

// Methods
const convertXToInternalUnits = (xValue: number): number => {
  if (selectedUnit.value === 'U') {
    return xValue
  } else {
    return xValue / uSpacing.value.x
  }
}

const convertYToInternalUnits = (yValue: number): number => {
  if (selectedUnit.value === 'U') {
    return yValue
  } else {
    return yValue / uSpacing.value.y
  }
}

// Update spacing values
const updateUSpacingX = (value: number | undefined) => {
  if (value !== undefined) {
    uSpacing.value.x = value
  }
}

const updateUSpacingY = (value: number | undefined) => {
  if (value !== undefined) {
    uSpacing.value.y = value
  }
}

// Update movement values and emit changes
const updateMovementX = (value: number | undefined) => {
  // Treat undefined (cleared input) as 0 for natural no-movement behavior
  movementX.value = value ?? 0
  // Emit the delta for immediate preview (converted to internal units)
  const deltaX = convertXToInternalUnits(movementX.value)
  const deltaY = convertYToInternalUnits(movementY.value)
  emit('movementChange', deltaX, deltaY)
}

const updateMovementY = (value: number | undefined) => {
  // Treat undefined (cleared input) as 0 for natural no-movement behavior
  movementY.value = value ?? 0
  // Emit the delta for immediate preview (converted to internal units)
  const deltaX = convertXToInternalUnits(movementX.value)
  const deltaY = convertYToInternalUnits(movementY.value)
  emit('movementChange', deltaX, deltaY)
}

const handleApply = () => {
  // Convert the movement values to internal units
  const deltaX = convertXToInternalUnits(movementX.value)
  const deltaY = convertYToInternalUnits(movementY.value)

  // Save current values for future use (only when applied, not cancelled)
  lastUsedValues.value = {
    movementX: movementX.value,
    movementY: movementY.value,
    selectedUnit: selectedUnit.value,
    uSpacing: { ...uSpacing.value },
  }

  emit('apply', deltaX, deltaY)
}

const handleCancel = () => {
  emit('cancel')
}

// Dragging functionality is now handled by the useDraggablePanel composable

// Watch for keyboard escape key
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.visible) {
    handleCancel()
  } else if (event.key === 'Enter' && props.visible) {
    handleApply()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.move-exactly-panel {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
  width: 360px;
  user-select: none;
}

/* Mobile anchoring - similar to Key Properties panel */
@media (max-width: 767px) {
  .move-exactly-panel {
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

  .move-exactly-panel .panel-content {
    border-radius: 0 !important;
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
  }

  .move-exactly-panel .panel-body {
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
  background-color: var(--bs-tertiary-bg);
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
  color: #6c757d;
  cursor: grab;
}

.drag-handle:active {
  cursor: grabbing;
}

.panel-body {
  padding: 12px;
  max-height: 500px;
  overflow-y: auto;
}

.panel-footer {
  border-top: 1px solid var(--bs-border-color);
  padding: 8px 12px;
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  background-color: var(--bs-tertiary-bg);
}

.unit-selection {
  background: var(--bs-tertiary-bg);
  padding: 8px 12px;
  border-radius: 4px;
  border-left: 3px solid var(--bs-primary);
}

.spacing-config {
  background-color: var(--bs-warning-bg-subtle);
  padding: 8px 12px;
  border-radius: 4px;
  border-left: 3px solid var(--bs-warning);
}

.movement-inputs .form-control {
  text-align: center;
  font-weight: 500;
}

/* Responsive adjustments */
@media (max-width: 576px) {
  .move-exactly-panel {
    width: 320px;
  }

  .panel-body {
    padding: 10px;
  }
}

/* Animation for button press feedback */
.btn:active {
  transform: translateY(1px);
}

/* Highlight input when focused */
.form-control:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}
</style>
