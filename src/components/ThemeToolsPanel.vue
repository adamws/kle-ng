<template>
  <div
    v-if="visible"
    class="theme-tools-panel"
    ref="panelRef"
    data-testid="theme-tools-panel"
    :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
    @mousedown="handleMouseDown"
  >
    <div class="panel-content" :class="{ 'panel-content--expanded': showHelp }">
      <div class="panel-header" @mousedown="handleHeaderMouseDown">
        <div class="panel-title" data-testid="panel-title">
          <BiGripVertical class="me-2 drag-handle" data-testid="drag-handle" />
          <BiPalette class="me-2" />
          Theme Tools
        </div>
        <div class="header-actions" @mousedown.stop>
          <button
            type="button"
            class="btn btn-sm header-btn"
            :class="showHelp ? 'btn-primary' : 'btn-outline-secondary'"
            data-testid="help-button"
            @click="showHelp = !showHelp"
            aria-label="Toggle syntax help"
            title="Matcher syntax help"
          >
            <BiQuestionCircle />
          </button>
          <button
            type="button"
            class="btn-close"
            data-testid="panel-close-button"
            @click="handleClose"
            aria-label="Close"
          ></button>
        </div>
      </div>

      <div class="panel-columns">
        <!-- Main panel -->
        <div class="panel-main">
          <!-- Section A: Theme Selection -->
          <div class="section mb-3">
            <h6 class="section-title">Theme</h6>

            <!-- Built-in theme selector -->
            <select
              class="form-select form-select-sm mb-2"
              data-testid="theme-preset-select"
              :value="themeStore.isCustomTheme ? '__custom__' : themeStore.activeBuiltinIndex"
              @change="handlePresetChange"
              @mousedown.stop
            >
              <option
                v-for="(theme, index) in themeStore.builtinThemes"
                :key="theme.name"
                :value="index"
              >
                {{ theme.name }}
              </option>
              <option v-if="themeStore.isCustomTheme" value="__custom__" disabled>
                {{ themeStore.currentTheme?.name }} (custom)
              </option>
            </select>

            <!-- File actions -->
            <div class="d-flex gap-2">
              <button
                type="button"
                class="btn btn-outline-primary btn-sm flex-fill"
                data-testid="load-theme-button"
                @click="triggerFileLoad"
                @mousedown.stop
              >
                <BiUpload class="me-1" />
                Load JSON
              </button>
              <button
                type="button"
                class="btn btn-outline-primary btn-sm flex-fill"
                data-testid="save-theme-button"
                :disabled="!themeStore.currentTheme"
                @click="handleSave"
                @mousedown.stop
              >
                <BiDownload class="me-1" />
                Save JSON
              </button>
            </div>

            <!-- Hidden file input -->
            <input
              ref="fileInputRef"
              type="file"
              accept=".json,application/json"
              class="d-none"
              @change="handleFileChange"
            />

            <!-- Load error -->
            <div v-if="loadError" class="alert alert-danger py-1 px-2 mt-2 mb-0 small" role="alert">
              {{ loadError }}
            </div>
          </div>

          <!-- Section B: JSON Editor -->
          <div class="section mb-3">
            <h6 class="section-title">Theme JSON</h6>
            <div
              class="json-editor-wrapper"
              :class="{ 'json-editor-wrapper--error': jsonError }"
              data-testid="theme-json-editor"
              @mousedown.stop
              @keydown.stop
            >
              <div v-if="!editorReady && !editorLoadError" class="editor-placeholder">
                <span class="text-muted small">Loading editor…</span>
              </div>
              <div v-else-if="editorLoadError" class="editor-placeholder">
                <span class="text-danger small">Failed to load editor.</span>
              </div>
              <div
                v-show="editorReady && !editorLoadError"
                ref="editorContainer"
                class="cm-editor-container"
              ></div>
              <button
                class="expand-editor-btn"
                title="Expand editor"
                type="button"
                @click="isExpandModalOpen = true"
              >
                <BiArrowsFullscreen aria-hidden="true" />
              </button>
            </div>
            <div v-if="jsonError" class="alert alert-danger py-1 px-2 mt-1 mb-0 small" role="alert">
              {{ jsonError }}
            </div>

            <Teleport to="body">
              <JsonExpandModal
                v-if="isExpandModalOpen"
                title="Theme JSON"
                :initial-value="jsonText"
                @close="isExpandModalOpen = false"
                @apply="applyExpandModal"
              />
            </Teleport>
          </div>

          <!-- Section C: Apply Button -->
          <div class="section">
            <button
              type="button"
              class="btn btn-primary w-100"
              data-testid="apply-theme-button"
              :disabled="!themeStore.currentTheme"
              @click="handleApply"
              @mousedown.stop
            >
              Apply Theme
            </button>
          </div>

          <!-- Section D: Color Calculator -->
          <div class="section color-calc-section" @mousedown.stop>
            <h6 class="section-title">Color Calculator</h6>
            <div class="color-calc-row">
              <div class="color-calc-col">
                <div class="color-calc-label">KLE color</div>
                <div class="input-group input-group-sm">
                  <ColorPicker
                    v-model="calcKleColor"
                    @change="handleCalcKleChange"
                    class="form-control form-control-color"
                    style="width: 24px; flex: none; border-radius: 0"
                    title="KLE color picker"
                    data-testid="calc-kle-color-picker"
                  />
                  <input
                    v-model="calcKleColor"
                    @change="handleCalcKleChange(($event.target as HTMLInputElement).value)"
                    type="text"
                    class="form-control form-control-sm"
                    style="font-size: 0.65rem"
                    title="KLE color"
                    data-testid="calc-kle-color-text"
                  />
                </div>
              </div>
              <div class="color-calc-arrow" title="KLE color → key top color (L* × 1.2 in Lab)">
                ⇄
              </div>
              <div class="color-calc-col">
                <div class="color-calc-label">Key top</div>
                <div class="input-group input-group-sm">
                  <ColorPicker
                    v-model="calcTopColor"
                    @change="handleCalcTopChange"
                    class="form-control form-control-color"
                    style="width: 24px; flex: none; border-radius: 0"
                    title="Key top color picker"
                    data-testid="calc-top-color-picker"
                  />
                  <input
                    v-model="calcTopColor"
                    @change="handleCalcTopChange(($event.target as HTMLInputElement).value)"
                    type="text"
                    class="form-control form-control-sm"
                    style="font-size: 0.65rem"
                    title="Key top color"
                    data-testid="calc-top-color-text"
                  />
                </div>
              </div>
            </div>
            <div
              v-if="calcClampWarning"
              class="alert alert-warning py-1 px-2 mt-2 mb-0 small"
              role="alert"
            >
              Very light color — inverse is approximate
            </div>
          </div>
        </div>

        <!-- Help pane -->
        <div v-if="showHelp" class="panel-help">
          <h6 class="section-title">Matcher Syntax</h6>

          <div class="help-block">Rules are applied in order — later rules take priority.</div>

          <div class="help-block">
            <div class="help-label">Numeric properties</div>
            <code>width height x y rotation</code>
            <div class="help-ops mt-1">Operators: <code>&gt; &gt;= &lt; &lt;= == !=</code></div>
          </div>

          <div class="help-block">
            <div class="help-label">Boolean flags</div>
            <code>decal ghost stepped nub</code>
            <div class="help-ops mt-1">Use bare name to test if set.</div>
          </div>

          <div class="help-block">
            <div class="help-label">Label check</div>
            <div class="help-ops"><code>label</code> checks all positions</div>
            <div class="help-ops"><code>label[0]</code> checks one position</div>
            <div class="help-ops mt-1">Operators: <code>== != contains matches</code></div>
          </div>

          <div class="help-block">
            <div class="help-label">Logic</div>
            <code>and or not ( )</code>
          </div>

          <div class="help-block">
            <div class="help-label">Examples</div>
            <div class="help-examples">
              <code>width &gt;= 1.5</code>
              <code>width &gt;= 6 and not decal</code>
              <code>ghost or stepped</code>
              <code>label == "Esc"</code>
              <code>label[0] matches "^F\d+$"</code>
              <code>label contains "Shift"</code>
              <code>not (ghost or decal)</code>
              <code>rotation != 0</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useThemeToolsStore } from '@/stores/themeTools'
