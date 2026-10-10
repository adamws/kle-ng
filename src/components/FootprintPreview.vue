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
import type { CopperLayer, TrackItem } from '@/types/tracks'
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
  switchSvgTransform,
  offsetSvgTransform,
  switchLocalSvgTransform,
  boardToSwitchLocal,
  switchLocalToBoard,
  type OffsetFootprint,
  type BoardSide,
} from '@/utils/footprintUtils'
import { usePanZoom } from '@/composables/usePanZoom'
import { footprintNameFromSvg, loadFootprintPads } from '@/utils/pcb/footprint-pads-loader'
import { placePads, type FootprintPad } from '@/utils/kicad/footprint-pads'
import TrackLayer from './pcb/TrackLayer.vue'
import PadLayer from './pcb/PadLayer.vue'
import type { PlacedPad } from '@/utils/pcb-tracks/netlist'
import GridLayer from './pcb/GridLayer.vue'
import DrcLayer from './pcb/DrcLayer.vue'
import TrackEditorLayer from './pcb/TrackEditorLayer.vue'
import TrackEditorToolbar from './pcb/TrackEditorToolbar.vue'
import { usePcbTracksStore } from '@/stores/pcbTracks'
import { placedPadNet } from '@/utils/pcb-tracks/netlist'
import type { DragHandle } from '@/utils/pcb-tracks/drag'
import { isCrossing, tracksInBox, type Box } from '@/utils/pcb-tracks/selection'
import TrackSelectionBar from './pcb/TrackSelectionBar.vue'
import StalePresetBanner from './pcb/StalePresetBanner.vue'
import type { Point } from '@/composables/usePanZoom'
import BiInfoCircle from 'bootstrap-icons/icons/info-circle.svg'
import BiExclamationTriangle from 'bootstrap-icons/icons/exclamation-triangle.svg'
import BiPencilSquare from 'bootstrap-icons/icons/pencil-square.svg'
import BiZoomIn from 'bootstrap-icons/icons/zoom-in.svg'
import BiZoomOut from 'bootstrap-icons/icons/zoom-out.svg'
import BiFullscreen from 'bootstrap-icons/icons/fullscreen.svg'
import BiEye from 'bootstrap-icons/icons/eye.svg'
import BiEyeSlash from 'bootstrap-icons/icons/eye-slash.svg'

// Constants for footprint positioning
const CONTAINER_PADDING = 2.0 // mm
// Zoom factor for preview (higher = larger footprints)
// 1.0 = normal, 2.0 = 2x zoom, 0.5 = 0.5x zoom
const ZOOM_FACTOR = 1.3

