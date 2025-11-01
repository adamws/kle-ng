<template>
  <div
    class="keyboard-canvas-container"
    ref="containerRef"
    @click="handleContainerClick"
    @mousedown="handleContainerMouseDown"
    @mouseup="handleContainerMouseUp"
    @dragover="handleDragOver"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
    :class="{ 'drag-target': isDragOver }"
  >
    <canvas
      ref="canvasRef"
      :width="canvasWidth"
      :height="canvasHeight"
      :style="{ cursor: canvasCursor }"
      @click="handleCanvasClick"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      @contextmenu="handleContextMenu"
      class="keyboard-canvas"
      tabindex="0"
      @keydown="handleKeyDown"
      @focus="handleCanvasFocus"
      @blur="handleCanvasBlur"
    />

    <!-- Matrix Annotation Overlay -->
    <MatrixAnnotationOverlay
      ref="matrixOverlayRef"
      :visible="matrixAnnotationVisible"
      :canvasWidth="canvasWidth"
      :canvasHeight="canvasHeight"
      :zoom="zoom"
      :coordinateOffset="getCoordinateSystemOffset()"
      :renderer="renderer || null"
    />

    <!-- Debug Overlay (development mode only) -->
    <DebugOverlay
      v-if="isDevMode"
      ref="debugOverlayRef"
      :visible="true"
      :canvasWidth="canvasWidth"
      :canvasHeight="canvasHeight"
      :zoom="zoom"
      :coordinateOffset="getCoordinateSystemOffset()"
    />

    <!-- Debug Control Button (development mode only) -->
    <DebugControlButton v-if="isDevMode" :debugOverlayRef="debugOverlayRef" />

    <!-- Matrix Renumbering Status Bar -->
    <div v-if="matrixRenumberingStatus" class="matrix-renumbering-status">
      <span class="status-label">{{ matrixRenumberingStatus.message }}</span>
      <span class="status-hint">Press <kbd>Enter</kbd> to confirm, <kbd>Esc</kbd> to cancel</span>
    </div>
  </div>

  <!-- Rotation control modal -->

  <RotationControlModal
    :visible="keyboardStore.canvasMode === 'rotate' && keyboardStore.selectedKeys.length > 0"
    :rotation-origin="keyboardStore.rotationOrigin"
    :initial-angle="getSelectionCommonRotation()"
    @apply="handleRotationApply"
    @cancel="handleRotationCancel"
    @angle-change="handleRotationAngleChange"
  />

  <!-- Move Exactly control modal -->
  <MoveExactlyModal
    :visible="keyboardStore.canvasMode === 'move-exactly' && keyboardStore.selectedKeys.length > 0"
    @apply="handleMoveExactlyApply"
    @cancel="handleMoveExactlyCancel"
    @movement-change="handleMoveExactlyChange"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useKeyboardStore, type Key, type KeyboardMetadata } from '@/stores/keyboard'
import { useMatrixDrawingStore } from '@/stores/matrix-drawing'
import { useFontStore } from '@/stores/font'
import { CanvasRenderer, type RenderOptions } from '@/utils/canvas-renderer'
import { D } from '@/utils/decimal-math'
import { keyIntersectsSelection } from '@/utils/geometry'
import { parseBorderRadius, createRoundedRectanglePath } from '@/utils/border-radius'
import { extractKleLayout, hasKleMetadata } from '@/utils/png-metadata'
import { parseJsonString } from '@/utils/serialization'
import { toast } from '@/composables/useToast'
import RotationControlModal from '@/components/RotationControlModal.vue'
import MoveExactlyModal from '@/components/MoveExactlyModal.vue'
import MatrixAnnotationOverlay from '@/components/MatrixAnnotationOverlay.vue'
import DebugOverlay from '@/components/DebugOverlay.vue'
import DebugControlButton from '@/components/DebugControlButton.vue'

// Visual border around rendered keycaps (in pixels)
const CANVAS_BORDER = 9

// Development mode flag
const isDevMode = import.meta.env.DEV

const keyboardStore = useKeyboardStore()
const matrixDrawingStore = useMatrixDrawingStore()
const fontStore = useFontStore()

// Define a type for the internal KLE format
interface InternalKleFormat {
  meta: KeyboardMetadata
  keys: Key[]
}

// Format detection helper
const isInternalKleFormat = (data: unknown): data is InternalKleFormat => {
  return (
    typeof data === 'object' &&
    data !== null &&
    'meta' in data &&
    'keys' in data &&
    Array.isArray((data as Record<string, unknown>).keys)
  )
}

const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()
const matrixOverlayRef = ref<InstanceType<typeof MatrixAnnotationOverlay>>()
const debugOverlayRef = ref<InstanceType<typeof DebugOverlay>>()

const canvasWidth = ref(800)
const canvasHeight = ref(600)
const renderer = ref<CanvasRenderer>()
const containerWidth = ref(0)
const containerHeight = ref(0)
const resizeObserver = ref<ResizeObserver>()

// Matrix annotation state
const matrixAnnotationVisible = ref(false)

// Show overlay when matrix modal is open, hide when modal closes
watch(
  () => matrixDrawingStore.isModalOpen,
  (isOpen) => {
    matrixAnnotationVisible.value = isOpen
  },
)

const dragCoordinateOffset = ref<{ x: number; y: number } | null>(null)

// Rotation points interaction state
const hoveredRotationPointId = ref<string | null>(null)

const zoom = ref(1)

const rectSelectionOccurred = ref(false)
const keyDragOccurred = ref(false)
const mouseDownOnKey = ref<{ key: Key; pos: { x: number; y: number } } | null>(null)

const mousePosition = ref({ x: 0, y: 0, visible: false })
const canvasFocused = ref(false)

// Drag and drop state
const isDragOver = ref(false)
const dragCounter = ref(0) // To handle dragenter/dragleave properly

// Helper function to detect if this is a file drag event (not section reordering)
const isFileDragEvent = (event: DragEvent): boolean => {
  const dataTransfer = event.dataTransfer
  if (!dataTransfer) return false

  // Check if we have actual files being dragged
  if (dataTransfer.files?.length > 0) return true

  // Check if the drag operation includes file types
  // This covers cases where files are being dragged from external sources
  const types = Array.from(dataTransfer.types || [])
  return types.includes('Files') && !types.includes('text/plain')
}

const canvasCursor = computed(() => {
  if (keyboardStore.canvasMode === 'select') {
    return keyboardStore.mouseDragMode === 'rect-select' ? 'crosshair' : 'default'
  }
  if (keyboardStore.canvasMode === 'rotate') {
    // Show pointer cursor when hovering over rotation points, otherwise default
    return hoveredRotationPointId.value ? 'pointer' : 'default'
  }
  if (keyboardStore.canvasMode === 'mirror-h' || keyboardStore.canvasMode === 'mirror-v') {
    return keyboardStore.selectedKeys.length > 0 ? 'copy' : 'not-allowed'
  }
  if (keyboardStore.canvasMode === 'move-exactly') {
    return keyboardStore.selectedKeys.length > 0 ? 'move' : 'not-allowed'
  }
  if (keyboardStore.mouseDragMode === 'key-move') {
    return 'grabbing'
  }
  return 'default'
})

