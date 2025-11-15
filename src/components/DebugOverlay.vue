<template>
  <canvas
    v-if="visible"
    ref="overlayCanvasRef"
    :width="canvasWidth"
    :height="canvasHeight"
    class="debug-overlay-canvas"
  />
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useKeyboardStore, type Key } from '@/stores/keyboard'
import { getKeyCenter } from '@/utils/keyboard-geometry'

interface Props {
  visible: boolean
  canvasWidth: number
  canvasHeight: number
  zoom: number
  coordinateOffset: { x: number; y: number }
}

const props = defineProps<Props>()

const keyboardStore = useKeyboardStore()
const overlayCanvasRef = ref<HTMLCanvasElement>()

// Line drawing state
const debugLine = ref<{
  point1: { x: number; y: number }
  point2: { x: number; y: number }
  lineColor: string
  showKeyLabels: boolean
  intersectingKeys: Key[]
} | null>(null)

// Base unit size in pixels (must match KeyboardCanvas.vue)
const baseUnitSize = 54

/**
 * Render debug visualizations on the overlay canvas
 */
const renderDebugMarkers = () => {
  if (!overlayCanvasRef.value) {
    return
  }

  // Render if we have a line to draw
  if (!debugLine.value) {
    return
  }

  const canvas = overlayCanvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    console.error('DebugOverlay: Could not get 2d context')
    return
  }

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (keyboardStore.keys.length === 0) {
    return
  }

  // Use the coordinate offset from props (calculated by KeyboardCanvas)
  // This ensures we use the same transform as the main canvas
  const coordinateOffsetX = props.coordinateOffset.x
  const coordinateOffsetY = props.coordinateOffset.y

  // Save canvas state
  ctx.save()

  // Apply the EXACT same transform as KeyboardCanvas.vue
  ctx.setTransform(
    props.zoom,
    0,
    0,
    props.zoom,
    coordinateOffsetX * props.zoom,
    coordinateOffsetY * props.zoom,
  )

  // Draw debug line if present
  if (debugLine.value) {
    const line = debugLine.value

    // Convert layout units to canvas pixels
    const startX = line.point1.x * baseUnitSize
    const startY = line.point1.y * baseUnitSize
    const endX = line.point2.x * baseUnitSize
    const endY = line.point2.y * baseUnitSize

    // Draw the line
    ctx.strokeStyle = line.lineColor
    ctx.lineWidth = 3 / props.zoom
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.lineTo(endX, endY)
    ctx.stroke()

    // Draw start/end points
    ctx.fillStyle = line.lineColor
    ctx.beginPath()
    ctx.arc(startX, startY, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(endX, endY, 5, 0, Math.PI * 2)
    ctx.fill()

    // Highlight intersecting keys
    line.intersectingKeys.forEach((key) => {
      const centerUnits = getKeyCenter(key)
      const centerX = centerUnits.x * baseUnitSize
      const centerY = centerUnits.y * baseUnitSize

      // Draw semi-transparent yellow circle
      ctx.fillStyle = 'rgba(255, 255, 0, 0.3)'
      ctx.strokeStyle = '#ffcc00'
      ctx.lineWidth = 2 / props.zoom
      ctx.beginPath()
      ctx.arc(centerX, centerY, 12, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      // Draw label if enabled
      if (line.showKeyLabels) {
        const keyIndex = keyboardStore.keys.indexOf(key)
        ctx.fillStyle = '#000000'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2 / props.zoom
        ctx.font = `bold ${10 / props.zoom}px monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        const label = `#${keyIndex}`
        ctx.strokeText(label, centerX, centerY)
        ctx.fillText(label, centerX, centerY)
      }
    })
  }

  ctx.restore()
}

// Watch for changes that require re-rendering
watch(
  [() => props.zoom, () => props.canvasWidth, () => props.canvasHeight, () => keyboardStore.keys],
  () => {
    if (debugLine.value) {
      nextTick(() => {
        renderDebugMarkers()
      })
    }
  },
  { deep: true },
)

// Direct method for drawing debug line
const drawDebugLine = (lineData: {
  point1: { x: number; y: number }
  point2: { x: number; y: number }
  lineColor: string
  showKeyLabels: boolean
  intersectingKeys: Key[]
}) => {
  debugLine.value = lineData
  nextTick(() => {
    renderDebugMarkers()
  })
}

// Direct method for clearing debug line
const clearDebugLine = () => {
  debugLine.value = null
  nextTick(() => {
    renderDebugMarkers()
  })
}

defineExpose({
  drawDebugLine,
  clearDebugLine,
})
</script>

<style scoped>
.debug-overlay-canvas {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 100;
}
</style>
