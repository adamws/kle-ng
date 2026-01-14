<template>
  <div class="matrix-overlay-container">
    <canvas
      v-show="visible"
      ref="canvasRef"
      class="matrix-annotation-overlay"
      :width="canvasWidth"
      :height="canvasHeight"
      @click="handleClick"
      @contextmenu.prevent="handleRightClick"
      @mousemove="handleMouseMove"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { type Key } from '@/stores/keyboard'
import type { CanvasRenderer } from '@/utils/canvas-renderer'
import { getKeyCenter as calculateKeyCenter } from '@/utils/keyboard-geometry'
import { findKeysAlongLine } from '@/utils/line-intersection'
import { useKeyboardStore } from '@/stores/keyboard'
import { useMatrixDrawingStore } from '@/stores/matrix-drawing'
import { getKeyChoice } from '@/utils/matrix-validation'

// Props
interface Props {
  visible: boolean
  canvasWidth: number
  canvasHeight: number
  zoom: number
  coordinateOffset: { x: number; y: number }
  renderer: CanvasRenderer | null
}

const props = defineProps<Props>()

// Refs
const canvasRef = ref<HTMLCanvasElement>()
const keyboardStore = useKeyboardStore()
const matrixDrawingStore = useMatrixDrawingStore()

// Preview sequence (local to overlay - not part of store state)
const previewSequence = ref<Key[]>([]) // Preview of what will be added on next click
const errorPreviewSequence = ref<Key[]>([]) // Preview of illegal segments that cannot be added

// Hover state tracking for interactive elements
const hoveredRow = ref<number | null>(null)
const hoveredColumn = ref<number | null>(null)
const hoveredAnchor = ref<{
  type: 'row' | 'column' | 'overlap'
  index: number
  key: Key
  overlappingNodes?: Array<{
    type: 'row' | 'column'
    index: number
    key: Key
    distance: number
  }>
} | null>(null)
const hoveredSegment = ref<{
  type: 'row' | 'column'
  wireIndex: number
  segmentStartIndex: number
  segmentEndIndex: number
  startKey: Key
  endKey: Key
} | null>(null)
const ctrlKeyPressed = ref<boolean>(false)

// Renumbering state
const typedNumberBuffer = ref<string>('')
const renumberingTarget = ref<{
  type: 'row' | 'column'
  index: number
  originalIndex: number
} | null>(null)
const skipNextHoverClear = ref<boolean>(false) // Flag to prevent clearing after renumber

// Computed
const ctx = computed(() => canvasRef.value?.getContext('2d'))

// Check if a key is part of the default layout (no option,choice or choice=0)
// Keys with choice > 0 are alternative layout options and should not have wires drawn
// Uses getKeyChoice from matrix-validation.ts to avoid duplicating parsing logic
const isDefaultLayoutKey = (key: Key): boolean => {
  const choice = getKeyChoice(key)
  // No option,choice (choice is null) = part of default layout
  // choice=0 = default choice for this option
  return choice === null || choice === 0
}

// Filter keys to only include those in the default layout
const filterDefaultLayoutKeys = (keys: Key[]): Key[] => {
  return keys.filter(isDefaultLayoutKey)
}

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
    x: (screenX - props.coordinateOffset.x * props.zoom) / props.zoom,
    y: (screenY - props.coordinateOffset.y * props.zoom) / props.zoom,
  }
}

// Calculate distance from a point to a line segment
const distanceToLineSegment = (
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number => {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSquared = dx * dx + dy * dy

  if (lengthSquared === 0) {
    // Degenerate case: segment is a point
    return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1))
  }

  // Calculate projection parameter t
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared
  t = Math.max(0, Math.min(1, t)) // Clamp to [0, 1]

  // Find the closest point on the segment
  const closestX = x1 + t * dx
  const closestY = y1 + t * dy

  // Return distance from point to closest point on segment
  return Math.sqrt((px - closestX) * (px - closestX) + (py - closestY) * (py - closestY))
}

// Check if a point is near a line segment
const isPointNearLine = (
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  threshold: number = 6,
): boolean => {
  return distanceToLineSegment(px, py, x1, y1, x2, y2) < threshold
}

// Update cursor based on hover state
const updateCursor = () => {
  if (!canvasRef.value) return

  if (matrixDrawingStore.drawingType === 'remove') {
    // Show crosshair when hovering anything removable (node, segment, or wire)
    const isHoveringRemovable =
      hoveredAnchor.value !== null ||
      hoveredSegment.value !== null ||
      hoveredRow.value !== null ||
      hoveredColumn.value !== null
    canvasRef.value.style.cursor = isHoveringRemovable ? 'crosshair' : 'default'
    return
  }

  // In draw mode (row/column), always use default cursor
  canvasRef.value.style.cursor = 'default'
}

