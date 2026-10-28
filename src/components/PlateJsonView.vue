<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { usePlateGeneratorStore } from '@/stores/plateGenerator'
import { getCodeMirror, getLoadedCodeMirror } from '@/utils/codemirror-loader'
import { serializePlateSettings } from '@/utils/plate/plate-settings-serializer'
import { validatePlateSettingsJson } from '@/utils/plate/plate-settings-validator'
import type { PlateSettingsJson } from '@/utils/plate/plate-settings-serializer'
import type { EditorView } from '@codemirror/view'
import BiUpload from 'bootstrap-icons/icons/upload.svg'
import BiDownload from 'bootstrap-icons/icons/download.svg'
import BiArrowCounterclockwise from 'bootstrap-icons/icons/arrow-counterclockwise.svg'
import BiArrowsFullscreen from 'bootstrap-icons/icons/arrows-fullscreen.svg'
import JsonExpandModal from './JsonExpandModal.vue'

const plateStore = usePlateGeneratorStore()

// ---------------------------------------------------------------------------
// Editor DOM refs
// ---------------------------------------------------------------------------
const editorContainer = ref<HTMLDivElement>()
const editorReady = ref(false)
const loadError = ref(false)
const fileInputRef = ref<HTMLInputElement>()

let editorView: EditorView | null = null
let themeObserver: MutationObserver | null = null
let isProgrammaticUpdate = false

// ---------------------------------------------------------------------------
// Editor state
// ---------------------------------------------------------------------------
const isDirty = ref(false)
const validationError = ref<string | null>(null)
const validationWarnings = ref<string[]>([])
const parsedJson = ref<PlateSettingsJson | null>(null)
const editorText = ref('')
// The defaults as last loaded by the Defaults button, and whether they matched
// the settings already (then nothing is loaded, only the status says so).
const defaultsText = ref<string | null>(null)
const defaultsAlreadyApplied = ref(false)

// ---------------------------------------------------------------------------
// Derived state
// ---------------------------------------------------------------------------
const canApply = computed(
  () => isDirty.value && validationError.value === null && parsedJson.value !== null,
)
const canReset = computed(() => isDirty.value)

// Derived from the text, so any edit or upload that replaces it ends this state.
const defaultsLoaded = computed(
  () => isDirty.value && defaultsText.value !== null && editorText.value === defaultsText.value,
)

const statusText = computed(() => {
  if (validationError.value) return `Error: ${validationError.value}`
  if (validationWarnings.value.length > 0)
    return `${validationWarnings.value.length} warning(s): ${validationWarnings.value[0]}`
  if (defaultsLoaded.value) return 'Defaults loaded — press Apply to use them'
  if (isDirty.value) return 'Modified — press Apply or Ctrl+Enter to apply'
  if (defaultsAlreadyApplied.value) return 'In sync — settings already use the defaults'
  return 'In sync'
})

