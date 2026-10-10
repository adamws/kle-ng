/**
 * KiCad-style route posture: the walk from the last committed point to the
 * cursor is at most two segments, one diagonal (45°) and one straight
 * (horizontal or vertical), or one horizontal and one vertical in 90° mode.
 * `flip` (the `/` key) swaps which of the two comes first.
 *
 * Everything is in the switch-local frame, so angles are relative to the
 * switch at 0°, which is what kbplacer replicates. The cursor is snapped to
 * the grid by the caller unless it snaps to a pad anchor (pads are exempt
 * from the grid), so the corner may be off-grid when a pad is involved.
 */
import type { Vec } from './distance'
import { buildInitialTrace } from './direction45'
import { FLOAT_EPS, roundNm, roundNmValue } from './units'

export type Posture = '45' | '90'

/** Snaps a point to the grid (multiples of `grid` from the switch origin). */
export function snapToGrid(p: Vec, grid: number): Vec {
  if (grid <= 0) return { x: p.x, y: p.y }
  // round to 1 nm after snapping, so grid points are exact in the wire format
  const snap = (v: number) => roundNmValue(Math.round(v / grid) * grid)
  return { x: snap(p.x), y: snap(p.y) }
}

/**
 * Points of the walk from `start` to `end`: [start, corner?, end], without
 * zero-length segments. `start` and `end` are returned as the same objects,
 * so shared vertices stay identical.
 */
export function walk(start: Vec, end: Vec, posture: Posture, flip = false): Vec[] {
  if (end.x === start.x && end.y === start.y) return [start]
  let corner: Vec
  if (posture === '90') {
    corner = flip ? { x: start.x, y: end.y } : { x: end.x, y: start.y }
  } else {
    // straight first, then the diagonal into the target (like KiCad); flipped: diagonal first
    const trace = buildInitialTrace(start, end, flip)
    if (trace.length === 2) return [start, end]
    corner = trace[1]!
  }
  // whole nanometres, like the wire format, without float noise
  corner = roundNm(corner)
  const same = (p: Vec, q: Vec) =>
    Math.abs(p.x - q.x) < FLOAT_EPS && Math.abs(p.y - q.y) < FLOAT_EPS
  if (same(corner, start) || same(corner, end)) return [start, end]
  return [start, corner, end]
}
