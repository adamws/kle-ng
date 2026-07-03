import { describe, it, expect } from 'vitest'
import { Key } from '@adamws/kle-serial'
import DxfParser from 'dxf-json'
import type { PolylineEntity } from 'dxf-json'
import { buildPlate, type PlateBuilderOptions } from '../plate-builder'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createKey(overrides: Partial<Key> = {}): Key {
  const key = new Key()
  return Object.assign(key, overrides)
}

function parseDxfPolylines(dxfContent: string): { x: number; y: number }[][] {
  const parser = new DxfParser()
  const parsed = parser.parseSync(dxfContent)
  return parsed.entities
    .filter((e): e is PolylineEntity => e.type === 'POLYLINE')
    .map((poly) => poly.vertices.map((v) => ({ x: v.x, y: v.y })))
}

function polylineBounds(vertices: { x: number; y: number }[]) {
  const xs = vertices.map((v) => v.x)
  const ys = vertices.map((v) => v.y)
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}

function polylineCenter(vertices: { x: number; y: number }[]) {
  const b = polylineBounds(vertices)
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 }
}

function distanceBetweenCenters(
  poly1: { x: number; y: number }[],
  poly2: { x: number; y: number }[],
): number {
  const c1 = polylineCenter(poly1)
  const c2 = polylineCenter(poly2)
  return Math.sqrt((c2.x - c1.x) ** 2 + (c2.y - c1.y) ** 2)
}

