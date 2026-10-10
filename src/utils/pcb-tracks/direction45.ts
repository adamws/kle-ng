/**
 * KiCad's DIRECTION_45 (libs/kimath/include/geometry/direction45.h): the
 * eight track directions, the angle class between two of them, and the
 * mitered 45° two-segment trace between two points (BuildInitialTrace).
 *
 * Directions count clockwise on screen (+Y down) from north, like KiCad's
 * enum: 0 N, 1 NE, 2 E, 3 SE, 4 S, 5 SW, 6 W, 7 NW.
 */
import type { Vec } from './distance'
import { FLOAT_EPS } from './units'

export type Dir = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

const VECTORS: readonly Vec[] = [
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
]

/** Direction of a vector rounded to 45°, null for a zero vector (KiCad's UNDEFINED). */
export function dirOf(v: Vec): Dir | null {
  if (Math.hypot(v.x, v.y) < FLOAT_EPS) return null
  // angle clockwise from north, in 45° steps
  const a = Math.atan2(v.x, -v.y)
  return ((Math.round(a / (Math.PI / 4)) + 8) % 8) as Dir
}

export const dirBetween = (a: Vec, b: Vec): Dir | null => dirOf({ x: b.x - a.x, y: b.y - a.y })

/** Unnormalised direction vector (diagonals are (±1, ±1)), like KiCad's ToVector. */
export const dirVector = (d: Dir): Vec => VECTORS[d]!

/** 45° counter-clockwise on screen. */
export const left = (d: Dir): Dir => ((d + 7) % 8) as Dir
/** 45° clockwise on screen. */
export const right = (d: Dir): Dir => ((d + 1) % 8) as Dir

export const isDiagonal = (d: Dir) => d % 2 === 1

export type AngleType = 'obtuse' | 'right' | 'acute' | 'straight' | 'half-full' | 'undefined'

/** The corner two directions make: a 45° turn is obtuse, 90° right, 135° acute. */
export function angle(a: Dir | null, b: Dir | null): AngleType {
  if (a === null || b === null) return 'undefined'
  const d = Math.abs(a - b)
  if (d === 1 || d === 7) return 'obtuse'
  if (d === 2 || d === 6) return 'right'
  if (d === 3 || d === 5) return 'acute'
  if (d === 4) return 'half-full'
  return 'straight'
}

/**
 * Mitered 45° trace from `p0` to `p1`: [p0, p1] when they line up on a 45°
 * multiple, else [p0, corner, p1] starting straight, or diagonal when
 * `startDiagonal`. KiCad passes the direction of the segment it continues;
 * its diagonality decides the start.
 */
export function buildInitialTrace(p0: Vec, p1: Vec, startDiagonal: boolean): Vec[] {
  const w = Math.abs(p1.x - p0.x)
  const h = Math.abs(p1.y - p0.y)
  const sw = Math.sign(p1.x - p0.x)
  const sh = Math.sign(p1.y - p0.y)
  if (w < FLOAT_EPS || h < FLOAT_EPS || Math.abs(w - h) < FLOAT_EPS) return [p0, p1]
  const straight = w > h ? { x: (w - h) * sw, y: 0 } : { x: 0, y: sh * (h - w) }
  const diagonal = w > h ? { x: h * sw, y: h * sh } : { x: sw * w, y: sh * w }
  const m = startDiagonal ? diagonal : straight
  return [p0, { x: p0.x + m.x, y: p0.y + m.y }, p1]
}
