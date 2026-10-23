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
import { ref, computed, watch, onMounted, nextTick, onUnmounted } from 'vue'
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'
import { storeToRefs } from 'pinia'
import type { ViewBox, FootprintGroup } from '@/types/footprint'
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
import { placeCourtyard, type Courtyard } from '@/utils/kicad/courtyard'
import {
  findCourtyardCollisions,
  holesOf,
  NEIGHBOUR_OFFSETS,
  type CourtyardPart,
} from '@/utils/pcb/courtyard-collisions'
import TrackLayer from './pcb/TrackLayer.vue'
import PadLayer from './pcb/PadLayer.vue'
import type { PlacedPad } from '@/utils/pcb-tracks/netlist'
import GridLayer from './pcb/GridLayer.vue'
import DrcLayer from './pcb/DrcLayer.vue'
import TrackEditorLayer from './pcb/TrackEditorLayer.vue'
import TrackEditorToolbar from './pcb/TrackEditorToolbar.vue'
import { GRID_OPTIONS, usePcbTracksStore } from '@/stores/pcbTracks'
import { placedPadNet } from '@/utils/pcb-tracks/netlist'
import type { DragHandle } from '@/utils/pcb-tracks/drag'
import { isCrossing, padAt, tracksInBox, type Box } from '@/utils/pcb-tracks/selection'
import { padInfos } from '@/utils/pcb-tracks/connectivity'
import TrackSelectionBar from './pcb/TrackSelectionBar.vue'
import CourtyardLayer from './pcb/CourtyardLayer.vue'
import CourtyardWarning from './pcb/CourtyardWarning.vue'
import NeighbourKeyLayer from './pcb/NeighbourKeyLayer.vue'
import StalePresetBanner from './pcb/StalePresetBanner.vue'
import type { Point } from '@/composables/usePanZoom'
import BiInfoCircle from 'bootstrap-icons/icons/info-circle.svg'
import BiExclamationTriangle from 'bootstrap-icons/icons/exclamation-triangle.svg'
import BiZoomIn from 'bootstrap-icons/icons/zoom-in.svg'
import BiZoomOut from 'bootstrap-icons/icons/zoom-out.svg'
import BiFullscreen from 'bootstrap-icons/icons/fullscreen.svg'
import BiEye from 'bootstrap-icons/icons/eye.svg'
import BiEyeSlash from 'bootstrap-icons/icons/eye-slash.svg'
import BiGrid3x3 from 'bootstrap-icons/icons/grid-3x3.svg'

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
const switchLocalTransform = computed(() => switchLocalSvgTransform(settings.value.switchRotation))

const diodeTransform = computed(() => groupTransform('diode'))
const ledTransform = computed(() => groupTransform('led'))
const capacitorTransform = computed(() => groupTransform('capacitor'))

// Diode is always present; LED and capacitor only when the feature is enabled.
const placedOffsets = computed(() => {
  const groups: FootprintGroup[] = ['diode']
  if (showLed.value) groups.push('led')
  if (showCapacitor.value) groups.push('capacitor')
  return groups.map(offsetForGroup).filter((offset): offset is OffsetFootprint => offset !== null)
})

// Computed base viewBox without zoom (memoized separately for performance)
const baseViewBox = computed(() => {
  if (!switchViewBox.value || !diodeViewBox.value) {
    return null
  }
  return calculateCompositeViewBoxMulti(
    switchViewBox.value,
    placedOffsets.value,
    settings.value.switchRotation,
    CONTAINER_PADDING,
    settings.value.switchSide,
  )
})

// The placed parts' courtyards (board axes), once every part has one. They
// frame the view: the SVG pages keep the footprint origin at their centre, so
// a page can be much larger than the drawing, e.g. a THT diode's origin is
// pad 1 and its page has an empty half.
const partsBounds = computed(() => {
  const parts = courtyardParts.value
  const framed = (part: CourtyardPart) => part.courtyard.front.length || part.courtyard.back.length
  if (!parts.length || !parts.every(framed)) return null
  const points = parts
    .flatMap((part) => [...part.courtyard.front, ...part.courtyard.back].flat())
    .map((p) => switchLocalToBoard(p, settings.value.switchRotation))
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const x0 = Math.min(...xs) - CONTAINER_PADDING
  const y0 = Math.min(...ys) - CONTAINER_PADDING
  return {
    x: x0,
    y: y0,
    width: Math.max(...xs) + CONTAINER_PADDING - x0,
    height: Math.max(...ys) + CONTAINER_PADDING - y0,
  }
})