// Pinia store access
const pcbStore = usePcbGeneratorStore()
const { settings } = storeToRefs(pcbStore)
const tracks = usePcbTracksStore()
const { editorSettings } = storeToRefs(tracks)

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
            side: settings.value.diodeSide,
          }
        : null
    case 'led':
      return ledViewBox.value
        ? {
            vb: ledViewBox.value,
            offsetX: settings.value.ledPositionX,
            offsetY: settings.value.ledPositionY,
            rotation: settings.value.ledRotation,
            side: settings.value.ledSide,
          }
        : null
    case 'capacitor':
      return capacitorViewBox.value
        ? {
            vb: capacitorViewBox.value,
            offsetX: settings.value.ledCapacitorPositionX,
            offsetY: settings.value.ledCapacitorPositionY,
            rotation: settings.value.ledCapacitorRotation,
            side: settings.value.ledCapacitorSide,
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
        settings.value.switchSide,
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

// Footprint transforms follow kbplacer's placement, see the coordinate
// contract in footprintUtils.ts (KiCad rotations, BACK side mirroring).
const switchTransform = computed(() => {
  if (!switchViewBox.value) return ''
  return switchSvgTransform(
    switchViewBox.value,
    settings.value.switchRotation,
    settings.value.switchSide,
  )
})

function groupTransform(group: FootprintGroup): string {
  const offset = offsetForGroup(group)
  return offset ? offsetSvgTransform(offset, settings.value.switchRotation) : ''
}

// Track preset overlay, drawn in the switch-local frame. Presets are defined
// for a front-side switch, so nothing is drawn for back-side switches. While a
// track is dragged, the store's items are the drag preview.
const trackPresetItems = computed<TrackItem[]>(() => tracks.presetItems)
const switchLocalTransform = computed(() => switchLocalSvgTransform(settings.value.switchRotation))

const diodeTransform = computed(() => groupTransform('diode'))
const ledTransform = computed(() => groupTransform('led'))
const capacitorTransform = computed(() => groupTransform('capacitor'))

// Computed base viewBox without zoom (memoized separately for performance)
const baseViewBox = computed(() => {
  if (!switchViewBox.value || !diodeViewBox.value) {
    return null
  }

  // Diode is always present; LED and capacitor only when the feature is enabled.
  const groups: FootprintGroup[] = ['diode']
  if (showLed.value) groups.push('led')
  if (showCapacitor.value) groups.push('capacitor')
  const offsets = groups
    .map(offsetForGroup)
    .filter((offset): offset is OffsetFootprint => offset !== null)

  return calculateCompositeViewBoxMulti(
    switchViewBox.value,
    offsets,
    settings.value.switchRotation,
    CONTAINER_PADDING,
  )
})

// Computed composite viewBox with zoom applied
// Separated for better memoization - zoom calculation only runs when baseViewBox changes
const fittedViewBox = computed<ViewBox>(() => {
  if (!baseViewBox.value) {
    return { x: 0, y: 0, width: 100, height: 100 } // Default fallback
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

  return { x: zoomedMinX, y: zoomedMinY, width: zoomedWidth, height: zoomedHeight }
})

const compositeViewBox = computed(() => {
  const vb = fittedViewBox.value
  return `${vb.x} ${vb.y} ${vb.width} ${vb.height}`
})

// Track editor. B2: pan/zoom, pads
// from the pad geometry JSON, grid and a cursor readout; no drawing yet.
// The editor works in the switch-local frame, which presets are defined for,
// so it needs a front-side switch.
const svgRef = ref<SVGSVGElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const editMode = ref(false)
const canEdit = computed(() => settings.value.switchSide === 'FRONT')
const panZoom = usePanZoom(svgRef, fittedViewBox.value)
const svgViewBox = computed(() =>
  editMode.value ? panZoom.viewBoxString.value : compositeViewBox.value,
)

const visibleLayers = ref<Record<CopperLayer, boolean>>({ 'F.Cu': true, 'B.Cu': true })
const cursorLocal = ref<{ x: number; y: number } | null>(null)
const hoveredPadKey = ref<string | null>(null)

function toggleEditMode() {
  editMode.value = !editMode.value
  tracks.reset()
  if (editMode.value) {
    panZoom.fit(fittedViewBox.value)
    nextTick(() => containerRef.value?.focus({ preventScroll: true }))
  }
}

watch(canEdit, (can) => {
  if (!can && editMode.value) toggleEditMode()
})

// Size of the SVG on screen, for the grid density
const svgSize = ref({ width: 0, height: 0 })
let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !svgRef.value) return
  resizeObserver = new ResizeObserver(([entry]) => {
    if (entry) svgSize.value = { width: entry.contentRect.width, height: entry.contentRect.height }
  })
  resizeObserver.observe(svgRef.value)
})
onUnmounted(() => resizeObserver?.disconnect())

const pxPerMm = computed(() => {
  const vb = editMode.value ? panZoom.viewBox.value : fittedViewBox.value
  const { width, height } = svgSize.value
  return width && height ? Math.min(width / vb.width, height / vb.height) : 1
})

/** Half size of a square around the switch origin covering the whole view. */
const gridExtent = computed(() => {
  const vb = panZoom.viewBox.value
  const far = Math.max(
    Math.hypot(vb.x, vb.y),
    Math.hypot(vb.x + vb.width, vb.y),
    Math.hypot(vb.x, vb.y + vb.height),
    Math.hypot(vb.x + vb.width, vb.y + vb.height),
  )
  return Math.ceil(far + 1)
})

