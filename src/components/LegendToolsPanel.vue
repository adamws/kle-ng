<template>
  <div
    v-if="visible"
    class="legend-tools-panel"
    ref="panelRef"
    data-testid="legend-tools-panel"
    :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
    @mousedown="handleMouseDown"
  >
    <div class="panel-content">
      <div class="panel-header" @mousedown="handleHeaderMouseDown">
        <div class="panel-title" data-testid="panel-title">
          <i class="bi bi-grip-vertical me-2 drag-handle" data-testid="drag-handle"></i>
          <i class="bi bi-wrench me-2"></i>
          Legend Tools
        </div>
        <button
          type="button"
          class="btn-close"
          data-testid="panel-close-button"
          @click="handleClose"
          @mousedown.stop
          aria-label="Close"
        ></button>
      </div>

      <div class="panel-body">
        <!-- Tab Navigation -->
        <div class="tool-tabs mb-3">
          <div class="btn-group w-100" role="group">
            <input
              type="radio"
              class="btn-check"
              id="tab-edit"
              data-testid="tab-edit-input"
              value="edit"
              v-model="activeTab"
              autocomplete="off"
            />
            <label
              class="btn btn-outline-primary btn-sm"
              for="tab-edit"
              data-testid="tab-edit-label"
              >Edit</label
            >

            <input
              type="radio"
              class="btn-check"
              id="tab-remove"
              data-testid="tab-remove-input"
              value="remove"
              v-model="activeTab"
              autocomplete="off"
            />
            <label
              class="btn btn-outline-primary btn-sm"
              for="tab-remove"
              data-testid="tab-remove-label"
              >Remove</label
            >

            <input
              type="radio"
              class="btn-check"
              id="tab-align"
              data-testid="tab-align-input"
              value="align"
              v-model="activeTab"
              autocomplete="off"
            />
            <label
              class="btn btn-outline-primary btn-sm"
              for="tab-align"
              data-testid="tab-align-label"
              >Align</label
            >

            <input
              type="radio"
              class="btn-check"
              id="tab-move"
              data-testid="tab-move-input"
              value="move"
              v-model="activeTab"
              autocomplete="off"
            />
            <label
              class="btn btn-outline-primary btn-sm"
              for="tab-move"
              data-testid="tab-move-label"
              >Move</label
            >
          </div>
        </div>

        <!-- Edit Tab Content -->
        <div v-if="activeTab === 'edit'" class="tool-content" data-testid="edit-tab-content">
          <h6
            class="fw-bold text-center mb-2"
            style="font-size: 0.9rem; color: var(--bs-text-primary)"
          >
            Select Label Position to Edit
          </h6>

          <!-- Position Selector Grid -->
          <LabelPositionPicker
            v-model="activePosition"
            id-prefix="edit"
            size="small"
            class="mb-3"
          />

          <!-- Live Typing Preview - Always Visible -->
          <div class="info-section mb-3" data-testid="editing-alert">
            <div v-if="isEditing" class="status-label">
              <strong>Editing label:</strong> <code>{{ typedBuffer }}</code>
            </div>
            <div v-else-if="selectedKeysCount !== 0" class="status-label">
              <strong>Waiting for edit (start typing)</strong>
            </div>
            <div v-else class="status-label">
              <strong>Waiting for key selection</strong>
            </div>
            <div>
              <ul class="status-hint">
                <li>Select key(s) and start typing to edit</li>

                <li>Press <kbd>Enter</kbd> or select next key(s) to confirm label</li>
                <li>Press <kbd>Esc</kbd> to cancel</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Remove Legends Tab -->
        <div v-if="activeTab === 'remove'" class="tool-content" data-testid="remove-tab-content">
          <div class="mb-3">
            <div class="row g-2">
              <div v-for="category in legendCategories" :key="category.id" class="col-6">
                <button
                  type="button"
                  class="btn btn-outline-danger btn-sm w-100 d-flex align-items-center justify-content-between"
                  @click="removeLegends(category)"
                  :title="category.tooltip"
                  :data-testid="`category-button-${category.id}`"
                >
                  <span>{{ category.label }}</span>
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Align Legends Tab -->
        <div v-if="activeTab === 'align'" class="tool-content" data-testid="align-tab-content">
          <h6
            class="fw-bold text-center mb-2"
            style="font-size: 0.9rem; color: var(--bs-text-primary)"
          >
            Select Alignment Direction
          </h6>
          <div class="text-center mb-3">
            <AlignmentPicker @align="alignLegends" size="small" />
          </div>
          <div class="small text-muted">
            <ul class="mb-0">
              <li>Click an arrow to align legends in that direction</li>
              <li>Only affects non-decal keys</li>
            </ul>
          </div>
        </div>

        <!-- Move Legends Tab -->
        <div v-if="activeTab === 'move'" class="tool-content" data-testid="move-tab-content">
          <div class="row">
            <div class="col-5">
              <h6
                class="fw-bold text-center mb-2"
                style="font-size: 0.9rem; color: var(--bs-text-primary)"
              >
                From
              </h6>
              <LabelPositionPicker v-model="fromPosition" id-prefix="from" size="small" />
            </div>

            <div class="col-2 d-flex align-items-center justify-content-center">
              <button
                type="button"
                class="btn btn-outline-primary btn-sm"
                data-testid="move-button"
                @click="moveLegends"
                :disabled="!canMove"
                title="Move legends"
              >
                <span class="me-1">Move</span>
                <i class="bi bi-arrow-right"></i>
              </button>
            </div>

            <div class="col-5">
              <h6
                class="fw-bold text-center mb-2"
                style="font-size: 0.9rem; color: var(--bs-text-primary)"
              >
                To
              </h6>
              <LabelPositionPicker v-model="toPosition" id-prefix="to" size="small" />
            </div>
          </div>
          <div class="small text-muted mt-2">
            <ul class="mb-0">
              <li>Select source and destination positions</li>
              <li>Only moves when destination is empty</li>
            </ul>
          </div>
        </div>

        <!-- Status Info -->
        <div v-if="activeTab !== 'edit'" class="status-info mt-3">
          <div class="d-flex align-items-center gap-2">
            <small class="text-muted mb-0" data-testid="status-count">
              {{ selectedKeysCount }} key(s) will be affected
            </small>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useKeyboardStore, type Key } from '@/stores/keyboard'
