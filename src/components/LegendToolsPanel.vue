<template>
  <div
    v-if="visible"
    class="legend-tools-panel"
    ref="panelRef"
    :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
    @mousedown="handleMouseDown"
  >
    <div class="panel-content">
      <div class="panel-header" @mousedown="handleHeaderMouseDown">
        <div class="panel-title">
          <i class="bi bi-grip-vertical me-2 drag-handle"></i>
          <i class="bi bi-wrench me-2"></i>
          Legend Tools
        </div>
        <button
          type="button"
          class="btn-close"
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
              id="tab-remove"
              value="remove"
              v-model="activeTab"
              autocomplete="off"
            />
            <label class="btn btn-outline-primary btn-sm" for="tab-remove">Remove</label>

            <input
              type="radio"
              class="btn-check"
              id="tab-align"
              value="align"
              v-model="activeTab"
              autocomplete="off"
            />
            <label class="btn btn-outline-primary btn-sm" for="tab-align">Align</label>

            <input
              type="radio"
              class="btn-check"
              id="tab-move"
              value="move"
              v-model="activeTab"
              autocomplete="off"
            />
            <label class="btn btn-outline-primary btn-sm" for="tab-move">Move</label>
          </div>
        </div>

        <!-- Remove Legends Tab -->
        <div v-if="activeTab === 'remove'" class="tool-content">
          <div class="mb-3">
            <div class="row g-2">
              <div v-for="category in legendCategories" :key="category.id" class="col-6">
                <button
                  type="button"
                  class="btn btn-outline-danger btn-sm w-100 d-flex align-items-center justify-content-between"
                  @click="removeLegends(category)"
                  :title="category.tooltip"
                >
                  <span>{{ category.label }}</span>
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Align Legends Tab -->
        <div v-if="activeTab === 'align'" class="tool-content">
          <div class="text-center mb-3">
            <div class="keycap-preview">
              <div class="keyborder"></div>
              <div class="keylabels">
                <div
                  v-for="(button, index) in alignmentButtons"
                  :key="index"
                  :class="['keylabel', `keylabel${index}`]"
                >
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-primary align-btn"
                    @click="alignLegends(button.flags)"
                    :title="button.tooltip"
                    v-html="button.label"
                  ></button>
                </div>
              </div>
            </div>
          </div>
          <div class="small text-muted">
            <ul class="mb-0">
              <li>Click an arrow to align legends in that direction</li>
              <li>Only affects non-decal keys</li>
            </ul>
          </div>
        </div>

        <!-- Move Legends Tab -->
        <div v-if="activeTab === 'move'" class="tool-content">
          <div class="row">
            <div class="col-5">
              <h6
                class="fw-bold text-center mb-2"
                style="font-size: 0.9rem; color: var(--bs-text-primary)"
              >
                From
              </h6>
              <div class="keycap-selector">
                <div class="keyborder"></div>
                <div class="keylabels">
                  <div
                    v-for="position in labelPositions"
                    :key="`from-${position.index}`"
                    :class="['keylabel', `keylabel${position.index}`]"
                  >
                    <input
                      type="radio"
                      :id="`from-${position.index}`"
                      :value="position.index"
                      v-model="fromPosition"
                      class="position-radio"
                    />
                    <label :for="`from-${position.index}`" class="position-label">
                      {{ position.label }}
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div class="col-2 d-flex align-items-center justify-content-center">
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm"
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
              <div class="keycap-selector">
                <div class="keyborder"></div>
                <div class="keylabels">
                  <div
                    v-for="position in labelPositions"
                    :key="`to-${position.index}`"
                    :class="['keylabel', `keylabel${position.index}`]"
                  >
                    <input
                      type="radio"
                      :id="`to-${position.index}`"
                      :value="position.index"
                      v-model="toPosition"
                      class="position-radio"
                    />
                    <label :for="`to-${position.index}`" class="position-label">
                      {{ position.label }}
                    </label>
                  </div>
                </div>
              </div>
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
        <div class="status-info mt-3">
          <div class="d-flex align-items-center gap-2">
            <small class="text-muted mb-0"> {{ selectedKeysCount }} key(s) will be affected </small>
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
const activeTab = ref<'remove' | 'align' | 'move'>('remove')
const fromPosition = ref<number | null>(null)
const toPosition = ref<number | null>(null)

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

interface AlignmentButton {
  label: string
  flags: number
  tooltip: string
}

const alignmentButtons: AlignmentButton[] = [
  { label: '↖', flags: align.left | align.top, tooltip: 'Align to top-left' },
  { label: '↑', flags: align.hcenter | align.top, tooltip: 'Align to top-center' },
  { label: '↗', flags: align.right | align.top, tooltip: 'Align to top-right' },
  { label: '←', flags: align.left | align.vcenter, tooltip: 'Align to center-left' },
  { label: '●', flags: align.hcenter | align.vcenter, tooltip: 'Align to center' },
  { label: '→', flags: align.right | align.vcenter, tooltip: 'Align to center-right' },
  { label: '↙', flags: align.left | align.bottom, tooltip: 'Align to bottom-left' },
  { label: '↓', flags: align.hcenter | align.bottom, tooltip: 'Align to bottom-center' },
  { label: '↘', flags: align.right | align.bottom, tooltip: 'Align to bottom-right' },
]