// Pad geometry of the placed footprints, switch-local
interface PadSource {
  owner: string
  name: string
  placement: { x: number; y: number; rotation: number; side: BoardSide }
}

const padSources = computed<PadSource[]>(() => {
  const s = settings.value
  const sources: PadSource[] = [
    {
      owner: 'SW',
      name: footprintNameFromSvg(getSwitchFootprintFilename(s.switchFootprint)),
      placement: { x: 0, y: 0, rotation: 0, side: s.switchSide },
    },
    {
      owner: 'D',
      name: footprintNameFromSvg(getDiodeFootprintFilename(s.diodeFootprint)),
      placement: {
        x: s.diodePositionX,
        y: s.diodePositionY,
        rotation: s.diodeRotation,
        side: s.diodeSide,
      },
    },
  ]
  if (showLed.value) {
    sources.push({
      owner: 'LED',
      name: footprintNameFromSvg(getLedFootprintFilename(s.ledFootprint)),
      placement: { x: s.ledPositionX, y: s.ledPositionY, rotation: s.ledRotation, side: s.ledSide },
    })
  }
  if (showCapacitor.value) {
    sources.push({
      owner: 'C',
      name: footprintNameFromSvg(getCapacitorFootprintFilename(s.ledCapacitorFootprint)),
      placement: {
        x: s.ledCapacitorPositionX,
        y: s.ledCapacitorPositionY,
        rotation: s.ledCapacitorRotation,
        side: s.ledCapacitorSide,
      },
    })
  }
  return sources
})

const libraryPads = ref<Record<string, readonly FootprintPad[]>>({})
const padsError = ref<string | null>(null)

// Pads drive the editor and the preset's DRC, so they load whenever the
// preview shows (the files are small and cached).
watch(
  () => padSources.value.map((src) => src.name).join('|'),
  async () => {
    padsError.value = null
    try {
      const names = [...new Set(padSources.value.map((src) => src.name))]
      const loaded = await Promise.all(names.map((name) => loadFootprintPads(name)))
      libraryPads.value = Object.fromEntries(names.map((name, i) => [name, loaded[i]!.pads]))
    } catch (err) {
      console.error('Failed to load footprint pads:', err)
      padsError.value = 'Failed to load pad geometry.'
    }
  },
  { immediate: true },
)

const previewPads = computed<PlacedPad[]>(() =>
  padSources.value.flatMap(({ owner, name, placement }) => {
    const pads = libraryPads.value[name]
    if (!pads) return []
    return placePads(pads, placement).map((pad, i) => ({ key: `${owner}:${i}`, owner, pad }))
  }),
)

// DRC and ratsnest of the preset (or of no tracks, while editing). Pads of
// every placed footprint must be loaded, or obstacles would be missing.
const padsReady = computed(() => padSources.value.every((src) => libraryPads.value[src.name]))
const showDrc = computed(
  () =>
    settings.value.switchSide === 'FRONT' &&
    padsReady.value &&
    (editMode.value || trackPresetItems.value.length > 0),
)
// the store runs DRC on the preset, plus the route and its preview while routing
const drc = computed(() => (showDrc.value ? tracks.drc : null))

watch(previewPads, (pads) => tracks.setPads(pads), { immediate: true })
// anchors attract the cursor within a few screen pixels
watch(pxPerMm, (scale) => (tracks.snapRadius = SNAP_RADIUS_PX / scale), { immediate: true })

const routeStatus = computed(() => {
  const r = tracks.route
  if (!r) return null
  return `Routing ${r.net ?? 'new net'} on ${r.layer}, ${r.width} mm`
})
const blockedReason = computed(() => tracks.previewViolations[0]?.message ?? null)

