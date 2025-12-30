<!--
  FootprintPreview Component

  Displays an interactive SVG preview of selected switch and diode footprints
  overlapping in their actual positions. Provides immediate visual feedback
  before generating a full PCB.

  Usage:
  <FootprintPreview />

  The component automatically reacts to settings changes in the Pinia store
  and updates the preview accordingly.
-->

<script setup lang="ts">
import { ref, computed, watch, watchEffect, onMounted, nextTick, onUnmounted } from 'vue'
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'
import { storeToRefs } from 'pinia'
import type { ViewBox, HoveredFootprintElement } from '@/types/footprint'
import {
  getSwitchFootprintFilename,
  getDiodeFootprintFilename,
  getFootprintSvgUrl,
  parseViewBox,
  extractSvgContent,
  calculateCompositeViewBox,
  calculateElementCenter,
} from '@/utils/footprintUtils'

// Constants for footprint positioning
const CONTAINER_PADDING = 2.0 // mm
// Zoom factor for preview (higher = larger footprints)
// 1.0 = normal, 2.0 = 2x zoom, 0.5 = 0.5x zoom
const ZOOM_FACTOR = 1.3

// Pinia store access
const pcbStore = usePcbGeneratorStore()
const { settings } = storeToRefs(pcbStore)

// Component state
const switchSvgContent = ref<string>('')
const diodeSvgContent = ref<string>('')
const switchViewBox = ref<ViewBox | null>(null)
const diodeViewBox = ref<ViewBox | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
const isFallback = ref(false)
const loadController = ref<AbortController | null>(null)

// Hover state
const hoveredElement = ref<HoveredFootprintElement | null>(null)
const switchGroupRef = ref<SVGGElement | null>(null)
const diodeGroupRef = ref<SVGGElement | null>(null)

// Event listener tracking for proper cleanup (prevents memory leaks)
type EventHandlerPair = {
  enter: EventListener
  leave: EventListener
}
const eventHandlers = new Map<Element, EventHandlerPair>()

// Computed SVG URLs based on current settings
const switchSvgUrl = computed(() => {
  const filename = getSwitchFootprintFilename(settings.value.switchFootprint)
  return getFootprintSvgUrl(filename, settings.value.switchSide)
})

const diodeSvgUrl = computed(() => {
  const filename = getDiodeFootprintFilename(settings.value.diodeFootprint)
  return getFootprintSvgUrl(filename, settings.value.diodeSide)
})

/**
 * Loads a single SVG file from URL
 */