const statusClass = computed(() => {
  if (validationError.value) return 'text-danger'
  if (validationWarnings.value.length > 0) return 'text-warning'
  if (isDirty.value) return 'text-warning'
  return 'text-muted'
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getTheme(): 'dark' | 'light' {
  return document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light'
}

function getCanonicalJson(): string {
  return JSON.stringify(serializePlateSettings(plateStore.settings), null, 2)
}

function validate(text: string): void {
  const result = validatePlateSettingsJson(text)
  if (result.valid) {
    validationError.value = null
    validationWarnings.value = result.warnings
    parsedJson.value = result.json
  } else {
    validationError.value = result.error
    validationWarnings.value = []
    parsedJson.value = null
  }
}

function setEditorContent(text: string): void {
  getCodeMirror()
    .then((cm) => {
      if (editorView) {
        isProgrammaticUpdate = true
        cm.updateContent(editorView, text)
        isProgrammaticUpdate = false
      }
    })
    .catch((err) => console.error('Failed to update plate JSON view:', err))
}

// ---------------------------------------------------------------------------
// Editor callbacks
// ---------------------------------------------------------------------------
function onEditorChange(text: string): void {
  if (isProgrammaticUpdate) return
  editorText.value = text
  isDirty.value = true
  defaultsAlreadyApplied.value = false
  validate(text)
}

function applyEdits(): void {
  if (!canApply.value || !parsedJson.value) return
  isDirty.value = false
  plateStore.applySettings(parsedJson.value)
}

function resetEdits(): void {
  const canonical = getCanonicalJson()
  editorText.value = canonical
  isDirty.value = false
  validationError.value = null
  validationWarnings.value = []
  parsedJson.value = null
  setEditorContent(canonical)
}

// ---------------------------------------------------------------------------
// Button actions
// ---------------------------------------------------------------------------

/**
 * Loads the default settings into the editor as an unapplied edit: Apply uses
 * them, Reset goes back to the current settings.
 */
function loadDefaults(): void {
  const text = JSON.stringify(plateStore.getDefaultSettingsJson(), null, 2)
  if (text === getCanonicalJson()) {
    resetEdits()
    defaultsAlreadyApplied.value = true
    return
  }
  defaultsText.value = text
  editorText.value = text
  isDirty.value = true
  defaultsAlreadyApplied.value = false
  validate(text)
  setEditorContent(text)
}

function downloadJson(): void {
  const text = isDirty.value ? editorText.value : getCanonicalJson()
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'plate-settings.json'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function triggerUpload(): void {
  fileInputRef.value?.click()
}

function onFileSelected(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result as string
    const result = validatePlateSettingsJson(text)
    if (result.valid) {
      // Valid: apply immediately, sync editor explicitly, clear dirty
      isDirty.value = false
      validationError.value = null
      validationWarnings.value = result.warnings
      parsedJson.value = null
      plateStore.applySettings(result.json)
      setEditorContent(getCanonicalJson())
    } else {
      // Invalid: load into editor as dirty so user can fix
      editorText.value = text
      isDirty.value = true
      validationError.value = result.error
      validationWarnings.value = []
      parsedJson.value = null
      setEditorContent(text)
    }

    input.value = ''
  }
  reader.readAsText(file)
}

// ---------------------------------------------------------------------------
// Editor lifecycle
// ---------------------------------------------------------------------------
async function rebuildEditor(): Promise<void> {
  if (!editorContainer.value) return
  const cm = await getCodeMirror()
  if (!editorContainer.value) return

  if (editorView) {
    cm.destroyEditor(editorView)
    editorView = null
    editorContainer.value.innerHTML = ''
  }

  // Preserve dirty text across theme rebuilds
  const content = isDirty.value ? editorText.value : getCanonicalJson()

  editorView = cm.createJsonEditor(editorContainer.value, content, getTheme(), {
    onChange: onEditorChange,
    onSubmit: applyEdits,
    readOnly: false,
  })
}

// Store watch: update editor only when clean
watch(
  () => plateStore.settings,
  () => {
    defaultsAlreadyApplied.value = false
    if (isDirty.value) return
    if (!editorView) return
    setEditorContent(getCanonicalJson())
  },
  { deep: true },
)

onMounted(async () => {
  try {
    await rebuildEditor()
    editorReady.value = true
  } catch (err) {
    console.error('Failed to load CodeMirror for plate JSON view:', err)
    loadError.value = true
  }

  themeObserver = new MutationObserver(() => {
    rebuildEditor().catch((err) => {
      console.error('Failed to rebuild plate JSON view on theme change:', err)
      loadError.value = true
    })
  })
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-bs-theme'],
  })
})

// ---------------------------------------------------------------------------
// Expand modal
// ---------------------------------------------------------------------------
const isExpandModalOpen = ref(false)

function openExpandModal(): void {
  isExpandModalOpen.value = true
}

function closeExpandModal(): void {
  isExpandModalOpen.value = false
}

function applyExpandModal(value: string): void {
  const result = validatePlateSettingsJson(value)
  if (result.valid) {
    isDirty.value = false
    validationError.value = null
    validationWarnings.value = result.warnings
    parsedJson.value = null
    plateStore.applySettings(result.json)
    setEditorContent(getCanonicalJson())
  } else {
    editorText.value = value
    isDirty.value = true
    validationError.value = result.error
    validationWarnings.value = []
    parsedJson.value = null
    setEditorContent(value)
  }
  isExpandModalOpen.value = false
}

