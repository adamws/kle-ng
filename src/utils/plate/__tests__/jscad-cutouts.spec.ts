import { describe, it, expect } from 'vitest'
import { Key } from '@adamws/kle-serial'
import * as jscadModeling from '@jscad/modeling'
import { placeGeom2, type Geom2 } from '../jscad-cutouts/geom-utils'
import {
  createRectangleSwitchGeom,
  createCherryMxOpenableGeom,
} from '../jscad-cutouts/switch-cutouts'

/** Cherry MX Openable notch width (mm) — matches MX_OPENABLE_NOTCH_WIDTH in switch-cutouts.ts */
const MX_OPENABLE_NOTCH_WIDTH = 0.8
import {
  createMxBasicStabGeoms,
  createMxSpecStabGeoms,
  createAlpsStabGeoms,
} from '../jscad-cutouts/stabilizer-cutouts'
import { createCircleHoleGeom } from '../jscad-cutouts/hole-cutouts'
import { buildPlate, type PlateBuilderOptions } from '../plate-builder'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Bounding box over ALL outlines of a Geom2 (handles disjoint/multi-chain shapes). */
function bbox(geom: Geom2) {
  const outlines: number[][][] = jscadModeling.geometries.geom2.toOutlines(geom)
  const allPts = outlines.flatMap((o) => o as [number, number][])
  const xs = allPts.map(([x]) => x)
  const ys = allPts.map(([, y]) => y)
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
    centerX: (Math.min(...xs) + Math.max(...xs)) / 2,
    centerY: (Math.min(...ys) + Math.max(...ys)) / 2,
  }
}

function createKey(overrides: Partial<Key> = {}): Key {
  const key = new Key()
  return Object.assign(key, overrides)
}

const RECTANGULAR_OUTLINE: PlateBuilderOptions['outline'] = {
  outlineType: 'rectangular',
  marginTop: 5,
  marginBottom: 5,
  marginLeft: 5,
  marginRight: 5,
  tightMargin: 5,
  mergeWithCutouts: false,
  filletRadius: 0,
}

// ---------------------------------------------------------------------------
// geom-utils: placeGeom2
// ---------------------------------------------------------------------------

describe('placeGeom2', () => {
  it('translates a 10×10 rectangle to (5, 3) with no rotation', () => {
    const base = createRectangleSwitchGeom({ width: 10, height: 10 })
    const placed = placeGeom2(base, 5, 3, 0)
    const b = bbox(placed)
    expect(b.minX).toBeCloseTo(0, 6)
    expect(b.maxX).toBeCloseTo(10, 6)
    expect(b.minY).toBeCloseTo(-2, 6)
    expect(b.maxY).toBeCloseTo(8, 6)
  })

  it('rotating a square 90° preserves width and height', () => {
    const base = createRectangleSwitchGeom({ width: 10, height: 10 })
    const placed = placeGeom2(base, 0, 0, 90)
    const b = bbox(placed)
    expect(b.width).toBeCloseTo(10, 4)
    expect(b.height).toBeCloseTo(10, 4)
  })
})

// ---------------------------------------------------------------------------
// switch-cutouts: createRectangleSwitchGeom
// ---------------------------------------------------------------------------

describe('createRectangleSwitchGeom', () => {
  it('14×14 Cherry MX basic — bbox matches exactly', () => {
    const geom = createRectangleSwitchGeom({ width: 14, height: 14 })
    const b = bbox(geom)
    expect(b.width).toBeCloseTo(14, 6)
    expect(b.height).toBeCloseTo(14, 6)
  })

  it('15.5×12.8 Alps SKCM — bbox matches exactly', () => {
    const geom = createRectangleSwitchGeom({ width: 15.5, height: 12.8 })
    const b = bbox(geom)
    expect(b.width).toBeCloseTo(15.5, 6)
    expect(b.height).toBeCloseTo(12.8, 6)
  })
})

// ---------------------------------------------------------------------------
// switch-cutouts: createCherryMxOpenableGeom
// ---------------------------------------------------------------------------

