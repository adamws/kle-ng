<template>
  <div class="toolbar-container keyboard-toolbar" data-testid="panel-toolbar-container">
    <!-- Right side: Presets, Import/Export -->
    <div
      class="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-2 gap-sm-3 justify-content-sm-end"
    >
      <!-- Presets -->
      <div class="dropdown preset-dropdown">
        <button
          class="btn btn-outline-primary dropdown-toggle preset-select"
          type="button"
          data-bs-toggle="dropdown"
          aria-expanded="false"
        >
          {{ selectedPresetName || 'Choose Preset...' }}
        </button>
        <ul class="dropdown-menu">
          <li v-for="(preset, index) in availablePresets" :key="index">
            <a class="dropdown-item" href="#" @click.prevent="selectPreset(index)">
              {{ preset.name }}
            </a>
          </li>
        </ul>
      </div>

      <!-- Import/Export/Share buttons -->
      <div class="btn-group" role="group">
        <div class="dropdown">
          <button
            class="btn btn-outline-primary dropdown-toggle"
            data-testid="button-import"
            data-bs-toggle="dropdown"
            aria-expanded="false"
            style="border-right-width: 0px"
            type="button"
          >
            Import
          </button>
          <ul class="dropdown-menu">
            <li>
              <a
                class="dropdown-item"
                data-testid="import-from-file"
                href="#"
                @click.prevent="triggerFileUpload"
              >
                From File
              </a>
            </li>
            <li>
              <a class="dropdown-item" href="#" @click.prevent="openUrlImportModal"> From URL </a>
            </li>
          </ul>
        </div>

        <div class="dropdown">
          <button
            class="btn btn-outline-primary dropdown-toggle"
            data-testid="button-export"
            data-bs-toggle="dropdown"
            aria-expanded="false"
            type="button"
          >
            Export
          </button>
          <ul class="dropdown-menu">
            <li>
              <a
                class="dropdown-item"
                data-testid="export-download-json"
                href="#"
                @click.prevent="downloadJson"
              >
                Download JSON
              </a>
            </li>
            <li>
              <a class="dropdown-item" href="#" @click.prevent="downloadKleInternalJson">
                Download KLE Internal JSON
              </a>
            </li>
            <li>
              <a class="dropdown-item" href="#" @click.prevent="downloadViaJson">
                Download VIA JSON
              </a>
            </li>
            <li>
              <a
                class="dropdown-item"
                data-testid="export-download-png"
                href="#"
                @click.prevent="downloadPng"
              >
                Download PNG
              </a>
            </li>
            <li>
              <a
                class="dropdown-item"
                data-testid="export-download-html"
                href="#"
                @click.prevent="downloadHtmlFile"
              >
                Download HTML
              </a>
            </li>
            <li>
              <a
                class="dropdown-item"
                data-testid="export-ergogen-web-gui"
                href="#"
                @click.prevent="exportToErgogenWebGui"
              >
                Edit in Ergogen Web GUI
              </a>
            </li>
          </ul>
        </div>

        <button class="btn btn-primary" @click="shareLayout" type="button">
          <span class="d-none d-sm-inline" style="white-space: nowrap">Share Link</span>
          <span class="d-inline d-sm-none">Share</span>
        </button>
      </div>
    </div>

    <!-- Hidden file input for imports -->
    <input
      ref="fileInput"
      type="file"
      accept=".json,.png,.yaml,.yml"
      @change="handleFileUpload"
      style="display: none"
    />

    <!-- URL Import Modal -->
    <div
      v-if="showUrlImportModal"
      class="modal fade show d-block"
      tabindex="-1"
      @click.self="closeUrlImportModal"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Import from URL</h5>
            <button
              type="button"
              class="btn-close"
              @click="closeUrlImportModal"
              aria-label="Close"
            ></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label for="urlInput" class="form-label">Enter URL</label>
              <input
                id="urlInput"
                v-model="urlImportInput"
                type="url"
                class="form-control"
                placeholder="https://..."
                @keyup.enter="importFromUrl"
              />
              <div class="form-text">
                Paste a link to a JSON file, GitHub Gist, Ergogen layout or a kle-ng share link. All
                formats are automatically detected.
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeUrlImportModal">
              Cancel
            </button>
            <button
              type="button"
              class="btn btn-primary"
              @click="importFromUrl"
              :disabled="!urlImportInput"
            >
              Import
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useKeyboardStore, Keyboard, KeyboardMetadata, type Key } from '@/stores/keyboard'
import { useMatrixDrawingStore } from '@/stores/matrix-drawing'
import presetsMetadata from '@/data/presets.json'
import { toast } from '@/composables/useToast'
import { createPngWithKleLayout, extractKleLayout, hasKleMetadata } from '@/utils/png-metadata'
import { convertKleToVia } from '@/utils/via-import'
import { stringifyWithRounding } from '@/utils/serialization'
import { parseErgogenConfig, encodeKeyboardToErgogenUrl } from '@/utils/ergogen-converter'

