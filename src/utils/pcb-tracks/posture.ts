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

export type Posture = '45' | '90'

/** Snaps a point to the grid (multiples of `grid` from the switch origin). */
export function snapToGrid(p: Vec, grid: number): Vec {
  if (grid <= 0) return { x: p.x, y: p.y }
  // round to 1 nm after snapping, so grid points are exact in the wire format
  const snap = (v: number) => Math.round(Math.round(v / grid) * grid * 1e6) / 1e6
  return { x: snap(p.x), y: snap(p.y) }
}

/**
 * Points of the walk from `start` to `end`: [start, corner?, end], without
 * zero-length segments. `start` and `end` are returned as the same objects,
 * so shared vertices stay identical.
 */
export function walk(start: Vec, end: Vec, posture: Posture, flip = false): Vec[] {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) return [start]
  let corner: Vec
  if (posture === '90') {
    corner = flip ? { x: start.x, y: end.y } : { x: end.x, y: start.y }
  } else {
    const m = Math.min(Math.abs(dx), Math.abs(dy))
    const diag = { x: Math.sign(dx) * m, y: Math.sign(dy) * m }
    // default: straight first, then the diagonal into the target (like KiCad)
    corner = flip
      ? { x: start.x + diag.x, y: start.y + diag.y }
      : { x: end.x - diag.x, y: end.y - diag.y }
  }
  // whole nanometres, like the wire format, without float noise
  corner = { x: Math.round(corner.x * 1e6) / 1e6, y: Math.round(corner.y * 1e6) / 1e6 }
  const same = (p: Vec, q: Vec) => Math.abs(p.x - q.x) < 1e-9 && Math.abs(p.y - q.y) < 1e-9
  if (same(corner, start) || same(corner, end)) return [start, end]
  return [start, corner, end]
}

/** True when segment a→b runs at a multiple of 45° (90° in 90° mode). */
export function isPostureAngle(a: Vec, b: Vec, posture: Posture): boolean {
  const dx = Math.abs(b.x - a.x)
  const dy = Math.abs(b.y - a.y)
  const eps = 1e-9
  if (dx < eps || dy < eps) return true
  return posture === '45' && Math.abs(dx - dy) < eps
}
