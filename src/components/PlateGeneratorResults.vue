<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usePlateGeneratorStore } from '@/stores/plateGenerator'
import { useKeyboardStore } from '@/stores/keyboard'
import { storeToRefs } from 'pinia'
import BiInfoCircle from 'bootstrap-icons/icons/info-circle.svg'
import BiArrowsFullscreen from 'bootstrap-icons/icons/arrows-fullscreen.svg'
import PlateCustomOutlineOverlay from './PlateCustomOutlineOverlay.vue'

const plateStore = usePlateGeneratorStore()
const { generationState, settings, outlineTabActive } = storeToRefs(plateStore)

const keyboardStore = useKeyboardStore()
const spacingX = computed(() => keyboardStore.metadata.spacing_x || 19.05)
const spacingY = computed(() => keyboardStore.metadata.spacing_y || 19.05)

const isLoading = computed(
  () => generationState.value.status === 'loading' || generationState.value.status === 'generating',
)

const isSuccess = computed(() => generationState.value.status === 'success')

const isIdle = computed(() => generationState.value.status === 'idle')

const isRegenerating = computed(
  () => generationState.value.status === 'generating' && generationState.value.result != null,
)

const result = computed(() => generationState.value.result)

const isCustomOutline = computed(() => settings.value.outline.type === 'custom')

const svgViewBox = computed(() => {
  const match = result.value?.svgPreview.match(/viewBox="([^"]+)"/)
  return match?.[1] ?? '0 0 100 100'
})

// --- Zoom / Pan ---

const svgPreviewInnerRef = ref<HTMLElement | null>(null)
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
const lastMousePos = ref({ x: 0, y: 0 })

const transformStyle = computed(
  () => `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
)

function resetView() {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

// Only reset on first generation (null → result); don't reset on re-generates from corner edits
watch(result, (newResult, oldResult) => {
  if (oldResult === null && newResult !== null) resetView()
})

function handleWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY < 0 ? 1.15 : 1 / 1.15
  const newZoom = Math.min(Math.max(zoom.value * delta, 0.15), 10)
  const ratio = newZoom / zoom.value
  const inner = svgPreviewInnerRef.value!
  const parentRect = (inner.offsetParent as HTMLElement).getBoundingClientRect()
  const lx = e.clientX - parentRect.left - inner.offsetLeft
  const ly = e.clientY - parentRect.top - inner.offsetTop
  panX.value = panX.value * ratio + lx * (1 - ratio)
  panY.value = panY.value * ratio + ly * (1 - ratio)
  zoom.value = newZoom
}

function handlePanStart(e: MouseEvent) {
  const isMid = e.button === 1
  const isLeft = e.button === 0
  const overlayActive = isCustomOutline.value && outlineTabActive.value
  if (!isMid && !(isLeft && !overlayActive)) return
  e.preventDefault()
  isPanning.value = true
  lastMousePos.value = { x: e.clientX, y: e.clientY }
}

function handlePanMove(e: MouseEvent) {
  if (!isPanning.value) return
  panX.value += e.clientX - lastMousePos.value.x
  panY.value += e.clientY - lastMousePos.value.y
  lastMousePos.value = { x: e.clientX, y: e.clientY }
}

function handlePanEnd() {
  isPanning.value = false
}
</script>

<template>
  <div class="plate-generator-results">
    <!-- Loading State (first run only, no previous result) -->
    <div v-if="isLoading && !isRegenerating" class="loading-wrapper">
      <p class="text-muted mt-3 text-center">
        {{ generationState.status === 'loading' ? 'Loading library...' : 'Generating plate...' }}
      </p>
    </div>

    <!-- SVG Preview (shown when successful OR regenerating with previous result) -->
    <div
      v-else-if="(isSuccess || isRegenerating) && result"
      class="svg-preview-container"
      :class="{ regenerating: isRegenerating, panning: isPanning }"
      @wheel.prevent="handleWheel"
      @mousedown="handlePanStart"
      @mousemove="handlePanMove"
      @mouseup="handlePanEnd"
      @mouseleave="handlePanEnd"
    >
      <div v-if="isRegenerating" class="regenerating-overlay">
        <p class="text-muted small mb-0">Generating plate...</p>
      </div>
      <div
        class="svg-preview-inner"
        ref="svgPreviewInnerRef"
        :style="{ transform: transformStyle, transformOrigin: '0 0' }"
      >
        <div v-html="result.svgPreview" class="svg-preview-html"></div>
        <PlateCustomOutlineOverlay
          v-if="isCustomOutline && outlineTabActive"
          :view-box-str="svgViewBox"
          :spacing-x="spacingX"
          :spacing-y="spacingY"
          :svg-origin-x="result.svgOriginX"
          :svg-origin-y="result.svgOriginY"
          :keys="keyboardStore.keys"
        />
      </div>

      <!-- Reset view button — outside transformed inner, always at same position -->
      <button class="reset-view-btn" title="Reset view" @click.stop="resetView">
        <BiArrowsFullscreen />
      </button>
    </div>

    <!-- Idle State -->
    <div v-else-if="isIdle" class="idle-wrapper">
      <BiInfoCircle class="mb-2" />
      <p class="small text-center mb-0">
        Click "Generate" to create switch cutouts and outlines from your keyboard layout.
      </p>
    </div>

  </div>
</template>

<style scoped>
.plate-generator-results {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.loading-wrapper {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

/* SVG preview container - fills available height */
.svg-preview-container {
  flex-grow: 1;
  min-height: 250px;
  padding: 1rem;
  border: 1px solid var(--bs-border-color);
  border-radius: 0.375rem;
  background: var(--bs-tertiary-bg);
  overflow: hidden;
  position: relative;
  cursor: grab;
}

.svg-preview-container.panning {
  cursor: grabbing;
}

/* Inner wrapper for overlay positioning */
.svg-preview-inner {
  position: relative;
  width: 100%;
  height: 100%;
}

.svg-preview-html {
  width: 100%;
  height: 100%;
}

.svg-preview-container.regenerating {
  position: relative;
}

.reset-view-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  background: var(--bs-secondary-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 0.25rem;
  color: var(--bs-secondary-color);
  opacity: 0.8;
  cursor: pointer;
}

.reset-view-btn:hover {
  opacity: 1;
  background: var(--bs-tertiary-bg);
}

.reset-view-btn svg {
  width: 0.9rem;
  height: 0.9rem;
}

.regenerating-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  text-align: center;
  z-index: 1;
}

/* SVG fills container and maintains aspect ratio via viewBox */
.svg-preview-container :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

.idle-wrapper {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: var(--bs-secondary-color);
}

.idle-wrapper svg {
  width: 32px;
  height: 32px;
}

</style>
