<template>
  <div
    v-if="visible"
    class="matrix-modal"
    data-testid="modal-matrix"
    ref="panelRef"
    :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
    @mousedown="handleMouseDown"
  >
    <div class="panel-content">
      <div class="panel-header" @mousedown="handleHeaderMouseDown">
        <div class="panel-title">
          <BiGripVertical class="me-2 drag-handle" />
          <BiGrid3x3 class="me-2" />
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
          <!-- Already Annotated - Success State (no duplicates) -->
          <div
            v-if="keyboardStore.isViaAnnotated && !keyboardStore.hasInvalidMatrixDuplicates"
            class="alert alert-success mb-3"
          >
            <div class="d-flex align-items-center gap-3">
              <BiCheckCircleFill class="text-success" style="min-width: 16px" />
              <div class="flex-grow-1">
                <h6 class="mb-2 text-success fw-bold">Layout Already Annotated</h6>
                <p class="mb-2 small">
                  This layout appears to already have VIA matrix coordinates. All keys have valid
                  "row,column" annotations in the top-left position.
                </p>
                <p class="mb-0 small">
                  <BiEye class="me-1" />
                  The matrix overlay is currently visible on the canvas showing the existing row and
                  column connections.
                </p>
              </div>
            </div>
          </div>

          <!-- Already Annotated - Warning State (has duplicates) -->
          <div
            v-if="keyboardStore.isViaAnnotated && keyboardStore.hasInvalidMatrixDuplicates"
            class="alert alert-warning mb-3"
          >
            <div class="d-flex align-items-center gap-3">
              <BiExclamationTriangleFill class="text-warning" style="min-width: 16px" />
              <div class="flex-grow-1">
                <h6 class="mb-2 text-warning fw-bold">Layout Annotated with Warnings</h6>
                <p class="mb-2 small">
                  This layout has VIA matrix coordinates, but
                  <strong>duplicate matrix positions</strong> were detected at:
                  <code>{{
                    keyboardStore.matrixDuplicateValidation.duplicatesWithoutOption
                      .map((d) => d.position)
                      .join(', ')
                  }}</code>
                </p>
                <p class="mb-2 small">
                  Per VIA spec, keys sharing a matrix position must have
                  <code>option,choice</code> labels in the bottom-right position (e.g., "0,0" and
                  "0,1") to distinguish layout variants.
                </p>
                <p class="mb-0 small">
                  <BiInfoCircle class="me-1" />
                  Either add option,choice labels to duplicate keys, or re-annotate to assign unique
                  positions.
                </p>
              </div>
            </div>
          </div>

          <!-- Information Section -->
          <div class="info-section mb-3">
            <div class="d-flex align-items-center gap-3">
              <BiInfoCircle class="text-primary" style="min-width: 16px" />
              <div>
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
                    class="icon-link align-items-baseline"
                  >
                    VIA Documentation
                    <BiBoxArrowUpRight aria-hidden="true" />
                  </a>
                </p>
              </div>
            </div>
          </div>

          <!-- Warning Message -->
          <div class="alert alert-warning mb-0">
            <div class="d-flex align-items-center gap-3">
              <BiExclamationTriangleFill class="text-warning" style="min-width: 16px" />
              <div>
                <h6 class="mb-2 text-warning fw-bold">
                  {{ isPartiallyAnnotated ? 'Continue Matrix Annotation' : 'Important Notice' }}
                </h6>
                <p class="mb-2 small">
                  <strong>{{
                    isPartiallyAnnotated
                      ? 'Partial annotation detected, choose your approach:'
                      : 'Proceeding will clear all existing labels'
                  }}</strong>
                </p>
                <ul class="mb-2 small" v-if="isPartiallyAnnotated">
                  <li><strong>Continue</strong>: Continue with existing matrix annotations</li>
                  <li><strong>Start over</strong>: Clear all labels and start fresh</li>
                  <li><strong>Cancel</strong>: Close this tool</li>
                </ul>
                <p class="mb-0 small">
                  The matrix coordinates will be placed in the top-left legend position (position 0)
                  on each key, following the VIA format standard.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Normalize Step -->
        <div v-if="step === 'normalize'">
          <div class="alert alert-warning mb-3">
            <div class="d-flex align-items-center gap-3">
              <BiExclamationTriangleFill class="text-warning" style="min-width: 16px" />
              <div>
                <h6 class="mb-2 text-warning fw-bold">Non-Standard Matrix Indices Detected</h6>
                <p class="mb-2 small">
                  This layout uses matrix indices that are not zero-based or have gaps.
                </p>
                <p class="mb-0 small">
                  <strong>Keep original</strong>: preserves your hand-configured indices exactly
                  as-is.<br />
                  <strong>Normalize</strong>: re-numbers rows and columns starting from 0.
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
                      <div class="progress-label gap-1">
                        <BiDiagram3 class="text-primary" />
                        <span class="fw-bold">Rows:</span>
                        <span class="ms-1">{{ rows.length }} defined</span>
                      </div>
                      <div class="progress-stats">
                        <span v-if="keysLeftForRows > 0" class="text-muted small">
                          {{ keysLeftForRows }} keys left
                        </span>
                        <span v-else class="text-success small d-flex align-items-center gap-1">
                          <BiCheckCircleFill />Complete
                        </span>
                      </div>
                    </div>
                    <div class="progress-item">
                      <div class="progress-label gap-1">
                        <BiDiagram2 class="text-success" />
                        <span class="fw-bold">Columns:</span>
                        <span class="ms-1">{{ cols.length }} defined</span>
                      </div>
                      <div class="progress-stats">
                        <span v-if="keysLeftForColumns > 0" class="text-muted small">
                          {{ keysLeftForColumns }} keys left
                        </span>
                        <span v-else class="text-success small d-flex align-items-center gap-1">
                          <BiCheckCircleFill />Complete
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Completion Message (only show if no duplicates from any source) -->
            <div
              v-if="
                isAnnotationComplete &&
                !annotationIssues &&
                !keyboardStore.hasInvalidMatrixDuplicates
              "
              class="alert alert-success mb-3"
            >
              <!-- Already Annotated (opened with existing annotations) -->
              <div v-if="isShowingExistingAnnotation" class="d-flex align-items-center gap-3">
                <BiCheckCircleFill class="text-success" style="min-width: 16px" />
                <div class="flex-grow-1">
                  <h6 class="mb-2 text-success fw-bold">Layout Already Annotated</h6>
                  <p class="mb-2 small">
                    This layout appears to already have VIA matrix coordinates. All keys have valid
                    "row,column" annotations in the top-left position.
                  </p>
                  <p class="mb-0 small">
                    <BiEye class="me-1" />
                    The matrix overlay is currently visible on the canvas showing the existing row
                    and column connections.
                  </p>
                </div>
              </div>
              <!-- Just Completed Annotation -->
              <div v-else class="d-flex align-items-center gap-3">
                <BiCheckCircleFill style="min-width: 16px" />
                <div class="flex-grow-1">
                  <strong>Annotation Complete!</strong>
                  <p class="mb-0 small">
                    All {{ totalRegularKeys }} keys have been assigned. Coordinates are applied
                    automatically. You can close the tool or continue editing.
                  </p>
                </div>
              </div>
            </div>

            <!-- Existing Duplicates Warning (from keyboard store - duplicates without option,choice) -->
            <div
              v-if="
                isAnnotationComplete &&
                !annotationIssues &&
                keyboardStore.hasInvalidMatrixDuplicates
              "
              class="alert alert-warning mb-3"
            >
              <div class="d-flex align-items-center gap-3">
                <BiExclamationTriangleFill class="text-warning" style="min-width: 16px" />
                <div class="flex-grow-1">
                  <h6 class="mb-2 text-warning fw-bold">Duplicate Matrix Positions Detected</h6>
                  <p class="mb-2 small">
                    All keys have matrix coordinates, but duplicate positions were found at:
                    <code>{{
                      keyboardStore.matrixDuplicateValidation.duplicatesWithoutOption
                        .map((d) => d.position)
                        .join(', ')
                    }}</code>
                  </p>
                  <p class="mb-0 small">
                    Per VIA spec, keys sharing a matrix position must have
                    <code>option,choice</code> labels in the bottom-right position. Either add
                    option,choice labels or re-annotate to assign unique positions.
                  </p>
                </div>
              </div>
            </div>

            <!-- Duplicate Warning Message (from automatic annotation) -->
            <div v-if="annotationIssues" class="alert alert-warning mb-3">
              <div class="d-flex align-items-center gap-3">
                <BiExclamationTriangleFill class="text-warning" style="min-width: 16px" />
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
                class="btn btn-outline-primary btn-sm w-100 d-flex align-items-center justify-content-center gap-1"
                @click="handleAutomaticAnnotation"
                @mousedown.stop
                title="Automatically assign matrix coordinates based on key positions"
              >
                <BiMagic class="me-1" />
                Annotate Automatically
              </button>
            </div>

            <!-- Drawing Type Toggle -->
            <div class="mb-3">
              <p class="mb-0 mt-1 small">Select editing mode:</p>
              <div class="btn-group w-100" role="group" aria-label="Drawing type selector">
                <button
                  type="button"
                  class="btn btn-sm btn-primary-outline d-flex align-items-center justify-content-center gap-1"
                  :class="drawingType === 'row' ? 'btn-draw-rows' : 'btn-outline-secondary'"
                  @click="setDrawingType('row')"
                  @mousedown.stop
                  title="Draw rows"
                >
                  <BiDiagram3 />
                  Draw Rows
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-primary-outline d-flex align-items-center justify-content-center gap-1"
                  :class="drawingType === 'column' ? 'btn-draw-columns' : 'btn-outline-secondary'"
                  @click="setDrawingType('column')"
                  @mousedown.stop
                  title="Draw columns"
                >
                  <BiDiagram2 />
                  Draw Columns
                </button>
                <button
                  type="button"
                  class="btn btn-sm d-flex align-items-center justify-content-center gap-1"
                  :class="drawingType === 'remove' ? 'btn-danger' : 'btn-outline-secondary'"
                  @click="setDrawingType('remove')"
                  @mousedown.stop
                  title="Remove elements"
                >
                  <BiTrash />
                  Remove
                </button>
              </div>
            </div>

            <!-- Clear Drawings Button -->
            <div class="mb-3">
              <button
                type="button"
                class="btn btn-outline-danger btn-sm w-100 d-flex align-items-center justify-content-center gap-1"
                @click="clearDrawings"
                @mousedown.stop
                :disabled="!hasDrawings"
              >
                <BiTrash />
                Clear All Drawings
              </button>
            </div>

            <!-- Drawing Instructions -->
            <div class="info-section-light mb-0">
              <h6 class="small fw-bold mb-2">
                <BiInfoCircle class="me-1" />
                Instructions
              </h6>
              <ul class="small mb-0 ps-3">
                <li>
                  <strong>Draw Rows/Columns Mode</strong>
                  <ul class="small mb-0 ps-3">
                    <li><strong>Left-click</strong> to start and complete segments</li>
                    <li><strong>Right-click or Escape</strong> to cancel while drawing</li>
                    <li><strong>Click existing wire</strong> to append/continue</li>
                  </ul>
                </li>
                <li>
                  <strong>Remove Mode:</strong>
                  <ul class="small mb-0 ps-3">
                    <li>Click on segment or nodes to delete</li>
                    <li>Hold <strong>ctrl</strong> to remove entire row/column</li>
                  </ul>
                </li>
                <li>
                  <strong>Change Row/Column number</strong>
                  <ul class="small mb-0 ps-3">
                    <li>Type new value while hovering over element</li>
                    <li><strong>Enter</strong> to confirm or <strong>Escape</strong> to cancel</li>
                  </ul>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div class="panel-footer">
        <!-- Close button (drawing step) -->
        <button
          v-if="step === 'draw'"
          type="button"
          class="btn btn-secondary btn-sm d-flex align-items-center gap-1"
          @click="handleClose"
          @mousedown.stop
          aria-label="Close"
        >
          <BiXCircle />
          Close
        </button>

        <!-- OK button (warning step) -->
        <button
          v-if="step === 'warning' && !isPartiallyAnnotated"
          type="button"
          class="btn btn-primary btn-sm d-flex align-items-center gap-1"
          @click="acceptWarning"
          @mousedown.stop
          aria-label="Ok"
        >
          <BiCheckCircle />
          OK (clear all labels)
        </button>

        <!-- Proceed without clearing button (warning step) - only show for partially annotated layouts -->
        <button
          v-if="step === 'warning' && isPartiallyAnnotated"
          type="button"
          class="btn btn-primary btn-sm d-flex align-items-center gap-1"
          @click="proceedWithoutClearing"
          @mousedown.stop
          aria-label="Continue"
        >
          <BiArrowRightCircle />
          Continue
        </button>

        <button
          v-if="step === 'warning' && isPartiallyAnnotated"
          type="button"
          class="btn btn-warning btn-sm"
          @click="acceptWarning"
          @mousedown.stop
          aria-label="Start over"
        >
          <BiArrowRightCircle class="me-1" />
          Start over
        </button>

        <!-- cancel button (warning step) -->
        <button
          v-if="step === 'warning'"
          type="button"
          class="btn btn-secondary btn-sm d-flex align-items-center gap-1"
          @click="handleCancel"
          @mousedown.stop
          aria-label="Cancel"
        >
          <BiXCircle />
          Cancel
        </button>

        <!-- normalize step: keep original indices -->
        <button
          v-if="step === 'normalize'"
          type="button"
          class="btn btn-primary btn-sm d-flex align-items-center gap-1"
          @click="keepOriginalIndices"
          @mousedown.stop
          aria-label="Keep original indices"
        >
          <BiCheckCircle />
          Keep original
        </button>

        <!-- normalize step: re-index from 0 -->
        <button
          v-if="step === 'normalize'"
          type="button"
          class="btn btn-warning btn-sm d-flex align-items-center gap-1"
          @click="normalizeAndProceed"
          @mousedown.stop
          aria-label="Normalize indices"
        >
          <BiArrowRightCircle />
          Normalize
        </button>

        <!-- normalize step: cancel -->
        <button
          v-if="step === 'normalize'"
          type="button"
          class="btn btn-secondary btn-sm d-flex align-items-center gap-1"
          @click="handleCancel"
          @mousedown.stop
          aria-label="Cancel normalization"
        >
          <BiXCircle />
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, toRaw } from 'vue'
import { useDraggablePanel } from '@/composables/useDraggablePanel'
import { useKeyboardStore, type Key } from '@/stores/keyboard'
import { useMatrixDrawingStore } from '@/stores/matrix-drawing'
import { createEmptyLabels } from '@/utils/array-helpers'
import {
  extractMatrixAssignments,
  extractMatrixAssignmentsWithPartial,
  parseViaLabelWithPartial,
} from '@/utils/matrix-utils'
import {
  clusterSymmetryAnnotationAlgorithm,
  buildRowsColsFromResult,
  type MatrixItem,
} from '@/utils/matrix-annotation'