// a refused click flashes the canvas
const blockedFlash = ref(false)
let flashTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => tracks.blockedCount,
  () => {
    blockedFlash.value = true
    clearTimeout(flashTimer)
    flashTimer = setTimeout(() => (blockedFlash.value = false), 300)
  },
)
const drcSummary = computed(() => {
  if (!drc.value) return null
  const errors = drc.value.violations.length
  const unrouted = drc.value.ratsnest.length
  const parts = [
    errors && `${errors} DRC error${errors > 1 ? 's' : ''}`,
    unrouted && `${unrouted} unrouted`,
  ].filter(Boolean)
  return { ok: parts.length === 0, text: parts.length ? parts.join(' · ') : 'DRC clean' }
})

const hoveredPad = computed(() =>
  hoveredPadKey.value ? previewPads.value.find((p) => p.key === hoveredPadKey.value) : undefined,
)

function padLabel(p: PlacedPad): string {
  const kind = p.pad.type === 'np_thru_hole' ? 'hole' : `pad ${p.pad.number || '–'}`
  return `${p.owner} ${kind}`
}

/** Anchor attraction radius on screen. */
const SNAP_RADIUS_PX = 10

// a left click that started a Space+drag pan isn't a routing click
let clickIsPan = false
// a left click that ends a box selection isn't a selection click either
let clickIsBox = false

/** Box selection being dragged (select tool), board axes. */
const selectionBox = ref<Box | null>(null)
let boxStart: { client: Point; board: Point } | null = null
/** Drag distance that turns a click into a box selection, px. */
const BOX_THRESHOLD_PX = 4
/** Click tolerance around a track's edge, px. */
const PICK_TOLERANCE_PX = 4

const visibleLayerList = computed(() =>
  (['F.Cu', 'B.Cu'] as const).filter((l) => visibleLayers.value[l]),
)

/** A press on a track or corner: dragging it past the threshold moves it. */
let pendingDrag: { handle: DragHandle; client: Point; local: Point; started: boolean } | null = null
/** What a drag from the cursor would move (select tool), for the cursor style. */
const dragHover = ref<DragHandle['kind'] | null>(null)

function dragHandleUnder(local: Point | null): DragHandle | null {
  if (!local || tracks.tool !== 'select' || tracks.isRouting) return null
  return tracks.dragHandleAt(local, PICK_TOLERANCE_PX / pxPerMm.value, visibleLayerList.value)
}

function onCanvasPointerDown(event: PointerEvent) {
  if (!editMode.value) return
  containerRef.value?.focus({ preventScroll: true })
  clickIsPan = panZoom.onPointerDown(event)
  clickIsBox = false
  pendingDrag = null
  if (clickIsPan || event.button !== 0 || tracks.tool !== 'select') return
  const board = panZoom.screenToSvg(event.clientX, event.clientY)
  if (!board) return
  const client = { x: event.clientX, y: event.clientY }
  const local = boardToSwitchLocal(board, settings.value.switchRotation)
  const handle = dragHandleUnder(local)
  if (handle) pendingDrag = { handle, client, local, started: false }
  else boxStart = { client, board }
  // keep receiving the drag when it leaves the canvas
  ;(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId)
}

function onCanvasPointerMove(event: PointerEvent) {
  if (!editMode.value) return
  if (panZoom.onPointerMove(event)) return
  const p = panZoom.screenToSvg(event.clientX, event.clientY)
  cursorLocal.value = p ? boardToSwitchLocal(p, settings.value.switchRotation) : null
  tracks.setCursor(cursorLocal.value)
  if (pendingDrag) {
    const moved = Math.hypot(
      event.clientX - pendingDrag.client.x,
      event.clientY - pendingDrag.client.y,
    )
    if (!pendingDrag.started && moved >= BOX_THRESHOLD_PX) {
      pendingDrag.started = true
      tracks.startDrag(pendingDrag.handle, pendingDrag.local)
    }
    if (tracks.isDragging && cursorLocal.value) tracks.moveDrag(cursorLocal.value)
    return
  }
  dragHover.value = boxStart ? null : (dragHandleUnder(cursorLocal.value)?.kind ?? null)
  if (boxStart && p) {
    const moved = Math.hypot(event.clientX - boxStart.client.x, event.clientY - boxStart.client.y)
    if (selectionBox.value || moved >= BOX_THRESHOLD_PX) {
      selectionBox.value = { from: boxStart.board, to: p }
    }
  }
}