// Detect what the mouse is hovering over
const detectHover = (canvasX: number, canvasY: number) => {
  const NODE_HOVER_THRESHOLD = 8
  const LINE_HOVER_THRESHOLD = 6

  // Save previous hover state to detect changes
  const previousHoveredRow = hoveredRow.value
  const previousHoveredColumn = hoveredColumn.value

  // Reset hover state
  hoveredRow.value = null
  hoveredColumn.value = null
  hoveredAnchor.value = null
  hoveredSegment.value = null

  // Check for node hover (priority over line hover)
  const allNodes: Array<{
    type: 'row' | 'column'
    index: number
    key: Key
    distance: number
  }> = []

  // Collect all row nodes from completed rows
  matrixDrawingStore.completedRows.forEach((keySequence, rowIndex) => {
    keySequence.forEach((key) => {
      const center = getKeyCenter(key)
      const distance = Math.sqrt(Math.pow(center.x - canvasX, 2) + Math.pow(center.y - canvasY, 2))
      if (distance < NODE_HOVER_THRESHOLD) {
        allNodes.push({ type: 'row', index: rowIndex, key, distance })
      }
    })
  })

  // Collect all column nodes from completed columns
  matrixDrawingStore.completedColumns.forEach((keySequence, colIndex) => {
    keySequence.forEach((key) => {
      const center = getKeyCenter(key)
      const distance = Math.sqrt(Math.pow(center.x - canvasX, 2) + Math.pow(center.y - canvasY, 2))
      if (distance < NODE_HOVER_THRESHOLD) {
        allNodes.push({ type: 'column', index: colIndex, key, distance })
      }
    })
  })

  // If hovering over node(s)
  if (allNodes.length > 0) {
    // Sort by distance
    allNodes.sort((a, b) => a.distance - b.distance)
    const closest = allNodes[0]
    if (!closest) return

    // Check for overlapping nodes at this position
    const overlapping = allNodes.filter(
      (node) =>
        Math.abs(getKeyCenter(node.key).x - getKeyCenter(closest.key).x) < 0.1 &&
        Math.abs(getKeyCenter(node.key).y - getKeyCenter(closest.key).y) < 0.1,
    )

    if (overlapping.length > 1) {
      // Multiple nodes at same position
      hoveredAnchor.value = {
        type: 'overlap',
        index: closest.index,
        key: closest.key,
        overlappingNodes: overlapping,
      }
    } else {
      // Single node
      hoveredAnchor.value = {
        type: closest.type,
        index: closest.index,
        key: closest.key,
      }
    }
    return
  }

  // Check for segment hover (rows) - priority over entire wire hover
  if (!hoveredAnchor.value) {
    // Check row segments
    for (const [rowIndex, keySequence] of matrixDrawingStore.completedRows) {
      if (keySequence.length < 2) continue

      for (let i = 0; i < keySequence.length - 1; i++) {
        const startKey = keySequence[i]
        const endKey = keySequence[i + 1]
        if (!startKey || !endKey) continue

        const start = getKeyCenter(startKey)
        const end = getKeyCenter(endKey)

        if (
          isPointNearLine(canvasX, canvasY, start.x, start.y, end.x, end.y, LINE_HOVER_THRESHOLD)
        ) {
          hoveredSegment.value = {
            type: 'row',
            wireIndex: rowIndex,
            segmentStartIndex: i,
            segmentEndIndex: i + 1,
            startKey,
            endKey,
          }
          hoveredRow.value = rowIndex
          return
        }
      }
    }
  }

  // Check for segment hover (columns) - priority over entire wire hover
  if (!hoveredAnchor.value && !hoveredSegment.value) {
    // Check column segments
    for (const [colIndex, keySequence] of matrixDrawingStore.completedColumns) {
      if (keySequence.length < 2) continue

      for (let i = 0; i < keySequence.length - 1; i++) {
        const startKey = keySequence[i]
        const endKey = keySequence[i + 1]
        if (!startKey || !endKey) continue

        const start = getKeyCenter(startKey)
        const end = getKeyCenter(endKey)

        if (
          isPointNearLine(canvasX, canvasY, start.x, start.y, end.x, end.y, LINE_HOVER_THRESHOLD)
        ) {
          hoveredSegment.value = {
            type: 'column',
            wireIndex: colIndex,
            segmentStartIndex: i,
            segmentEndIndex: i + 1,
            startKey,
            endKey,
          }
          hoveredColumn.value = colIndex
          return
        }
      }
    }
  }

  // Clear renumbering buffer if hover target changed
  if (
    (previousHoveredRow !== hoveredRow.value || previousHoveredColumn !== hoveredColumn.value) &&
    renumberingTarget.value !== null
  ) {
    // Skip clearing if we just renumbered (hover change is expected)
    if (skipNextHoverClear.value) {
      skipNextHoverClear.value = false // Reset flag
    } else {
      typedNumberBuffer.value = ''
      renumberingTarget.value = null
    }
  }
}

