<template>
  <canvas
    v-show="visible"
    ref="canvasRef"
    class="matrix-annotation-overlay"
    :width="canvasWidth"
    :height="canvasHeight"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { type Key } from '@/stores/keyboard'
import type { CanvasRenderer } from '@/utils/canvas-renderer'
import { getKeyCenter as calculateKeyCenter } from '@/utils/keyboard-geometry'

// Props
interface Props {
  visible: boolean
  canvasWidth: number
  canvasHeight: number
  zoom: number
  panX: number
  panY: number
  coordinateOffset: { x: number; y: number }
  renderer: CanvasRenderer | null
}

const props = defineProps<Props>()

// Refs
const canvasRef = ref<HTMLCanvasElement>()

// Matrix data to visualize
const matrixRows = ref<Map<number, Key[]>>(new Map())
const matrixCols = ref<Map<number, Key[]>>(new Map())

// Computed
const ctx = computed(() => canvasRef.value?.getContext('2d'))

// Get key center in canvas coordinates (pixels)
const getKeyCenter = (key: Key): { x: number; y: number } => {
  if (!props.renderer) return { x: 0, y: 0 }
  const centerUnits = calculateKeyCenter(key)
  const unit = props.renderer.getOptions().unit
  // Convert from layout units to canvas pixels
  return {
    x: centerUnits.x * unit,
    y: centerUnits.y * unit,
  }
}

// Rendering
const renderCanvas = () => {
  if (!ctx.value || !canvasRef.value) return

  // Clear canvas
  ctx.value.save()
  ctx.value.setTransform(1, 0, 0, 1, 0, 0)
  ctx.value.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
  ctx.value.restore()

  // Apply same transform as main canvas
  ctx.value.save()
  ctx.value.setTransform(
    props.zoom,
    0,
    0,
    props.zoom,
    props.panX + props.coordinateOffset.x * props.zoom,
    props.panY + props.coordinateOffset.y * props.zoom,
  )

  // Render rows (blue)
  matrixRows.value.forEach((keys) => {
    renderRow(keys)
  })

  // Render columns (green)
  matrixCols.value.forEach((keys) => {
    renderColumn(keys)
  })

  ctx.value.restore()
}

// Render a row (blue line connecting keys)
const renderRow = (keys: Key[]) => {
  if (!ctx.value || keys.length === 0) return

  const path = keys.map((key) => getKeyCenter(key))

  const lineColor = '#007bff' // Blue
  const lineWidth = 2
  const circleRadius = 5

  // Draw line segments
  ctx.value.strokeStyle = lineColor
  ctx.value.lineWidth = lineWidth
  ctx.value.beginPath()

  path.forEach((point, i) => {
    if (i === 0) {
      ctx.value!.moveTo(point.x, point.y)
    } else {
      ctx.value!.lineTo(point.x, point.y)
    }
  })

  ctx.value.stroke()

  // Draw key markers
  path.forEach((point) => {
    ctx.value!.fillStyle = lineColor
    ctx.value!.strokeStyle = '#ffffff'
    ctx.value!.lineWidth = 2
    ctx.value!.beginPath()
    ctx.value!.arc(point.x, point.y, circleRadius, 0, Math.PI * 2)
    ctx.value!.fill()
    ctx.value!.stroke()
  })
}

// Render a column (green line connecting keys)
const renderColumn = (keys: Key[]) => {
  if (!ctx.value || keys.length === 0) return

  const path = keys.map((key) => getKeyCenter(key))

  const lineColor = '#28a745' // Green
  const lineWidth = 2
  const circleRadius = 5

  // Draw line segments
  ctx.value.strokeStyle = lineColor
  ctx.value.lineWidth = lineWidth
  ctx.value.beginPath()

  path.forEach((point, i) => {
    if (i === 0) {
      ctx.value!.moveTo(point.x, point.y)
    } else {
      ctx.value!.lineTo(point.x, point.y)
    }
  })

  ctx.value.stroke()

  // Draw key markers
  path.forEach((point) => {
    ctx.value!.fillStyle = lineColor
    ctx.value!.strokeStyle = '#ffffff'
    ctx.value!.lineWidth = 2
    ctx.value!.beginPath()
    ctx.value!.arc(point.x, point.y, circleRadius, 0, Math.PI * 2)
    ctx.value!.fill()
    ctx.value!.stroke()
  })
}

// Watch for canvas property changes
watch(
  () => [props.canvasWidth, props.canvasHeight, props.zoom, props.panX, props.panY],
  () => {
    nextTick(() => {
      renderCanvas()
    })
  },
)

watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) {
      nextTick(() => {
        renderCanvas()
      })
    }
  },
)

// Public method to set matrix data
const setMatrixData = (rows: Map<number, Key[]>, cols: Map<number, Key[]>) => {
  matrixRows.value = rows
  matrixCols.value = cols
  nextTick(() => {
    renderCanvas()
  })
}

// Expose public methods
defineExpose({
  setMatrixData,
  renderCanvas,
})

// Initial render
onMounted(() => {
  renderCanvas()
})
</script>

<style scoped>
.matrix-annotation-overlay {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none; /* No interaction - visualization only */
  z-index: 10;
}
</style>
