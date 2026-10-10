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
import type { CopperLayer, Pt, TrackItem, TrackSegment } from '@/types/tracks'
import { basisChanges, presetBasis } from '@/utils/pcb-tracks/basis'
import { padInfos } from '@/utils/pcb-tracks/connectivity'
import { shapeContains, shapeGap } from '@/utils/pcb-tracks/distance'
import { trackShape } from '@/utils/pcb-tracks/shapes'
import { DEFAULT_DRC_RULES, runDrc, type DrcResult, type Violation } from '@/utils/pcb-tracks/drc'
import type { NetName, PlacedPad } from '@/utils/pcb-tracks/netlist'
import { walk, type Posture } from '@/utils/pcb-tracks/posture'
import { snapTarget, type SnapTarget } from '@/utils/pcb-tracks/snap'
import {
  cleanupTracks,
  dragCorner,
  dragSegment,
  endsAt,
  segmentNormal,
  snapSegmentOffset,
  type DragHandle,
  type DragResult,
} from '@/utils/pcb-tracks/drag'

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

interface DragState {
  handle: DragHandle
  /** Items at the start (a segment drag starts from merged collinear tracks). */
  base: TrackItem[]
  /** The dragged segment's index in `base` (segment drags). */
  item: number
  grab: Pt
  /** Net of each item of `base`. */
  nets: (NetName | null)[]
  net: NetName | null
  /** Offset (segment) or point (corner) of the preview. */
  param: number | Pt
  /** The preview: follows the cursor across obstacles. */
  result: DragResult
  /** The error at the preview position, where releasing isn't allowed. */
  violation: Violation | null
  /** The last preview without errors, where releasing on an error goes back to. */
  lastValid: DragResult
  /** Check design rules (off when the dragged tracks already had errors). */
  strict: boolean
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
  const savedItems = computed<TrackItem[]>(() =>
    pcb.settings.switchSide === 'FRONT' ? (pcb.settings.trackPreset?.items ?? []) : [],
  )
  /** A track drag in progress; its preview replaces the saved items until it ends. */
  const drag = shallowRef<DragState | null>(null)
  /** The items shown and checked: the saved preset, or the drag preview. */
  const presetItems = computed<TrackItem[]>(() => drag.value?.result.items ?? savedItems.value)
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

  // Selection (indexes into the preset items) and history

  const selection = ref<number[]>([])
  const history = useSnapshotHistory<TrackItem[]>()
  /** The preset object this store wrote last; anything else is an outside write. */
  let ownPreset: unknown = undefined

  /**
   * Writes the preset items, as one undoable step unless `record` is false.
   * The basis records what they were drawn for (see `staleChanges`).
   */
  function writeItems(items: TrackItem[], record = true) {
    const next = items.length
      ? { version: 1 as const, items, basis: presetBasis(pcb.settings) }
      : undefined
    ownPreset = next
    pcb.settings.trackPreset = next
    if (record) history.push(items)
  }

  ownPreset = toRaw(pcb.settings.trackPreset)
  history.reset(pcb.settings.trackPreset?.items ?? [])

  // an outside write starts a new history, so undo can't bring back a replaced preset
  watch(
    () => pcb.settings.trackPreset,
    (preset) => {
      if (toRaw(preset) === ownPreset) return
      ownPreset = toRaw(preset)
      selection.value = []
      history.reset(preset?.items ?? [])
    },
  )

  /** Settings changed since the preset was drawn (footprints, diode placement). */
  const staleChanges = computed(() =>
    presetItems.value.length ? basisChanges(pcb.settings.trackPreset?.basis, pcb.settings) : [],
  )

  /** Keeps a stale preset: it is now drawn for the current settings. */
  function keepPreset() {
    writeItems(savedItems.value, false)
  }

  /** Removes the preset and starts a new history, as an outside write would. */
  function clearPreset() {
    cancelRoute()
    selection.value = []
    ownPreset = undefined
    pcb.settings.trackPreset = undefined
    history.reset([])
  }