// Mouse move handler - show preview of next segment and detect hover
const handleMouseMove = (event: MouseEvent) => {
  // Track Ctrl/Cmd key state
  const previousCtrlState = ctrlKeyPressed.value
  ctrlKeyPressed.value = event.ctrlKey || event.metaKey

  const canvasPos = getCanvasPosition(event)

  // In remove mode, always detect hover for targeting elements
  if (matrixDrawingStore.drawingType === 'remove') {
    detectHover(canvasPos.x, canvasPos.y)
    updateCursor()
    // Re-render if Ctrl state changed to update visual feedback
    if (previousCtrlState !== ctrlKeyPressed.value) {
      renderCanvas()
    } else {
      renderCanvas()
    }
    return
  }

  // Don't update hover state when actively drawing a segment
  const isActivelyDrawing =
    matrixDrawingStore.isDrawing && matrixDrawingStore.currentSequence.length > 0
  if (!isActivelyDrawing) {
    // Detect hover for existing matrix annotations
    detectHover(canvasPos.x, canvasPos.y)
    updateCursor()
  } else {
    // Reset cursor to default while actively drawing
    if (canvasRef.value) {
      canvasRef.value.style.cursor = 'default'
    }
  }

  if (
    !matrixDrawingStore.isDrawing ||
    !props.renderer ||
    matrixDrawingStore.currentSequence.length === 0
  ) {
    // Not actively drawing - just show hover effects
    // Clear preview if there was one
    if (previewSequence.value.length > 0 || errorPreviewSequence.value.length > 0) {
      previewSequence.value = []
      errorPreviewSequence.value = []
    }
    // Always render to show hover effects
    renderCanvas()
    return
  }
  const closestKey = findClosestKey(canvasPos.x, canvasPos.y, keyboardStore.keys)

  if (!closestKey || matrixDrawingStore.currentSequence.includes(closestKey)) {
    // Clear preview if hovering over already-included key
    if (previewSequence.value.length > 0 || errorPreviewSequence.value.length > 0) {
      previewSequence.value = []
      errorPreviewSequence.value = []
      renderCanvas()
    }
    return
  }

  // Calculate preview: what keys would be added if user clicks here
  const lastKey = matrixDrawingStore.currentSequence[matrixDrawingStore.currentSequence.length - 1]
  if (!lastKey) return
  const lastKeyCenter = calculateKeyCenter(lastKey)
  const newKeyCenter = calculateKeyCenter(closestKey)

  // Find all keys along the line between the last key and the new key
  const keysAlongLine = findKeysAlongLine(
    lastKeyCenter,
    newKeyCenter,
    keyboardStore.keys,
    matrixDrawingStore.sensitivity,
  )

  // Separate keys into legal and illegal
  const newKeys: Key[] = []
  const illegalKeys: Key[] = []

  keysAlongLine.forEach((key) => {
    // Skip keys already in current sequence
    if (matrixDrawingStore.currentSequence.includes(key)) return

    // Check if key would violate matrix rules
    if (matrixDrawingStore.canAddKeyToSequence(key, keyboardStore.keys)) {
      newKeys.push(key)
    } else {
      illegalKeys.push(key)
    }
  })

  // Update preview if it changed
  const previewChanged =
    previewSequence.value.length !== newKeys.length ||
    !previewSequence.value.every((key, i) => key === newKeys[i])

  const errorPreviewChanged =
    errorPreviewSequence.value.length !== illegalKeys.length ||
    !errorPreviewSequence.value.every((key, i) => key === illegalKeys[i])

  if (previewChanged || errorPreviewChanged) {
    previewSequence.value = newKeys
    errorPreviewSequence.value = illegalKeys
    renderCanvas()
  }
}