// Label positions for move tool
interface LabelPosition {
  index: number
  label: string
  description: string
}

const labelPositions: LabelPosition[] = [
  { index: 0, label: 'TL', description: 'Top Left' },
  { index: 1, label: 'TC', description: 'Top Center' },
  { index: 2, label: 'TR', description: 'Top Right' },
  { index: 3, label: 'CL', description: 'Center Left' },
  { index: 4, label: 'CC', description: 'Center Center' },
  { index: 5, label: 'CR', description: 'Center Right' },
  { index: 6, label: 'BL', description: 'Bottom Left' },
  { index: 7, label: 'BC', description: 'Bottom Center' },
  { index: 8, label: 'BR', description: 'Bottom Right' },
  { index: 9, label: 'FL', description: 'Front Left' },
  { index: 10, label: 'FC', description: 'Front Center' },
  { index: 11, label: 'FR', description: 'Front Right' },
]

// Computed properties
const selectedKeysCount = computed(() => {
  if (activeTab.value === 'remove') {
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

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
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
  max-height: 500px;
  overflow-y: auto;
}

.tool-tabs {
  border-bottom: 1px solid var(--bs-border-color);
  padding-bottom: 8px;
}

.tool-content {
  min-height: 180px;
}

/* Remove Legends Styles */
.btn-outline-danger:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(220, 53, 69, 0.2);
}

/* Align Legends Styles */
.keycap-preview {
  position: relative;
  width: 180px;
  height: 120px;
  margin: 0 auto;
  border-radius: 6px;
  background: var(--bs-secondary-bg);
  border: 2px solid var(--bs-border-color);
  box-shadow: 0 1px 3px var(--bs-box-shadow-sm);
}

.keyborder {
  position: absolute;
  inset: 4px;
  border-radius: 4px;
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color-translucent);
}

.keylabels {
  position: absolute;
  inset: 8px;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr 1fr 1fr;
  gap: 2px;
}

.keylabel {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.align-btn {
  width: 28px;
  height: 28px;
  font-size: 12px;
  font-weight: bold;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.align-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 4px rgba(13, 110, 253, 0.3);
}

/* Move Legends Styles */
.keycap-selector {
  position: relative;
  width: 140px;
  height: 105px;
  margin: 0 auto;
  border-radius: 6px;
  background: var(--bs-secondary-bg);
  border: 2px solid var(--bs-border-color);
  box-shadow: 0 1px 3px var(--bs-box-shadow-sm);
}

.keycap-selector .keyborder {
  inset: 3px;
}

.keycap-selector .keylabels {
  position: absolute;
  inset: 6px;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr 1fr 1fr 0.5fr;
  gap: 1px;
}

/* Explicit grid positioning for each label */
/* Top row */
.keylabel0 {
  grid-row: 1;
  grid-column: 1;
} /* Top Left */
.keylabel1 {
  grid-row: 1;
  grid-column: 2;
} /* Top Center */
.keylabel2 {
  grid-row: 1;
  grid-column: 3;
} /* Top Right */

/* Middle row */
.keylabel3 {
  grid-row: 2;
  grid-column: 1;
} /* Center Left */
.keylabel4 {
  grid-row: 2;
  grid-column: 2;
} /* Center Center */
.keylabel5 {
  grid-row: 2;
  grid-column: 3;
} /* Center Right */

/* Bottom row */
.keylabel6 {
  grid-row: 3;
  grid-column: 1;
} /* Bottom Left */
.keylabel7 {
  grid-row: 3;
  grid-column: 2;
} /* Bottom Center */
.keylabel8 {
  grid-row: 3;
  grid-column: 3;
} /* Bottom Right */

/* Front row */
.keylabel9 {
  grid-row: 4;
  grid-column: 1;
} /* Front Left */
.keylabel10 {
  grid-row: 4;
  grid-column: 2;
} /* Front Center */
.keylabel11 {
  grid-row: 4;
  grid-column: 3;
} /* Front Right */

.position-radio {
  position: absolute;
  top: 0;
  left: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  cursor: pointer;
  z-index: 1;
}

.position-label {
  font-size: 10px;
  font-weight: bold;
  color: var(--bs-text-primary);
  pointer-events: none;
  text-align: center;
  line-height: 1;
  position: relative;
  z-index: 2;
  padding: 2px 3px;
  border-radius: 3px;
  transition: all 0.15s ease;
}

.position-radio:checked + .position-label {
  color: white;
  background: var(--bs-primary);
  border-radius: 3px;
  padding: 2px 3px;
  box-shadow: 0 1px 3px rgba(13, 110, 253, 0.4);
  transform: scale(1.05);
}

.position-radio:hover + .position-label {
  color: var(--bs-primary);
  background: rgba(13, 110, 253, 0.15);
  border-radius: 3px;
  box-shadow: 0 1px 2px rgba(13, 110, 253, 0.2);
  transform: scale(1.02);
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

  .keycap-preview {
    width: 160px;
    height: 100px;
  }

  .keycap-selector {
    width: 120px;
    height: 90px;
  }
}

ul {
  margin-bottom: 0;
  padding-left: 1rem;
}

/* Animation for button press feedback */
.btn:active {
  transform: translateY(1px);
}
</style>