// Matrix renumbering status from overlay
const matrixRenumberingStatus = computed(() => {
  return matrixOverlayRef.value?.renumberingStatus || null
})

const renderOptions = computed<RenderOptions>(() => ({
  unit: 54,
  background: keyboardStore.metadata?.backcolor || '#ffffff',
  fontFamily: fontStore.canvasFontFamily,
}))

// Watch for layout changes and clear matrix overlay
watch(
  () => keyboardStore.keys.length,
  () => {
    // Clear matrix overlay when layout changes (e.g., new layout loaded)
    if (matrixAnnotationVisible.value) {
      matrixAnnotationVisible.value = false
    }
    // Also clear any matrix drawings
    if (matrixOverlayRef.value) {
      matrixOverlayRef.value.clearDrawings()
    }
  },
)

onMounted(() => {
  if (canvasRef.value && containerRef.value) {
    renderer.value = new CanvasRenderer(canvasRef.value, renderOptions.value)

    // Set up callback for when images load
    renderer.value.setImageLoadCallback(() => {
      nextTick(() => {
        renderKeyboard()
      })
    })

    // Set up callback for when images fail to load
    renderer.value.setImageErrorCallback((url: string) => {
      const filename = url.substring(url.lastIndexOf('/') + 1)
      toast.showError(`Failed to load image: ${filename}`, 'Image Load Error')
    })

    updateContainerWidth()

    updateCanvasSize()

    renderKeyboard()

    canvasRef.value.focus()
    canvasFocused.value = true

    window.addEventListener('resize', handleWindowResize)
    handleWindowResize()

    resizeObserver.value = new ResizeObserver(() => {
      updateContainerWidth()
      updateCanvasSize()
      nextTick(() => {
        renderKeyboard()
      })
    })
    resizeObserver.value.observe(containerRef.value)

    window.addEventListener('canvas-zoom', handleExternalZoom as EventListener)
    window.addEventListener('canvas-reset-view', handleExternalResetView as EventListener)
    window.addEventListener('request-canvas-focus', handleCanvasFocusRequest as EventListener)
    window.addEventListener('system-copy', handleSystemCopy as EventListener)

    // Watch for theme changes via data-bs-theme attribute
    themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-bs-theme') {
          // Theme changed, re-render canvas to update background color
          renderKeyboard()
        }
      })
    })

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-bs-theme'],
    })
  }
})

// Watch for changes and re-render
watch(
  [
    () => keyboardStore.keys,
    () => keyboardStore.selectedKeys,
    () => keyboardStore.tempSelectedKeys,
    () => keyboardStore.mouseDragMode,
    () => keyboardStore.metadata,
  ],
  async (newValues, oldValues) => {
    await nextTick()

    // Only update canvas size if keys have actually changed, not just selection
    const [newKeys] = newValues
    const [oldKeys] = oldValues || [[], []]

    const keysChanged =
      !oldKeys ||
      newKeys.length !== oldKeys.length ||
      newKeys.some((key, index) => {
        const oldKey = oldKeys[index]
        return (
          !oldKey ||
          key.x !== oldKey.x ||
          key.y !== oldKey.y ||
          key.width !== oldKey.width ||
          key.height !== oldKey.height ||
          key.width2 !== oldKey.width2 ||
          key.height2 !== oldKey.height2 ||
          key.x2 !== oldKey.x2 ||
          key.y2 !== oldKey.y2 ||
          (key.rotation_angle || 0) !== (oldKey.rotation_angle || 0) ||
          (key.rotation_x || 0) !== (oldKey.rotation_x || 0) ||
          (key.rotation_y || 0) !== (oldKey.rotation_y || 0)
        )
      })

    if (keysChanged) {
      updateContainerWidth() // Ensure container width is up to date
      updateCanvasSize()
      await nextTick()
      await nextTick()
    }

    // Always re-render to show selection changes
    renderKeyboard()
  },
  { deep: true, immediate: true },
)

// Watch for layout changes to reset view
watch(
  () => keyboardStore.resetViewTrigger,
  () => {
    resetView()
  },
)

// Watch for zoom changes to update canvas size
watch(zoom, async () => {
  await nextTick()
  updateCanvasSize()
  await nextTick()
  renderKeyboard()
})

// Watch specifically for changes in the number of keys
watch(
  () => keyboardStore.keys.length,
  async (newLength, oldLength) => {
    if (newLength !== oldLength) {
      await nextTick()
      updateContainerWidth()
      updateCanvasSize()
      await nextTick()
      renderKeyboard()
    }
  },
)

// Additional aggressive watcher to ensure canvas resizes for any bounds changes
// This catches cases where the deep watcher might be delayed
watch(
  () =>
    keyboardStore.keys.map((key) => ({
      x: key.x,
      y: key.y,
      width: key.width,
      height: key.height,
      rotation_angle: key.rotation_angle || 0,
      rotation_x: key.rotation_x || 0,
      rotation_y: key.rotation_y || 0,
    })),
  async () => {
    await nextTick()
    updateCanvasSize()
    await nextTick()
    renderKeyboard()
  },
  { deep: true },
)

// Watch for mirror tool mode changes to update canvas size
watch(
  () => keyboardStore.canvasMode,
  async () => {
    await nextTick()
    updateCanvasSize()
    await nextTick()
    renderKeyboard()
  },
)

// Watch for background color changes and update renderer
watch(
  () => keyboardStore.metadata?.backcolor,
  (newBackcolor, oldBackcolor) => {
    if (renderer.value && newBackcolor !== oldBackcolor) {
      renderer.value.updateOptions(renderOptions.value)
      renderKeyboard()
    }
  },
  { immediate: false },
)

// Watch for font changes and update renderer
watch(
  () => fontStore.canvasFontFamily,
  (newFont, oldFont) => {
    if (renderer.value && newFont !== oldFont) {
      renderer.value.updateOptions(renderOptions.value)
      nextTick(() => {
        renderKeyboard()
      })
    }
  },
  { immediate: false },
)

// Watch for theme changes and re-render canvas background
let themeObserver: MutationObserver | null = null

const updateContainerWidth = () => {
  if (containerRef.value) {
    // Get the actual available width, accounting for all padding/margins
    const rect = containerRef.value.getBoundingClientRect()
    const style = getComputedStyle(containerRef.value)
    const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
    containerWidth.value = Math.max(800, rect.width - paddingX - 40) // Ensure minimum width
  }
}

// Cached bounds to ensure consistency between canvas size and coordinate offset
let cachedBounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null

// Calculate all bounds - used by both canvas size and coordinate offset
const calculateAllBounds = () => {
  if (keyboardStore.keys.length === 0 || !renderer.value) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1 }
  }

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity

  // Process regular keys
  keyboardStore.keys.forEach((key) => {
    const keyBounds = renderer.value!.calculateRotatedKeyBounds(key)
    const unit = renderOptions.value.unit
    const keyMinX = keyBounds.minX / unit
    const keyMinY = keyBounds.minY / unit
    const keyMaxX = keyBounds.maxX / unit
    const keyMaxY = keyBounds.maxY / unit

    minX = Math.min(minX, keyMinX)
    minY = Math.min(minY, keyMinY)
    maxX = Math.max(maxX, keyMaxX)
    maxY = Math.max(maxY, keyMaxY)
  })

  return { minX, minY, maxX, maxY }
}