// Click handler - add keys to sequence or finish sequence
const handleClick = (event: MouseEvent) => {
  if (!matrixDrawingStore.isDrawing || !props.renderer) return

  // Capture Ctrl/Cmd state at click time
  const isCtrlHeld = event.ctrlKey || event.metaKey

  // Handle remove mode - directly remove hovered elements
  if (matrixDrawingStore.drawingType === 'remove') {
    // Priority 1: Node removal (unchanged)
    if (hoveredAnchor.value !== null) {
      handleRemoveNode({
        type: hoveredAnchor.value.type,
        index: hoveredAnchor.value.index,
        key: hoveredAnchor.value.key,
      })
      return
    }

    // Priority 2: Wire/Segment removal based on Ctrl state
    if (isCtrlHeld) {
      // CTRL HELD: Full wire removal
      if (hoveredRow.value !== null) {
        handleRemoveRow(hoveredRow.value)
      } else if (hoveredColumn.value !== null) {
        handleRemoveColumn(hoveredColumn.value)
      }
    } else {
      // NO CTRL: Segment removal
      if (hoveredSegment.value !== null) {
        handleRemoveSegment(hoveredSegment.value)
      }
    }

    return
  }

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
      errorPreviewSequence.value = []
      // Reset cursor - will be updated on next mouse move
      if (canvasRef.value) {
        canvasRef.value.style.cursor = 'default'
      }
      renderCanvas()
    }
    return
  }

  // If this is the second or later key, find all keys along the line from the last key to this one
  if (matrixDrawingStore.currentSequence.length > 0) {
    const lastKey =
      matrixDrawingStore.currentSequence[matrixDrawingStore.currentSequence.length - 1]
    if (!lastKey) return
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
    errorPreviewSequence.value = []
    // Reset cursor - will be updated on next mouse move
    if (canvasRef.value) {
      canvasRef.value.style.cursor = 'default'
    }
  } else {
    // First key - just add it and wait for second click
    matrixDrawingStore.addKeyToSequence(closestKey)

    // T-junction support: If user clicked on an existing segment or node, store the insertion point
    // This allows new segments to be inserted at the clicked position rather than appended
    // Pass the clicked key as anchor for proximity-based insertion direction
    if (hoveredSegment.value !== null) {
      // Clicking on a segment - set the insertion point to be after the segment's start key
      // Use the segment's start key as the anchor for proximity calculation
      matrixDrawingStore.setInsertAfterIndex(
        hoveredSegment.value.segmentStartIndex,
        hoveredSegment.value.startKey,
      )
    } else if (hoveredAnchor.value !== null) {
      // Clicking on a node (circle) - find the position of this key in its wire
      const anchor = hoveredAnchor.value
      let wire: Key[] | undefined

      if (matrixDrawingStore.drawingType === 'row' && anchor.type === 'row') {
        wire = matrixDrawingStore.completedRows.get(anchor.index)
      } else if (matrixDrawingStore.drawingType === 'column' && anchor.type === 'column') {
        wire = matrixDrawingStore.completedColumns.get(anchor.index)
      }

      if (wire) {
        // Find the index of the clicked key in the wire
        const keyIndex = wire.indexOf(anchor.key)
        if (keyIndex !== -1) {
          // Set insertion point with the clicked key as anchor for proximity calculation
          matrixDrawingStore.setInsertAfterIndex(keyIndex, anchor.key)
        } else {
          matrixDrawingStore.setInsertAfterIndex(null, null)
        }
      } else {
        matrixDrawingStore.setInsertAfterIndex(null, null)
      }
    } else {
      // Not clicking on a segment or node - ensure insertion point is null (append to end)
      matrixDrawingStore.setInsertAfterIndex(null, null)
    }

    // Clear hover states now that we're actively drawing
    hoveredRow.value = null
    hoveredColumn.value = null
    hoveredAnchor.value = null
    hoveredSegment.value = null
    // Reset cursor to default while actively drawing
    if (canvasRef.value) {
      canvasRef.value.style.cursor = 'default'
    }
  }

  renderCanvas()
}

// Right-click handler - cancel drawing while actively drawing
const handleRightClick = () => {
  // If actively drawing, cancel the current sequence
  const isActivelyDrawing =
    matrixDrawingStore.isDrawing && matrixDrawingStore.currentSequence.length > 0
  if (isActivelyDrawing) {
    // Cancel the current drawing
    matrixDrawingStore.clearCurrentSequence()
    previewSequence.value = []
    errorPreviewSequence.value = []
    // Reset cursor
    if (canvasRef.value) {
      canvasRef.value.style.cursor = 'default'
    }
    renderCanvas()
  }
}

// Keyboard event handlers for Ctrl/Cmd key tracking
const handleCtrlKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Control' || event.key === 'Meta') {
    const previousState = ctrlKeyPressed.value
    ctrlKeyPressed.value = true
    // Update visual feedback when Ctrl state changes (highlight changes)
    if (previousState !== ctrlKeyPressed.value && matrixDrawingStore.drawingType === 'remove') {
      renderCanvas()
    }
  }
}

const handleCtrlKeyUp = (event: KeyboardEvent) => {
  if (event.key === 'Control' || event.key === 'Meta') {
    const previousState = ctrlKeyPressed.value
    ctrlKeyPressed.value = false
    // Update visual feedback when Ctrl state changes (highlight changes)
    if (previousState !== ctrlKeyPressed.value && matrixDrawingStore.drawingType === 'remove') {
      renderCanvas()
    }
  }
}