function polylineDimensions(vertices: { x: number; y: number }[]) {
  const b = polylineBounds(vertices)
  return { width: b.maxX - b.minX, height: b.maxY - b.minY }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Plate Builder – DXF switch cutouts', () => {
  // Test 1
  it('single 1U Cherry MX key – 14x14mm centered at origin', async () => {
    const keys = [createKey({ x: 0, y: 0, width: 1, height: 1 })]
    const options: PlateBuilderOptions = { cutoutType: 'cherry-mx-basic' }

    const result = await buildPlate(keys, options)
    const polylines = parseDxfPolylines(result.dxfContent)

    expect(polylines).toHaveLength(1)
    expect(polylines[0]).toHaveLength(4)

    const dims = polylineDimensions(polylines[0]!)
    expect(dims.width).toBe(14)
    expect(dims.height).toBe(14)

    const center = polylineCenter(polylines[0]!)
    expect(center.x).toBe(0)
    expect(center.y).toBe(0)

    const b = polylineBounds(polylines[0]!)
    expect(b.minX).toBe(-7)
    expect(b.maxX).toBe(7)
    expect(b.minY).toBe(-7)
    expect(b.maxY).toBe(7)
  })

  // Test 2
  it('single 1U Alps SKCM key – 15.5x12.8mm', async () => {
    const keys = [createKey({ x: 0, y: 0, width: 1, height: 1 })]
    const options: PlateBuilderOptions = { cutoutType: 'alps-skcm' }

    const result = await buildPlate(keys, options)
    const polylines = parseDxfPolylines(result.dxfContent)

    expect(polylines).toHaveLength(1)
    expect(polylines[0]).toHaveLength(4)

    const dims = polylineDimensions(polylines[0]!)
    expect(dims.width).toBe(15.5)
    expect(dims.height).toBe(12.8)

    const b = polylineBounds(polylines[0]!)
    expect(b.minX).toBe(-7.75)
    expect(b.maxX).toBe(7.75)
    expect(b.minY).toBe(-6.4)
    expect(b.maxY).toBe(6.4)
  })

  // Test 3
  it('two 1U keys side by side – default 19.05mm spacing', async () => {
    const keys = [
      createKey({ x: 0, y: 0, width: 1, height: 1 }),
      createKey({ x: 1, y: 0, width: 1, height: 1 }),
    ]
    const options: PlateBuilderOptions = { cutoutType: 'cherry-mx-basic' }

    const result = await buildPlate(keys, options)
    const polylines = parseDxfPolylines(result.dxfContent)

    expect(polylines).toHaveLength(2)

    polylines.forEach((poly) => {
      const dims = polylineDimensions(poly)
      expect(dims.width).toBe(14)
      expect(dims.height).toBe(14)
    })

    const c0 = polylineCenter(polylines[0]!)
    expect(c0.x).toBe(0)
    expect(c0.y).toBe(0)

    const c1 = polylineCenter(polylines[1]!)
    expect(c1.x).toBe(19.05)
    expect(c1.y).toBe(0)

    expect(distanceBetweenCenters(polylines[0]!, polylines[1]!)).toBe(19.05)
  })

  // Test 4
  it('two 1U keys side by side – custom spacing 18x17mm', async () => {
    const keys = [
      createKey({ x: 0, y: 0, width: 1, height: 1 }),
      createKey({ x: 1, y: 0, width: 1, height: 1 }),
    ]
    const options: PlateBuilderOptions = {
      cutoutType: 'cherry-mx-basic',
      spacingX: 18,
      spacingY: 17,
    }

    const result = await buildPlate(keys, options)
    const polylines = parseDxfPolylines(result.dxfContent)

    const c0 = polylineCenter(polylines[0]!)
    expect(c0.x).toBe(0)
    expect(c0.y).toBe(0)

    const c1 = polylineCenter(polylines[1]!)
    expect(c1.x).toBe(18)
    expect(c1.y).toBe(0)

    expect(distanceBetweenCenters(polylines[0]!, polylines[1]!)).toBe(18)
  })

  // Test 5
  it('two 1U keys vertically stacked – default spacing, Y inverted', async () => {
    const keys = [
      createKey({ x: 0, y: 0, width: 1, height: 1 }),
      createKey({ x: 0, y: 1, width: 1, height: 1 }),
    ]
    const options: PlateBuilderOptions = { cutoutType: 'cherry-mx-basic' }

    const result = await buildPlate(keys, options)
    const polylines = parseDxfPolylines(result.dxfContent)

    expect(polylines).toHaveLength(2)

    const c0 = polylineCenter(polylines[0]!)
    expect(c0.x).toBe(0)
    expect(c0.y).toBe(0)

    const c1 = polylineCenter(polylines[1]!)
    expect(c1.x).toBe(0)
    expect(c1.y).toBe(-19.05) // Y inverted in maker.js

    expect(distanceBetweenCenters(polylines[0]!, polylines[1]!)).toBe(19.05)
  })

  // Test 6
  it('two 1U keys vertically – custom spacing 18x17mm', async () => {
    const keys = [
      createKey({ x: 0, y: 0, width: 1, height: 1 }),
      createKey({ x: 0, y: 1, width: 1, height: 1 }),
    ]
    const options: PlateBuilderOptions = {
      cutoutType: 'cherry-mx-basic',
      spacingX: 18,
      spacingY: 17,
    }

    const result = await buildPlate(keys, options)
    const polylines = parseDxfPolylines(result.dxfContent)

    const c1 = polylineCenter(polylines[1]!)
    expect(c1.x).toBe(0)
    expect(c1.y).toBe(-17)

    expect(distanceBetweenCenters(polylines[0]!, polylines[1]!)).toBe(17)
  })

  // Test 7 — rotation involves trig, use toBeCloseTo
  it('single key rotated 90° – still 14x14mm (square)', async () => {
    const keys = [
      createKey({
        x: 1,
        y: 0,
        width: 1,
        height: 1,
        rotation_angle: 90,
        rotation_x: 0,
        rotation_y: 0,
      }),
    ]
    const options: PlateBuilderOptions = { cutoutType: 'cherry-mx-basic' }

    const result = await buildPlate(keys, options)
    const polylines = parseDxfPolylines(result.dxfContent)

    expect(polylines).toHaveLength(1)
    expect(polylines[0]).toHaveLength(4)

    // Square cutout, so dimensions unchanged after rotation
    const dims = polylineDimensions(polylines[0]!)
    expect(dims.width).toBeCloseTo(14, 6)
    expect(dims.height).toBeCloseTo(14, 6)
  })

  // Test 8 — rotation involves trig, use toBeCloseTo
  it('single key rotated 45° – bounding box is ~19.8x19.8mm diamond', async () => {
    const keys = [
      createKey({
        x: 1,
        y: 0,
        width: 1,
        height: 1,
        rotation_angle: 45,
        rotation_x: 0,
        rotation_y: 0,
      }),
    ]
    const options: PlateBuilderOptions = { cutoutType: 'cherry-mx-basic' }

    const result = await buildPlate(keys, options)
    const polylines = parseDxfPolylines(result.dxfContent)

    expect(polylines).toHaveLength(1)
    expect(polylines[0]).toHaveLength(4)

    // 14mm square rotated 45° -> bounding box = 14*sqrt(2) ≈ 19.80mm
    const dims = polylineDimensions(polylines[0]!)
    expect(dims.width).toBeCloseTo(14 * Math.SQRT2, 6)
    expect(dims.height).toBeCloseTo(14 * Math.SQRT2, 6)
  })

  // Test 9 — rotation involves trig, use toBeCloseTo
  it('rotated key with non-square Alps SKCM cutout – dimensions swap at 90°', async () => {
    const keys = [
      createKey({
        x: 1,
        y: 0,
        width: 1,
        height: 1,
        rotation_angle: 90,
        rotation_x: 0,
        rotation_y: 0,
      }),
    ]
    const options: PlateBuilderOptions = { cutoutType: 'alps-skcm' }

    const result = await buildPlate(keys, options)
    const polylines = parseDxfPolylines(result.dxfContent)

    expect(polylines).toHaveLength(1)

    // 15.5x12.8mm rotated 90° -> bounding box should be 12.8 wide, 15.5 tall
    const dims = polylineDimensions(polylines[0]!)
    expect(dims.width).toBeCloseTo(12.8, 6)
    expect(dims.height).toBeCloseTo(15.5, 6)
  })

  // Test 10
  it('kerf adjustment – single key shrinks cutout but stays centered', async () => {
    const keys = [createKey({ x: 0, y: 0, width: 1, height: 1 })]
    const options: PlateBuilderOptions = {
      cutoutType: 'cherry-mx-basic',
      sizeAdjust: 0.5,
    }

    const result = await buildPlate(keys, options)
    const polylines = parseDxfPolylines(result.dxfContent)

    expect(polylines).toHaveLength(1)

    const dims = polylineDimensions(polylines[0]!)
    expect(dims.width).toBe(13.5) // 14 - 0.5
    expect(dims.height).toBe(13.5)

    const center = polylineCenter(polylines[0]!)
    expect(center.x).toBe(0)
    expect(center.y).toBe(0)
  })

  // Test 11
  it('kerf adjustment – two keys: spacing preserved, cutouts shrink', async () => {
    const keys = [
      createKey({ x: 0, y: 0, width: 1, height: 1 }),
      createKey({ x: 1, y: 0, width: 1, height: 1 }),
    ]
    const options: PlateBuilderOptions = {
      cutoutType: 'cherry-mx-basic',
      sizeAdjust: 0.5,
    }

    const result = await buildPlate(keys, options)
    const polylines = parseDxfPolylines(result.dxfContent)

    expect(polylines).toHaveLength(2)

    // Each cutout is 13.5mm
    polylines.forEach((poly) => {
      const dims = polylineDimensions(poly)
      expect(dims.width).toBe(13.5)
      expect(dims.height).toBe(13.5)
    })

    const c0 = polylineCenter(polylines[0]!)
    expect(c0.x).toBe(0)

    const c1 = polylineCenter(polylines[1]!)
    expect(c1.x).toBe(19.05)

    // Critical: kerf does NOT change spacing
    expect(distanceBetweenCenters(polylines[0]!, polylines[1]!)).toBe(19.05)
  })

  // Test 12
  it('negative kerf (expansion) – single key', async () => {
    const keys = [createKey({ x: 0, y: 0, width: 1, height: 1 })]
    const options: PlateBuilderOptions = {
      cutoutType: 'cherry-mx-basic',
      sizeAdjust: -0.5,
    }

    const result = await buildPlate(keys, options)
    const polylines = parseDxfPolylines(result.dxfContent)

    const dims = polylineDimensions(polylines[0]!)
    expect(dims.width).toBe(14.5) // 14 - (-0.5)
    expect(dims.height).toBe(14.5)

    const center = polylineCenter(polylines[0]!)
    expect(center.x).toBe(0)
    expect(center.y).toBe(0)
  })

  // Test 13
  it('kerf with non-square Alps SKCM cutout', async () => {
    const keys = [createKey({ x: 0, y: 0, width: 1, height: 1 })]
    const options: PlateBuilderOptions = {
      cutoutType: 'alps-skcm',
      sizeAdjust: 0.5,
    }

    const result = await buildPlate(keys, options)
    const polylines = parseDxfPolylines(result.dxfContent)

    const dims = polylineDimensions(polylines[0]!)
    expect(dims.width).toBe(15) // 15.5 - 0.5
    expect(dims.height).toBe(12.3) // 12.8 - 0.5

    const center = polylineCenter(polylines[0]!)
    expect(center.x).toBe(0)
    expect(center.y).toBe(0)
  })

  // Test 14 — rotation involves trig, use toBeCloseTo
  it('two rotated keys at 30° – center-to-center distance = 19.05mm', async () => {
    const keys = [
      createKey({
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        rotation_angle: 30,
        rotation_x: 0,
        rotation_y: 0,
      }),
      createKey({
        x: 1,
        y: 0,
        width: 1,
        height: 1,
        rotation_angle: 30,
        rotation_x: 0,
        rotation_y: 0,
      }),
    ]
    const options: PlateBuilderOptions = { cutoutType: 'cherry-mx-basic' }

    const result = await buildPlate(keys, options)
    const polylines = parseDxfPolylines(result.dxfContent)

    expect(polylines).toHaveLength(2)
    expect(distanceBetweenCenters(polylines[0]!, polylines[1]!)).toBeCloseTo(19.05, 6)
  })

  // Test 15
  it('decal and ghost keys are filtered out', async () => {
    const keys = [
      createKey({ x: 0, y: 0, width: 1, height: 1, decal: true }),
      createKey({ x: 1, y: 0, width: 1, height: 1, ghost: true }),
      createKey({ x: 2, y: 0, width: 1, height: 1 }),
    ]
    const options: PlateBuilderOptions = { cutoutType: 'cherry-mx-basic' }

    const result = await buildPlate(keys, options)
    const polylines = parseDxfPolylines(result.dxfContent)

    // Only Key3 produces a cutout
    expect(polylines).toHaveLength(1)

    // Key3 becomes origin, so cutout centered at (0, 0)
    const center = polylineCenter(polylines[0]!)
    expect(center.x).toBe(0)
    expect(center.y).toBe(0)
  })

  // Test 16
  it('custom rectangle cutout – 16x12mm', async () => {
    const keys = [createKey({ x: 0, y: 0, width: 1, height: 1 })]
    const options: PlateBuilderOptions = {
      cutoutType: 'custom-rectangle',
      customCutoutWidth: 16,
      customCutoutHeight: 12,
    }

    const result = await buildPlate(keys, options)
    const polylines = parseDxfPolylines(result.dxfContent)

    expect(polylines).toHaveLength(1)
    expect(polylines[0]).toHaveLength(4)

    const dims = polylineDimensions(polylines[0]!)
    expect(dims.width).toBe(16)
    expect(dims.height).toBe(12)

    const center = polylineCenter(polylines[0]!)
    expect(center.x).toBe(0)
    expect(center.y).toBe(0)
  })

  // Test 17
  it('two keys diagonal with custom spacing', async () => {
    const keys = [
      createKey({ x: 0, y: 0, width: 1, height: 1 }),
      createKey({ x: 1, y: 1, width: 1, height: 1 }),
    ]
    const options: PlateBuilderOptions = {
      cutoutType: 'cherry-mx-basic',
      spacingX: 18,
      spacingY: 17,
    }

    const result = await buildPlate(keys, options)
    const polylines = parseDxfPolylines(result.dxfContent)

    expect(polylines).toHaveLength(2)

    const c0 = polylineCenter(polylines[0]!)
    expect(c0.x).toBe(0)
    expect(c0.y).toBe(0)

    const c1 = polylineCenter(polylines[1]!)
    expect(c1.x).toBe(18)
    expect(c1.y).toBe(-17) // Y inverted

    // sqrt(18^2 + 17^2) = sqrt(613) — irrational, must use toBeCloseTo
    expect(distanceBetweenCenters(polylines[0]!, polylines[1]!)).toBeCloseTo(Math.sqrt(613), 6)
  })
})