import { useDraggablePanel } from '@/composables/useDraggablePanel'
import LabelPositionPicker from './LabelPositionPicker.vue'
import AlignmentPicker from './AlignmentPicker.vue'

// Props
interface Props {
  visible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
})

// Emits
interface Emits {
  (e: 'close'): void
}

const emit = defineEmits<Emits>()

const keyboardStore = useKeyboardStore()

// Local state
const activeTab = ref<'edit' | 'remove' | 'align' | 'move'>('edit')
const fromPosition = ref<number | null>(null)
const toPosition = ref<number | null>(null)

// Edit mode state
const activePosition = ref<number>(0) // Pre-select TL
const typedBuffer = ref<string>('')
const originalLabels = ref<Map<Key, string>>(new Map())
const isEditing = ref<boolean>(false)

// Dragging functionality with viewport bounds checking
const { position, panelRef, handleMouseDown, handleHeaderMouseDown, initializePosition } =
  useDraggablePanel({
    defaultPosition: { x: 100, y: 100 },
    margin: 10,
    headerHeight: 45, // Approximate height of the panel header
  })

// Legend categories for removal
interface LegendCategory {
  id: string
  label: string
  regex: RegExp
  tooltip: string
  isDecals?: boolean
}

const legendCategories: LegendCategory[] = [
  {
    id: 'all',
    label: 'All',
    regex: /.*/,
    tooltip: 'Remove all legends from selected keys. Does not affect decals.',
  },
  {
    id: 'alphas',
    label: 'Alphas',
    regex: /^[A-Za-z]$/,
    tooltip: 'Remove alphabetical legends (A-Z, a-z) from selected keys.',
  },
  {
    id: 'numbers',
    label: 'Numbers',
    regex: /^[0-9]*$/,
    tooltip: 'Remove numeric legends (0-9) from selected keys.',
  },
  {
    id: 'punctuation',
    label: 'Punctuation',
    regex: /^[`~!@#$%^&*()_=+\[\]{}|;':",./<>?\\-]+$/,
    tooltip: 'Remove punctuation legends (symbols, special characters) from selected keys.',
  },
  {
    id: 'function',
    label: 'Function',
    regex: /F\d\d?/,
    tooltip: 'Remove function key legends (F1, F2, etc.) from selected keys.',
  },
  {
    id: 'specials',
    label: 'Specials',
    regex: /<.*>/,
    tooltip: 'Remove special legends (FontAwesome, WebFont, images, etc.) from selected keys.',
  },
  {
    id: 'others',
    label: 'Others',
    regex: /^[^A-Za-z0-9`~!@#$%^&*()_=+\[\]{}|;':",./<>?\\-]$|^[A-Za-z\s][A-Za-z\s]+$|&#.*|&.*?;/,
    tooltip: 'Remove other legend types (multi-character text, entities, etc.) from selected keys.',
  },
  {
    id: 'decals',
    label: 'Decals',
    regex: /.*/,
    tooltip: 'Remove all legends from decal keys only.',
    isDecals: true,
  },
]

// Alignment flags and buttons
const align = {
  hmask: 0x0f,
  hcenter: 0x00,
  left: 0x01,
  right: 0x02,
  vmask: 0xf0,
  vcenter: 0x00,
  top: 0x10,
  bottom: 0x20,
  center: 0x00,
}

// Computed properties
const selectedKeysCount = computed(() => {
  if (activeTab.value === 'edit') {
    // Edit mode: Only show count of actually selected keys
    return keyboardStore.selectedKeys.length
  } else if (activeTab.value === 'remove') {
    return keyboardStore.selectedKeys.length > 0
      ? keyboardStore.selectedKeys.length
      : keyboardStore.keys.length
  } else {
    return keyboardStore.selectedKeys.length > 0
      ? keyboardStore.selectedKeys.filter((key) => !key.decal).length
      : keyboardStore.keys.filter((key) => !key.decal).length
  }
})

const canMove = computed(() => {
  return (
    fromPosition.value !== null &&
    toPosition.value !== null &&
    fromPosition.value !== toPosition.value
  )
})

// Methods
const removeLegends = (category: LegendCategory) => {
  const targetKeys =
    keyboardStore.selectedKeys.length > 0 ? keyboardStore.selectedKeys : keyboardStore.keys

  keyboardStore.saveToHistory()

  targetKeys.forEach((key) => {
    if (key.decal === !!category.isDecals) {
      for (let i = 0; i < 12; i++) {
        const label = key.labels[i]
        if (label && category.regex.test(label)) {
          key.labels[i] = ''
          // Clear text formatting too
          if (key.textColor && key.textColor[i]) {
            key.textColor[i] = ''
          }
          if (key.textSize && key.textSize[i]) {
            key.textSize[i] = 0
          }
        }
      }
    }
  })

  keyboardStore.markDirty()
}

const moveLabel = (key: Key, from: number, to: number) => {
  if (key.labels[from] && !key.labels[to]) {
    key.labels[to] = key.labels[from]
    key.labels[from] = ''

    if (key.textColor && key.textColor[from]) {
      key.textColor[to] = key.textColor[from]
      key.textColor[from] = ''
    }

    if (key.textSize && key.textSize[from]) {
      key.textSize[to] = key.textSize[from]
      key.textSize[from] = 0
    }
  }
}

const alignSingleRow = (
  key: Key,
  flags: number,
  left: number,
  middle: number,
  right: number,
): boolean => {
  let changed = false

  switch (flags) {
    case align.left:
      if (!key.labels[left] && key.labels[middle]) {
        moveLabel(key, middle, left)
        changed = true
      }
      if (!key.labels[left] && key.labels[right]) {
        moveLabel(key, right, left)
        changed = true
      }
      if (!key.labels[left] && key.labels[middle]) {
        moveLabel(key, middle, left)
        changed = true
      }
      break
    case align.right:
      if (!key.labels[right] && key.labels[middle]) {
        moveLabel(key, middle, right)
        changed = true
      }
      if (!key.labels[right] && key.labels[left]) {
        moveLabel(key, left, right)
        changed = true
      }
      if (!key.labels[right] && key.labels[middle]) {
        moveLabel(key, middle, right)
        changed = true
      }
      break
    case align.hcenter:
      if (key.labels[left] && !key.labels[middle] && !key.labels[right]) {
        moveLabel(key, left, middle)
        changed = true
      }
      if (key.labels[right] && !key.labels[middle] && !key.labels[left]) {
        moveLabel(key, right, middle)
        changed = true
      }
      break
  }

  return changed
}

const alignLegends = (flags: number) => {
  const targetKeys =
    keyboardStore.selectedKeys.length > 0
      ? keyboardStore.selectedKeys.filter((key) => !key.decal)
      : keyboardStore.keys.filter((key) => !key.decal)

  if (targetKeys.length === 0) return

  keyboardStore.saveToHistory()

  targetKeys.forEach((key) => {
    let changed = false

    // Process horizontal alignment for each row (0-2, 3-5, 6-8)
    for (let i = 0; i < 12; i += 3) {
      changed = alignSingleRow(key, flags & align.hmask, i, i + 1, i + 2) || changed
    }

    // Process vertical alignment for each column (0,3,6), (1,4,7), (2,5,8)
    if (flags & align.vmask) {
      for (let i = 0; i < 3; i++) {
        changed = alignSingleRow(key, (flags & align.vmask) >> 4, i, i + 3, i + 6) || changed
      }
    }
  })

  keyboardStore.markDirty()
}

const moveLegends = () => {
  if (!canMove.value) return

  const targetKeys =
    keyboardStore.selectedKeys.length > 0
      ? keyboardStore.selectedKeys.filter((key) => !key.decal)
      : keyboardStore.keys.filter((key) => !key.decal)

  if (targetKeys.length === 0) return

  keyboardStore.saveToHistory()

  targetKeys.forEach((key) => {
    moveLabel(key, fromPosition.value!, toPosition.value!)
  })

  keyboardStore.markDirty()
}

// Edit mode methods
const startEditing = () => {
  if (keyboardStore.selectedKeys.length === 0) return

  // Store original labels for ALL selected keys
  originalLabels.value.clear()
  keyboardStore.selectedKeys.forEach((key) => {
    const original = key.labels[activePosition.value] || ''
    originalLabels.value.set(key, original)
  })

  typedBuffer.value = ''
  isEditing.value = true
}

const updateAllLabelsLive = () => {
  if (!isEditing.value) return

  // Update ALL selected keys with current buffer
  keyboardStore.selectedKeys.forEach((key) => {
    key.labels[activePosition.value] = typedBuffer.value
  })

  // Trigger re-render
  keyboardStore.markDirty()
}

const finishEdit = (autoSelectNext: boolean = true) => {
  if (!isEditing.value) return

  // Save to history AFTER edits are done (enables undo)
  keyboardStore.saveToHistory()

  // Auto-select next key feature (only if requested)
  if (autoSelectNext && keyboardStore.selectedKeys.length === 1) {
    const currentKey = keyboardStore.selectedKeys[0]
    if (currentKey) {
      const currentIndex = keyboardStore.keys.indexOf(currentKey)

      // Select next key, wrap around to first if at end
      if (currentIndex >= 0 && keyboardStore.keys.length > 0) {
        const nextIndex = (currentIndex + 1) % keyboardStore.keys.length
        const nextKey = keyboardStore.keys[nextIndex]
        if (nextKey) {
          keyboardStore.selectKey(nextKey, false) // false = replace selection
        }
      }
    }
  }
  // If multiple keys selected, don't auto-advance (ambiguous which is "next")

  // Clear editing state
  isEditing.value = false
  originalLabels.value.clear()
  typedBuffer.value = ''

  // Keep activePosition selected for batch editing
}

const commitEdit = () => {
  finishEdit(true) // Commit with auto-select next
}

const cancelEdit = () => {
  if (!isEditing.value) return

  // Restore ALL original labels
  originalLabels.value.forEach((originalLabel, key) => {
    key.labels[activePosition.value] = originalLabel
  })

  // Trigger re-render to show restored labels
  keyboardStore.markDirty()

  // Clear editing state
  isEditing.value = false
  originalLabels.value.clear()
  typedBuffer.value = ''
}

const handleEditKeyDown = (event: KeyboardEvent) => {
  // Only handle when panel is visible
  if (!props.visible) return

  // Only handle when Edit tab active
  if (activeTab.value !== 'edit') return

  // Must have keys selected
  if (keyboardStore.selectedKeys.length === 0) return

  // Start editing on first printable keystroke (auto-start)
  if (
    !isEditing.value &&
    event.key.length === 1 &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  ) {
    startEditing()
  }

  // Only process if editing active
  if (!isEditing.value) return

  // Enter: Commit changes
  if (event.key === 'Enter') {
    commitEdit()
    event.preventDefault()
    event.stopPropagation()
    return
  }

  // Escape: Cancel and restore
  if (event.key === 'Escape') {
    cancelEdit()
    event.preventDefault()
    event.stopPropagation()
    return
  }

  // Backspace: Remove last character
  if (event.key === 'Backspace') {
    typedBuffer.value = typedBuffer.value.slice(0, -1)
    updateAllLabelsLive()
    event.preventDefault()
    event.stopPropagation()
    return
  }

  // Printable characters: Append to buffer and update
  if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    typedBuffer.value += event.key
    updateAllLabelsLive()
    event.preventDefault()
    event.stopPropagation()
    return
  }
}