// Keyboard handler for renumbering rows/columns
const handleKeyDown = (event: KeyboardEvent) => {
  // Don't intercept if overlay is not visible
  if (!props.visible) {
    return
  }

  // Only intercept keys when hovering over a row/column (hoveredRow/hoveredColumn !== null)
  if (hoveredRow.value === null && hoveredColumn.value === null) {
    return
  }

  // Set renumbering target if not already set
  if (renumberingTarget.value === null) {
    if (hoveredRow.value !== null) {
      // Hovering over a row
      renumberingTarget.value = {
        type: 'row',
        index: hoveredRow.value,
        originalIndex: hoveredRow.value, // Store original for Backspace restoration
      }
    } else if (hoveredColumn.value !== null) {
      // Hovering over a column
      renumberingTarget.value = {
        type: 'column',
        index: hoveredColumn.value,
        originalIndex: hoveredColumn.value, // Store original for Backspace restoration
      }
    } else {
      return
    }
  }

  // Only proceed if we have a valid renumbering target
  if (!renumberingTarget.value) {
    return
  }

  // Handle Escape key - cancel renumbering
  if (event.key === 'Escape') {
    // Only handle Escape if we have an active renumbering (typed buffer exists)
    if (typedNumberBuffer.value.length > 0) {
      typedNumberBuffer.value = ''
      renumberingTarget.value = null
      skipNextHoverClear.value = false
      renderCanvas()
      event.preventDefault()
      event.stopPropagation() // Prevent modal from closing
      return
    }
    // If no active renumbering, let the event propagate (modal will handle it)
    return
  }

  // Handle Backspace key - remove last digit from buffer
  if (event.key === 'Backspace') {
    if (typedNumberBuffer.value.length > 0) {
      // Remove last character from buffer
      typedNumberBuffer.value = typedNumberBuffer.value.slice(0, -1)
      renderCanvas()
      event.preventDefault()
      event.stopPropagation()
      return
    }
    // No active typing, let event propagate
    return
  }

  // Handle Enter key - confirm renumbering
  if (event.key === 'Enter') {
    if (typedNumberBuffer.value.length > 0) {
      const newNumber = parseInt(typedNumberBuffer.value, 10)

      if (renumberingTarget.value.type === 'row') {
        const oldIndex = renumberingTarget.value.index
        matrixDrawingStore.renumberRow(oldIndex, newNumber)
        renumberingTarget.value.index = newNumber
        hoveredRow.value = newNumber
        skipNextHoverClear.value = true
      } else if (renumberingTarget.value.type === 'column') {
        const oldIndex = renumberingTarget.value.index
        matrixDrawingStore.renumberColumn(oldIndex, newNumber)
        renumberingTarget.value.index = newNumber
        hoveredColumn.value = newNumber
        skipNextHoverClear.value = true
      }

      // Clear buffer after applying
      typedNumberBuffer.value = ''
      renderCanvas()
      event.preventDefault()
      event.stopPropagation()
      return
    }
    // No active typing, let event propagate
    return
  }

  // Handle digit keys (0-9) - just add to buffer, don't renumber yet
  // Ignore other keys
  if (event.key >= '0' && event.key <= '9') {
    typedNumberBuffer.value += event.key
    renderCanvas()
    event.preventDefault()
    event.stopPropagation()
    return
  }
}

// Update key label after removing from row or column
const updateKeyLabelAfterRemoval = (key: Key) => {
  // Find if key still exists in any row or column
  let hasRow = false
  let hasColumn = false
  let rowIndex: number | null = null
  let colIndex: number | null = null

  // Check completed rows
  matrixDrawingStore.completedRows.forEach((keys, idx) => {
    if (keys.includes(key)) {
      hasRow = true
      rowIndex = idx
    }
  })

  // Check completed columns
  matrixDrawingStore.completedColumns.forEach((keys, idx) => {
    if (keys.includes(key)) {
      hasColumn = true
      colIndex = idx
    }
  })

  // Update label based on what's still assigned
  if (!hasRow && !hasColumn) {
    key.labels[0] = ''
  } else if (!hasRow && hasColumn) {
    // Only column remains
    key.labels[0] = colIndex !== null ? `,${colIndex}` : ''
  } else if (hasRow && !hasColumn) {
    // Only row remains
    key.labels[0] = rowIndex !== null ? `${rowIndex},` : ''
  } else if (hasRow && hasColumn) {
    // Both remain
    key.labels[0] = rowIndex !== null && colIndex !== null ? `${rowIndex},${colIndex}` : ''
  }
}

// Handle remove node action from context menu
const handleRemoveNode = (data: {
  type: 'row' | 'column' | 'overlap'
  index: number
  key: Key
}) => {
  // Remove the key from both rows and columns if it's an overlap
  if (data.type === 'overlap') {
    // Find all rows and columns containing this key
    matrixDrawingStore.completedRows.forEach((keys, rowIndex) => {
      matrixDrawingStore.removeKeyFromRow(rowIndex, data.key, true) // Skip sync
    })

    matrixDrawingStore.completedColumns.forEach((keys, colIndex) => {
      matrixDrawingStore.removeKeyFromColumn(colIndex, data.key, true) // Skip sync
    })
  } else if (data.type === 'row') {
    matrixDrawingStore.removeKeyFromRow(data.index, data.key, true) // Skip sync
  } else if (data.type === 'column') {
    matrixDrawingStore.removeKeyFromColumn(data.index, data.key, true) // Skip sync
  }

  // Update the label based on remaining assignments
  updateKeyLabelAfterRemoval(data.key)

  // Re-render to show the updated overlay
  renderCanvas()
}

