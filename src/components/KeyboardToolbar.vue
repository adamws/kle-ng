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
                data-testid="export-embed"
                href="#"
                @click.prevent="copyEmbedCode"
              >
                Embed
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
import { ref, onMounted, nextTick, watch } from 'vue'
import { useKeyboardStore, Keyboard } from '@/stores/keyboard'
import { useMatrixDrawingStore } from '@/stores/matrix-drawing'
import presetsMetadata from '@/data/presets.json'
import { parseJsonString } from '@/utils/serialization'
import { toast } from '@/composables/useToast'
import { parseBorderRadius, createRoundedRectanglePath } from '@/utils/border-radius'
import { createPngWithKleLayout, extractKleLayout, hasKleMetadata } from '@/utils/png-metadata'
import { isViaFormat, convertViaToKle, convertKleToVia } from '@/utils/via-import'
import { stringifyWithRounding } from '@/utils/serialization'
import { decodeLayoutFromUrl, fetchGistLayout, loadErgogenKeyboard } from '@/utils/url-sharing'
import { parseErgogenConfig, encodeKeyboardToErgogenUrl } from '@/utils/ergogen-converter'
import LZString from 'lz-string'

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

import type { Key, KeyboardMetadata } from '@/stores/keyboard'

// Extend KeyboardMetadata to include VIA custom data
interface ExtendedKeyboardMetadata extends KeyboardMetadata {
  _kleng_via_data?: string
}

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

const copyEmbedCode = async () => {
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
    // Helper function to escape HTML
    const escapeHtml = (text: string): string => {
      const div = document.createElement('div')
      div.textContent = text
      return div.innerHTML
    }

    // Get canvas as data URL
    const imageDataUrl = tempCanvas.toDataURL('image/png')

    // Get keyboard metadata
    const layoutName = keyboardStore.metadata.name || keyboardStore.filename || 'Keyboard Layout'
    const author = keyboardStore.metadata.author || ''

    // Generate HTML content for iframe (inner content only)
    const innerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(layoutName)}</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f5f5;
      display: flex;
      justify-content: center;
    }
    .keyboard-container {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      max-width: 100%;
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
    .keyboard-image {
      max-width: 100%;
      height: auto;
      display: block;
      border-radius: 4px;
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
    <img src="${imageDataUrl}" alt="${escapeHtml(layoutName)}" class="keyboard-image" />
    <p class="keyboard-footer">Created with <a href="https://editor.keyboard-tools.xyz/" target="_blank" rel="noopener">Keyboard Layout Editor NG</a></p>
  </div>
</body>
</html>`

    // Escape inner HTML for use in srcdoc attribute
    const escapedInnerHtml = innerHtml.replace(/"/g, '&quot;').replace(/\n/g, ' ').replace(/\s+/g, ' ')

    // Generate iframe tag only
    const iframeCode = `<iframe
  srcdoc="${escapedInnerHtml}"
  style="width: 100%; border: 0;"
></iframe>`

    // Copy to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(iframeCode)
      toast.showSuccess('Embed code copied to clipboard!', 'Copied')
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = iframeCode
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      try {
        document.execCommand('copy')
        toast.showSuccess('Embed code copied to clipboard!', 'Copied')
      } catch {
        toast.showError('Failed to copy to clipboard', 'Copy Failed')
      }
      document.body.removeChild(textArea)
    }
  } catch (error: unknown) {
    console.error('Error generating embed code:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    toast.showError(`Failed to generate embed code: ${errorMessage}`, 'Failed')
  }
}

// Helper function to create a canvas with rounded background
const createCanvasWithRoundedBackground = (
  sourceCanvas: HTMLCanvasElement,
  radii: string,
): HTMLCanvasElement => {
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = sourceCanvas.width
  tempCanvas.height = sourceCanvas.height
  const tempCtx = tempCanvas.getContext('2d')!

  // Parse CSS border-radius format using shared utility
  const corners = parseBorderRadius(radii, tempCanvas.width, tempCanvas.height)

  // Create rounded rectangle path using shared utility
  createRoundedRectanglePath(tempCtx, 0, 0, tempCanvas.width, tempCanvas.height, corners)

  // Clip to rounded rectangle
  tempCtx.clip()

  // Draw the original canvas content
  tempCtx.drawImage(sourceCanvas, 0, 0)

  return tempCanvas
}

// URL Import functions
const openUrlImportModal = () => {
  showUrlImportModal.value = true
  urlImportInput.value = ''
  document.body.classList.add('modal-open')

  // Focus the input field after modal opens
  nextTick(() => {
    const urlInput = document.getElementById('urlInput') as HTMLInputElement
    if (urlInput) {
      urlInput.focus()
    }
  })
}

const closeUrlImportModal = () => {
  showUrlImportModal.value = false
  urlImportInput.value = ''
  document.body.classList.remove('modal-open')
}

// Close modal on Escape key
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && showUrlImportModal.value) {
    closeUrlImportModal()
  }
}

// Add/remove escape key listener when modal visibility changes
watch(
  () => showUrlImportModal.value,
  (visible) => {
    if (visible) {
      document.addEventListener('keydown', handleKeyDown)
    } else {
      document.removeEventListener('keydown', handleKeyDown)
    }
  },
)

/**
 * Convert GitHub blob URLs to raw URLs for direct file access
 * Example: https://github.com/user/repo/blob/branch/file.json
 *       -> https://raw.githubusercontent.com/user/repo/branch/file.json
 */
const convertGitHubBlobToRaw = (url: string): string => {
  // Match GitHub blob URLs
  const blobMatch = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/)

  if (blobMatch) {
    const [, owner, repo, branch, path] = blobMatch
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`
    console.log(`Converted GitHub blob URL to raw URL: ${rawUrl}`)
    toast.showInfo(
      'Detected GitHub blob URL - automatically converting to raw URL for import',
      'URL Converted',
      { duration: 3000 },
    )
    return rawUrl
  }

  return url
}