import { useDraggablePanel } from '@/composables/useDraggablePanel'
import { lightenColor, invertLightenColor } from '@/utils/color-utils'
import { getCodeMirror } from '@/utils/codemirror-loader'
import type { EditorView } from '@codemirror/view'
import ColorPicker from './ColorPicker.vue'
import JsonExpandModal from './JsonExpandModal.vue'

import BiGripVertical from 'bootstrap-icons/icons/grip-vertical.svg'
import BiPalette from 'bootstrap-icons/icons/palette.svg'
import BiQuestionCircle from 'bootstrap-icons/icons/question-circle.svg'
import BiUpload from 'bootstrap-icons/icons/upload.svg'
import BiDownload from 'bootstrap-icons/icons/download.svg'
import BiArrowsFullscreen from 'bootstrap-icons/icons/arrows-fullscreen.svg'
import { saveBlob } from '@/utils/download'

// Props
interface Props {
  visible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
})

// Emits
interface Emits {
  (e: 'close'): void
}

const emit = defineEmits<Emits>()

const themeStore = useThemeToolsStore()

// Help pane toggle
const showHelp = ref(false)

// File input ref
const fileInputRef = ref<HTMLInputElement>()
const loadError = ref<string | null>(null)

// JSON editor state
const jsonText = ref<string>('')
const jsonError = ref<string | null>(null)
const isExpandModalOpen = ref(false)