describe('createCherryMxOpenableGeom', () => {
  it('14×14 base — total width = base + 2 notch widths, height = base', () => {
    const geom = createCherryMxOpenableGeom({ width: 14, height: 14, filletRadius: 0 })
    const b = bbox(geom)
    // 3 decimal places (0.001mm) is sufficient; JSCAD boolean union introduces tiny fp residuals
    expect(b.width).toBeCloseTo(14 + 2 * MX_OPENABLE_NOTCH_WIDTH, 3)
    expect(b.height).toBeCloseTo(14, 3)
  })

  it('centered at origin', () => {
    const geom = createCherryMxOpenableGeom({ width: 14, height: 14, filletRadius: 0 })
    const b = bbox(geom)
    expect(b.centerX).toBeCloseTo(0, 3)
    expect(b.centerY).toBeCloseTo(0, 3)
  })
})

// ---------------------------------------------------------------------------
// stabilizer-cutouts: createMxBasicStabGeoms
// ---------------------------------------------------------------------------

describe('createMxBasicStabGeoms', () => {
  it('2U key — returns non-null pair with centers at ±11.938mm', () => {
    const result = createMxBasicStabGeoms('mx-basic', { keyWidth: 2, keyHeight: 1 })
    expect(result).not.toBeNull()
    const [left, right] = result!
    expect(bbox(left).centerX).toBeCloseTo(-11.938, 3)
    expect(bbox(right).centerX).toBeCloseTo(11.938, 3)
  })

  it('2U key — both pads have Y center at -1.5mm (moveYBase + h/2)', () => {
    const result = createMxBasicStabGeoms('mx-basic', { keyWidth: 2, keyHeight: 1 })
    const [left, right] = result!
    expect(bbox(left).centerY).toBeCloseTo(-1.5, 3)
    expect(bbox(right).centerY).toBeCloseTo(-1.5, 3)
  })

  it('2U key — pad dimensions match MX_BASIC_STAB (7×15mm)', () => {
    const result = createMxBasicStabGeoms('mx-basic', { keyWidth: 2, keyHeight: 1 })
    const [left, right] = result!
    expect(bbox(left).width).toBeCloseTo(7, 4)
    expect(bbox(left).height).toBeCloseTo(15, 4)
    expect(bbox(right).width).toBeCloseTo(7, 4)
    expect(bbox(right).height).toBeCloseTo(15, 4)
  })

  it('1U key — returns null (no stabilizer needed)', () => {
    const result = createMxBasicStabGeoms('mx-basic', { keyWidth: 1, keyHeight: 1 })
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// stabilizer-cutouts: createMxSpecStabGeoms
// ---------------------------------------------------------------------------

describe('createMxSpecStabGeoms', () => {
  it('2U key — returns non-null pair', () => {
    const result = createMxSpecStabGeoms({ keyWidth: 2, keyHeight: 1 })
    expect(result).not.toBeNull()
  })

  it('2U key — left and right pads are X-mirrors (symmetric about X=0)', () => {
    const result = createMxSpecStabGeoms({ keyWidth: 2, keyHeight: 1 })
    const [left, right] = result!
    const lb = bbox(left)
    const rb = bbox(right)
    expect(lb.minX).toBeCloseTo(-rb.maxX, 2)
    expect(lb.maxX).toBeCloseTo(-rb.minX, 2)
    expect(lb.minY).toBeCloseTo(rb.minY, 2)
    expect(lb.maxY).toBeCloseTo(rb.maxY, 2)
  })
})

// ---------------------------------------------------------------------------
// stabilizer-cutouts: createAlpsStabGeoms
// ---------------------------------------------------------------------------

describe('createAlpsStabGeoms', () => {
  it('2U Alps AEK key — returns non-null pair with symmetric X centers', () => {
    const result = createAlpsStabGeoms('alps-aek', { keyWidth: 2, keyHeight: 1 })
    expect(result).not.toBeNull()
    const [left, right] = result!
    expect(bbox(left).centerX).toBeCloseTo(-bbox(right).centerX, 3)
  })

  it('1U key — returns null (no stabilizer needed)', () => {
    const result = createAlpsStabGeoms('alps-aek', { keyWidth: 1, keyHeight: 1 })
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// hole-cutouts: createCircleHoleGeom
// ---------------------------------------------------------------------------

describe('createCircleHoleGeom', () => {
  it('radius 3 — bbox width and height ≈ 6mm (diameter)', () => {
    const geom = createCircleHoleGeom(3)
    const b = bbox(geom)
    expect(b.width).toBeCloseTo(6, 1)
    expect(b.height).toBeCloseTo(6, 1)
  })

  it('centered at origin', () => {
    const geom = createCircleHoleGeom(3)
    const b = bbox(geom)
    expect(b.centerX).toBeCloseTo(0, 4)
    expect(b.centerY).toBeCloseTo(0, 4)
  })
})

// ---------------------------------------------------------------------------
// JSCAD script content tests (via buildPlate)
// ---------------------------------------------------------------------------

describe('buildJscadScript output content', () => {
  const keys = [createKey({ x: 0, y: 0, width: 2, height: 1 })]

  it('split keyboard with tight outline — both halves appear as outline_0 + outline_1 union', async () => {
    // Two separate key clusters with a large gap between them — tight outline produces 2 disjoint chains
    const splitKeys = [
      createKey({ x: 0, y: 0, width: 1, height: 1 }),
      createKey({ x: 20, y: 0, width: 1, height: 1 }), // 20U gap ensures disjoint outlines
    ]
    const result = await buildPlate(splitKeys, {
      cutoutType: 'cherry-mx-basic',
      outline: {
        outlineType: 'tight',
        marginTop: 2,
        marginBottom: 2,
        marginLeft: 2,
        marginRight: 2,
        tightMargin: 2,
        mergeWithCutouts: false,
        filletRadius: 0,
      },
    })
    expect(result.jscadScript).toBeDefined()
    expect(result.jscadScript).toContain('const outline_0 = polygon({')
    expect(result.jscadScript).toContain('const outline_1 = polygon({')
    expect(result.jscadScript).toContain('const outline = union(outline_0, outline_1)')
  })

  it('cherry-mx-openable script uses union(base, notches), not subtract', async () => {
    const result = await buildPlate(keys, {
      cutoutType: 'cherry-mx-openable',
      outline: RECTANGULAR_OUTLINE,
    })
    expect(result.jscadScript).toBeDefined()
    expect(result.jscadScript).toContain('union(switch_0_base, switch_0_notches)')
    expect(result.jscadScript).not.toContain('subtract(switch_0_base')
  })

  it('cherry-mx-alps-hybrid script unions Cherry and Alps rectangles', async () => {
    const result = await buildPlate(keys, {
      cutoutType: 'cherry-mx-alps-hybrid',
      outline: RECTANGULAR_OUTLINE,
    })
    expect(result.jscadScript).toBeDefined()
    // Cherry (14×14) and Alps (15.5×12.8) rectangles unioned about a shared center.
    expect(result.jscadScript).toContain('const switch_0_cherry = rectangle({ size: [14, 14] })')
    expect(result.jscadScript).toContain('const switch_0_alps = rectangle({ size: [15.5, 12.8] })')
    expect(result.jscadScript).toContain('union(switch_0_cherry, switch_0_alps)')
  })

  it('mx-spec stab script contains polygon({ points:', async () => {
    const result = await buildPlate(keys, {
      cutoutType: 'cherry-mx-basic',
      stabilizerType: 'mx-spec',
      outline: RECTANGULAR_OUTLINE,
    })
    expect(result.jscadScript).toBeDefined()
    expect(result.jscadScript).toContain('polygon({ points:')
  })

  it('mounting holes script contains circle(', async () => {
    const result = await buildPlate(keys, {
      cutoutType: 'cherry-mx-basic',
      outline: RECTANGULAR_OUTLINE,
      mountingHoles: { enabled: true, diameter: 3, edgeDistance: 5 },
    })
    expect(result.jscadScript).toBeDefined()
    expect(result.jscadScript).toContain('circle(')
  })
})

// ---------------------------------------------------------------------------
// Rotary encoder cutouts (sm === 'rot_ec11')
// ---------------------------------------------------------------------------

describe('rotary encoder cutouts', () => {
  const encoderKey = createKey({ x: 0, y: 0, width: 1, height: 1, sm: 'rot_ec11' })

  it('PCB build (default): encoder emits a 14×14 rectangle, no stabilizer, no backside pocket', async () => {
    const result = await buildPlate([encoderKey], {
      cutoutType: 'cherry-mx-basic',
      stabilizerType: 'mx-basic',
      outline: RECTANGULAR_OUTLINE,
      backsideDepth: 1,
    })
    expect(result.jscadScript).toBeDefined()
    // 14×14 rectangle (registered as a shared shape), no circle, no stab, no pocket.
    expect(result.jscadScript).toContain('rectangle({ size: [14, 14] })')
    expect(result.jscadScript).not.toContain('circle(')
    expect(result.jscadScript).not.toContain('stab_0')
    expect(result.jscadScript).not.toContain('encoder_backside')
  })

  it('handwired: emits a 4mm circle switch cutout and no stabilizer, even when stab type is set', async () => {
    const result = await buildPlate([encoderKey], {
      cutoutType: 'cherry-mx-basic',
      stabilizerType: 'mx-basic',
      rotaryEncoderHandwired: true,
      outline: RECTANGULAR_OUTLINE,
    })
    expect(result.jscadScript).toBeDefined()
    expect(result.jscadScript).toContain('const switch_0 = circle({ radius: 4 })')
    expect(result.jscadScript).not.toContain('stab_0')
  })

  it('handwired: applies kerf compensation to the circle radius (4 − sizeAdjust/2)', async () => {
    const result = await buildPlate([encoderKey], {
      cutoutType: 'cherry-mx-basic',
      rotaryEncoderHandwired: true,
      sizeAdjust: 0.5,
      outline: RECTANGULAR_OUTLINE,
    })
    expect(result.jscadScript).toContain('const switch_0 = circle({ radius: 3.75 })')
  })

  it('handwired: emits a 15×15 backside pocket when backsideDepth > 0, and no snap notch', async () => {
    const result = await buildPlate([encoderKey], {
      cutoutType: 'cherry-mx-basic',
      rotaryEncoderHandwired: true,
      outline: RECTANGULAR_OUTLINE,
      backsideDepth: 1,
      backsideFeatures: [{ type: 'cherry-mx-snap-notch', enabled: true }],
    })
    expect(result.jscadScript).toContain('encoder_backside_0')
    expect(result.jscadScript).toContain('cuboid({ size: [15, 15, 1] })')
    expect(result.jscadScript).not.toContain('snap_notch')
  })

  it('handwired: omits the backside pocket when backsideDepth is 0', async () => {
    const result = await buildPlate([encoderKey], {
      cutoutType: 'cherry-mx-basic',
      rotaryEncoderHandwired: true,
      outline: RECTANGULAR_OUTLINE,
      backsideDepth: 0,
    })
    expect(result.jscadScript).not.toContain('encoder_backside')
  })

  it('mixed handwired layout: normal switch gets a rectangle, encoder gets a circle', async () => {
    const mixed = [
      createKey({ x: 0, y: 0, width: 1, height: 1 }),
      createKey({ x: 1, y: 0, width: 1, height: 1, sm: 'rot_ec11' }),
    ]
    const result = await buildPlate(mixed, {
      cutoutType: 'cherry-mx-basic',
      rotaryEncoderHandwired: true,
      outline: RECTANGULAR_OUTLINE,
    })
    // The rectangle switch is registered as a shared shape; the encoder is a circle.
    expect(result.jscadScript).toContain('rectangle({ size: [14, 14] })')
    expect(result.jscadScript).toContain(
      'const switch_1 = translate([19.05, 0, 0], circle({ radius: 4 }))',
    )
  })
})
