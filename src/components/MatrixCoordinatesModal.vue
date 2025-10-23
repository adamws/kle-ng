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
        <!-- Warning Step -->
        <div v-if="step === 'warning'">
          <!-- Already Annotated Warning -->
          <div v-if="keyboardStore.isViaAnnotated" class="alert alert-success mb-3">
            <div class="d-flex align-items-start gap-3">
              <i class="bi bi-check-circle-fill text-success" style="font-size: 1.5rem"></i>
              <div class="flex-grow-1">
                <h6 class="mb-2 text-success fw-bold">Layout Already Annotated</h6>
                <p class="mb-0 small">
                  This layout appears to already have VIA matrix coordinates. All keys have valid
                  "row,column" annotations in the top-left position.
                </p>
              </div>
            </div>
          </div>

          <!-- Warning Message -->
          <div class="alert alert-warning mb-3">
            <div class="d-flex align-items-start gap-3">
              <i class="bi bi-exclamation-triangle-fill text-warning" style="font-size: 1.5rem"></i>
              <div class="flex-grow-1">
                <h6 class="mb-2 text-warning fw-bold">Important Notice</h6>
                <p class="mb-2 small">
                  This tool will <strong>remove all existing legends</strong> from your keys and
                  replace them with matrix coordinates in "row,column" format.
                </p>
                <p class="mb-0 small">
                  The matrix coordinates will be placed in the top-left legend position (position 0)
                  on each key, following the VIA format standard.
                </p>
              </div>
            </div>
          </div>

          <!-- Information Section -->
          <div class="info-section mb-0">
            <div class="d-flex align-items-start gap-3">
              <i class="bi bi-info-circle text-primary" style="font-size: 1.5rem"></i>
              <div class="flex-grow-1">
                <p class="mb-2 small">
                  Matrix coordinates map the physical layout to the electrical switch matrix,
                  enabling proper key mapping in VIA configurator.
                </p>
                <p class="mb-2 small">
                  You can use <strong>automatic annotation</strong> (based on key positions) or
                  <strong>draw manually</strong> by clicking keys in sequence.
                </p>
                <p class="mb-0 small">
                  Learn more:
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

        <!-- Drawing Panel -->
        <div v-if="step === 'draw'" class="draw-section">
          <!-- Fixed Header: Instructions and Toggle -->
          <div class="draw-header">
            <!-- Instructions -->
            <div class="info-section mb-3">
              <div class="d-flex align-items-start gap-3">
                <div class="flex-grow-1">
                  <div class="progress-info">
                    <div class="progress-item">
                      <div class="progress-label">
                        <i class="bi bi-diagram-3 me-1 text-primary"></i>
                        <span class="fw-bold">Rows:</span>
                        <span class="ms-1">{{ rows.length }} defined</span>
                      </div>
                      <div class="progress-stats">
                        <span v-if="keysLeftForRows > 0" class="text-muted small">
                          {{ keysLeftForRows }} keys left
                        </span>
                        <span v-else class="text-success small">
                          <i class="bi bi-check-circle-fill me-1"></i>Complete
                        </span>
                      </div>
                    </div>
                    <div class="progress-item">
                      <div class="progress-label">
                        <i class="bi bi-diagram-2 me-1 text-success"></i>
                        <span class="fw-bold">Columns:</span>
                        <span class="ms-1">{{ cols.length }} defined</span>
                      </div>
                      <div class="progress-stats">
                        <span v-if="keysLeftForColumns > 0" class="text-muted small">
                          {{ keysLeftForColumns }} keys left
                        </span>
                        <span v-else class="text-success small">
                          <i class="bi bi-check-circle-fill me-1"></i>Complete
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Completion Message -->
            <div v-if="isAnnotationComplete" class="alert alert-success mb-3">
              <div class="d-flex align-items-center gap-2">
                <i class="bi bi-check-circle-fill" style="font-size: 1.2rem"></i>
                <div class="flex-grow-1">
                  <strong>Annotation Complete!</strong>
                  <p class="mb-0 small">
                    All {{ totalRegularKeys }} keys have been assigned. Coordinates are applied
                    automatically. You can close the tool or continue editing.
                  </p>
                </div>
              </div>
            </div>

            <!-- Automatic Annotation Button -->
            <div class="mb-3">
              <button
                type="button"
                class="btn btn-outline-info btn-sm w-100"
                @click="handleAutomaticAnnotation"
                @mousedown.stop
                title="Automatically assign matrix coordinates based on key positions"
              >
                <i class="bi bi-magic me-1"></i>
                Annotate Automatically
              </button>
              <p class="mb-0 mt-1 small text-muted text-center">
                Auto-assigns based on key center positions
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="panel-footer">
        <!-- Close button (drawing step) -->
        <button
          v-if="step === 'draw'"
          type="button"
          class="btn btn-secondary btn-sm"
          @click="handleClose"
          @mousedown.stop
          aria-label="Close"
        >
          <i class="bi bi-x-circle me-1"></i>
          Close
        </button>

        <!-- OK button (warning step) -->
        <button
          v-if="step === 'warning'"
          type="button"
          class="btn btn-primary btn-sm"
          @click="acceptWarning"
          @mousedown.stop
          aria-label="Ok"
        >
          <i class="bi bi-check-circle me-1"></i>
          OK
        </button>

        <!-- cancel button (warning step) -->
        <button
          v-if="step === 'warning'"
          type="button"
          class="btn btn-secondary btn-sm"
          @click="handleCancel"
          @mousedown.stop
          aria-label="Cancel"
        >
          <i class="bi bi-x-circle me-1"></i>
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useDraggablePanel } from '@/composables/useDraggablePanel'
import { useKeyboardStore, type Key } from '@/stores/keyboard'
import { getKeyCenter } from '@/utils/keyboard-geometry'

