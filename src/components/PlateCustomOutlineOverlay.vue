<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlateGeneratorStore } from '@/stores/plateGenerator'
import { storeToRefs } from 'pinia'
import { D } from '@/utils/decimal-math'
import type { OutlineSegment } from '@/types/plate'
import type { Key } from '@/stores/keyboard'
import { getKeyCenterMm } from '@/utils/keyboard-geometry'

interface Props {
  viewBoxStr: string  // e.g. "-6 -25 120 80"
  spacingX: number    // mm per U
  spacingY: number    // mm per U
  /**
   * X position of the maker.js origin (0,0) in the preview SVG coordinate space.
   * maker.js shifts all content so the bounding box starts at SVG (0,0), meaning
   * SVG(sx, sy) = maker.js(mx, my) where sx = mx + svgOriginX, sy = svgOriginY - my.
   * For custom outline points: maker.js (ux*sX, -uy*sY) → SVG (ux*sX + svgOriginX, uy*sY + svgOriginY).
   */
  svgOriginX: number
  svgOriginY: number
  keys: Key[]
}

const props = defineProps<Props>()

const plateStore = usePlateGeneratorStore()
const { settings, hoveredCornerId } = storeToRefs(plateStore)

const segments = computed(() => settings.value.outline.custom.segments)
const gridSize = computed(() => settings.value.outline.custom.gridSize)

const svgRef = ref<SVGSVGElement | null>(null)
const dragging = ref<{ id: string; moved: boolean } | null>(null)
const hoveredEdgeIndex = ref<number | null>(null)
const mousePosSvg = ref<{ x: number; y: number } | null>(null)

// Context menu state
const contextMenu = ref<{ cornerId: string; x: number; y: number } | null>(null)

// Tracks nearest key snap point for cursor color feedback
const nearestKeySnapSvg = ref<{ x: number; y: number } | null>(null)

// Hit radius in SVG units (mm)
const HIT_RADIUS = 4
const EDGE_HIT_RADIUS = 3

// Key snap constants
const KEY_SNAP_THRESHOLD = 4   // mm in SVG space
const KEY_SNAP_DEDUP_EPSILON = 0.05  // mm — deduplicate coincident points

const viewBox = computed(() => {
  const parts = props.viewBoxStr.split(/\s+/).map(Number)
  return {
    minX: parts[0] ?? 0,
    minY: parts[1] ?? 0,
    width: parts[2] ?? 100,
    height: parts[3] ?? 100,
  }
})

/**
 * Convert keyboard units to SVG coordinates.
 * maker.js puts segment (ux, uy) at maker.js point (ux*sX, -uy*sY).
 * maker.js SVG export maps that to SVG (ux*sX + originX, uy*sY + originY).
 */
function uToSvg(ux: number, uy: number) {
  return {
    x: ux * props.spacingX + props.svgOriginX,
    y: uy * props.spacingY + props.svgOriginY,
  }
}


function snap(val: number, step: number): number {
  if (step <= 0) return val
  return D.roundToStep(val, step)
}

function getSvgPoint(event: MouseEvent): { x: number; y: number } {
  const svg = svgRef.value!
  const pt = svg.createSVGPoint()
  pt.x = event.clientX
  pt.y = event.clientY
  const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse())
  return { x: svgPt.x, y: svgPt.y }
}

/**
 * Snap a raw SVG point to the nearest key vertex (priority) or grid.
 * Returns both clean U coordinates (for storage) and their SVG equivalents (for rendering).
 * Key snap takes priority within KEY_SNAP_THRESHOLD; grid snap is the fallback.
 */
function getSnappedCoords(svgPt: { x: number; y: number }) {
  // Key-geometry snap: find nearest key vertex within threshold
  let nearest: { x: number; y: number } | null = null
  let nearestDist = KEY_SNAP_THRESHOLD
  for (const pt of keySnapPoints.value) {
    const d = Math.hypot(svgPt.x - pt.x, svgPt.y - pt.y)
    if (d < nearestDist) { nearestDist = d; nearest = pt }
  }
  if (nearest) {
    return {
      u: {
        x: D.round((nearest.x - props.svgOriginX) / props.spacingX, 6),
        y: D.round((nearest.y - props.svgOriginY) / props.spacingY, 6),
      },
      svg: nearest,
      isKeySnap: true,
    }
  }
  // Grid snap fallback
  const ux = snap((svgPt.x - props.svgOriginX) / props.spacingX, gridSize.value)
  const uy = snap((svgPt.y - props.svgOriginY) / props.spacingY, gridSize.value)
  return {
    u: { x: ux, y: uy },
    svg: { x: ux * props.spacingX + props.svgOriginX, y: uy * props.spacingY + props.svgOriginY },
    isKeySnap: false,
  }
}

