<template>
  <div class="toolbar-container keyboard-toolbar" data-testid="panel-toolbar-container">
    <!-- Right side: My Layouts, Import/Export/Share -->
    <!-- Everything fits one row at every width now that the preset dropdown, which
         was the widest control by far, has moved into the Import menu. -->
    <div class="d-flex flex-row align-items-center gap-2 gap-sm-3 justify-content-end">
      <!-- Only shown to signed-in users; accounts are optional and off by default.
           Kept out of the button group below so it reads as its own destination
           rather than a fourth import/export action. -->
      <button
        v-if="authStore.isSignedIn"
        class="btn btn-outline-primary flex-shrink-0"
        data-testid="my-layouts"
        type="button"
        title="Your saved layouts"
        @click="showMyLayoutsModal = true"
      >
        <span class="d-none d-sm-inline">My Layouts</span>
        <span class="d-inline d-sm-none">Layouts</span>
      </button>

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
          <ul class="dropdown-menu import-menu">
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

            <!-- Presets are just another way to start a layout, so they live with the
                 other sources rather than owning a slot in the header. The heading band
                 separates the two groups, so no divider above it. -->
            <li><h6 class="dropdown-header">Presets</h6></li>
            <li
              v-for="preset in availablePresets"
              :key="preset.file"
              data-testid="import-from-preset"
            >
              <a class="dropdown-item" href="#" @click.prevent="loadPreset(preset)">
                {{ preset.name }}
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

        <!-- Share, a split button for signed-in users. The pair lives in its own
             nested btn-group so the dropdown <ul> is not a direct child of the outer
             group: the corner-rounding rules below key off child position, and an
             absolutely-positioned <ul> arriving as :last-child would silently strip
             the rounding from Share and the caret alike. -->
        <div class="btn-group share-group" role="group">
          <button
            class="btn btn-primary"
            @click="shareLayout"
            type="button"
            title="Copy share URL to clipboard"
          >
            <span class="d-none d-sm-inline">Share Link</span>
            <span class="d-inline d-sm-none">Share</span>
          </button>

          <!-- Short links need a session to create, so the caret only exists for
               signed-in users — the same gate as the My Layouts button above. -->
          <template v-if="authStore.isSignedIn">
            <button
              class="btn btn-primary dropdown-toggle dropdown-toggle-split"
              data-testid="share-options"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              type="button"
              :disabled="shortLinksStore.busy"
              title="More share options"
            >
              <span class="visually-hidden">More share options</span>
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li>
                <a
                  class="dropdown-item"
                  data-testid="copy-short-link"
                  href="#"
                  @click.prevent="copyShortLink"
                >
                  Copy short link
                </a>
              </li>
            </ul>
          </template>
        </div>
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
    <MyLayoutsModal :is-visible="showMyLayoutsModal" @close="showMyLayoutsModal = false" />
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
import MyLayoutsModal from './MyLayoutsModal.vue'
import { useAuthStore } from '@/stores/auth'
import { useShortLinksStore } from '@/stores/short-links'
import { buildShortLinkUrl } from '@/utils/short-links'

import BiBoxArrowUpRight from 'bootstrap-icons/icons/box-arrow-up-right.svg'

const keyboardStore = useKeyboardStore()
const authStore = useAuthStore()
const shortLinksStore = useShortLinksStore()

interface Preset {
  name: string
  file: string
}

const availablePresets = ref<Preset[]>([])

onMounted(() => {
  availablePresets.value = presetsMetadata.presets || []
})

const loadPreset = async (preset: Preset) => {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/presets/${preset.file}`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    const presetData = await response.json()

    keyboardStore.loadKLELayout(presetData)
    // Name the download after the preset. Without this it would fall back to
    // 'keyboard-layout', since loading clears whatever filename came before.
    keyboardStore.filename = preset.file.replace(/\.[^/.]+$/, '')
  } catch (error) {
    console.error('Error loading preset:', error)
    toast.showError(`Failed to load ${preset.name}`, 'Error loading preset')
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
const showMyLayoutsModal = ref(false)
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

// Short link — signed-in users only; the id is stored server-side and never expires
const copyShortLink = async () => {
  // A create already owns this click, and will report its own outcome. Without this,
  // create()'s re-entrancy guard returns null for the second click and the branch below
  // renders that as a failure — an error toast for a request that is still running and
  // about to succeed. The caret is disabled while busy, but only from the next tick, and
  // the dropdown item itself never is, so a quick second click does reach here.
  if (shortLinksStore.busy) return

  try {
    const id = await shortLinksStore.create(keyboardStore.encodeCurrentLayout())
    if (!id) {
      toast.showError(
        shortLinksStore.errorMessage || 'Please try again.',
        'Could not create short link',
      )
      return
    }

    const shortUrl = buildShortLinkUrl(id)

    // The clipboard write happens after a network round trip, so the user gesture that
    // opened the dropdown may no longer count as transient activation — Safari in
    // particular rejects writeText() at that point. Treat a rejection as a normal
    // outcome and fall back to showing the link, as the no-clipboard branch of
    // shareLayout() does.
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(shortUrl)
      toast.showSuccess('The short link has been copied to your clipboard.', 'Short link copied!')
    } catch {
      toast.showInfo('Copy this short link to share your layout: ' + shortUrl, 'Short Link Ready', {
        duration: 10000,
        showCloseButton: true,
      })
    }
  } catch (error) {
    console.error('Error creating short link:', error)
    toast.showError('Please try again.', 'Error creating short link')
  }
}
</script>

<style scoped>
/* Bootstrap CSS provides all the styling, minimal custom overrides needed */
.toolbar-container {
  min-height: 38px;
}

/* The presets section makes this the one long menu in the header. Cap it against the
   viewport rather than a fixed height, so it only scrolls when it genuinely cannot
   fit: the allowance covers the header above it plus a margin at the bottom. */
.import-menu {
  max-height: calc(100vh - 5rem);
  overflow-y: auto;
}

.keyboard-toolbar .btn {
  white-space: nowrap;
}

.keyboard-toolbar .btn-outline-primary {
  border-width: 2px;
}

/* Import/Export/Share button group corner rounding. The outer group is always exactly
   [Import dropdown][Export dropdown][Share group], so these positional rules are
   stable; Share itself may be one button or a split pair, which is why its corners are
   expressed over the nested .share-group below rather than by position out here. */
.btn-group > .dropdown:first-child .btn {
  border-top-left-radius: 6px !important;
  border-bottom-left-radius: 6px !important;
  border-top-right-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
}

.btn-group > .dropdown:nth-child(2) .btn {
  border-radius: 0 !important;
}

/* Share sits in a nested group because it may be a split button. :last-of-type ignores
   the dropdown <ul>, so this works for one button (signed out, where :first-child and
   :last-of-type are the same element) and for two. */
.btn-group > .share-group > .btn:first-child {
  border-top-left-radius: 0 !important;
  border-bottom-left-radius: 0 !important;
}

.btn-group > .share-group > .btn:not(:last-of-type) {
  border-top-right-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
}

.btn-group > .share-group > .btn:last-of-type {
  border-top-right-radius: 6px !important;
  border-bottom-right-radius: 6px !important;
}
</style>
