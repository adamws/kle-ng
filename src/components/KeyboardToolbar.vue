<template>
  <div class="toolbar-container keyboard-toolbar">
    <!-- Right side: Presets, Import/Export -->
    <div
      class="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-2 gap-sm-3 justify-content-sm-end"
    >
      <!-- Presets -->
      <div>
        <select v-model="selectedPreset" @change="loadPreset" class="form-select preset-select">
          <option value="" disabled>Choose Preset...</option>
          <option v-for="(preset, index) in availablePresets" :key="index" :value="index">
            {{ preset.name }}
          </option>
        </select>
      </div>

      <!-- Import/Export/Share buttons -->
      <div class="btn-group" role="group">
        <button class="btn btn-secondary" @click="triggerFileUpload" type="button">
          <span class="d-none d-sm-inline">Import JSON File</span>
          <span class="d-inline d-sm-none">Import</span>
        </button>

        <div class="btn-group position-relative">
          <button
            ref="exportBtnRef"
            class="btn btn-success dropdown-toggle"
            @click="toggleExportDropdown"
            type="button"
          >
            Export
          </button>
          <div
            v-if="showExportDropdown"
            ref="exportDropdownRef"
            class="custom-dropdown-menu"
            style="opacity: 0"
          >
            <button @click="handleExportAction(downloadJson)" class="dropdown-item">
              Download JSON
            </button>
            <button @click="handleExportAction(downloadKleInternalJson)" class="dropdown-item">
              Download KLE Internal JSON
            </button>
            <button @click="handleExportAction(downloadPng)" class="dropdown-item">
              Download PNG
            </button>
          </div>
        </div>

        <button class="btn btn-primary" @click="shareLayout" type="button">
          <span class="d-none d-sm-inline">Share Link</span>
          <span class="d-inline d-sm-none">Share</span>
        </button>
      </div>
    </div>

    <!-- Hidden file input for imports -->
    <input
      ref="fileInput"
      type="file"
      accept=".json"
      @change="handleFileUpload"
      style="display: none"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useKeyboardStore } from '@/stores/keyboard'
import presetsMetadata from '@/data/presets.json'
import { parseJsonString } from '@/utils/serialization'
import { toast } from '@/composables/useToast'

// Store
const keyboardStore = useKeyboardStore()

// Component state
const selectedPreset = ref('')
const availablePresets = ref<{ name: string; file: string }[]>([])
const fileInput = ref<HTMLInputElement>()

// Dropdown state
const showExportDropdown = ref(false)
const exportDropdownRef = ref<HTMLElement>()
const exportBtnRef = ref<HTMLElement>()

