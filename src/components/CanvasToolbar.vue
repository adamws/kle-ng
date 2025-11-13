<template>
  <div ref="toolbarRef" class="canvas-toolbar" :style="{ width: toolbarColumns * 70 + 'px' }">
    <div
      class="toolbar-content"
      :style="{ gridTemplateColumns: `repeat(${toolbarColumns}, 50px)` }"
    >
      <!-- Two independent columns in 2-column mode -->
      <div v-if="toolbarColumns === 2" class="column-1-wrapper">
        <!-- Edit Operations -->
        <ToolbarEditSection
          ref="editSection1Ref"
          :show-special-keys-dropdown="showSpecialKeysDropdown"
          :special-keys="specialKeys"
          :can-delete="canDelete"
          @add-key="addKey"
          @toggle-special-keys="toggleSpecialKeysDropdown"
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
        ref="toolsSection1Ref"
        :canvas-mode="canvasMode"
        :can-use-move-exactly-tool="canUseMoveExactlyTool"
        :can-use-rotate-tool="canUseRotateTool"
        :can-use-mirror-tools="canUseMirrorTools"
        :show-mirror-dropdown="showMirrorDropdown"
        :show-extra-tools-dropdown="showExtraToolsDropdown"
        :extra-tools="extraTools"
        @set-mode="setMode"
        @toggle-mirror-dropdown="toggleMirrorDropdown"
        @select-mirror-mode="selectMirrorMode"
        @toggle-extra-tools="toggleExtraToolsDropdown"
        @execute-extra-tool="executeExtraTool"
      />

      <!-- Single column mode: all sections stacked -->
      <!-- Edit Operations -->
      <ToolbarEditSection
        v-if="toolbarColumns === 1"
        ref="editSection2Ref"
        :style="getSectionStyle(1)"
        :show-special-keys-dropdown="showSpecialKeysDropdown"
        :special-keys="specialKeys"
        :can-delete="canDelete"
        @add-key="addKey"
        @toggle-special-keys="toggleSpecialKeysDropdown"
        @add-special-key="addSpecialKey"
        @delete-keys="deleteKeys"
      />

      <!-- Tools (single column mode) -->
      <ToolbarToolsSection
        v-if="toolbarColumns === 1"
        ref="toolsSection2Ref"
        :style="getSectionStyle(2)"
        :canvas-mode="canvasMode"
        :can-use-move-exactly-tool="canUseMoveExactlyTool"
        :can-use-rotate-tool="canUseRotateTool"
        :can-use-mirror-tools="canUseMirrorTools"
        :show-mirror-dropdown="showMirrorDropdown"
        :show-extra-tools-dropdown="showExtraToolsDropdown"
        :extra-tools="extraTools"
        @set-mode="setMode"
        @toggle-mirror-dropdown="toggleMirrorDropdown"
        @select-mirror-mode="selectMirrorMode"
        @toggle-extra-tools="toggleExtraToolsDropdown"
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

  <!-- Matrix Coordinates Modal -->
  <MatrixCoordinatesModal
    ref="matrixModalRef"
    :visible="showMatrixModal"
    @apply="handleMatrixApply"
    @cancel="handleMatrixCancel"
  />
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useKeyboardStore } from '@/stores/keyboard'
import { SPECIAL_KEYS, type SpecialKeyTemplate } from '@/data/specialKeys'
import LegendToolsPanel from './LegendToolsPanel.vue'
import RotationOriginsPanel from './RotationOriginsPanel.vue'
import MatrixCoordinatesModal from './MatrixCoordinatesModal.vue'
import ToolbarEditSection from './ToolbarEditSection.vue'
import ToolbarToolsSection from './ToolbarToolsSection.vue'
import ToolbarHistorySection from './ToolbarHistorySection.vue'

// Store
const keyboardStore = useKeyboardStore()

// Component refs
const editSection1Ref = ref<InstanceType<typeof ToolbarEditSection> | null>(null)
const editSection2Ref = ref<InstanceType<typeof ToolbarEditSection> | null>(null)
const toolsSection1Ref = ref<InstanceType<typeof ToolbarToolsSection> | null>(null)
const toolsSection2Ref = ref<InstanceType<typeof ToolbarToolsSection> | null>(null)

