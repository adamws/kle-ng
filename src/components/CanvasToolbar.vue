<template>
  <div class="canvas-toolbar">
    <!-- Edit Operations -->
    <div class="toolbar-section">
      <label class="section-label">Edit</label>
      <div class="tool-buttons">
        <!-- Add Key Button Group -->
        <div class="btn-group-vertical add-key-group">
          <button class="tool-button primary-add-btn" @click="addKey" title="Add Standard Key">
            <i class="bi bi-plus-circle"></i>
          </button>
          <button
            ref="dropdownBtnRef"
            class="tool-button dropdown-btn"
            @click="toggleSpecialKeysDropdown"
            title="Add Special Key"
          >
            <i class="bi bi-chevron-down"></i>
          </button>
        </div>

        <!-- Special Keys Dropdown -->
        <div
          v-if="showSpecialKeysDropdown"
          ref="dropdownRef"
          class="special-keys-dropdown"
          style="opacity: 0"
        >
          <div class="dropdown-header">Special Keys</div>
          <button
            v-for="specialKey in specialKeys"
            :key="specialKey.name"
            @click="addSpecialKey(specialKey)"
            class="dropdown-item"
            :title="specialKey.description"
          >
            {{ specialKey.name }}
          </button>
        </div>

        <button class="tool-button" @click="deleteKeys" :disabled="!canDelete" title="Delete Keys">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    </div>

    <!-- Tool Selection -->
    <div class="toolbar-section">
      <label class="section-label">Tools</label>
      <div class="tool-buttons">
        <button
          :class="{ 'tool-button': true, active: canvasMode === 'select' }"
          @click="setMode('select')"
          title="Selection Mode - Left click to select, middle drag to move"
        >
          <i class="bi bi-cursor"></i>
        </button>

        <button
          :class="{ 'tool-button': true, active: canvasMode === 'move-exactly' }"
          :disabled="!canUseMoveExactlyTool"
          @click="setMode('move-exactly')"
          title="Move Exactly - Move selected keys by exact X/Y values"
        >
          <i class="bi bi-arrows-move"></i>
        </button>

        <button
          :class="{ 'tool-button': true, active: canvasMode === 'rotate' }"
          :disabled="!canUseRotateTool"
          @click="setMode('rotate')"
          title="Rotate Selection"
        >
          <i class="bi bi-arrow-repeat"></i>
        </button>

        <button
          :class="{ 'tool-button': true, active: canvasMode === 'mirror-h' }"
          :disabled="!canUseMirrorTools"
          @click="setMode('mirror-h')"
          title="Mirror Horizontal"
        >
          <i class="bi bi-symmetry-horizontal"></i>
        </button>

        <button
          :class="{ 'tool-button': true, active: canvasMode === 'mirror-v' }"
          :disabled="!canUseMirrorTools"
          @click="setMode('mirror-v')"
          title="Mirror Vertical"
        >
          <i class="bi bi-symmetry-vertical"></i>
        </button>

        <!-- Extra Tools Dropdown -->
        <div class="btn-group-vertical extra-tools-group">
          <button
            ref="extraToolsBtnRef"
            class="tool-button"
            @click="toggleExtraToolsDropdown"
            title="Extra Tools"
          >
            <i class="bi bi-tools"></i>
          </button>
        </div>
      </div>

      <!-- Extra Tools Dropdown -->
      <div
        v-if="showExtraToolsDropdown"
        ref="extraToolsDropdownRef"
        class="extra-tools-dropdown"
        style="opacity: 0"
      >
        <div class="dropdown-header">Extra Tools</div>
        <button
          v-for="tool in extraTools"
          :key="tool.id"
          @click="executeExtraTool(tool)"
          class="dropdown-item"
          :title="tool.description"
          :disabled="tool.disabled"
        >
          {{ tool.name }}
        </button>
      </div>
    </div>

    <!-- History Operations -->
    <div class="toolbar-section">
      <label class="section-label">History</label>
      <div class="tool-buttons">
        <button class="tool-button" @click="undo" :disabled="!canUndo" title="Undo">
          <i class="bi bi-arrow-counterclockwise"></i>
        </button>

        <button class="tool-button" @click="redo" :disabled="!canRedo" title="Redo">
          <i class="bi bi-arrow-clockwise"></i>
        </button>
      </div>
    </div>
  </div>

  <!-- Legend Tools Panel -->
  <LegendToolsPanel :visible="showLegendToolsPanel" @close="showLegendToolsPanel = false" />
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useKeyboardStore } from '@/stores/keyboard'
import { SPECIAL_KEYS, type SpecialKeyTemplate } from '@/data/specialKeys'
import LegendToolsPanel from './LegendToolsPanel.vue'

// Store
const keyboardStore = useKeyboardStore()

