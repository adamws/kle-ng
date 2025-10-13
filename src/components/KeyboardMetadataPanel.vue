<template>
  <div class="keyboard-metadata-panel">
    <div class="row g-3">
      <!-- Left Column: Standard Metadata (with internal 2-column split) -->
      <div class="col-lg-6 col-md-12">
        <div class="property-group h-100">
          <h6 class="property-group-title">Keyboard Metadata</h6>
          <div class="row g-3">
            <!-- Left sub-column -->
            <div class="col-md-6">
              <div class="mb-3">
                <label class="form-label small mb-1">Name</label>
                <input
                  v-model="currentName"
                  @input="updateMetadata('name', currentName)"
                  type="text"
                  class="form-control form-control-sm"
                  placeholder="My Keyboard Layout"
                />
              </div>
              <div class="mb-3">
                <label class="form-label small mb-1">Author</label>
                <input
                  v-model="currentAuthor"
                  @input="updateMetadata('author', currentAuthor)"
                  type="text"
                  class="form-control form-control-sm"
                  placeholder="Your Name"
                />
              </div>
              <div class="mb-3">
                <label class="form-label small mb-1">Background Color</label>
                <div class="input-group input-group-sm">
                  <ColorPicker
                    v-model="currentBackcolor"
                    @change="updateBackcolor"
                    @input="updateBackcolorPreview"
                    class="form-control form-control-color key-color-input"
                    style="width: 24px; flex: none; border-radius: 0"
                    title="Background Color"
                  />
                  <input
                    v-model="currentBackcolor"
                    @change="updateBackcolor"
                    type="text"
                    class="form-control form-control-sm"
                    style="font-size: 0.65rem"
                  />
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label small mb-1">Border Radii</label>
                <input
                  v-model="currentRadii"
                  @input="updateMetadata('radii', currentRadii)"
                  type="text"
                  class="form-control form-control-sm"
                  placeholder="6px (default)"
                  title="CSS border-radius (e.g., '10px', '5px 10px', '10px 20px 30px 40px', '10px / 20px'). Defaults to 6px when empty. Supports separate corners and elliptical radii. Affects both canvas display and PNG export."
                />
              </div>
            </div>

            <!-- Right sub-column: Notes and CSS -->
            <div class="col-md-6">
              <div class="h-100 d-flex flex-column">
                <div class="mb-2">
                  <label class="form-label small mb-1">Notes</label>
                  <textarea
                    v-model="currentNotes"
                    @input="updateMetadata('notes', currentNotes)"
                    class="form-control form-control-sm"
                    placeholder="Add notes about your keyboard layout..."
                    style="min-height: 60px; resize: none"
                  ></textarea>
                </div>
                <div class="flex-grow-1 d-flex flex-column">
                  <div class="d-flex justify-content-between">
                    <label class="form-label small mb-1">CSS</label>
                    <button
                      @click="showCssHelp"
                      class="btn btn-sm btn-outline-secondary css-help-btn"
                      title="Help"
                    >
                      <i class="bi bi-question-circle"></i>
                    </button>
                  </div>
                  <textarea
                    v-model="currentCss"
                    @input="updateCssInput"
                    @blur="updateCssBlur"
                    class="form-control form-control-sm font-monospace flex-grow-1"
                    placeholder="Custom CSS (only fonts impact render, see help)..."
                    style="min-height: 0; resize: none; font-size: 0.65rem"
                    spellcheck="false"
                  ></textarea>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: VIA Metadata -->
      <div class="col-lg-6 col-md-12">
        <div class="property-group h-100 d-flex flex-column">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="property-group-title mb-0">VIA Metadata</h6>
            <div class="d-flex align-items-center gap-2">
              <div v-if="viaJsonError" class="text-danger small">
                <i class="bi bi-exclamation-triangle"></i> Invalid JSON
              </div>
              <div v-else-if="viaMetadataJson.trim()" class="text-success small">
                <i class="bi bi-check"></i> Valid JSON
              </div>
              <button
                @click="showViaHelp"
                class="btn btn-sm btn-outline-secondary help-btn"
                title="Help"
              >
                <i class="bi bi-question-circle"></i>
              </button>
            </div>
          </div>
          <textarea
            v-model="viaMetadataJson"
            @input="updateViaMetadata"
            class="form-control form-control-sm flex-grow-1 font-monospace"
            :class="{ 'is-invalid': viaJsonError }"
            placeholder="VIA metadata JSON..."
            spellcheck="false"
            style="min-height: 0; resize: none; font-size: 0.65rem"
          ></textarea>
          <div v-if="viaJsonError" class="invalid-feedback d-block mt-1">
            {{ viaJsonErrorMessage }}
          </div>
        </div>
      </div>
    </div>

    <!-- CSS Help Modal -->
    <CssHelpModal :is-visible="isCssHelpVisible" @close="closeCssHelp" />

    <!-- VIA Help Modal -->
    <ViaHelpModal :is-visible="isViaHelpVisible" @close="closeViaHelp" />
  </div>
</template>

<style scoped>
/* Improved placeholder styling for better visual distinction */
.form-control::placeholder {
  font-style: italic;
  opacity: 0.6;
  color: var(--bs-secondary-color);
}

.form-control:focus::placeholder {
  opacity: 0.4;
}
</style>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useKeyboardStore } from '@/stores/keyboard'
import { useFontStore } from '@/stores/font'
import ColorPicker from './ColorPicker.vue'
import CssHelpModal from './CssHelpModal.vue'
import ViaHelpModal from './ViaHelpModal.vue'
import LZString from 'lz-string'

