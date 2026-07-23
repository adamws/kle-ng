<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { SchematicView } from '@/types/pcb'
import BiZoomIn from 'bootstrap-icons/icons/zoom-in.svg'
import BiZoomOut from 'bootstrap-icons/icons/zoom-out.svg'
import BiArrowCounterclockwise from 'bootstrap-icons/icons/arrow-counterclockwise.svg'

interface Props {
  frontSvg: string | null
  backSvg: string | null
  // One entry per schematic sheet (root first). Multi-sheet projects (e.g. the
  // LED chain) supply several; single-sheet projects supply exactly one.
  schematics: SchematicView[]
}

const props = defineProps<Props>()

type ViewKind = 'schematic' | 'front' | 'back'

interface Tab {
  key: string // unique tab id: schematic render name, or 'front' / 'back'
  label: string
  kind: ViewKind
  schematicIndex: number // index into props.schematics (-1 for PCB tabs)
}

const containerRef = ref<HTMLElement | null>(null)
// Selected tab, tracked by key so it survives changes to the tab set.
const currentTabKey = ref<string>('')
const isPanning = ref(false)
const lastMouseX = ref(0)
const lastMouseY = ref(0)
const controlsActive = ref(false)

// Schematic and PCB (front/back) have independent zoom/pan state
const schematicState = ref({ zoom: 1, panX: 0, panY: 0 })
const pcbState = ref({ zoom: 1, panX: 0, panY: 0 })

let wheelHandler: ((e: WheelEvent) => void) | null = null
let documentDeactivateHandler: ((e: PointerEvent) => void) | null = null

// Flat tab list: one tab per schematic sheet, then the two PCB views. Each
// schematic sheet is a top-level tab; when there is more than one sheet the root
// is labelled "Main" (e.g. Main / Key Matrix / LED Chain / PCB Front / PCB Back),
// otherwise it keeps its plain "Schematic" label.
const tabs = computed<Tab[]>(() => {
  const multiSheet = props.schematics.length > 1
  const schematicTabs: Tab[] = props.schematics.map((schematic, index) => ({
    key: schematic.name,
    label: multiSheet && schematic.sheet === '' ? 'Main' : schematic.label,
    kind: 'schematic',
    schematicIndex: index,
  }))

  return [
    ...schematicTabs,
    { key: 'front', label: 'PCB Front', kind: 'front', schematicIndex: -1 },
    { key: 'back', label: 'PCB Back', kind: 'back', schematicIndex: -1 },
  ]
})

const currentTab = computed<Tab | null>(
  () => tabs.value.find((tab) => tab.key === currentTabKey.value) ?? tabs.value[0] ?? null,
)

// Default / repair the selection when the tab set changes (e.g. a new task with
// a different number of sheets). Defaults to the first schematic sheet.
watch(
  tabs,
  (list) => {
    if (!list.some((tab) => tab.key === currentTabKey.value)) {
      currentTabKey.value = list[0]?.key ?? ''
    }
  },
  { immediate: true },
)

const viewState = computed(() =>
  currentTab.value?.kind === 'schematic' ? schematicState.value : pcbState.value,
)

const currentSvgUrl = computed(() => {
  const tab = currentTab.value
  if (!tab) return null
  if (tab.kind === 'front') return props.frontSvg
  if (tab.kind === 'back') return props.backSvg
  return props.schematics[tab.schematicIndex]?.url ?? null
})

function setTab(tab: Tab) {
  if (tab.key === currentTabKey.value) return
  // Reset schematic pan/zoom when switching to a different schematic sheet so it
  // starts framed (sheets differ in size).
  if (tab.kind === 'schematic') {
    schematicState.value = { zoom: 1, panX: 0, panY: 0 }
  }
  currentTabKey.value = tab.key
}

function zoomIn() {
  viewState.value.zoom = Math.min(viewState.value.zoom + 0.25, 3)
}

function zoomOut() {
  viewState.value.zoom = Math.max(viewState.value.zoom - 0.25, 0.25)
}

function resetView() {
  viewState.value.zoom = 1
  viewState.value.panX = 0
  viewState.value.panY = 0
}

function activateControls() {
  if (controlsActive.value) return
  controlsActive.value = true
  wheelHandler = (e: WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.25 : 0.25
    viewState.value.zoom = Math.min(Math.max(viewState.value.zoom + delta, 0.25), 3)
  }
  containerRef.value?.addEventListener('wheel', wheelHandler, { passive: false })
}

function deactivateControls() {
  if (!controlsActive.value) return
  controlsActive.value = false
  isPanning.value = false
  if (wheelHandler && containerRef.value) {
    containerRef.value.removeEventListener('wheel', wheelHandler)
    wheelHandler = null
  }
}