// CodeMirror
const editorContainer = ref<HTMLDivElement>()
const editorReady = ref(false)
const editorLoadError = ref(false)
let editorView: EditorView | null = null
let themeObserver: MutationObserver | null = null
// Prevents programmatic updateContent from round-tripping through handleJsonInput.
// view.dispatch() fires updateListener synchronously, so a plain boolean suffices.
let suppressOnChange = false

function getTheme(): 'dark' | 'light' {
  return document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light'
}

function syncJsonFromStore() {
  const theme = themeStore.currentTheme
  const newJson = theme ? JSON.stringify(theme, null, 2) : ''
  jsonText.value = newJson
  jsonError.value = null
  if (editorView) {
    getCodeMirror()
      .then((cm) => {
        if (editorView) {
          suppressOnChange = true
          cm.updateContent(editorView, newJson)
          suppressOnChange = false
        }
      })
      .catch(() => {})
  }
}

// Sync editor when builtin selection changes
watch(
  () => themeStore.activeBuiltinIndex,
  () => {
    syncJsonFromStore()
  },
)

// Track the theme object most recently written to the store from the editor.
// The watcher below skips sync when the incoming change came from us — comparing
// by object reference works because handleJsonInput stores the exact parsed object.
let themeFromEditor: import('@/types/theme').Theme | null = null

// Sync editor when a custom theme is loaded externally (file load)
watch(
  () => themeStore.customTheme,
  (newTheme) => {
    if (newTheme !== null && newTheme === themeFromEditor) return
    themeFromEditor = null
    syncJsonFromStore()
  },
)

// Draggable panel
const { position, panelRef, handleMouseDown, handleHeaderMouseDown, initializePosition } =
  useDraggablePanel({
    defaultPosition: { x: 100, y: 140 },
    margin: 10,
    headerHeight: 45,
  })

// Methods
const handleClose = () => {
  emit('close')
}

const handlePresetChange = (e: Event) => {
  const index = Number((e.target as HTMLSelectElement).value)
  themeStore.selectBuiltinTheme(index)
}

const handleJsonInput = (content = jsonText.value) => {
  try {
    const parsed = themeStore.parseThemeJson(content)
    jsonError.value = null
    themeFromEditor = parsed
    themeStore.loadCustomTheme(parsed)
  } catch (err) {
    jsonError.value = err instanceof Error ? err.message : 'Invalid JSON'
  }
}