function onCanvasPointerUp(event: PointerEvent) {
  panZoom.onPointerUp(event)
  if (pendingDrag) {
    // a drag (even one cancelled with Esc) isn't a click
    if (pendingDrag.started) clickIsBox = true
    pendingDrag = null
    tracks.endDrag()
    return
  }
  const box = selectionBox.value
  boxStart = null
  selectionBox.value = null
  if (!box) return
  clickIsBox = true
  const rotation = settings.value.switchRotation
  const visible = new Set<string>(visibleLayerList.value)
  tracks.selectItems(
    tracksInBox(
      tracks.presetItems,
      box,
      (q) => switchLocalToBoard(q, rotation),
      (item) => item.type !== 'track' || visible.has(item.layer),
    ),
    event.shiftKey,
  )
}

function onCanvasPointerLeave() {
  dragHover.value = null
  cursorLocal.value = null
  hoveredPadKey.value = null
  tracks.setCursor(null)
}

function onCanvasClick(event: MouseEvent) {
  if (!editMode.value || event.button !== 0) return
  if (clickIsPan || clickIsBox) {
    clickIsPan = clickIsBox = false
    return
  }
  const padNet = hoveredPad.value ? placedPadNet(hoveredPad.value) : null
  if (tracks.tool === 'route') {
    tracks.click(padNet)
    return
  }
  const item = cursorLocal.value
    ? tracks.trackAt(cursorLocal.value, PICK_TOLERANCE_PX / pxPerMm.value, visibleLayerList.value)
    : null
  tracks.selectClick(item, padNet, event.shiftKey)
}

function onCanvasDoubleClick() {
  if (editMode.value && tracks.isRouting) tracks.finish()
}

/** Typing in a toolbar field must not trigger shortcuts. */
function isTextField(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && !!target.closest('input, select, textarea')
}

/** Editor shortcuts, scoped to the editor (canvas and its toolbars). */
function onEditorKeyDown(event: KeyboardEvent) {
  if (!editMode.value || isTextField(event.target)) return
  // Space pans on the canvas, but still presses a focused toolbar button
  if (event.code === 'Space' && event.target !== containerRef.value) return
  panZoom.onKeyDown(event)
  if (event.altKey) return
  const mod = event.ctrlKey || event.metaKey
  const key = event.key.toLowerCase()
  const handled = (() => {
    if (mod) {
      if (key === 'z' && !event.shiftKey) tracks.undo()
      else if ((key === 'z' && event.shiftKey) || key === 'y') tracks.redo()
      else return false
      return true
    }
    switch (event.key) {
      case 'x':
      case 'X':
        if (!tracks.isRouting) tracks.startRoute()
        return true
      case 'Escape':
        tracks.escape()
        return true
      case 'Backspace':
      case 'Delete':
        if (tracks.isRouting) {
          if (event.key === 'Backspace') tracks.undoVertex()
        } else {
          tracks.deleteSelection()
        }
        return true
      case 'End':
        tracks.finish()
        return true
      case '/':
        tracks.flipPosture()
        return true
      case 'u':
      case 'U':
        tracks.selectConnected()
        return true
      case 'w':
      case 'W':
        tracks.cycleWidth(event.shiftKey ? -1 : 1)
        return true
      default:
        return false
    }
  })()
  if (handled) event.preventDefault()
}

function onEditorKeyUp(event: KeyboardEvent) {
  if (editMode.value) panZoom.onKeyUp(event)
}

