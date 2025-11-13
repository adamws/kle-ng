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
import { getKeyCenter, getKeyDistance } from '@/utils/keyboard-geometry'

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

// Debug options
const debugOptions = ref<{
  markerSize: number
  markerColor: string
  showLabels: boolean
  showDistances: boolean
} | null>(null)

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

  // Render if we have either markers or a line to draw
  if (!debugOptions.value && !debugLine.value) {
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

  // Draw markers for each key (if options are set)
  if (debugOptions.value) {
    const options = debugOptions.value
    keyboardStore.keys.forEach((key: Key, index: number) => {
      if (key.decal || key.ghost) return

      // Calculate center in layout coordinates (units)
      const centerUnits = getKeyCenter(key)

      // Convert to canvas coordinates by scaling by baseUnitSize
      const centerX = centerUnits.x * baseUnitSize
      const centerY = centerUnits.y * baseUnitSize

      // Draw crosshair
      ctx.strokeStyle = options.markerColor
      ctx.lineWidth = 2 / props.zoom // Scale line width to remain constant visual size
      ctx.beginPath()
      ctx.moveTo(centerX - options.markerSize * 1.5, centerY)
      ctx.lineTo(centerX + options.markerSize * 1.5, centerY)
      ctx.moveTo(centerX, centerY - options.markerSize * 1.5)
      ctx.lineTo(centerX, centerY + options.markerSize * 1.5)
      ctx.stroke()

      // Draw labels
      if (options.showLabels) {
        ctx.fillStyle = '#000000'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2 / props.zoom
        ctx.font = `bold ${9 / props.zoom}px monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'

        const label = `${index}`
        const labelY = centerY - options.markerSize * 2

        // Draw text outline
        ctx.strokeText(label, centerX, labelY)
        // Draw text fill
        ctx.fillText(label, centerX, labelY)

        // Draw key center position in units
        const posLabel = `(${centerUnits.x.toFixed(2)}, ${centerUnits.y.toFixed(2)})`
        ctx.font = `${8 / props.zoom}px monospace`
        ctx.textBaseline = 'top'
        const posLabelY = centerY + options.markerSize * 2
        ctx.strokeText(posLabel, centerX, posLabelY)
        ctx.fillText(posLabel, centerX, posLabelY)

        // If key is rotated, show rotation info
        if (key.rotation_angle && key.rotation_angle !== 0) {
          const rotLabel = `r:${key.rotation_angle}°`
          ctx.font = `italic ${7 / props.zoom}px monospace`
          ctx.fillStyle = '#0066cc'
          ctx.strokeText(rotLabel, centerX, posLabelY + 10 / props.zoom)
          ctx.fillText(rotLabel, centerX, posLabelY + 10 / props.zoom)
        }
      }

      // Draw distances to adjacent keys
      if (options.showDistances && index < keyboardStore.keys.length - 1) {
        const nextKey = keyboardStore.keys[index + 1]
        if (!nextKey) return
        if (!nextKey.decal && !nextKey.ghost) {
          const distanceUnits = getKeyDistance(key, nextKey)
          const nextCenterUnits = getKeyCenter(nextKey)

          const nextCenterX = nextCenterUnits.x * baseUnitSize
          const nextCenterY = nextCenterUnits.y * baseUnitSize

          // Draw line between centers
          ctx.strokeStyle = 'rgba(0, 150, 0, 0.5)'
          ctx.lineWidth = 1 / props.zoom
          ctx.setLineDash([4 / props.zoom, 4 / props.zoom])
          ctx.beginPath()
          ctx.moveTo(centerX, centerY)
          ctx.lineTo(nextCenterX, nextCenterY)
          ctx.stroke()
          ctx.setLineDash([])

          // Draw distance label
          const midX = (centerX + nextCenterX) / 2
          const midY = (centerY + nextCenterY) / 2
          const distLabel = `${distanceUnits.toFixed(2)}u`

          ctx.fillStyle = '#006600'
          ctx.strokeStyle = '#ffffff'
          ctx.font = `bold ${10 / props.zoom}px monospace`
          ctx.lineWidth = 2 / props.zoom
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.strokeText(distLabel, midX, midY)
          ctx.fillText(distLabel, midX, midY)
        }
      }
    })
  }

  ctx.restore()
}

/**
 * Set debug options and enable rendering
 */
const setDebugOptions = (options: {
  markerSize?: number
  markerColor?: string
  showLabels?: boolean
  showDistances?: boolean
}) => {
  debugOptions.value = {
    markerSize: options.markerSize ?? 8,
    markerColor: options.markerColor ?? '#ff0000',
    showLabels: options.showLabels ?? true,
    showDistances: options.showDistances ?? false,
  }
  nextTick(() => {
    renderDebugMarkers()
  })
}

/**
 * Clear debug markers
 */
const clearDebugMarkers = () => {
  debugOptions.value = null
  if (overlayCanvasRef.value) {
    const ctx = overlayCanvasRef.value.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, overlayCanvasRef.value.width, overlayCanvasRef.value.height)
    }
  }
}

// Watch for changes that require re-rendering
watch(
  [() => props.zoom, () => props.canvasWidth, () => props.canvasHeight, () => keyboardStore.keys],
  () => {
    if (debugOptions.value || debugLine.value) {
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
  setDebugOptions,
  clearDebugMarkers,
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
