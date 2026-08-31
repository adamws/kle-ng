/**
 * Curve Layout — placing a block of keys on a spine
 *
 * Bending a block of keys around a curve has one hard constraint (no two key bodies may
 * overlap) and one soft one (the result should stay as tight as the source layout).
 *
 * The naive approach — map each key centre to `P(s) + N(s)·d` and call it done — fails the hard
 * constraint. Distances along an offset curve scale by `(1 - κ(s)·d)`, so every row on the
 * concave side is compressed, and once `|κ·d| ≥ 1` the mapping folds. Keys end up inside each
 * other.
 *
 * Treating each column as a rigid body and sliding it along the spine until it clears its
 * neighbour fixes the overlaps but ruins the layout: two full-height columns at different
 * tangent angles need far more room than the geometry actually requires, and the result is a
 * fan of wedge-shaped voids.
 *
 * What this module does instead is **stretch the along-curve coordinate by exactly the
 * compression factor**. Walking the block from one end, the spacing advances by
 *
 *     dσ/da = 1 / min over the block's normal extent of (1 - κ(σ)·d)
 *
 * so the single most-compressed row comes out at exactly its original pitch and every other row
 * is looser by the amount the curve's geometry demands — no more. Keys sharing an
 * along-coordinate share a σ, so columns stay straight and keep one rotation origin. A straight
 * spine has zero curvature everywhere, making the map the identity.
 *
 * The stretch is derived from the block's extreme offsets, which bounds but does not perfectly
 * predict corner-to-corner clearance, so the result is verified and the stretch nudged up until
 * it is genuinely clean. That keeps the guarantee without paying for it everywhere.
 *
 * @module curve-layout/pack
 */

import type { Key } from '@adamws/kle-serial'
import { getKeyCenter } from '../keyboard-geometry'
import { orientedBoxesOverlap, type OrientedBox } from '../geometry'
import {
  buildArcLengthTable,
  computeBlockFrame,
  curvatureAt,
  pointAtDistance,
  projectOntoFrame,
  tAtDistance,
  tangentAtDistance,
  type ArcLengthTable,
  type BlockFrame,
  type CurveSpine,
} from './spine'

export interface CurveLayoutOptions {
  /**
   * Extra breathing room to add *along* the curve, in layout units.
   *
   * Only along-curve spacing is the tool's to change — a key's distance from the spine is its
   * own, and is carried through untouched, so a gap cannot be inserted between rows.
   */
  gap: number
  /** Rotate keys to follow the spine tangent. When false, keys keep their original heading. */
  followCurve: boolean
  /**
   * Place keys at the curve's geometric minimum spacing and accept whatever overlaps result.
   *
   * Off by default. It exists because the no-overlap guarantee is unreachable for most ordinary
   * keyboards: a 6.25u spacebar or a 2.75u shift is a long rigid bar, and once the rows around it
   * curve away it fouls them no matter how far apart things are spread along the curve. Without
   * this the tool would refuse every staggered layout, at every bend.
   *
   * When set, the safety stretch is skipped entirely rather than merely tolerated — spreading the
   * layout out by 80% and still overlapping is the worst of both outcomes.
   */
  allowOverlaps: boolean
}

/** Geometry to write back onto a key. All values are in layout units / degrees. */
export interface KeyPlacement {
  key: Key
  x: number
  y: number
  rotation_x: number
  rotation_y: number
  rotation_angle: number
}

export interface CurveLayoutResult {
  placements: KeyPlacement[]
  /** Number of distinct positions along the spine — effectively the column count. */
  columnCount: number
  /** How much the layout had to be stretched beyond the geometric minimum, as a fraction. */
  stretch: number
  /** Pairs of keys that overlap and did not overlap in the source. */
  overlapCount: number
  /**
   * True when the layout introduces no overlap that the source did not already have.
   *
   * The tool never moves a key off its own normal, so two keys that overlap in the source keep
   * overlapping however the curve is shaped — decals and deliberately stacked keys are common
   * enough that refusing to run on them would be worse than useless. What is guaranteed is that
   * bending the block creates no *new* collision.
   */
  collisionFree: boolean
}

/** Integration step for the stretch map, in layout units along the block axis. */
const STEP = 0.02
/**
 * Floor on the compression factor. Below this the offset curve is folding — the curve is
 * tighter than the block is deep — and no reparameterization can save it. Clamping keeps the
 * output finite so the tool can report the problem instead of producing NaNs.
 */
