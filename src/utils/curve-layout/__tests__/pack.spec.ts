import { describe, expect, it } from 'vitest'
import { Key } from '@adamws/kle-serial'
import {
  buildArcLengthTable,
  computeBlockFrame,
  curvatureAt,
  defaultSpineForKeys,
  pointAtDistance,
  tangentAtDistance,
  type CurveSpine,
} from '../spine'
import { layoutKeysOnCurve, verifyNoCollisions, type CurveLayoutOptions } from '../pack'

const makeKey = (values: Partial<Key>): Key => Object.assign(new Key(), values)

const defaults: CurveLayoutOptions = { gap: 0, followCurve: true, allowOverlaps: false }

const row = (count: number, width = 1): Key[] =>
  Array.from({ length: count }, (_, index) => makeKey({ x: index * width, y: 0, width }))

/** A rows x cols grid of 1u keys — non-overlapping by construction. */
const grid = (rows: number, cols: number): Key[] => {
  const keys: Key[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) keys.push(makeKey({ x: c, y: r }))
  }
  return keys
}

/** Deterministic PRNG so a failing property case can be reproduced from its seed. */
const makeRandom = (seed: number) => {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

const placedCenter = (placement: {
  key: Key
  x: number
  y: number
  rotation_x: number
  rotation_y: number
  rotation_angle: number
}) => {
  const width = placement.key.width || 1
  const height = placement.key.height || 1
  const radians = (placement.rotation_angle * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const dx = placement.x + width / 2 - placement.rotation_x
  const dy = placement.y + height / 2 - placement.rotation_y
  return {
    x: placement.rotation_x + dx * cos - dy * sin,
    y: placement.rotation_y + dx * sin + dy * cos,
  }
}

/** View a set of untouched keys as placements, so the source can be collision-checked too. */
const asPlacements = (keys: Key[]) =>
  keys.map((key) => ({
    key,
    x: key.x,
    y: key.y,
    rotation_x: key.rotation_x || 0,
    rotation_y: key.rotation_y || 0,
    rotation_angle: key.rotation_angle || 0,
  }))

/** Build a randomized, already-collision-free source block. */
const randomBlock = (random: () => number, rows: number, cols: number): Key[] => {
  const keys: Key[] = []
  for (let r = 0; r < rows; r++) {
    let cursor = 0
    for (let c = 0; c < cols; c++) {
      const width = [1, 1, 1, 1.25, 1.5, 2, 6.25][Math.floor(random() * 7)]!
      // Only narrow keys are rotated: a rotated 6.25u spacebar sweeps through the neighbouring
      // row and would make the source layout overlap before the solver ever runs.
      const rotated = width <= 1.5 && random() > 0.7
      const angle = rotated ? Math.round((random() - 0.5) * 50) : 0
      // A rotated key sweeps wider than its footprint and needs clearance on both sides —
      // giving it room only on the right lets it back into its left neighbour.
      if (rotated) cursor += 0.6
      keys.push(
        makeKey({
          x: cursor,
          y: r * 1.75,
          width,
          rotation_angle: angle,
          // Without an explicit origin, KLE rotates about (0, 0) and flings the key away.
          rotation_x: angle ? cursor + width / 2 : 0,
          rotation_y: angle ? r * 1.75 + 0.5 : 0,
        }),
      )
      cursor += width + (rotated ? 0.6 : 0)
    }
  }
  return keys
}

describe('collision guarantee (property test)', () => {
  it('never claims success on a layout that actually overlaps', () => {
    // Soundness over deliberately hostile input: spines with sub-key radii, cusps and
    // self-intersections. The solver may refuse such a curve — a curve tighter than the block is
    // deep has no valid layout — but it must never report a clean result that is not clean.
    const random = makeRandom(20260831)
    const failures: string[] = []
    let checked = 0
    let succeeded = 0

    for (let caseIndex = 0; caseIndex < 250; caseIndex++) {
      const rows = 1 + Math.floor(random() * 5)
      const cols = 1 + Math.floor(random() * 8)
      const gap = [0, 0.05, 0.25][Math.floor(random() * 3)]!
      const followCurve = random() > 0.3
      const keys = randomBlock(random, rows, cols)

      if (!verifyNoCollisions(asPlacements(keys))) continue
      checked++

      const span = Math.max(2, cols * 1.5)
      const jitter = () => (random() - 0.5) * span * 1.6
      const spine: CurveSpine = [
        { x: 0, y: 0 },
        { x: span / 3 + jitter(), y: jitter() },
        { x: (2 * span) / 3 + jitter(), y: jitter() },
        { x: span + jitter(), y: jitter() },
      ]

      const result = layoutKeysOnCurve(keys, spine, { gap, followCurve, allowOverlaps: false })
      if (!result.collisionFree) continue
      succeeded++

      if (!verifyNoCollisions(result.placements)) {
        failures.push(
          `case ${caseIndex}: claimed clean but overlaps ` +
            `(rows=${rows} cols=${cols} gap=${gap} followCurve=${followCurve})`,
        )
      }
    }

    expect(failures).toEqual([])
    expect(checked).toBeGreaterThan(200)
    // Even on hostile curves a good share must succeed, or the check above is near-vacuous.
    expect(succeeded).toBeGreaterThan(checked * 0.5)
  })

  it('succeeds on every curve that is geometrically feasible for the block', () => {
    // The precise claim, for keys that turn with the curve: a block of depth D cannot be bent
    // around a curve whose radius of curvature approaches D/2 — the inner rows would have to
    // pass through the centre of curvature and turn inside out. No layout exists there, and the
    // tool says so. Every curve clear of that bound must produce a clean layout.
    const random = makeRandom(778899)
    const refused: string[] = []
    const overlapping: string[] = []
    let checked = 0

    for (let caseIndex = 0; caseIndex < 400; caseIndex++) {
      const rows = 1 + Math.floor(random() * 5)
      const cols = 2 + Math.floor(random() * 8)
      const gap = [0, 0.05, 0.25][Math.floor(random() * 3)]!
      const keys = randomBlock(random, rows, cols)
      if (!verifyNoCollisions(asPlacements(keys))) continue

      const frame = computeBlockFrame(keys)
      const straight = defaultSpineForKeys(keys)
      const span = Math.hypot(straight[3].x - straight[0].x, straight[3].y - straight[0].y)
      const deflection = (random() - 0.5) * 2 * span
      const push = (point: { x: number; y: number }) => ({
        x: point.x + frame.normal.x * deflection,
        y: point.y + frame.normal.y * deflection,
      })
      const spine: CurveSpine = [straight[0], push(straight[1]), push(straight[2]), straight[3]]

      // How far the block reaches from its axis, and the tightest curvature on the spine.
      const halfDepth = Math.max(0.5, (rows - 1) * 1.75 + 1) / 2
      let peakCurvature = 0
      for (let i = 0; i <= 40; i++) {
        peakCurvature = Math.max(peakCurvature, Math.abs(curvatureAt(spine, i / 40)))
      }
      // Skip curves at or past the fold; keep a margin so the boundary itself is not the test.
      if (peakCurvature * halfDepth > 0.6) continue
      checked++

      const result = layoutKeysOnCurve(keys, spine, {
        gap,
        followCurve: true,
        allowOverlaps: false,
      })
      if (!result.collisionFree) {
        refused.push(`case ${caseIndex}: refused (rows=${rows} cols=${cols})`)
      } else if (!verifyNoCollisions(result.placements)) {
        overlapping.push(`case ${caseIndex}: overlaps (rows=${rows} cols=${cols})`)
      }
    }

    expect(overlapping).toEqual([])
    expect(refused).toEqual([])
    expect(checked).toBeGreaterThan(100)
  })

  it('handles upright keys on gentle curves, and refuses rather than overlapping on tight ones', () => {
    // Keeping keys upright is more constrained than letting them turn: two keys in one column
    // are a fixed distance apart along the normal, and once the normal tilts far enough their
    // axis-aligned bodies foul each other side-to-side. Stretching along the curve cannot help,
    // because the collision is within a column. Gentle curves must work; tighter ones must be
    // refused rather than silently overlapped.
    const random = makeRandom(24680)
    const refused: string[] = []
    const overlapping: string[] = []
    let checked = 0

    for (let caseIndex = 0; caseIndex < 600; caseIndex++) {
      const rows = 1 + Math.floor(random() * 4)
      const cols = 2 + Math.floor(random() * 8)
      const keys = randomBlock(random, rows, cols)
      if (!verifyNoCollisions(asPlacements(keys))) continue

      const frame = computeBlockFrame(keys)
      const straight = defaultSpineForKeys(keys)
      const span = Math.hypot(straight[3].x - straight[0].x, straight[3].y - straight[0].y)
      const deflection = (random() - 0.5) * 2 * span
      const push = (point: { x: number; y: number }) => ({
        x: point.x + frame.normal.x * deflection,
        y: point.y + frame.normal.y * deflection,
      })
      const spine: CurveSpine = [straight[0], push(straight[1]), push(straight[2]), straight[3]]

      // Gentle here means the tangent never swings far from the block axis.
      let peakDeviation = 0
      const table = buildArcLengthTable(spine)
      for (let i = 0; i <= 40; i++) {
        const tangent = tangentAtDistance(spine, table, (i / 40) * table.total)
        const deviation = Math.abs((Math.atan2(tangent.y, tangent.x) * 180) / Math.PI - frame.angle)
        peakDeviation = Math.max(peakDeviation, deviation)
      }
      if (peakDeviation > 20) continue
      checked++

      const result = layoutKeysOnCurve(keys, spine, {
        gap: 0,
        followCurve: false,
        allowOverlaps: false,
      })
      if (!result.collisionFree) {
        refused.push(
          `case ${caseIndex}: refused (rows=${rows} cols=${cols} dev=${peakDeviation.toFixed(1)})`,
        )
      } else if (!verifyNoCollisions(result.placements)) {
        overlapping.push(`case ${caseIndex}: overlaps (rows=${rows} cols=${cols})`)
      }
    }

    // Soundness is absolute: upright mode must never claim a clean layout that overlaps.
    expect(overlapping).toEqual([])
    expect(checked).toBeGreaterThan(60)
    // Refusals are allowed but must stay rare. A block whose columns have no slack — 1u keys at
    // 1u pitch — has none to give, so a few shapes genuinely have no upright solution.
    expect(refused.length).toBeLessThan(checked * 0.1)
  })

  it('adds the requested gap along the curve', () => {
    // Gap is along-curve breathing room. A key's distance from the spine is its own and is
    // carried through untouched, so a gap cannot be opened between rows — only between columns.
    const keys = grid(3, 6)
    const spine: CurveSpine = [
      { x: 0, y: 0 },
      { x: 2, y: -1.5 },
      { x: 4, y: -1.5 },
      { x: 6, y: 0 },
    ]

    const pitchOf = (gap: number) => {
      const result = layoutKeysOnCurve(keys, spine, { ...defaults, gap })
      expect(result.collisionFree).toBe(true)
      const centers = result.placements.map(placedCenter)
      // Consecutive keys in the first row.
      return Math.hypot(centers[1]!.x - centers[0]!.x, centers[1]!.y - centers[0]!.y)
    }

    const base = pitchOf(0)
    expect(pitchOf(0.25)).toBeGreaterThan(base + 0.2)
    expect(pitchOf(0.5)).toBeGreaterThan(pitchOf(0.25) + 0.2)
  })
})

describe('allowing overlaps', () => {
  /** A rough ANSI 60%: staggered rows with wide modifiers and a 6.25u spacebar. */
  const ansi60 = (): Key[] => {
    const rows = [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
      [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5],
      [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25],
      [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75],
      [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25],
    ]
    const keys: Key[] = []
    rows.forEach((widths, r) => {
      let x = 0
      widths.forEach((width) => {
        keys.push(makeKey({ x, y: r, width }))
        x += width
      })
    })
    return keys
  }

  const bentSpine = (keys: Key[], percent: number): CurveSpine => {
    const frame = computeBlockFrame(keys)
    const straight = defaultSpineForKeys(keys)
    const span = Math.hypot(straight[3].x - straight[0].x, straight[3].y - straight[0].y)
    const distance = (percent / 100) * (span / 2)
    const push = (point: { x: number; y: number }) => ({
      x: point.x + frame.normal.x * distance,
      y: point.y + frame.normal.y * distance,
    })
    return [straight[0], push(straight[1]), push(straight[2]), straight[3]]
  }

  it('a real staggered layout cannot be bent without overlaps at any usable angle', () => {
    // Documents why the flag has to exist. A 6.25u spacebar is a long rigid bar; once the rows
    // around it curve away it fouls them, and no amount of spreading along the curve helps.
    const keys = ansi60()
    for (const percent of [5, 10, 20, 35]) {
      const result = layoutKeysOnCurve(keys, bentSpine(keys, percent), defaults)
      expect(result.collisionFree).toBe(false)
      expect(result.overlapCount).toBeGreaterThan(0)
    }
  })

  it('a uniform grid of the same shape bends cleanly, so the cause really is the wide keys', () => {
    const keys: Key[] = []
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 14; c++) keys.push(makeKey({ x: c, y: r }))
    }
    for (const percent of [5, 10, 20, 35]) {
      const result = layoutKeysOnCurve(keys, bentSpine(keys, percent), defaults)
      expect(result.collisionFree).toBe(true)
    }
  })

  it('falls back to the tightest arrangement when no stretch can clear the overlaps', () => {
    // Spreading the layout out and *still* overlapping is the worst of both outcomes, so a
    // failed search keeps the geometric minimum. That is also what allowing overlaps produces,
    // which is what makes the preview an honest picture of what the flag would give you.
    const keys = ansi60()
    const spine = bentSpine(keys, 20)

    const guarded = layoutKeysOnCurve(keys, spine, defaults)
    const allowed = layoutKeysOnCurve(keys, spine, { ...defaults, allowOverlaps: true })

    expect(guarded.collisionFree).toBe(false)
    expect(guarded.stretch).toBe(0)
    expect(allowed.stretch).toBe(0)
    expect(allowed.placements.map((p) => [p.x, p.y, p.rotation_angle])).toEqual(
      guarded.placements.map((p) => [p.x, p.y, p.rotation_angle]),
    )
  })

  it('reports honestly — the flag permits overlaps, it does not hide them', () => {
    const keys = ansi60()
    const result = layoutKeysOnCurve(keys, bentSpine(keys, 20), {
      ...defaults,
      allowOverlaps: true,
    })

    expect(result.collisionFree).toBe(false)
    expect(result.overlapCount).toBeGreaterThan(0)
    // The verdict must agree with an independent check of the emitted geometry.
    expect(verifyNoCollisions(result.placements)).toBe(false)
  })

  it('changes nothing for a layout the curve already places cleanly', () => {
    const keys: Key[] = []
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 10; c++) keys.push(makeKey({ x: c, y: r }))
    }
    // 10%: clean at the geometric minimum, with no nudge needed.
    const spine = bentSpine(keys, 10)

    const guarded = layoutKeysOnCurve(keys, spine, defaults)
    const allowed = layoutKeysOnCurve(keys, spine, { ...defaults, allowOverlaps: true })

    expect(guarded.collisionFree).toBe(true)
    expect(guarded.stretch).toBe(0)
    expect(allowed.collisionFree).toBe(true)
    expect(allowed.placements.map((p) => [p.x, p.y, p.rotation_angle])).toEqual(
      guarded.placements.map((p) => [p.x, p.y, p.rotation_angle]),
    )
  })

  it('still finds a small nudge when one would clear the overlaps', () => {
    // The guarded path must keep taking cheap wins; the fallback is only for hopeless cases.
    const keys: Key[] = []
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 10; c++) keys.push(makeKey({ x: c, y: r }))
    }
    const result = layoutKeysOnCurve(keys, bentSpine(keys, 20), defaults)

    expect(result.collisionFree).toBe(true)
    expect(result.stretch).toBeGreaterThan(0)
    expect(result.stretch).toBeLessThan(0.1)
  })
})