// Special keys dropdown state
const showSpecialKeysDropdown = ref(false)
const specialKeys = SPECIAL_KEYS

// Mirror dropdown state
const showMirrorDropdown = ref(false)

// Extra tools dropdown
const showExtraToolsDropdown = ref(false)

// Legend tools panel
const showLegendToolsPanel = ref(false)

// Rotation origins panel
const showRotationOriginsPanel = ref(false)

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

const extraTools = computed((): ExtraTool[] => [
  {
    id: 'legend-tools',
    name: 'Legend Tools',
    description: 'Remove, align, and move legends on keys',
    disabled: false,
    action: () => {
      showLegendToolsPanel.value = true
    },
  },
  {
    id: 'add-matrix-coordinates',
    name: 'Add Switch Matrix Coordinates',
    description: 'Assign matrix coordinates for VIA - automatic or manual drawing',
    disabled: false,
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
    disabled: false,
    action: () => {
      showRotationOriginsPanel.value = true
    },
  },
])

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
  keyboardStore.addKey()
  requestCanvasFocus()
}

// Special keys functions
const toggleSpecialKeysDropdown = () => {
  if (showSpecialKeysDropdown.value) {
    // Hide dropdown
    showSpecialKeysDropdown.value = false
    return
  }

  // Get the active edit section ref based on current layout
  const editSectionRef = toolbarColumns.value === 2 ? editSection1Ref.value : editSection2Ref.value
  const dropdownBtnRef = editSectionRef?.dropdownBtnRef

  // Calculate position before showing dropdown
  if (dropdownBtnRef) {
    const buttonRect = dropdownBtnRef.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // Estimate dropdown dimensions (will be refined once rendered)
    const estimatedDropdownWidth = 150
    const estimatedDropdownHeight = Math.min(300, specialKeys.length * 32 + 40) // items + header

    // Calculate optimal position
    let left = buttonRect.right + 10 // Default: to the right
    let top = buttonRect.top // Default: align with button top

    // Check if dropdown would overflow viewport on the right
    if (left + estimatedDropdownWidth > viewportWidth) {
      // Position to the left of button instead
      left = buttonRect.left - estimatedDropdownWidth - 10
    }

    // Ensure dropdown doesn't overflow left edge
    if (left < 10) {
      left = 10
    }

    // Check if dropdown would overflow viewport on the bottom
    if (top + estimatedDropdownHeight > viewportHeight) {
      // Position above the button instead
      top = buttonRect.bottom - estimatedDropdownHeight
    }

    // Ensure dropdown doesn't overflow top edge
    if (top < 10) {
      top = 10
    }

    // Show dropdown first, then position it immediately
    showSpecialKeysDropdown.value = true

    // Use nextTick to ensure DOM is updated before positioning
    nextTick(() => {
      const dropdownRef = editSectionRef?.dropdownRef
      if (dropdownRef) {
        dropdownRef.style.left = `${left}px`
        dropdownRef.style.top = `${top}px`
        dropdownRef.style.opacity = '1'
      }
    })
  }
}

const addSpecialKey = (specialKey: SpecialKeyTemplate) => {
  // Add the special key without position data (x, y) - let the store handle positioning
  keyboardStore.addKey(specialKey.data)
  // Close the dropdown after selection
  showSpecialKeysDropdown.value = false
  requestCanvasFocus()
}

