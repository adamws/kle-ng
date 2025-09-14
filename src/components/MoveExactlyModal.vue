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
          <i class="bi bi-grip-vertical me-2 drag-handle"></i>
          <i class="bi bi-arrows-move me-2"></i>
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
              <label class="btn btn-outline-secondary btn-sm" for="unit-u">U</label>

              <input
                type="radio"
                class="btn-check"
                id="unit-mm"
                value="mm"
                v-model="selectedUnit"
                autocomplete="off"
              />
              <label class="btn btn-outline-secondary btn-sm" for="unit-mm">mm</label>
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
          class="btn btn-secondary btn-sm"
          @mousedown.prevent.stop="handleCancel"
        >
          <i class="bi bi-x-circle me-1"></i>
          Cancel
        </button>
        <button type="button" class="btn btn-primary btn-sm" @mousedown.prevent.stop="handleApply">
          <i class="bi bi-check-circle me-1"></i>
          Apply
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import CustomNumberInput from './CustomNumberInput.vue'

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

const panelRef = ref<HTMLDivElement>()
const position = ref({ x: 100, y: 100 })
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })

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
      position.value = { x: window.innerWidth - 400, y: 100 }

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
  if (value !== undefined) {
    movementX.value = value
    // Emit the delta for immediate preview (converted to internal units)
    const deltaX = convertXToInternalUnits(movementX.value)
    const deltaY = convertYToInternalUnits(movementY.value)
    emit('movementChange', deltaX, deltaY)
  }
}

const updateMovementY = (value: number | undefined) => {
  if (value !== undefined) {
    movementY.value = value
    // Emit the delta for immediate preview (converted to internal units)
    const deltaX = convertXToInternalUnits(movementX.value)
    const deltaY = convertYToInternalUnits(movementY.value)
    emit('movementChange', deltaX, deltaY)
  }
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

// Dragging functionality (copied from RotationControlModal)
const handleMouseDown = (event: MouseEvent) => {
  if (event.target === panelRef.value) {
    event.preventDefault()
  }
}

const handleHeaderMouseDown = (event: MouseEvent) => {
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
  document.removeEventListener('mousemove', handleDocumentMouseMove)
  document.removeEventListener('mouseup', handleDocumentMouseUp)
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
  max-height: 500px;
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

.unit-selection {
  background: #f8f9fa;
  padding: 8px 12px;
  border-radius: 4px;
  border-left: 3px solid #007bff;
}

.spacing-config {
  background: #fff8e1;
  padding: 8px 12px;
  border-radius: 4px;
  border-left: 3px solid #ffc107;
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