// Calculate coordinate system offset to handle negative coordinates
const getCoordinateSystemOffset = () => {
  const bounds = cachedBounds || calculateAllBounds()

  // Calculate offset needed to ensure all keys are in positive coordinates
  // Use base unit only - zoom scaling will be applied by the transform matrix
  const offsetX = D.mul(D.min(bounds.minX, 0), renderOptions.value.unit)
  const offsetY = D.mul(D.min(bounds.minY, 0), renderOptions.value.unit)

  // Add visual border offset to shift all rendering by CANVAS_BORDER pixels
  // Border should be in base coordinates, not scaled by zoom
  return { x: -offsetX + CANVAS_BORDER / zoom.value, y: -offsetY + CANVAS_BORDER / zoom.value }
}

// Canvas size calculation now uses renderer's bounds calculation for consistency

// Prevent overlapping canvas size updates
let isUpdatingCanvasSize = false

const updateCanvasSize = () => {
  if (isUpdatingCanvasSize) {
    return
  }

  isUpdatingCanvasSize = true

  if (keyboardStore.keys.length === 0) {
    // For empty layouts, use a default size scaled by zoom
    const defaultWidth = D.round(D.mul(800, zoom.value)) + CANVAS_BORDER * 2
    const defaultHeight = D.round(D.mul(600, zoom.value)) + CANVAS_BORDER * 2

    canvasWidth.value = defaultWidth
    canvasHeight.value = defaultHeight
    containerWidth.value = defaultWidth
    containerHeight.value = defaultHeight
    cachedBounds = null
    isUpdatingCanvasSize = false
    return
  }

  // Calculate bounds using renderer for consistency
  if (!renderer.value) {
    isUpdatingCanvasSize = false
    return
  }

  // Calculate bounds once and cache for coordinate offset consistency
  const bounds = calculateAllBounds()
  cachedBounds = bounds
  const { minX, minY, maxX, maxY } = bounds

  const unit = renderOptions.value.unit * zoom.value

  // Calculate required size for the keyboard layout, accounting for negative coordinates
  let layoutWidth = (maxX - Math.min(minX, 0)) * unit
  let layoutHeight = (maxY - Math.min(minY, 0)) * unit

  // Expand canvas when mirror tools are active to provide space for positioning mirror axis
  const mirrorPadding = 200 * zoom.value // Extra space for mirror axis positioning
  if (keyboardStore.canvasMode === 'mirror-h') {
    // Horizontal mirror: expand vertically to allow positioning axis above/below keys
    layoutHeight += mirrorPadding * 2 // Add padding on both top and bottom
  } else if (keyboardStore.canvasMode === 'mirror-v') {
    // Vertical mirror: expand horizontally to allow positioning axis left/right of keys
    layoutWidth += mirrorPadding * 2 // Add padding on both left and right
  }

  // For preset layouts, fit canvas exactly to key bounds (renderer includes stroke width)
  const requiredWidth = layoutWidth // Fit exactly to key bounds (including borders calculated by renderer)
  const requiredHeight = layoutHeight // Fit exactly to key bounds (including borders calculated by renderer)

  // Canvas size should contain all keys - scrollbars will appear if container is smaller
  const newWidth = Math.ceil(requiredWidth) + CANVAS_BORDER * 2
  const newHeight = Math.ceil(requiredHeight) + CANVAS_BORDER * 2

  // Only update canvas if size actually changed
  if (canvasWidth.value !== newWidth || canvasHeight.value !== newHeight) {
    canvasWidth.value = newWidth
    canvasHeight.value = newHeight
    containerWidth.value = newWidth
    containerHeight.value = newHeight
  }

  // Mark update as complete and clear cache
  cachedBounds = null
  isUpdatingCanvasSize = false
}

const drawRectangleSelection = (ctx: CanvasRenderingContext2D) => {
  if (!keyboardStore.rectSelectStart || !keyboardStore.rectSelectEnd) {
    return
  }

  // Coordinates are already in canvas pixels from getCanvasPosition
  const startX = keyboardStore.rectSelectStart.x
  const startY = keyboardStore.rectSelectStart.y
  const endX = keyboardStore.rectSelectEnd.x
  const endY = keyboardStore.rectSelectEnd.y

  const x = Math.min(startX, endX)
  const y = Math.min(startY, endY)
  const width = Math.abs(endX - startX)
  const height = Math.abs(endY - startY)

  // Only draw if rectangle has some size
  if (width < 2 && height < 2) return

  // Draw selection rectangle with dashed border
  ctx.strokeStyle = '#dc3545'
  ctx.lineWidth = 2
  ctx.setLineDash([8, 4])
  ctx.strokeRect(x, y, width, height)

  // Draw semi-transparent fill
  ctx.fillStyle = 'rgba(220, 53, 69, 0.1)'
  ctx.fillRect(x, y, width, height)

  // Reset line dash
  ctx.setLineDash([])
}

const drawMirrorAxis = (ctx: CanvasRenderingContext2D) => {
  let axisPosition = null
  let axisKeyUnits = null

  // If mirror axis is set, use it; otherwise use mouse position for preview
  if (keyboardStore.mirrorAxis) {
    // mirrorAxis coordinates are in key units, convert to canvas pixels
    axisKeyUnits = {
      x: keyboardStore.mirrorAxis.x,
      y: keyboardStore.mirrorAxis.y,
      direction: keyboardStore.mirrorAxis.direction,
    }
    axisPosition = {
      x: keyboardStore.mirrorAxis.x * renderOptions.value.unit,
      y: keyboardStore.mirrorAxis.y * renderOptions.value.unit,
      direction: keyboardStore.mirrorAxis.direction,
    }
  } else if (mousePosition.value.visible) {
    // Preview axis at mouse position with snapping to move step grid
    const moveStep = keyboardStore.moveStep
    const snappedX = D.roundToStep(mousePosition.value.x, moveStep)
    const snappedY = D.roundToStep(mousePosition.value.y, moveStep)

    axisKeyUnits = {
      x: snappedX,
      y: snappedY,
      direction: keyboardStore.canvasMode === 'mirror-h' ? 'horizontal' : 'vertical',
    }
    axisPosition = {
      x: D.mul(snappedX, renderOptions.value.unit),
      y: D.mul(snappedY, renderOptions.value.unit),
      direction: keyboardStore.canvasMode === 'mirror-h' ? 'horizontal' : 'vertical',
    }
  }

  if (!axisPosition || !axisKeyUnits) return

  // Save current context state
  ctx.save()

  // Draw mirror axis line
  ctx.strokeStyle = keyboardStore.mirrorAxis ? '#ff6b35' : 'rgba(255, 107, 53, 0.6)'
  ctx.lineWidth = keyboardStore.mirrorAxis ? 3 : 2
  ctx.setLineDash(keyboardStore.mirrorAxis ? [] : [10, 5])

  ctx.beginPath()

  if (axisPosition.direction === 'horizontal') {
    // Horizontal line across canvas
    ctx.moveTo(0, axisPosition.y)
    ctx.lineTo(canvasWidth.value, axisPosition.y)
  } else {
    // Vertical line across canvas
    ctx.moveTo(axisPosition.x, 0)
    ctx.lineTo(axisPosition.x, canvasHeight.value)
  }

  ctx.stroke()

  // Draw position tooltip for preview mode
  if (!keyboardStore.mirrorAxis && mousePosition.value.visible) {
    const tooltipText =
      axisKeyUnits.direction === 'horizontal' ? `Y: ${axisKeyUnits.y}` : `X: ${axisKeyUnits.x}`

    // Calculate tooltip position
    const tooltipX =
      axisPosition.direction === 'horizontal'
        ? Math.min(axisPosition.x + 10, canvasWidth.value - 80)
        : axisPosition.x + 10
    const tooltipY =
      axisPosition.direction === 'horizontal'
        ? axisPosition.y - 10
        : Math.min(axisPosition.y + 10, canvasHeight.value - 30)

    // Draw tooltip background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    const textMetrics = ctx.measureText(tooltipText)
    const tooltipWidth = textMetrics.width + 12
    const tooltipHeight = 20

    ctx.fillRect(tooltipX - 6, tooltipY - 15, tooltipWidth, tooltipHeight)

    // Draw tooltip text
    ctx.fillStyle = 'white'
    ctx.fillText(tooltipText, tooltipX, tooltipY)
  }

  // Reset line dash and restore context
  ctx.setLineDash([])
  ctx.restore()
}