const MIN_JACOBIAN = 0.05
/** Extra stretch added per attempt when verification still finds an overlap. */
const STRETCH_INCREMENT = 0.02
const MAX_STRETCH_ATTEMPTS = 40
const EPSILON = 1e-9
/**
 * Contact tolerance for the overlap test, in layout units (about 2e-8 mm). `orientedBoxesOverlap`
 * defaults to zero, which is right for the collision warnings but not here: without a tolerance,
 * two keys placed exactly one unit apart sit on the knife edge of the comparison and round
 * randomly to either answer, making an untouched layout appear to collide with itself.
 */
const CONTACT_TOLERANCE = 1e-9

/**
 * Round an emitted coordinate to six decimals, collapsing negative zero.
 *
 * Rounding happens here rather than in the caller so that the collision check runs on exactly
 * the numbers that reach the keys. Verifying full-precision geometry and then rounding it can
 * turn a flush pair into a sub-micron overlap and make a perfectly good layout report as
 * impossible. Plain arithmetic rather than `D`: this runs for every key on every solver pass,
 * and six decimals of a layout unit is a thousandth of a millimetre either way.
 */
const round = (value: number): number => {
  const rounded = Math.round(value * 1e6) / 1e6
  return rounded === 0 ? 0 : rounded
}

/** One collision box in a key's local frame, relative to the key centre. */
interface LocalBox {
  along: number
  offset: number
  halfWidth: number
  halfHeight: number
  /** Box heading relative to the block axis. */
  angle: number
}

interface SourceKey {
  key: Key
  /** Distance along the block axis, from the block frame origin. */
  along: number
  /** Signed distance along the block normal. */
  offset: number
  /** Key heading relative to the block axis. */
  bodyAngle: number
  boxes: LocalBox[]
}

/**
 * Describe a key as one or two boxes in its own local frame.
 *
 * Most keys are a single rectangle. Stepped keys and ISO enters carry a second rectangle
 * (`x2`/`y2`/`width2`/`height2`); including it matters, because a guarantee that only covers
 * half of an ISO enter is not a guarantee.
 */
function localBoxesFor(key: Key, bodyAngle: number): LocalBox[] {
  const width = key.width || 1
  const height = key.height || 1
  const boxes: LocalBox[] = [
    { along: 0, offset: 0, halfWidth: width / 2, halfHeight: height / 2, angle: bodyAngle },
  ]

  const width2 = key.width2 || width
  const height2 = key.height2 || height
  const x2 = key.x2 || 0
  const y2 = key.y2 || 0

  const isDistinct =
    Math.abs(x2) > EPSILON ||
    Math.abs(y2) > EPSILON ||
    Math.abs(width2 - width) > EPSILON ||
    Math.abs(height2 - height) > EPSILON

  if (isDistinct) {
    // Offset of the secondary rectangle's centre from the key centre, before rotation.
    const rawAlong = x2 + width2 / 2 - width / 2
    const rawOffset = y2 + height2 / 2 - height / 2
    const radians = (bodyAngle * Math.PI) / 180
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    boxes.push({
      along: rawAlong * cos - rawOffset * sin,
      offset: rawAlong * sin + rawOffset * cos,
      halfWidth: width2 / 2,
      halfHeight: height2 / 2,
      angle: bodyAngle,
    })
  }

  return boxes
}

/** Measure every key against the block frame. */
function describeKeys(keys: Key[], frame: BlockFrame): SourceKey[] {
  return keys.map((key) => {
    const { along, offset } = projectOntoFrame(frame, getKeyCenter(key))
    const bodyAngle = (key.rotation_angle || 0) - frame.angle
    return { key, along, offset, bodyAngle, boxes: localBoxesFor(key, bodyAngle) }
  })
}

/**
 * How far the block reaches either side of the spine, including the key bodies themselves.
 *
 * These extremes drive the stretch: the most-compressed point of the block is always at one of
 * them, because `(1 - κ·d)` is linear in `d`.
 */