import BiGripVertical from 'bootstrap-icons/icons/grip-vertical.svg'
import BiGrid3x3 from 'bootstrap-icons/icons/grid-3x3.svg'
import BiCheckCircleFill from 'bootstrap-icons/icons/check-circle-fill.svg'
import BiEye from 'bootstrap-icons/icons/eye.svg'
import BiExclamationTriangleFill from 'bootstrap-icons/icons/exclamation-triangle-fill.svg'
import BiInfoCircle from 'bootstrap-icons/icons/info-circle.svg'
import BiDiagram3 from 'bootstrap-icons/icons/diagram-3.svg'
import BiDiagram2 from 'bootstrap-icons/icons/diagram-2.svg'
import BiMagic from 'bootstrap-icons/icons/magic.svg'
import BiTrash from 'bootstrap-icons/icons/trash.svg'
import BiXCircle from 'bootstrap-icons/icons/x-circle.svg'
import BiCheckCircle from 'bootstrap-icons/icons/check-circle.svg'
import BiArrowRightCircle from 'bootstrap-icons/icons/arrow-right-circle.svg'
import BiBoxArrowUpRight from 'bootstrap-icons/icons/box-arrow-up-right.svg'

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

// State
const step = ref<'warning' | 'normalize' | 'draw'>('warning')
const rows = ref<MatrixItem[]>([])
const cols = ref<MatrixItem[]>([])
const hasRecordedPreModalState = ref(false)
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