const renderKeyboard = () => {
  if (renderer.value) {
    try {
      const ctx = renderer.value.getContext()

      // Clear the entire canvas efficiently
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0) // Reset to identity matrix
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

      // Fill with background color, applying border radius (default 6px like original KLE)
      const radiiValue = keyboardStore.metadata.radii?.trim() || '6px'

      // Fill entire canvas with container background color first
      const containerColor = getComputedStyle(containerRef.value!).backgroundColor
      ctx.fillStyle = containerColor
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

      // Then draw rounded rectangle with keyboard background color on top
      ctx.fillStyle = renderOptions.value.background
      const corners = parseBorderRadius(radiiValue, ctx.canvas.width, ctx.canvas.height)
      createRoundedRectanglePath(ctx, 0, 0, ctx.canvas.width, ctx.canvas.height, corners)
      ctx.fill()
      ctx.restore()

      // Apply transformations before rendering
      ctx.save()

      // Calculate coordinate system offset to handle negative coordinates
      const coordinateOffset = getCoordinateSystemOffset()

      // Apply zoom, pan, and coordinate system offset
      ctx.setTransform(
        zoom.value,
        0,
        0,
        zoom.value,
        coordinateOffset.x * zoom.value,
        coordinateOffset.y * zoom.value,
      )

      // During rectangle selection, show tempSelectedKeys for dynamic highlighting
      const keysToHighlight =
        keyboardStore.mouseDragMode === 'rect-select'
          ? keyboardStore.tempSelectedKeys
          : keyboardStore.selectedKeys

      renderer.value.render(
        keyboardStore.keys,
        keysToHighlight,
        keyboardStore.metadata,
        false,
        keyboardStore.canvasMode === 'rotate' && keyboardStore.selectedKeys.length > 0,
        hoveredRotationPointId.value || undefined,
        keyboardStore.rotationOrigin,
      )

      // Draw rectangle selection if active
      if (keyboardStore.mouseDragMode === 'rect-select') {
        drawRectangleSelection(ctx)
      }

      // Draw mirror axis if active or preview mode (only when keys are selected)
      if (
        (keyboardStore.canvasMode === 'mirror-h' || keyboardStore.canvasMode === 'mirror-v') &&
        keyboardStore.selectedKeys.length > 0
      ) {
        drawMirrorAxis(ctx)
      }

      ctx.restore()
    } catch (error) {
      console.error('Error rendering keyboard:', error)
    }
  }
}

const handleWindowResize = () => {
  updateContainerWidth()
  updateCanvasSize()
  nextTick(() => {
    renderKeyboard()
  })
}

const getCanvasPosition = (event: MouseEvent) => {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }

  // Convert screen coordinates to canvas coordinates, accounting for zoom, pan, and coordinate offset
  const screenX = D.sub(event.clientX, rect.left)
  const screenY = D.sub(event.clientY, rect.top)

  // Use cached coordinate offset during drag operations to prevent feedback loops,
  // otherwise calculate dynamically
  const coordinateOffset = dragCoordinateOffset.value || getCoordinateSystemOffset()

  return {
    x: D.div(D.sub(screenX, D.mul(coordinateOffset.x, zoom.value)), zoom.value),
    y: D.div(D.sub(screenY, D.mul(coordinateOffset.y, zoom.value)), zoom.value),
  }
}

const handleContainerClick = (event: MouseEvent) => {
  // If the click is on the canvas itself, let the canvas handler manage it
  if (event.target === canvasRef.value) {
    return
  }

  // Handle rotate mode - auto-switch back to selection mode when clicking outside canvas
  if (keyboardStore.canvasMode === 'rotate') {
    keyboardStore.setCanvasMode('select')
    return
  }

  // Don't interfere if rectangle selection just occurred (let it complete)
  if (rectSelectionOccurred.value) {
    rectSelectionOccurred.value = false // Reset for next interaction
    return
  }

  // Prevent default to avoid any focus issues
  event.preventDefault()

  // Clear selection when clicking in empty space (outside canvas)
  // Important for allowing clearing selection when there is no empty
  // space on the canvas (rectangular layouts without gaps between keys)
  keyboardStore.unselectAll()

  if (canvasRef.value) {
    canvasRef.value.focus()
  }
}

const handleContainerMouseDown = (event: MouseEvent) => {
  // If the mousedown is on the canvas itself, let the canvas handler manage it
  if (event.target === canvasRef.value) {
    return
  }

  // Prevent the mousedown from causing other elements to lose focus
  event.preventDefault()
}

const handleContainerMouseUp = (event: MouseEvent) => {
  // If the mouseup is on the canvas itself, let the canvas handler manage it
  if (event.target === canvasRef.value) {
    return
  }

  // If we're in the middle of rectangle selection, complete it
  if (keyboardStore.mouseDragMode === 'rect-select') {
    handleMouseUpShared()
    rectSelectionOccurred.value = true // Mark that rectangle selection occurred
  }
}

