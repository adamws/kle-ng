<template>
  <div
    ref="toolbarRef"
    class="canvas-toolbar"
    data-testid="canvas-toolbar"
    :style="{ width: toolbarColumns * 70 + 'px' }"
  >
    <div
      class="toolbar-content"
      :style="{ gridTemplateColumns: `repeat(${toolbarColumns}, 50px)` }"
    >
      <!-- Two independent columns in 2-column mode -->
      <div v-if="toolbarColumns === 2" class="column-1-wrapper">
        <!-- Edit Operations -->
        <ToolbarEditSection
          :special-keys="specialKeys"
          :can-delete="canDelete"
          @add-key="addKey"
          @add-special-key="addSpecialKey"
          @delete-keys="deleteKeys"
        />

        <!-- History Operations (in column 1 with Edit) -->
        <div style="padding-top: 5px">
          <ToolbarHistorySection
            :can-undo="canUndo"
            :can-redo="canRedo"
            @undo="undo"
            @redo="redo"
          />
        </div>
      </div>

      <!-- Tools in column 2 (2-column mode) -->
      <ToolbarToolsSection
        v-if="toolbarColumns === 2"
        :canvas-mode="canvasMode"
        :can-use-move-exactly-tool="canUseMoveExactlyTool"
        :can-use-rotate-tool="canUseRotateTool"
        :can-use-mirror-tools="canUseMirrorTools"
        :extra-tools="extraTools"
        @set-mode="setMode"
        @select-mirror-mode="selectMirrorMode"
        @execute-extra-tool="executeExtraTool"
      />

      <!-- Single column mode: all sections stacked -->
      <!-- Edit Operations -->
      <ToolbarEditSection
        v-if="toolbarColumns === 1"
        :style="getSectionStyle(1)"
        :special-keys="specialKeys"
        :can-delete="canDelete"
        @add-key="addKey"
        @add-special-key="addSpecialKey"
        @delete-keys="deleteKeys"
      />

      <!-- Tools (single column mode) -->
      <ToolbarToolsSection
        v-if="toolbarColumns === 1"
        :style="getSectionStyle(2)"
        :canvas-mode="canvasMode"
        :can-use-move-exactly-tool="canUseMoveExactlyTool"
        :can-use-rotate-tool="canUseRotateTool"
        :can-use-mirror-tools="canUseMirrorTools"
        :extra-tools="extraTools"
        @set-mode="setMode"
        @select-mirror-mode="selectMirrorMode"
        @execute-extra-tool="executeExtraTool"
      />

      <!-- History Operations (single column mode) -->
      <ToolbarHistorySection
        v-if="toolbarColumns === 1"
        :style="getSectionStyle(3)"
        :can-undo="canUndo"
        :can-redo="canRedo"
        @undo="undo"
        @redo="redo"
      />
    </div>
  </div>

  <!-- Legend Tools Panel -->
  <LegendToolsPanel :visible="showLegendToolsPanel" @close="showLegendToolsPanel = false" />

  <!-- Rotation Origins Panel -->
  <RotationOriginsPanel
    :visible="showRotationOriginsPanel"
    @close="showRotationOriginsPanel = false"
  />

  <!-- Theme Tools Panel -->
  <ThemeToolsPanel :visible="showThemeToolsPanel" @close="showThemeToolsPanel = false" />

  <!-- Matrix Coordinates Modal -->
  <MatrixCoordinatesModal
    ref="matrixModalRef"
    :visible="showMatrixModal"
    @apply="handleMatrixApply"
    @cancel="handleMatrixCancel"
  />
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useKeyboardStore } from '@/stores/keyboard'
import { SPECIAL_KEYS, type SpecialKeyTemplate } from '@/data/specialKeys'
import LegendToolsPanel from './LegendToolsPanel.vue'
import RotationOriginsPanel from './RotationOriginsPanel.vue'
import ThemeToolsPanel from './ThemeToolsPanel.vue'
import MatrixCoordinatesModal from './MatrixCoordinatesModal.vue'
import ToolbarEditSection from './ToolbarEditSection.vue'
import ToolbarToolsSection from './ToolbarToolsSection.vue'
import ToolbarHistorySection from './ToolbarHistorySection.vue'