const handleClose = () => {
  emit('close')
}

// Dragging functionality is now handled by the useDraggablePanel composable

// Keyboard shortcuts
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.visible) {
    handleClose()
  }
}

// Watch for modal visibility
watch(
  () => props.visible,
  async (isVisible) => {
    if (isVisible) {
      initializePosition({ x: window.innerWidth - 420, y: 100 })
      await nextTick()
    }
  },
)

// Watch for panel visibility to manage keyboard listener
watch(
  () => props.visible,
  (isVisible, wasVisible) => {
    // Add listener when panel becomes visible AND Edit tab is active
    if (isVisible && !wasVisible && activeTab.value === 'edit') {
      document.addEventListener('keydown', handleEditKeyDown, true)
    }

    // Remove listener when panel becomes hidden
    if (!isVisible && wasVisible) {
      document.removeEventListener('keydown', handleEditKeyDown, true)
      if (isEditing.value) {
        cancelEdit()
      }
    }
  },
  { immediate: false },
)

// Watch for tab changes to manage listener when panel is visible
watch(
  activeTab,
  (newTab, oldTab) => {
    // Only manage listener if panel is visible
    if (!props.visible) return

    // Add listener when switching TO Edit
    if (newTab === 'edit' && oldTab !== 'edit') {
      document.addEventListener('keydown', handleEditKeyDown, true)
    }

    // Remove listener when switching FROM Edit
    if (oldTab === 'edit' && newTab !== 'edit') {
      document.removeEventListener('keydown', handleEditKeyDown, true)
      if (isEditing.value) {
        cancelEdit()
      }
    }
  },
  { immediate: false },
)