// Props
interface Props {
  visible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
})

// Emits
interface Emits {
  (e: 'apply', data: MatrixAssignment): void
  (e: 'cancel'): void
}

const emit = defineEmits<Emits>()

// Store
const keyboardStore = useKeyboardStore()

// Types
interface MatrixAssignment {
  rows: Map<number, Key[]>
  cols: Map<number, Key[]>
}

interface MatrixItem {
  id: string
  index: number
  keySequence: Key[]
}

// State
const step = ref<'warning' | 'draw'>('warning')
const rows = ref<MatrixItem[]>([])
const cols = ref<MatrixItem[]>([])

// Dragging functionality
const { position, panelRef, handleMouseDown, handleHeaderMouseDown, initializePosition } =
  useDraggablePanel({
    defaultPosition: { x: 100, y: 100 },
    margin: 10,
    headerHeight: 45,
  })

// Check if there are any labels on regular keys (non-ghost, non-decal)
const hasLabels = computed(() => {
  return keyboardStore.keys.some((key) => {
    // Skip ghost and decal keys
    if (key.ghost || key.decal) return false

    // Check if key has any labels
    return (
      key.labels &&
      key.labels.length > 0 &&
      key.labels.some((label) => label && label.trim() !== '')
    )
  })
})

// Get all regular keys (non-ghost, non-decal)
const regularKeys = computed(() => {
  return keyboardStore.keys.filter((key) => !key.ghost && !key.decal)
})

// Get keys assigned to rows
const keysAssignedToRows = computed(() => {
  const assignedKeys = new Set<Key>()
  rows.value.forEach((row) => {
    row.keySequence.forEach((key) => assignedKeys.add(key))
  })
  return assignedKeys
})

// Get keys assigned to columns
const keysAssignedToColumns = computed(() => {
  const assignedKeys = new Set<Key>()
  cols.value.forEach((col) => {
    col.keySequence.forEach((key) => assignedKeys.add(key))
  })
  return assignedKeys
})

// Progress tracking
const keysLeftForRows = computed(() => {
  return regularKeys.value.filter((key) => !keysAssignedToRows.value.has(key)).length
})

const keysLeftForColumns = computed(() => {
  return regularKeys.value.filter((key) => !keysAssignedToColumns.value.has(key)).length
})

const totalRegularKeys = computed(() => regularKeys.value.length)

const isAnnotationComplete = computed(() => {
  return totalRegularKeys.value > 0 && keysLeftForRows.value === 0 && keysLeftForColumns.value === 0
})

// Methods
const acceptWarning = () => {
  // Remove all legends from all keys
  keyboardStore.keys.forEach((key) => {
    key.labels = []
  })

  step.value = 'draw'
}

// Apply current coordinates to all keys
const applyCoordinatesToKeys = () => {
  // Build maps for quick lookup
  const keyToRow = new Map<Key, number>()
  const keyToCol = new Map<Key, number>()

  // Populate row assignments
  rows.value.forEach((row) => {
    row.keySequence.forEach((key) => {
      keyToRow.set(key, row.index)
    })
  })

  // Populate column assignments
  cols.value.forEach((col) => {
    col.keySequence.forEach((key) => {
      keyToCol.set(key, col.index)
    })
  })

  // Apply labels to ALL keys (including partial assignments)
  keyboardStore.keys.forEach((key) => {
    if (key.ghost || key.decal) return

    const rowIndex = keyToRow.get(key)
    const colIndex = keyToCol.get(key)

    // Build label based on what's assigned
    if (rowIndex !== undefined && colIndex !== undefined) {
      // Both row and column assigned: "row,col"
      key.labels = [`${rowIndex},${colIndex}`]
    } else if (rowIndex !== undefined) {
      // Only row assigned: "row,"
      key.labels = [`${rowIndex},`]
    } else if (colIndex !== undefined) {
      // Only column assigned: ",col"
      key.labels = [`,${colIndex}`]
    } else {
      // No assignment: clear label
      key.labels = []
    }
  })
}

