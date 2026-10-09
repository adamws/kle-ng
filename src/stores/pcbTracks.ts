/**
 * Track editor state: editor settings, the route being drawn and net
 * highlighting. Finished routes are written to the PCB generator settings
 * (`settings.trackPreset`), which stay the single source of the preset.
 *
 * Routing follows KiCad: X or the route tool starts a route at a pad, a track
 * end or a grid point; the preview to the cursor is a two-segment 45°/90°
 * walk; a click commits it unless it breaks a design rule; clicking a pad or
 * track end of the route's net finishes it, as do double-click and End.
 * Backspace drops the last vertex, Esc cancels, / flips the posture.
 */
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { usePcbGeneratorStore } from './pcbGenerator'
import type { CopperLayer, Pt, TrackItem, TrackSegment } from '@/types/tracks'
import { padInfos } from '@/utils/pcb-tracks/connectivity'
import { DEFAULT_DRC_RULES, runDrc, type DrcResult, type Violation } from '@/utils/pcb-tracks/drc'
import type { NetName, PlacedPad } from '@/utils/pcb-tracks/netlist'
import { walk, type Posture } from '@/utils/pcb-tracks/posture'
import { snapTarget, type SnapTarget } from '@/utils/pcb-tracks/snap'

export interface TrackEditorSettings {
  /** Track width, mm. */
  width: number
  /** Grid pitch, mm. */
  grid: number
  /** Copper clearance, mm (KiCad's default netclass, which kle-ng-api boards use). */
  clearance: number
  layer: CopperLayer
  posture: Posture
}

export type TrackTool = 'select' | 'route'

export const WIDTH_PRESETS = [0.15, 0.2, 0.25, 0.3, 0.4, 0.5]
export const GRID_OPTIONS = [0.05, 0.1, 0.127, 0.25, 0.5, 0.635, 1, 1.27]

interface RouteState {
  /** Committed vertices; the first is the start anchor. */
  points: Pt[]
  net: NetName | null
  /** Pad the route started on, finishing on it again doesn't end the route. */
  startPadKey: string | null
  /** Started on a pad or track end (not a bare grid point). */
  startAnchored: boolean
  layer: CopperLayer
  width: number
  /** Swap the order of the walk's straight and diagonal parts. */
  flip: boolean
}

function segments(points: readonly Pt[], layer: CopperLayer, width: number): TrackSegment[] {
  const out: TrackSegment[] = []
  for (let i = 1; i < points.length; i++) {
    out.push({ type: 'track', start: points[i - 1]!, end: points[i]!, width, layer })
  }
  return out
}