// Store
const keyboardStore = useKeyboardStore()

// Special keys data
const specialKeys = SPECIAL_KEYS

// Legend tools panel
const showLegendToolsPanel = ref(false)

// Rotation origins panel
const showRotationOriginsPanel = ref(false)

// Theme tools panel
const showThemeToolsPanel = ref(false)

// Matrix coordinates modal
const showMatrixModal = ref(false)
const matrixModalRef = ref<InstanceType<typeof MatrixCoordinatesModal> | null>(null)

// Toolbar responsive layout
const toolbarRef = ref<HTMLElement>()
const toolbarColumns = ref(1)
const resizeObserverRef = ref<ResizeObserver>()

// Define extra tools
interface ExtraTool {
  id: string
  name: string
  description: string
  disabled?: boolean
  action: () => void
}

const extraTools = computed((): ExtraTool[] => {
  const isPreview = keyboardStore.isLayoutPreviewMode
  return [
    {
      id: 'legend-tools',
      name: 'Legend Tools',
      description: 'Remove, align, and move legends on keys',
      disabled: isPreview,
      action: () => {
        showLegendToolsPanel.value = true
      },
    },
    {
      id: 'add-matrix-coordinates',
      name: 'Add Switch Matrix Coordinates',
      description: 'Assign matrix coordinates for VIA - automatic or manual drawing',
      disabled: isPreview,
      action: () => {
        showMatrixModal.value = true
      },
    },
    {
      id: 'move-rotation-origins',
      name: 'Move Rotation Origins',
      description:
        keyboardStore.selectedKeys.length === 0
          ? 'Move rotation origins for all keys'
          : 'Move rotation origins for selected keys',
      disabled: isPreview,
      action: () => {
        showRotationOriginsPanel.value = true
      },
    },
    {
      id: 'theme-tools',
      name: 'Theme Tools',
      description: 'Apply color themes to keys',
      disabled: isPreview,
      action: () => {
        showThemeToolsPanel.value = true
      },
    },
  ]
})

// Computed properties from store
const canvasMode = computed(() => keyboardStore.canvasMode)
const canDelete = computed(() => keyboardStore.selectedKeys.length > 0)
const canUndo = computed(() => keyboardStore.canUndo)
const canRedo = computed(() => keyboardStore.canRedo)
const canUseMirrorTools = computed(() => keyboardStore.selectedKeys.length > 0)
const canUseRotateTool = computed(() => keyboardStore.selectedKeys.length > 0)
const canUseMoveExactlyTool = computed(() => keyboardStore.selectedKeys.length > 0)

// Methods

// Get grid positioning for each section based on column count (only used in single-column mode)
const getSectionStyle = (sectionIndex: number) => {
  // Single column mode: all sections stacked vertically
  return {
    gridColumn: '1',
    gridRow: `${sectionIndex}`,
  }
}

// Helper function to request canvas focus
const requestCanvasFocus = () => {
  window.dispatchEvent(new CustomEvent('request-canvas-focus'))
}

const setMode = (mode: 'select' | 'mirror-h' | 'mirror-v' | 'rotate' | 'move-exactly') => {
  keyboardStore.setCanvasMode(mode)
  requestCanvasFocus()
}

// Key editing functions
const addKey = () => {
  if (keyboardStore.isLayoutPreviewMode) return
  keyboardStore.addKey()
  requestCanvasFocus()
}

const addSpecialKey = (specialKey: SpecialKeyTemplate) => {
  if (keyboardStore.isLayoutPreviewMode) return
  keyboardStore.addKey(specialKey.data)
  requestCanvasFocus()
}

const selectMirrorMode = (mode: 'mirror-v' | 'mirror-h') => {
  setMode(mode)
  requestCanvasFocus()
}

const deleteKeys = () => {
  keyboardStore.deleteKeys()
  requestCanvasFocus()
}