  function undo() {
    cancelRoute()
    selection.value = []
    const items = history.undo()
    if (items) writeItems(items, false)
  }

  function redo() {
    cancelRoute()
    selection.value = []
    const items = history.redo()
    if (items) writeItems(items, false)
  }

  /** Index of the track under `p` within `tolerance` mm (topmost), on visible layers. */
  function trackAt(p: Pt, tolerance: number, layers: readonly CopperLayer[]): number | null {
    let best: { i: number; d: number } | null = null
    presetItems.value.forEach((item, i) => {
      if (item.type !== 'track' || !layers.includes(item.layer)) return
      const d = shapeGap(trackShape(item), { core: { kind: 'point', p }, r: 0 }).d
      if (d <= tolerance && (!best || d <= best.d)) best = { i, d }
    })
    return best ? (best as { i: number }).i : null
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

  /** U: extend the selection to every track connected to it. */
  function selectConnected() {
    if (!selection.value.length) return
    const cluster = presetDrc.value.connectivity.itemCluster
    const clusters = new Set(selection.value.map((i) => cluster[i]))
    selection.value = presetItems.value.flatMap((_, i) => (clusters.has(cluster[i]) ? [i] : []))
  }

  function deleteSelection() {
    if (!selection.value.length) return
    const drop = new Set(selection.value)
    selection.value = []
    writeItems(savedItems.value.filter((_, i) => !drop.has(i)))
  }

  /** Changes the selected tracks; the selection stays (indexes don't move). */
  function updateSelection(change: Partial<Pick<TrackSegment, 'width' | 'layer'>>) {
    if (!selection.value.length) return
    const chosen = new Set(selection.value)
    writeItems(
      savedItems.value.map((item, i) =>
        chosen.has(i) && item.type === 'track' ? { ...item, ...change } : item,
      ),
    )
  }

  /** Net to highlight: the route's while routing, the dragged one's, else the clicked pad's. */
  const highlightNet = computed(() =>
    route.value ? route.value.net : drag.value ? drag.value.net : selectedNet.value,
  )

  // Dragging tracks (select tool)

  /** A draggable corner or segment under `p`; ends on pads drag their segment instead. */
  function dragHandleAt(
    p: Pt,
    tolerance: number,
    layers: readonly CopperLayer[],
  ): DragHandle | null {
    const items = savedItems.value
    let corner: { d: number; handle: DragHandle } | null = null
    for (const item of items) {
      if (item.type !== 'track' || !layers.includes(item.layer)) continue
      for (const end of [item.start, item.end]) {
        const d = Math.hypot(p.x - end.x, p.y - end.y)
        if (d > tolerance + item.width / 2 || (corner && d >= corner.d)) continue
        const onPad = padInfoList.value.some(
          (pad) => pad.layers.includes(item.layer) && pad.copper.some((s) => shapeContains(s, end)),
        )
        if (!onPad) corner = { d, handle: { kind: 'corner', point: end, layer: item.layer } }
      }
    }
    if (corner) return corner.handle
    const index = trackAt(p, tolerance, layers)
    return index === null ? null : { kind: 'segment', item: index }
  }

  /** The dragged tracks at `param`, null past where a track would turn back. */
  function dragGeometry(state: DragState, param: number | Pt): DragResult | null {
    const h = state.handle
    return h.kind === 'segment'
      ? dragSegment(state.base, padInfoList.value, state.item, param as number)
      : dragCorner(state.base, h.point, h.layer, param as Pt)
  }

  /** A design-rule error on a moved track. */
  function dragViolation(state: DragState, result: DragResult): Violation | null {
    if (!state.strict) return null
    const changed = new Set(result.changed)
    const drc = runDrc(pads.value, result.items, rules.value)
    return drc.violations.find((v) => v.items.some((i) => changed.has(i))) ?? null
  }

  function startDrag(handle: DragHandle, at: Pt) {
    cancelRoute()
    selection.value = []
    let base = savedItems.value
    let item = -1
    if (handle.kind === 'segment') {
      // a straight line clicked together from several tracks drags as one
      const clean = cleanupTracks(base, padInfoList.value)
      base = clean.items
      item = clean.map[handle.item] ?? -1
      if (item < 0) return
    }
    const baseDrc = runDrc(pads.value, base, rules.value)
    const dragged =
      handle.kind === 'segment'
        ? [item]
        : endsAt(base, handle.point, handle.layer).map((e) => e.item)
    if (!dragged.length) return
    const state: DragState = {
      handle,
      base,
      item,
      grab: { ...at },
      nets: baseDrc.itemNets,
      net: baseDrc.itemNets[dragged[0]!] ?? null,
      param: handle.kind === 'segment' ? 0 : handle.point,
      result: { items: base, changed: [], item },
      violation: null,
      lastValid: { items: base, changed: [], item },
      strict: !baseDrc.violations.some((v) => v.items.some((i) => dragged.includes(i))),
    }
    state.result = state.lastValid = dragGeometry(state, state.param) ?? state.result
    drag.value = state
  }

  /**
   * Follows the cursor, across obstacles too (like KiCad's highlight-collisions
   * mode): errors show while passing, only the release position must be legal.
   * Stops only where a track would turn back on itself.
   */
  function moveDrag(at: Pt) {
    const state = drag.value
    if (!state) return
    const h = state.handle
    let target: number | Pt
    if (h.kind === 'segment') {
      const seg = state.base[state.item] as TrackSegment
      const n = segmentNormal(seg)
      const raw = (at.x - state.grab.x) * n.x + (at.y - state.grab.y) * n.y
      const infos = padInfoList.value
      const anchors: Pt[] = []
      for (const pad of infos) {
        if (pad.net && pad.net === state.net && pad.layers.includes(seg.layer))
          anchors.push({ x: pad.placed.pad.at.x, y: pad.placed.pad.at.y })
      }
      state.base.forEach((it, i) => {
        if (it.type === 'track' && i !== state.item && state.nets[i] === state.net)
          anchors.push(it.start, it.end)
      })
      // the segment's own ends would hold it where it is
      const own = (q: Pt) =>
        [seg.start, seg.end].some((e) => Math.abs(e.x - q.x) < 1e-7 && Math.abs(e.y - q.y) < 1e-7)
      target = snapSegmentOffset(
        seg,
        raw,
        anchors.filter((q) => !own(q)),
        editorSettings.value.grid,
        snapRadius.value,
      )
    } else {
      target = snapTarget(at, {
        pads: padInfoList.value,
        items: state.base,
        itemNets: state.nets,
        layer: h.layer,
        grid: editorSettings.value.grid,
        radius: snapRadius.value,
        net: state.net,
      }).point
    }

    let result = dragGeometry(state, target)
    let param = target
    if (!result) {
      // the furthest point before a track turns back, from the last preview
      const from = state.param
      const at_ = (t: number): number | Pt =>
        typeof from === 'number'
          ? from + ((target as number) - from) * t
          : {
              x: from.x + ((target as Pt).x - from.x) * t,
              y: from.y + ((target as Pt).y - from.y) * t,
            }
      let lo = 0
      let hi = 1
      for (let k = 0; k < 12; k++) {
        const mid = (lo + hi) / 2
        if (dragGeometry(state, at_(mid))) lo = mid
        else hi = mid
      }
      param = at_(lo)
      result = dragGeometry(state, param)
      if (!result) return
    }
    const violation = dragViolation(state, result)
    drag.value = {
      ...state,
      param,
      result,
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
    writeItems([...savedItems.value, ...segments(points, r.layer, r.width)])
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
    previewSegments,
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
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undo,
    redo,
    trackAt,
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
    flipPosture,
    cycleWidth,
    click,
    escape,
    reset,
  }
})