onUnmounted(() => {
  if (editorView) {
    const view = editorView
    editorView = null
    const cm = getLoadedCodeMirror()
    if (cm) {
      cm.destroyEditor(view)
    } else {
      view.destroy() // CM never finished loading; destroy directly
    }
  }
  themeObserver?.disconnect()
  themeObserver = null
})
</script>

<template>
  <div class="json-view plate-json-view">
    <!-- Button bar -->
    <div class="button-bar">
      <div class="button-bar-left">
        <button
          class="btn btn-primary btn-sm"
          :disabled="!canApply"
          title="Apply changes (Ctrl+Enter)"
          @click="applyEdits"
        >
          Apply
        </button>
        <button
          class="btn btn-outline-secondary btn-sm"
          :disabled="!canReset"
          title="Reset to current settings"
          @click="resetEdits"
        >
          Reset
        </button>
      </div>
      <div class="button-bar-right">
        <button
          class="btn btn-outline-secondary btn-sm"
          title="Load the default settings into the editor, then Apply to use them"
          data-testid="plate-json-defaults-btn"
          @click="loadDefaults"
        >
          <BiArrowCounterclockwise aria-hidden="true" />
          Defaults
        </button>
        <button
          class="btn btn-outline-secondary btn-sm"
          :class="{ 'btn-outline-warning': isDirty && validationError }"
          :title="
            isDirty && validationError
              ? 'Download current editor content (contains errors)'
              : 'Download as plate-settings.json'
          "
          @click="downloadJson"
        >
          <BiDownload aria-hidden="true" />
        </button>
        <button
          class="btn btn-outline-secondary btn-sm"
          title="Upload JSON file"
          @click="triggerUpload"
        >
          <BiUpload aria-hidden="true" />
          Upload
        </button>
        <input
          ref="fileInputRef"
          type="file"
          accept=".json,application/json"
          class="file-input-hidden"
          @change="onFileSelected"
        />
      </div>
    </div>

    <!-- Editor area -->
    <div class="editor-wrapper">
      <div v-if="!editorReady && !loadError" class="editor-placeholder">
        <span class="text-muted small">Loading editor...</span>
      </div>
      <div v-else-if="loadError" class="editor-placeholder">
        <span class="text-danger small">Failed to load editor.</span>
      </div>
      <div
        v-show="editorReady && !loadError"
        ref="editorContainer"
        class="cm-editor-container"
      ></div>
      <button
        class="expand-editor-btn"
        title="Expand editor"
        type="button"
        @click="openExpandModal"
      >
        <BiArrowsFullscreen aria-hidden="true" />
      </button>
    </div>

    <!-- Status bar -->
    <div class="status-bar">
      <span class="small" :class="statusClass">{{ statusText }}</span>
    </div>
  </div>

  <JsonExpandModal
    v-if="isExpandModalOpen"
    title="Plate Settings JSON"
    :initial-value="isDirty ? editorText : getCanonicalJson()"
    @close="closeExpandModal"
    @apply="applyExpandModal"
  />
</template>

<style scoped>
.json-view {
  border: 1px solid var(--bs-border-color);
  border-radius: 0.375rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.button-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
  padding: 0.375rem 0.5rem;
  border-bottom: 1px solid var(--bs-border-color);
  background: var(--bs-tertiary-bg);
  flex-wrap: wrap;
}

.button-bar-left,
.button-bar-right {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.editor-wrapper {
  position: relative;
  height: 350px;
}

.editor-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.cm-editor-container {
  height: 100%;
  overflow: auto;
}

.cm-editor-container :deep(.cm-editor) {
  height: 100%;
}

.cm-editor-container :deep(.cm-scroller) {
  height: 100%;
  overflow: auto;
}

.expand-editor-btn {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bs-secondary-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 3px;
  opacity: 0.4;
  cursor: pointer;
  padding: 2px;
  font-size: 0.65rem;
  color: var(--bs-secondary-color);
  z-index: 2;
  transition: opacity 0.15s;
}

.expand-editor-btn:hover {
  opacity: 1;
  color: var(--bs-body-color);
}

.status-bar {
  padding: 0.25rem 0.5rem;
  border-top: 1px solid var(--bs-border-color);
  background: var(--bs-tertiary-bg);
  min-height: 1.75rem;
  display: flex;
  align-items: center;
}

.file-input-hidden {
  display: none;
}
</style>