export const usePcbTracksStore = defineStore('pcbTracks', () => {
  const pcb = usePcbGeneratorStore()

  const editorSettings = ref<TrackEditorSettings>({
    width: 0.25,
    grid: 0.25,
    clearance: DEFAULT_DRC_RULES.clearance,
    layer: 'B.Cu',
    posture: '45',
  })
  const tool = ref<TrackTool>('select')
  const route = ref<RouteState | null>(null)
  /** Raw cursor, switch-local mm. */
  const cursor = ref<Pt | null>(null)
  /** Anchor attraction radius, mm (set by the view from screen pixels). */
  const snapRadius = ref(0.5)
  /** Net highlighted by clicking a pad (select tool). */
  const selectedNet = ref<NetName | null>(null)
  /** Bumped when a click is refused, so the view can flash. */
  const blockedCount = ref(0)

  /** Pads of the placed footprints, switch-local (set by the preview). */
  const pads = shallowRef<readonly PlacedPad[]>([])
  const padInfoList = computed(() => padInfos(pads.value))

  // presets are defined for a front-side switch only
  const presetItems = computed<TrackItem[]>(() =>
    pcb.settings.switchSide === 'FRONT' ? (pcb.settings.trackPreset?.items ?? []) : [],
  )
  const rules = computed(() => ({
    ...DEFAULT_DRC_RULES,
    clearance: editorSettings.value.clearance,
  }))
  const presetDrc = computed(() => runDrc(pads.value, presetItems.value, rules.value))

  const target = computed<SnapTarget | null>(() => {
    if (!cursor.value) return null
    return snapTarget(cursor.value, {
      pads: padInfoList.value,
      items: presetItems.value,
      itemNets: presetDrc.value.itemNets,
      layer: route.value?.layer ?? editorSettings.value.layer,
      grid: editorSettings.value.grid,
      radius: snapRadius.value,
      net: route.value ? route.value.net : undefined,
    })
  })

  /** The walk from the last vertex to the target: [last, corner?, target]. */
  const previewPoints = computed<Pt[]>(() => {
    const r = route.value
    if (!r || !target.value) return []
    return walk(
      r.points[r.points.length - 1]!,
      target.value.point,
      editorSettings.value.posture,
      r.flip,
    )
  })

  const routeSegments = computed(() =>
    route.value ? segments(route.value.points, route.value.layer, route.value.width) : [],
  )
  const previewSegments = computed(() =>
    route.value ? segments(previewPoints.value, route.value.layer, route.value.width) : [],
  )

  /** DRC of the preset with the route and its preview, while routing. */
  const routeDrc = computed<DrcResult | null>(() =>
    route.value
      ? runDrc(
          pads.value,
          [...presetItems.value, ...routeSegments.value, ...previewSegments.value],
          rules.value,
        )
      : null,
  )

  /** Errors the preview would add (committed vertices passed already). */
  const previewViolations = computed<Violation[]>(() => {
    const drc = routeDrc.value
    if (!drc) return []
    const first = presetItems.value.length
    return drc.violations.filter((v) => v.items.some((i) => i >= first))
  })

  /** What the view shows: DRC and ratsnest including the route while routing. */
  const drc = computed(() => routeDrc.value ?? presetDrc.value)

  const isRouting = computed(() => route.value !== null)

  /** Net to highlight: the route's while routing, else the clicked pad's. */
  const highlightNet = computed(() => (route.value ? route.value.net : selectedNet.value))

  function setPads(value: readonly PlacedPad[]) {
    pads.value = value
  }

  function setCursor(p: Pt | null) {
    cursor.value = p
  }

  function setTool(value: TrackTool) {
    if (value !== 'route') cancelRoute()
    tool.value = value
  }

  function startRoute(): boolean {
    const t = target.value
    if (!t) return false
    tool.value = 'route'
    const net = t.kind === 'grid' ? null : t.net
    route.value = {
      points: [t.point],
      net,
      startPadKey: t.kind === 'pad' ? t.padKey : null,
      startAnchored: t.kind !== 'grid',
      layer: editorSettings.value.layer,
      width: editorSettings.value.width,
      flip: false,
    }
    return true
  }

  /** Commits the preview up to the target. Returns false when a rule blocks it. */
  function commit(): boolean {
    const r = route.value
    const t = target.value
    if (!r || !t) return false
    if (previewViolations.value.length) {
      blockedCount.value++
      return false
    }
    const added = previewPoints.value.slice(1)
    if (!added.length) return true
    r.points.push(...added)
    if (t.kind !== 'grid' && !r.net && t.net) r.net = t.net
    const reachedPad = t.kind === 'pad' && t.padKey !== r.startPadKey
    if (reachedPad || t.kind === 'track-end') finish(true)
    return true
  }

  /** Writes the route to the preset. `endAnchored`: it ends on a pad or track. */
  function finish(endAnchored = false) {
    const r = route.value
    route.value = null
    if (!r || r.points.length < 2) return
    // kbplacer places a preset's items in order, so walk outward from a pad
    const points = !r.startAnchored && endAnchored ? [...r.points].reverse() : r.points
    const added = segments(points, r.layer, r.width)
    const preset = pcb.settings.trackPreset
    pcb.settings.trackPreset = preset
      ? { ...preset, items: [...preset.items, ...added] }
      : { version: 1, items: added }
  }

  function cancelRoute() {
    route.value = null
  }

  /** Backspace: drop the last committed vertex, or the route when none is left. */
  function undoVertex() {
    const r = route.value
    if (!r) return
    if (r.points.length > 1) r.points.pop()
    else cancelRoute()
  }

  function flipPosture() {
    if (route.value) route.value.flip = !route.value.flip
  }

  function cycleWidth(direction: 1 | -1) {
    const w = editorSettings.value.width
    const next =
      direction > 0
        ? (WIDTH_PRESETS.find((p) => p > w + 1e-9) ?? WIDTH_PRESETS[0]!)
        : ([...WIDTH_PRESETS].reverse().find((p) => p < w - 1e-9) ??
          WIDTH_PRESETS[WIDTH_PRESETS.length - 1]!)
    editorSettings.value.width = next
    if (route.value) route.value.width = next
  }

  /** Click in the canvas: route tool routes, select tool highlights a pad's net. */
  function click(padNet: NetName | null) {
    if (tool.value === 'route') {
      if (route.value) commit()
      else startRoute()
      return
    }
    selectedNet.value = padNet
  }

  /** Esc: cancel the route, then clear the highlight, then leave the route tool. */
  function escape() {
    if (route.value) cancelRoute()
    else if (selectedNet.value) selectedNet.value = null
    else tool.value = 'select'
  }

  /** Leaving the editor: nothing in progress survives. */
  function reset() {
    route.value = null
    cursor.value = null
    selectedNet.value = null
    tool.value = 'select'
  }

  return {
    editorSettings,
    tool,
    route,
    cursor,
    snapRadius,
    selectedNet,
    highlightNet,
    blockedCount,
    pads,
    presetItems,
    target,
    previewPoints,
    routeSegments,
    previewSegments,
    previewViolations,
    drc,
    isRouting,
    setPads,
    setCursor,
    setTool,
    startRoute,
    commit,
    finish,
    cancelRoute,
    undoVertex,
    flipPosture,
    cycleWidth,
    click,
    escape,
    reset,
  }
})