// Handle remove row action from context menu
const handleRemoveRow = (rowIndex: number) => {
  // Collect keys before removing
  const keysToUpdate: Set<Key> = new Set()

  // Get keys from the row
  const row = matrixDrawingStore.completedRows.get(rowIndex)
  if (row) {
    row.forEach((key) => keysToUpdate.add(key))
    matrixDrawingStore.removeRow(rowIndex, true) // Skip sync to prevent re-application
  }

  // Update labels for all affected keys
  keysToUpdate.forEach((key) => updateKeyLabelAfterRemoval(key))

  // Clear hover states
  hoveredSegment.value = null
  hoveredRow.value = null
  hoveredColumn.value = null

  // Re-render to show the updated overlay
  renderCanvas()
}

// Handle remove column action from context menu
const handleRemoveColumn = (colIndex: number) => {
  // Collect keys before removing
  const keysToUpdate: Set<Key> = new Set()

  // Get keys from the column
  const col = matrixDrawingStore.completedColumns.get(colIndex)
  if (col) {
    col.forEach((key) => keysToUpdate.add(key))
    matrixDrawingStore.removeColumn(colIndex, true) // Skip sync to prevent re-application
  }

  // Update labels for all affected keys
  keysToUpdate.forEach((key) => updateKeyLabelAfterRemoval(key))

  // Clear hover states
  hoveredSegment.value = null
  hoveredRow.value = null
  hoveredColumn.value = null

  // Re-render to show the updated overlay
  renderCanvas()
}

// Handle remove segment action - splits wire at segment boundary
const handleRemoveSegment = (segment: {
  type: 'row' | 'column'
  wireIndex: number
  segmentStartIndex: number
  segmentEndIndex: number
  startKey: Key
  endKey: Key
}) => {
  let newWireIndex: number | null = null

  if (segment.type === 'row') {
    newWireIndex = matrixDrawingStore.splitRowAtSegment(
      segment.wireIndex,
      segment.segmentStartIndex,
      true, // skipSync
    )
  } else if (segment.type === 'column') {
    newWireIndex = matrixDrawingStore.splitColumnAtSegment(
      segment.wireIndex,
      segment.segmentStartIndex,
      true, // skipSync
    )
  }

  if (newWireIndex !== null) {
    // Success: log and re-render canvas
    console.log(`Wire split. New ${segment.type} ${newWireIndex} created.`)
    renderCanvas()
  } else {
    // Failure: log warning
    console.warn('Failed to split segment:', segment)
  }

  // Clear hover states
  hoveredSegment.value = null
  hoveredRow.value = null
  hoveredColumn.value = null
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
    props.coordinateOffset.x * props.zoom,
    props.coordinateOffset.y * props.zoom,
  )

  // Render completed drawn rows (blue)
  // Only render keys that are part of the default layout (no option,choice or choice=0)
  matrixDrawingStore.completedRows.forEach((keys) => {
    const defaultKeys = filterDefaultLayoutKeys(keys)
    if (defaultKeys.length > 0) {
      renderRow(defaultKeys)
    }
  })

  // Render completed drawn columns (green)
  // Only render keys that are part of the default layout (no option,choice or choice=0)
  matrixDrawingStore.completedColumns.forEach((keys) => {
    const defaultKeys = filterDefaultLayoutKeys(keys)
    if (defaultKeys.length > 0) {
      renderColumn(defaultKeys)
    }
  })

  // Render current sequence being drawn (yellow/orange)
  if (matrixDrawingStore.currentSequence.length > 0) {
    renderCurrentSequence(matrixDrawingStore.currentSequence)
  }

  // Render preview sequence (semi-transparent gray)
  if (previewSequence.value.length > 0) {
    renderPreviewSequence(previewSequence.value)
  }

  // Render error sequence (illegal segments in red)
  if (errorPreviewSequence.value.length > 0) {
    renderErrorSequence(errorPreviewSequence.value)
  }

  // Render hover effects on top of everything
  renderHoverEffects()

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
    if (!lastKey) return
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

// Render error sequence (illegal segments in red)
const renderErrorSequence = (keys: Key[]) => {
  if (!ctx.value || keys.length === 0) return

  const path = keys.map((key) => getKeyCenter(key))

  const lineColor = 'rgba(220, 53, 69, 0.8)' // Semi-transparent red
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
    if (!lastKey) return
    const lastKeyCenter = getKeyCenter(lastKey)
    ctx.value.moveTo(lastKeyCenter.x, lastKeyCenter.y)

    // Draw line to all error keys
    path.forEach((point) => {
      ctx.value!.lineTo(point.x, point.y)
    })
  } else {
    // If no current sequence, just draw between error keys
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

  // Draw key markers with red fill and X mark
  path.forEach((point) => {
    // Draw red circle
    ctx.value!.fillStyle = 'rgba(220, 53, 69, 0.6)'
    ctx.value!.strokeStyle = 'rgba(220, 53, 69, 1)'
    ctx.value!.lineWidth = 2
    ctx.value!.beginPath()
    ctx.value!.arc(point.x, point.y, circleRadius, 0, Math.PI * 2)
    ctx.value!.fill()
    ctx.value!.stroke()

    // Draw X mark inside circle
    ctx.value!.strokeStyle = '#ffffff'
    ctx.value!.lineWidth = 2
    const xSize = circleRadius * 0.6
    ctx.value!.beginPath()
    ctx.value!.moveTo(point.x - xSize, point.y - xSize)
    ctx.value!.lineTo(point.x + xSize, point.y + xSize)
    ctx.value!.moveTo(point.x + xSize, point.y - xSize)
    ctx.value!.lineTo(point.x - xSize, point.y + xSize)
    ctx.value!.stroke()
  })
}