// Special keys dropdown state
const showSpecialKeysDropdown = ref(false)
const specialKeys = SPECIAL_KEYS
const dropdownRef = ref<HTMLElement>()
const dropdownBtnRef = ref<HTMLElement>()

// Extra tools dropdown
const showExtraToolsDropdown = ref(false)
const extraToolsDropdownRef = ref<HTMLElement>()
const extraToolsBtnRef = ref<HTMLElement>()

// Legend tools panel
const showLegendToolsPanel = ref(false)

// Define extra tools
interface ExtraTool {
  id: string
  name: string
  description: string
  disabled?: boolean
  action: () => void
}

const extraTools: ExtraTool[] = [
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
    id: 'move-rotation-origins',
    name: 'Move rotation origins to key centers',
    description: 'Move rotation origins to key centers for selected keys',
    disabled: false,
    action: () => moveRotationsToKeyCenters(),
  },
]

// Computed properties from store
const canvasMode = computed(() => keyboardStore.canvasMode)
const canDelete = computed(() => keyboardStore.selectedKeys.length > 0)
const canUndo = computed(() => keyboardStore.canUndo)
const canRedo = computed(() => keyboardStore.canRedo)
const canUseMirrorTools = computed(() => keyboardStore.selectedKeys.length > 0)
const canUseRotateTool = computed(() => keyboardStore.selectedKeys.length > 0)
const canUseMoveExactlyTool = computed(() => keyboardStore.selectedKeys.length > 0)

// Methods

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

  // Calculate position before showing dropdown
  if (dropdownBtnRef.value) {
    const buttonRect = dropdownBtnRef.value.getBoundingClientRect()
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
      if (dropdownRef.value) {
        const dropdown = dropdownRef.value
        dropdown.style.left = `${left}px`
        dropdown.style.top = `${top}px`
        dropdown.style.opacity = '1'
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

// Debug functions
const moveRotationsToKeyCenters = () => {
  keyboardStore.moveRotationsToKeyCenters()
  requestCanvasFocus()
}

// Extra tools functions
const toggleExtraToolsDropdown = () => {
  if (showExtraToolsDropdown.value) {
    // Hide dropdown
    showExtraToolsDropdown.value = false
    return
  }

  // Calculate position before showing dropdown
  if (extraToolsBtnRef.value) {
    const buttonRect = extraToolsBtnRef.value.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // Estimate dropdown dimensions (will be refined once rendered)
    const estimatedDropdownWidth = 200
    const estimatedDropdownHeight = Math.min(300, extraTools.length * 32 + 40) // items + header

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
      if (extraToolsDropdownRef.value) {
        const dropdown = extraToolsDropdownRef.value
        dropdown.style.left = `${left}px`
        dropdown.style.top = `${top}px`
        dropdown.style.opacity = '1'
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
    const dropdownBtn = dropdownBtnRef.value
    const dropdown = dropdownRef.value

    if (dropdownBtn && !dropdownBtn.contains(target) && dropdown && !dropdown.contains(target)) {
      showSpecialKeysDropdown.value = false
    }
  }

  if (showExtraToolsDropdown.value) {
    const target = event.target as Node
    const dropdownBtn = extraToolsBtnRef.value
    const dropdown = extraToolsDropdownRef.value

    if (dropdownBtn && !dropdownBtn.contains(target) && dropdown && !dropdown.contains(target)) {
      showExtraToolsDropdown.value = false
    }
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.canvas-toolbar {
  width: 80px;
  min-width: 80px;
  background: var(--bs-tertiary-bg);
  border-right: 1px solid var(--bs-border-color);
  padding: 16px 10px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 1px 0 3px rgba(0, 0, 0, 0.1);
  container-type: inline-size;
}

.toolbar-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
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

/* Compact layout when toolbar height is constrained */
@container (max-height: 500px) {
  .canvas-toolbar {
    width: 160px;
    min-width: 160px;
    padding: 12px 8px;
    gap: 12px;
  }

  .toolbar-section {
    gap: 4px;
  }

  .tool-buttons {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    gap: 3px;
  }

  .tool-button {
    width: 34px;
    height: 34px;
  }

  .add-key-group {
    flex-direction: row;
    gap: 2px;
  }

  .primary-add-btn {
    border-radius: 6px 2px 2px 6px;
    border-right: 1px solid #adb5bd;
  }

  .dropdown-btn {
    height: 34px;
    width: 16px;
    border-radius: 2px 6px 6px 2px;
    border-left: none;
  }
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
  color: var(--bs-secondary);
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
  transform: translateY(-1px);
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
  z-index: 10000;
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
  color: var(--bs-secondary);
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

.dropdown-item:hover {
  background: var(--bs-tertiary-bg);
}

/* Extra Tools Dropdown */
.extra-tools-dropdown {
  position: fixed;
  background-color: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 6px;
  box-shadow: var(--bs-box-shadow);
  z-index: 10000;
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
