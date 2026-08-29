import { describe, it, expect } from 'vitest'
import * as yaml from 'js-yaml'
import { gunzipSync } from 'node:zlib'
import {
  convertKleToKeymapDrawerLayout,
  formatKeymapDrawerLayoutJson,
  buildKeymapDrawerYamlSkeleton,
  buildKeymapDrawerWebAppUrl,
  isKeymapDrawerWebAppShareSupported,
} from '../keymap-drawer-export'

// Mirrors qmk-export.spec.ts's makeKleInternal() fixture builder.
function makeKleInternal(
  keys: Array<{
    labels?: string[]
    x?: number
    y?: number
    w?: number
    h?: number
    r?: number
    rx?: number
    ry?: number
    x2?: number
    y2?: number
    width2?: number
    height2?: number
    decal?: boolean
    ghost?: boolean
  }>,
  meta?: Record<string, unknown>,
) {
  return {
    meta: { name: '', author: '', ...meta },
    keys: keys.map((k) => {
      const labels = k.labels ?? []
      return {
        labels: [...labels, ...Array(12 - labels.length).fill('')],
        x: k.x ?? 0,
        y: k.y ?? 0,
        width: k.w ?? 1,
        height: k.h ?? 1,
        x2: k.x2 ?? 0,
        y2: k.y2 ?? 0,
        width2: k.width2 ?? k.w ?? 1,
        height2: k.height2 ?? k.h ?? 1,
        rotation_angle: k.r ?? 0,
        rotation_x: k.rx ?? 0,
        rotation_y: k.ry ?? 0,
        color: '#cccccc',
        textColor: Array(12).fill(''),
        textSize: Array(12).fill(0),
        decal: k.decal ?? false,
        ghost: k.ghost ?? false,
        stepped: false,
        nub: false,
        profile: '',
        sm: '',
        sb: '',
        st: '',
        switchRotation: 0,
        stabRotation: 0,
      }
    }),
  }
}

describe('convertKleToKeymapDrawerLayout', () => {
  it('omits w/h/r/rx/ry for a flat, default-sized layout', () => {
    const kle = makeKleInternal([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ])

    const layout = convertKleToKeymapDrawerLayout(kle)

    expect(layout).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ])
  })

  it('emits w/h only when they differ from 1', () => {
    const kle = makeKleInternal([{ x: 0, y: 0, w: 1.25, h: 2 }])

    const layout = convertKleToKeymapDrawerLayout(kle)

    expect(layout).toEqual([{ x: 0, y: 0, w: 1.25, h: 2 }])
  })

  it('matches resources/extra_layouts/corne_rotated.json thumb-row values exactly', () => {
    const kle = makeKleInternal([
      { x: 3.5, y: 3.158 },
      { x: 4.6, y: 3.305, r: 15, rx: 5.1, ry: 3.805 },
      { x: 5.77, y: 3.255, h: 1.5, r: 30, rx: 6.27, ry: 4.005 },
      { x: 8.23, y: 3.255, h: 1.5, r: -30, rx: 8.73, ry: 4.005 },
      { x: 9.4, y: 3.305, r: -15, rx: 9.9, ry: 3.805 },
      { x: 10.5, y: 3.158 },
    ])

    const layout = convertKleToKeymapDrawerLayout(kle)

    expect(layout).toEqual([
      { x: 3.5, y: 3.158 },
      { x: 4.6, y: 3.305, r: 15, rx: 5.1, ry: 3.805 },
      { x: 5.77, y: 3.255, h: 1.5, r: 30, rx: 6.27, ry: 4.005 },
      { x: 8.23, y: 3.255, h: 1.5, r: -30, rx: 8.73, ry: 4.005 },
      { x: 9.4, y: 3.305, r: -15, rx: 9.9, ry: 3.805 },
      { x: 10.5, y: 3.158 },
    ])
  })

  it('always emits rx/ry when r != 0, even if they round to 0', () => {
    const kle = makeKleInternal([{ x: 0, y: 0, r: 10, rx: 0, ry: 0 }])

    const layout = convertKleToKeymapDrawerLayout(kle)

    expect(layout).toEqual([{ x: 0, y: 0, r: 10, rx: 0, ry: 0 }])
  })

  it('excludes ghost and decal keys', () => {
    const kle = makeKleInternal([
      { x: 0, y: 0, ghost: true },
      { x: 1, y: 0, decal: true },
      { x: 2, y: 0 },
    ])

    const layout = convertKleToKeymapDrawerLayout(kle)

    expect(layout).toEqual([{ x: 2, y: 0 }])
  })

  it('drops stepped/ISO secondary-rect fields, keeping the primary rect unchanged', () => {
    const kle = makeKleInternal([{ x: 0, y: 0, x2: -0.25, y2: 0, width2: 1.75, height2: 1 }])

    const layout = convertKleToKeymapDrawerLayout(kle)

    expect(layout).toEqual([{ x: 0, y: 0 }])
  })

  it('returns null for input with no regular keys', () => {
    expect(convertKleToKeymapDrawerLayout(makeKleInternal([]))).toBeNull()
    expect(
      convertKleToKeymapDrawerLayout(makeKleInternal([{ x: 0, y: 0, ghost: true }])),
    ).toBeNull()
  })

  it('returns null for invalid input', () => {
    expect(convertKleToKeymapDrawerLayout(null)).toBeNull()
    expect(convertKleToKeymapDrawerLayout('not a layout')).toBeNull()
    expect(convertKleToKeymapDrawerLayout(42)).toBeNull()
  })
})