// Store
const keyboardStore = useKeyboardStore()
const matrixDrawingStore = useMatrixDrawingStore()

// Component state
const selectedPreset = ref('')
const selectedPresetName = ref('')
const availablePresets = ref<{ name: string; file: string }[]>([])
const fileInput = ref<HTMLInputElement>()

// URL Import modal state
const showUrlImportModal = ref(false)
const urlImportInput = ref('')

// Load presets on mount
onMounted(() => {
  availablePresets.value = presetsMetadata.presets || []
})

// Actions
const selectPreset = async (index: number) => {
  selectedPreset.value = index.toString()
  const preset = availablePresets.value[index]
  selectedPresetName.value = preset?.name || ''
  await loadPreset()
}

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

const handleFileUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  try {
    // Extract filename without extension for downloads
    const filenameWithoutExt = file.name.replace(/\.[^/.]+$/, '')

    // Handle PNG files
    if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
      console.log(`Checking PNG file for embedded layout: ${file.name}`)

      // Check if PNG contains KLE metadata
      if (await hasKleMetadata(file)) {
        const layoutData = await extractKleLayout(file)

        if (layoutData) {
          console.log(`Loading layout from PNG metadata: ${file.name}`)
          keyboardStore.loadKLELayout(layoutData)
          keyboardStore.filename = filenameWithoutExt
          toast.showSuccess(`Layout imported from PNG metadata: ${file.name}`, 'Import Successful')
        } else {
          toast.showError('Failed to extract layout data from PNG metadata', 'Import Failed')
        }
      } else {
        toast.showError(
          'This PNG file does not contain layout data. Only PNG files exported from this tool contain the necessary metadata to import layouts.',
          'No Layout Data',
        )
      }
      return
    }

    // Handle YAML files (Ergogen format)
    if (file.name.toLowerCase().endsWith('.yaml') || file.name.toLowerCase().endsWith('.yml')) {
      console.log(`Processing Ergogen YAML file: ${file.name}`)

      try {
        const text = await file.text()
        const keyboard = await parseErgogenConfig(text)

        // Load the keyboard
        keyboardStore.loadKeyboard(keyboard)
        keyboardStore.filename = filenameWithoutExt

        toast.showSuccess(`Ergogen layout imported`, 'Import Successful')
      } catch (error) {
        console.error('Error processing Ergogen YAML:', error)
        const errorMessage =
          error instanceof Error
            ? `Ergogen conversion failed: ${error.message}`
            : 'Failed to process Ergogen YAML'
        toast.showError(errorMessage, 'Ergogen Import Failed')
        throw error
      }
      return
    }

    // Handle JSON files
    const text = await file.text()
    await processJsonLayout(text, file.name, filenameWithoutExt)
  } catch (error) {
    console.error('Error loading file:', error)
    const errorMessage = error instanceof Error ? error.message : 'Invalid file format'
    toast.showError(errorMessage, 'Error loading file')
  } finally {
    // Clear the input
    input.value = ''
  }
}

/**
 * Process and load JSON layout data with automatic format detection
 * Handles VIA (not implemented here), Internal KLE (object with meta+keys),
 * and Raw KLE formats (array-based).
 */