// ---------------------------------------------------------------------------
// Stabilizer cutout tests
// ---------------------------------------------------------------------------

describe('Plate Builder – DXF stabilizer cutouts', () => {
  /**
   * Separate the switch cutout from stabilizer cutouts.
   * The switch cutout center is closest to the key center (origin for single-key tests).
   */
  function separateCutouts(polylines: { x: number; y: number }[][]) {
    const sorted = [...polylines].sort((a, b) => {
      const ca = polylineCenter(a)
      const cb = polylineCenter(b)
      return Math.hypot(ca.x, ca.y) - Math.hypot(cb.x, cb.y)
    })
    return {
      switchCutout: sorted[0]!,
      stabCutouts: sorted.slice(1),
    }
  }

  it('2U key with mx-basic — 7x15mm stab pair at ±11.938mm', async () => {
    const keys = [createKey({ x: 0, y: 0, width: 2, height: 1 })]
    const options: PlateBuilderOptions = {
      cutoutType: 'cherry-mx-basic',
      stabilizerType: 'mx-basic',
    }

    const result = await buildPlate(keys, options)
    const polylines = parseDxfPolylines(result.dxfContent)

    expect(polylines).toHaveLength(3)

    const { switchCutout, stabCutouts } = separateCutouts(polylines)

    // Switch cutout: 14x14mm centered at origin
    expect(polylineDimensions(switchCutout).width).toBe(14)
    expect(polylineDimensions(switchCutout).height).toBe(14)
    expect(polylineCenter(switchCutout).x).toBe(0)
    expect(polylineCenter(switchCutout).y).toBe(0)

    // Stabilizer cutouts: 7x15mm each
    expect(stabCutouts).toHaveLength(2)
    for (const stab of stabCutouts) {
      expect(polylineDimensions(stab).width).toBe(7)
      expect(polylineDimensions(stab).height).toBe(15)
    }

    // Sort left/right by x
    const [left, right] = [...stabCutouts].sort((a, b) => polylineCenter(a).x - polylineCenter(b).x)
    const lc = polylineCenter(left!)
    const rc = polylineCenter(right!)

    // Stab centers at ±11.938mm from key center, offset -1.5mm vertically
    expect(lc.x).toBe(-11.938)
    expect(rc.x).toBe(11.938)
    expect(lc.y).toBe(-1.5)
    expect(rc.y).toBe(-1.5)

    // Symmetry: midpoint of stab centers x = key center x
    expect((lc.x + rc.x) / 2).toBe(0)

    // Distance between stab centers (axis-aligned, use x difference)
    expect(rc.x - lc.x).toBe(23.876)
  })

  it('6.25U spacebar with mx-basic — 7x15mm stab pair at ±50mm', async () => {
    const keys = [createKey({ x: 0, y: 0, width: 6.25, height: 1 })]
    const options: PlateBuilderOptions = {
      cutoutType: 'cherry-mx-basic',
      stabilizerType: 'mx-basic',
    }

    const result = await buildPlate(keys, options)
    const polylines = parseDxfPolylines(result.dxfContent)

    expect(polylines).toHaveLength(3)

    const { switchCutout, stabCutouts } = separateCutouts(polylines)

    // Switch cutout at origin
    expect(polylineCenter(switchCutout).x).toBe(0)
    expect(polylineCenter(switchCutout).y).toBe(0)

    // Stabilizer cutouts: 7x15mm each
    for (const stab of stabCutouts) {
      expect(polylineDimensions(stab).width).toBe(7)
      expect(polylineDimensions(stab).height).toBe(15)
    }

    const [left, right] = [...stabCutouts].sort((a, b) => polylineCenter(a).x - polylineCenter(b).x)
    const lc = polylineCenter(left!)
    const rc = polylineCenter(right!)

    // Stab centers at ±50mm
    expect(lc.x).toBe(-50)
    expect(rc.x).toBe(50)
    expect(lc.y).toBe(-1.5)
    expect(rc.y).toBe(-1.5)

    // Symmetry
    expect((lc.x + rc.x) / 2).toBe(0)

    // Distance between stab centers
    expect(rc.x - lc.x).toBe(100)
  })

  it('2U vertical key — stab assembly rotated, stabs vertically symmetric', async () => {
    const keys = [createKey({ x: 0, y: 0, width: 1, height: 2 })]
    const options: PlateBuilderOptions = {
      cutoutType: 'cherry-mx-basic',
      stabilizerType: 'mx-basic',
    }

    const result = await buildPlate(keys, options)
    const polylines = parseDxfPolylines(result.dxfContent)

    expect(polylines).toHaveLength(3)

    const { switchCutout, stabCutouts } = separateCutouts(polylines)

    // Switch cutout still at origin
    expect(polylineCenter(switchCutout).x).toBe(0)
    expect(polylineCenter(switchCutout).y).toBe(0)

    // Stab bounding boxes swap due to -90° rotation: 15mm wide x 7mm tall
    for (const stab of stabCutouts) {
      expect(polylineDimensions(stab).width).toBeCloseTo(15, 6)
      expect(polylineDimensions(stab).height).toBeCloseTo(7, 6)
    }

    // Sort bottom/top by y
    const [bottom, top] = [...stabCutouts].sort((a, b) => polylineCenter(a).y - polylineCenter(b).y)
    const bc = polylineCenter(bottom!)
    const tc = polylineCenter(top!)

    // After -90° rotation: (x,y) -> (y,-x)
    // Original stab centers (±11.938, -1.5) become (-1.5, ∓11.938)
    expect(bc.y).toBeCloseTo(-11.938, 6)
    expect(tc.y).toBeCloseTo(11.938, 6)
    expect(bc.x).toBeCloseTo(-1.5, 6)
    expect(tc.x).toBeCloseTo(-1.5, 6)

    // Y-symmetry: midpoint of stab centers y = key center y
    expect((bc.y + tc.y) / 2).toBeCloseTo(0, 6)

    // Distance between stab centers preserved
    expect(distanceBetweenCenters(bottom!, top!)).toBeCloseTo(23.876, 6)
  })

  it('rotated 2U key at 30° — stab distance and symmetry preserved', async () => {
    const keys = [
      createKey({
        x: 0,
        y: 0,
        width: 2,
        height: 1,
        rotation_angle: 30,
        rotation_x: 0,
        rotation_y: 0,
      }),
    ]
    const options: PlateBuilderOptions = {
      cutoutType: 'cherry-mx-basic',
      stabilizerType: 'mx-basic',
    }

    const result = await buildPlate(keys, options)
    const polylines = parseDxfPolylines(result.dxfContent)

    expect(polylines).toHaveLength(3)

    const { switchCutout, stabCutouts } = separateCutouts(polylines)

    // Switch cutout center still at origin (first key = origin)
    expect(polylineCenter(switchCutout).x).toBeCloseTo(0, 6)
    expect(polylineCenter(switchCutout).y).toBeCloseTo(0, 6)

    // Distance between stab centers preserved under rotation
    expect(distanceBetweenCenters(stabCutouts[0]!, stabCutouts[1]!)).toBeCloseTo(23.876, 6)

    // Both stabs equidistant from key center (rotation preserves distances)
    const d0 = Math.hypot(polylineCenter(stabCutouts[0]!).x, polylineCenter(stabCutouts[0]!).y)
    const d1 = Math.hypot(polylineCenter(stabCutouts[1]!).x, polylineCenter(stabCutouts[1]!).y)
    expect(d0).toBeCloseTo(d1, 6)
  })
})

