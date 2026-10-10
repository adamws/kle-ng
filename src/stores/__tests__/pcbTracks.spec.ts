/**
 * Track editor state machine over the real MX + SOD-123F pads at the kle-ng
 * default diode placement (5.08 4 90 BACK).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { usePcbTracksStore } from '../pcbTracks'
import { usePcbGeneratorStore } from '../pcbGenerator'
import { placePads, type FootprintPads } from '@/utils/kicad/footprint-pads'
import type { PlacedPad } from '@/utils/pcb-tracks/netlist'
import type { TrackSegment } from '@/types/tracks'

const PADS_DIR = resolve(__dirname, '../../../public/data/footprints/pads')
const load = (name: string): FootprintPads =>
  JSON.parse(readFileSync(resolve(PADS_DIR, `${name}.json`), 'utf8'))

function defaultPads(): PlacedPad[] {
  const sw = placePads(load('SW_Cherry_MX_PCB_1.00u').pads, {
    x: 0,
    y: 0,
    rotation: 0,
    side: 'FRONT',
  })
  const d = placePads(load('D_SOD-123F').pads, { x: 5.08, y: 4, rotation: 90, side: 'BACK' })
  return [
    ...sw.map((pad, i) => ({ key: `SW:${i}`, owner: 'SW', pad })),
    ...d.map((pad, i) => ({ key: `D:${i}`, owner: 'D', pad })),
  ]
}

const SW2 = { x: 2.54, y: -5.08 }
const D2 = { x: 5.08, y: 2.6 }
const D1 = { x: 5.08, y: 5.4 }

describe('pcbTracks store', () => {
  let tracks: ReturnType<typeof usePcbTracksStore>
  let pcb: ReturnType<typeof usePcbGeneratorStore>

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    pcb = usePcbGeneratorStore()
    tracks = usePcbTracksStore()
    tracks.setPads(defaultPads())
    tracks.snapRadius = 0.3
  })

  const items = () => (pcb.settings.trackPreset?.items ?? []) as TrackSegment[]

  it('routes SW pad 2 to D pad 2 into the default preset and clears the ratsnest', () => {
    expect(tracks.drc.ratsnest).toHaveLength(1)

    tracks.setTool('route')
    tracks.setCursor({ x: 2.6, y: -5 }) // inside SW pad 2: snaps to its centre
    expect(tracks.target).toMatchObject({ kind: 'pad', net: 'SW_D', point: SW2 })
    tracks.click(null)
    expect(tracks.route?.net).toBe('SW_D')
    expect(tracks.highlightNet).toBe('SW_D')

    tracks.setCursor({ x: 5.0, y: 2.5 })
    expect(tracks.target).toMatchObject({ kind: 'pad', point: D2 })
    expect(tracks.previewViolations).toEqual([])
    tracks.click(null)

    // finished on the target pad
    expect(tracks.isRouting).toBe(false)
    expect(items().map((t) => [t.start, t.end, t.layer, t.width])).toEqual([
      [SW2, { x: 2.54, y: 0.06 }, 'B.Cu', 0.25],
      [{ x: 2.54, y: 0.06 }, D2, 'B.Cu', 0.25],
    ])
    // shared vertex is one point
    expect(items()[0]!.end).toEqual(items()[1]!.start)
    expect(tracks.drc.ratsnest).toEqual([])
    expect(tracks.drc.violations).toEqual([])
  })

  it('snaps the cursor to the grid away from anchors', () => {
    tracks.setTool('route')
    tracks.setCursor({ x: 1.13, y: 1.38 })
    expect(tracks.target).toEqual({ kind: 'grid', point: { x: 1.25, y: 1.5 } })
  })

  it('does not snap to pads of another net while routing', () => {
    tracks.setTool('route')
    tracks.setCursor(SW2)
    tracks.click(null)
    tracks.setCursor(D1) // the cathode (ROW)
    expect(tracks.target?.kind).toBe('grid')
  })

  it('blocks a commit that breaks a rule', () => {
    tracks.setTool('route')
    tracks.setCursor(SW2)
    tracks.click(null)
    tracks.setCursor({ x: 5, y: 0 }) // the side hole at 5.08, 0
    expect(tracks.previewViolations.map((v) => v.kind)).toContain('hole-clearance')
    const before = tracks.route!.points.length
    tracks.click(null)
    expect(tracks.route!.points).toHaveLength(before)
    expect(tracks.blockedCount).toBe(1)
  })

  it('blocks routing onto a pad of another net (short)', () => {
    tracks.setTool('route')
    tracks.setCursor(SW2)
    tracks.click(null)
    // grid point inside the cathode
    tracks.setCursor({ x: 5, y: 5.5 })
    expect(tracks.previewViolations.map((v) => v.kind)).toContain('short')
  })

  it('adds corners, undoes them, flips the posture and cancels', () => {
    tracks.setTool('route')
    tracks.setCursor(SW2)
    tracks.click(null)
    tracks.setCursor({ x: 0.5, y: -3 })
    const straightFirst = tracks.previewPoints.map((p) => ({ ...p }))
    tracks.flipPosture()
    expect(tracks.previewPoints).not.toEqual(straightFirst)
    tracks.click(null)
    expect(tracks.route!.points.length).toBe(3)
    tracks.undoVertex()
    expect(tracks.route!.points.length).toBe(2)
    tracks.escape()
    expect(tracks.isRouting).toBe(false)
    expect(pcb.settings.trackPreset).toBeUndefined()
  })

  it('finishes with End at the last corner and orders items outward from a pad', () => {
    tracks.setTool('route')
    // start on a grid point, end on SW pad 2
    tracks.setCursor({ x: 2.5, y: -2 })
    tracks.click(null)
    expect(tracks.route?.net).toBeNull()
    tracks.setCursor(SW2)
    tracks.click(null) // reaches the pad: finishes
    const segs = items()
    expect(segs[0]!.start).toEqual(SW2)
    expect(segs[segs.length - 1]!.end).toEqual({ x: 2.5, y: -2 })
  })

  it('continues from a track end of the same net', () => {
    tracks.setTool('route')
    tracks.setCursor(SW2)
    tracks.click(null)
    tracks.setCursor({ x: 2.5, y: -2 })
    tracks.click(null)
    tracks.finish()
    expect(items()).toHaveLength(2)

    tracks.setCursor({ x: 2.48, y: -1.98 }) // the corner at 2.54, -2.04 is close too
    expect(tracks.target).toMatchObject({
      kind: 'track-end',
      net: 'SW_D',
      point: { x: 2.5, y: -2 },
    })
    tracks.click(null)
    tracks.setCursor(D2)
    tracks.click(null)
    expect(tracks.drc.ratsnest).toEqual([])
  })

  it('merges collinear clicks into one track when finishing', () => {
    tracks.setTool('route')
    for (const y of [3, 4, 5]) {
      tracks.setCursor({ x: 1, y })
      tracks.click(null)
    }
    tracks.finish()
    expect(items().map((t) => [t.start, t.end])).toEqual([
      [
        { x: 1, y: 3 },
        { x: 1, y: 5 },
      ],
    ])
  })

  it('cycles width presets with W', () => {
    tracks.cycleWidth(1)
    expect(tracks.editorSettings.width).toBe(0.3)
    tracks.cycleWidth(-1)
    tracks.cycleWidth(-1)
    expect(tracks.editorSettings.width).toBe(0.2)
  })

  it('highlights a clicked pad net in the select tool, Esc clears it', () => {
    tracks.click('ROW')
    expect(tracks.highlightNet).toBe('ROW')
    tracks.escape()
    expect(tracks.highlightNet).toBeNull()
  })
})

describe('pcbTracks selection and history', () => {
  let tracks: ReturnType<typeof usePcbTracksStore>
  let pcb: ReturnType<typeof usePcbGeneratorStore>

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    pcb = usePcbGeneratorStore()
    tracks = usePcbTracksStore()
    tracks.setPads(defaultPads())
    tracks.snapRadius = 0.3
  })

  const items = () => (pcb.settings.trackPreset?.items ?? []) as TrackSegment[]

  /** Routes SW pad 2 to D pad 2 (the default preset, 2 tracks). */
  function routeDefault() {
    tracks.setTool('route')
    tracks.setCursor(SW2)
    tracks.click(null)
    tracks.setCursor(D2)
    tracks.click(null)
    tracks.setTool('select')
  }

  it('places a via and continues the route on the other layer', async () => {
    tracks.editorSettings.grid = 0.02 // the via lands in line with D pad 2
    tracks.setTool('route')
    tracks.setCursor(D2) // B.Cu diode pad
    tracks.click(null)
    tracks.setCursor({ x: 3.5, y: 2.6 })
    expect(tracks.placeVia()).toBe(true)
    expect(tracks.route?.layer).toBe('F.Cu')
    expect(tracks.editorSettings.layer).toBe('F.Cu')
    expect(tracks.routeVias.map((v) => v.position)).toEqual([{ x: 3.5, y: 2.6 }])

    // Backspace takes the via back first, then the corner
    tracks.undoVertex()
    expect(tracks.route?.layer).toBe('B.Cu')
    expect(tracks.routeVias).toEqual([])
    expect(tracks.placeVia()).toBe(true)

    tracks.setCursor(SW2) // through-hole, on F.Cu too: finishes the route
    tracks.click(null)
    expect(tracks.isRouting).toBe(false)
    const preset = pcb.settings.trackPreset!.items
    expect(preset.map((i) => (i.type === 'track' ? i.layer : i.type))).toEqual([
      'B.Cu',
      'via',
      'F.Cu',
      'F.Cu',
    ])
    expect(preset[0]).toMatchObject({ start: D2, end: { x: 3.5, y: 2.6 } })
    expect(preset[1]).toMatchObject({ position: { x: 3.5, y: 2.6 }, diameter: 0.6 })
    expect(preset[2]).toMatchObject({ start: { x: 3.5, y: 2.6 } })
    expect(preset[3]).toMatchObject({ end: SW2 })
    expect(tracks.drc.violations).toEqual([])
    expect(tracks.drc.ratsnest).toEqual([])

    // one undo step removes the whole route
    tracks.undo()
    expect(pcb.settings.trackPreset?.items).toEqual([])
    await nextTick()
  })

  it('places a via at the last corner from the toolbar, with no cursor on the canvas', () => {
    tracks.editorSettings.grid = 0.02
    tracks.setTool('route')
    tracks.setCursor(D2)
    tracks.click(null)
    // at the start pad: refused
    tracks.setCursor(null)
    expect(tracks.placeVia({ atLastCorner: true })).toBe(false)

    tracks.setCursor({ x: 3.5, y: 2.6 })
    tracks.click(null)
    tracks.setCursor(null) // the pointer went to the toolbar
    expect(tracks.placeVia({ atLastCorner: true })).toBe(true)
    expect(tracks.routeVias.map((v) => v.position)).toEqual([{ x: 3.5, y: 2.6 }])
    expect(tracks.route?.points).toHaveLength(2)
    expect(tracks.route?.layer).toBe('F.Cu')
    // a second click puts no second via there
    expect(tracks.placeVia({ atLastCorner: true })).toBe(false)
  })

  it('refuses a via on a hole or a pad', () => {
    tracks.setTool('route')
    tracks.setCursor(D2)
    tracks.click(null)
    tracks.setCursor({ x: 5.08, y: 0 }) // the side NPTH
    const blocked = tracks.blockedCount
    expect(tracks.placeVia()).toBe(false)
    expect(tracks.blockedCount).toBe(blocked + 1)
    expect(tracks.route?.layer).toBe('B.Cu')
    expect(tracks.route?.points).toHaveLength(1)

    tracks.setCursor(SW2)
    expect(tracks.target?.kind).toBe('pad')
    expect(tracks.placeVia()).toBe(false)
  })

  it('picks vias and selects them with the tracks they join', () => {
    pcb.settings.trackPreset = {
      version: 1,
      items: [
        { type: 'track', start: D2, end: { x: 3.5, y: 2.6 }, width: 0.25, layer: 'B.Cu' },
        { type: 'via', position: { x: 3.5, y: 2.6 }, diameter: 0.6, drillDiameter: 0.3 },
      ],
    }
    expect(tracks.itemAt({ x: 3.6, y: 2.6 }, 0.05, ['B.Cu'])).toBe(1)
    expect(tracks.itemAt({ x: 4.5, y: 2.6 }, 0.05, ['B.Cu'])).toBe(0)
    expect(tracks.itemAt({ x: 3.6, y: 2.6 }, 0.05, [])).toBeNull()
    tracks.selectClick(1, null, false)
    tracks.selectConnected()
    expect(tracks.selection).toEqual([0, 1])
    tracks.deleteSelection()
    expect(pcb.settings.trackPreset?.items).toEqual([])
  })

  /** D pad 2 → B.Cu → via → F.Cu → SW pad 2, what the editor draws with V. */
  async function viaPreset() {
    const via = { x: 3.5, y: 2.6 }
    const corner = { x: 3.5, y: -4.12 }
    pcb.settings.trackPreset = {
      version: 1,
      items: [
        { type: 'track', start: D2, end: via, width: 0.25, layer: 'B.Cu' },
        { type: 'via', position: via, diameter: 0.6, drillDiameter: 0.3 },
        { type: 'track', start: via, end: corner, width: 0.25, layer: 'F.Cu' },
        { type: 'track', start: corner, end: SW2, width: 0.25, layer: 'F.Cu' },
      ],
    }
    await nextTick() // the history starts from the outside write
  }
  const presetVia = () => pcb.settings.trackPreset!.items.find((i) => i.type === 'via')!
  const endsOnVia = () => {
    const at = (presetVia() as { position: { x: number; y: number } }).position
    return pcb.settings.trackPreset!.items.filter(
      (i) =>
        i.type === 'track' &&
        ((i.start.x === at.x && i.start.y === at.y) || (i.end.x === at.x && i.end.y === at.y)),
    ).length
  }

  it('drags a via with the tracks ending on it, as one undo step', async () => {
    await viaPreset()
    tracks.editorSettings.grid = 0.02
    const handle = tracks.dragHandleAt({ x: 3.6, y: 2.6 }, 0.05, ['B.Cu'])
    expect(handle).toEqual({ kind: 'via', item: 1 })
    tracks.startDrag(handle!, { x: 3.5, y: 2.6 })
    tracks.moveDrag({ x: 3.5, y: 2.0 })
    expect(tracks.dragViolation).toBeNull()
    tracks.endDrag()

    expect(presetVia()).toMatchObject({ position: { x: 3.5, y: 2 } })
    expect(endsOnVia()).toBe(2) // one B.Cu and one F.Cu track still meet it
    expect(tracks.drc.violations).toEqual([])
    expect(tracks.drc.ratsnest).toEqual([])
    // the B.Cu side is rebuilt at 45° from the diode pad
    const back = pcb.settings.trackPreset!.items.filter(
      (i) => i.type === 'track' && i.layer === 'B.Cu',
    ) as TrackSegment[]
    for (const t of back) {
      const dx = Math.abs(t.end.x - t.start.x)
      const dy = Math.abs(t.end.y - t.start.y)
      expect(dx < 1e-9 || dy < 1e-9 || Math.abs(dx - dy) < 1e-6).toBe(true)
    }

    tracks.undo()
    expect(presetVia()).toMatchObject({ position: { x: 3.5, y: 2.6 } })
  })

  it('drops a dragged via back at its last legal place, over a hole', async () => {
    await viaPreset()
    tracks.startDrag({ kind: 'via', item: 1 }, { x: 3.5, y: 2.6 })
    tracks.moveDrag({ x: 3.5, y: 2.0 })
    tracks.moveDrag({ x: 5.08, y: 0 }) // the side NPTH
    expect(tracks.dragViolation).not.toBeNull()
    tracks.endDrag()
    expect(presetVia()).toMatchObject({ position: { x: 3.5, y: 2 } })
  })

  it('changes the size of selected vias, which new vias then use', async () => {
    await viaPreset()
    tracks.selectItems([0, 1], false)
    tracks.updateSelection({ diameter: 0.8, drillDiameter: 0.4 })
    expect(presetVia()).toMatchObject({ diameter: 0.8, drillDiameter: 0.4 })
    expect(items()[0]!.width).toBe(0.25) // tracks keep their width
    expect(tracks.editorSettings.via).toEqual({ diameter: 0.8, drillDiameter: 0.4 })

    tracks.updateSelection({ drillDiameter: 0.7 })
    expect(tracks.drc.violations.map((v) => v.kind)).toContain('via-size')
  })

  it('tells pads waiting for their first track', () => {
    const key = (owner: string, number: string) =>
      tracks.pads.find((p) => p.owner === owner && p.pad.number === number)!.key
    // SW pad 2 and D pad 2 (SW_D) are unrouted; SW pad 1 (COL) has nothing to reach
    expect(tracks.isUnconnectedPad(key('SW', '2'))).toBe(true)
    expect(tracks.isUnconnectedPad(key('D', '2'))).toBe(true)
    expect(tracks.isUnconnectedPad(key('SW', '1'))).toBe(false)

    // a track from SW pad 2 halfway: SW pad 2 has its track, D pad 2 still waits
    tracks.setTool('route')
    tracks.setCursor(SW2)
    tracks.click(null)
    tracks.setCursor({ x: 2.5, y: -2 })
    tracks.click(null)
    tracks.finish()
    expect(tracks.isUnconnectedPad(key('SW', '2'))).toBe(false)
    expect(tracks.isUnconnectedPad(key('D', '2'))).toBe(true)
  })

  it('picks the track under the cursor on visible layers', () => {
    routeDefault()
    expect(tracks.trackAt({ x: 2.6, y: -2 }, 0.05, ['B.Cu'])).toBe(0)
    expect(tracks.trackAt({ x: 4, y: 1.5 }, 0.05, ['B.Cu'])).toBe(1)
    expect(tracks.trackAt({ x: 2.6, y: -2 }, 0.05, ['F.Cu'])).toBeNull()
    expect(tracks.trackAt({ x: 0, y: 0 }, 0.05, ['B.Cu'])).toBeNull()
  })

  it('selects, toggles with Shift, extends to connected tracks and clears with Esc', () => {
    routeDefault()
    tracks.selectClick(0, null, false)
    expect(tracks.selection).toEqual([0])
    tracks.selectClick(1, null, true)
    expect(tracks.selection).toEqual([0, 1])
    tracks.selectClick(0, null, true)
    expect(tracks.selection).toEqual([1])
    tracks.selectConnected()
    expect(tracks.selection).toEqual([0, 1])
    tracks.escape()
    expect(tracks.selection).toEqual([])
    // clicking empty space clears it too
    tracks.selectClick(0, null, false)
    tracks.selectClick(null, null, false)
    expect(tracks.selection).toEqual([])
  })

  it('changes width and layer of the selection, keeping it selected', () => {
    routeDefault()
    tracks.selectItems([1], false)
    tracks.updateSelection({ width: 0.4 })
    tracks.updateSelection({ layer: 'F.Cu' })
    expect(items().map((t) => [t.width, t.layer])).toEqual([
      [0.25, 'B.Cu'],
      [0.4, 'F.Cu'],
    ])
    expect(tracks.selection).toEqual([1])
  })

  it('deletes, undoes and redoes', async () => {
    routeDefault()
    expect(tracks.canUndo).toBe(true)
    tracks.selectItems([0], false)
    tracks.deleteSelection()
    expect(items()).toHaveLength(1)
    expect(tracks.selection).toEqual([])

    tracks.undo()
    expect(items()).toHaveLength(2)
    tracks.undo()
    // an emptied preset stays: it keeps the preset routing mode
    expect(pcb.settings.trackPreset?.items).toEqual([])
    expect(tracks.canUndo).toBe(false)

    tracks.redo()
    tracks.redo()
    expect(items()).toHaveLength(1)
    expect(tracks.canRedo).toBe(false)
  })

  it('starts a new history when the preset is replaced from outside', async () => {
    routeDefault()
    pcb.settings.trackPreset = { version: 1, items: [] }
    await nextTick()
    expect(tracks.canUndo).toBe(false)
    // own writes keep the history
    routeDefault()
    await nextTick()
    expect(tracks.canUndo).toBe(true)
  })

  it('caps the history', () => {
    for (let i = 0; i < 110; i++) {
      routeDefault()
      tracks.selectItems([0, 1], false)
      tracks.deleteSelection()
    }
    let undos = 0
    while (tracks.canUndo) {
      tracks.undo()
      undos++
    }
    expect(undos).toBe(99)
  })

  it('records the basis and offers to keep or clear a stale preset', () => {
    routeDefault()
    expect(pcb.settings.trackPreset?.basis).toMatchObject({
      switchFootprint: pcb.settings.switchFootprint,
      diodePositionY: 4,
    })
    expect(tracks.staleChanges).toEqual([])

    pcb.settings.diodePositionY = 5
    expect(tracks.staleChanges.map((c) => c.label)).toEqual(['diode position'])
    tracks.keepPreset()
    expect(tracks.staleChanges).toEqual([])
    expect(items()).toHaveLength(2)
    expect(tracks.canUndo).toBe(true)

    pcb.settings.diodeSide = 'FRONT'
    expect(tracks.staleChanges).toHaveLength(1)
    tracks.clearAll()
    expect(pcb.settings.trackPreset?.items).toEqual([])
    expect(tracks.staleChanges).toEqual([])
    tracks.undo()
    expect(items()).toHaveLength(2)
  })

  it('switches routing modes: a preset mode starts an empty preset, others remove it', async () => {
    pcb.settings.routing = 'Full'
    tracks.setRoutingMode('Switch-Diode only (preset)')
    expect(pcb.settings.routing).toBe('Switch-Diode only')
    expect(pcb.settings.trackPreset?.items).toEqual([])
    expect(tracks.canUndo).toBe(false)

    routeDefault()
    tracks.setRoutingMode('Full (preset)')
    expect(pcb.settings.routing).toBe('Full')
    expect(items()).toHaveLength(2)

    tracks.setRoutingMode('Full')
    expect(pcb.settings.trackPreset).toBeUndefined()
    await nextTick()
    expect(tracks.canUndo).toBe(false)
  })

  it('clearing starts a new history', async () => {
    routeDefault()
    tracks.clearPreset()
    await nextTick()
    expect(tracks.canUndo).toBe(false)
  })

  it('grabs corners away from pads, segments elsewhere', () => {
    routeDefault()
    const layers = ['B.Cu'] as const
    expect(tracks.dragHandleAt({ x: 2.56, y: 0.05 }, 0.1, layers)).toMatchObject({
      kind: 'corner',
      point: { x: 2.54, y: 0.06 },
    })
    // the end on SW pad 2 drags its segment
    expect(tracks.dragHandleAt(SW2, 0.1, layers)).toEqual({ kind: 'segment', item: 0 })
    expect(tracks.dragHandleAt({ x: 2.54, y: -2 }, 0.1, layers)).toEqual({
      kind: 'segment',
      item: 0,
    })
    expect(tracks.dragHandleAt({ x: 0, y: 3 }, 0.1, layers)).toBeNull()
  })

  it('drags a segment across obstacles, releasing only where legal, as one undo step', () => {
    routeDefault()
    const vertical = () =>
      tracks.presetItems.find(
        (t) => t.type === 'track' && t.start.x === t.end.x && t.start.y < 0,
      ) as TrackSegment
    tracks.startDrag({ kind: 'segment', item: 0 }, { x: 2.54, y: -2 })
    expect(tracks.isDragging).toBe(true)
    tracks.moveDrag({ x: 3.5, y: -2 })
    expect(vertical().start.x).toBe(3.5)
    expect(tracks.dragViolation).toBeNull()
    // the preview follows into the right side hole's clearance, flagged
    tracks.moveDrag({ x: 4, y: -2 })
    expect(vertical().start.x).toBe(4)
    expect(tracks.dragViolation?.kind).toBe('hole-clearance')
    expect(tracks.drc.violations).not.toEqual([])
    // the end on the pad stays, joined by a 45° track
    expect(tracks.presetItems[0]).toMatchObject({ start: SW2 })

    // released there: back to the last legal position
    tracks.endDrag()
    expect(tracks.isDragging).toBe(false)
    expect(items()).toHaveLength(3)
    expect(items().find((t) => t.start.x === t.end.x && t.start.y < 0)!.start.x).toBe(3.5)
    expect(tracks.drc.violations).toEqual([])
    expect(tracks.drc.ratsnest).toEqual([])
    tracks.undo()
    expect(items()).toHaveLength(2)
  })

  it('passes a corner over an obstacle to a legal spot beyond it', () => {
    routeDefault()
    const corner = { x: 2.54, y: 0.06 }
    tracks.startDrag({ kind: 'corner', point: corner, layer: 'B.Cu' }, corner)
    tracks.moveDrag({ x: 1.5, y: 0.5 }) // in the centre hole
    expect(tracks.dragViolation).not.toBeNull()
    tracks.moveDrag({ x: 3, y: 1 })
    expect(tracks.dragViolation).toBeNull()
    tracks.endDrag()
    // the corner is at the cursor, joined at 45° on both sides
    expect(items().some((t) => t.end.x === 3 && t.end.y === 1)).toBe(true)
    expect(tracks.drc.violations).toEqual([])
    expect(tracks.drc.ratsnest).toEqual([])
  })

  it('cancels a drag with Esc', () => {
    routeDefault()
    tracks.startDrag(
      { kind: 'corner', point: { x: 2.54, y: 0.06 }, layer: 'B.Cu' },
      {
        x: 2.54,
        y: 0.06,
      },
    )
    tracks.moveDrag({ x: 3, y: 1 })
    expect(items()[0]!.end).toEqual({ x: 2.54, y: 0.06 })
    expect(tracks.presetItems).toHaveLength(4)
    tracks.escape()
    expect(tracks.isDragging).toBe(false)
    expect((tracks.presetItems[0] as TrackSegment).end).toEqual({ x: 2.54, y: 0.06 })
    expect(tracks.canUndo).toBe(true)
  })
})