const keyboardStore = useKeyboardStore()
const fontStore = useFontStore()

// Help modals state
const isCssHelpVisible = ref(false)
const isViaHelpVisible = ref(false)

const showCssHelp = () => {
  isCssHelpVisible.value = true
}

const closeCssHelp = () => {
  isCssHelpVisible.value = false
}

const showViaHelp = () => {
  isViaHelpVisible.value = true
}

const closeViaHelp = () => {
  isViaHelpVisible.value = false
}

// Reactive property values
const currentName = ref('')
const currentAuthor = ref('')
const currentNotes = ref('')
const currentCss = ref('')
const currentBackcolor = ref('#ffffff')
const currentRadii = ref('')

// VIA metadata state
const viaMetadataJson = ref('')
const viaJsonError = ref(false)
const viaJsonErrorMessage = ref('')

// Extended metadata interface
interface ExtendedMetadata {
  _kleng_via_data?: string
  [key: string]: unknown
}

// Parse VIA metadata from compressed string
const parseViaMetadata = () => {
  try {
    const metadata = keyboardStore.metadata as unknown as ExtendedMetadata
    if (metadata._kleng_via_data) {
      const decompressed = LZString.decompressFromBase64(metadata._kleng_via_data)
      if (decompressed) {
        viaMetadataJson.value = JSON.stringify(JSON.parse(decompressed), null, 2)
      } else {
        viaMetadataJson.value = ''
      }
    } else {
      viaMetadataJson.value = ''
    }
  } catch (error) {
    console.error('Error parsing VIA metadata:', error)
    viaMetadataJson.value = ''
  }
}

// Validate VIA JSON
const validateViaJson = (): boolean => {
  try {
    if (!viaMetadataJson.value.trim()) {
      // Empty is valid
      viaJsonError.value = false
      viaJsonErrorMessage.value = ''
      return true
    }

    JSON.parse(viaMetadataJson.value)
    viaJsonError.value = false
    viaJsonErrorMessage.value = ''
    return true
  } catch (error) {
    viaJsonError.value = true
    viaJsonErrorMessage.value = error instanceof Error ? error.message : 'Invalid JSON format'
    return false
  }
}

// Update VIA metadata when editing
const updateViaMetadata = () => {
  // First validate
  if (!validateViaJson()) {
    return
  }

  try {
    const metadata = keyboardStore.metadata as unknown as ExtendedMetadata

    if (!viaMetadataJson.value.trim()) {
      // Empty field - clear VIA metadata
      delete metadata._kleng_via_data
      keyboardStore.saveState()
      return
    }

    // Compress and save
    const compressed = LZString.compressToBase64(viaMetadataJson.value)
    metadata._kleng_via_data = compressed

    keyboardStore.saveState()
  } catch (error) {
    console.error('Error saving VIA metadata:', error)
  }
}

// Update current values from store
const updateCurrentValues = () => {
  const metadata = keyboardStore.metadata
  currentName.value = metadata.name || ''
  currentAuthor.value = metadata.author || ''
  currentNotes.value = metadata.notes || ''
  currentCss.value = metadata.css || ''
  currentBackcolor.value = metadata.backcolor || '#ffffff'
  currentRadii.value = metadata.radii || ''

  // Parse VIA metadata
  parseViaMetadata()
}

// Watch for metadata changes from store
watch(
  () => keyboardStore.metadata,
  () => {
    updateCurrentValues()
  },
  { deep: true, immediate: true },
)

// Update metadata in store
const updateMetadata = (field: keyof typeof keyboardStore.metadata, value: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(keyboardStore.metadata as any)[field] = value
  keyboardStore.saveState()
}

// Update CSS input (while typing) - save to store but don't reload fonts
const updateCssInput = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(keyboardStore.metadata as any).css = currentCss.value
  keyboardStore.saveState()
}

// Update CSS on blur (when field loses focus) - apply font settings
const updateCssBlur = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(keyboardStore.metadata as any).css = currentCss.value
  keyboardStore.saveState()

  // Apply font settings when user finishes editing (with notification)
  fontStore.applyFromCssMetadata(currentCss.value, true)
}

// Live preview background color update (no state save)
const updateBackcolorPreview = () => {
  // Force reactivity by reassigning the entire metadata object
  keyboardStore.metadata = {
    ...keyboardStore.metadata,
    backcolor: currentBackcolor.value,
  }
}

const updateBackcolor = () => {
  // Force reactivity by reassigning the entire metadata object
  keyboardStore.metadata = {
    ...keyboardStore.metadata,
    backcolor: currentBackcolor.value,
  }
  keyboardStore.saveState()
}
</script>

<style scoped>
/* Property groups styling */
.property-group {
  background: var(--bs-tertiary-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 6px;
  padding: 12px;
  height: 100%;
}

.property-group-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--bs-body-color);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--bs-border-color);
  padding-bottom: 4px;
}

.form-control-sm {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
}

.form-control-color {
  padding: 0.125rem;
  border: 1px solid var(--bs-border-color);
}

.form-label.small {
  font-size: 0.7rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

/* JSON validation styling */
.is-invalid {
  border-color: var(--bs-danger);
}

.is-invalid:focus {
  box-shadow: 0 0 0 0.25rem var(--bs-danger-border-subtle);
}

.invalid-feedback {
  font-size: 0.65rem;
}

/* Help button styling */
.help-btn {
  padding: 0.25rem;
  font-size: 0.875rem;
  line-height: 1;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.help-btn i {
  font-size: 1rem;
}

.css-help-btn {
  font-size: 0.7rem;
  line-height: 1;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.css-help-btn i {
  font-size: 0.7rem;
}
</style>