// Watch for selection changes
watch(
  () => keyboardStore.selectedKeys,
  (newSelection, oldSelection) => {
    // If selection changes while editing, auto-commit current edit
    if (isEditing.value) {
      // Check if selection actually changed (not just array reference)
      const selectionChanged =
        newSelection.length !== oldSelection.length ||
        !newSelection.every((key) => oldSelection.includes(key))

      if (selectionChanged) {
        commitEdit()
      }
    }
  },
  { deep: true },
)

// Watch for position changes during editing
watch(activePosition, (newPosition, oldPosition) => {
  // If user changes position while editing, commit without auto-selecting next key
  if (isEditing.value && newPosition !== oldPosition) {
    finishEdit(false) // Commit but stay on same key(s)
  }
})

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('keydown', handleEditKeyDown, true)
})
</script>

<style scoped>
.legend-tools-panel {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
  width: 400px;
  user-select: none;
}

/* Mobile anchoring - similar to Key Properties panel */
@media (max-width: 767px) {
  .legend-tools-panel {
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

  .legend-tools-panel .panel-content {
    border-radius: 0 !important;
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
  }

  .legend-tools-panel .panel-body {
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
  overflow-y: auto;
}

.tool-tabs {
  padding-bottom: 8px;
}

.tool-content {
  min-height: 150px;
}

/* Info sections styling */
.info-section {
  background: var(--bs-tertiary-bg);
  padding: 12px;
  color: var(--bs-text-primary);
  border-radius: 6px;
  border-left: 4px solid var(--bs-primary);
}

.status-label {
  font-weight: 600;
  font-family: 'Courier New', monospace;
  font-size: 14px;
}

.status-hint {
  font-size: 12px;
}

/* Remove Legends Styles */
.btn-outline-danger:hover {
  box-shadow: 0 2px 4px rgba(220, 53, 69, 0.2);
}

/* Status Info */
.status-info {
  background: var(--bs-tertiary-bg);
  padding: 8px 12px;
  border-radius: 4px;
  border-left: 3px solid var(--bs-primary);
}

/* Responsive adjustments */
@media (max-width: 576px) {
  .legend-tools-panel {
    width: 320px;
  }

  .panel-body {
    padding: 10px;
  }
}

ul {
  margin-bottom: 0;
  padding-left: 1rem;
}
</style>