// The view framing the placed parts: their courtyards, or until those load,
// the SVG pages zoomed in by ZOOM_FACTOR
const fittedViewBox = computed<ViewBox>(() => {
  if (!baseViewBox.value) {
    return { x: 0, y: 0, width: 100, height: 100 } // Default fallback
  }
  if (partsBounds.value) return partsBounds.value

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
  return {
    x: centerX - zoomedWidth / 2,
    y: centerY - zoomedHeight / 2,
    width: zoomedWidth,
    height: zoomedHeight,
  }
})

// Pan/zoom and the grid work in every routing mode, like KiCad's canvas. The
// track editor (pads from the pad geometry JSON, drawing) shows in a preset
// routing mode (the settings hold a preset, see utils/pcb/routing-mode.ts). It
// works in the switch-local frame, which presets are defined for, so it needs
// a front-side switch.
const svgRef = ref<SVGSVGElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const canEdit = computed(() => settings.value.switchSide === 'FRONT')
const editMode = computed(() => settings.value.trackPreset !== undefined && canEdit.value)
const panZoom = usePanZoom(svgRef, fittedViewBox.value)

const visibleLayers = ref<Record<CopperLayer, boolean>>({ 'F.Cu': true, 'B.Cu': true })
const cursorLocal = ref<{ x: number; y: number } | null>(null)
const hoveredPadKey = ref<string | null>(null)

// entering or leaving the editor: nothing in progress survives, the view stays
watch(
  editMode,
  (editing) => {
    tracks.reset()
    if (editing) nextTick(() => containerRef.value?.focus({ preventScroll: true }))
  },
  { immediate: true },
)
// the first footprints loaded: show them
watch(baseViewBox, (vb, before) => {
  if (vb && !before) panZoom.fit(fittedViewBox.value)
})

// Size of the SVG on screen, for the grid density
const svgSize = ref({ width: 0, height: 0 })
let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !svgRef.value) return
  resizeObserver = new ResizeObserver(([entry]) => {
    if (!entry) return
    svgSize.value = { width: entry.contentRect.width, height: entry.contentRect.height }
    // the canvas follows the panel's height; what is drawn stays in place
    panZoom.setSize(svgSize.value)
  })
  resizeObserver.observe(svgRef.value)
})
onUnmounted(() => resizeObserver?.disconnect())