describe('formatKeymapDrawerLayoutJson', () => {
  it('renders one compact key object per line', () => {
    const json = formatKeymapDrawerLayoutJson([
      { x: 0, y: 0 },
      { x: 4.6, y: 3.305, r: 15, rx: 5.1, ry: 3.805 },
    ])

    expect(json).toBe(
      '[\n' +
        '  {"x": 0, "y": 0},\n' +
        '  {"x": 4.6, "y": 3.305, "r": 15, "rx": 5.1, "ry": 3.805}\n' +
        ']',
    )
    expect(JSON.parse(json)).toEqual([
      { x: 0, y: 0 },
      { x: 4.6, y: 3.305, r: 15, rx: 5.1, ry: 3.805 },
    ])
  })

  it('renders an empty layout as []', () => {
    expect(formatKeymapDrawerLayoutJson([])).toBe('[]')
  })
})

describe('buildKeymapDrawerYamlSkeleton', () => {
  it('produces valid YAML referencing the layout filename with one empty layer entry per key', () => {
    const layout = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]
    const doc = buildKeymapDrawerYamlSkeleton(layout, 'my-board-keymap-drawer.json')

    const parsed = yaml.load(doc) as {
      layout: { qmk_info_json: string }
      layers: { default: string[] }
      combos: unknown[]
    }

    expect(parsed.layout.qmk_info_json).toBe('my-board-keymap-drawer.json')
    expect(parsed.layers.default).toHaveLength(3)
    expect(parsed.layers.default.every((v) => v === '')).toBe(true)
    expect(parsed.combos).toEqual([])
  })
})

describe('isKeymapDrawerWebAppShareSupported', () => {
  it('reflects CompressionStream availability', () => {
    expect(isKeymapDrawerWebAppShareSupported()).toBe(typeof CompressionStream !== 'undefined')
  })
})

describe('buildKeymapDrawerWebAppUrl', () => {
  // Decodes exactly as kd_web/utils.py::decode_permalink_param does: percent-decode,
  // base64-decode with '-'/'_' swapped back to '+'/'/', then gunzip.
  function decodePermalinkParam(param: string): string {
    const b64 = decodeURIComponent(param).replace(/-/g, '+').replace(/_/g, '/')
    return gunzipSync(Buffer.from(b64, 'base64')).toString('utf-8')
  }

  it('produces a caksoylar.github.io/keymap-drawer URL whose keymap_yaml param round-trips', async () => {
    const layout = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]
    const url = await buildKeymapDrawerWebAppUrl(layout, 'my-board-keymap-drawer.json')

    expect(url.startsWith('https://caksoylar.github.io/keymap-drawer?keymap_yaml=')).toBe(true)

    const param = url.split('?keymap_yaml=')[1]!
    const decoded = decodePermalinkParam(param)

    expect(decoded).toBe(buildKeymapDrawerYamlSkeleton(layout, 'my-board-keymap-drawer.json'))
  })
})