async function loadSvg(url: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Failed to load SVG: ${response.status} ${response.statusText}`)
  }
  return await response.text()
}

/**
 * Loads both switch and diode SVG footprints in parallel
 * Cancels any previous pending requests to avoid race conditions
 */
async function loadFootprints() {
  // Cancel previous request if still in flight
  loadController.value?.abort()
  loadController.value = new AbortController()

  isLoading.value = true
  error.value = null

  try {
    // Load both SVGs in parallel
    const [switchSvg, diodeSvg] = await Promise.all([
      loadSvg(switchSvgUrl.value, loadController.value.signal),
      loadSvg(diodeSvgUrl.value, loadController.value.signal),
    ])

    // CRITICAL: Parse viewBox from original SVG BEFORE extracting content
    switchViewBox.value = parseViewBox(switchSvg)
    diodeViewBox.value = parseViewBox(diodeSvg)

    // Extract inner SVG content (remove outer <svg> wrapper)
    // This prevents coordinate system conflicts when injecting into parent SVG
    switchSvgContent.value = extractSvgContent(switchSvg)
    diodeSvgContent.value = extractSvgContent(diodeSvg)

    // Check if using fallback
    const switchFilename = getSwitchFootprintFilename(settings.value.switchFootprint)
    const actualFootprint = settings.value.switchFootprint
    isFallback.value =
      !actualFootprint.includes('Cherry_MX') && switchFilename === 'SW_Cherry_MX_PCB_1.00u.svg'
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') return // Ignore aborted requests
    console.error('Failed to load footprint SVGs:', err)
    error.value = 'Failed to load footprint previews. Please check that SVG files exist.'
  } finally {
    isLoading.value = false
  }
}

/**
 * Setup hover handlers on SVG elements after content injection
 */
function setupHoverHandlers() {
  cleanupHoverHandlers()

  nextTick(() => {
    setupGroupHoverHandlers(switchGroupRef.value, 'switch')
    setupGroupHoverHandlers(diodeGroupRef.value, 'diode')
  })
}

/**
 * Attach event listeners to all hoverable elements in a footprint group
 * Properly tracks event handlers for cleanup to prevent memory leaks
 */
function setupGroupHoverHandlers(groupElement: SVGGElement | null, groupType: 'switch' | 'diode') {
  if (!groupElement) return

  // Query ALL elements with class="hoverable" (circles, paths, rects, polygons, etc.)
  const hoverableElements = groupElement.querySelectorAll<SVGCircleElement | SVGPathElement>(
    '.hoverable',
  )

  hoverableElements.forEach((element) => {
    // Create specific handler functions for this element
    const handleEnter: EventListener = () => {
      const center = calculateElementCenter(
        element,
        groupType,
        switchViewBox.value,
        diodeViewBox.value,
        settings.value,
      )
      hoveredElement.value = {
        type: element.tagName.toLowerCase() as 'circle' | 'path',
        group: groupType,
        centerX: center.x,
        centerY: center.y,
        element,
      }
    }

    const handleLeave: EventListener = () => {
      hoveredElement.value = null
    }

    // Attach listeners
    element.addEventListener('mouseenter', handleEnter)
    element.addEventListener('mouseleave', handleLeave)
    element.style.cursor = 'crosshair'

    // Store handlers for cleanup
    eventHandlers.set(element, { enter: handleEnter, leave: handleLeave })
  })
}

/**
 * Cleanup hover handlers
 * Properly removes event listeners to prevent memory leaks
 */
function cleanupHoverHandlers() {
  hoveredElement.value = null

  // Remove event listeners from switch group elements
  if (switchGroupRef.value) {
    const elements = switchGroupRef.value.querySelectorAll('.hoverable')
    elements.forEach((element) => {
      const handlers = eventHandlers.get(element)
      if (handlers) {
        element.removeEventListener('mouseenter', handlers.enter)
        element.removeEventListener('mouseleave', handlers.leave)
        eventHandlers.delete(element)
      }
    })
  }

  // Remove event listeners from diode group elements
  if (diodeGroupRef.value) {
    const elements = diodeGroupRef.value.querySelectorAll('.hoverable')
    elements.forEach((element) => {
      const handlers = eventHandlers.get(element)
      if (handlers) {
        element.removeEventListener('mouseenter', handlers.enter)
        element.removeEventListener('mouseleave', handlers.leave)
        eventHandlers.delete(element)
      }
    })
  }
}

/**
 * Format coordinate value for display
 */
const formatCoordinate = (value: number): string => {
  return value.toFixed(3)
}

// Computed transform for switch (centered at origin with rotation)
const switchTransform = computed(() => {
  if (!switchViewBox.value) return ''

  const switchVB = switchViewBox.value
  // Center the switch at origin by translating to negative center point
  const centerX = switchVB.x + switchVB.width / 2
  const centerY = switchVB.y + switchVB.height / 2
  const rotation = settings.value.switchRotation

  // Transform chain (SVG applies right-to-left):
  // 1. translate(-centerX, -centerY): center switch at origin
  // 2. rotate(rotation): rotate around origin
  return `rotate(${rotation}) translate(${-centerX}, ${-centerY})`
})

// Computed transform for diode (offset from switch center with rotation)
const diodeTransform = computed(() => {
  if (!diodeViewBox.value) return ''

  const diodeVB = diodeViewBox.value
  // Calculate diode center in its viewBox coordinate system
  const diodeCenterX = diodeVB.x + diodeVB.width / 2
  const diodeCenterY = diodeVB.y + diodeVB.height / 2

  // User's diode position offsets in SWITCH-RELATIVE coordinates
  // Example: offsetX=5 means "5mm to the right in the switch's local coordinate frame"
  // When switch is rotated, the offset direction rotates with it
  const offsetX = settings.value.diodePositionX
  const offsetY = settings.value.diodePositionY
  const diodeRotation = settings.value.diodeRotation

  // CRITICAL FIX: Transform offset from switch-relative to world coordinates
  // We must rotate the offset vector by the switch rotation angle
  //
  // Why: When switch rotates 180°, its local x-axis points LEFT in world coords
  //      So offsetX=5 (right in switch frame) → -5 (left in world frame)
  //
  // Rotation Matrix:
  //   [cos -sin] [offsetX]   [rotatedOffsetX]
  //   [sin  cos] [offsetY] = [rotatedOffsetY]
  const switchRotationRad = (settings.value.switchRotation * Math.PI) / 180
  const cos = Math.cos(switchRotationRad)
  const sin = Math.sin(switchRotationRad)

  const rotatedOffsetX = offsetX * cos - offsetY * sin
  const rotatedOffsetY = offsetX * sin + offsetY * cos

  // CRITICAL FIX: Diode rotation is also switch-relative
  // The diode should maintain its orientation relative to the switch
  // Final rotation in world coords = diodeRotation + switchRotation
  const finalDiodeRotation = diodeRotation + settings.value.switchRotation

  // Transform chain (SVG applies right-to-left):
  // 1. translate(-diodeCenterX, -diodeCenterY): center diode at origin
  // 2. rotate(finalDiodeRotation): rotate diode around its center (switch-relative + switch rotation)
  // 3. translate(rotatedOffsetX, rotatedOffsetY): move to final position in world coords
  return `translate(${rotatedOffsetX}, ${rotatedOffsetY}) rotate(${finalDiodeRotation}) translate(${-diodeCenterX}, ${-diodeCenterY})`
})

// Computed base viewBox without zoom (memoized separately for performance)
const baseViewBox = computed(() => {
  if (!switchViewBox.value || !diodeViewBox.value) {
    return null
  }

  return calculateCompositeViewBox(
    switchViewBox.value,
    diodeViewBox.value,
    settings.value.diodePositionX,
    settings.value.diodePositionY,
    settings.value.diodeRotation,
    settings.value.switchRotation,
    CONTAINER_PADDING,
  )
})

// Computed composite viewBox with zoom applied
// Separated for better memoization - zoom calculation only runs when baseViewBox changes
const compositeViewBox = computed(() => {
  if (!baseViewBox.value) {
    return '0 0 100 100' // Default fallback
  }

  // Parse viewBox values
  const parts = baseViewBox.value.split(' ').map(Number)
  const minX = parts[0] ?? 0
  const minY = parts[1] ?? 0
  const width = parts[2] ?? 100
  const height = parts[3] ?? 100

  // Apply zoom factor (divide to zoom in, making footprints appear larger)
  const zoomedWidth = width / ZOOM_FACTOR
  const zoomedHeight = height / ZOOM_FACTOR

  // Adjust minX/minY to keep centered after zoom
  const centerX = minX + width / 2
  const centerY = minY + height / 2
  const zoomedMinX = centerX - zoomedWidth / 2
  const zoomedMinY = centerY - zoomedHeight / 2

  return `${zoomedMinX} ${zoomedMinY} ${zoomedWidth} ${zoomedHeight}`
})

// Watch for settings changes and reload footprints
watch([switchSvgUrl, diodeSvgUrl], () => {
  loadFootprints()
})

// Re-attach hover handlers when SVG content changes
watch([switchSvgContent, diodeSvgContent], () => {
  setupHoverHandlers()
})

// Re-calculate coordinates if settings change while hovering
// Using watchEffect to automatically track all dependencies and reduce redundancy
watchEffect(() => {
  // Automatically tracks: switchRotation, diodeRotation, diodePositionX, diodePositionY
  // as well as switchViewBox and diodeViewBox
  if (
    hoveredElement.value &&
    switchViewBox.value &&
    diodeViewBox.value &&
    hoveredElement.value.element
  ) {
    const center = calculateElementCenter(
      hoveredElement.value.element,
      hoveredElement.value.group,
      switchViewBox.value,
      diodeViewBox.value,
      settings.value,
    )
    // Update coordinates reactively
    hoveredElement.value.centerX = center.x
    hoveredElement.value.centerY = center.y
  }
})

// Load footprints on component mount
onMounted(() => {
  loadFootprints()
})

// Cleanup on unmount
onUnmounted(() => {
  cleanupHoverHandlers()
})
</script>

<template>
  <div class="footprint-preview">
    <!-- SVG Container (always present to maintain height) -->
    <div class="svg-container" :class="{ 'svg-hidden': error }">
      <svg :viewBox="compositeViewBox" class="preview-svg" xmlns="http://www.w3.org/2000/svg">
        <!-- Switch footprint (centered at origin) -->
        <g ref="switchGroupRef" :transform="switchTransform">
          <g v-html="switchSvgContent"></g>
        </g>

        <!-- Diode footprint (offset from switch center) -->
        <g ref="diodeGroupRef" :transform="diodeTransform">
          <g v-html="diodeSvgContent"></g>
        </g>

        <!-- Crosshair overlay -->
        <g v-if="hoveredElement" class="crosshair-layer">
          <!-- Horizontal line -->
          <line
            :x1="hoveredElement.centerX - 1.5"
            :y1="hoveredElement.centerY"
            :x2="hoveredElement.centerX + 1.5"
            :y2="hoveredElement.centerY"
            class="crosshair-line"
          />
          <!-- Vertical line -->
          <line
            :x1="hoveredElement.centerX"
            :y1="hoveredElement.centerY - 1.5"
            :x2="hoveredElement.centerX"
            :y2="hoveredElement.centerY + 1.5"
            class="crosshair-line"
          />
          <!-- Center dot -->
          <circle
            :cx="hoveredElement.centerX"
            :cy="hoveredElement.centerY"
            r="0.3"
            class="crosshair-center"
          />
        </g>
      </svg>

      <!-- Coordinate display overlay -->
      <div v-if="hoveredElement" class="coordinate-display">
        <span class="coord-label">Center:</span>
        <span class="coord-values">
          ({{ formatCoordinate(hoveredElement.centerX) }},
          {{ formatCoordinate(hoveredElement.centerY) }}) mm
        </span>
      </div>

      <!-- Fallback warning overlay -->
      <div v-if="isFallback" class="preview-warning">
        <small>
          <i class="bi bi-info-circle"></i>
          Using Cherry MX preview (exact footprint SVG not yet available)
        </small>
      </div>
    </div>

    <!-- Loading State Overlay -->
    <div v-if="isLoading" class="preview-overlay">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading footprints...</span>
      </div>
      <p class="text-muted mt-2">Loading preview...</p>
    </div>

    <!-- Error State Overlay -->
    <div v-else-if="error" class="preview-overlay">
      <i class="bi bi-exclamation-triangle text-warning fs-3"></i>
      <p class="text-muted mt-2">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
.footprint-preview {
  width: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.svg-container {
  width: 100%;
  height: 450px;
  border: 1px solid var(--bs-border-color);
  border-radius: 0.375rem;
  position: relative;
  overflow: hidden;
}

.svg-container.svg-hidden {
  opacity: 0;
  pointer-events: none;
}

.preview-svg {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.preview-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem;
  z-index: 10;
}

.preview-warning {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.7);
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  z-index: 5;
}

.preview-warning small {
  color: rgba(255, 255, 255, 0.8);
}

/* Crosshair styles */
.crosshair-layer {
  pointer-events: none;
}

.crosshair-line {
  stroke: #ff0000;
  stroke-width: 0.08;
  stroke-linecap: round;
  opacity: 0.8;
}

.crosshair-center {
  fill: #ff0000;
  fill-opacity: 0.6;
  stroke: #ffffff;
  stroke-width: 0.04;
}

/* Coordinate display */
.coordinate-display {
  position: absolute;
  top: 8px;
  right: 8px;
  background-color: rgba(0, 0, 0, 0.85);
  color: white;
  padding: 6px 10px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  line-height: 1.2;
  pointer-events: none;
  z-index: 20;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.coord-label {
  font-weight: normal;
  margin-right: 4px;
  opacity: 0.8;
}

.coord-values {
  font-weight: 600;
}
</style>