const handleCanvasClick = (event: MouseEvent) => {
  if (!renderer.value) return

  // Handle rotation mode - ONLY allow rotation point clicks, disable all other interactions
  if (keyboardStore.canvasMode === 'rotate') {
    const pos = getCanvasPosition(event)
    // pos is already in canvas coordinates, no need to multiply by unit
    const rotationPoint = renderer.value.getRotationPointAtPosition(pos.x, pos.y)

    if (rotationPoint) {
      // Start rotation with the selected point as origin
      keyboardStore.startRotation({ x: rotationPoint.x, y: rotationPoint.y })
    } else {
      // If user clicks outside rotation points in rotate mode, auto-switch back to selection mode
      keyboardStore.setCanvasMode('select')
    }
    // In rotate mode, we ONLY handle rotation points - ignore everything else
    return
  }

  // If rectangle selection occurred, don't handle click
  if (rectSelectionOccurred.value) {
    rectSelectionOccurred.value = false // Reset for next interaction
    return
  }

  // If key drag occurred, don't handle click
  if (keyDragOccurred.value) {
    keyDragOccurred.value = false // Reset for next interaction
    return
  }

  const pos = getCanvasPosition(event)

  // Handle mirror mode clicks - set axis and perform mirror operation
  if (keyboardStore.canvasMode === 'mirror-h' || keyboardStore.canvasMode === 'mirror-v') {
    // Only allow mirroring if keys are selected
    if (keyboardStore.selectedKeys.length === 0) {
      // Switch back to select mode if no keys selected
      keyboardStore.setCanvasMode('select')
      return
    }

    const direction = keyboardStore.canvasMode === 'mirror-h' ? 'horizontal' : 'vertical'
    keyboardStore.setMirrorAxis(pos, direction)
    keyboardStore.performMirror()
    return
  }

  const clickedKey = renderer.value.getKeyAtPosition(pos.x, pos.y, keyboardStore.keys)

  if (clickedKey) {
    keyboardStore.selectKey(clickedKey, event.ctrlKey || event.metaKey)
  } else {
    // Clicked on empty space - clear selection unless Ctrl/Cmd is held
    if (!event.ctrlKey && !event.metaKey) {
      keyboardStore.unselectAll()
    }
  }

  // Keep focus on canvas
  canvasRef.value?.focus()
}

const handleMouseDown = (event: MouseEvent) => {
  if (!renderer.value) return

  // In rotate mode, disable all mouse down interactions (no key selection/dragging)
  if (keyboardStore.canvasMode === 'rotate') {
    return
  }

  // In mirror mode, don't interfere with selection
  if (keyboardStore.canvasMode === 'mirror-h' || keyboardStore.canvasMode === 'mirror-v') {
    return
  }

  const pos = getCanvasPosition(event)
  const clickedKey = renderer.value.getKeyAtPosition(pos.x, pos.y, keyboardStore.keys)

  // Left mouse button (0) - Selection (single click or rectangle drag)
  if (event.button === 0) {
    // Only start rectangle selection if Ctrl/Cmd is NOT held
    // When Ctrl/Cmd is held, user intends individual key selection
    if (!event.ctrlKey && !event.metaKey) {
      // Cache coordinate offset at start of rectangle selection to prevent feedback loops
      dragCoordinateOffset.value = getCoordinateSystemOffset()
      keyboardStore.startRectSelect(pos)
      rectSelectionOccurred.value = false // Will be set to true if user drags
      // Add global listeners for drag operations
      document.addEventListener('mousemove', handleGlobalMouseMove)
      document.addEventListener('mouseup', handleGlobalMouseUp)
    }
    return
  }

  // Middle mouse button (1) - Move selected keys
  if (event.button === 1) {
    event.preventDefault()

    // Ensure canvas is focused when middle-clicking
    if (canvasRef.value) {
      canvasRef.value.focus()
    }

    if (clickedKey) {
      // If key is not selected, automatically select it first
      if (!keyboardStore.selectedKeys.includes(clickedKey)) {
        keyboardStore.selectKey(clickedKey, false) // Select only this key (clear previous selection)
      }

      // Cache coordinate offset at start of key drag to prevent feedback loops
      dragCoordinateOffset.value = getCoordinateSystemOffset()
      // Start moving the selected keys
      keyboardStore.startKeyDrag(clickedKey, pos)
      mouseDownOnKey.value = { key: clickedKey, pos }
      keyDragOccurred.value = false
      // Add global listeners for drag operations
      document.addEventListener('mousemove', handleGlobalMouseMove)
      document.addEventListener('mouseup', handleGlobalMouseUp)
    }
    // If no key clicked, do nothing
    return
  }

  // Right mouse button (2) - Reserved for future context menus
  if (event.button === 2) {
    event.preventDefault()
    // Do nothing for now - reserved for future context menu functionality
    return
  }
}

const handleMouseMove = (event: MouseEvent) => {
  // Update mouse position for display (only if mouse is over canvas)
  updateMousePosition(event)

  // Handle rotation points hover when in rotate mode
  if (keyboardStore.canvasMode === 'rotate' && renderer.value) {
    const pos = getCanvasPosition(event)
    // pos is already in canvas coordinates, no need to multiply by unit
    const rotationPoint = renderer.value.getRotationPointAtPosition(pos.x, pos.y)

    if (rotationPoint?.id !== hoveredRotationPointId.value) {
      hoveredRotationPointId.value = rotationPoint?.id || null
      nextTick(() => {
        renderKeyboard()
      })
    }
    return
  }

  // Handle mirror mode preview - trigger re-render to show axis preview
  if (keyboardStore.canvasMode === 'mirror-h' || keyboardStore.canvasMode === 'mirror-v') {
    nextTick(() => {
      renderKeyboard()
    })
    return
  }

  // Check for middle-click drag to move keys
  if (mouseDownOnKey.value && keyboardStore.mouseDragMode === 'none') {
    const currentPos = getCanvasPosition(event)
    const startPos = mouseDownOnKey.value.pos

    // Calculate distance moved to detect drag intent
    const distance = D.sqrt(
      D.add(D.pow(D.sub(currentPos.x, startPos.x), 2), D.pow(D.sub(currentPos.y, startPos.y), 2)),
    )

    // Start drag if moved more than 5 pixels (for middle-click key movement)
    if (distance > 5) {
      keyDragOccurred.value = true // Mark that key dragging started
      mouseDownOnKey.value = null // Clear the mousedown info
    }
  }

  // Delegate to shared move handler for drag operations
  handleMouseMoveShared(event)
}

// Shared mouse move handler for both canvas and global events
const handleMouseMoveShared = (event: MouseEvent) => {
  // Handle key dragging
  if (keyboardStore.mouseDragMode === 'key-move') {
    const pos = getCanvasPosition(event)
    keyboardStore.updateKeyDrag(pos)
    keyDragOccurred.value = true // Mark that key dragging is active

    // Auto-scroll when dragging near container edges
    handleAutoScroll(event)

    nextTick(() => {
      renderKeyboard()
    })
    return
  }

  // Handle rectangle selection
  if (keyboardStore.mouseDragMode === 'rect-select') {
    const pos = getCanvasPosition(event)

    // Calculate which keys are selected using proper collision detection
    const selectedKeys = calculateSelectedKeys(pos)
    keyboardStore.updateRectSelect(pos, selectedKeys)
    rectSelectionOccurred.value = true // Mark that rectangle selection is active

    // Auto-scroll when dragging near container edges
    handleAutoScroll(event)

    // Note: No need to manually call renderKeyboard() here as the watcher will handle it
    return
  }
}

// Global mouse move handler for when mouse moves outside canvas during drag
const handleGlobalMouseMove = (event: MouseEvent) => {
  // Only handle if we're actually dragging
  if (keyboardStore.mouseDragMode === 'key-move' || keyboardStore.mouseDragMode === 'rect-select') {
    handleMouseMoveShared(event)
  }
}

