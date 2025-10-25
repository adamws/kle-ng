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
                <p class="mb-2 small">
                  This layout appears to already have VIA matrix coordinates. All keys have valid
                  "row,column" annotations in the top-left position.
                </p>
                <p class="mb-0 small">
                  <i class="bi bi-eye me-1"></i>
                  The matrix overlay is currently visible on the canvas showing the existing row and
                  column connections.
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
            <div v-if="isAnnotationComplete && !annotationIssues" class="alert alert-success mb-3">
              <!-- Already Annotated (opened with existing annotations) -->
              <div v-if="isShowingExistingAnnotation" class="d-flex align-items-start gap-3">
                <i class="bi bi-check-circle-fill text-success" style="font-size: 1.5rem"></i>
                <div class="flex-grow-1">
                  <h6 class="mb-2 text-success fw-bold">Layout Already Annotated</h6>
                  <p class="mb-2 small">
                    This layout appears to already have VIA matrix coordinates. All keys have valid
                    "row,column" annotations in the top-left position.
                  </p>
                  <p class="mb-0 small">
                    <i class="bi bi-eye me-1"></i>
                    The matrix overlay is currently visible on the canvas showing the existing row
                    and column connections.
                  </p>
                </div>
              </div>
              <!-- Just Completed Annotation -->
              <div v-else class="d-flex align-items-center gap-2">
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

            <!-- Duplicate Warning Message -->
            <div v-if="annotationIssues" class="alert alert-warning mb-3">
              <div class="d-flex align-items-start gap-3">
                <i
                  class="bi bi-exclamation-triangle-fill text-warning"
                  style="font-size: 1.5rem"
                ></i>
                <div class="flex-grow-1">
                  <h6 class="mb-2 text-warning fw-bold">
                    Automatic Annotation Complete with Issues
                  </h6>
                  <p class="mb-2 small">
                    Matrix coordinates have been assigned to all {{ totalRegularKeys }} keys, but
                    {{ annotationIssues.duplicates.length }} duplicate position{{
                      annotationIssues.duplicates.length === 1 ? '' : 's'
                    }}
                    were found.
                  </p>
                  <p class="mb-2 small">
                    Only the first key in each duplicate position was assigned coordinates. You may
                    need to manually adjust the matrix coordinates for the affected keys.
                  </p>
                  <details class="mt-2">
                    <summary class="small fw-bold cursor-pointer">View duplicate positions</summary>
                    <div class="mt-2 small">
                      <div
                        v-for="dup in annotationIssues.duplicates"
                        :key="dup.position"
                        class="mb-2"
                      >
                        <strong>Position {{ dup.position }}:</strong> {{ dup.keys.length }} keys
                        <div class="ms-3 text-muted">
                          <div v-for="(key, keyIndex) in dup.keys" :key="keyIndex">
                            - Key #{{ keyboardStore.keys.indexOf(key) }}
                            {{ keyIndex === 0 ? '(kept)' : '(removed)' }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </details>
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

            <!-- Manual Drawing Controls -->
            <div class="manual-drawing-section mb-0">
              <div class="section-divider mb-2">
                <span class="divider-text">Manual Drawing</span>
              </div>
              <div class="drawing-controls">
                <div class="radio-group mb-2">
                  <label>
                    <input v-model="drawingType" type="radio" value="row" />
                    Row
                  </label>
                  <label>
                    <input v-model="drawingType" type="radio" value="column" />
                    Column
                  </label>
                </div>
                <div class="button-group">
                  <button
                    type="button"
                    class="btn btn-sm"
                    :class="drawingActive ? 'btn-success' : 'btn-outline-primary'"
                    @click="toggleDrawing"
                    @mousedown.stop
                  >
                    {{ drawingActive ? 'Stop' : 'Draw' }}
                    {{ drawingType === 'row' ? 'Rows' : 'Cols' }}
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline-danger btn-sm"
                    @click="clearDrawings"
                    @mousedown.stop
                    :disabled="!hasDrawings"
                  >
                    Clear Drawings
                  </button>
                </div>
              </div>
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
import { useMatrixDrawingStore } from '@/stores/matrix-drawing'
import { getKeyCenter } from '@/utils/keyboard-geometry'
import {
  extractMatrixAssignments,
  splitLayoutByRotation,
  deRotateLayoutGroups,
  restoreOriginalRotation,
} from '@/utils/matrix-utils'

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

// Stores
const keyboardStore = useKeyboardStore()
const matrixDrawingStore = useMatrixDrawingStore()

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
const isShowingExistingAnnotation = ref(false)
const annotationIssues = ref<{ duplicates: { position: string; keys: Key[] }[] } | null>(null)

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
  // Hide the existing matrix overlay since we're about to remove all legends
  exitPreviewMode()

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

const showDuplicateWarning = (duplicates: { position: string; keys: Key[] }[]) => {
  // Store annotation issues for display in preview
  annotationIssues.value = { duplicates }
}

const handleAutomaticAnnotation = () => {
  // Mark that we're NOT showing existing annotations anymore (user is creating new ones)
  isShowingExistingAnnotation.value = false

  // Check if we should use rotation-aware annotation
  const shouldUseRotationAwareAnnotation = () => {
    // Get all regular keys (non-ghost, non-decal)
    const regularKeys = keyboardStore.keys.filter((key) => !key.decal && !key.ghost)

    // Split layout into rotation groups
    const rotationGroups = splitLayoutByRotation(regularKeys)

    // Check if there's at least one non-0 rotated group with at least 2 elements
    return rotationGroups.some(
      (group) => Math.abs(group.rotationAngle) > 1e-6 && group.keys.length >= 2,
    )
  }

  // Utility function to check for duplicates and get detailed information
  const checkForDuplicates = (matrixMap: Map<string, Key[]>) => {
    const duplicates: { position: string; keys: Key[] }[] = []
    let hasDuplicates = false

    matrixMap.forEach((keys, position) => {
      if (keys.length > 1) {
        hasDuplicates = true
        duplicates.push({ position, keys })
      }
    })

    return { hasDuplicates, duplicates }
  }

  // Original automatic annotation algorithm
  const runAutomaticAnnotation = (keys: Key[]) => {
    // Create a map of matrix positions to keys
    const matrixMap = new Map<string, Key[]>()

    keys.forEach((key) => {
      // Skip decal and ghost keys (should already be filtered)
      if (key.decal || key.ghost) return

      // For matrix coordinates, we want to use the visual center position of the key
      // This accounts for rotation and ensures keys are assigned to the correct row/column
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

    const { hasDuplicates, duplicates } = checkForDuplicates(matrixMap)

    return { matrixMap, hasDuplicates, duplicates }
  }

  // Build rows and columns from the matrix map
  const buildMatrixFromMap = (matrixMap: Map<string, Key[]>) => {
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
  }

  // Get all regular keys (non-ghost, non-decal)
  const regularKeys = keyboardStore.keys.filter((key) => !key.decal && !key.ghost)

  if (shouldUseRotationAwareAnnotation()) {
    // Try rotation-aware annotation

    // Split layout into rotation groups
    const rotationGroups = splitLayoutByRotation(regularKeys)

    // De-rotate the layout
    const deRotatedKeys = deRotateLayoutGroups(rotationGroups)

    // Update the store with de-rotated keys temporarily
    keyboardStore.keys = deRotatedKeys

    // Run automatic annotation on de-rotated layout
    const { matrixMap: deRotatedMatrixMap, hasDuplicates: deRotatedHasDuplicates } =
      runAutomaticAnnotation(keyboardStore.keys)

    if (deRotatedHasDuplicates) {
      // Fallback to original approach if duplicates found

      // Restore original keys before falling back
      const restoredKeys = restoreOriginalRotation(keyboardStore.keys)
      keyboardStore.keys = restoredKeys

      // Try original layout
      const {
        matrixMap: originalMatrixMap,
        hasDuplicates: originalHasDuplicates,
        duplicates: originalDuplicates,
      } = runAutomaticAnnotation(regularKeys)

      if (originalHasDuplicates) {
        // Both approaches produced duplicates - remove duplicates and issue warning

        // Remove duplicates by keeping only the first key in each position
        const cleanMatrixMap = new Map<string, Key[]>()
        originalMatrixMap.forEach((keys, position) => {
          cleanMatrixMap.set(position, [keys[0]]) // Keep only the first key
        })

        buildMatrixFromMap(cleanMatrixMap)

        // Show warning to user
        showDuplicateWarning(originalDuplicates)
      } else {
        // Original layout works fine
        buildMatrixFromMap(originalMatrixMap)
      }
    } else {
      // Successfully annotated de-rotated layout, now restore original rotation
      buildMatrixFromMap(deRotatedMatrixMap)

      // Restore original rotation but keep the annotations
      const restoredKeys = restoreOriginalRotation(keyboardStore.keys)

      // Update the store with restored rotation but keep the matrix assignments
      keyboardStore.keys = restoredKeys
      keyboardStore.saveState()
    }
  } else {
    // Use original approach
    const { matrixMap, hasDuplicates } = runAutomaticAnnotation(regularKeys)

    if (hasDuplicates) {
      // Remove duplicates silently - this is the fallback approach

      const cleanMatrixMap = new Map<string, Key[]>()
      matrixMap.forEach((keys, position) => {
        cleanMatrixMap.set(position, [keys[0]]) // Keep only the first key
      })

      buildMatrixFromMap(cleanMatrixMap)
      // No warning shown here - this is expected behavior for fallback
    } else {
      buildMatrixFromMap(matrixMap)
    }
  }

  // Sync to store so overlay can render the lines
  matrixDrawingStore.clearDrawings()

  // Add rows - need to enable row mode first
  matrixDrawingStore.enableDrawing('row')
  rows.value.forEach((row) => {
    row.keySequence.forEach((key) => {
      matrixDrawingStore.addKeyToSequence(key)
    })
    matrixDrawingStore.completeSequence()
  })

  // Switch to column mode for adding columns
  matrixDrawingStore.enableDrawing('column')
  cols.value.forEach((col) => {
    col.keySequence.forEach((key) => {
      matrixDrawingStore.addKeyToSequence(key)
    })
    matrixDrawingStore.completeSequence()
  })
  matrixDrawingStore.disableDrawing()

  // Apply coordinates immediately
  applyCoordinatesToKeys()
}

const showExistingMatrixOverlay = () => {
  // Mark that we're showing pre-existing annotations
  isShowingExistingAnnotation.value = true

  // Extract existing matrix assignments from the already annotated layout
  const { rows: existingRows, cols: existingCols } = extractMatrixAssignments(keyboardStore.keys)

  // Convert the extracted Map<number, Key[]> to MatrixItem[] format
  rows.value = Array.from(existingRows.entries())
    .sort(([a], [b]) => a - b) // Sort by row index
    .map(([index, keySequence]) => ({
      id: `row-${index}-${Date.now()}`,
      index,
      keySequence,
    }))

  cols.value = Array.from(existingCols.entries())
    .sort(([a], [b]) => a - b) // Sort by column index
    .map(([index, keySequence]) => ({
      id: `col-${index}-${Date.now()}`,
      index,
      keySequence,
    }))

  // Sync to matrixDrawingStore so the canvas overlay renders automatically
  matrixDrawingStore.clearDrawings()

  // Add rows
  matrixDrawingStore.enableDrawing('row')
  rows.value.forEach((row) => {
    row.keySequence.forEach((key) => {
      matrixDrawingStore.addKeyToSequence(key)
    })
    matrixDrawingStore.completeSequence()
  })

  // Add columns
  matrixDrawingStore.enableDrawing('column')
  cols.value.forEach((col) => {
    col.keySequence.forEach((key) => {
      matrixDrawingStore.addKeyToSequence(key)
    })
    matrixDrawingStore.completeSequence()
  })
  matrixDrawingStore.disableDrawing()
}

const exitPreviewMode = () => {
  // Clear the matrix drawing store to hide the overlay
  matrixDrawingStore.clearDrawings()
}

const handleClose = () => {
  // Close the modal and clear drawings (but keep labels on keys)
  // Stop drawing if active
  if (matrixDrawingStore.isDrawing) {
    matrixDrawingStore.disableDrawing()
  }
  // Clear the store drawings so overlay hides
  matrixDrawingStore.clearDrawings()

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
  isShowingExistingAnnotation.value = false
  annotationIssues.value = null
  // Also stop any active drawing and clear drawings
  if (matrixDrawingStore.isDrawing) {
    matrixDrawingStore.disableDrawing()
  }
  matrixDrawingStore.clearDrawings()
}

// Drawing state and methods
const drawingType = ref<'row' | 'column'>('row')

// Use computed to directly reference store state
const drawingActive = computed(() => matrixDrawingStore.isDrawing)
const hasDrawings = computed(() => matrixDrawingStore.hasDrawings)

const toggleDrawing = () => {
  if (matrixDrawingStore.isDrawing) {
    // Disable drawing
    matrixDrawingStore.disableDrawing()
  } else {
    // Enable drawing
    matrixDrawingStore.enableDrawing(drawingType.value)
  }
}

const clearDrawings = () => {
  // Mark that we're no longer showing existing annotations when user clears
  isShowingExistingAnnotation.value = false

  matrixDrawingStore.clearDrawings()
  // Also clear the modal's rows/cols that came from drawings
  syncDrawingsToModal()
}

// Watch drawing type changes - update if already drawing
watch(drawingType, (newType) => {
  if (matrixDrawingStore.isDrawing) {
    matrixDrawingStore.enableDrawing(newType)
  }
})

// Sync completed drawings from store to modal's rows/cols
const syncDrawingsToModal = () => {
  const drawings = matrixDrawingStore.getCompletedDrawings()

  // Convert completed rows Map to MatrixItems array
  rows.value = Array.from(drawings.rows.entries())
    .sort(([a], [b]) => a - b) // Sort by row number
    .map(([rowNumber, keySequence]) => ({
      id: `row-${rowNumber}-${Date.now()}`,
      index: rowNumber,
      keySequence,
    }))

  // Convert completed columns Map to MatrixItems array
  cols.value = Array.from(drawings.columns.entries())
    .sort(([a], [b]) => a - b) // Sort by column number
    .map(([colNumber, keySequence]) => ({
      id: `col-${colNumber}-${Date.now()}`,
      index: colNumber,
      keySequence,
    }))
}

// Watch for changes in store's completed drawings and sync to modal
// Watch both size changes AND content changes (for row/column continuation)
watch(
  () => [
    matrixDrawingStore.completedRows.size,
    matrixDrawingStore.completedColumns.size,
    // Also watch the total number of keys across all rows/columns to detect additions
    Array.from(matrixDrawingStore.completedRows.values()).reduce((sum, row) => sum + row.length, 0),
    Array.from(matrixDrawingStore.completedColumns.values()).reduce(
      (sum, col) => sum + col.length,
      0,
    ),
  ],
  () => {
    // Only sync and apply if modal is visible AND in draw step
    // Don't apply in warning step - labels should only be cleared when user clicks OK
    if (!props.visible || step.value !== 'draw') return

    syncDrawingsToModal()

    // Skip coordinate application if removal just happened (context menu)
    // The removal handler already updated the labels appropriately
    if (matrixDrawingStore.skipNextSync) {
      matrixDrawingStore.skipNextSync = false
      return
    }

    // Apply coordinates immediately after syncing to show labels while drawing
    // This is safe because applyCoordinatesToKeys only modifies key.labels,
    // which doesn't affect the store's completedRows/completedColumns arrays
    applyCoordinatesToKeys()
  },
)

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

      // If the layout is already annotated, show the matrix overlay and skip to draw step
      if (keyboardStore.isViaAnnotated) {
        showExistingMatrixOverlay()
        step.value = 'draw'
      } else if (!hasLabels.value) {
        // If there are no labels, skip warning and go directly to drawing step
        step.value = 'draw'
      }
    } else {
      // Hide matrix overlay when modal closes
      exitPreviewMode()
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
      // Apply coordinates when annotation is complete
      applyCoordinatesToKeys()
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

/* Manual drawing section */
.manual-drawing-section {
  background: var(--bs-tertiary-bg);
  padding: 12px;
  border-radius: 6px;
  border-left: 4px solid var(--bs-success);
}

.section-divider {
  position: relative;
  text-align: center;
  margin-bottom: 8px;
}

.section-divider::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  background: var(--bs-border-color);
}

.divider-text {
  position: relative;
  background: var(--bs-tertiary-bg);
  padding: 0 8px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--bs-secondary-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.drawing-controls {
  display: flex;
  flex-direction: column;
}

.radio-group {
  display: flex;
  gap: 12px;
}

.radio-group label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.875rem;
  cursor: pointer;
  user-select: none;
}

.radio-group input[type='radio'] {
  cursor: pointer;
  margin: 0;
}

.button-group {
  display: flex;
  gap: 6px;
}

.button-group button {
  flex: 1;
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