function findCornerAtSvg(svgPt: { x: number; y: number }): OutlineSegment | null {
  for (const seg of segments.value) {
    const { x, y } = uToSvg(seg.x, seg.y)
    const dist = Math.hypot(svgPt.x - x, svgPt.y - y)
    if (dist < HIT_RADIUS) return seg
  }
  return null
}

function findEdgeAt(svgPt: { x: number; y: number }): number | null {
  const mids = edgeMidpoints.value
  for (const mid of mids) {
    const dist = Math.hypot(svgPt.x - mid.x, svgPt.y - mid.y)
    if (dist < EDGE_HIT_RADIUS) return mid.afterIndex
  }
  return null
}

const edgeMidpoints = computed(() => {
  const segs = segments.value
  if (segs.length < 2) return []
  return segs.map((seg, i) => {
    const next = segs[(i + 1) % segs.length]!
    const a = uToSvg(seg.x, seg.y)
    const b = uToSvg(next.x, next.y)
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, afterIndex: i }
  })
})

const polygonPointsStr = computed(() => {
  return segments.value
    .map((seg) => {
      const { x, y } = uToSvg(seg.x, seg.y)
      return `${x},${y}`
    })
    .join(' ')
})

const closingLine = computed(() => {
  const segs = segments.value
  if (segs.length < 3) return null
  const first = uToSvg(segs[0]!.x, segs[0]!.y)
  const last = uToSvg(segs[segs.length - 1]!.x, segs[segs.length - 1]!.y)
  return { x1: last.x, y1: last.y, x2: first.x, y2: first.y }
})

const draggingId = computed(() => dragging.value?.id ?? null)

// Grid pattern phase: snap grid dots to keyboard-unit positions aligned to the maker.js origin.
// Pattern tile starts at (svgOriginX % period, svgOriginY % period) so dots land on
// (svgOriginX + n * period, svgOriginY + m * period) = positions aligned to U grid.
const gridPatternOffset = computed(() => {
  const gx = gridSize.value * props.spacingX
  const gy = gridSize.value * props.spacingY
  if (gx <= 0 || gy <= 0) return { x: 0, y: 0 }
  return {
    x: ((props.svgOriginX % gx) + gx) % gx,
    y: ((props.svgOriginY % gy) + gy) % gy,
  }
})

// --- Key geometry snap ---

/**
 * Replicates plate-builder's filterValidKeys to find the origin key.
 * The first valid key (top-left after sorting) is used as the maker.js origin.
 */
const firstValidKey = computed(() => {
  const valid = props.keys.filter(k => !k.decal && !k.ghost)
  valid.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x)
  return valid[0] ?? null
})

/**
 * The mm-space center of the origin key, matching plate-builder line 430.
 * All key positions are expressed relative to this point in SVG space.
 */
const originCenterMm = computed(() => {
  const ok = firstValidKey.value
  if (!ok) return { x: 0, y: 0 }
  return getKeyCenterMm(ok, props.spacingX, props.spacingY)
})

/** Convert mm-space position to SVG coordinates. */
function mmToSvg(mm_x: number, mm_y: number) {
  return {
    x: mm_x - originCenterMm.value.x + props.svgOriginX,
    y: mm_y - originCenterMm.value.y + props.svgOriginY,
  }
}

/**
 * Convert a KLE U-position (with optional rotation) to SVG coordinates.
 * Rotation is applied in mm-space to handle non-uniform spacing correctly.
 */
function kleUToSvg(u_x: number, u_y: number, r: number, rx: number, ry: number) {
  let mm_x = u_x * props.spacingX
  let mm_y = u_y * props.spacingY
  if (r !== 0) {
    const ox = rx * props.spacingX
    const oy = ry * props.spacingY
    const cos = Math.cos(r * Math.PI / 180)
    const sin = Math.sin(r * Math.PI / 180)
    const dx = mm_x - ox
    const dy = mm_y - oy
    mm_x = ox + cos * dx - sin * dy
    mm_y = oy + sin * dx + cos * dy
  }
  return mmToSvg(mm_x, mm_y)
}

/** All key vertex snap points (corners + edge midpoints), deduplicated. */
const keySnapPoints = computed(() => {
  const result: Array<{ x: number; y: number }> = []
  for (const key of props.keys) {
    if (key.decal || key.ghost) continue
    const kx = key.x
    const ky = key.y
    const kw = key.width || 1
    const kh = key.height || 1
    const r = key.rotation_angle || 0
    const rx = key.rotation_x ?? kx + kw / 2
    const ry = key.rotation_y ?? ky + kh / 2
    // 4 corners + 4 edge midpoints
    const candidates: [number, number][] = [
      [kx,        ky       ],
      [kx + kw,   ky       ],
      [kx + kw,   ky + kh  ],
      [kx,        ky + kh  ],
      [kx + kw/2, ky       ],
      [kx + kw,   ky + kh/2],
      [kx + kw/2, ky + kh  ],
      [kx,        ky + kh/2],
    ]
    for (const [ux, uy] of candidates) {
      const pt = kleUToSvg(ux, uy, r, rx, ry)
      if (!result.some(p => Math.hypot(p.x - pt.x, p.y - pt.y) < KEY_SNAP_DEDUP_EPSILON)) {
        result.push(pt)
      }
    }
  }
  return result
})

