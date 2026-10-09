/**
 * Switch-diode track preset types.
 *
 * A preset is a switch-local track template that the PCB generator backend
 * (kbplacer) replicates to every switch-diode pair. Coordinates are relative to
 * the switch origin, with the switch at 0 degrees on the front side, +Y down.
 *
 * The editor works in mm (TrackPreset). The settings JSON and the backend use
 * kbplacer's JSON preset format (WireTrackPreset): integer nanometres and KiCad
 * IPC API (kipy) field names, see kicad-kbplacer's docs/switch-preset.schema.json.
 */

export type CopperLayer = 'F.Cu' | 'B.Cu'

/** Point in mm, switch-local, +Y down (KiCad). */
export interface Pt {
  x: number
  y: number
}

export interface TrackSegment {
  type: 'track'
  id?: string
  start: Pt
  end: Pt
  width: number
  layer: CopperLayer
}

/** Reserved: arcs are rejected until kbplacer supports them. */
export interface TrackArc {
  type: 'arc'
  id?: string
  start: Pt
  mid: Pt
  end: Pt
  width: number
  layer: CopperLayer
}

/** Through via (F.Cu to B.Cu). */
export interface TrackVia {
  type: 'via'
  id?: string
  position: Pt
  diameter: number
  drillDiameter: number
}

export type TrackItem = TrackSegment | TrackArc | TrackVia

export interface TrackPreset {
  version: 1
  items: TrackItem[]
  /** Free-form information about what the preset was made for, kept as is. */
  basis?: Record<string, unknown>
}

// Wire format (settings JSON `tracks` group and the backend `trackPreset` field)

export interface WireVector {
  x_nm: number
  y_nm: number
}

export interface WireTrack {
  type: 'track'
  start: WireVector
  end: WireVector
  width_nm: number
  layer: CopperLayer
}

export interface WireVia {
  type: 'via'
  position: WireVector
  diameter_nm: number
  drill_diameter_nm: number
}

export type WireTrackItem = WireTrack | WireVia

export interface WireTrackPreset {
  version: 1
  items: WireTrackItem[]
  basis?: Record<string, unknown>
}