// Mirror dropdown functions
const toggleMirrorDropdown = () => {
  if (showMirrorDropdown.value) {
    // Hide dropdown
    showMirrorDropdown.value = false
    return
  }

  // Get the active tools section ref based on current layout
  const toolsSectionRef =
    toolbarColumns.value === 2 ? toolsSection1Ref.value : toolsSection2Ref.value
  const mirrorDropdownBtnRef = toolsSectionRef?.mirrorDropdownBtnRef

  // Calculate position before showing dropdown
  if (mirrorDropdownBtnRef) {
    const buttonRect = mirrorDropdownBtnRef.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // Estimate dropdown dimensions
    const estimatedDropdownWidth = 180
    const estimatedDropdownHeight = 100 // 2 items + header

    // Calculate optimal position
    let left = buttonRect.right + 10 // Default: to the right
    let top = buttonRect.top // Default: align with button top

    // Check if dropdown would overflow viewport on the right
    if (left + estimatedDropdownWidth > viewportWidth) {
      // Position to the left of button instead
      left = buttonRect.left - estimatedDropdownWidth - 10
    }

    // Ensure dropdown doesn't overflow left edge
    if (left < 10) {
      left = 10
    }

    // Check if dropdown would overflow viewport on the bottom
    if (top + estimatedDropdownHeight > viewportHeight) {
      // Position above the button instead
      top = buttonRect.bottom - estimatedDropdownHeight
    }

    // Ensure dropdown doesn't overflow top edge
    if (top < 10) {
      top = 10
    }

    // Show dropdown first, then position it immediately
    showMirrorDropdown.value = true

    // Use nextTick to ensure DOM is updated before positioning
    nextTick(() => {
      const mirrorDropdownRef = toolsSectionRef?.mirrorDropdownRef
      if (mirrorDropdownRef) {
        mirrorDropdownRef.style.left = `${left}px`
        mirrorDropdownRef.style.top = `${top}px`
        mirrorDropdownRef.style.opacity = '1'
      }
    })
  }
}

const selectMirrorMode = (mode: 'mirror-v' | 'mirror-h') => {
  setMode(mode)
  // Close the dropdown after selection
  showMirrorDropdown.value = false
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

// Extra tools functions
const toggleExtraToolsDropdown = () => {
  if (showExtraToolsDropdown.value) {
    // Hide dropdown
    showExtraToolsDropdown.value = false
    return
  }

  // Get the active tools section ref based on current layout
  const toolsSectionRef =
    toolbarColumns.value === 2 ? toolsSection1Ref.value : toolsSection2Ref.value
  const extraToolsBtnRef = toolsSectionRef?.extraToolsBtnRef

  // Calculate position before showing dropdown
  if (extraToolsBtnRef) {
    const buttonRect = extraToolsBtnRef.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // Estimate dropdown dimensions (will be refined once rendered)
    const estimatedDropdownWidth = 200
    const estimatedDropdownHeight = Math.min(300, extraTools.value.length * 32 + 40) // items + header

    // Calculate optimal position
    let left = buttonRect.right + 10 // Default: to the right
    let top = buttonRect.top // Default: align with button top

    // Check if dropdown would overflow viewport on the right
    if (left + estimatedDropdownWidth > viewportWidth) {
      // Position to the left of button instead
      left = buttonRect.left - estimatedDropdownWidth - 10
    }

    // Ensure dropdown doesn't overflow left edge
    if (left < 10) {
      left = 10
    }

    // Check if dropdown would overflow viewport on the bottom
    if (top + estimatedDropdownHeight > viewportHeight) {
      // Position above the button instead
      top = buttonRect.bottom - estimatedDropdownHeight
    }

    // Ensure dropdown doesn't overflow top edge
    if (top < 10) {
      top = 10
    }

    // Show dropdown first, then position it immediately
    showExtraToolsDropdown.value = true

    // Use nextTick to ensure DOM is updated before positioning
    nextTick(() => {
      const extraToolsDropdownRef = toolsSectionRef?.extraToolsDropdownRef
      if (extraToolsDropdownRef) {
        extraToolsDropdownRef.style.left = `${left}px`
        extraToolsDropdownRef.style.top = `${top}px`
        extraToolsDropdownRef.style.opacity = '1'
      }
    })
  }
}

const executeExtraTool = (tool: ExtraTool) => {
  // Execute the tool's action
  tool.action()
  // Close the dropdown after selection
  showExtraToolsDropdown.value = false
  requestCanvasFocus()
}

// Close dropdown when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  if (showSpecialKeysDropdown.value) {
    const target = event.target as Node
    const editSectionRef =
      toolbarColumns.value === 2 ? editSection1Ref.value : editSection2Ref.value
    const dropdownBtn = editSectionRef?.dropdownBtnRef
    const dropdown = editSectionRef?.dropdownRef

    if (dropdownBtn && !dropdownBtn.contains(target) && dropdown && !dropdown.contains(target)) {
      showSpecialKeysDropdown.value = false
    }
  }

  if (showMirrorDropdown.value) {
    const target = event.target as Node
    const toolsSectionRef =
      toolbarColumns.value === 2 ? toolsSection1Ref.value : toolsSection2Ref.value
    const dropdownBtn = toolsSectionRef?.mirrorDropdownBtnRef
    const dropdown = toolsSectionRef?.mirrorDropdownRef

    if (dropdownBtn && !dropdownBtn.contains(target) && dropdown && !dropdown.contains(target)) {
      showMirrorDropdown.value = false
    }
  }

  if (showExtraToolsDropdown.value) {
    const target = event.target as Node
    const toolsSectionRef =
      toolbarColumns.value === 2 ? toolsSection1Ref.value : toolsSection2Ref.value
    const dropdownBtn = toolsSectionRef?.extraToolsBtnRef
    const dropdown = toolsSectionRef?.extraToolsDropdownRef

    if (dropdownBtn && !dropdownBtn.contains(target) && dropdown && !dropdown.contains(target)) {
      showExtraToolsDropdown.value = false
    }
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)

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
  document.removeEventListener('click', handleClickOutside)

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
  color: var(--bs-secondary-color);
  transition: all 0.15s ease;
  padding: 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.tool-button:hover {
  background: var(--bs-secondary-bg);
  border-color: var(--bs-secondary-bg);
  color: var(--bs-secondary-color);
  transform: translateY(-1px);
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
  display: flex;
  align-items: center;
  justify-content: center;
}