// Render hover effects
const renderHoverEffects = () => {
  if (!ctx.value) return

  // Check if we're in remove mode and Ctrl is NOT pressed
  const isRemoveMode = matrixDrawingStore.drawingType === 'remove'
  const shouldShowSegmentOnly = isRemoveMode && !ctrlKeyPressed.value

  if (shouldShowSegmentOnly && hoveredSegment.value) {
    // NO CTRL in remove mode: Show only the hovered segment
    // Only show if both segment keys are in default layout
    if (
      isDefaultLayoutKey(hoveredSegment.value.startKey) &&
      isDefaultLayoutKey(hoveredSegment.value.endKey)
    ) {
      renderHoveredSegment(hoveredSegment.value)
    }
  } else {
    // CTRL HELD or NOT in remove mode: Show full wire
    // Filter to only show default layout keys
    if (hoveredRow.value !== null) {
      const keys = matrixDrawingStore.completedRows.get(hoveredRow.value)
      if (keys) {
        const defaultKeys = filterDefaultLayoutKeys(keys)
        if (defaultKeys.length > 0) {
          renderHoveredRow(defaultKeys)
        }
      }
    }

    if (hoveredColumn.value !== null) {
      const keys = matrixDrawingStore.completedColumns.get(hoveredColumn.value)
      if (keys) {
        const defaultKeys = filterDefaultLayoutKeys(keys)
        if (defaultKeys.length > 0) {
          renderHoveredColumn(defaultKeys)
        }
      }
    }
  }

  // Node hover - only show if key is in default layout
  if (hoveredAnchor.value && isDefaultLayoutKey(hoveredAnchor.value.key)) {
    renderHoveredNode(hoveredAnchor.value)
  }
}

// Render a hovered node (yellow circle highlight)
const renderHoveredNode = (anchor: {
  type: 'row' | 'column' | 'overlap'
  index: number
  key: Key
  overlappingNodes?: Array<{
    type: 'row' | 'column'
    index: number
    key: Key
    distance: number
  }>
}) => {
  if (!ctx.value) return

  const center = getKeyCenter(anchor.key)

  // Draw yellow highlight circle
  ctx.value.fillStyle = 'rgba(255, 193, 7, 0.3)' // Semi-transparent yellow
  ctx.value.strokeStyle = '#ffc107' // Yellow border
  ctx.value.lineWidth = 2
  ctx.value.beginPath()
  ctx.value.arc(center.x, center.y, 10, 0, Math.PI * 2)
  ctx.value.fill()
  ctx.value.stroke()
}