/** 4-corner polygon per key, for rendering faint key outlines on the overlay. */
const keyPolygons = computed(() => {
  return props.keys
    .filter(k => !k.decal && !k.ghost)
    .map(key => {
      const kx = key.x
      const ky = key.y
      const kw = key.width || 1
      const kh = key.height || 1
      const r = key.rotation_angle || 0
      const rx = key.rotation_x ?? kx + kw / 2
      const ry = key.rotation_y ?? ky + kh / 2
      const corners: [number, number][] = [
        [kx,      ky     ],
        [kx + kw, ky     ],
        [kx + kw, ky + kh],
        [kx,      ky + kh],
      ]
      return corners.map(([ux, uy]) => kleUToSvg(ux, uy, r, rx, ry))
    })
})

function generateCornerId(): string {
  return `seg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function removeCorner(id: string): void {
  const idx = segments.value.findIndex((s) => s.id === id)
  if (idx !== -1) segments.value.splice(idx, 1)
}

function insertCornerAfter(afterIndex: number, svgPt: { x: number; y: number }): void {
  const { u } = getSnappedCoords(svgPt)
  const newSeg: OutlineSegment = { id: generateCornerId(), x: u.x, y: u.y }
  segments.value.splice(afterIndex + 1, 0, newSeg)
}

// --- Context menu ---

function showContextMenu(event: MouseEvent, cornerId: string) {
  contextMenu.value = { cornerId, x: event.clientX, y: event.clientY }
}

function deleteFromContextMenu() {
  if (contextMenu.value) {
    removeCorner(contextMenu.value.cornerId)
    contextMenu.value = null
  }
}

function dismissContextMenu() {
  contextMenu.value = null
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') dismissContextMenu()
}

onMounted(() => {
  document.addEventListener('click', dismissContextMenu)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', dismissContextMenu)
  document.removeEventListener('keydown', handleKeydown)
  stopDragListeners()
})

// --- Global drag listeners (active only while a corner is being dragged) ---

function handleGlobalMouseMove(event: MouseEvent) {
  if (!dragging.value) return
  dragging.value.moved = true
  const svgPt = getSvgPoint(event)
  const { u } = getSnappedCoords(svgPt)
  const idx = segments.value.findIndex((s) => s.id === dragging.value!.id)
  if (idx !== -1) {
    segments.value[idx]!.x = u.x
    segments.value[idx]!.y = u.y
  }
}

function handleGlobalMouseUp() {
  if (!dragging.value) return
  dragging.value = null
  plateStore.isDraggingCorner = false
  stopDragListeners()
}

function startDragListeners() {
  document.addEventListener('mousemove', handleGlobalMouseMove)
  document.addEventListener('mouseup', handleGlobalMouseUp)
}

function stopDragListeners() {
  document.removeEventListener('mousemove', handleGlobalMouseMove)
  document.removeEventListener('mouseup', handleGlobalMouseUp)
}

// --- SVG mouse interaction ---

function handleMouseDown(event: MouseEvent) {
  const svgPt = getSvgPoint(event)
  const hit = findCornerAtSvg(svgPt)
  if (hit) {
    plateStore.isDraggingCorner = true
    dragging.value = { id: hit.id, moved: false }
    startDragListeners()
    event.preventDefault()
  }
}

function handleMouseMove(event: MouseEvent) {
  if (dragging.value) return  // position update handled by global listener
  const svgPt = getSvgPoint(event)
  const { svg, isKeySnap } = getSnappedCoords(svgPt)
  nearestKeySnapSvg.value = isKeySnap ? svg : null
  mousePosSvg.value = svg
  hoveredEdgeIndex.value = findEdgeAt(svgPt)
}

function handleClick(event: MouseEvent) {
  if (dragging.value !== null) return

  const svgPt = getSvgPoint(event)
  const hit = findCornerAtSvg(svgPt)
  if (hit) return

  const edgeIdx = findEdgeAt(svgPt)
  if (edgeIdx !== null) {
    insertCornerAfter(edgeIdx, svgPt)
    return
  }

  const { u } = getSnappedCoords(svgPt)
  segments.value.push({ id: generateCornerId(), x: u.x, y: u.y })
}

function handleMouseLeave() {
  mousePosSvg.value = null
  hoveredEdgeIndex.value = null
  nearestKeySnapSvg.value = null
  // drag continues via global listener — do not cancel
}

function handleCornerMouseEnter(id: string) {
  hoveredCornerId.value = id
}

function handleCornerMouseLeave() {
  hoveredCornerId.value = null
}
</script>

<template>
  <svg
    ref="svgRef"
    :viewBox="viewBoxStr"
    preserveAspectRatio="xMidYMid meet"
    class="outline-overlay-svg"
    @contextmenu.prevent
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @click="handleClick"
    @mouseleave="handleMouseLeave"
  >
    <!-- Grid pattern — dots aligned to keyboard-unit grid, anchored to maker.js origin -->
    <defs>
      <pattern
        v-if="gridSize > 0"
        id="outline-grid"
        :x="gridPatternOffset.x"
        :y="gridPatternOffset.y"
        :width="gridSize * spacingX"
        :height="gridSize * spacingY"
        patternUnits="userSpaceOnUse"
      >
        <circle cx="0" cy="0" r="0.4" fill="rgba(100,100,200,0.35)" />
      </pattern>
    </defs>
    <rect
      v-if="gridSize > 0"
      :x="viewBox.minX"
      :y="viewBox.minY"
      :width="viewBox.width"
      :height="viewBox.height"
      fill="url(#outline-grid)"
      pointer-events="none"
    />

    <!-- Faint key outlines (dashed polygons showing key boundaries) -->
    <polygon
      v-for="(pts, i) in keyPolygons"
      :key="`kp-${i}`"
      :points="pts.map(p => `${p.x},${p.y}`).join(' ')"
      fill="none"
      stroke="rgba(0,102,204,0.18)"
      stroke-width="0.35"
      stroke-dasharray="1.5 1"
      pointer-events="none"
    />

    <!-- Key snap point dots -->
    <circle
      v-for="(pt, i) in keySnapPoints"
      :key="`ksp-${i}`"
      :cx="pt.x"
      :cy="pt.y"
      r="0.45"
      fill="rgba(0,102,204,0.25)"
      pointer-events="none"
    />

    <!-- Polygon edges -->
    <polyline
      v-if="segments.length >= 2"
      :points="polygonPointsStr"
      fill="none"
      stroke="#0066cc"
      stroke-width="0.6"
      stroke-dasharray="2 1.5"
      pointer-events="none"
    />
    <!-- Closing edge -->
    <line
      v-if="closingLine"
      :x1="closingLine.x1"
      :y1="closingLine.y1"
      :x2="closingLine.x2"
      :y2="closingLine.y2"
      stroke="#0066cc"
      stroke-width="0.6"
      stroke-dasharray="2 1.5"
      pointer-events="none"
    />

    <!-- Edge insertion midpoints -->
    <circle
      v-for="mid in edgeMidpoints"
      :key="mid.afterIndex"
      :cx="mid.x"
      :cy="mid.y"
      r="1.5"
      fill="#0066cc"
      :opacity="hoveredEdgeIndex === mid.afterIndex ? 0.8 : 0.2"
      cursor="copy"
      pointer-events="all"
    />

    <!-- Ghost cursor dot (snapped position preview) — orange when key-snapping, blue for grid -->
    <circle
      v-if="mousePosSvg && !dragging"
      :cx="mousePosSvg.x"
      :cy="mousePosSvg.y"
      r="1.5"
      :fill="nearestKeySnapSvg ? 'rgba(220,100,0,0.7)' : 'rgba(0,102,204,0.4)'"
      pointer-events="none"
    />

    <!-- Corner handles -->
    <circle
      v-for="seg in segments"
      :key="seg.id"
      :cx="uToSvg(seg.x, seg.y).x"
      :cy="uToSvg(seg.x, seg.y).y"
      :r="hoveredCornerId === seg.id || draggingId === seg.id ? 3 : 2"
      fill="#0066cc"
      stroke="white"
      stroke-width="0.6"
      :cursor="draggingId === seg.id ? 'grabbing' : 'pointer'"
      pointer-events="all"
      @mouseenter="handleCornerMouseEnter(seg.id)"
      @mouseleave="handleCornerMouseLeave"
      @contextmenu.prevent.stop="showContextMenu($event, seg.id)"
    />
  </svg>

  <Teleport to="body">
    <div
      v-if="contextMenu"
      class="outline-context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @click.stop
    >
      <button class="context-menu-item context-menu-item--danger" @click="deleteFromContextMenu">
        Delete corner
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.outline-overlay-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: crosshair;
}
</style>

<style>
.outline-context-menu {
  position: fixed;
  z-index: 9999;
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 0.375rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 140px;
  padding: 0.25rem 0;
}

.context-menu-item {
  display: block;
  width: 100%;
  padding: 0.375rem 0.75rem;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
}

.context-menu-item--danger {
  color: var(--bs-danger);
}

.context-menu-item--danger:hover {
  background: var(--bs-danger-bg-subtle);
}
</style>