describe('the case the fork could not solve', () => {
  // deformKeyBlock + resolveDeformationCollisions left 14 overlapping pairs here at gap 0,
  // after exhausting all 80 relaxation passes.
  const tightArc: CurveSpine = [
    { x: 0.5, y: 0.5 },
    { x: 3.5, y: 5 },
    { x: 7.5, y: 5 },
    { x: 10.5, y: 0.5 },
  ]

  it('places a 4x6 block on a radius-4u arc with no overlaps', () => {
    const keys: Key[] = []
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 6; c++) keys.push(makeKey({ x: c + 2, y: -r }))
    }

    const result = layoutKeysOnCurve(keys, tightArc, defaults)

    expect(result.placements).toHaveLength(24)
    expect(result.collisionFree).toBe(true)
    expect(verifyNoCollisions(result.placements)).toBe(true)
  })

  it('keeps every key — none are dropped', () => {
    const keys = grid(4, 10)
    const result = layoutKeysOnCurve(keys, tightArc, defaults)
    expect(result.placements).toHaveLength(keys.length)
    expect(new Set(result.placements.map((p) => p.key)).size).toBe(keys.length)
  })
})

describe('identity on a straight spine', () => {
  it('leaves a non-overlapping row exactly where it was', () => {
    const keys = row(8)
    const result = layoutKeysOnCurve(keys, defaultSpineForKeys(keys), defaults)

    result.placements.forEach((placement) => {
      expect(placement.x).toBeCloseTo(placement.key.x, 6)
      expect(placement.y).toBeCloseTo(placement.key.y, 6)
      expect(placement.rotation_angle).toBe(0)
    })
  })

  it('leaves a full grid exactly where it was', () => {
    const keys = grid(4, 6)
    const result = layoutKeysOnCurve(keys, defaultSpineForKeys(keys), defaults)

    result.placements.forEach((placement) => {
      expect(placement.x).toBeCloseTo(placement.key.x, 6)
      expect(placement.y).toBeCloseTo(placement.key.y, 6)
    })
  })

  it('preserves deliberate gaps in the source layout instead of compacting them', () => {
    // Keys at x = 0, 1 and 5: the hole must survive, so the tool never silently repacks a
    // layout the moment it is opened.
    const keys = [makeKey({ x: 0, y: 0 }), makeKey({ x: 1, y: 0 }), makeKey({ x: 5, y: 0 })]
    const result = layoutKeysOnCurve(keys, defaultSpineForKeys(keys), defaults)
    expect(result.placements.map((p) => p.x)).toEqual([
      expect.closeTo(0, 6),
      expect.closeTo(1, 6),
      expect.closeTo(5, 6),
    ])
  })

  it('still works on a layout that already overlaps itself', () => {
    // Stacked keys and decals are ordinary in KLE. The tool cannot separate them without moving
    // keys off their own normals, so it carries the overlap through rather than refusing to run.
    const keys = [makeKey({ x: 0, y: 0 }), makeKey({ x: 0.3, y: 0 }), makeKey({ x: 0.6, y: 0 })]
    const straight = defaultSpineForKeys(keys)
    const bent: CurveSpine = [
      straight[0],
      { x: straight[1].x, y: straight[1].y - 1 },
      { x: straight[2].x, y: straight[2].y - 1 },
      straight[3],
    ]

    const result = layoutKeysOnCurve(keys, bent, defaults)

    expect(result.placements).toHaveLength(3)
    // No *new* overlaps beyond the ones the layout arrived with.
    expect(result.collisionFree).toBe(true)
  })
})