const applyExpandModal = (value: string) => {
  jsonText.value = value
  if (editorView) {
    getCodeMirror()
      .then((cm) => {
        if (editorView) {
          suppressOnChange = true
          cm.updateContent(editorView, value)
          suppressOnChange = false
        }
      })
      .catch(() => {})
  }
  handleJsonInput(value)
  isExpandModalOpen.value = false
}

function makeOnChange() {
  return (newContent: string) => {
    if (suppressOnChange) return
    jsonText.value = newContent
    handleJsonInput(newContent)
  }
}

async function initEditor() {
  if (!editorContainer.value || editorView) return
  try {
    const cm = await getCodeMirror()
    if (!editorContainer.value) return
    editorView = cm.createJsonEditor(editorContainer.value, jsonText.value, getTheme(), {
      onChange: makeOnChange(),
    })
    editorReady.value = true
  } catch {
    editorLoadError.value = true
  }
}

async function rebuildEditor() {
  if (!editorContainer.value) return
  const cm = await getCodeMirror()
  if (!editorContainer.value) return
  if (editorView) {
    cm.destroyEditor(editorView)
    editorView = null
    editorContainer.value.innerHTML = ''
  }
  editorView = cm.createJsonEditor(editorContainer.value, jsonText.value, getTheme(), {
    onChange: makeOnChange(),
  })
}

function destroyEditor() {
  if (!editorView) return
  const view = editorView
  editorView = null
  editorReady.value = false
  getCodeMirror()
    .then((cm) => cm.destroyEditor(view))
    .catch(() => {})
}

const triggerFileLoad = () => {
  loadError.value = null
  fileInputRef.value?.click()
}

const handleFileChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return // Reset so the same file can be re-loaded if needed
  ;(e.target as HTMLInputElement).value = ''
  try {
    const text = await file.text()
    const theme = themeStore.parseThemeJson(text)
    // suppressJsonSync is false here so the watcher will sync the editor
    themeStore.loadCustomTheme(theme)
    loadError.value = null
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Failed to load theme'
  }
}

const handleSave = () => {
  const json = themeStore.exportThemeJson()
  const blob = new Blob([json], { type: 'application/json' })
  saveBlob(blob, `${themeStore.currentTheme?.name ?? 'theme'}.json`)
}

const handleApply = () => {
  themeStore.applyTheme()
}

// Color Calculator
const LIGHTEN_FACTOR = 1.2
const calcKleColor = ref('#cccccc')
const calcTopColor = ref(lightenColor('#cccccc', LIGHTEN_FACTOR))
const calcClampWarning = ref(false)

const handleCalcKleChange = (color: string) => {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return
  calcTopColor.value = lightenColor(color, LIGHTEN_FACTOR)
  calcClampWarning.value = false
}

const handleCalcTopChange = (color: string) => {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return
  const kle = invertLightenColor(color, LIGHTEN_FACTOR)
  calcKleColor.value = kle
  const roundTrip = lightenColor(kle, LIGHTEN_FACTOR)
  // Only warn for real clamping: tolerate ±2 per channel as normal rounding noise
  calcClampWarning.value = [0, 2, 4].some(
    (i) =>
      Math.abs(
        parseInt(roundTrip.slice(1 + i, 3 + i), 16) - parseInt(color.slice(1 + i, 3 + i), 16),
      ) > 2,
  )
}

// Keyboard shortcut: Escape to close.
//
// Skipped while the expand modal is open, so Escape dismisses only the modal.
// The inline editor is shielded by `@keydown.stop` on `.json-editor-wrapper`,
// but `JsonExpandModal` is `Teleport`ed to `<body>` — outside that wrapper — so
// its Escape reaches this document listener too. Without the guard, closing the
// modal would also unmount the whole panel and discard the editor's contents.
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.visible && !isExpandModalOpen.value) {
    handleClose()
  }
}

