<template>
  <canvas
    v-show="visible"
    ref="canvasRef"
    class="matrix-annotation-overlay"
    :width="canvasWidth"
    :height="canvasHeight"
    @click="handleClick"
    @mousemove="handleMouseMove"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { type Key } from '@/stores/keyboard'
import type { CanvasRenderer } from '@/utils/canvas-renderer'
import { getKeyCenter as calculateKeyCenter } from '@/utils/keyboard-geometry'
import { findKeysAlongLine } from '@/utils/line-intersection'
import { useKeyboardStore } from '@/stores/keyboard'
import { useMatrixDrawingStore } from '@/stores/matrix-drawing'

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
const keyboardStore = useKeyboardStore()
const matrixDrawingStore = useMatrixDrawingStore()

// Matrix data to visualize (from VIA labels)
const matrixRows = ref<Map<number, Key[]>>(new Map())
const matrixCols = ref<Map<number, Key[]>>(new Map())

// Preview sequence (local to overlay - not part of store state)
const previewSequence = ref<Key[]>([]) // Preview of what will be added on next click

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

// Find closest key to mouse position
const findClosestKey = (canvasX: number, canvasY: number, keys: Key[]): Key | null => {
  let closestKey: Key | null = null
  let minDistance = Infinity

  for (const key of keys) {
    if (key.decal || key.ghost) continue

    const keyCenter = getKeyCenter(key)
    const distance = Math.sqrt(
      Math.pow(keyCenter.x - canvasX, 2) + Math.pow(keyCenter.y - canvasY, 2),
    )

    if (distance < minDistance) {
      minDistance = distance
      closestKey = key
    }
  }

  return closestKey
}

// Convert mouse event to canvas coordinates
const getCanvasPosition = (event: MouseEvent): { x: number; y: number } => {
  if (!canvasRef.value) return { x: 0, y: 0 }

  const rect = canvasRef.value.getBoundingClientRect()
  const screenX = event.clientX - rect.left
  const screenY = event.clientY - rect.top

  // Account for zoom, pan, and coordinate offset
  return {
    x: (screenX - props.panX - props.coordinateOffset.x * props.zoom) / props.zoom,
    y: (screenY - props.panY - props.coordinateOffset.y * props.zoom) / props.zoom,
  }
}

// Mouse move handler - show preview of next segment
const handleMouseMove = (event: MouseEvent) => {
  if (
    !matrixDrawingStore.isDrawing ||
    !props.renderer ||
    matrixDrawingStore.currentSequence.length === 0
  ) {
    // Clear preview if no active sequence
    if (previewSequence.value.length > 0) {
      previewSequence.value = []
      renderCanvas()
    }
    return
  }

  const canvasPos = getCanvasPosition(event)
  const closestKey = findClosestKey(canvasPos.x, canvasPos.y, keyboardStore.keys)

  if (!closestKey || matrixDrawingStore.currentSequence.includes(closestKey)) {
    // Clear preview if hovering over already-included key
    if (previewSequence.value.length > 0) {
      previewSequence.value = []
      renderCanvas()
    }
    return
  }

  // Calculate preview: what keys would be added if user clicks here
  const lastKey = matrixDrawingStore.currentSequence[matrixDrawingStore.currentSequence.length - 1]
  const lastKeyCenter = calculateKeyCenter(lastKey)
  const newKeyCenter = calculateKeyCenter(closestKey)

  // Find all keys along the line between the last key and the new key
  const keysAlongLine = findKeysAlongLine(
    lastKeyCenter,
    newKeyCenter,
    keyboardStore.keys,
    matrixDrawingStore.sensitivity,
  )

  // Filter out keys already in current sequence AND keys that would violate matrix rules
  const newKeys = keysAlongLine.filter(
    (key) =>
      !matrixDrawingStore.currentSequence.includes(key) &&
      matrixDrawingStore.canAddKeyToSequence(key, keyboardStore.keys),
  )

  // Update preview if it changed
  if (
    previewSequence.value.length !== newKeys.length ||
    !previewSequence.value.every((key, i) => key === newKeys[i])
  ) {
    previewSequence.value = newKeys
    renderCanvas()
  }
}