describe('key pitch along the curve', () => {
  it('keeps a bent row at its original pitch instead of stretching it', () => {
    const keys = row(10)
    const spine: CurveSpine = [
      { x: 0.5, y: 0.5 },
      { x: 3.5, y: -4 },
      { x: 7.5, y: -4 },
      { x: 10.5, y: 0.5 },
    ]
    const result = layoutKeysOnCurve(keys, spine, { ...defaults })
    const centers = result.placements.map(placedCenter)

    const distances = centers
      .slice(1)
      .map((center, i) => Math.hypot(center.x - centers[i]!.x, center.y - centers[i]!.y))

    // The fork's t-based mapping varied by 44% across exactly this layout, dipping to 0.30u —
    // keys straight through each other. Here spacing never drops below one unit. It is not
    // dead flat either: two squares rotated to different tangents meet corner-first, so flush
    // contact legitimately needs slightly more than 1u on the bent section.
    const spread = Math.max(...distances) / Math.min(...distances)
    expect(spread).toBeLessThan(1.1)
    for (const distance of distances) expect(distance).toBeGreaterThanOrEqual(1)
  })
})

describe('running off the ends of the spine', () => {
  it('continues along the end tangent instead of piling keys on the endpoint', () => {
    // 12 keys of 1u on a spine only ~4u long: most of the row must overflow.
    const keys = row(12)
    const shortSpine: CurveSpine = [
      { x: 0, y: 0 },
      { x: 1.3, y: 0 },
      { x: 2.6, y: 0 },
      { x: 4, y: 0 },
    ]
    const result = layoutKeysOnCurve(keys, shortSpine, { ...defaults })

    expect(result.collisionFree).toBe(true)
    expect(verifyNoCollisions(result.placements)).toBe(true)

    const centers = result.placements.map(placedCenter)
    // No two keys share a position — the fork's clamp collapsed every overflow key onto P3.
    for (let i = 0; i < centers.length; i++) {
      for (let j = i + 1; j < centers.length; j++) {
        expect(
          Math.hypot(centers[i]!.x - centers[j]!.x, centers[i]!.y - centers[j]!.y),
        ).toBeGreaterThan(0.5)
      }
    }
  })

  it('places the overflow on the straight extension of a curved spine', () => {
    const keys = row(10)
    const spine: CurveSpine = [
      { x: 0, y: 0 },
      { x: 1, y: -1.5 },
      { x: 2.5, y: -1.5 },
      { x: 3.5, y: 0 },
    ]
    const table = buildArcLengthTable(spine)
    const result = layoutKeysOnCurve(keys, spine, { ...defaults })
    const centers = result.placements.map(placedCenter)

    // The last key sits well past the end of the curve, on the ray that extends it.
    const last = centers[centers.length - 1]!
    const rayOrigin = table.end
    const alongRay =
      (last.x - rayOrigin.x) * table.endTangent.x + (last.y - rayOrigin.y) * table.endTangent.y
    const offRay = Math.abs(
      (last.x - rayOrigin.x) * -table.endTangent.y + (last.y - rayOrigin.y) * table.endTangent.x,
    )
    expect(alongRay).toBeGreaterThan(1)
    expect(offRay).toBeLessThan(1e-6)
  })
})

