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
              <a class="dropdown-item" href="#" @click.prevent="showUrlImportModal = true">
                From URL
              </a>
            </li>
            <li>
              <a class="dropdown-item" href="#" @click.prevent="showQmkImportModal = true">
                From QMK
              </a>
            </li>
            <li>
              <a class="dropdown-item" href="#" @click.prevent="showViaImportModal = true">
                From VIA
              </a>
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
            <li
              :title="
                !canExportVia
                  ? 'VIA metadata not found. Import a VIA layout or add VIA metadata in the Keyboard Metadata tab.'
                  : undefined
              "
            >
              <button
                class="dropdown-item"
                type="button"
                :disabled="!canExportVia"
                @click="downloadViaJson"
              >
                Download VIA JSON
              </button>
            </li>
            <li
              :title="
                !canExportQmk
                  ? 'All regular keys must have matrix coordinates (row,col) in label position 0.'
                  : undefined
              "
            >
              <button
                class="dropdown-item"
                type="button"
                :disabled="!canExportQmk"
                @click="downloadQmkJson"
              >
                Download QMK JSON
              </button>
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
                data-testid="export-download-svg"
                href="#"
                @click.prevent="downloadSvgFile"
              >
                Download SVG
              </a>
            </li>
            <li>
              <a
                class="dropdown-item d-flex icon-link align-items-baseline"
                data-testid="export-ergogen-web-gui"
                href="#"
                @click.prevent="exportToErgogenWebGui"
              >
                Edit in Ergogen Web GUI <BiBoxArrowUpRight class="bi" aria-hidden="true" />
              </a>
            </li>
            <li>
              <a
                class="dropdown-item d-flex icon-link align-items-baseline"
                data-testid="export-zmk-wizard"
                href="#"
                @click.prevent="exportToZmkWizard"
              >
                Open in Shield Wizard (ZMK) <BiBoxArrowUpRight class="bi" aria-hidden="true" />
              </a>
            </li>
          </ul>
        </div>

        <button
          class="btn btn-primary"
          @click="shareLayout"
          type="button"
          title="Copy share URL to clipboard"
        >
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

    <!-- Import modals -->
    <UrlImportModal :is-visible="showUrlImportModal" @close="showUrlImportModal = false" />
    <QmkImportModal :is-visible="showQmkImportModal" @close="showQmkImportModal = false" />
    <ViaImportModal :is-visible="showViaImportModal" @close="showViaImportModal = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useKeyboardStore } from '@/stores/keyboard'
import presetsMetadata from '@/data/presets.json'
import { toast } from '@/composables/useToast'
import { useKeyboardExport } from '@/composables/useKeyboardExport'
import { useKeyboardImport } from '@/composables/useKeyboardImport'
import UrlImportModal from './UrlImportModal.vue'
import QmkImportModal from './QmkImportModal.vue'
import ViaImportModal from './ViaImportModal.vue'

import BiBoxArrowUpRight from 'bootstrap-icons/icons/box-arrow-up-right.svg'

const keyboardStore = useKeyboardStore()

// Preset state
const selectedPreset = ref('')
const selectedPresetName = ref('')
const availablePresets = ref<{ name: string; file: string }[]>([])

onMounted(() => {
  availablePresets.value = presetsMetadata.presets || []
})

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
      const response = await fetch(`${import.meta.env.BASE_URL}data/presets/${preset.file}`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const presetData = await response.json()

      keyboardStore.loadKLELayout(presetData)
      console.log('Preset loaded successfully:', preset.name, 'Keys:', keyboardStore.keys.length)
    } catch (error) {
      console.error('Error loading preset:', error)
      toast.showError(`Failed to load ${preset.name}`, 'Error loading preset')
    }
  }
}

// Export
const {
  canExportVia,
  canExportQmk,
  downloadJson,
  downloadKleInternalJson,
  downloadViaJson,
  downloadQmkJson,
  exportToErgogenWebGui,
  exportToZmkWizard,
  downloadPng,
  downloadHtmlFile,
  downloadSvgFile,
} = useKeyboardExport()

// Import
const fileInput = ref<HTMLInputElement>()
const { triggerFileUpload, handleFileUpload } = useKeyboardImport(fileInput)

// Modal visibility
const showUrlImportModal = ref(false)
const showQmkImportModal = ref(false)
const showViaImportModal = ref(false)

// Share
const shareLayout = async () => {
  try {
    const shareUrl = keyboardStore.generateShareUrl()

    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(shareUrl)
      toast.showSuccess(
        'The shareable link has been copied to your clipboard. Share it with others to let them view your layout!',
        'Link copied successfully!',
      )
    } else {
      toast.showInfo(
        'Copy this link to share your layout: ' + shareUrl,
        'Shareable Link Generated',
        {
          duration: 10000,
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
</style>