// Click handler - add keys to sequence or finish sequence
const handleClick = (event: MouseEvent) => {
  if (!matrixDrawingStore.isDrawing || !props.renderer) return

  const canvasPos = getCanvasPosition(event)
  const closestKey = findClosestKey(canvasPos.x, canvasPos.y, keyboardStore.keys)

  if (!closestKey) return

  // Check if this key can be added (doesn't violate matrix rules)
  if (!matrixDrawingStore.canAddKeyToSequence(closestKey, keyboardStore.keys)) {
    // Key is unavailable - ignore the click
    return
  }

  // If clicking on a key already in the sequence, finish the sequence
  if (matrixDrawingStore.currentSequence.includes(closestKey)) {
    if (matrixDrawingStore.currentSequence.length > 0) {
      // Complete the sequence (moves to completed array in store)
      matrixDrawingStore.completeSequence()

      // Clear preview
      previewSequence.value = []
      renderCanvas()
    }
    return
  }

  // If this is the second or later key, find all keys along the line from the last key to this one
  if (matrixDrawingStore.currentSequence.length > 0) {
    const lastKey =
      matrixDrawingStore.currentSequence[matrixDrawingStore.currentSequence.length - 1]
    const lastKeyCenter = calculateKeyCenter(lastKey)
    const newKeyCenter = calculateKeyCenter(closestKey)

    // Find all keys along the line between the last key and the new key
    const keysAlongLine = findKeysAlongLine(
      lastKeyCenter,
      newKeyCenter,
      keyboardStore.keys,
      matrixDrawingStore.sensitivity,
    )

    // Add all intersecting keys that aren't already in the sequence AND don't violate matrix rules
    keysAlongLine.forEach((key) => {
      if (
        !matrixDrawingStore.currentSequence.includes(key) &&
        matrixDrawingStore.canAddKeyToSequence(key, keyboardStore.keys)
      ) {
        matrixDrawingStore.addKeyToSequence(key)
      }
    })

    // ALWAYS add the clicked key itself, even if not in keysAlongLine
    // (This can happen with higher sensitivity where the clicked key doesn't intersect the line)
    // The clicked key has already been validated above, so we can safely add it
    if (!matrixDrawingStore.currentSequence.includes(closestKey)) {
      matrixDrawingStore.addKeyToSequence(closestKey)
    }

    // Automatically finish the sequence after second click
    matrixDrawingStore.completeSequence()

    // Clear preview, ready for next sequence
    previewSequence.value = []
  } else {
    // First key - just add it and wait for second click
    matrixDrawingStore.addKeyToSequence(closestKey)
  }

  renderCanvas()
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

  // Render VIA-annotated rows (blue)
  matrixRows.value.forEach((keys) => {
    renderRow(keys)
  })

  // Render VIA-annotated columns (green)
  matrixCols.value.forEach((keys) => {
    renderColumn(keys)
  })

  // Render completed drawn rows (blue)
  matrixDrawingStore.completedRows.forEach((keys) => {
    renderRow(keys)
  })

  // Render completed drawn columns (green)
  matrixDrawingStore.completedColumns.forEach((keys) => {
    renderColumn(keys)
  })

  // Render current sequence being drawn (yellow/orange)
  if (matrixDrawingStore.currentSequence.length > 0) {
    renderCurrentSequence(matrixDrawingStore.currentSequence)
  }

  // Render preview sequence (semi-transparent gray)
  if (previewSequence.value.length > 0) {
    renderPreviewSequence(previewSequence.value)
  }

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

// Render current sequence being drawn (orange/yellow for visibility)
const renderCurrentSequence = (keys: Key[]) => {
  if (!ctx.value || keys.length === 0) return

  const path = keys.map((key) => getKeyCenter(key))

  const lineColor = '#ffc107' // Orange/yellow for active drawing
  const lineWidth = 3 // Slightly thicker to indicate active state
  const circleRadius = 6

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

// Render preview sequence (semi-transparent gray)
const renderPreviewSequence = (keys: Key[]) => {
  if (!ctx.value || keys.length === 0) return

  const path = keys.map((key) => getKeyCenter(key))

  const lineColor = 'rgba(128, 128, 128, 0.6)' // Semi-transparent gray
  const lineWidth = 2
  const circleRadius = 5

  // Draw dashed line segments
  ctx.value.strokeStyle = lineColor
  ctx.value.lineWidth = lineWidth
  ctx.value.setLineDash([5, 5]) // Dashed line
  ctx.value.beginPath()

  // Start from the last key in the current sequence
  if (matrixDrawingStore.currentSequence.length > 0) {
    const lastKey =
      matrixDrawingStore.currentSequence[matrixDrawingStore.currentSequence.length - 1]
    const lastKeyCenter = getKeyCenter(lastKey)
    ctx.value.moveTo(lastKeyCenter.x, lastKeyCenter.y)

    // Draw line to all preview keys
    path.forEach((point) => {
      ctx.value!.lineTo(point.x, point.y)
    })
  } else {
    // If no current sequence, just draw between preview keys
    path.forEach((point, i) => {
      if (i === 0) {
        ctx.value!.moveTo(point.x, point.y)
      } else {
        ctx.value!.lineTo(point.x, point.y)
      }
    })
  }

  ctx.value.stroke()
  ctx.value.setLineDash([]) // Reset to solid line

  // Draw key markers with semi-transparent fill
  path.forEach((point) => {
    ctx.value!.fillStyle = 'rgba(128, 128, 128, 0.4)'
    ctx.value!.strokeStyle = 'rgba(255, 255, 255, 0.8)'
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

// Watch store drawing state and sync pointer events
watch(
  () => matrixDrawingStore.isDrawing,
  (isDrawing) => {
    if (canvasRef.value) {
      canvasRef.value.style.pointerEvents = isDrawing ? 'auto' : 'none'
    }
    if (!isDrawing) {
      previewSequence.value = []
      renderCanvas()
    }
  },
)

// Watch for changes in completed drawings to re-render
watch(
  () => [matrixDrawingStore.completedRows.length, matrixDrawingStore.completedColumns.length],
  () => {
    renderCanvas()
  },
)

// Public method to enable drawing mode
const enableDrawing = (type: 'row' | 'column') => {
  matrixDrawingStore.enableDrawing(type)
  previewSequence.value = []

  // Enable pointer events when drawing
  if (canvasRef.value) {
    canvasRef.value.style.pointerEvents = 'auto'
  }
}

// Public method to disable drawing mode
const disableDrawing = () => {
  matrixDrawingStore.disableDrawing()
  previewSequence.value = []

  // Disable pointer events when not drawing
  if (canvasRef.value) {
    canvasRef.value.style.pointerEvents = 'none'
  }

  renderCanvas()
}

// Public method to get completed rows/columns
const getCompletedDrawings = () => {
  return matrixDrawingStore.getCompletedDrawings()
}

// Public method to clear all drawings
const clearDrawings = () => {
  previewSequence.value = []
  matrixDrawingStore.clearDrawings()
  renderCanvas()
}

// Expose public methods
defineExpose({
  setMatrixData,
  renderCanvas,
  enableDrawing,
  disableDrawing,
  getCompletedDrawings,
  clearDrawings,
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