function onCanvasWheel(event: WheelEvent) {
  if (editMode.value) panZoom.onWheel(event)
}

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
      settings.value.switchSide,
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
  <div class="footprint-preview" @keydown="onEditorKeyDown" @keyup="onEditorKeyUp">
    <!-- Track editor tools (route, layer, width, grid, posture) -->
    <TrackEditorToolbar v-if="editMode" />

    <!-- SVG Container (always present to maintain height) -->
    <div
      ref="containerRef"
      class="svg-container"
      :class="{
        'svg-hidden': error,
        editing: editMode,
        panning: panZoom.isPanning.value,
        'pan-ready': panZoom.spaceHeld.value,
        'tool-route': editMode && tracks.tool === 'route',
        'drag-hover': editMode && (dragHover !== null || tracks.isDragging),
        'blocked-flash': blockedFlash || tracks.dragViolation !== null,
      }"
      :tabindex="editMode ? 0 : undefined"
      data-testid="pcb-preview-canvas"
      @blur="panZoom.onBlur()"
    >
      <svg
        ref="svgRef"
        :viewBox="svgViewBox"
        class="preview-svg"
        xmlns="http://www.w3.org/2000/svg"
        @wheel="onCanvasWheel"
        @pointerdown="onCanvasPointerDown"
        @pointermove="onCanvasPointerMove"
        @pointerup="onCanvasPointerUp"
        @pointercancel="onCanvasPointerUp"
        @pointerleave="onCanvasPointerLeave"
        @mousedown.middle="editMode && $event.preventDefault()"
        @click="onCanvasClick"
        @dblclick="onCanvasDoubleClick"
      >
        <!-- Grid (switch-local frame, track editor only) -->
        <g v-if="editMode" :transform="switchLocalTransform">
          <GridLayer :grid="editorSettings.grid" :px-per-mm="pxPerMm" :extent="gridExtent" />
        </g>

        <!-- Switch footprint (centered at origin) -->
        <g ref="switchGroupRef" class="footprint-svg" :transform="switchTransform">
          <g v-html="switchSvgContent"></g>
        </g>

        <!-- Diode footprint (offset from switch center) -->
        <g ref="diodeGroupRef" class="footprint-svg" :transform="diodeTransform">
          <g v-html="diodeSvgContent"></g>
        </g>

        <!-- LED footprint (offset from switch center) -->
        <g
          v-if="showLed && ledSvgContent"
          ref="ledGroupRef"
          class="footprint-svg"
          :transform="ledTransform"
        >
          <g v-html="ledSvgContent"></g>
        </g>

        <!-- LED decoupling capacitor footprint (offset from switch center) -->
        <g
          v-if="showCapacitor && capacitorSvgContent"
          ref="capacitorGroupRef"
          class="footprint-svg"
          :transform="capacitorTransform"
        >
          <g v-html="capacitorSvgContent"></g>
        </g>

        <!-- Pads from the pad geometry JSON (switch-local frame, track editor only) -->
        <g v-if="editMode" :transform="switchLocalTransform">
          <PadLayer
            :pads="previewPads"
            :visible-layers="visibleLayers"
            :hovered-key="hoveredPadKey"
            :active-layer="editorSettings.layer"
            :highlight-net="tracks.highlightNet"
            @hover="hoveredPadKey = $event"
          />
        </g>

        <!-- Track preset overlay (switch-local frame) -->
        <g v-if="trackPresetItems.length" :transform="switchLocalTransform">
          <TrackLayer
            :items="trackPresetItems"
            :item-nets="drc?.itemNets"
            :highlight-net="editMode ? tracks.highlightNet : null"
            :selected="editMode ? tracks.selection : []"
            :px-per-mm="pxPerMm"
          />
        </g>

        <!-- DRC markers and ratsnest (switch-local frame) -->
        <g v-if="drc" :transform="switchLocalTransform">
          <DrcLayer :violations="drc.violations" :ratsnest="drc.ratsnest" :px-per-mm="pxPerMm" />
        </g>

        <!-- Route being drawn (switch-local frame) -->
        <g v-if="editMode" :transform="switchLocalTransform">
          <TrackEditorLayer
            :committed="tracks.routeSegments"
            :preview="tracks.previewSegments"
            :blocked="tracks.previewViolations.length > 0"
            :target="tracks.tool === 'route' ? tracks.target : null"
            :px-per-mm="pxPerMm"
          />
        </g>

        <!-- Box selection (board axes): solid selects enclosed, dashed touched tracks -->
        <rect
          v-if="selectionBox"
          :x="Math.min(selectionBox.from.x, selectionBox.to.x)"
          :y="Math.min(selectionBox.from.y, selectionBox.to.y)"
          :width="Math.abs(selectionBox.to.x - selectionBox.from.x)"
          :height="Math.abs(selectionBox.to.y - selectionBox.from.y)"
          :stroke-width="1 / pxPerMm"
          :stroke-dasharray="isCrossing(selectionBox) ? `${4 / pxPerMm} ${3 / pxPerMm}` : undefined"
          class="selection-box"
          data-testid="pcb-selection-box"
        />

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

      <!-- Track editor toolbar -->
      <div class="editor-toolbar" @pointerdown.stop>
        <button
          type="button"
          class="btn btn-sm"
          :class="editMode ? 'btn-primary' : 'btn-outline-secondary'"
          :disabled="!canEdit"
          :title="canEdit ? 'Edit switch-diode tracks' : 'Track presets need a front-side switch'"
          :aria-pressed="editMode"
          data-testid="pcb-track-edit-toggle"
          @click="toggleEditMode"
        >
          <BiPencilSquare /> Edit tracks
        </button>
        <template v-if="editMode">
          <div class="btn-group btn-group-sm" role="group" aria-label="Copper layer visibility">
            <button
              v-for="layer in ['F.Cu', 'B.Cu'] as const"
              :key="layer"
              type="button"
              class="btn layer-btn"
              :class="[
                visibleLayers[layer] ? 'btn-secondary' : 'btn-outline-secondary',
                layer === 'F.Cu' ? 'layer-front' : 'layer-back',
              ]"
              :aria-pressed="visibleLayers[layer]"
              :title="`${visibleLayers[layer] ? 'Hide' : 'Show'} ${layer} pads`"
              :data-testid="`pcb-layer-toggle-${layer}`"
              @click="visibleLayers[layer] = !visibleLayers[layer]"
            >
              <BiEye v-if="visibleLayers[layer]" /><BiEyeSlash v-else />
              <span class="layer-swatch"></span>{{ layer }}
            </button>
          </div>
          <div class="btn-group btn-group-sm" role="group" aria-label="Zoom">
            <button
              type="button"
              class="btn btn-outline-secondary"
              title="Zoom in"
              data-testid="pcb-zoom-in"
              @click="panZoom.zoomBy(1.5)"
            >
              <BiZoomIn />
            </button>
            <button
              type="button"
              class="btn btn-outline-secondary"
              title="Zoom out"
              data-testid="pcb-zoom-out"
              @click="panZoom.zoomBy(1 / 1.5)"
            >
              <BiZoomOut />
            </button>
            <button
              type="button"
              class="btn btn-outline-secondary"
              title="Fit"
              data-testid="pcb-zoom-fit"
              @click="panZoom.fit(fittedViewBox)"
            >
              <BiFullscreen />
            </button>
          </div>
        </template>
      </div>

      <!-- Notices over the bottom of the canvas, so they never move the preview -->
      <div class="canvas-notices">
        <!-- DRC summary of a pasted preset outside the editor -->
        <div
          v-if="drcSummary && !editMode"
          class="drc-badge"
          :class="drcSummary.ok ? 'drc-badge-ok' : 'drc-badge-problem'"
          data-testid="pcb-drc-badge"
        >
          {{ drcSummary.text }}
        </div>
        <!-- The preset was drawn for other footprints or diode placement -->
        <StalePresetBanner />
      </div>

      <!-- Coordinate display overlay -->
      <div v-if="hoveredElement && !editMode" class="coordinate-display">
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

    <!-- Width, layer and delete for the selected tracks -->
    <TrackSelectionBar v-if="editMode" />

    <!-- Track editor status bar -->
    <div v-if="editMode" class="editor-status" data-testid="pcb-editor-status">
      <span v-if="hoveredPad" data-testid="pcb-hovered-pad">{{ padLabel(hoveredPad) }}</span>
      <span v-if="cursorLocal" data-testid="pcb-cursor-readout">
        X {{ formatCoordinate(cursorLocal.x) }} Y {{ formatCoordinate(cursorLocal.y) }} mm
      </span>
      <span v-if="routeStatus" data-testid="pcb-route-status">{{ routeStatus }}</span>
      <span v-if="blockedReason" class="text-danger" data-testid="pcb-route-blocked">{{
        blockedReason
      }}</span>
      <span
        v-if="drcSummary"
        :class="drcSummary.ok ? 'text-success' : 'text-danger'"
        data-testid="pcb-drc-summary"
        >{{ drcSummary.text }}</span
      >
      <span v-if="padsError" class="text-warning">{{ padsError }}</span>
      <span
        v-if="tracks.dragViolation"
        class="editor-hint text-danger"
        data-testid="pcb-drag-blocked"
        >Can't drop here · {{ tracks.dragViolation.message }}</span
      >
      <span v-else-if="tracks.isDragging" class="editor-hint">release: drop · Esc: cancel</span>
      <span v-else class="editor-hint">{{
        tracks.isRouting
          ? 'click: add corner · / flip · Backspace: undo · double-click/End: finish · Esc: cancel'
          : tracks.tool === 'route'
            ? 'click or X: start a track · wheel: zoom · middle/Space+drag: pan'
            : 'click: select · drag track: move · drag empty: box · Del: delete · U: connected · X: route'
      }}</span>
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
  flex-direction: column;
  align-items: stretch;
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