const processJsonLayout = async (
  jsonText: string,
  displayFilename: string,
  storedFilename: string,
) => {
  let data: unknown

  try {
    data = JSON.parse(jsonText)
  } catch (err) {
    // Invalid JSON
    const msg = err instanceof Error ? err.message : 'Invalid JSON'
    toast.showError(msg, 'Import Failed')
    return
  }

  try {
    // Raw KLE: arrays (including empty arrays) are treated as raw KLE format
    if (Array.isArray(data)) {
      keyboardStore.loadKLELayout(data)
      keyboardStore.filename = storedFilename
      toast.showSuccess(`KLE layout loaded from ${displayFilename}`, 'Import successful')
      return
    }

    // Internal KLE format: object with meta and keys (keys must be array)
    if (
      typeof data === 'object' &&
      data !== null &&
      'meta' in (data as Record<string, unknown>) &&
      'keys' in (data as Record<string, unknown>) &&
      Array.isArray((data as Record<string, unknown>).keys)
    ) {
      // Build a typed Keyboard object and load it
      const obj = data as Record<string, unknown>
      const keyboard = new Keyboard()
      // Ensure keys are typed as `Key[]` after cloning
      keyboard.keys = Array.isArray(obj.keys)
        ? (JSON.parse(JSON.stringify(obj.keys)) as Key[])
        : []
      // Use provided meta or fallback to defaults
      keyboard.meta = obj.meta
        ? (JSON.parse(JSON.stringify(obj.meta)) as KeyboardMetadata)
        : new KeyboardMetadata()

      keyboardStore.loadKeyboard(keyboard)
      // Store filename for downloads (even if meta.name exists, filename is tracked separately)
      keyboardStore.filename = storedFilename
      toast.showSuccess(`Internal KLE layout loaded from ${displayFilename}`, 'Import successful')
      return
    }

    // Fallback: try to process as raw KLE (may throw)
    try {
      keyboardStore.loadKLELayout(data as Array<unknown>)
      keyboardStore.filename = storedFilename
      toast.showSuccess(`KLE layout loaded from ${displayFilename}`, 'Import successful')
      return
    } catch (err2) {
      const errMsg = err2 instanceof Error ? err2.message : 'Failed to import layout'
      toast.showError(errMsg, 'Import Failed')
      return
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to import layout'
    toast.showError(errorMessage, 'Import Failed')
    throw error
  }
}

// Export functions
const downloadJson = () => {
  const data = keyboardStore.getSerializedData('kle')
  const blob = new Blob([stringifyWithRounding(data, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${keyboardStore.filename || keyboardStore.metadata.name || 'keyboard-layout'}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const downloadKleInternalJson = () => {
  const data = keyboardStore.getSerializedData('kle-internal')
  const blob = new Blob([stringifyWithRounding(data, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${keyboardStore.filename || keyboardStore.metadata.name || 'keyboard-layout'}-internal.json`
  a.click()
  URL.revokeObjectURL(url)
}

const downloadViaJson = () => {
  // Get the KLE data
  const kleData = keyboardStore.getSerializedData('kle')

  // Convert to VIA format
  const viaData = convertKleToVia(kleData)

  if (!viaData) {
    toast.showError(
      'VIA metadata not found. Import a VIA layout or add VIA metadata in the Keyboard Metadata tab.',
      'Cannot export VIA JSON',
    )
    return
  }

  const blob = new Blob([JSON.stringify(viaData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${keyboardStore.filename || keyboardStore.metadata.name || 'keyboard-layout'}-via.json`
  a.click()
  URL.revokeObjectURL(url)
}

const exportToErgogenWebGui = () => {
  try {
    if (keyboardStore.keys.length === 0) {
      toast.showError('Cannot export empty keyboard layout', 'Export Failed')
      return
    }

    // Get the current keyboard state
    const keyboard = new Keyboard()
    keyboard.keys = JSON.parse(JSON.stringify(keyboardStore.keys))
    keyboard.meta = JSON.parse(JSON.stringify(keyboardStore.metadata))

    // Encode to ergogen.xyz URL
    const ergogenUrl = encodeKeyboardToErgogenUrl(keyboard)

    // Open the URL in a new tab
    window.open(ergogenUrl, '_blank', 'noopener,noreferrer')

    console.log('Ergogen Web GUI URL generated:', ergogenUrl)
  } catch (error) {
    console.error('Error exporting to Ergogen Web GUI:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to export to Ergogen Web GUI'
    toast.showError(errorMessage, 'Export Failed')
  }
}

const downloadPng = async () => {
  const canvas = document.querySelector('.keyboard-canvas') as HTMLCanvasElement
  if (!canvas) {
    toast.showError('Please make sure the keyboard is visible.', 'Canvas not found')
    return
  }

  // Generate canvas with rounded background
  const radiiValue = keyboardStore.metadata.radii?.trim() || '6px'
  const tempCanvas = createCanvasWithRoundedBackground(canvas, radiiValue)

  // If matrix overlay is visible, composite it on top
  if (matrixDrawingStore.isModalOpen) {
    const overlayCanvas = document.querySelector('.matrix-annotation-overlay') as HTMLCanvasElement
    if (overlayCanvas) {
      const tempCtx = tempCanvas.getContext('2d')
      if (tempCtx) {
        tempCtx.drawImage(overlayCanvas, 0, 0)
      }
    }
  }

  try {
    // Get base PNG blob
    const basePngBlob = await new Promise<Blob>((resolve) =>
      tempCanvas.toBlob((b) => resolve(b!), 'image/png'),
    )

    // Embed KLE layout metadata in PNG
    const layoutData = keyboardStore.getSerializedData('kle')
    const pngWithMetadata = await createPngWithKleLayout(basePngBlob, layoutData, {
      Title: keyboardStore.metadata.name || 'Keyboard Layout',
      Author: keyboardStore.metadata.author || '',
      Description: 'Keyboard layout created with Keyboard Layout Editor NG',
    })

    if (typeof window.showSaveFilePicker === 'function') {
      // Modern File System Access API (Chrome/Edge)
      const handle = await window.showSaveFilePicker({
        suggestedName: `${keyboardStore.filename || keyboardStore.metadata.name || 'keyboard-layout'}.png`,
        types: [
          {
            description: 'PNG image with embedded layout',
            accept: { 'image/png': ['.png'] },
          },
        ],
      })

      const writable = await handle.createWritable()
      await writable.write(pngWithMetadata)
      await writable.close()
      toast.showSuccess('PNG image with embedded layout saved successfully', 'Export Successful')
    } else {
      // Fallback: download PNG directly (Firefox/older browsers)
      // Note: We can't detect if user cancels the download dialog, so no success toast
      const url = URL.createObjectURL(pngWithMetadata)
      const a = document.createElement('a')
      a.href = url
      a.download = `${keyboardStore.filename || keyboardStore.metadata.name || 'keyboard-layout'}.png`
      a.click()
      URL.revokeObjectURL(url)
      // No toast here - we can't detect if the user actually saved or cancelled
    }
  } catch (error: unknown) {
    // Handle cancellation and other errors
    if (error instanceof Error) {
      // Check for user cancellation (AbortError or similar)
      if (
        error.name === 'AbortError' ||
        error.message.includes('aborted') ||
        error.message.includes('cancelled')
      ) {
        // User cancelled - don't show any toast
        return
      } else {
        // Actual error occurred
        console.error('Error downloading PNG:', error)
        toast.showError(`Failed to save PNG: ${error.message}`, 'Save Failed')
      }
    } else {
      // Unknown error type
      console.error('Unknown error downloading PNG:', error)
      toast.showError('Failed to save PNG image', 'Save Failed')
    }
  }
}

const downloadHtmlFile = async () => {
  try {
    // Helper function to escape HTML
    const escapeHtml = (text: string): string => {
      const div = document.createElement('div')
      div.textContent = text
      return div.innerHTML
    }

    // Get keyboard metadata
    const layoutName = keyboardStore.metadata.name || keyboardStore.filename || 'Keyboard Layout'
    const author = keyboardStore.metadata.author || ''
    const backColor = keyboardStore.metadata.backcolor || '#ffffff'
    const radiiValue = keyboardStore.metadata.radii?.trim() || '6px'

    // Build key DOM representation
    const keys = keyboardStore.keys
    if (!keys || keys.length === 0) {
      toast.showError('No keys to export. Please load a layout first.', 'Export Failed')
      return
    }

    // Determine layout bounds
    const unit = 54
    const minX = Math.min(...keys.map((k) => k.x ?? 0))
    const minY = Math.min(...keys.map((k) => k.y ?? 0))
    const maxX = Math.max(...keys.map((k) => (k.x ?? 0) + (k.width ?? 1)))
    const maxY = Math.max(...keys.map((k) => (k.y ?? 0) + (k.height ?? 1)))
    const boardWidth = Math.max(0, maxX - minX) * unit
    const boardHeight = Math.max(0, maxY - minY) * unit

    // Return label HTML preserving markup (sanitize minimaly to avoid accidental template breaks)
    const sanitizeLabelForHtml = (s: string): string =>
      s.replace(/`/g, '&#96;').replace(/<\/script/gi, '<\\/script')

    const getTopLeft = (key: Key): string => {
      if (key.labels && Array.isArray(key.labels)) {
        const v = key.labels[0] // 0 = top-left
        if (typeof v === 'string' && v.trim().length > 0) return sanitizeLabelForHtml(v)
      }
      return ''
    }

    const getBottomLeft = (key: Key): string => {
      if (key.labels && Array.isArray(key.labels)) {
        const v = key.labels[6] // 6 = bottom-left (LabelRenderer uses index 6 for bottom-left)
        if (typeof v === 'string' && v.trim().length > 0) return sanitizeLabelForHtml(v)
      }
      return ''
    }

    const keysHtml = keys
      .map((key) => {
        const left = (Number(key.x ?? 0) - minX) * unit
        const top = (Number(key.y ?? 0) - minY) * unit
        const width = Number(key.width ?? 1) * unit
        const height = Number(key.height ?? 1) * unit
        const topLeft = getTopLeft(key)
        const bottomLeft = getBottomLeft(key)

        return `<div class="key" style="left:${left}px;top:${top}px;width:${width}px;height:${height}px;">
          ${topLeft ? `<span class="label-tl">${topLeft}</span>` : ''}
          ${bottomLeft ? `<span class="label-bl">${bottomLeft}</span>` : ''}
        </div>`
      })
      .join('\n')

    // Generate HTML content (the same innerHtml as before)
    const innerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(layoutName)}</title>
  <style>
    :root {
      --unit: ${unit}px;
      --board-width: ${boardWidth}px;
      --board-height: ${boardHeight}px;
      --key-bg: #fafafa;
      --key-border: #d1d5db;
      --text: #111827;
      --shadow: 0 1px 2px rgba(0,0,0,0.06);
      --board-shadow: inset 0 0 0 1px #e5e7eb;
    }
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f5f5;
      display: flex;
      justify-content: center;
    }
    .keyboard-container {
      background: #fff;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 6px 18px rgba(2,6,23,0.08);
    }
    .keyboard-title {
      margin: 0 0 15px 0;
      font-size: 24px;
      font-weight: 600;
      color: #333;
    }
    .keyboard-author {
      margin: 0 0 20px 0;
      font-size: 14px;
      color: #666;
    }
    .board {
      position: relative;
      width: var(--board-width);
      height: var(--board-height);
      background: ${backColor};
      border-radius: ${radiiValue};
      overflow: hidden;
      box-shadow: var(--board-shadow);
    }
    .key {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--key-bg);
      border: 1px solid var(--key-border);
      border-radius: 6px;
      box-shadow: var(--shadow);
      box-sizing: border-box;
      padding: 6px;
      color: var(--text);
      font-size: 13px;
      overflow: hidden;
      text-align: center;
      word-break: break-word;
      line-height: 1.3;
    }
    /* Replace/extend existing key label styles with corner labels */
.key { position: absolute; /* existing properties preserved */ }

/* Corner labels */
.label-tl,
.label-bl {
  position: absolute;
  left: 8px;
  color: var(--text);
  font-size: 11px;
  line-height: 1;
  pointer-events: none;
  white-space: nowrap;
  text-align: left;
}

/* top-left */
.label-tl {
  top: 6px;
}

/* bottom-left */
.label-bl {
  bottom: 6px;
}
    .keyboard-footer {
      margin-top: 15px;
      font-size: 12px;
      color: #999;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="keyboard-container">
    ${layoutName ? `<h1 class="keyboard-title">${escapeHtml(layoutName)}</h1>` : ''}
    ${author ? `<p class="keyboard-author">by ${escapeHtml(author)}</p>` : ''}
    <div class="board">
      ${keysHtml}
    </div>
    <p class="keyboard-footer">Created with <a href="https://editor.keyboard-tools.xyz/" target="_blank" rel="noopener">Keyboard Layout Editor NG</a></p>
  </div>
</body>
</html>`

    // Create a blob for the HTML
    const htmlBlob = new Blob([innerHtml], { type: 'text/html' })
    const suggestedName = `${keyboardStore.filename || keyboardStore.metadata.name || 'keyboard-layout'}.html`

    const fsWindow = window as unknown as SaveFilePickerWindow
    if (typeof fsWindow.showSaveFilePicker === 'function') {
      const handle = await fsWindow.showSaveFilePicker({
        suggestedName,
        types: [ { description: '...', accept: { 'text/html': ['.html'] } } ],
      })
      const writable = await handle.createWritable()
      await writable.write(htmlBlob)
      await writable.close()
      toast.showSuccess('HTML file saved successfully', 'Export Successful')
    } else {
      // Fallback: init file download via anchor
      const url = URL.createObjectURL(htmlBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = suggestedName
      a.click()
      URL.revokeObjectURL(url)
      toast.showSuccess('HTML file download started', 'Export Started')
    }
  } catch (err: unknown) {
    console.error('Error saving HTML file:', err)
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted') || err.message.includes('cancelled'))) {
      // user chose to cancel/save dialog - don't show error
      return
    }
    toast.showError(`Failed to save HTML file: ${errorMessage}`, 'Export Failed')
  }
}

interface FileSystemWritableFileStream {
  write(data: Blob): Promise<void>
  close(): Promise<void>
}
interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>
}
interface SaveFilePickerWindow {
  showSaveFilePicker?: (options: {
    suggestedName?: string
    types?: { description?: string; accept?: Record<string, string[]> }[]
  }) => Promise<FileSystemFileHandle>
}
</script>

<style scoped>
/* Bootstrap CSS provides all the styling, minimal custom overrides needed */
.toolbar-container {
  min-height: 38px;
}

.preset-dropdown .preset-select {
  width: 220px;
  min-width: 220px;
  flex-shrink: 0;
  text-align: left;
  display: flex;
  align-items: center;
  justify-content: space-between;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  /* Match standard Bootstrap button height and sizing */
}

.preset-dropdown .preset-select::after {
  margin-left: 0.5rem;
  flex-shrink: 0;
}

/* Mobile responsive adjustments */
@media (max-width: 575.98px) {
  .preset-dropdown .preset-select {
    width: 100%;
  }

  /* Make buttons more compact to fit in one row */
  .btn-group .btn,
  .preset-dropdown .preset-select {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    white-space: nowrap;
  }
}

@media (max-width: 320px) {
  .btn-group .btn,
  .preset-dropdown .preset-select {
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

.keyboard-toolbar .btn-outline-primary {
  border-width: 2px;
}

/* Import/Export/Share button group corner rounding */
.btn-group > .dropdown:first-child .btn {
  border-top-left-radius: 6px !important;
  border-bottom-left-radius: 6px !important;
  border-top-right-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
}

.btn-group > .dropdown:nth-child(2) .btn {
  border-radius: 0 !important;
}

.btn-group > .btn:last-child {
  border-top-left-radius: 0 !important;
  border-bottom-left-radius: 0 !important;
  border-top-right-radius: 6px !important;
  border-bottom-right-radius: 6px !important;
}

/* Modal Styles */
.modal {
  background: rgba(0, 0, 0, 0.5);
}
</style>
