<template>
  <svg
    v-if="visible"
    ref="overlayRef"
    class="curve-layout-overlay"
    data-testid="curve-layout-overlay"
    :width="canvasWidth"
    :height="canvasHeight"
  >
    <!-- Control polygon: each inner handle is tethered to the endpoint it steers. -->
    <line
      v-for="tether in tethers"
      :key="tether.key"
      class="control-tether"
      :x1="tether.x1"
      :y1="tether.y1"
      :x2="tether.x2"
      :y2="tether.y2"
    />

    <path class="spine-halo" :d="pathData" />
    <path class="spine" :d="pathData" />

    <template v-for="(point, index) in screenPoints" :key="index">
      <g
        class="handle"
        :class="{ endpoint: index === 0 || index === 3, active: dragging === index }"
        :data-testid="`curve-layout-handle-${index}`"
        @pointerdown.stop.prevent="startDrag(index, $event)"
      >
        <circle :cx="point.x" :cy="point.y" :r="index === 0 || index === 3 ? 9 : 7" />
      </g>
    </template>
  </svg>
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import { useCurveLayoutStore } from '@/stores/curveLayout'

interface Props {
  visible: boolean
  canvasWidth: number
  canvasHeight: number
  zoom: number
  unit: number
  coordinateOffset: { x: number; y: number }
}

const props = defineProps<Props>()
const emit = defineEmits<{ dragStateChange: [dragging: boolean] }>()

const curveStore = useCurveLayoutStore()
const overlayRef = ref<SVGSVGElement>()
const dragging = ref<number | null>(null)

/** Layout units to canvas pixels — the same mapping the matrix overlay uses. */
const toScreen = (point: { x: number; y: number }) => ({
  x: (point.x * props.unit + props.coordinateOffset.x) * props.zoom,
  y: (point.y * props.unit + props.coordinateOffset.y) * props.zoom,
})

const screenPoints = computed(() => curveStore.spine.map(toScreen))

const pathData = computed(() => {
  const [start, control1, control2, end] = screenPoints.value
  if (!start || !control1 || !control2 || !end) return ''
  return `M ${start.x} ${start.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${end.x} ${end.y}`
})

const tethers = computed(() => {
  const points = screenPoints.value
  if (points.length < 4) return []
  return [
    { key: 'start', x1: points[0]!.x, y1: points[0]!.y, x2: points[1]!.x, y2: points[1]!.y },
    { key: 'end', x1: points[3]!.x, y1: points[3]!.y, x2: points[2]!.x, y2: points[2]!.y },
  ]
})

// Pointer sampling, SVG updates and re-solving are coalesced into one update per animation
// frame. A pointermove can fire several times per frame, and re-solving the whole layout on
// every one of them is wasted work that only makes the drag feel worse.
let pendingFrame: number | null = null
let pendingEvent: { clientX: number; clientY: number } | null = null

const flush = () => {
  pendingFrame = null
  const index = dragging.value
  if (index === null || !pendingEvent || !overlayRef.value) return

  const { clientX, clientY } = pendingEvent
  pendingEvent = null

  const rect = overlayRef.value.getBoundingClientRect()
  curveStore.setSpinePoint(index, {
    x: ((clientX - rect.left) / props.zoom - props.coordinateOffset.x) / props.unit,
    y: ((clientY - rect.top) / props.zoom - props.coordinateOffset.y) / props.unit,
  })
}

const schedule = (event: PointerEvent) => {
  pendingEvent = { clientX: event.clientX, clientY: event.clientY }
  if (pendingFrame === null) pendingFrame = requestAnimationFrame(flush)
}

const stopDrag = () => {
  if (dragging.value === null) return

  if (pendingFrame !== null) {
    cancelAnimationFrame(pendingFrame)
    pendingFrame = null
    flush()
  }

  dragging.value = null
  pendingEvent = null
  curveStore.isDraggingHandle = false
  window.removeEventListener('pointermove', schedule)
  window.removeEventListener('pointerup', stopDrag)
  window.removeEventListener('pointercancel', stopDrag)
  emit('dragStateChange', false)
}

const startDrag = (index: number, event: PointerEvent) => {
  dragging.value = index
  curveStore.isDraggingHandle = true
  emit('dragStateChange', true)

  // Listen on the window so the drag survives the pointer leaving the small handle target.
  window.addEventListener('pointermove', schedule)
  window.addEventListener('pointerup', stopDrag)
  window.addEventListener('pointercancel', stopDrag)
  schedule(event)
}

onUnmounted(stopDrag)
</script>

<style scoped>
.curve-layout-overlay {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 15;
  /* Only the handles are interactive; clicks elsewhere belong to the canvas. */
  pointer-events: none;
  overflow: visible;
}

/*
 * A casing under the spine keeps it readable over dark keycaps. It carries the same dash
 * pattern as the spine so it sits only under the dashes — a solid casing would fill the gaps
 * and the spine would read as a solid line instead of a dashed one.
 */
.spine-halo {
  fill: none;
  stroke: var(--bs-body-bg);
  stroke-width: 5;
  stroke-dasharray: 8 5;
  /* Butt caps, unlike the spine's round ones: a round cap would extend the casing half its
     width past each dash and close the gaps the dash pattern exists to create. */
  stroke-linecap: butt;
  opacity: 0.75;
}

.spine {
  fill: none;
  stroke: var(--bs-primary);
  stroke-width: 2.5;
  stroke-dasharray: 8 5;
  stroke-linecap: round;
}

.control-tether {
  stroke: var(--bs-primary);
  stroke-width: 1.5;
  stroke-dasharray: 3 3;
  opacity: 0.6;
}

.handle {
  pointer-events: all;
  cursor: grab;
  touch-action: none;
}

.handle circle {
  fill: var(--bs-body-bg);
  stroke: var(--bs-primary);
  stroke-width: 3;
}

.handle.endpoint circle {
  fill: var(--bs-primary);
  stroke: var(--bs-body-bg);
}

.handle:hover circle {
  stroke: var(--bs-primary-border-subtle);
}

.handle.active {
  cursor: grabbing;
}
</style>