// Load presets on mount and setup event listeners
onMounted(() => {
  availablePresets.value = presetsMetadata.presets || []
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Actions

const loadPreset = async () => {
  if (selectedPreset.value === '') return

  const presetIndex = parseInt(selectedPreset.value)
  const preset = availablePresets.value[presetIndex]

  console.log('Loading preset:', preset?.name)

  if (preset) {
    try {
      // Fetch the preset file from public directory (with correct base path)
      const response = await fetch(`${import.meta.env.BASE_URL}data/presets/${preset.file}`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const presetData = await response.json()

      // Load KLE format data
      keyboardStore.loadKLELayout(presetData)
      console.log('Preset loaded successfully:', preset.name, 'Keys:', keyboardStore.keys.length)
    } catch (error) {
      console.error('Error loading preset:', error)
      toast.showError(`Failed to load ${preset.name}`, 'Error loading preset')
    }
  }
}

// Import functions
const triggerFileUpload = () => {
  fileInput.value?.click()
}

import type { Key, KeyboardMetadata } from '@/stores/keyboard'

// Define a type for the internal KLE format
interface InternalKleFormat {
  meta: KeyboardMetadata
  keys: Key[]
}

// Format detection helper
const isInternalKleFormat = (data: unknown): data is InternalKleFormat => {
  return (
    typeof data === 'object' &&
    data !== null &&
    'meta' in data &&
    'keys' in data &&
    Array.isArray((data as Record<string, unknown>).keys)
  )
}

const handleFileUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  try {
    const text = await file.text()
    const data = parseJsonString(text)

    // Auto-detect format and load accordingly
    if (isInternalKleFormat(data)) {
      // Internal KLE format with meta and keys
      console.log(`Loading internal KLE format from: ${file.name}`)
      keyboardStore.loadLayout(data.keys, data.meta)
      toast.showSuccess(`Internal KLE layout loaded from ${file.name}`, 'Import successful')
    } else {
      // Raw KLE format (array-based)
      console.log(`Loading raw KLE format from: ${file.name}`)
      keyboardStore.loadKLELayout(data)
      toast.showSuccess(`KLE layout loaded from ${file.name}`, 'Import successful')
    }
  } catch (error) {
    console.error('Error loading file:', error)
    toast.showError(
      `${error instanceof Error ? error.message : 'Invalid JSON'}`,
      'Error loading file',
    )
  } finally {
    // Clear the input
    input.value = ''
  }
}

// Export functions
const downloadJson = () => {
  const data = keyboardStore.getSerializedData('kle')
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${keyboardStore.metadata.name || 'keyboard-layout'}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const downloadKleInternalJson = () => {
  const data = keyboardStore.getSerializedData('kle-internal')
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${keyboardStore.metadata.name || 'keyboard-layout'}-internal.json`
  a.click()
  URL.revokeObjectURL(url)
}

const downloadPng = () => {
  try {
    // Find the canvas element from the keyboard canvas component
    const canvas = document.querySelector('.keyboard-canvas') as HTMLCanvasElement
    if (!canvas) {
      toast.showError('Please make sure the keyboard is visible.', 'Canvas not found')
      return
    }

    // Create a download link
    const link = document.createElement('a')
    link.download = `${keyboardStore.metadata.name || 'keyboard-layout'}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()

    console.log('PNG export completed')
    toast.showSuccess('PNG image downloaded successfully')
  } catch (error) {
    console.error('Error exporting PNG:', error)
    toast.showError('Please try again.', 'Error exporting PNG')
  }
}

// Dropdown positioning functions
const calculateDropdownPosition = (buttonRef: HTMLElement) => {
  const buttonRect = buttonRef.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  // Estimate dropdown dimensions
  const estimatedDropdownWidth = 200
  const estimatedDropdownHeight = 120 // 3 items + padding

  // Calculate optimal position
  let left = buttonRect.left // Default: align with button left
  let top = buttonRect.bottom + 5 // Default: below button

  // Check if dropdown would overflow viewport on the right
  if (left + estimatedDropdownWidth > viewportWidth - 10) {
    // Align to right edge of button instead
    left = buttonRect.right - estimatedDropdownWidth
  }

  // Ensure dropdown doesn't overflow left edge
  if (left < 10) {
    left = 10
  }

  // Check if dropdown would overflow viewport on the bottom
  if (top + estimatedDropdownHeight > viewportHeight - 10) {
    // Position above the button instead
    top = buttonRect.top - estimatedDropdownHeight - 5
  }

  // Ensure dropdown doesn't overflow top edge
  if (top < 10) {
    top = buttonRect.bottom + 5 // Force below if no room above
  }

  return { left, top }
}

const toggleExportDropdown = () => {
  if (showExportDropdown.value) {
    showExportDropdown.value = false
    return
  }

  if (exportBtnRef.value) {
    const { left, top } = calculateDropdownPosition(exportBtnRef.value)

    showExportDropdown.value = true

    nextTick(() => {
      if (exportDropdownRef.value) {
        exportDropdownRef.value.style.left = `${left}px`
        exportDropdownRef.value.style.top = `${top}px`
        exportDropdownRef.value.style.opacity = '1'
      }
    })
  }
}

const handleExportAction = (action: () => void) => {
  action()
  showExportDropdown.value = false
}

// Share function
const shareLayout = async () => {
  try {
    const shareUrl = keyboardStore.generateShareUrl()

    // Copy to clipboard if available
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(shareUrl)
      toast.showSuccess(
        'The shareable link has been copied to your clipboard. Share it with others to let them view your layout!',
        'Link copied successfully!',
      )
    } else {
      // Fallback: show the URL in a custom toast with longer duration
      toast.showInfo(
        'Copy this link to share your layout: ' + shareUrl,
        'Shareable Link Generated',
        {
          duration: 10000, // 10 seconds for manual copying
          showCloseButton: true,
        },
      )
    }

    console.log('Share URL generated:', shareUrl)
  } catch (error) {
    console.error('Error generating share link:', error)
    toast.showError('Please try again.', 'Error generating share link')
  }
}

// Close dropdowns when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node

  if (showExportDropdown.value) {
    const exportBtn = exportBtnRef.value
    const exportDropdown = exportDropdownRef.value

    if (
      exportBtn &&
      !exportBtn.contains(target) &&
      exportDropdown &&
      !exportDropdown.contains(target)
    ) {
      showExportDropdown.value = false
    }
  }
}
</script>

<style scoped>
/* Bootstrap CSS provides all the styling, minimal custom overrides needed */
.toolbar-container {
  min-height: 38px;
}

.preset-select {
  width: 200px;
  flex-shrink: 0;
}

/* Mobile responsive adjustments */
@media (max-width: 575.98px) {
  .preset-select {
    width: 100%;
  }

  /* Make buttons more compact to fit in one row */
  .btn-group .btn {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    white-space: nowrap;
  }
}

@media (max-width: 320px) {
  .btn-group .btn {
    font-size: 0.7rem;
    padding: 0.2rem 0.4rem;
  }
}

.gap-3 {
  gap: 1rem !important;
}

.status-display {
  white-space: nowrap;
}

.key-count {
  display: inline-block;
  width: 3ch;
  text-align: right;
}

/* Custom Dropdown Styles */
.custom-dropdown-menu {
  position: fixed;
  background: white;
  border: 1px solid var(--bs-border-color);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10000;
  min-width: 180px;
  max-height: 300px;
  overflow-y: auto;
  transition: opacity 0.2s ease;
  padding: 4px 0;
}

.custom-dropdown-menu .dropdown-item {
  display: block;
  width: 100%;
  padding: 8px 16px;
  text-align: left;
  background: none;
  border: none;
  font-size: 14px;
  color: #495057;
  cursor: pointer;
  transition: background-color 0.15s ease;
  text-decoration: none;
}

.custom-dropdown-menu .dropdown-item:hover {
  background: var(--bs-tertiary-bg);
}

.custom-dropdown-menu .dropdown-item:active {
  background-color: #e9ecef;
}
</style>
