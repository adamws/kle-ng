<!--
  FootprintPreview Component

  Displays an interactive SVG preview of selected switch and diode footprints
  overlapping in their actual positions. Provides immediate visual feedback
  before generating a full PCB.

  When the LED chain feature is enabled, per-key LED and (optional) decoupling
  capacitor footprints are also shown in their configured positions. These
  currently use placeholder rectangle SVGs; real footprint SVGs land later.

  Usage:
  <FootprintPreview />

  The component automatically reacts to settings changes in the Pinia store
  and updates the preview accordingly.
-->

<script setup lang="ts">
import { ref, computed, watch, watchEffect, onMounted, nextTick, onUnmounted } from 'vue'
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'
import { storeToRefs } from 'pinia'
import type { ViewBox, HoveredFootprintElement, FootprintGroup } from '@/types/footprint'
import {
  getSwitchFootprintFilename,
  getDiodeFootprintFilename,
  getLedFootprintFilename,
  getCapacitorFootprintFilename,
  getFootprintSvgUrl,
  parseViewBox,
  extractSvgContent,
  calculateCompositeViewBoxMulti,
  calculateElementCenter,
  type OffsetFootprint,
} from '@/utils/footprintUtils'
import BiInfoCircle from 'bootstrap-icons/icons/info-circle.svg'
import BiExclamationTriangle from 'bootstrap-icons/icons/exclamation-triangle.svg'

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
const ledSvgContent = ref<string>('')
const capacitorSvgContent = ref<string>('')
const switchViewBox = ref<ViewBox | null>(null)
const diodeViewBox = ref<ViewBox | null>(null)
const ledViewBox = ref<ViewBox | null>(null)
const capacitorViewBox = ref<ViewBox | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
const isFallback = ref(false)
const loadController = ref<AbortController | null>(null)

// Hover state
const hoveredElement = ref<HoveredFootprintElement | null>(null)
const switchGroupRef = ref<SVGGElement | null>(null)
const diodeGroupRef = ref<SVGGElement | null>(null)
const ledGroupRef = ref<SVGGElement | null>(null)
const capacitorGroupRef = ref<SVGGElement | null>(null)

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

// LED chain visibility (mirrors the store's conditional API submission)
const showLed = computed(() => settings.value.createLedSchFile)
const showCapacitor = computed(
  () => settings.value.createLedSchFile && !settings.value.skipLedDecoupling,
)

const ledSvgUrl = computed(() => {
  const filename = getLedFootprintFilename(settings.value.ledFootprint)
  return getFootprintSvgUrl(filename, settings.value.ledSide)
})