// History functions
const undo = () => {
  keyboardStore.undo()
  requestCanvasFocus()
}

const redo = () => {
  keyboardStore.redo()
  requestCanvasFocus()
}

// Matrix coordinates functions
const handleMatrixApply = () => {
  showMatrixModal.value = false
  requestCanvasFocus()
}

const handleMatrixCancel = () => {
  showMatrixModal.value = false
}

const executeExtraTool = (tool: ExtraTool) => {
  tool.action()
  requestCanvasFocus()
}

onMounted(() => {
  // Setup ResizeObserver to switch between layouts based on available height
  if (toolbarRef.value) {
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const availableHeight = entry.contentRect.height
      if (availableHeight < 530) {
        toolbarColumns.value = 2
      } else {
        toolbarColumns.value = 1
      }
    })
    resizeObserver.observe(toolbarRef.value)

    // Store observer for cleanup
    resizeObserverRef.value = resizeObserver
  }
})

onUnmounted(() => {
  // Cleanup ResizeObserver
  if (resizeObserverRef.value) {
    resizeObserverRef.value.disconnect()
  }
})
</script>

<style>
.canvas-toolbar {
  background: var(--bs-tertiary-bg);
  border-right: 1px solid var(--bs-border-color);
  box-shadow: 1px 0 3px rgba(0, 0, 0, 0.1);
  align-self: stretch;
  transition: width 0.2s ease;
}

.toolbar-content {
  display: grid;
  grid-auto-rows: min-content;
  gap: 16px 20px;
  padding: 16px 10px;
  align-content: start;
  justify-items: center;
}

/* Column 1 wrapper for 2-column mode: flex container for Edit + History */
.column-1-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
}

.toolbar-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  width: 60px;
}

.section-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
  text-align: center;
  width: 100%;
}

/* Tool Buttons */
.tool-buttons {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  width: 100%;
}

.tool-button {
  width: 38px;
  height: 38px;
  border: 1px solid var(--bs-border-color);
  border-radius: 6px;
  background-color: var(--bs-body-bg);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  padding: 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.tool-button:hover {
  background: var(--bs-secondary-bg);
  border-color: var(--bs-secondary-bg);
  color: var(--bs-secondary-color);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.tool-button.active {
  background: var(--bs-primary);
  border-color: var(--bs-primary);
  color: var(--bs-primary-text, white);
  box-shadow: 0 2px 6px rgba(0, 123, 255, 0.3);
}

.tool-button:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.tool-button:disabled {
  background: var(--bs-tertiary-bg);
  border-color: var(--bs-secondary-bg);
  color: var(--bs-border-color);
  cursor: not-allowed;
}

.tool-button:disabled:hover {
  background: var(--bs-tertiary-bg);
  border-color: var(--bs-secondary-bg);
  color: var(--bs-border-color);
}

/* Add Key Button Group Styles */
.add-key-group {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.primary-add-btn {
  border-radius: 6px 6px 2px 2px;
}

.dropdown-btn {
  height: 16px;
  max-height: 16px;
  border-radius: 0px 0px 6px 6px;
  border-top: none;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  background: none;
  border: none;
  font-size: 12px;
  cursor: pointer;
}

.dropdown-item:hover:not(.disabled) {
  background: var(--bs-tertiary-bg);
}

.dropdown-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  color: var(--bs-secondary-color-emphasis);
  background-color: var(--bs-secondary-bg);
}

.dropdown-item.disabled:hover {
  background-color: var(--bs-secondary-bg);
}

/* Mirror Button Group */
.mirror-group {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.primary-mirror-btn {
  border-radius: 6px 6px 2px 2px;
}

/* Responsive adjustments */
@media (max-width: 767.98px) {
  .canvas-toolbar {
    width: 72px;
    min-width: 72px;
    padding: 12px 8px;
    gap: 14px;
  }

  .tool-button {
    width: 34px;
    height: 34px;
  }

  .section-label {
    font-size: 9px;
  }
}
</style>