describe('emitted KLE geometry', () => {
  it('gives every key in a slice the same rotation origin', () => {
    const keys = grid(4, 5)
    const spine: CurveSpine = [
      { x: 0, y: 0 },
      { x: 2, y: -2.5 },
      { x: 4, y: -2.5 },
      { x: 6, y: 0 },
    ]
    const result = layoutKeysOnCurve(keys, spine, { ...defaults })

    const origins = new Set(
      result.placements.map((p) => `${p.rotation_x.toFixed(6)},${p.rotation_y.toFixed(6)}`),
    )
    // One origin per slice, not one per key: 20 keys must not produce 20 clusters.
    expect(origins.size).toBe(result.columnCount)
    expect(origins.size).toBeLessThan(keys.length)
  })

  it('emits no rotation origin for keys that end up unrotated', () => {
    const keys = row(4)
    const result = layoutKeysOnCurve(keys, defaultSpineForKeys(keys), defaults)
    result.placements.forEach((placement) => {
      expect(placement.rotation_angle).toBe(0)
      expect(placement.rotation_x).toBe(0)
      expect(placement.rotation_y).toBe(0)
    })
  })

  it('renders each key back at the centre the solver chose', () => {
    const keys = grid(2, 4)
    const spine: CurveSpine = [
      { x: 0, y: 0 },
      { x: 1.5, y: -2 },
      { x: 3, y: -2 },
      { x: 4.5, y: 0 },
    ]
    const result = layoutKeysOnCurve(keys, spine, defaults)
    const table = buildArcLengthTable(spine)

    // Every placement's rotation origin must be a point on the spine (including extensions).
    result.placements.forEach((placement) => {
      if (placement.rotation_angle === 0) return
      const origin = { x: placement.rotation_x, y: placement.rotation_y }
      let best = Infinity
      for (let d = -5; d <= table.total + 5; d += 0.01) {
        const point = pointAtDistance(spine, table, d)
        best = Math.min(best, Math.hypot(point.x - origin.x, point.y - origin.y))
      }
      expect(best).toBeLessThan(0.02)
    })
  })

  it('does not rotate keys when followCurve is off', () => {
    const keys = row(6)
    const spine: CurveSpine = [
      { x: 0, y: 0 },
      { x: 2, y: -3 },
      { x: 4, y: -3 },
      { x: 6, y: 0 },
    ]
    const result = layoutKeysOnCurve(keys, spine, { ...defaults, followCurve: false })
    result.placements.forEach((placement) => expect(placement.rotation_angle).toBe(0))
    expect(verifyNoCollisions(result.placements)).toBe(true)
  })
})

