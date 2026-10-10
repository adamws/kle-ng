/**
 * Track editor state: editor settings, the route being drawn and net
 * highlighting. Finished routes are written to the PCB generator settings
 * (`settings.trackPreset`), which stay the single source of the preset.
 *
 * Routing follows KiCad: X or the route tool starts a route at a pad, a track
 * end or a grid point; the preview to the cursor is a two-segment 45°/90°
 * walk; a click commits it unless it breaks a design rule; clicking a pad or
 * track end of the route's net finishes it, as do double-click and End.
 * Backspace drops the last vertex, Esc cancels, / flips the posture. V places
 * a via at the end of the walk and continues the route on the other layer.
 *
 * The select tool selects tracks (click, Shift+click, box), deletes them,
 * extends a selection to connected tracks (U) and changes their width or
 * layer. Committed changes go through an undo history; a preset replaced
 * from outside the editor (JSON Apply, Reset, Upload, Clear) resets it.
 *
 * Every write records the preset's basis (footprints and diode placement);
 * when the settings move away from it, the preview offers to keep or clear.
 */
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, toRaw, watch } from 'vue'
import { useSnapshotHistory } from '@/composables/useSnapshotHistory'
import { usePcbGeneratorStore } from './pcbGenerator'
import type {
  CopperLayer,
  Pt,
  TrackItem,
  TrackPreset,
  TrackSegment,
  TrackVia,
} from '@/types/tracks'
import { basisChanges, presetBasis } from '@/utils/pcb-tracks/basis'
import { routingModeOption, type RoutingMode } from '@/utils/pcb/routing-mode'
import { itemClusters, padInfos } from '@/utils/pcb-tracks/connectivity'
import { pointSegment } from '@/utils/pcb-tracks/distance'
import {
  DEFAULT_DRC_RULES,
  DEFAULT_VIA,
  runDrc,
  type DrcResult,
  type Violation,
} from '@/utils/pcb-tracks/drc'
import type { NetName, PlacedPad } from '@/utils/pcb-tracks/netlist'
import { snapToGrid, walk, type Posture } from '@/utils/pcb-tracks/posture'
import { snapTarget, type SnapTarget } from '@/utils/pcb-tracks/snap'
import {
  cleanupTracks,
  dragCorner45,
  dragSegment45,
  segmentNormal,
  snapDraggedCorner,
  snapSegmentOffset,
  type DragHandle,
} from '@/utils/pcb-tracks/drag'
import {
  assembleLine,
  endsAt,
  isFreeEnd,
  isLineCorner,
  replaceLine,
  replaceLines,
  simplifyChain,
  type LineReplacement,
  type TrackLine,
} from '@/utils/pcb-tracks/line'
import { FLOAT_EPS, roundNm, samePoint } from '@/utils/pcb-tracks/units'

export interface TrackEditorSettings {
  /** Track width, mm. */
  width: number
  /** Grid pitch, mm. */
  grid: number
  layer: CopperLayer
  posture: Posture
  /** Size of new vias, mm: the last size set on a via, KiCad's netclass default at first. */
  via: ViaSize
}

export interface ViaSize {
  diameter: number
  drillDiameter: number
}

export type TrackTool = 'select' | 'route' | 'via'

export const WIDTH_PRESETS = [0.15, 0.2, 0.25, 0.3, 0.4, 0.5]
export const GRID_OPTIONS = [0.05, 0.1, 0.127, 0.25, 0.5, 0.635, 1, 1.27]

interface RouteState {
  /** Committed vertices; the first is the start anchor. */
  points: Pt[]
  /** Layer of each committed segment (points[i] to points[i + 1]). */
  segmentLayers: CopperLayer[]
  /** Vertices holding a via, where the route changes layer. */
  vias: number[]
  net: NetName | null
  /** Pad the route started on, finishing on it again doesn't end the route. */
  startPadKey: string | null
  /** Started on a pad or track end (not a bare grid point). */
  startAnchored: boolean
  /** Layer the route continues on. */
  layer: CopperLayer
  via: ViaSize
  /** Swap the order of the walk's straight and diagonal parts. */
  flip: boolean
}