/* Track editor */
.svg-container.editing {
  outline: none;
  cursor: crosshair;
  touch-action: none;
}

.svg-container.editing:focus-visible {
  box-shadow: 0 0 0 0.2rem rgba(var(--bs-primary-rgb), 0.25);
}

.svg-container.blocked-flash {
  box-shadow: 0 0 0 0.2rem rgba(255, 45, 85, 0.6);
}

.svg-container.editing.drag-hover:not(.pan-ready):not(.panning) {
  cursor: move;
}

.svg-container.pan-ready {
  cursor: grab;
}

.svg-container.panning {
  cursor: grabbing;
}

/* the pad layer replaces the SVG copper and holes while editing */
.svg-container.editing :deep(.footprint-svg .hoverable) {
  display: none;
}

.editor-toolbar {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  z-index: 20;
}

.editor-toolbar .btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

/* outline buttons are transparent; keep them readable over the grid */
.editor-toolbar .btn-outline-secondary:not(:hover):not(:active):not(:disabled) {
  background-color: var(--bs-body-bg);
}

.layer-swatch {
  display: inline-block;
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 2px;
}

.layer-front .layer-swatch {
  background-color: #c83434;
}

.layer-back .layer-swatch {
  background-color: #4d7fc4;
}

.layer-btn[aria-pressed='false'] .layer-swatch {
  opacity: 0.3;
}

/* one line: a wrapping status bar would move the canvas under the cursor */
.editor-status {
  display: flex;
  flex-wrap: nowrap;
  white-space: nowrap;
  gap: 0.125rem 1rem;
  padding: 0.25rem 0.125rem 0;
  min-height: 1.75rem;
  font-family: var(--bs-font-monospace);
  font-size: 0.75rem;
  color: var(--bs-secondary-color);
}

.selection-box {
  fill: rgba(var(--bs-primary-rgb), 0.08);
  stroke: var(--bs-primary);
  pointer-events: none;
}

.canvas-notices {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 8px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  pointer-events: none;
  z-index: 20;
}

.drc-badge {
  padding: 0.15rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  border: 1px solid currentColor;
  background-color: var(--bs-body-bg);
}

.drc-badge-ok {
  color: var(--bs-success-text-emphasis);
}

.drc-badge-problem {
  color: var(--bs-danger-text-emphasis);
}

.editor-hint {
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: right;
  font-family: var(--bs-body-font-family);
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