describe('non-rectangular keys', () => {
  it('accounts for the second rectangle of an ISO enter', () => {
    // ISO enter: 1.5u wide over 2u tall, with a 1.25u notch offset to the left on the lower half.
    const isoEnter = makeKey({
      x: 0,
      y: 0,
      width: 1.5,
      height: 2,
      x2: 0.25,
      y2: 1,
      width2: 1.25,
      height2: 1,
    })
    const neighbour = makeKey({ x: 1.5, y: 0 })
    const keys = [isoEnter, neighbour]

    const spine: CurveSpine = [
      { x: 0, y: 0 },
      { x: 1, y: -1 },
      { x: 2, y: -1 },
      { x: 3, y: 0 },
    ]
    const result = layoutKeysOnCurve(keys, spine, { ...defaults })
    expect(result.collisionFree).toBe(true)
    expect(verifyNoCollisions(result.placements)).toBe(true)
  })
})

describe('the layout stays tight', () => {
  // The regression this guards: an earlier model transported each column as a rigid body and
  // slid it along the spine until it cleared its neighbour. That is collision-free but needs far
  // more room than the geometry requires — row pitch blew out to 3.2u for 1u keys at a gentle
  // bend, leaving wedge-shaped voids between columns and an unusable layout.
  const rows = 4
  const cols = 10

  const block = (): Key[] => {
    const keys: Key[] = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) keys.push(makeKey({ x: c, y: r }))
    }
    return keys
  }

  /** Distance between consecutive keys within each original row. */
  const rowPitches = (placements: ReturnType<typeof layoutKeysOnCurve>['placements']) => {
    const centers = placements.map(placedCenter)
    const pitches: number[] = []
    for (let r = 0; r < rows; r++) {
      for (let c = 1; c < cols; c++) {
        const a = centers[r * cols + c - 1]!
        const b = centers[r * cols + c]!
        pitches.push(Math.hypot(a.x - b.x, a.y - b.y))
      }
    }
    return pitches
  }

  const bentSpine = (deflection: number): CurveSpine => {
    const keys = block()
    const straight = defaultSpineForKeys(keys)
    const frame = computeBlockFrame(keys)
    const push = (point: { x: number; y: number }) => ({
      x: point.x + frame.normal.x * deflection,
      y: point.y + frame.normal.y * deflection,
    })
    return [straight[0], push(straight[1]), push(straight[2]), straight[3]]
  }

  it('keeps row pitch close to the original at a gentle bend', () => {
    const keys = block()
    const result = layoutKeysOnCurve(keys, bentSpine(1), defaults)

    const pitches = rowPitches(result.placements)
    expect(Math.min(...pitches)).toBeGreaterThan(0.999)
    // Rigid-column transport produced 3.22 here.
    expect(Math.max(...pitches)).toBeLessThan(1.45)
    expect(verifyNoCollisions(result.placements)).toBe(true)
  })

  it('spreads only as much as the curve geometry demands at a strong bend', () => {
    const keys = block()
    const result = layoutKeysOnCurve(keys, bentSpine(3), defaults)

    const pitches = rowPitches(result.placements)
    expect(Math.min(...pitches)).toBeGreaterThan(0.999)
    // Rigid-column transport produced 3.42 here.
    expect(Math.max(...pitches)).toBeLessThan(2.6)
    expect(verifyNoCollisions(result.placements)).toBe(true)
  })

  it('does not need extra stretch beyond the geometric minimum for ordinary bends', () => {
    const keys = block()
    for (const deflection of [0.5, 1, 2]) {
      const result = layoutKeysOnCurve(keys, bentSpine(deflection), defaults)
      expect(result.stretch).toBe(0)
    }
  })

  it('keeps every column straight, sharing one rotation origin', () => {
    const keys = block()
    const result = layoutKeysOnCurve(keys, bentSpine(2), defaults)

    // Keys that shared an x in the source must still share a rotation origin, so columns stay
    // radial lines rather than shearing apart.
    for (let c = 0; c < cols; c++) {
      const column = Array.from({ length: rows }, (_, r) => result.placements[r * cols + c]!)
      const origins = new Set(
        column.map((p) => `${p.rotation_x.toFixed(6)},${p.rotation_y.toFixed(6)}`),
      )
      expect(origins.size).toBe(1)
    }
    expect(result.columnCount).toBe(cols)
  })
})

describe('edge cases', () => {
  it('handles an empty selection', () => {
    const result = layoutKeysOnCurve([], defaultSpineForKeys([]), defaults)
    expect(result.placements).toEqual([])
    expect(result.collisionFree).toBe(true)
  })

  it('handles a single key', () => {
    const keys = [makeKey({ x: 3, y: 2 })]
    const result = layoutKeysOnCurve(keys, defaultSpineForKeys(keys), defaults)
    expect(result.placements).toHaveLength(1)
    expect(result.collisionFree).toBe(true)
  })

  it('handles a collapsed spine without hanging', () => {
    const keys = row(5)
    const collapsed: CurveSpine = [
      { x: 1, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 1 },
    ]
    const result = layoutKeysOnCurve(keys, collapsed, defaults)
    expect(result.placements).toHaveLength(5)
    expect(verifyNoCollisions(result.placements)).toBe(true)
  })
})