interface DragCommon {
  /** Items at the start (a segment drag starts from merged collinear tracks). */
  base: TrackItem[]
  grab: Pt
  /** Net of each item of `base`. */
  nets: (NetName | null)[]
  net: NetName | null
  /** Offset (segment) or point (corner) of the preview. */
  param: number | Pt
  /** The preview: follows the cursor across obstacles. */
  result: LineReplacement
  /** DRC of the preview, which is what the editor shows while dragging. */
  drc: DrcResult
  /** The error at the preview position, where releasing isn't allowed. */
  violation: Violation | null
  /** The last preview without errors, where releasing on an error goes back to. */
  lastValid: LineReplacement
  /** Check design rules (off when the dragged tracks already had errors). */
  strict: boolean
}

/** A segment or corner drag, on the line through the grabbed track. */
interface LineDrag extends DragCommon {
  handle: Exclude<DragHandle, { kind: 'via' }>
  /** The dragged line in `base`. */
  line: TrackLine
  /** The dragged segment (segment drags) or point (corner drags) in the line's chain. */
  index: number
}

/** A via drag, with the lines ending on the via. */
interface ViaDrag extends DragCommon {
  handle: Extract<DragHandle, { kind: 'via' }>
  /** The lines ending on the via, each with the via's point index. */
  fanout: { line: TrackLine; index: number }[]
}

type DragState = LineDrag | ViaDrag

function segments(points: readonly Pt[], layer: CopperLayer, width: number): TrackSegment[] {
  const out: TrackSegment[] = []
  for (let i = 1; i < points.length; i++) {
    out.push({ type: 'track', start: points[i - 1]!, end: points[i]!, width, layer })
  }
  return out
}

const otherLayer = (layer: CopperLayer): CopperLayer => (layer === 'F.Cu' ? 'B.Cu' : 'F.Cu')
const viaAt = (position: Pt, size: ViaSize): TrackVia => ({ type: 'via', position, ...size })

/** Index of the via whose copper is nearest `p`, within `tolerance` mm of its edge. */
function viaUnder(items: readonly TrackItem[], p: Pt, tolerance: number): number | null {
  let best: number | null = null
  let bestGap = Infinity
  for (const [i, item] of items.entries()) {
    if (item.type !== 'via') continue
    const gap = Math.hypot(p.x - item.position.x, p.y - item.position.y) - item.diameter / 2
    if (gap <= tolerance && gap < bestGap) {
      best = i
      bestGap = gap
    }
  }
  return best
}

/**
 * A via size with its drill made to fit: at most the diameter less the
 * smallest copper ring, so the preset format's rule (drill < diameter) always
 * holds. Null when the diameter leaves no room for a drill.
 */
function fitViaSize<T extends ViaSize>(via: T): T | null {
  const maxDrill = Math.round((via.diameter - 2 * DEFAULT_DRC_RULES.viaMinAnnular) * 1e6) / 1e6
  if (maxDrill <= 0) return null
  return via.drillDiameter > maxDrill ? { ...via, drillDiameter: maxDrill } : via
}

/**
 * A route's items in chain order: the tracks of each layer run, with the via
 * joining two runs between them. Each run is simplified on its own, so
 * collinear clicks leave no extra corner but a via never moves.
 */
function routeItems(r: RouteState, width: number, reverse: boolean): TrackItem[] {
  const n = r.points.length
  const points = reverse ? [...r.points].reverse() : r.points
  const layers = reverse ? [...r.segmentLayers].reverse() : r.segmentLayers
  const vias = new Set(r.vias.map((v) => (reverse ? n - 1 - v : v)))
  const items: TrackItem[] = []
  let run: Pt[] = [points[0]!]
  const flush = (layer: CopperLayer | undefined) => {
    if (layer && run.length > 1) items.push(...segments(simplifyChain(run), layer, width))
  }
  if (vias.has(0)) items.push(viaAt(points[0]!, r.via))
  for (let i = 1; i < n; i++) {
    run.push(points[i]!)
    if (vias.has(i)) {
      flush(layers[i - 1])
      items.push(viaAt(points[i]!, r.via))
      run = [points[i]!]
    }
  }
  flush(layers[n - 2])
  return items
}