// Auto-scroll functionality for drag operations
const handleAutoScroll = (event: MouseEvent) => {
  if (!containerRef.value) return

  const container = containerRef.value
  const rect = container.getBoundingClientRect()

  // Get mouse position relative to container
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top

  // Define scroll zones (distance from edge where scrolling starts)
  const scrollZone = 50
  const maxScrollSpeed = 10

  // Calculate scroll deltas
  let scrollDeltaX = 0
  let scrollDeltaY = 0

  // Horizontal scrolling
  if (mouseX < scrollZone && container.scrollLeft > 0) {
    // Scroll left when near left edge
    scrollDeltaX = -Math.max(1, (maxScrollSpeed * (scrollZone - mouseX)) / scrollZone)
  } else if (
    mouseX > rect.width - scrollZone &&
    container.scrollLeft < container.scrollWidth - container.clientWidth
  ) {
    // Scroll right when near right edge
    scrollDeltaX = Math.max(1, (maxScrollSpeed * (mouseX - (rect.width - scrollZone))) / scrollZone)
  }

  // Vertical scrolling
  if (mouseY < scrollZone && container.scrollTop > 0) {
    // Scroll up when near top edge
    scrollDeltaY = -Math.max(1, (maxScrollSpeed * (scrollZone - mouseY)) / scrollZone)
  } else if (
    mouseY > rect.height - scrollZone &&
    container.scrollTop < container.scrollHeight - container.clientHeight
  ) {
    // Scroll down when near bottom edge
    scrollDeltaY = Math.max(
      1,
      (maxScrollSpeed * (mouseY - (rect.height - scrollZone))) / scrollZone,
    )
  }

  // Apply scrolling
  if (scrollDeltaX !== 0 || scrollDeltaY !== 0) {
    container.scrollBy(scrollDeltaX, scrollDeltaY)
  }
}

const handleMouseUp = () => {
  handleMouseUpShared()
}

// Shared mouse up handler for both canvas and global events
const handleMouseUpShared = () => {
  // Clear mousedown info on mouse up (click without drag)
  mouseDownOnKey.value = null

  // Clear cached coordinate offset to allow normal dynamic calculation
  dragCoordinateOffset.value = null

  // Remove global listeners regardless of drag state
  document.removeEventListener('mousemove', handleGlobalMouseMove)
  document.removeEventListener('mouseup', handleGlobalMouseUp)

  // Handle end of key dragging
  if (keyboardStore.mouseDragMode === 'key-move') {
    keyboardStore.endKeyDrag()
    return
  }

  // Handle end of rectangle selection
  if (keyboardStore.mouseDragMode === 'rect-select') {
    keyboardStore.endRectSelect()
    // Note: No need to manually call renderKeyboard() here as the watcher will handle it
    // Don't reset the flag here - let click handler check it first
    return
  }

  // No more panning cleanup needed
}

// Global mouse up handler for when mouse is released outside canvas during drag
const handleGlobalMouseUp = () => {
  handleMouseUpShared()
}

const handleMouseEnter = () => {
  mousePosition.value.visible = true
}

const handleMouseLeave = () => {
  mousePosition.value.visible = false

  // Reset hovered rotation point
  if (hoveredRotationPointId.value) {
    hoveredRotationPointId.value = null
    nextTick(() => {
      renderKeyboard()
    })
  }

  // Dispatch event to notify that mouse position is hidden
  window.dispatchEvent(
    new CustomEvent('canvas-mouse-position', {
      detail: {
        x: mousePosition.value.x,
        y: mousePosition.value.y,
        visible: false,
      },
    }),
  )
}

const handleContextMenu = (event: MouseEvent) => {
  // Prevent default right-click context menu - reserved for future functionality
  event.preventDefault()
}

const updateMousePosition = (event: MouseEvent) => {
  const canvasPos = getCanvasPosition(event)
  // Convert canvas coordinates to keyboard units
  mousePosition.value.x = D.format(D.div(canvasPos.x, renderOptions.value.unit), 2)
  mousePosition.value.y = D.format(D.div(canvasPos.y, renderOptions.value.unit), 2)

  // Emit position update to parent
  window.dispatchEvent(
    new CustomEvent('canvas-mouse-position', {
      detail: {
        x: mousePosition.value.x,
        y: mousePosition.value.y,
        visible: mousePosition.value.visible,
      },
    }),
  )
}

const handleCanvasFocus = () => {
  canvasFocused.value = true
  // Emit focus state to parent for status line
  window.dispatchEvent(
    new CustomEvent('canvas-focus-change', {
      detail: { focused: true },
    }),
  )
}

// Using @blur to trigger this when canvas out of focus
const handleCanvasBlur = () => {
  canvasFocused.value = false
  // Emit blur state to parent for status line
  window.dispatchEvent(
    new CustomEvent('canvas-focus-change', {
      detail: { focused: false },
    }),
  )
}

const handleKeyDown = async (event: KeyboardEvent) => {
  // Handle Ctrl+[ and Ctrl+] for key navigation (like bracket matching in editors)
  if ((event.ctrlKey || event.metaKey) && (event.key === '[' || event.key === ']')) {
    event.preventDefault()
    if (event.key === '[') {
      selectPreviousKey()
    } else {
      selectNextKey()
    }
    return
  }

  // Handle keyboard shortcuts
  if (event.ctrlKey || event.metaKey) {
    switch (event.key.toLowerCase()) {
      case 'a':
        event.preventDefault()
        keyboardStore.selectAll()
        break
      case 'c':
        event.preventDefault()
        await keyboardStore.copy()
        break
      case 'x':
        event.preventDefault()
        await keyboardStore.cut()
        break
      case 'v':
        event.preventDefault()
        await keyboardStore.paste()
        break
      case 'z':
        event.preventDefault()
        if (event.shiftKey) {
          keyboardStore.redo()
        } else {
          keyboardStore.undo()
        }
        break
      case 'y':
        event.preventDefault()
        keyboardStore.redo()
        break
    }
  } else if (event.shiftKey) {
    // Shift + arrow keys for width/height adjustment
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault()
        adjustSelectedKeysSize('width', -keyboardStore.moveStep)
        break
      case 'ArrowRight':
        event.preventDefault()
        adjustSelectedKeysSize('width', keyboardStore.moveStep)
        break
      case 'ArrowUp':
        event.preventDefault()
        adjustSelectedKeysSize('height', -keyboardStore.moveStep)
        break
      case 'ArrowDown':
        event.preventDefault()
        adjustSelectedKeysSize('height', keyboardStore.moveStep)
        break
    }
  } else {
    switch (event.key) {
      case 'Delete':
      case 'Backspace':
        event.preventDefault()
        keyboardStore.deleteKeys()
        break
      case 'Escape':
        event.preventDefault()
        keyboardStore.unselectAll()
        break
      case 'Insert':
        event.preventDefault()
        keyboardStore.addKey()
        break
      case 'a':
      case 'A':
        event.preventDefault()
        keyboardStore.addKey()
        break
      case 'ArrowUp':
        event.preventDefault()
        moveSelectedKeys(0, -keyboardStore.moveStep)
        break
      case 'ArrowDown':
        event.preventDefault()
        moveSelectedKeys(0, keyboardStore.moveStep)
        break
      case 'ArrowLeft':
        event.preventDefault()
        moveSelectedKeys(-keyboardStore.moveStep, 0)
        break
      case 'ArrowRight':
        event.preventDefault()
        moveSelectedKeys(keyboardStore.moveStep, 0)
        break
    }
  }
}

// Drag and drop handlers for files
const handleDragEnter = (event: DragEvent) => {
  // Only handle file drops, not section reordering or other drag operations
  if (isFileDragEvent(event)) {
    event.preventDefault()
    dragCounter.value++
    if (dragCounter.value === 1) {
      isDragOver.value = true
    }
  }
}

