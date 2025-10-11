<template>
  <div
    v-if="visible"
    class="matrix-modal"
    ref="panelRef"
    :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
    @mousedown="handleMouseDown"
  >
    <div class="panel-content">
      <div class="panel-header" @mousedown="handleHeaderMouseDown">
        <div class="panel-title">
          <i class="bi bi-grip-vertical me-2 drag-handle"></i>
          <i class="bi bi-grid-3x3 me-2"></i>
          Add Switch Matrix Coordinates
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
        <!-- VIA Already Annotated Warning -->
        <div v-if="keyboardStore.isViaAnnotated" class="already-annotated-warning mb-3">
          <div class="d-flex align-items-start gap-3">
            <i class="bi bi-check-circle-fill text-success" style="font-size: 1.5rem"></i>
            <div class="flex-grow-1">
              <h6 class="mb-2 text-success">Layout Already Annotated</h6>
              <p class="mb-0 small">
                This layout appears to already have VIA matrix coordinates. All keys have valid
                "row,column" annotations in the top-left position.
              </p>
            </div>
          </div>
        </div>

        <!-- Warning Message -->
        <div class="warning-section mb-3">
          <div class="d-flex align-items-start gap-3">
            <i class="bi bi-exclamation-triangle-fill text-warning" style="font-size: 1.5rem"></i>
            <div class="flex-grow-1">
              <h6 class="mb-2 text-warning">Important Notice</h6>
              <p class="mb-2 small">
                Running this tool will <strong>remove all existing legends</strong> from all keys
                and replace them with matrix coordinates in "row,column" format.
              </p>
              <p class="mb-0 small">
                The matrix coordinates will be placed in the top-left legend position (position 0)
                on each key, following the VIA format standard.
              </p>
            </div>
          </div>
        </div>

        <!-- Information Section -->
        <div class="info-section mb-3">
          <div class="d-flex align-items-start gap-3">
            <i class="bi bi-info-circle text-primary" style="font-size: 1.5rem"></i>
            <div class="flex-grow-1">
              <p class="mb-2 small">
                Matrix coordinates map the physical layout to the electrical switch matrix, enabling
                proper key mapping in VIA configurator.
              </p>
              <p class="mb-2 small">
                The algorithm assigns matrix position based on each key's center position,
                accounting for rotation and size.
              </p>
              <p class="mb-2 small">
                Learn more about VIA layouts:
                <a
                  href="https://www.caniusevia.com/docs/layouts"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-decoration-none"
                >
                  VIA Documentation
                  <i class="bi bi-box-arrow-up-right ms-1"></i>
                </a>
              </p>
            </div>
          </div>
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
        <button type="button" class="btn btn-primary btn-sm" @click="handleApply" @mousedown.stop>
          <i class="bi bi-grid-3x3 me-1"></i>
          Add Matrix Coordinates
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue'
import { useDraggablePanel } from '@/composables/useDraggablePanel'
import { useKeyboardStore } from '@/stores/keyboard'

// Store
const keyboardStore = useKeyboardStore()

// Props
interface Props {
  visible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
})

// Emits
interface Emits {
  (e: 'apply'): void
  (e: 'cancel'): void
}

const emit = defineEmits<Emits>()

// Dragging functionality with viewport bounds checking
const { position, panelRef, handleMouseDown, handleHeaderMouseDown, initializePosition } =
  useDraggablePanel({
    defaultPosition: { x: 100, y: 100 },
    margin: 10,
    headerHeight: 45,
  })

// Watch for modal visibility
watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) {
      // Position modal on the right side (consistent with other tool panels)
      initializePosition({ x: window.innerWidth - 520, y: 100 })
    }
  },
)

// Methods
const handleApply = () => {
  emit('apply')
}

const handleCancel = () => {
  emit('cancel')
}

// Keyboard shortcuts
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
.matrix-modal {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
  width: 500px;
  user-select: none;
}

/* Mobile anchoring */
@media (max-width: 767px) {
  .matrix-modal {
    position: fixed !important;
    top: auto !important;
    bottom: 0 !important;
    left: 0 !important;
    right: 0 !important;
    width: 100% !important;
    height: auto !important;
    max-height: 70vh !important;
    transform: none !important;
    margin: 0 !important;
    border-radius: 0 !important;
    border-left: none !important;
    border-right: none !important;
    border-bottom: none !important;
  }

  .matrix-modal .panel-content {
    border-radius: 0 !important;
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
  }

  .matrix-modal .panel-body {
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
  color: var(--bs-secondary);
  cursor: grab;
}

.drag-handle:active {
  cursor: grabbing;
}

.panel-body {
  padding: 16px;
  max-height: 500px;
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

/* Section styles */
.already-annotated-warning {
  background: var(--bs-tertiary-bg);
  padding: 12px;
  border-radius: 6px;
  border-left: 4px solid var(--bs-success);
}

.warning-section {
  background: var(--bs-tertiary-bg);
  padding: 12px;
  border-radius: 6px;
  border-left: 4px solid var(--bs-warning);
}

.info-section {
  background: var(--bs-tertiary-bg);
  padding: 12px;
  border-radius: 6px;
  border-left: 4px solid var(--bs-primary);
}

/* Responsive adjustments */
@media (max-width: 576px) {
  .matrix-modal {
    width: 100%;
  }

  .panel-body {
    padding: 12px;
  }
}

/* Animation for button press feedback */
.btn:active {
  transform: translateY(1px);
}
</style>