// Check if layout is partially annotated (all keys have either empty labels or valid VIA annotations)
const isPartiallyAnnotated = computed(() => {
  const regularKeys = keyboardStore.keys.filter((key) => !key.decal && !key.ghost)

  // If no regular keys, consider it not annotated
  if (regularKeys.length === 0) return false

  // Check if all regular keys have either empty labels or valid VIA annotations
  return regularKeys.every((key) => {
    const label = key.labels?.[0]

    // Empty label is acceptable for partial annotation
    if (!label || label.trim() === '') return true

    // Check if it's a valid VIA annotation (complete or partial)
    const parsed = parseViaLabelWithPartial(label)
    return parsed !== null
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
  recordPreModalStateIfNeeded()
  // Hide the existing matrix overlay since we're about to remove all legends
  exitPreviewMode()

  // Remove all legends from regular keys only (skip decal/ghost keys)
  keyboardStore.keys.forEach((key) => {
    // Preserve labels on decal and ghost keys since they don't participate in wiring
    if (key.ghost || key.decal) return
    key.labels = createEmptyLabels()
  })

  step.value = 'draw'
  // Auto-enable drawing in row mode
  matrixDrawingStore.enableDrawing('row')
}

const proceedWithoutClearing = () => {
  // Go to drawing step without clearing existing labels
  // Parse existing labels and populate row/column state for continuation

  // Extract existing matrix assignments from current labels (including partial annotations)
  const { rows: existingRows, cols: existingCols } = extractMatrixAssignmentsWithPartial(
    keyboardStore.keys,
  )

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

  // Load existing assignments into the drawing store
  matrixDrawingStore.loadExistingAssignments(existingRows, existingCols)

  step.value = 'draw'
  // Auto-enable drawing in row mode
  matrixDrawingStore.enableDrawing('row')
}

// Record the pre-modal keyboard state exactly once per session so undo works
const recordPreModalStateIfNeeded = () => {
  if (!hasRecordedPreModalState.value) {
    keyboardStore.saveState()
    hasRecordedPreModalState.value = true
  }
}

// Compute the label that applyCoordinatesToKeys would assign to a key
const computeLabel = (key: Key, keyToRow: Map<Key, number>, keyToCol: Map<Key, number>): string => {
  const rowIndex = keyToRow.get(key)
  const colIndex = keyToCol.get(key)
  if (rowIndex !== undefined && colIndex !== undefined) return `${rowIndex},${colIndex}`
  if (rowIndex !== undefined) return `${rowIndex},`
  if (colIndex !== undefined) return `,${colIndex}`
  return ''
}

// Apply current coordinates to all keys.
// Only records a pre-modal undo snapshot when at least one label will actually change,
// so reopening an already-correct layout never pollutes the undo history.
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

  // Only snapshot state when something will actually change
  const willChange = keyboardStore.keys.some(
    (key) => !key.ghost && !key.decal && key.labels[0] !== computeLabel(key, keyToRow, keyToCol),
  )
  if (willChange) {
    recordPreModalStateIfNeeded()
  }

  // Apply labels to ALL keys (including partial assignments)
  keyboardStore.keys.forEach((key) => {
    if (key.ghost || key.decal) return
    key.labels[0] = computeLabel(key, keyToRow, keyToCol)
  })
}

const handleAutomaticAnnotation = () => {
  isShowingExistingAnnotation.value = false

  const rawKeys = keyboardStore.keys.map((k) => toRaw(k))
  const result = clusterSymmetryAnnotationAlgorithm.annotate(rawKeys)
  const { rows: newRows, cols: newCols } = buildRowsColsFromResult(result, keyboardStore.keys)
  rows.value = newRows
  cols.value = newCols

  matrixDrawingStore.clearDrawings()
  matrixDrawingStore.enableDrawing('row')
  rows.value.forEach((row) => {
    row.keySequence.forEach((key) => {
      matrixDrawingStore.addKeyToSequence(key)
    })
    matrixDrawingStore.completeSequence()
  })
  matrixDrawingStore.enableDrawing('column')
  cols.value.forEach((col) => {
    col.keySequence.forEach((key) => {
      matrixDrawingStore.addKeyToSequence(key)
    })
    matrixDrawingStore.completeSequence()
  })
  matrixDrawingStore.disableDrawing()

  applyCoordinatesToKeys()
  keyboardStore.saveState()
}

// Check whether the extracted row/column indices need normalization (non-zero-based or have gaps)
const indicesNeedNormalization = (
  existingRows: Map<number, Key[]>,
  existingCols: Map<number, Key[]>,
): boolean => {
  const hasGapOrOffset = (indices: number[]) => {
    if (indices.length === 0) return false
    const sorted = [...indices].sort((a, b) => a - b)
    return sorted[0] !== 0 || sorted.some((v, i) => i > 0 && v !== sorted[i - 1]! + 1)
  }
  return hasGapOrOffset([...existingRows.keys()]) || hasGapOrOffset([...existingCols.keys()])
}

const showExistingMatrixOverlay = (
  existingRows: Map<number, Key[]>,
  existingCols: Map<number, Key[]>,
) => {
  // Mark that we're showing pre-existing annotations
  isShowingExistingAnnotation.value = true

  // Convert the extracted Map<number, Key[]> to MatrixItem[] format, preserving original indices
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

  // Use loadExistingAssignments to preserve original indices in the drawing store.
  // This avoids re-indexing from 0 that completeSequence() would cause.
  matrixDrawingStore.clearDrawings()
  matrixDrawingStore.loadExistingAssignments(existingRows, existingCols)
}

// Proceed with original indices (user chose not to normalize)
const keepOriginalIndices = () => {
  // Drawing store and rows/cols already populated with original indices by showExistingMatrixOverlay.
  // Manually sync so rows.value/cols.value reflect the drawing store before entering draw step.
  step.value = 'draw'
  syncDrawingsToModal()
  matrixDrawingStore.enableDrawing('row')
}

// Re-index rows and columns starting from 0, then enter draw step
const normalizeAndProceed = () => {
  // Rebuild drawing store using completeSequence which auto-assigns 0-based indices.
  // rows.value/cols.value still hold the original indexed sequences at this point.
  matrixDrawingStore.clearDrawings()
  matrixDrawingStore.enableDrawing('row')
  rows.value.forEach((row) => {
    row.keySequence.forEach((key) => {
      matrixDrawingStore.addKeyToSequence(key)
    })
    matrixDrawingStore.completeSequence()
  })
  matrixDrawingStore.enableDrawing('column')
  cols.value.forEach((col) => {
    col.keySequence.forEach((key) => {
      matrixDrawingStore.addKeyToSequence(key)
    })
    matrixDrawingStore.completeSequence()
  })
  matrixDrawingStore.disableDrawing()
  // The watch on completedRows/completedColumns will fire after step becomes 'draw',
  // calling syncDrawingsToModal() + applyCoordinatesToKeys() with the new 0-based indices.
  step.value = 'draw'
  matrixDrawingStore.enableDrawing('row')
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
  // Note: 'normalize' step is a transient state; it resets to 'warning' on close
  rows.value = []
  cols.value = []
  isShowingExistingAnnotation.value = false
  annotationIssues.value = null
  hasRecordedPreModalState.value = false
  // Also stop any active drawing and clear drawings
  if (matrixDrawingStore.isDrawing) {
    matrixDrawingStore.disableDrawing()
  }
  matrixDrawingStore.clearDrawings()
}

// Drawing state and methods
const drawingType = ref<'row' | 'column' | 'remove'>('row')

// Computed
const hasDrawings = computed(() => matrixDrawingStore.hasDrawings)

const setDrawingType = (type: 'row' | 'column' | 'remove') => {
  // Set the drawing type
  drawingType.value = type
  // Always keep drawing enabled, just switch the type
  matrixDrawingStore.enableDrawing(type)
}

const clearDrawings = () => {
  // Mark that we're no longer showing existing annotations when user clears
  isShowingExistingAnnotation.value = false

  matrixDrawingStore.clearDrawings()
  // Also clear the modal's rows/cols that came from drawings
  syncDrawingsToModal()
}

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

      // Handle the five scenarios:
      // 1. Completely annotated layout WITH invalid duplicates → show warning step
      if (keyboardStore.isViaAnnotated && keyboardStore.hasInvalidMatrixDuplicates) {
        const { rows: existingRows, cols: existingCols } = extractMatrixAssignments(
          keyboardStore.keys,
        )
        showExistingMatrixOverlay(existingRows, existingCols)
        step.value = 'warning'
      }
      // 2. Completely annotated layout WITHOUT invalid duplicates
      else if (keyboardStore.isViaAnnotated) {
        const { rows: existingRows, cols: existingCols } = extractMatrixAssignments(
          keyboardStore.keys,
        )
        showExistingMatrixOverlay(existingRows, existingCols)
        if (indicesNeedNormalization(existingRows, existingCols)) {
          // Prompt the user before re-indexing their carefully chosen values
          step.value = 'normalize'
        } else {
          step.value = 'draw'
          // Auto-enable drawing in row mode
          matrixDrawingStore.enableDrawing('row')
        }
      }
      // 3. Not annotated (empty labels) → go directly to drawing
      else if (!hasLabels.value) {
        step.value = 'draw'
        // Auto-enable drawing in row mode
        matrixDrawingStore.enableDrawing('row')
      }
      // 4. Partially annotated layout → show choice (both OK and Proceed without clearing)
      else if (isPartiallyAnnotated.value) {
        step.value = 'warning'
      }
      // 5. Regular layout with non-matrix labels → show warning with only OK option
      else {
        step.value = 'warning'
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
    // If actively drawing a sequence, cancel it instead of closing the modal
    if (matrixDrawingStore.currentSequence.length > 0) {
      matrixDrawingStore.clearCurrentSequence()
    } else {
      // Only close modal if no active drawing sequence
      handleCancel()
    }
  }
}

// Add/remove escape key listener when modal visibility changes
watch(
  () => props.visible,
  (visible) => {
    // Update store state so overlay knows when modal is open
    matrixDrawingStore.setModalOpen(visible)

    if (visible) {
      // Reset drawing type to 'row' when modal opens
      setDrawingType('row')

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
@media (max-width: 767.98px) {
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

/* Responsive button layout for mobile */
@media (max-width: 575.98px) {
  .panel-footer {
    flex-direction: column;
    gap: 8px;
  }

  .panel-footer button {
    width: 100%;
  }
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

.info-section-light {
  background: var(--bs-tertiary-bg);
  padding: 12px;
  border-radius: 6px;
  border-left: 3px solid var(--bs-secondary);
}

.info-section-light ul {
  margin-bottom: 0;
}

.info-section-light li {
  margin-bottom: 4px;
}

.info-section-light li:last-child {
  margin-bottom: 0;
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

.active-group-info .alert {
  padding: 8px 12px;
  font-size: 0.875rem;
}

.btn-draw-rows {
  background: var(--bs-primary) !important;
}

.btn-draw-columns {
  background: var(--bs-primary) !important;
}

/* Drawing type toggle button group */
.btn-group > .btn {
  flex: 1;
}

.btn-group > .btn:focus {
  z-index: 1;
}

/* Responsive adjustments */
@media (max-width: 575.98px) {
  .matrix-modal {
    width: 100%;
  }

  .panel-body {
    padding: 12px;
  }
}
</style>