describe('Plate Builder – rotary encoder cutouts (sm === rot_ec11)', () => {
  /** True when every vertex lies (approximately) on a circle of the given radius. */
  function isCircular(vertices: { x: number; y: number }[], radius: number): boolean {
    const c = polylineCenter(vertices)
    return vertices.every((v) => Math.abs(Math.hypot(v.x - c.x, v.y - c.y) - radius) < 0.05)
  }

  it('PCB build (default): encoder gets a 14×14mm rectangular cutout, no stabilizer', async () => {
    // A wide encoder key with a stab type set — must still produce ONLY a 14×14 rectangle.
    const keys = [createKey({ x: 0, y: 0, width: 2, height: 1, sm: 'rot_ec11' })]
    const options: PlateBuilderOptions = {
      cutoutType: 'cherry-mx-basic',
      stabilizerType: 'mx-basic',
    }

    const result = await buildPlate(keys, options)
    const polylines = parseDxfPolylines(result.dxfContent)

    expect(polylines).toHaveLength(1)
    expect(polylines[0]).toHaveLength(4)
    expect(polylineDimensions(polylines[0]!).width).toBe(14)
    expect(polylineDimensions(polylines[0]!).height).toBe(14)
    expect(polylineCenter(polylines[0]!).x).toBe(0)
    expect(polylineCenter(polylines[0]!).y).toBe(0)
  })

  it('handwired: encoder gets a circular screw-in cutout (radius 4mm), no stabilizer', async () => {
    const keys = [createKey({ x: 0, y: 0, width: 2, height: 1, sm: 'rot_ec11' })]
    const options: PlateBuilderOptions = {
      cutoutType: 'cherry-mx-basic',
      stabilizerType: 'mx-basic',
      rotaryEncoderHandwired: true,
    }

    const result = await buildPlate(keys, options)
    const polylines = parseDxfPolylines(result.dxfContent)

    // Only the single circular cutout — no stabilizer pair, not a square.
    expect(polylines).toHaveLength(1)
    expect(isCircular(polylines[0]!, 4)).toBe(true)
  })

  it('mixed handwired layout: normal switch is a 14mm square, encoder is a circle', async () => {
    const keys = [
      createKey({ x: 0, y: 0, width: 1, height: 1 }),
      createKey({ x: 1, y: 0, width: 1, height: 1, sm: 'rot_ec11' }),
    ]
    const options: PlateBuilderOptions = {
      cutoutType: 'cherry-mx-basic',
      rotaryEncoderHandwired: true,
    }

    const result = await buildPlate(keys, options)
    const polylines = parseDxfPolylines(result.dxfContent)

    expect(polylines).toHaveLength(2)
    const rect = polylines.find((p) => p.length === 4)
    const circle = polylines.find((p) => p.length > 4)
    expect(rect).toBeDefined()
    expect(circle).toBeDefined()
    expect(polylineDimensions(rect!).width).toBe(14)
    expect(polylineDimensions(rect!).height).toBe(14)
    expect(isCircular(circle!, 4)).toBe(true)
  })
})
