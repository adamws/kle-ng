<script setup lang="ts">
import { ref, computed } from 'vue'
import BiZoomIn from 'bootstrap-icons/icons/zoom-in.svg'
import BiZoomOut from 'bootstrap-icons/icons/zoom-out.svg'

interface Props {
  frontSvg: string | null
  backSvg: string | null
  schematicSvg: string | null
}

const props = defineProps<Props>()

type ViewType = 'front' | 'back' | 'schematic'

const currentView = ref<ViewType>('schematic')
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
const lastMouseX = ref(0)
const lastMouseY = ref(0)

const currentSvgUrl = computed(() => {
  switch (currentView.value) {
    case 'front':
      return props.frontSvg
    case 'back':
      return props.backSvg
    case 'schematic':
      return props.schematicSvg
    default:
      return null
  }
})

function setView(view: ViewType) {
  currentView.value = view
}

function zoomIn() {
  zoom.value = Math.min(zoom.value + 0.25, 3)
}

function zoomOut() {
  zoom.value = Math.max(zoom.value - 0.25, 0.25)
}

function resetView() {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

function handleMouseDown(event: MouseEvent) {
  isPanning.value = true
  lastMouseX.value = event.clientX
  lastMouseY.value = event.clientY
  event.preventDefault()
}

function handleMouseMove(event: MouseEvent) {
  if (!isPanning.value) return

  const deltaX = event.clientX - lastMouseX.value
  const deltaY = event.clientY - lastMouseY.value

  panX.value += deltaX
  panY.value += deltaY

  lastMouseX.value = event.clientX
  lastMouseY.value = event.clientY
}

function handleMouseUp() {
  isPanning.value = false
}

const transformStyle = computed(() => {
  return `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`
})

const containerBackgroundClass = computed(() => {
  // Darker background for front and back, lighter for schematic
  return currentView.value === 'schematic' ? 'svg-container-schematic' : 'svg-container-pcb'
})
</script>

<template>
  <div class="pcb-render-viewer">
    <div class="pcb-render-viewer-buttons">
      <!-- View Toggle Buttons -->
      <div class="btn-group" role="group">
        <button
          type="button"
          class="btn btn-sm"
          :class="{
            'btn-primary': currentView === 'schematic',
            'btn-outline-primary': currentView !== 'schematic',
          }"
          @click="setView('schematic')"
        >
          Schematic
        </button>
        <button
          type="button"
          class="btn btn-sm"
          :class="{
            'btn-primary': currentView === 'front',
            'btn-outline-primary': currentView !== 'front',
          }"
          @click="setView('front')"
        >
          Front
        </button>
        <button
          type="button"
          class="btn btn-sm"
          :class="{
            'btn-primary': currentView === 'back',
            'btn-outline-primary': currentView !== 'back',
          }"
          @click="setView('back')"
        >
          Back
        </button>
      </div>

      <!-- Zoom Controls -->
      <div class="btn-group ms-2" role="group">
        <button type="button" class="btn btn-sm btn-outline-primary" @click="zoomOut">
          <BiZoomOut />
        </button>
        <button type="button" class="btn btn-sm btn-outline-primary" @click="resetView">
          Reset
        </button>
        <button type="button" class="btn btn-sm btn-outline-primary" @click="zoomIn">
          <BiZoomIn />
        </button>
      </div>
    </div>

    <!-- SVG Viewer -->
    <div
      class="svg-container"
      :class="containerBackgroundClass"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
    >
      <div v-if="currentSvgUrl" class="svg-wrapper" :style="{ transform: transformStyle }">
        <img :src="currentSvgUrl" alt="PCB Render" />
      </div>
      <div v-else class="text-muted text-center p-4">
        No render available for {{ currentView }} view
      </div>
    </div>
  </div>
</template>

<style scoped>
.pcb-render-viewer {
  position: relative;
}

.pcb-render-viewer-buttons {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 99;

  display: flex;
  align-items: center;

  background-color: var(--bs-secondary-bg);

  padding: 0.5rem;
  border-radius: 0.375rem;
  box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.15);
}

.svg-container {
  width: 100%;
  height: 500px;
  border: 1px solid var(--bs-border-color);
  border-radius: 0.375rem;
  overflow: hidden;
  position: relative;
  cursor: grab;
}

.svg-container-schematic {
  background-color: #f5f4ef;
}

.svg-container-pcb {
  background-color: #2b2b2b;
}

.svg-container:active {
  cursor: grabbing;
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
</style>