// Render a hovered row (thicker blue line)
const renderHoveredRow = (keys: Key[]) => {
  if (!ctx.value || keys.length === 0) return

  const path = keys.map((key) => getKeyCenter(key))

  const lineColor = '#007bff' // Blue
  const lineWidth = 4 // Thicker to indicate hover
  const circleRadius = 7 // Larger circles

  // Draw thicker line segments
  ctx.value.strokeStyle = lineColor
  ctx.value.lineWidth = lineWidth
  ctx.value.globalAlpha = 0.7
  ctx.value.beginPath()

  path.forEach((point, i) => {
    if (i === 0) {
      ctx.value!.moveTo(point.x, point.y)
    } else {
      ctx.value!.lineTo(point.x, point.y)
    }
  })

  ctx.value.stroke()
  ctx.value.globalAlpha = 1.0

  // Draw larger key markers
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

// Render a hovered column (thicker green line)
const renderHoveredColumn = (keys: Key[]) => {
  if (!ctx.value || keys.length === 0) return

  const path = keys.map((key) => getKeyCenter(key))

  const lineColor = '#28a745' // Green
  const lineWidth = 4 // Thicker to indicate hover
  const circleRadius = 7 // Larger circles

  // Draw thicker line segments
  ctx.value.strokeStyle = lineColor
  ctx.value.lineWidth = lineWidth
  ctx.value.globalAlpha = 0.7
  ctx.value.beginPath()

  path.forEach((point, i) => {
    if (i === 0) {
      ctx.value!.moveTo(point.x, point.y)
    } else {
      ctx.value!.lineTo(point.x, point.y)
    }
  })

  ctx.value.stroke()
  ctx.value.globalAlpha = 1.0

  // Draw larger key markers
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

// Render a hovered segment (same style as full wire, just one segment)
const renderHoveredSegment = (segment: { type: 'row' | 'column'; startKey: Key; endKey: Key }) => {
  if (!ctx.value) return

  const start = getKeyCenter(segment.startKey)
  const end = getKeyCenter(segment.endKey)

  // Use same colors as full wire hover: blue for rows, green for columns
  const lineColor = segment.type === 'row' ? '#007bff' : '#28a745'
  const lineWidth = 4 // Same as full wire
  const circleRadius = 7

  // Draw solid line segment (same style as full wire)
  ctx.value.strokeStyle = lineColor
  ctx.value.lineWidth = lineWidth
  ctx.value.globalAlpha = 0.7 // Same as full wire
  ctx.value.beginPath()
  ctx.value.moveTo(start.x, start.y)
  ctx.value.lineTo(end.x, end.y)
  ctx.value.stroke()
  ctx.value.globalAlpha = 1.0

  // Draw endpoint markers (circles at segment boundaries)
  ;[start, end].forEach((point) => {
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
  () => [props.canvasWidth, props.canvasHeight, props.zoom],
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
// Watch store drawing state and sync pointer events
watch(
  () => matrixDrawingStore.isDrawing,
  (isDrawing) => {
    // Pointer events should be enabled whenever overlay is visible
    // (for both drawing and context menu interactions)
    if (canvasRef.value) {
      canvasRef.value.style.pointerEvents = 'auto'
    }
    if (!isDrawing) {
      previewSequence.value = []
      errorPreviewSequence.value = []
      renderCanvas()
    }
  },
)

// Watch for changes in completed drawings to re-render
watch(
  () => [matrixDrawingStore.completedRows.size, matrixDrawingStore.completedColumns.size],
  () => {
    renderCanvas()
  },
)

// Public method to enable drawing mode
const enableDrawing = (type: 'row' | 'column') => {
  matrixDrawingStore.enableDrawing(type)
  previewSequence.value = []
  errorPreviewSequence.value = []
  // Clear hover states when starting to draw
  hoveredRow.value = null
  hoveredColumn.value = null
  hoveredAnchor.value = null
  hoveredSegment.value = null
  // Reset cursor
  if (canvasRef.value) {
    canvasRef.value.style.cursor = 'default'
  }
}

// Public method to disable drawing mode
const disableDrawing = () => {
  matrixDrawingStore.disableDrawing()
  previewSequence.value = []
  errorPreviewSequence.value = []
  // Update cursor based on current hover state
  updateCursor()
  renderCanvas()
}

// Public method to get completed rows/columns
const getCompletedDrawings = () => {
  return matrixDrawingStore.getCompletedDrawings()
}

// Public method to clear all drawings
const clearDrawings = () => {
  previewSequence.value = []
  errorPreviewSequence.value = []
  matrixDrawingStore.clearDrawings()
  renderCanvas()
}

// Computed property for renumbering status message
const renumberingStatus = computed(() => {
  if (!renumberingTarget.value || !typedNumberBuffer.value) {
    return null
  }

  const type = renumberingTarget.value.type === 'row' ? 'Row' : 'Column'
  const original = renumberingTarget.value.originalIndex
  const newValue = typedNumberBuffer.value

  return {
    type,
    original,
    newValue,
    message: `${type} ${original} → ${newValue}`,
  }
})

// Expose public methods and renumbering state
defineExpose({
  renderCanvas,
  enableDrawing,
  disableDrawing,
  getCompletedDrawings,
  clearDrawings,
  renumberingStatus,
})

// Watch for visibility changes to clean up renumbering state
watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      // Clear renumbering state when overlay is hidden
      typedNumberBuffer.value = ''
      renumberingTarget.value = null
      skipNextHoverClear.value = false
    }
  },
)

// Initial render
onMounted(() => {
  renderCanvas()

  // Add keyboard event listeners for Ctrl/Cmd tracking
  window.addEventListener('keydown', handleCtrlKeyDown)
  window.addEventListener('keyup', handleCtrlKeyUp)

  // Add keyboard event listener for renumbering
  // Use capture phase to ensure we get events before modal's handler
  document.addEventListener('keydown', handleKeyDown, true)
})

// Cleanup
onUnmounted(() => {
  // Remove keyboard event listeners
  window.removeEventListener('keydown', handleCtrlKeyDown)
  window.removeEventListener('keyup', handleCtrlKeyUp)
  document.removeEventListener('keydown', handleKeyDown, true)
})
</script>

<style scoped>
.matrix-overlay-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none; /* Let clicks pass through container */
  z-index: 10;
}

.matrix-annotation-overlay {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: auto; /* Enable interaction for hover effects and drawing */
  z-index: 10;
}
</style>