const pxPerMm = computed(() => {
  const vb = panZoom.viewBox.value
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
/** Courtyards by footprint name; a footprint without one has none here. */
const libraryCourtyards = ref<Record<string, Courtyard>>({})
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
      libraryCourtyards.value = Object.fromEntries(
        names.flatMap((name, i) => {
          const courtyard = loaded[i]!.courtyard
          return courtyard ? [[name, courtyard]] : []
        }),
      )
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

// DRC of the preset, while editing. Pads of every placed footprint must be
// loaded, or obstacles would be missing.
const padsReady = computed(() => padSources.value.every((src) => libraryPads.value[src.name]))

// Placed parts with their courtyards and holes (switch-local), once loaded
const courtyardParts = computed<CourtyardPart[]>(() => {
  if (!padsReady.value) return []
  return padSources.value.map(({ owner, name, placement }) => {
    const courtyard = libraryCourtyards.value[name]
    return {
      owner,
      courtyard: courtyard ? placeCourtyard(courtyard, placement) : { front: [], back: [] },
      holes: holesOf(previewPads.value.filter((p) => p.owner === owner).map((p) => p.pad)),
    }
  })
})

// the courtyards frame the parts once loaded (see partsBounds): refit when
// they load, i.e. on start and when a footprint or the LED chain changes
// (a new position keeps the view, like KiCad)
watch(padsReady, (ready) => {
  if (ready && baseViewBox.value) panZoom.fit(fittedViewBox.value)
})

// Parts whose courtyards overlap, in every routing mode: placement is set
// before routing. Neighbouring keys sit on the 1u grid in board axes.
const courtyardCollisions = computed(() => {
  const rotation = settings.value.switchRotation
  return findCourtyardCollisions(
    courtyardParts.value,
    NEIGHBOUR_OFFSETS.map((o) => boardToSwitchLocal(o, rotation)),
  )
})
/** The neighbouring keys a part collides with, switch-local, drawn faded. */
const collidingNeighbours = computed(() => {
  const offsets = new Map<string, Point>()
  for (const { offset } of courtyardCollisions.value) {
    if (offset) offsets.set(`${offset.x},${offset.y}`, offset)
  }
  return [...offsets.values()]
})
/**
 * The SVGs and pads of the current footprints are loaded and the view fitted
 * to them (the padsReady watcher runs before the render), so what is drawn
 * stays put until the settings change.
 */
const viewReady = computed(() => padsReady.value && !isLoading.value && !!baseViewBox.value)
const showDrc = computed(() => editMode.value && padsReady.value)
// the store runs DRC on the preset, plus the route and its preview while routing
const drc = computed(() => (showDrc.value ? tracks.drc : null))
// The ratsnest shows in every routing mode, so the user sees which switch pad
// the diode connects to while placing it. Without a preset (or for a back-side
// switch, which presets don't apply to) it joins the bare pads.
const ratsnestLines = computed(() => (padsReady.value ? tracks.drc.ratsnest : []))

watch(previewPads, (pads) => tracks.setPads(pads), { immediate: true })
// anchors attract the cursor within a few screen pixels
watch(pxPerMm, (scale) => (tracks.snapRadius = SNAP_RADIUS_PX / scale), { immediate: true })

const routeStatus = computed(() => {
  const r = tracks.route
  if (!r) return null
  return `Routing ${r.net ?? 'new net'} on ${r.layer}, ${editorSettings.value.width} mm`
})
const blockedReason = computed(
  () =>
    tracks.previewViolations[0]?.message ??
    tracks.viaRefusal ??
    tracks.freeViaViolation?.message ??
    null,
)

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

/** The help line under the canvas: what the mouse and keys do now. */
const statusHint = computed(() => {
  if (!editMode.value) {
    const hint = 'wheel: zoom · middle/Space+drag: pan'
    return ratsnestLines.value.length
      ? `${hint} · dashed line: unrouted switch-diode connection`
      : hint
  }
  if (tracks.isDragging) return 'release: drop · Esc: cancel'
  if (tracks.isRouting)
    return 'click: add corner · V: via · / flip · Backspace: undo · double-click/End: finish · Esc: cancel'
  if (tracks.tool === 'route')
    return 'click or X: start a track · wheel: zoom · middle/Space+drag: pan'
  if (tracks.tool === 'via') return 'click: place a via · X: route from it · Esc: back to Select'
  return 'click: select · click unrouted pad: route · double-click/U: connected · drag track or via: move · drag empty: box · Ctrl+A: all · Del: delete · X: route'
})

/** What the preview shows outside the track editor, in the row the toolbar takes there. */
const viewInfo = computed(() => {
  if (settings.value.trackPreset !== undefined) return 'Preset tracks need a front-side switch.'
  if (settings.value.routing === 'Disabled')
    return 'Routing is disabled: the generator leaves every connection unrouted.'
  return 'Switch-diode tracks are routed automatically. Choose a (preset) routing option to draw them.'
})

// The pad under the cursor, from the pad geometry in both modes: the preview
// and the editor show the same crosshair at its centre and the same readout.
const previewPadInfos = computed(() => padInfos(previewPads.value))
const hoveredPad = computed(() =>
  hoveredPadKey.value ? previewPads.value.find((p) => p.key === hoveredPadKey.value) : undefined,
)
/** The crosshair shows outside the editor and with the select tool (routing has its snap marker). */
const showCrosshair = computed(
  () => !editMode.value || (tracks.tool === 'select' && !tracks.isRouting && !tracks.isDragging),
)

function updateHoveredPad(local: Point | null) {
  hoveredPadKey.value = local
    ? (padAt(previewPadInfos.value, local, visibleLayerList.value)?.placed.key ?? null)
    : null
}

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

/** Items drawn on the visible layers (vias span both). */
function isVisibleItem(item: TrackItem | undefined): boolean {
  if (!item) return false
  return item.type === 'via' ? visibleLayerList.value.length > 0 : visibleLayers.value[item.layer]
}

// hidden tracks can't stay selected (they would still be deleted or changed)
watch(visibleLayerList, () => {
  const kept = tracks.selection.filter((i) => isVisibleItem(tracks.presetItems[i]))
  if (kept.length !== tracks.selection.length) tracks.selectItems(kept, false)
})

// a route is drawn on a layer that shows
watch(
  () => tracks.route?.layer,
  (layer) => {
    if (layer) visibleLayers.value[layer] = true
  },
)

/** The track or via a click would select (select tool), highlighted under the cursor. */
const hoveredTrack = computed(() => {
  if (!cursorLocal.value || tracks.tool !== 'select' || tracks.isRouting || tracks.isDragging)
    return null
  if (selectionBox.value) return null
  return tracks.itemAt(cursorLocal.value, PICK_TOLERANCE_PX / pxPerMm.value, visibleLayerList.value)
})

/** A press on a track or corner: dragging it past the threshold moves it. */
let pendingDrag: { handle: DragHandle; client: Point; local: Point; started: boolean } | null = null
/** What a drag from the cursor would move (select tool), for the cursor style. */
const dragHover = ref<DragHandle['kind'] | null>(null)

function dragHandleUnder(local: Point | null): DragHandle | null {
  if (!local || tracks.tool !== 'select' || tracks.isRouting) return null
  return tracks.dragHandleAt(local, PICK_TOLERANCE_PX / pxPerMm.value, visibleLayerList.value)
}

function onCanvasPointerDown(event: PointerEvent) {
  containerRef.value?.focus({ preventScroll: true })
  clickIsBox = false
  pendingDrag = null
  clickIsPan = panZoom.onPointerDown(event)
  if (!editMode.value) return
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
  if (panZoom.onPointerMove(event)) return
  const p = panZoom.screenToSvg(event.clientX, event.clientY)
  cursorLocal.value = p ? boardToSwitchLocal(p, settings.value.switchRotation) : null
  updateHoveredPad(cursorLocal.value)
  if (editMode.value) tracks.setCursor(cursorLocal.value)
  if (!editMode.value) return
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
  tracks.selectItems(
    tracksInBox(tracks.presetItems, box, (q) => switchLocalToBoard(q, rotation), isVisibleItem),
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
  if (tracks.tool === 'via') {
    tracks.placeFreeVia()
    return
  }
  const item = cursorLocal.value
    ? tracks.itemAt(cursorLocal.value, PICK_TOLERANCE_PX / pxPerMm.value, visibleLayerList.value)
    : null
  // a pad still waiting for its track: start routing from it, as X would
  const pad = hoveredPad.value
  if (item === null && !event.shiftKey && pad && tracks.isUnconnectedPad(pad.key)) {
    // route on a layer the pad has (an SMD pad is on one only)
    const layers = previewPadInfos.value.find((p) => p.placed.key === pad.key)?.layers ?? []
    if (layers.length && !layers.includes(editorSettings.value.layer))
      editorSettings.value.layer = layers[0]!
    if (tracks.startRoute()) return
  }
  tracks.selectClick(item, padNet, event.shiftKey)
}

/** Double-click finishes a route, or selects every track connected to the one clicked. */
function onCanvasDoubleClick() {
  if (!editMode.value) return
  if (tracks.isRouting) {
    tracks.finish()
    return
  }
  if (tracks.tool !== 'select' || !cursorLocal.value) return
  const item = tracks.itemAt(
    cursorLocal.value,
    PICK_TOLERANCE_PX / pxPerMm.value,
    visibleLayerList.value,
  )
  if (item === null) return
  tracks.selectClick(item, null, false)
  tracks.selectConnected()
}

function selectAllVisible() {
  tracks.selectItems(
    tracks.presetItems.flatMap((item, i) => (isVisibleItem(item) ? [i] : [])),
    false,
  )
}

/** Typing in a toolbar field must not trigger shortcuts. */
function isTextField(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && !!target.closest('input, select, textarea')
}

/** Editor shortcuts, scoped to the editor (canvas and its toolbars). */
function onEditorKeyDown(event: KeyboardEvent) {
  if (isTextField(event.target)) return
  // Space pans on the canvas, but still presses a focused toolbar button
  if (event.code === 'Space' && event.target !== containerRef.value) return
  // a mouse drag ends with the button or Esc; other keys would act on the items under it
  if (tracks.isDragging && event.key !== 'Escape') return
  panZoom.onKeyDown(event)
  if (!editMode.value || event.altKey) return
  const mod = event.ctrlKey || event.metaKey
  const key = event.key.toLowerCase()
  const handled = (() => {
    if (mod) {
      if (key === 'z' && !event.shiftKey) tracks.undo()
      else if ((key === 'z' && event.shiftKey) || key === 'y') tracks.redo()
      else if (key === 'a' && !tracks.isRouting) selectAllVisible()
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
      case 'v':
      case 'V':
        if (tracks.isRouting) tracks.placeVia()
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
  panZoom.onKeyUp(event)
}

function onCanvasWheel(event: WheelEvent) {
  panZoom.onWheel(event)
}

// Watch for settings changes and reload footprints. Includes LED/capacitor
// URLs and visibility so toggling the feature (or its sides/footprints) reloads.
watch([switchSvgUrl, diodeSvgUrl, ledSvgUrl, capacitorSvgUrl, showLed, showCapacitor], () => {
  loadFootprints()
})

// Load footprints on component mount
onMounted(() => {
  loadFootprints()
})
</script>

<template>
  <div class="footprint-preview" @keydown="onEditorKeyDown" @keyup="onEditorKeyUp">
    <!-- Fixed-height rows above and below the canvas keep it in place in every state -->
    <div class="preview-top-row">
      <!-- Track editor drawing tools (route, history, layer, width, posture) -->
      <TrackEditorToolbar v-if="editMode" />
      <div v-else class="preview-info" data-testid="pcb-preview-info">
        <BiInfoCircle class="flex-shrink-0" />
        <span>{{ viewInfo }}</span>
      </div>
    </div>

    <!-- SVG Container (always present to maintain height) -->
    <div
      ref="containerRef"
      class="svg-container"
      :class="{
        'svg-hidden': error,
        editing: editMode,
        panning: panZoom.isPanning.value,
        'pan-ready': panZoom.spaceHeld.value,
        'drag-hover': editMode && (dragHover !== null || tracks.isDragging),
        'blocked-flash': blockedFlash || tracks.dragViolation !== null,
      }"
      tabindex="0"
      :data-ready="viewReady ? '' : undefined"
      data-testid="pcb-preview-canvas"
      @blur="panZoom.onBlur()"
    >
      <svg
        ref="svgRef"
        :viewBox="panZoom.viewBoxString.value"
        class="preview-svg"
        xmlns="http://www.w3.org/2000/svg"
        @wheel="onCanvasWheel"
        @pointerdown="onCanvasPointerDown"
        @pointermove="onCanvasPointerMove"
        @pointerup="onCanvasPointerUp"
        @pointercancel="onCanvasPointerUp"
        @pointerleave="onCanvasPointerLeave"
        @mousedown.middle.prevent
        @click="onCanvasClick"
        @dblclick="onCanvasDoubleClick"
      >
        <!-- Grid (switch-local frame) -->
        <g :transform="switchLocalTransform">
          <GridLayer :grid="editorSettings.grid" :px-per-mm="pxPerMm" :extent="gridExtent" />
        </g>

        <!-- Switch footprint (centered at origin) -->
        <g class="footprint-svg" :transform="switchTransform">
          <g v-html="switchSvgContent"></g>
        </g>

        <!-- Diode footprint (offset from switch center) -->
        <g class="footprint-svg" :transform="diodeTransform">
          <g v-html="diodeSvgContent"></g>
        </g>

        <!-- LED footprint (offset from switch center) -->
        <g v-if="showLed && ledSvgContent" class="footprint-svg" :transform="ledTransform">
          <g v-html="ledSvgContent"></g>
        </g>

        <!-- LED decoupling capacitor footprint (offset from switch center) -->
        <g
          v-if="showCapacitor && capacitorSvgContent"
          class="footprint-svg"
          :transform="capacitorTransform"
        >
          <g v-html="capacitorSvgContent"></g>
        </g>

        <!-- Pads from the pad geometry JSON (switch-local frame), in place of the SVGs' copper -->
        <g :transform="switchLocalTransform">
          <PadLayer
            :pads="previewPads"
            :visible-layers="visibleLayers"
            :hovered-key="hoveredPadKey"
            :active-layer="editorSettings.layer"
            :highlight-net="editMode ? tracks.highlightNet : null"
          />
        </g>

        <!-- Track preset overlay (switch-local frame) -->
        <g v-if="tracks.presetItems.length" :transform="switchLocalTransform">
          <TrackLayer
            :items="tracks.presetItems"
            :item-nets="drc?.itemNets"
            :highlight-net="editMode ? tracks.highlightNet : null"
            :selected="editMode ? tracks.selection : []"
            :hovered="editMode ? hoveredTrack : null"
            :visible-layers="visibleLayers"
            :px-per-mm="pxPerMm"
          />
        </g>

        <!-- DRC markers, ratsnest and overlapping courtyards (switch-local frame) -->
        <g v-if="padsReady" :transform="switchLocalTransform">
          <NeighbourKeyLayer
            :offsets="collidingNeighbours"
            :pads="previewPads"
            :parts="courtyardParts"
            :switch-rotation="settings.switchRotation"
            :visible-layers="visibleLayers"
            :px-per-mm="pxPerMm"
          />
          <CourtyardLayer :collisions="courtyardCollisions" :px-per-mm="pxPerMm" />
          <DrcLayer
            :violations="drc?.violations ?? []"
            :ratsnest="ratsnestLines"
            :px-per-mm="pxPerMm"
          />
        </g>

        <!-- Route being drawn (switch-local frame) -->
        <g v-if="editMode" :transform="switchLocalTransform">
          <TrackEditorLayer
            :committed="tracks.routeSegments"
            :vias="tracks.routeVias"
            :free-via="tracks.freeVia"
            :free-via-blocked="tracks.freeViaViolation !== null"
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

        <!-- Crosshair at the hovered pad's centre (switch-local frame) -->
        <g
          v-if="hoveredPad && showCrosshair"
          :transform="switchLocalTransform"
          class="crosshair-layer"
          data-testid="pcb-pad-crosshair"
        >
          <path
            :d="`M${hoveredPad.pad.at.x - 14 / pxPerMm} ${hoveredPad.pad.at.y}h${28 / pxPerMm}M${hoveredPad.pad.at.x} ${hoveredPad.pad.at.y - 14 / pxPerMm}v${28 / pxPerMm}`"
            :stroke-width="1.5 / pxPerMm"
            class="crosshair-line"
          />
          <circle
            :cx="hoveredPad.pad.at.x"
            :cy="hoveredPad.pad.at.y"
            :r="3.5 / pxPerMm"
            :stroke-width="1 / pxPerMm"
            class="crosshair-center"
          />
        </g>
      </svg>

      <!-- Over the canvas's top edge: the view controls on the left, the selected
           tracks' panel on the right, or under them when both don't fit -->
      <div class="canvas-top">
        <!-- View controls (what is shown and the snap grid, never what is drawn) -->
        <div class="view-controls" role="toolbar" aria-label="View" @pointerdown.stop>
          <span class="view-caption">View</span>
          <div class="btn-group btn-group-sm" role="group" aria-label="Copper layer visibility">
            <button
              v-for="layer in ['F.Cu', 'B.Cu'] as const"
              :key="layer"
              type="button"
              class="btn btn-toggle layer-btn"
              :class="layer === 'F.Cu' ? 'layer-front' : 'layer-back'"
              :aria-pressed="visibleLayers[layer]"
              :title="`${visibleLayers[layer] ? 'Hide' : 'Show'} ${layer} copper (view only)`"
              :data-testid="`pcb-layer-toggle-${layer}`"
              @click="visibleLayers[layer] = !visibleLayers[layer]"
            >
              <span class="layer-eye"
                ><BiEye v-if="visibleLayers[layer]" /><BiEyeSlash v-else
              /></span>
              <span class="layer-swatch"></span>{{ layer }}
            </button>
          </div>
          <label class="view-field" title="Grid: shown, and what the cursor snaps to, mm">
            <BiGrid3x3 aria-hidden="true" />
            <span class="view-field-label">Grid</span>
            <select
              v-model.number="editorSettings.grid"
              class="form-select form-select-sm"
              aria-label="Grid, mm"
              data-testid="pcb-grid-select"
            >
              <option v-for="g in GRID_OPTIONS" :key="g" :value="g">{{ g }}</option>
            </select>
          </label>
          <div class="btn-group btn-group-sm" role="group" aria-label="Zoom">
            <button
              type="button"
              class="btn btn-toggle"
              title="Zoom in (wheel)"
              data-testid="pcb-zoom-in"
              @click="panZoom.zoomBy(1.5)"
            >
              <BiZoomIn />
            </button>
            <button
              type="button"
              class="btn btn-toggle"
              title="Zoom out (wheel)"
              data-testid="pcb-zoom-out"
              @click="panZoom.zoomBy(1 / 1.5)"
            >
              <BiZoomOut />
            </button>
            <button
              type="button"
              class="btn btn-toggle"
              title="Zoom to fit"
              data-testid="pcb-zoom-fit"
              @click="panZoom.fit(fittedViewBox)"
            >
              <BiFullscreen />
            </button>
          </div>
        </div>

        <!-- Width, layer and delete for the selected tracks -->
        <TrackSelectionBar v-if="editMode" />
      </div>

      <!-- Notices over the bottom of the canvas, so they never move the preview -->
      <div class="canvas-notices">
        <!-- Readouts: hovered pad, cursor, route, DRC and why something was refused -->
        <div
          v-if="hoveredPad || editMode || cursorLocal || padsError"
          class="canvas-readout"
          data-testid="pcb-readout"
        >
          <div class="readout-row">
            <template v-if="hoveredPad">
              <span data-testid="pcb-hovered-pad">{{ padLabel(hoveredPad) }}</span>
              <span data-testid="pcb-hovered-center">
                center X {{ formatCoordinate(hoveredPad.pad.at.x) }} Y
                {{ formatCoordinate(hoveredPad.pad.at.y) }} mm
              </span>
            </template>
            <span v-else-if="cursorLocal" data-testid="pcb-cursor-readout">
              X {{ formatCoordinate(cursorLocal.x) }} Y {{ formatCoordinate(cursorLocal.y) }} mm
            </span>
            <span
              v-if="editMode && drcSummary"
              :class="drcSummary.ok ? 'text-success-emphasis' : 'text-danger-emphasis'"
              data-testid="pcb-drc-summary"
              >{{ drcSummary.text }}</span
            >
          </div>
          <template v-if="editMode">
            <div v-if="routeStatus" data-testid="pcb-route-status">{{ routeStatus }}</div>
            <div v-if="blockedReason" class="text-danger-emphasis" data-testid="pcb-route-blocked">
              {{ blockedReason }}
            </div>
            <div
              v-if="tracks.dragViolation"
              class="text-danger-emphasis"
              data-testid="pcb-drag-blocked"
            >
              Can't drop here · {{ tracks.dragViolation.message }}
            </div>
          </template>
          <div v-if="padsError" class="text-warning-emphasis">{{ padsError }}</div>
        </div>
        <!-- Parts placed on top of each other -->
        <CourtyardWarning :collisions="courtyardCollisions" />
        <!-- The preset was drawn for other footprints or diode placement -->
        <StalePresetBanner />
      </div>

      <!-- Fallback warning overlay -->
      <div v-if="isFallback" class="preview-warning">
        <small>
          <BiInfoCircle />
          Using Cherry MX preview (exact footprint SVG not yet available)
        </small>
      </div>
    </div>

    <!-- Help line under the canvas (the readouts are on the canvas) -->
    <div class="editor-status" :data-testid="editMode ? 'pcb-editor-status' : 'pcb-preview-status'">
      <span v-if="statusHint" class="editor-hint" :title="statusHint">{{ statusHint }}</span>
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
  /* top-aligned: centred, it would move whenever the settings column grows */
  justify-content: flex-start;
  /* the toolbar row's height follows the preview's width, never its state */
  container-type: inline-size;
  /* fill the results card; the canvas takes the height the rows leave */
  flex: 1 1 auto;
  min-height: 0;
}

.svg-container {
  width: 100%;
  /* the rest of the card, at least 300 px; 450 px where the card has no set height */
  flex: 1 1 450px;
  min-height: 300px;
  /* never taller than the screen with the toolbar and status rows */
  max-height: calc(100dvh - 9rem);
  border: 1px solid var(--bs-border-color);
  border-radius: 0.375rem;
  position: relative;
  overflow: hidden;
}

.svg-container:focus {
  outline: none;
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

.svg-container {
  cursor: crosshair;
  touch-action: none;
}

.svg-container.blocked-flash {
  box-shadow: 0 0 0 0.2rem color-mix(in srgb, var(--pcb-error) 60%, transparent);
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

/* the pad layer replaces the SVG copper and holes */
.svg-container :deep(.footprint-svg .hoverable) {
  display: none;
}

.layer-btn[aria-pressed='false'] .layer-swatch {
  opacity: 0.3;
}

/* the toolbar or an info line, always this high */
.preview-top-row {
  height: 2.5rem;
  padding: 0.25rem 0;
  flex-shrink: 0;
}

/* too narrow for the toolbar on one line: its two rows stacked, in every state
   (TrackEditorToolbar's breakpoint) */
@container (max-width: 760px) {
  .preview-top-row {
    height: 4.75rem;
  }
}

.preview-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 100%;
  font-size: 0.8125rem;
  color: var(--bs-secondary-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.view-caption {
  align-self: center;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  /* like the layout editor toolbar's section labels */
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--bs-body-color);
  background-color: var(--bs-body-bg);
}

/* the row over the canvas's top edge; only its panels take the pointer */
.canvas-top {
  position: absolute;
  top: 8px;
  left: 8px;
  right: 8px;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;
  z-index: 20;
  pointer-events: none;
}

.canvas-top > * {
  pointer-events: auto;
}

/* view controls in the top-left corner: light-weight and translucent, unlike
   the Draw toolbar; they wrap only in the narrowest preview */
.view-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  padding: 0.25rem;
  border-radius: 0.375rem;
  background-color: rgba(var(--bs-body-bg-rgb), 0.75);
  border: 1px dashed var(--bs-border-color);
}

.view-controls .btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.layer-eye {
  display: inline-flex;
}

.view-field {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  margin: 0;
  padding-left: 0.25rem;
  font-size: 0.875rem;
  color: var(--bs-body-color);
}

.view-field select {
  width: auto;
  /* as tall as the buttons */
  height: 31px;
  padding-top: 0;
  padding-bottom: 0;
  padding-right: 1.75rem;
}

/* a narrow canvas: the controls lose their words before they wrap */
@container (max-width: 560px) {
  .view-caption,
  .view-field-label {
    display: none;
  }
}

@container (max-width: 440px) {
  /* the pressed state and the swatch still say what is shown */
  .layer-eye {
    display: none;
  }
}

/* the help line: one line (a wrapping one would move the canvas under the cursor) */
.editor-status {
  display: flex;
  flex-wrap: nowrap;
  white-space: nowrap;
  gap: 0.125rem 1rem;
  padding: 0.25rem 0.125rem 0;
  height: 1.75rem;
  flex-shrink: 0;
  font-family: var(--bs-font-monospace);
  font-size: 0.75rem;
  color: var(--bs-body-color);
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

.editor-hint {
  color: var(--bs-secondary-color);
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--bs-body-font-family);
}

/* readouts over the canvas's bottom-left corner, one item per line, as wide as
   the longest; they never take a click */
.canvas-readout {
  display: flex;
  flex-direction: column;
  max-width: 100%;
  padding: 0.125rem 0.5rem;
  border: 1px solid var(--bs-border-color);
  border-radius: 0.25rem;
  background-color: rgba(var(--bs-body-bg-rgb), 0.85);
  color: var(--bs-body-color);
  font-family: var(--bs-font-monospace);
  font-size: 0.75rem;
  line-height: 1.5;
}

/* the hovered pad or cursor with the DRC summary */
.readout-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0 1rem;
}

.readout-row:empty {
  display: none;
}

.readout-row > span {
  white-space: nowrap;
}

/* footprint outlines (fab layer) in the theme's fab colour */
.svg-container :deep(g[style*='stroke:#585D84']),
.svg-container :deep(g[style*='stroke:#585d84']) {
  stroke: var(--pcb-fab-color) !important;
}

/* Crosshair styles */
.crosshair-layer {
  pointer-events: none;
}

.crosshair-line {
  fill: none;
  stroke: #ff0000;
  stroke-linecap: round;
  opacity: 0.8;
}

.crosshair-center {
  fill: #ff0000;
  fill-opacity: 0.6;
  stroke: #ffffff;
}
</style>