const importFromUrl = async () => {
  if (!urlImportInput.value) return

  try {
    let url = urlImportInput.value.trim()

    // Convert GitHub blob URLs to raw URLs
    url = convertGitHubBlobToRaw(url)

    // Check if it's an Ergogen URL (ergogen.xyz with hash)
    if (url.includes('ergogen.xyz') && url.includes('#')) {
      await importFromErgogenUrl(url)
    }
    // Check if it's a share link with encoded data (#share=...)
    else if (url.includes('#share=')) {
      await importFromShareLink(url)
    }
    // Check if it's a URL import link (#url=...) or old gist format (#gist=...) for backward compatibility
    else if (url.includes('#url=') || url.includes('#gist=')) {
      await importFromUrlHash(url)
    }
    // Check if it's a GitHub Gist URL
    else if (url.includes('gist.github.com')) {
      await importFromGist(url)
    }
    // Direct URL import (JSON file)
    else {
      await importFromDirectUrl(url)
    }
  } catch (error) {
    console.error('Error importing from URL:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to import from URL'
    toast.showError(errorMessage, 'Import Failed')
  } finally {
    closeUrlImportModal()
  }
}

const importFromShareLink = async (shareUrl: string) => {
  try {
    // Check if this is the current page URL - if so, it's already loaded
    if (shareUrl.includes(window.location.hash) && window.location.hash.startsWith('#share=')) {
      toast.showInfo('This layout is already loaded in the current page', 'Already Loaded')
      return
    }

    // Extract the encoded data from the URL
    const hashIndex = shareUrl.indexOf('#share=')
    if (hashIndex === -1) {
      throw new Error('Invalid share link format')
    }

    const encodedData = shareUrl.substring(hashIndex + 7) // Remove '#share='

    // Decode the layout data
    const layoutData = decodeLayoutFromUrl(encodedData)

    // Load the layout
    keyboardStore.loadKeyboard(layoutData)
    keyboardStore.filename = 'shared-layout'

    toast.showSuccess('Layout imported from share link', 'Import Successful')
  } catch (error) {
    console.error('Error importing from share link:', error)
    throw error
  }
}

const importFromUrlHash = async (urlWithHash: string) => {
  try {
    // Check if this is the current page URL - if so, it's already loaded
    const currentHash = window.location.hash
    if (
      urlWithHash.includes(currentHash) &&
      (currentHash.startsWith('#url=') || currentHash.startsWith('#gist='))
    ) {
      toast.showInfo('This layout is already loaded in the current page', 'Already Loaded')
      return
    }

    // Extract the URL from the hash - supports both #url= and #gist= formats
    let hashIndex = urlWithHash.indexOf('#url=')
    let prefix = '#url='

    if (hashIndex === -1) {
      // Try #gist= format (preferred for gists)
      hashIndex = urlWithHash.indexOf('#gist=')
      prefix = '#gist='
    }

    if (hashIndex === -1) {
      throw new Error('Invalid URL hash format')
    }

    const urlParam = urlWithHash.substring(hashIndex + prefix.length)
    const decodedUrl = decodeURIComponent(urlParam)

    // The decoded URL could be:
    // 1. A full GitHub Gist URL (e.g., https://gist.github.com/username/abc123)
    // 2. A gist ID (e.g., abc123def456) - preferred format for gists
    // 3. Any direct JSON file URL (e.g., https://raw.githubusercontent.com/...)

    // Check if it's a gist URL or ID
    if (decodedUrl.includes('gist.github.com')) {
      await importFromGist(decodedUrl)
    } else if (/^[a-f0-9]+$/i.test(decodedUrl)) {
      // Gist ID format (preferred for gists as it's shorter)
      const layoutData = await fetchGistLayout(decodedUrl)
      keyboardStore.loadKeyboard(layoutData)
      keyboardStore.filename = `gist-${decodedUrl}`
      toast.showSuccess(`Layout imported from gist: ${decodedUrl}`, 'Import Successful')
    } else {
      // Direct URL to JSON file
      await importFromDirectUrl(decodedUrl)
    }
  } catch (error) {
    console.error('Error importing from URL hash:', error)
    throw error
  }
}

const importFromGist = async (gistUrl: string) => {
  try {
    // Extract Gist ID from URL
    const gistIdMatch = gistUrl.match(/gist\.github\.com\/(?:[^\/]+\/)?([a-f0-9]+)/i)
    if (!gistIdMatch) {
      throw new Error('Invalid GitHub Gist URL')
    }

    const gistId = gistIdMatch[1]
    const apiUrl = `https://api.github.com/gists/${gistId}`

    // Fetch Gist data
    const response = await fetch(apiUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch Gist: ${response.status} ${response.statusText}`)
    }

    const gistData = (await response.json()) as {
      files: Record<string, { filename: string; content: string }>
    }

    // Find the first JSON file in the Gist
    const jsonFile = Object.values(gistData.files).find((file) =>
      file.filename.toLowerCase().endsWith('.json'),
    )

    if (!jsonFile) {
      throw new Error('No JSON file found in Gist')
    }

    // Process the JSON layout using shared logic
    await processJsonLayout(jsonFile.content, `gist-${gistId}`, `gist-${gistId}`)
  } catch (error) {
    console.error('Error importing from Gist:', error)
    throw error
  }
}

/**
 * Process and load JSON layout data with automatic format detection
 * Handles VIA, Internal KLE, and Raw KLE formats
 * @param jsonText - The JSON string to parse
 * @param displayFilename - The filename to display in messages (with extension)
 * @param storedFilename - The filename to store (without extension)
 */
const processJsonLayout = async (
  jsonText: string,
  displayFilename: string,
  storedFilename: string,
) => {
  const data = parseJsonString(jsonText)

  // Auto-detect format and load accordingly
  if (isViaFormat(data)) {
    // VIA format - convert to KLE with embedded VIA metadata
    console.log(`Loading VIA format from: ${displayFilename}`)

    try {
      const kleData = convertViaToKle(data)
      keyboardStore.loadKLELayout(kleData)

      // Manually add the VIA metadata after kle-serial processes the data
      // Extract the compressed VIA metadata from the converted KLE data
      const viaDataObj = data as Record<string, unknown>
      const viaCopy = JSON.parse(JSON.stringify(viaDataObj))
      const layouts = viaCopy.layouts as Record<string, unknown>
      delete layouts.keymap // Remove keymap to get only VIA-specific metadata

      // Compress the VIA metadata
      const viaMetadataJson = JSON.stringify(viaCopy)
      const compressedViaData = LZString.compressToBase64(viaMetadataJson)

      // Add it to the keyboard metadata using type assertion
      ;(keyboardStore.metadata as ExtendedKeyboardMetadata)._kleng_via_data = compressedViaData

      toast.showSuccess(`VIA layout loaded from ${displayFilename}`, 'Import successful')
    } catch (error) {
      console.error('Error converting VIA format:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to convert VIA format'
      toast.showError(errorMessage, 'VIA Import Failed')
      throw error
    }
  } else if (isInternalKleFormat(data)) {
    // Internal KLE format with meta and keys
    console.log(`Loading internal KLE format from: ${displayFilename}`)

    keyboardStore.loadKeyboard(data)
    toast.showSuccess(`Internal KLE layout loaded from ${displayFilename}`, 'Import successful')
  } else {
    // Raw KLE format (array-based)
    console.log(`Loading raw KLE format from: ${displayFilename}`)
    keyboardStore.loadKLELayout(data)

    toast.showSuccess(`KLE layout loaded from ${displayFilename}`, 'Import successful')
  }

  keyboardStore.filename = storedFilename
}

const importFromErgogenUrl = async (ergogenUrl: string) => {
  try {
    const keyboard = await loadErgogenKeyboard(ergogenUrl)

    if (!keyboard) {
      throw new Error('No valid Ergogen data found in URL')
    }

    // Load the keyboard
    keyboardStore.loadKeyboard(keyboard)
    keyboardStore.filename = 'ergogen-import'

    toast.showSuccess(
      `Ergogen layout imported from URL: ${Object.keys(keyboard.keys).length} keys`,
      'Import Successful',
    )
  } catch (error) {
    console.error('Error importing from Ergogen URL:', error)
    throw error
  }
}

const importFromDirectUrl = async (url: string) => {
  try {
    // Fetch the JSON file directly
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`)
    }

    const jsonText = await response.text()

    // Extract filename from URL
    const urlParts = url.split('/')
    const filenameWithExt = urlParts[urlParts.length - 1]
    if (!filenameWithExt) throw new Error('Invalid URL: cannot extract filename')
    const filenameWithoutExt = filenameWithExt.replace(/\.json$/, '')

    await processJsonLayout(jsonText, filenameWithExt, filenameWithoutExt)
  } catch (error) {
    console.error('Error importing from direct URL:', error)
    throw error
  }
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