function normalExtent(sources: SourceKey[], gap: number): { low: number; high: number } {
  let low = Infinity
  let high = -Infinity

  for (const source of sources) {
    for (const box of source.boxes) {
      const radians = (box.angle * Math.PI) / 180
      // Half extent of a rotated box measured along the block normal.
      const reach =
        box.halfWidth * Math.abs(Math.sin(radians)) + box.halfHeight * Math.abs(Math.cos(radians))
      const center = source.offset + box.offset
      low = Math.min(low, center - reach - gap / 2)
      high = Math.max(high, center + reach + gap / 2)
    }
  }

  return Number.isFinite(low) ? { low, high } : { low: 0, high: 0 }
}

/**
 * Build the map from block along-coordinate to spine arc distance.
 *
 * Integrates `dσ/da = (1 + stretch) / min(1 - κ·d)` over the block, sampling curvature at the
 * arc distance reached so far. Returns a lookup that interpolates between samples.
 */
function buildStretchMap(
  spine: CurveSpine,
  table: ArcLengthTable,
  extent: { low: number; high: number },
  profile: { halfAlong: number; halfNormal: number },
  frameAngle: number,
  followCurve: boolean,
  alongMax: number,
  stretch: number,
): (along: number) => number {
  const sigmas: number[] = [0]
  let sigma = 0

  const steps = Math.max(1, Math.ceil(alongMax / STEP)) + 1
  for (let i = 1; i <= steps; i++) {
    // Curvature is zero on the straight extensions beyond either end of the curve.
    const curvature =
      sigma < 0 || sigma > table.total ? 0 : curvatureAt(spine, tAtDistance(table, sigma))
    const jacobian = Math.max(
      MIN_JACOBIAN,
      Math.min(1 - curvature * extent.low, 1 - curvature * extent.high),
    )

    // A key that turns with the curve always presents the same width to its neighbour. One that
    // stays upright does not: as the tangent swings away from the block axis it travels
    // increasingly side-on, and needs room for its diagonal rather than its width.
    let profileFactor = 1
    if (!followCurve) {
      const tangent = tangentAtDistance(spine, table, sigma)
      const deviation = (Math.atan2(tangent.y, tangent.x) * 180) / Math.PI - frameAngle
      const radians = (deviation * Math.PI) / 180
      profileFactor =
        (profile.halfAlong * Math.abs(Math.cos(radians)) +
          profile.halfNormal * Math.abs(Math.sin(radians))) /
        profile.halfAlong
    }

    sigma += ((STEP * profileFactor) / jacobian) * (1 + stretch)
    sigmas.push(sigma)
  }

  return (along: number) => {
    if (along <= 0) return along
    const position = along / STEP
    const index = Math.min(sigmas.length - 1, Math.floor(position))
    const next = Math.min(sigmas.length - 1, index + 1)
    if (index === next) return sigmas[index]!
    return sigmas[index]! + (position - index) * (sigmas[next]! - sigmas[index]!)
  }
}

/** Map every key onto the spine using a given stretch map. */
function place(
  sources: SourceKey[],
  spine: CurveSpine,
  table: ArcLengthTable,
  frame: BlockFrame,
  sigmaAt: (along: number) => number,
  followCurve: boolean,
): KeyPlacement[] {
  return sources.map((source) => {
    const sigma = sigmaAt(source.along)
    const origin = pointAtDistance(spine, table, sigma)
    const tangent = tangentAtDistance(spine, table, sigma)
    const spineAngle = (Math.atan2(tangent.y, tangent.x) * 180) / Math.PI

    // Turning with the curve means the whole column turns with it: the key sits on the spine's
    // own normal. Staying upright means the column stays upright too, and the spine contributes
    // only the footpoint — the block shears along the curve instead of rotating onto it.
    //
    // The distinction is not cosmetic. Two keys one unit apart in a column have no slack, so
    // applying their offset along a normal tilted even a couple of degrees pushes their upright
    // bodies into each other, and nothing done along the curve can pull them back apart.
    const orientAngle = followCurve ? spineAngle : frame.angle
    const radians = (orientAngle * Math.PI) / 180
    const centerX = origin.x - Math.sin(radians) * source.offset
    const centerY = origin.y + Math.cos(radians) * source.offset
    const angle = orientAngle + source.bodyAngle

    const width = source.key.width || 1
    const height = source.key.height || 1

    if (Math.abs(angle) < EPSILON) {
      // An unrotated key needs no rotation origin; emitting one would only add noise.
      return {
        key: source.key,
        x: round(centerX - width / 2),
        y: round(centerY - height / 2),
        rotation_x: 0,
        rotation_y: 0,
        rotation_angle: 0,
      }
    }

    // Every key on the same footpoint shares that footpoint as its rotation origin, so a column
    // becomes one rotation cluster rather than one per key. KLE rotates the key rectangle about
    // that origin, so invert the rotation to recover the x/y that renders at `center`.
    const inverse = (-angle * Math.PI) / 180
    const inverseCos = Math.cos(inverse)
    const inverseSin = Math.sin(inverse)
    const deltaX = centerX - origin.x
    const deltaY = centerY - origin.y

    return {
      key: source.key,
      x: round(origin.x + (deltaX * inverseCos - deltaY * inverseSin) - width / 2),
      y: round(origin.y + (deltaX * inverseSin + deltaY * inverseCos) - height / 2),
      rotation_x: round(origin.x),
      rotation_y: round(origin.y),
      rotation_angle: round(angle),
    }
  })
}