onMounted(() => {
  documentDeactivateHandler = (e: PointerEvent) => {
    if (controlsActive.value && !containerRef.value?.contains(e.target as Node)) {
      deactivateControls()
    }
  }
  document.addEventListener('pointerdown', documentDeactivateHandler)
})

onUnmounted(() => {
  if (documentDeactivateHandler) {
    document.removeEventListener('pointerdown', documentDeactivateHandler)
  }
  deactivateControls()
})

function handleMouseDown(event: MouseEvent) {
  activateControls()
  isPanning.value = true
  lastMouseX.value = event.clientX
  lastMouseY.value = event.clientY
  event.preventDefault()
}

function handleMouseMove(event: MouseEvent) {
  if (!isPanning.value) return

  const deltaX = event.clientX - lastMouseX.value
  const deltaY = event.clientY - lastMouseY.value

  viewState.value.panX += deltaX
  viewState.value.panY += deltaY

  lastMouseX.value = event.clientX
  lastMouseY.value = event.clientY
}

function handleMouseUp() {
  isPanning.value = false
}

const transformStyle = computed(() => {
  const { panX, panY, zoom } = viewState.value
  return `translate(${panX}px, ${panY}px) scale(${zoom})`
})

const containerBackgroundClass = computed(() => {
  return currentTab.value?.kind === 'schematic' ? 'svg-container-schematic' : 'svg-container-pcb'
})
</script>

<template>
  <div ref="containerRef" class="pcb-render-viewer">
    <!-- Tab bar at top: one tab per schematic sheet, then the PCB views -->
    <div class="tab-bar" role="tablist" aria-label="Render views">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-bar-item"
        :class="{ active: tab.key === currentTabKey }"
        :aria-selected="tab.key === currentTabKey"
        role="tab"
        @click="setTab(tab)"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- SVG Viewer -->
    <div
      class="svg-container"
      :class="[containerBackgroundClass, { active: controlsActive }]"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
    >
      <div v-if="currentSvgUrl" class="svg-wrapper" :style="{ transform: transformStyle }">
        <img :src="currentSvgUrl" alt="PCB Render" />
      </div>
      <div v-else class="text-muted text-center p-4">No render available for this view</div>

      <!-- Activate hint overlay (shown when controls are inactive) -->
      <div v-if="!controlsActive" class="activate-overlay">
        <span class="activate-hint">Click to pan &middot; scroll to zoom</span>
      </div>

      <!-- Zoom controls in bottom-right corner -->
      <div class="zoom-controls" @mousedown.stop>
        <div class="btn-group btn-group-sm" role="group">
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            title="Zoom out"
            @click.stop="zoomOut"
          >
            <BiZoomOut />
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            title="Reset view"
            @click.stop="resetView"
          >
            <BiArrowCounterclockwise />
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            title="Zoom in"
            @click.stop="zoomIn"
          >
            <BiZoomIn />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pcb-render-viewer {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

/* Segmented tab bar matching PlateGeneratorResults style */
.tab-bar {
  display: flex;
  flex-wrap: wrap;
  background-color: var(--bs-secondary-bg);
  border-radius: 5px;
  padding: 3px;
  gap: 2px;
  margin-bottom: 8px;
  flex-shrink: 0;
  width: fit-content;
  max-width: 100%;
}

.tab-bar-item {
  padding: 0.25rem 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: var(--bs-secondary-color);
  background: transparent;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}

.tab-bar-item:hover:not(.active) {
  color: var(--bs-body-color);
  background-color: var(--bs-tertiary-bg);
}

.tab-bar-item.active {
  color: var(--bs-body-color);
  background-color: var(--bs-body-bg);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.svg-container {
  flex-grow: 1;
  min-height: 250px;
  border: 1px solid var(--bs-border-color);
  border-radius: 0.375rem;
  overflow: hidden;
  position: relative;
  cursor: pointer;
}

.svg-container.active {
  cursor: grab;
}

.svg-container.active:active {
  cursor: grabbing;
}

.svg-container-schematic {
  background-color: #f5f4ef;
}

.svg-container-pcb {
  background-color: #2b2b2b;
}

.svg-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-origin: center center;
  transition: transform 0.1s ease-out;
}

.svg-wrapper img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}

/* Activate hint overlay */
.activate-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 32px;
  pointer-events: none;
}

.activate-hint {
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 0.75rem;
  border-radius: 4px;
  padding: 4px 10px;
}

/* Zoom controls in bottom-right corner, same style as 3D preview */
.zoom-controls {
  position: absolute;
  bottom: 8px;
  right: 8px;
}

.zoom-controls .btn {
  padding: 4px 6px;
  display: flex;
  align-items: center;
}
</style>