export const usePcbTracksStore = defineStore('pcbTracks', () => {
  const pcb = usePcbGeneratorStore()

  const editorSettings = ref<TrackEditorSettings>({
    width: 0.25,
    grid: 0.25,
    layer: 'B.Cu',
    posture: '45',
    via: { ...DEFAULT_VIA },
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
  /** Why the last via was refused, until the cursor moves. */
  const viaRefusal = ref<string | null>(null)

  /** Pads of the placed footprints, switch-local (set by the preview). */
  const pads = shallowRef<readonly PlacedPad[]>([])
  const padInfoList = computed(() => padInfos(pads.value))

  // presets are defined for a front-side switch only
  const savedItems = computed<TrackItem[]>(() =>
    pcb.settings.switchSide === 'FRONT' ? (pcb.settings.trackPreset?.items ?? []) : [],
  )
  /** A track drag in progress; its preview replaces the saved items until it ends. */
  const drag = shallowRef<DragState | null>(null)
  /** The items shown and checked: the saved preset, or the drag preview. */
  const presetItems = computed<TrackItem[]>(() => drag.value?.result.items ?? savedItems.value)
  /** DRC of the shown items; a drag keeps its preview's DRC, so it isn't run twice. */
  const presetDrc = computed(() => drag.value?.drc ?? runDrc(pads.value, savedItems.value))

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

  const routeSegments = computed<TrackSegment[]>(() => {
    const r = route.value
    if (!r) return []
    return r.segmentLayers.map((layer, i) => ({
      type: 'track',
      start: r.points[i]!,
      end: r.points[i + 1]!,
      width: editorSettings.value.width,
      layer,
    }))
  })
  const routeVias = computed<TrackVia[]>(() =>
    route.value
      ? route.value.vias.map((i) => viaAt(route.value!.points[i]!, route.value!.via))
      : [],
  )
  const previewSegments = computed(() =>
    route.value ? segments(previewPoints.value, route.value.layer, editorSettings.value.width) : [],
  )

  /** DRC of the preset with the route and its preview, while routing. */
  const routeDrc = computed<DrcResult | null>(() =>
    route.value
      ? runDrc(pads.value, [
          ...presetItems.value,
          ...routeSegments.value,
          ...routeVias.value,
          ...previewSegments.value,
        ])
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

  // Selection (indexes into the preset items) and history

  const selection = ref<number[]>([])
  /** A history step: the items with the basis they were drawn for, so undo restores staleness too. */
  type Snapshot = Pick<TrackPreset, 'items' | 'basis'>
  const history = useSnapshotHistory<Snapshot>()
  /** The preset object this store wrote last; anything else is an outside write. */
  let ownPreset: unknown = undefined

  const currentSnapshot = (): Snapshot => ({
    items: pcb.settings.trackPreset?.items ?? [],
    basis: pcb.settings.trackPreset?.basis,
  })

  function writePreset(snapshot: Snapshot) {
    const next: TrackPreset = { version: 1, items: snapshot.items }
    if (snapshot.basis) next.basis = snapshot.basis
    ownPreset = next
    pcb.settings.trackPreset = next
  }

  /**
   * Writes the preset items, as one undoable step unless `record` is false.
   * The basis records what they were drawn for (see `staleChanges`). Edits of
   * a stale preset keep its basis, so they don't dismiss the stale warning;
   * Keep (`restamp`) or drawing into an empty preset stamps the current
   * settings. An empty preset stays: it is what keeps a preset routing mode.
   */
  function writeItems(items: TrackItem[], record = true, restamp = false) {
    const current = pcb.settings.trackPreset
    const stale =
      !restamp && !!current?.items.length && basisChanges(current.basis, pcb.settings).length > 0
    const snapshot = { items, basis: stale ? current!.basis : presetBasis(pcb.settings) }
    writePreset(snapshot)
    if (record) history.push(snapshot)
  }

  ownPreset = toRaw(pcb.settings.trackPreset)
  history.reset(currentSnapshot())

  // an outside write starts a new history, so undo can't bring back a replaced preset
  watch(
    () => pcb.settings.trackPreset,
    (preset) => {
      if (toRaw(preset) === ownPreset) return
      ownPreset = toRaw(preset)
      selection.value = []
      history.reset(currentSnapshot())
    },
  )

  /** Settings changed since the preset was drawn (footprints, diode placement). */
  const staleChanges = computed(() =>
    presetItems.value.length ? basisChanges(pcb.settings.trackPreset?.basis, pcb.settings) : [],
  )

  /** Keeps a stale preset: it is now drawn for the current settings (undoable). */
  function keepPreset() {
    writeItems(savedItems.value, true, true)
  }

  /** Removes the preset and starts a new history, as an outside write would. */
  function clearPreset() {
    cancelRoute()
    cancelDrag()
    selection.value = []
    ownPreset = undefined
    pcb.settings.trackPreset = undefined
    history.reset({ items: [] })
  }

  /** Removes every track, as one undoable step; the preset routing mode stays. */
  function clearAll() {
    cancelRoute()
    cancelDrag()
    selection.value = []
    if (savedItems.value.length) writeItems([])
  }

  /**
   * Switches the routing mode. A preset mode starts an empty preset unless one
   * exists; any other mode removes the preset (the view confirms first).
   */
  function setRoutingMode(mode: RoutingMode) {
    const option = routingModeOption(mode)
    pcb.settings.routing = option.routing
    if (option.preset && !pcb.settings.trackPreset) {
      writeItems([], false)
      history.reset(currentSnapshot())
    } else if (!option.preset && pcb.settings.trackPreset) {
      clearPreset()
    }
  }

  function undo() {
    cancelRoute()
    cancelDrag()
    selection.value = []
    const snapshot = history.undo()
    if (snapshot) writePreset(snapshot)
  }

  function redo() {
    cancelRoute()
    cancelDrag()
    selection.value = []
    const snapshot = history.redo()
    if (snapshot) writePreset(snapshot)
  }

  /** Index of the via or track under `p` within `tolerance` mm, on visible layers. */
  function itemAt(p: Pt, tolerance: number, layers: readonly CopperLayer[]): number | null {
    // vias span both layers: pickable while any layer shows
    const via = layers.length ? viaUnder(presetItems.value, p, tolerance) : null
    return via ?? trackAt(p, tolerance, layers)
  }

  /** Index of the track under `p` within `tolerance` mm (topmost), on visible layers. */
  function trackAt(p: Pt, tolerance: number, layers: readonly CopperLayer[]): number | null {
    let best: number | null = null
    let bestGap = Infinity
    for (const [i, item] of presetItems.value.entries()) {
      if (item.type !== 'track' || !layers.includes(item.layer)) continue
      const gap = Math.max(0, pointSegment(p, item.start, item.end).d - item.width / 2)
      // `<=`: of overlapping tracks, the later (drawn on top) wins
      if (gap <= tolerance && gap <= bestGap) {
        best = i
        bestGap = gap
      }
    }
    return best
  }

  /**
   * A pad still waiting for its first track: it has a net with an unrouted
   * connection (a ratsnest line) and no track or via touches it. Clicking one
   * with the select tool starts a route there.
   */
  function isUnconnectedPad(key: string): boolean {
    const drc = presetDrc.value
    const index = padInfoList.value.findIndex((p) => p.placed.key === key)
    const pad = padInfoList.value[index]
    if (!pad?.net || !drc.ratsnest.some((line) => line.net === pad.net)) return false
    const cluster = drc.connectivity.clusters.get(drc.connectivity.padCluster[index]!)
    return !cluster?.nodes.some((n) => n >= padInfoList.value.length)
  }

  /** Select-tool click: a track selects it (Shift toggles), a pad highlights its net. */
  function selectClick(item: number | null, padNet: NetName | null, additive: boolean) {
    if (item !== null) {
      const has = selection.value.includes(item)
      selection.value = additive
        ? has
          ? selection.value.filter((i) => i !== item)
          : [...selection.value, item]
        : [item]
      return
    }
    if (!additive) selection.value = []
    selectedNet.value = padNet
  }

  function selectItems(items: readonly number[], additive: boolean) {
    selection.value = additive ? [...new Set([...selection.value, ...items])] : [...items]
  }

  /** U: extend the selection to the tracks and vias connected to it, up to pads (like KiCad). */
  function selectConnected() {
    if (!selection.value.length) return
    const cluster = itemClusters(presetItems.value)
    const clusters = new Set(selection.value.map((i) => cluster[i]))
    selection.value = presetItems.value.flatMap((_, i) => (clusters.has(cluster[i]) ? [i] : []))
  }

  function deleteSelection() {
    if (!selection.value.length) return
    const drop = new Set(selection.value)
    selection.value = []
    writeItems(savedItems.value.filter((_, i) => !drop.has(i)))
  }

  /**
   * Changes the selected tracks (width, layer) or vias (size); the selection
   * stays (indexes don't move). A via's drill shrinks to fit a smaller
   * diameter (see `fitViaSize`). A via size also becomes the size of new vias.
   */
  function updateSelection(change: Partial<Pick<TrackSegment, 'width' | 'layer'> & ViaSize>) {
    if (!selection.value.length) return
    const chosen = new Set(selection.value)
    const { width, layer, diameter, drillDiameter } = change
    const trackChange = { ...(width !== undefined && { width }), ...(layer && { layer }) }
    const viaChange = {
      ...(diameter !== undefined && { diameter }),
      ...(drillDiameter !== undefined && { drillDiameter }),
    }
    writeItems(
      savedItems.value.map((item, i) => {
        if (!chosen.has(i)) return item
        if (item.type === 'track') return { ...item, ...trackChange }
        if (item.type === 'via') return fitViaSize({ ...item, ...viaChange }) ?? item
        return item
      }),
    )
    if (Object.keys(viaChange).length) {
      const via = fitViaSize({ ...editorSettings.value.via, ...viaChange })
      if (via) editorSettings.value.via = via
    }
  }

  /** Net to highlight: the route's while routing, the dragged one's, else the clicked pad's. */
  const highlightNet = computed(() =>
    route.value ? route.value.net : drag.value ? drag.value.net : selectedNet.value,
  )

  // Dragging tracks (select tool), see utils/pcb-tracks/drag.ts

  /**
   * A draggable corner or segment under `p`. Corners are line corners and
   * free line ends; an end on a pad, via or junction drags its segment, so a
   * drag never pulls a track off what it connects.
   */
  function dragHandleAt(
    p: Pt,
    tolerance: number,
    layers: readonly CopperLayer[],
  ): DragHandle | null {
    const items = savedItems.value
    // a via drags with the tracks ending on it (vias span both layers)
    const via = layers.length ? viaUnder(items, p, tolerance) : null
    if (via !== null) return { kind: 'via', item: via }
    let corner: { d: number; handle: DragHandle } | null = null
    for (const item of items) {
      if (item.type !== 'track' || !layers.includes(item.layer)) continue
      for (const end of [item.start, item.end]) {
        const d = Math.hypot(p.x - end.x, p.y - end.y)
        if (d > tolerance + item.width / 2 || (corner && d >= corner.d)) continue
        const infos = padInfoList.value
        if (isLineCorner(items, infos, end, item.layer) || isFreeEnd(items, infos, end, item.layer))
          corner = { d, handle: { kind: 'corner', point: end, layer: item.layer } }
      }
    }
    if (corner) return corner.handle
    const index = trackAt(p, tolerance, layers)
    return index === null ? null : { kind: 'segment', item: index }
  }

  /** The line's ends of the dragged segment (segment drags). */
  function draggedSegment(state: LineDrag): [Pt, Pt] {
    return [state.line.points[state.index]!, state.line.points[state.index + 1]!]
  }

  /** The preset with the dragged line at `param`, simplified like KiCad does each frame. */
  function dragPreview(state: DragState, param: number | Pt): LineReplacement {
    if ('fanout' in state) {
      // KiCad's via drag: the via goes to the point, each line on it follows at 45°
      const at = roundNm(param as Pt)
      const via = state.base[state.handle.item] as TrackVia
      return replaceLines(
        state.base,
        state.fanout.map(({ line, index }) => ({
          line,
          points: simplifyChain(dragCorner45(line.points, index, at).map(roundNm)),
        })),
        new Map([[state.handle.item, { ...via, position: at }]]),
      )
    }
    let chain: Pt[]
    if (state.handle.kind === 'segment') {
      const [a, b] = draggedSegment(state)
      const n = segmentNormal(a, b)
      const offset = param as number
      const target = { x: a.x + n.x * offset, y: a.y + n.y * offset }
      chain = dragSegment45(state.line.points, state.index, target)
    } else {
      chain = dragCorner45(state.line.points, state.index, param as Pt)
    }
    return replaceLine(state.base, state.line, simplifyChain(chain.map(roundNm)))
  }

  /** A design-rule error on a moved track. */
  function dragViolation(state: DragState, result: LineReplacement, drc: DrcResult) {
    if (!state.strict) return null
    const changed = new Set(result.changed)
    return drc.violations.find((v) => v.items.some((i) => changed.has(i))) ?? null
  }

  /** The lines ending on via `index`, each with the via's point index. */
  function viaFanout(base: TrackItem[], index: number) {
    const via = base[index] as TrackVia
    const fanout: { line: TrackLine; index: number }[] = []
    const seen = new Set<number>()
    base.forEach((item, i) => {
      if (item.type !== 'track' || seen.has(i)) return
      if (!samePoint(item.start, via.position) && !samePoint(item.end, via.position)) return
      const line = assembleLine(base, padInfoList.value, i)
      line.items.forEach((j) => seen.add(j))
      fanout.push({ line, index: line.points.findIndex((q) => samePoint(q, via.position)) })
    })
    return fanout
  }

  /**
   * What every drag starts with: nets and the strict check from the items at
   * the start, and no preview yet (`withPreview` adds the one at the grab).
   */
  function dragCommon(
    base: TrackItem[],
    param: number | Pt,
    at: Pt,
    item: number,
    moved: readonly number[],
  ): DragCommon {
    const baseDrc = runDrc(pads.value, base)
    const unchanged = { items: base, changed: [] }
    return {
      base,
      grab: { ...at },
      nets: baseDrc.itemNets,
      net: baseDrc.itemNets[item] ?? null,
      param,
      result: unchanged,
      drc: baseDrc,
      violation: null,
      lastValid: unchanged,
      strict: !baseDrc.violations.some((v) => v.items.some((i) => moved.includes(i))),
    }
  }

  function withPreview(state: DragState): DragState {
    state.result = state.lastValid = dragPreview(state, state.param)
    state.drc = runDrc(pads.value, state.result.items)
    return state
  }

  /** The drag of `handle` grabbed at `at`, before any move; null when it can't drag. */
  function createDragState(handle: DragHandle, at: Pt): DragState | null {
    const infos = padInfoList.value
    let base = savedItems.value
    if (handle.kind === 'via') {
      const via = base[handle.item]
      if (via?.type !== 'via') return null
      const fanout = viaFanout(base, handle.item)
      const moved = [handle.item, ...fanout.flatMap((f) => f.line.items)]
      const common = dragCommon(base, via.position, at, handle.item, moved)
      return withPreview({ ...common, handle, fanout })
    }
    let item: number
    if (handle.kind === 'segment') {
      // a straight line clicked together from several tracks drags as one
      const clean = cleanupTracks(base, infos)
      base = clean.items
      item = clean.map[handle.item] ?? -1
    } else {
      item = endsAt(base, handle.point, handle.layer)[0]?.item ?? -1
    }
    if (item < 0) return null
    const line = assembleLine(base, infos, item)
    const index =
      handle.kind === 'segment'
        ? line.items.indexOf(item)
        : line.points.findIndex((q) => samePoint(q, handle.point))
    if (index < 0) return null
    const param = handle.kind === 'segment' ? 0 : handle.point
    return withPreview({ ...dragCommon(base, param, at, item, line.items), handle, line, index })
  }

  function startDrag(handle: DragHandle, at: Pt) {
    cancelRoute()
    selection.value = []
    const state = createDragState(handle, at)
    if (state) drag.value = state
  }

  /** A dragged via snaps to track ends of its net on either layer (not its own), else the grid. */
  function snapVia(state: ViaDrag, at: Pt): Pt {
    const own = new Set([state.handle.item, ...state.fanout.flatMap((f) => f.line.items)])
    let best: Pt | null = null
    let bestD = Infinity
    for (const [i, it] of state.base.entries()) {
      if (own.has(i) || !state.net || state.nets[i] !== state.net) continue
      const points =
        it.type === 'track' ? [it.start, it.end] : it.type === 'via' ? [it.position] : []
      for (const q of points) {
        const d = Math.hypot(at.x - q.x, at.y - q.y)
        if (d <= snapRadius.value && d < bestD) {
          best = q
          bestD = d
        }
      }
    }
    return best ?? snapToGrid(at, editorSettings.value.grid)
  }

  /**
   * Follows the cursor, across obstacles too (like KiCad's highlight-collisions
   * mode): errors show while passing, only the release position must be legal.
   */
  function moveDrag(at: Pt) {
    const state = drag.value
    if (!state) return
    let param: number | Pt
    if ('fanout' in state) {
      param = snapVia(state, at)
    } else if (state.handle.kind === 'segment') {
      const [a, b] = draggedSegment(state)
      const n = segmentNormal(a, b)
      const raw = (at.x - state.grab.x) * n.x + (at.y - state.grab.y) * n.y
      // same-net pad centres and track ends; the segment's own ends would hold it in place
      const anchors: Pt[] = []
      for (const pad of padInfoList.value) {
        if (pad.net && pad.net === state.net && pad.layers.includes(state.line.layer))
          anchors.push({ x: pad.placed.pad.at.x, y: pad.placed.pad.at.y })
      }
      state.base.forEach((it, i) => {
        if (it.type === 'track' && state.nets[i] === state.net) anchors.push(it.start, it.end)
      })
      param = snapSegmentOffset(
        a,
        b,
        raw,
        anchors.filter((q) => !samePoint(q, a) && !samePoint(q, b)),
        editorSettings.value.grid,
        snapRadius.value,
      )
    } else {
      // where nearby segment lines cross at 45°, else pads, track ends, grid
      const crossing = snapDraggedCorner(state.line.points, at, state.index, snapRadius.value)
      param =
        crossing !== at
          ? crossing
          : snapTarget(at, {
              pads: padInfoList.value,
              items: state.base,
              itemNets: state.nets,
              layer: state.line.layer,
              grid: editorSettings.value.grid,
              radius: snapRadius.value,
              net: state.net,
            }).point
    }
    const result = dragPreview(state, param)
    // one DRC per move: it decides where a release lands and is what the editor shows
    const drc = runDrc(pads.value, result.items)
    const violation = dragViolation(state, result, drc)
    drag.value = {
      ...state,
      param,
      result,
      drc,
      violation,
      lastValid: violation ? state.lastValid : result,
    }
  }

  /**
   * Ends the drag: cleans up and writes the result as one undoable step.
   * Released on an error, the tracks go to the last position without one.
   */
  function endDrag() {
    const state = drag.value
    drag.value = null
    if (!state) return
    const result = state.violation ? state.lastValid : state.result
    const items = cleanupTracks(result.items, padInfoList.value).items
    if (JSON.stringify(items) !== JSON.stringify(savedItems.value)) writeItems(items)
  }

  function cancelDrag() {
    drag.value = null
  }

  function setPads(value: readonly PlacedPad[]) {
    pads.value = value
  }

  function setCursor(p: Pt | null) {
    cursor.value = p
    viaRefusal.value = null
  }

  function setTool(value: TrackTool) {
    if (value !== 'route') cancelRoute()
    tool.value = value
  }

  function startRoute(): boolean {
    const t = target.value
    if (!t) return false
    cancelDrag()
    tool.value = 'route'
    const net = t.kind === 'grid' ? null : t.net
    route.value = {
      points: [t.point],
      segmentLayers: [],
      vias: [],
      net,
      startPadKey: t.kind === 'pad' ? t.padKey : null,
      startAnchored: t.kind !== 'grid',
      layer: editorSettings.value.layer,
      via: { ...editorSettings.value.via },
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
    r.segmentLayers.push(...added.map(() => r.layer))
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
    const reverse = !r.startAnchored && endAnchored
    writeItems([...savedItems.value, ...routeItems(r, editorSettings.value.width, reverse)])
  }

  /**
   * V while routing: commits the walk to the cursor, places a via at its end
   * and continues on the other layer, as in KiCad. Refused (returns false)
   * when the walk or the via breaks a rule, or the via would land on a pad.
   */
  function placeVia(): boolean {
    const r = route.value
    const t = target.value
    if (!r || !t || t.kind === 'pad') {
      if (r) blockedCount.value++
      return false
    }
    const last = r.points[r.points.length - 1]!
    const added = previewPoints.value.slice(1)
    const at = added[added.length - 1] ?? last
    if (r.vias.includes(r.points.length - 1) && samePoint(at, last)) {
      return false // already a via here
    }
    const first = presetItems.value.length
    const check = runDrc(pads.value, [
      ...presetItems.value,
      ...routeSegments.value,
      ...routeVias.value,
      ...previewSegments.value,
      viaAt(at, r.via),
    ])
    const refused = check.violations.find((v) => v.items.some((i) => i >= first))
    if (refused) {
      viaRefusal.value = refused.message
      blockedCount.value++
      return false
    }
    r.points.push(...added)
    r.segmentLayers.push(...added.map(() => r.layer))
    r.vias.push(r.points.length - 1)
    r.layer = otherLayer(r.layer)
    editorSettings.value.layer = r.layer
    return true
  }

  function cancelRoute() {
    route.value = null
    viaRefusal.value = null
  }

  // Via tool: free-standing vias, placed with a click (KiCad's via tool)

  /** The via the via tool would place: at the cursor, snapped to track ends and vias, else the grid. */
  const freeVia = computed<TrackVia | null>(() => {
    if (tool.value !== 'via' || route.value || !cursor.value) return null
    const t = snapTarget(cursor.value, {
      pads: [], // not into pads: routing onto a pad connects to it
      items: presetItems.value,
      itemNets: presetDrc.value.itemNets,
      layer: editorSettings.value.layer,
      grid: editorSettings.value.grid,
      radius: snapRadius.value,
    })
    return viaAt(t.point, editorSettings.value.via)
  })

  /** Why the via tool's via can't go where it is, or null. */
  const freeViaViolation = computed<Violation | null>(() => {
    const via = freeVia.value
    if (!via) return null
    const at = presetItems.value.length
    const drc = runDrc(pads.value, [...presetItems.value, via])
    return drc.violations.find((v) => v.items.includes(at)) ?? null
  })

  /** Via tool click: places the via as one undoable step, unless it breaks a rule. */
  function placeFreeVia(): boolean {
    const via = freeVia.value
    if (!via) return false
    if (freeViaViolation.value) {
      blockedCount.value++
      return false
    }
    const taken = savedItems.value.some(
      (it) => it.type === 'via' && samePoint(it.position, via.position),
    )
    if (taken) return false
    writeItems([...savedItems.value, via])
    return true
  }

  /** Backspace: drop the last via (back to its layer), else the last vertex, else the route. */
  function undoVertex() {
    const r = route.value
    if (!r) return
    const last = r.points.length - 1
    if (r.vias[r.vias.length - 1] === last) {
      r.vias.pop()
      r.layer = otherLayer(r.layer)
      editorSettings.value.layer = r.layer
    } else if (r.points.length > 1) {
      r.points.pop()
      r.segmentLayers.pop()
    } else {
      cancelRoute()
    }
  }

  function flipPosture() {
    if (route.value) route.value.flip = !route.value.flip
  }

  function cycleWidth(direction: 1 | -1) {
    const w = editorSettings.value.width
    const next =
      direction > 0
        ? (WIDTH_PRESETS.find((p) => p > w + FLOAT_EPS) ?? WIDTH_PRESETS[0]!)
        : ([...WIDTH_PRESETS].reverse().find((p) => p < w - FLOAT_EPS) ??
          WIDTH_PRESETS[WIDTH_PRESETS.length - 1]!)
    editorSettings.value.width = next
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

  /** Esc: cancel a drag or the route, then the selection, then the highlight, then the route tool. */
  function escape() {
    if (drag.value) cancelDrag()
    else if (route.value) cancelRoute()
    else if (selection.value.length) selection.value = []
    else if (selectedNet.value) selectedNet.value = null
    else tool.value = 'select'
  }

  /** Leaving the editor: nothing in progress survives. */
  function reset() {
    drag.value = null
    route.value = null
    cursor.value = null
    selectedNet.value = null
    selection.value = []
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
    routeVias,
    previewSegments,
    viaRefusal,
    previewViolations,
    drc,
    isRouting,
    selection,
    isDragging: computed(() => drag.value !== null),
    dragViolation: computed(() => drag.value?.violation ?? null),
    dragHandleAt,
    startDrag,
    moveDrag,
    endDrag,
    cancelDrag,
    staleChanges,
    keepPreset,
    clearPreset,
    clearAll,
    setRoutingMode,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undo,
    redo,
    trackAt,
    itemAt,
    isUnconnectedPad,
    selectClick,
    selectItems,
    selectConnected,
    deleteSelection,
    updateSelection,
    setPads,
    setCursor,
    setTool,
    startRoute,
    commit,
    finish,
    cancelRoute,
    undoVertex,
    placeVia,
    freeVia,
    freeViaViolation,
    placeFreeVia,
    flipPosture,
    cycleWidth,
    click,
    escape,
    reset,
  }
})