.dropdown-btn:hover {
  transform: none; /* Override the translateY for the smaller button */
}

/* Special Keys Dropdown */
.special-keys-dropdown {
  position: fixed;
  background-color: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 6px;
  box-shadow: var(--bs-box-shadow);
  z-index: 10002; /* Above toasts (10001) */
  min-width: 150px;
  max-height: 300px;
  overflow-y: auto;
  transition: opacity 0.2s ease;
  /* Position will be calculated by JavaScript */
}

.dropdown-header {
  padding: 8px 12px;
  font-size: 10px;
  font-weight: 600;
  color: var(--bs-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--bs-border-color);
  background: var(--bs-tertiary-bg);
  border-radius: 6px 6px 0 0;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  background: none;
  border: none;
  font-size: 12px;
  color: var(--bs-secondary-color);
  cursor: pointer;
  transition: background-color 0.15s ease;
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

/* Mirror Dropdown */
.mirror-dropdown {
  position: fixed;
  background-color: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 6px;
  box-shadow: var(--bs-box-shadow);
  z-index: 10002; /* Above toasts (10001) */
  min-width: 180px;
  max-height: 300px;
  overflow-y: auto;
  transition: opacity 0.2s ease;
  /* Position will be calculated by JavaScript */
}

.mirror-dropdown .dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mirror-dropdown .dropdown-item.active {
  background: var(--bs-primary-bg-subtle);
  color: var(--bs-primary-text);
}

.mirror-dropdown .dropdown-item.active:hover {
  background: var(--bs-primary-bg-subtle);
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

/* Extra Tools Dropdown */
.extra-tools-dropdown {
  position: fixed;
  background-color: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 6px;
  box-shadow: var(--bs-box-shadow);
  z-index: 10002; /* Above toasts (10001) */
  min-width: 200px;
  max-height: 300px;
  overflow-y: auto;
  transition: opacity 0.2s ease;
  /* Position will be calculated by JavaScript */
}

.extra-tools-group {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Responsive adjustments */
@media (max-width: 768px) {
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

  .special-keys-dropdown {
    min-width: 120px;
  }
}
</style>