const handleDragOver = (event: DragEvent) => {
  // Only handle file drops
  if (isFileDragEvent(event)) {
    event.preventDefault()
    event.dataTransfer!.dropEffect = 'copy'
  }
  // Don't call preventDefault for non-file drags to allow section reordering
}

const handleDragLeave = (event: DragEvent) => {
  // Only handle file drag leave
  if (isFileDragEvent(event) || isDragOver.value) {
    event.preventDefault()
    dragCounter.value--
    if (dragCounter.value === 0) {
      isDragOver.value = false
    }
  }
}

const handleDrop = async (event: DragEvent) => {
  dragCounter.value = 0
  isDragOver.value = false

  // Only handle file drops, let other drag operations (section reordering) pass through
  if (!isFileDragEvent(event)) {
    return
  }

  event.preventDefault()

  const files = event.dataTransfer?.files
  if (!files || files.length === 0) return

  const file = files[0]

  try {
    // Extract filename without extension for downloads
    const filenameWithoutExt = file.name.replace(/\.[^/.]+$/, '')

    // Handle PNG files
    if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
      console.log(`Checking dropped PNG file for embedded layout: ${file.name}`)

      // Check if PNG contains KLE metadata
      if (await hasKleMetadata(file)) {
        const layoutData = await extractKleLayout(file)

        if (layoutData) {
          console.log(`Loading layout from dropped PNG metadata: ${file.name}`)
          keyboardStore.loadKLELayout(layoutData)
          keyboardStore.filename = filenameWithoutExt
          toast.showSuccess(`Layout imported from PNG: ${file.name}`, 'Import Successful')
        } else {
          toast.showError('Failed to extract layout data from PNG metadata', 'Import Failed')
        }
      } else {
        toast.showError(
          'This PNG file does not contain layout data. Only PNG files exported from this tool contain the necessary metadata to import layouts.',
          'No Layout Data',
        )
      }
      return
    }

    // Handle JSON files
    if (file.type === 'application/json' || file.name.toLowerCase().endsWith('.json')) {
      console.log(`Processing dropped JSON file: ${file.name}`)

      const text = await file.text()
      const data = parseJsonString(text)

      // Auto-detect format and load accordingly (same logic as file upload)
      if (isInternalKleFormat(data)) {
        // Internal KLE format with meta and keys
        console.log(`Loading internal KLE format from dropped file: ${file.name}`)
        keyboardStore.loadKeyboard(data)
        toast.showSuccess(`Internal KLE layout loaded from ${file.name}`, 'Import Successful')
      } else {
        // Raw KLE format (array-based)
        console.log(`Loading raw KLE format from dropped file: ${file.name}`)
        keyboardStore.loadKLELayout(data)
        toast.showSuccess(`KLE layout loaded from ${file.name}`, 'Import Successful')
      }

      keyboardStore.filename = filenameWithoutExt
      return
    }

    // Unsupported file type
    toast.showError(
      'Please drop a JSON or PNG file with keyboard layout data',
      'Unsupported File Type',
    )
  } catch (error) {
    console.error('Error processing dropped file:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to process file'
    toast.showError(errorMessage, 'Import Failed')
  }
}

const handleExternalZoom = (event: Event) => {
  const customEvent = event as CustomEvent
  zoom.value = customEvent.detail
  nextTick(() => {
    updateCanvasSize()
    nextTick(() => {
      renderKeyboard()
    })
  })
}

const handleExternalResetView = () => {
  zoom.value = 1
  nextTick(() => {
    updateCanvasSize()
    nextTick(() => {
      renderKeyboard()
    })
  })
}

const handleCanvasFocusRequest = () => {
  if (canvasRef.value) {
    canvasRef.value.focus()
  }
}

// System clipboard utility function for copy only
const copyToSystemClipboard = async (rawKleData: string) => {
  try {
    // Try modern Clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(rawKleData)
    } else {
      console.warn('Clipboard API not available, copy not performed')
    }
  } catch (error) {
    console.warn('System clipboard copy error:', error)
  }
}

// Handle system copy event from store
const handleSystemCopy = (event: Event) => {
  const customEvent = event as CustomEvent
  copyToSystemClipboard(customEvent.detail)
}

const resetView = () => {
  nextTick(() => {
    updateCanvasSize()
    nextTick(() => {
      renderKeyboard()
    })
  })
}

const moveSelectedKeys = (deltaX: number, deltaY: number) => {
  keyboardStore.selectedKeys.forEach((key) => {
    key.x = D.add(key.x, deltaX)
    key.y = D.add(key.y, deltaY)

    // Update rotation origins to maintain relative offset when lock rotations is enabled
    if (
      keyboardStore.lockRotations &&
      (key.rotation_x !== undefined || key.rotation_y !== undefined)
    ) {
      if (key.rotation_x !== undefined) {
        key.rotation_x = D.add(key.rotation_x, deltaX)
      }
      if (key.rotation_y !== undefined) {
        key.rotation_y = D.add(key.rotation_y, deltaY)
      }
    }
  })
  keyboardStore.saveState()
  updateCanvasSize()
  nextTick(() => {
    renderKeyboard()
  })
}

const adjustSelectedKeysSize = (dimension: 'width' | 'height', delta: number) => {
  if (keyboardStore.selectedKeys.length === 0) return

  keyboardStore.selectedKeys.forEach((key) => {
    const currentValue = key[dimension]
    const newValue = D.add(currentValue, delta)

    // Prevent negative or zero dimensions
    if (newValue > 0) {
      key[dimension] = newValue

      // Apply the same sync logic as updateWidth/updateHeight functions:
      // If key has secondary dimensions and should remain rectangular,
      // sync the secondary dimension to match primary dimension
      if (dimension === 'width') {
        if (key.width2 !== undefined && !key.stepped && !key.x2 && !key.y2) {
          key.width2 = newValue
        }
      } else if (dimension === 'height') {
        if (key.height2 !== undefined && !key.stepped && !key.x2 && !key.y2) {
          key.height2 = newValue
        }
      }
    }
  })
  keyboardStore.saveState()
  updateCanvasSize()
  nextTick(() => {
    renderKeyboard()
  })
}

const selectNextKey = () => {
  if (keyboardStore.keys.length === 0) return

  // Sort keys by position (top-to-bottom, left-to-right)
  const sortedKeys = [...keyboardStore.keys].sort((a, b) => {
    // First by Y position (top to bottom)
    if (Math.abs(a.y - b.y) > 0.1) {
      return a.y - b.y
    }
    // Then by X position (left to right)
    return a.x - b.x
  })

  let nextIndex = 0

  if (keyboardStore.selectedKeys.length === 1) {
    // Find current key index
    const currentKey = keyboardStore.selectedKeys[0]
    const currentIndex = sortedKeys.findIndex((key) => key === currentKey)

    if (currentIndex !== -1) {
      // Select next key (wrap around to start if at end)
      nextIndex = (currentIndex + 1) % sortedKeys.length
    }
  } else if (keyboardStore.selectedKeys.length > 1) {
    // Multiple keys selected - find the last selected key in sort order
    const lastSelectedKey = keyboardStore.selectedKeys.reduce((latest, key) => {
      const keyIndex = sortedKeys.findIndex((k) => k === key)
      const latestIndex = sortedKeys.findIndex((k) => k === latest)
      return keyIndex > latestIndex ? key : latest
    })

    const currentIndex = sortedKeys.findIndex((key) => key === lastSelectedKey)
    nextIndex = (currentIndex + 1) % sortedKeys.length
  }
  // If no selection, start with first key (nextIndex = 0)

  // Select the next key
  keyboardStore.selectKey(sortedKeys[nextIndex], false)
}