/**
 * Lay a block of keys out along a spine.
 *
 * On a straight spine this is an identity transform, so opening the tool moves nothing.
 *
 * @param keys - Keys to lay out. Not modified.
 * @param spine - The curve to bend around.
 * @param options - Gap and rotation behaviour.
 */
export function layoutKeysOnCurve(
  keys: Key[],
  spine: CurveSpine,
  options: CurveLayoutOptions,
): CurveLayoutResult {
  if (!keys.length) {
    return { placements: [], columnCount: 0, stretch: 0, overlapCount: 0, collisionFree: true }
  }

  const frame = computeBlockFrame(keys)
  const table = buildArcLengthTable(spine)
  const sources = describeKeys(keys, frame)
  const gap = Math.max(0, options.gap || 0)
  const extent = normalExtent(sources, 0)
  const alongMax = sources.reduce((largest, source) => Math.max(largest, source.along), 0)

  // Overlaps the layout arrived with — decals, deliberately stacked keys — are not this tool's
  // to fix, and trying would mean moving keys off their own normals. They are excluded from the
  // guarantee so the tool still works on layouts that contain them.
  const preexisting = collidingPairs(identityPlacements(keys))

  // `gap` is along-curve breathing room, so it enters as extra stretch rather than as a
  // clearance the verifier demands.
  const gapStretch = gap > 0 ? gap / medianAlongPitch(sources) : 0

  const profile = bodyProfile(sources)

  const solve = (stretch: number) =>
    place(
      sources,
      spine,
      table,
      frame,
      buildStretchMap(
        spine,
        table,
        extent,
        profile,
        frame.angle,
        options.followCurve,
        alongMax,
        gapStretch + stretch,
      ),
      options.followCurve,
    )

  // The geometric minimum: the tightest arrangement the curve allows.
  const tightest = solve(0)
  let stretch = 0
  let placements = tightest

  // The stretch is derived from the block's extreme offsets, which is exact for centre spacing
  // but slightly optimistic about corner-to-corner clearance on a tight curve. Rather than pad
  // every layout for the worst case, verify and nudge only when something actually overlaps.
  //
  // Skipped when overlaps are allowed: for a layout that cannot be cleaned this search is dozens
  // of wasted solves per frame during a drag, and it is exactly those layouts the flag is for.
  if (!options.allowOverlaps && countNewCollisions(tightest, preexisting) > 0) {
    for (let attempt = 1; attempt <= MAX_STRETCH_ATTEMPTS; attempt++) {
      const candidate = solve(attempt * STRETCH_INCREMENT)
      if (countNewCollisions(candidate, preexisting) === 0) {
        stretch = attempt * STRETCH_INCREMENT
        placements = candidate
        break
      }
    }
    // Nothing cleared it. Keep the tightest arrangement rather than the most stretched one:
    // spreading the layout out and *still* overlapping is the worst of both, and it is also what
    // the user gets if they go on to allow overlaps, so the preview should show that.
  }

  const columnCount = new Set(sources.map((source) => source.along.toFixed(6))).size
  const overlapCount = countNewCollisions(placements, preexisting)

  return {
    placements,
    columnCount,
    stretch,
    overlapCount,
    collisionFree: overlapCount === 0,
  }
}