// Position panel and initialize/destroy editor as panel shows/hides
watch(
  () => props.visible,
  async (isVisible) => {
    if (isVisible) {
      initializePosition({ x: window.innerWidth - 420, y: 140 })
      syncJsonFromStore()
      await nextTick()
      await initEditor()
    } else {
      destroyEditor()
    }
  },
)

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  themeObserver = new MutationObserver(() => {
    if (props.visible) rebuildEditor().catch(() => {})
  })
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-bs-theme'],
  })
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  destroyEditor()
  themeObserver?.disconnect()
  themeObserver = null
})
</script>

<style scoped>
.theme-tools-panel {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
  user-select: none;
}

/* Mobile anchoring */
@media (max-width: 767.98px) {
  .theme-tools-panel {
    position: fixed !important;
    top: auto !important;
    bottom: 0 !important;
    left: 0 !important;
    right: 0 !important;
    width: 100% !important;
    height: auto !important;
    max-height: 60vh !important;
    transform: none !important;
    margin: 0 !important;
    border-radius: 0 !important;
    border-left: none !important;
    border-right: none !important;
    border-bottom: none !important;
  }

  .theme-tools-panel .panel-content {
    border-radius: 0 !important;
  }

  .theme-tools-panel .panel-columns {
    flex-direction: column !important;
    overflow-y: auto !important;
    max-height: calc(60vh - 45px) !important;
  }

  .theme-tools-panel .panel-help {
    border-left: none !important;
    border-top: 1px solid var(--bs-border-color) !important;
    width: 100% !important;
  }
}

.panel-content {
  background-color: var(--bs-body-bg);
  border-radius: 8px;
  box-shadow: var(--bs-box-shadow-lg);
  border: 1px solid var(--bs-border-color);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 380px;
}

.panel-content--expanded {
  width: 680px;
}

.panel-header {
  background-color: var(--bs-tertiary-bg);
  border-bottom: 1px solid var(--bs-border-color);
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: move;
  user-select: none;
  flex-shrink: 0;
}

.panel-title {
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0;
  color: var(--bs-text-primary);
  display: flex;
  align-items: center;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.header-btn {
  padding: 2px 4px;
  line-height: 1;
}

.drag-handle {
  color: #6c757d;
  cursor: grab;
}

.drag-handle:active {
  cursor: grabbing;
}

.panel-columns {
  display: flex;
  flex-direction: row;
  overflow: hidden;
}

.panel-main {
  width: 380px;
  flex-shrink: 0;
  padding: 12px;
  overflow-y: auto;
}

.panel-help {
  width: 300px;
  flex-shrink: 0;
  padding: 12px;
  overflow-y: auto;
  border-left: 1px solid var(--bs-border-color);
  background-color: var(--bs-tertiary-bg);
}

.section-title {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--bs-primary-color);
  margin-bottom: 8px;
}

/* JSON editor */
.json-editor-wrapper {
  position: relative;
  border: 1px solid var(--bs-border-color);
  border-radius: 4px;
  overflow: hidden;
  user-select: text;
}

.json-editor-wrapper--error {
  border-color: var(--bs-danger);
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

.editor-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 260px;
}

.cm-editor-container {
  height: 260px;
  overflow: auto;
}

.cm-editor-container :deep(.cm-editor) {
  height: 100%;
}

.cm-editor-container :deep(.cm-scroller) {
  height: 100%;
  overflow: auto;
}

/* Help pane */
.help-block {
  margin-bottom: 14px;
}

.help-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--bs-primary-color);
  margin-bottom: 4px;
}

.help-ops {
  font-size: 0.75rem;
  color: var(--bs-primary-color);
}

.help-examples {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.help-examples code,
.help-block > code {
  font-size: 0.72rem;
  display: block;
  color: var(--bs-body-color);
}

/* Color Calculator */
.color-calc-section {
  border-top: 1px solid var(--bs-border-color);
  padding-top: 12px;
  margin-top: 4px;
}

.color-calc-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-calc-col {
  flex: 1;
  min-width: 0;
}

.color-calc-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--bs-primary-color);
  margin-bottom: 4px;
}

.color-calc-arrow {
  font-size: 1.1rem;
  color: var(--bs-secondary-color);
  flex-shrink: 0;
  user-select: none;
  padding-top: 18px;
}
</style>