const capacitorSvgUrl = computed(() => {
  const filename = getCapacitorFootprintFilename(settings.value.ledCapacitorFootprint)
  return getFootprintSvgUrl(filename, settings.value.ledCapacitorSide)
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
    const signal = loadController.value.signal

    // Load switch + diode (always) plus LED + capacitor (when enabled) in parallel
    const [switchSvg, diodeSvg, ledSvg, capacitorSvg] = await Promise.all([
      loadSvg(switchSvgUrl.value, signal),
      loadSvg(diodeSvgUrl.value, signal),
      showLed.value ? loadSvg(ledSvgUrl.value, signal) : Promise.resolve(null),
      showCapacitor.value ? loadSvg(capacitorSvgUrl.value, signal) : Promise.resolve(null),
    ])

    // CRITICAL: Parse viewBox from original SVG BEFORE extracting content
    switchViewBox.value = parseViewBox(switchSvg)
    diodeViewBox.value = parseViewBox(diodeSvg)

    // Extract inner SVG content (remove outer <svg> wrapper)
    // This prevents coordinate system conflicts when injecting into parent SVG
    switchSvgContent.value = extractSvgContent(switchSvg)
    diodeSvgContent.value = extractSvgContent(diodeSvg)

    // LED + capacitor placeholders (cleared when disabled)
    if (ledSvg) {
      ledViewBox.value = parseViewBox(ledSvg)
      ledSvgContent.value = extractSvgContent(ledSvg)
    } else {
      ledViewBox.value = null
      ledSvgContent.value = ''
    }
    if (capacitorSvg) {
      capacitorViewBox.value = parseViewBox(capacitorSvg)
      capacitorSvgContent.value = extractSvgContent(capacitorSvg)
    } else {
      capacitorViewBox.value = null
      capacitorSvgContent.value = ''
    }

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
 * Resolve the offset-footprint placement for a group (diode/LED/capacitor).
 * Returns null for the switch (which is centered, not offset) or when the
 * group's footprint isn't loaded.
 */
function offsetForGroup(group: FootprintGroup): OffsetFootprint | null {
  switch (group) {
    case 'diode':
      return diodeViewBox.value
        ? {
            vb: diodeViewBox.value,
            offsetX: settings.value.diodePositionX,
            offsetY: settings.value.diodePositionY,
            rotation: settings.value.diodeRotation,
          }
        : null
    case 'led':
      return ledViewBox.value
        ? {
            vb: ledViewBox.value,
            offsetX: settings.value.ledPositionX,
            offsetY: settings.value.ledPositionY,
            rotation: settings.value.ledRotation,
          }
        : null
    case 'capacitor':
      return capacitorViewBox.value
        ? {
            vb: capacitorViewBox.value,
            offsetX: settings.value.ledCapacitorPositionX,
            offsetY: settings.value.ledCapacitorPositionY,
            rotation: settings.value.ledCapacitorRotation,
          }
        : null
    default:
      return null
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
    setupGroupHoverHandlers(ledGroupRef.value, 'led')
    setupGroupHoverHandlers(capacitorGroupRef.value, 'capacitor')
  })
}

/**
 * Attach event listeners to all hoverable elements in a footprint group
 * Properly tracks event handlers for cleanup to prevent memory leaks
 */
function setupGroupHoverHandlers(groupElement: SVGGElement | null, groupType: FootprintGroup) {
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
        offsetForGroup(groupType),
        settings.value.switchRotation,
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

  // Remove every tracked listener (covers all groups: switch/diode/LED/capacitor)
  eventHandlers.forEach((handlers, element) => {
    element.removeEventListener('mouseenter', handlers.enter)
    element.removeEventListener('mouseleave', handlers.leave)
  })
  eventHandlers.clear()
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

/**
 * Builds the SVG transform for a footprint positioned relative to the switch
 * center (diode, LED, capacitor). Offsets and rotation are switch-relative:
 *
 * 1. translate(-center): center the footprint at origin
 * 2. rotate(rotation + switchRotation): switch-relative orientation
 * 3. translate(rotatedOffset): offset vector rotated into world coords
 *
 * Note: SVG applies the chain right-to-left, matching the order above.
 */
function buildOffsetTransform(
  vb: ViewBox,
  offsetX: number,
  offsetY: number,
  rotation: number,
): string {
  const centerX = vb.x + vb.width / 2
  const centerY = vb.y + vb.height / 2

  // Rotate the switch-relative offset vector by the switch rotation so that,
  // e.g., a 180° switch flips a "5mm right" offset to 5mm left in world coords.
  const switchRotationRad = (settings.value.switchRotation * Math.PI) / 180
  const cos = Math.cos(switchRotationRad)
  const sin = Math.sin(switchRotationRad)
  const rotatedOffsetX = offsetX * cos - offsetY * sin
  const rotatedOffsetY = offsetX * sin + offsetY * cos

  // Footprint orientation is switch-relative too.
  const finalRotation = rotation + settings.value.switchRotation

  return `translate(${rotatedOffsetX}, ${rotatedOffsetY}) rotate(${finalRotation}) translate(${-centerX}, ${-centerY})`
}

// Computed transform for diode (offset from switch center with rotation)
const diodeTransform = computed(() => {
  if (!diodeViewBox.value) return ''
  return buildOffsetTransform(
    diodeViewBox.value,
    settings.value.diodePositionX,
    settings.value.diodePositionY,
    settings.value.diodeRotation,
  )
})

// Computed transform for LED placeholder (offset from switch center with rotation)
const ledTransform = computed(() => {
  if (!ledViewBox.value) return ''
  return buildOffsetTransform(
    ledViewBox.value,
    settings.value.ledPositionX,
    settings.value.ledPositionY,
    settings.value.ledRotation,
  )
})

// Computed transform for LED decoupling capacitor placeholder
const capacitorTransform = computed(() => {
  if (!capacitorViewBox.value) return ''
  return buildOffsetTransform(
    capacitorViewBox.value,
    settings.value.ledCapacitorPositionX,
    settings.value.ledCapacitorPositionY,
    settings.value.ledCapacitorRotation,
  )
})

// Computed base viewBox without zoom (memoized separately for performance)
const baseViewBox = computed(() => {
  if (!switchViewBox.value || !diodeViewBox.value) {
    return null
  }

  // Diode is always present; LED and capacitor only when the feature is enabled.
  const offsets: OffsetFootprint[] = [
    {
      vb: diodeViewBox.value,
      offsetX: settings.value.diodePositionX,
      offsetY: settings.value.diodePositionY,
      rotation: settings.value.diodeRotation,
    },
  ]

  if (showLed.value && ledViewBox.value) {
    offsets.push({
      vb: ledViewBox.value,
      offsetX: settings.value.ledPositionX,
      offsetY: settings.value.ledPositionY,
      rotation: settings.value.ledRotation,
    })
  }

  if (showCapacitor.value && capacitorViewBox.value) {
    offsets.push({
      vb: capacitorViewBox.value,
      offsetX: settings.value.ledCapacitorPositionX,
      offsetY: settings.value.ledCapacitorPositionY,
      rotation: settings.value.ledCapacitorRotation,
    })
  }

  return calculateCompositeViewBoxMulti(
    switchViewBox.value,
    offsets,
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

// Watch for settings changes and reload footprints. Includes LED/capacitor
// URLs and visibility so toggling the feature (or its sides/footprints) reloads.
watch([switchSvgUrl, diodeSvgUrl, ledSvgUrl, capacitorSvgUrl, showLed, showCapacitor], () => {
  loadFootprints()
})

// Re-attach hover handlers when any group's SVG content changes
watch([switchSvgContent, diodeSvgContent, ledSvgContent, capacitorSvgContent], () => {
  setupHoverHandlers()
})

// Re-calculate coordinates if settings change while hovering
// Using watchEffect to automatically track all dependencies and reduce redundancy
watchEffect(() => {
  // Automatically tracks switchRotation and the hovered group's placement
  // settings (via offsetForGroup) plus the relevant viewBoxes.
  if (hoveredElement.value && switchViewBox.value && hoveredElement.value.element) {
    const center = calculateElementCenter(
      hoveredElement.value.element,
      hoveredElement.value.group,
      switchViewBox.value,
      offsetForGroup(hoveredElement.value.group),
      settings.value.switchRotation,
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

        <!-- LED footprint (offset from switch center) -->
        <g v-if="showLed && ledSvgContent" ref="ledGroupRef" :transform="ledTransform">
          <g v-html="ledSvgContent"></g>
        </g>

        <!-- LED decoupling capacitor footprint (offset from switch center) -->
        <g
          v-if="showCapacitor && capacitorSvgContent"
          ref="capacitorGroupRef"
          :transform="capacitorTransform"
        >
          <g v-html="capacitorSvgContent"></g>
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
          <BiInfoCircle />
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
      <BiExclamationTriangle class="text-warning fs-3" />
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