/** The keys as they already are, so the solver can tell pre-existing overlaps from new ones. */
function identityPlacements(keys: Key[]): KeyPlacement[] {
  return keys.map((key) => ({
    key,
    x: key.x,
    y: key.y,
    rotation_x: key.rotation_x || 0,
    rotation_y: key.rotation_y || 0,
    rotation_angle: key.rotation_angle || 0,
  }))
}

/**
 * The largest key half-extents in the block, along the axis and along the normal.
 *
 * Used to size the room an upright key needs when the curve turns underneath it. Taking the
 * maximum is deliberately conservative: it costs a little spacing in the one mode where keys do
 * not turn with the curve, and avoids under-estimating for the widest key in the block.
 */
function bodyProfile(sources: SourceKey[]): { halfAlong: number; halfNormal: number } {
  let halfAlong = EPSILON
  let halfNormal = 0

  for (const source of sources) {
    for (const box of source.boxes) {
      const radians = (box.angle * Math.PI) / 180
      const cos = Math.abs(Math.cos(radians))
      const sin = Math.abs(Math.sin(radians))
      halfAlong = Math.max(halfAlong, box.halfWidth * cos + box.halfHeight * sin)
      halfNormal = Math.max(halfNormal, box.halfWidth * sin + box.halfHeight * cos)
    }
  }

  return { halfAlong, halfNormal }
}

/** Median distance between neighbouring columns, used to express `gap` as a stretch. */
function medianAlongPitch(sources: SourceKey[]): number {
  const positions = [...new Set(sources.map((source) => source.along))].sort((a, b) => a - b)
  if (positions.length < 2) return 1

  const pitches = positions.slice(1).map((value, index) => value - positions[index]!)
  pitches.sort((a, b) => a - b)
  const middle = Math.floor(pitches.length / 2)
  const median =
    pitches.length % 2 === 0 ? (pitches[middle - 1]! + pitches[middle]!) / 2 : pitches[middle]!
  return median > EPSILON ? median : 1
}

/** How many pairs overlap that were not already overlapping in the source layout. */
function countNewCollisions(placements: KeyPlacement[], preexisting: Set<number>): number {
  let count = 0
  for (const pair of collidingPairs(placements)) {
    if (!preexisting.has(pair)) count++
  }
  return count
}

/**
 * Indices of every pair of placements whose bodies overlap, encoded as `i * length + j`.
 *
 * Recomputes the boxes from the emitted geometry rather than from the solver's internals, so it
 * also catches mistakes in the placement step itself.
 */
function collidingPairs(placements: KeyPlacement[], gap = 0): Set<number> {
  const inflation = Math.max(0, gap) / 2
  const pairs = new Set<number>()

  const boxes: OrientedBox[][] = placements.map((placement) => {
    const key = placement.key
    const width = key.width || 1
    const height = key.height || 1
    const angle = placement.rotation_angle || 0
    const radians = (angle * Math.PI) / 180
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)

    // Rendered centre: rotate the key rectangle's centre about its rotation origin.
    const rawCenterX = placement.x + width / 2
    const rawCenterY = placement.y + height / 2
    const originX = placement.rotation_x || 0
    const originY = placement.rotation_y || 0
    const deltaX = rawCenterX - originX
    const deltaY = rawCenterY - originY
    const centerX = originX + deltaX * cos - deltaY * sin
    const centerY = originY + deltaX * sin + deltaY * cos

    return localBoxesFor(key, 0).map((box) => ({
      centerX: centerX + box.along * cos - box.offset * sin,
      centerY: centerY + box.along * sin + box.offset * cos,
      halfWidth: box.halfWidth + inflation,
      halfHeight: box.halfHeight + inflation,
      angle,
    }))
  })

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      let hit = false
      for (const a of boxes[i]!) {
        for (const b of boxes[j]!) {
          if (orientedBoxesOverlap(a, b, CONTACT_TOLERANCE)) {
            hit = true
            break
          }
        }
        if (hit) break
      }
      if (hit) pairs.add(i * placements.length + j)
    }
  }

  return pairs
}

/**
 * Check that no two placed key bodies overlap.
 *
 * @param placements - Geometry to check
 * @param gap - Clearance every pair must also leave, in layout units
 */
export function verifyNoCollisions(placements: KeyPlacement[], gap = 0): boolean {
  return collidingPairs(placements, gap).size === 0
}
