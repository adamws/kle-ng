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
    expect(pcb.settings.trackPreset).toBeUndefined()
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
})