const selectPreviousKey = () => {
  if (keyboardStore.keys.length === 0) return

  // Sort keys by position (top-to-bottom, left-to-right)
  const sortedKeys = [...keyboardStore.keys].sort((a, b) => {
    // First by Y position (top to bottom)
    if (Math.abs(a.y - b.y) > 0.1) {
      return a.y - b.y
    }
    // Then by X position (left to right)
    return a.x - b.x
  })

  let prevIndex = sortedKeys.length - 1

  if (keyboardStore.selectedKeys.length === 1) {
    // Find current key index
    const currentKey = keyboardStore.selectedKeys[0]
    const currentIndex = sortedKeys.findIndex((key) => key === currentKey)

    if (currentIndex !== -1) {
      // Select previous key (wrap around to end if at start)
      prevIndex = currentIndex === 0 ? sortedKeys.length - 1 : currentIndex - 1
    }
  } else if (keyboardStore.selectedKeys.length > 1) {
    // Multiple keys selected - find the first selected key in sort order
    const firstSelectedKey = keyboardStore.selectedKeys.reduce((earliest, key) => {
      const keyIndex = sortedKeys.findIndex((k) => k === key)
      const earliestIndex = sortedKeys.findIndex((k) => k === earliest)
      return keyIndex < earliestIndex ? key : earliest
    })

    const currentIndex = sortedKeys.findIndex((key) => key === firstSelectedKey)
    prevIndex = currentIndex === 0 ? sortedKeys.length - 1 : currentIndex - 1
  }
  // If no selection, start with last key (prevIndex = sortedKeys.length - 1)

  // Select the previous key
  keyboardStore.selectKey(sortedKeys[prevIndex], false)
}

// Calculate which keys are selected by the rectangle selection
const calculateSelectedKeys = (endPos: { x: number; y: number }): Key[] => {
  if (!keyboardStore.rectSelectStart || !renderer.value) {
    return []
  }

  const unit = renderer.value.getOptions().unit

  return keyboardStore.keys.filter((key) => {
    return keyIntersectsSelection(key, keyboardStore.rectSelectStart!, endPos, unit)
  })
}

const getSelectionCommonRotation = (): number => {
  const selectedKeys = keyboardStore.selectedKeys
  if (selectedKeys.length === 0) return 0

  // Check if all selected keys have the same rotation angle
  const firstRotation = selectedKeys[0].rotation_angle || 0
  const allSame = selectedKeys.every((key) => (key.rotation_angle || 0) === firstRotation)

  return allSame ? firstRotation : 0
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handleRotationApply = (angle: number) => {
  // Apply the rotation and clean up
  keyboardStore.applyRotation()

  // Re-render to show final result
  nextTick(() => {
    renderKeyboard()
  })
}

const handleRotationCancel = () => {
  // Cancel rotation and clean up
  keyboardStore.cancelRotation()

  // Re-render to remove any preview
  nextTick(() => {
    renderKeyboard()
  })
}

const handleRotationAngleChange = (angle: number) => {
  // Apply rotation directly to the keys
  keyboardStore.updateRotationPreview(angle)

  // Re-render to show changes
  nextTick(() => {
    renderKeyboard()
  })
}

// Move Exactly handlers
const handleMoveExactlyApply = (deltaX: number, deltaY: number) => {
  // Apply the movement to selected keys and save state
  keyboardStore.moveSelectedKeys(deltaX, deltaY)
  keyboardStore.saveState()

  // Defer the mode change to avoid modal closing before click is processed
  nextTick(() => {
    // Exit move exactly mode
    keyboardStore.setCanvasMode('select')
    // Re-render to show final result
    renderKeyboard()
  })
}

const handleMoveExactlyCancel = () => {
  // Exit move exactly mode without applying changes
  keyboardStore.setCanvasMode('select')
}

const handleMoveExactlyChange = () => {
  // This could be used for real-time preview, but for now we'll just ignore it
  // The actual movement happens only on apply
}

// Cleanup
const cleanup = () => {
  window.removeEventListener('resize', handleWindowResize)
  window.removeEventListener('canvas-zoom', handleExternalZoom as EventListener)
  window.removeEventListener('canvas-reset-view', handleExternalResetView as EventListener)
  window.removeEventListener('request-canvas-focus', handleCanvasFocusRequest as EventListener)
  window.removeEventListener('system-copy', handleSystemCopy as EventListener)

  // Remove global mouse event listeners in case they weren't cleaned up
  document.removeEventListener('mousemove', handleGlobalMouseMove)
  document.removeEventListener('mouseup', handleGlobalMouseUp)

  // Clear cached coordinate offset
  dragCoordinateOffset.value = null

  if (resizeObserver.value) {
    resizeObserver.value.disconnect()
  }
}

// Handle component unmount
onUnmounted(() => {
  cleanup()

  // Clean up theme observer
  if (themeObserver) {
    themeObserver.disconnect()
    themeObserver = null
  }
})

// Expose functions to parent component (currently none needed)
defineExpose({})
</script>

<style scoped>
.keyboard-canvas-container {
  width: 100%;
  height: 100%;
  overflow: auto;
  background: var(--bs-tertiary-bg);
  position: relative;
}

.keyboard-canvas {
  border: none;
  background: white;
  display: block;
  cursor: crosshair;
  outline: none;
  /* Canvas maintains its intrinsic dimensions based on key bounds */
}

/* Drag and drop styling for file uploads */
.keyboard-canvas-container.drag-target {
  background: rgba(40, 167, 69, 0.1);
  border: 2px dashed #28a745;
  position: relative;
  border-radius: 8px;
}

.keyboard-canvas-container.drag-target::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(40, 167, 69, 0.05);
  border-radius: 6px;
  pointer-events: none;
  z-index: 999;
}

.keyboard-canvas-container.drag-target::after {
  content: 'Drop JSON or PNG file to import layout';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #28a745;
  color: white;
  padding: 12px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  pointer-events: none;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
  white-space: nowrap;
}

/* Matrix Renumbering Status Bar */
.matrix-renumbering-status {
  position: absolute;
  bottom: 8px;
  left: 8px;
  background: rgba(255, 193, 7, 0.95);
  color: #000;
  padding: 8px 16px;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 1000;
  pointer-events: none;
  animation: slideIn 0.2s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.matrix-renumbering-status .status-label {
  font-weight: 600;
  font-family: 'Courier New', monospace;
  font-size: 14px;
}

.matrix-renumbering-status .status-hint {
  color: rgba(0, 0, 0, 0.7);
  font-size: 12px;
}

.matrix-renumbering-status kbd {
  background: rgba(0, 0, 0, 0.15);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid rgba(0, 0, 0, 0.2);
}
</style>