const handleAutomaticAnnotation = () => {
  // Calculate center positions for all keys and assign matrix coordinates
  // Create a map of matrix positions to keys
  const matrixMap = new Map<string, Key[]>()

  keyboardStore.keys.forEach((key) => {
    // Skip decal and ghost keys
    if (key.decal || key.ghost) return

    // Calculate key center accounting for rotation using extracted utility
    const center = getKeyCenter(key)

    // Convert to integer coordinates (rounding to nearest integer)
    const row = Math.round(center.y)
    const col = Math.round(center.x)

    // Store key in matrix map
    const matrixKey = `${row},${col}`
    if (!matrixMap.has(matrixKey)) {
      matrixMap.set(matrixKey, [])
    }
    matrixMap.get(matrixKey)!.push(key)
  })

  // Now build rows and columns from the matrix map
  // Extract unique row and column indices
  const rowIndices = new Set<number>()
  const colIndices = new Set<number>()

  matrixMap.forEach((keys, matrixKey) => {
    const [row, col] = matrixKey.split(',').map(Number)
    rowIndices.add(row)
    colIndices.add(col)
  })

  // Sort indices
  const sortedRows = Array.from(rowIndices).sort((a, b) => a - b)
  const sortedCols = Array.from(colIndices).sort((a, b) => a - b)

  // Build row items
  rows.value = sortedRows.map((rowIndex, idx) => {
    const keysInRow: Key[] = []

    // Find all keys with this row index
    matrixMap.forEach((keys, matrixKey) => {
      const [row] = matrixKey.split(',').map(Number)
      if (row === rowIndex) {
        keysInRow.push(...keys)
      }
    })

    // Sort keys in row by column position (x coordinate)
    keysInRow.sort((a, b) => a.x - b.x)

    return {
      id: `row-${idx}-${Date.now()}`,
      index: idx,
      keySequence: keysInRow,
    }
  })

  // Build column items
  cols.value = sortedCols.map((colIndex, idx) => {
    const keysInCol: Key[] = []

    // Find all keys with this column index
    matrixMap.forEach((keys, matrixKey) => {
      const [, col] = matrixKey.split(',').map(Number)
      if (col === colIndex) {
        keysInCol.push(...keys)
      }
    })

    // Sort keys in column by row position (y coordinate)
    keysInCol.sort((a, b) => a.y - b.y)

    return {
      id: `col-${idx}-${Date.now()}`,
      index: idx,
      keySequence: keysInCol,
    }
  })

  // Apply coordinates immediately
  applyCoordinatesToKeys()
}

const handleClose = () => {
  // Simply close the modal without resetting - coordinates are already applied
  emit('cancel')
}

const handleCancel = () => {
  // This is only called from the close button in the header or warning step
  emit('cancel')
  resetState()
}

const resetState = () => {
  step.value = 'warning'
  rows.value = []
  cols.value = []
}

// Watch for modal visibility
watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) {
      // Modal width is 550px (see CSS), add some margin (20px) for safety
      const modalWidth = 550
      const margin = 20
      initializePosition({ x: window.innerWidth - modalWidth - margin, y: 100 })
      resetState()

      // If there are no labels, skip warning and go directly to drawing step
      if (!hasLabels.value) {
        step.value = 'draw'
      }
    }
  },
)

// Watch for annotation completion
let hasShownCompletionMessage = false
watch(
  () => isAnnotationComplete.value,
  (isComplete) => {
    if (isComplete && !hasShownCompletionMessage) {
      hasShownCompletionMessage = true
      // The completion message is already displayed in the UI
      // We could add additional effects here if needed
    }
    if (!isComplete) {
      hasShownCompletionMessage = false
    }
  },
)

// Close on Escape key
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    handleCancel()
  }
}

// Add/remove escape key listener when modal visibility changes
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.classList.add('modal-open')
    } else {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.classList.remove('modal-open')
    }
  },
)

onMounted(() => {
  if (props.visible) {
    document.addEventListener('keydown', handleKeyDown)
    document.body.classList.add('modal-open')
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  document.body.classList.remove('modal-open')
})

// Expose methods for parent component and overlay canvas
defineExpose({
  getCompletedRows: () => rows.value,
  getCompletedColumns: () => cols.value,
})
</script>

<style scoped>
.matrix-modal {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
  width: 550px;
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
  max-height: 600px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
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
.draw-section {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.draw-header {
  flex-shrink: 0;
}

.info-section {
  background: var(--bs-tertiary-bg);
  padding: 12px;
  border-radius: 6px;
  border-left: 4px solid var(--bs-primary);
}

/* Progress info styles */
.progress-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.progress-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  background: var(--bs-body-bg);
  border-radius: 4px;
  font-size: 0.85rem;
}

.progress-label {
  display: flex;
  align-items: center;
}

.progress-stats {
  font-size: 0.8rem;
}

.section-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  color: var(--bs-secondary-color);
}

.key-count {
  background: var(--bs-tertiary-bg);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 600;
  margin-left: 4px;
}

.active-group-info .alert {
  padding: 8px 12px;
  font-size: 0.875rem;
}

.empty-message {
  padding: 12px;
  text-align: center;
  color: var(--bs-secondary-color);
  font-size: 0.875rem;
  font-style: italic;
  background: var(--bs-tertiary-bg);
  border-radius: 4px;
  border: 1px dashed var(--bs-border-color);
}

/* Animation for button press feedback */
.btn:active {
  transform: translateY(1px);
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
</style>
