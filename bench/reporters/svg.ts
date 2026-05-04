import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Key } from '../../src/stores/keyboard'
import type { AnnotationResult } from '../../src/utils/matrix-annotation'
import { getKeyCenter } from '../../src/utils/keyboard-geometry'

const UNIT = 54          // pixels per keyboard unit
const PADDING = 20       // canvas padding in pixels
const TITLE_H = 20       // pixels reserved for the title at the top
const WIRE_WIDTH = 2     // wire stroke width

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

const ROW_COLORS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c',
  '#3498db', '#9b59b6', '#e91e63', '#ff5722', '#009688',
  '#8bc34a', '#00bcd4', '#673ab7', '#f44336', '#795548',
]

const COL_COLORS = [
  '#c0392b', '#d35400', '#c9a40b', '#27ae60', '#16a085',
  '#2980b9', '#8e44ad', '#c2185b', '#e64a19', '#00796b',
  '#689f38', '#0097a7', '#512da8', '#d32f2f', '#5d4037',
]

function rowColor(r: number): string {
  return ROW_COLORS[r % ROW_COLORS.length]!
}

function colColor(c: number): string {
  return COL_COLORS[c % COL_COLORS.length]!
}

// ---------------------------------------------------------------------------
// SVG coordinate helpers
//
// SVG coordinate system: x = 2*PADDING + u*UNIT, y = PADDING + v*UNIT + TITLE_H
// (double padding on x because the SVG element is declared PADDING*2 wider than
// the content area; TITLE_H reserves space for the top title bar)
// ---------------------------------------------------------------------------

function svgX(u: number): number { return 2 * PADDING + u * UNIT }
function svgY(v: number): number { return PADDING + v * UNIT + TITLE_H }

// ---------------------------------------------------------------------------
// SVG element builders
// ---------------------------------------------------------------------------

function rect(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  transform?: string,
): string {
  const t = transform ? ` transform="${transform}"` : ''
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="1"${t}/>`
}

function line(x1: number, y1: number, x2: number, y2: number, color: string): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${WIRE_WIDTH}" stroke-linecap="round"/>`
}

function circle(cx: number, cy: number, r: number, color: string): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`
}

function text(x: number, y: number, content: string, fontSize = 8, color = '#333'): string {
  return `<text x="${x}" y="${y}" font-size="${fontSize}" fill="${color}" text-anchor="middle" dominant-baseline="middle" font-family="monospace">${content}</text>`
}

// ---------------------------------------------------------------------------
// Key geometry helpers
// ---------------------------------------------------------------------------

/** Returns the SVG pixel center of a key, correctly accounting for rotation. */
function keyCenterSvg(key: Key): { x: number; y: number } {
  const c = getKeyCenter(key)
  return { x: svgX(c.x), y: svgY(c.y) }
}

/** Returns all 4 corners of a key in keyboard units, rotated if needed. */
function rotatedCorners(k: Key): { x: number; y: number }[] {
  const w = k.width ?? 1
  const h = k.height ?? 1
  const corners = [
    { x: k.x,     y: k.y     },
    { x: k.x + w, y: k.y     },
    { x: k.x,     y: k.y + h },
    { x: k.x + w, y: k.y + h },
  ]
  if (!k.rotation_angle) return corners
  const rad = (k.rotation_angle * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const ox = k.rotation_x
  const oy = k.rotation_y
  return corners.map(({ x, y }) => {
    const dx = x - ox
    const dy = y - oy
    return { x: ox + dx * cos - dy * sin, y: oy + dx * sin + dy * cos }
  })
}

/** SVG transform string that rotates around a key's rotation origin, or '' for non-rotated keys. */
function keyRotateTransform(k: Key): string {
  if (!k.rotation_angle) return ''
  const cx = svgX(k.rotation_x).toFixed(2)
  const cy = svgY(k.rotation_y).toFixed(2)
  return `rotate(${k.rotation_angle}, ${cx}, ${cy})`
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

export function renderSvg(
  layoutName: string,
  algorithmName: string,
  keys: ReadonlyArray<Key>,
  result: AnnotationResult,
): string {
  // Determine canvas size from rotated key extents
  let maxX = 0
  let maxY = 0
  keys.forEach((k) => {
    for (const corner of rotatedCorners(k as Key)) {
      maxX = Math.max(maxX, corner.x)
      maxY = Math.max(maxY, corner.y)
    }
  })
  const svgW = svgX(maxX) + PADDING
  const svgH = svgY(maxY) + PADDING + 10

  const elements: string[] = []

  // Title
  elements.push(
    `<text x="${svgW / 2}" y="14" font-size="12" fill="#333" text-anchor="middle" font-family="sans-serif" font-weight="bold">${layoutName} / ${algorithmName}</text>`,
  )

  // Build row/col maps for wire rendering
  const rowMap = new Map<number, Key[]>()
  const colMap = new Map<number, Key[]>()
  keys.forEach((k, i) => {
    const a = result.assignments[i]
    if (!a || a.row === null || a.col === null) return
    if (!rowMap.has(a.row)) rowMap.set(a.row, [])
    if (!colMap.has(a.col)) colMap.set(a.col, [])
    rowMap.get(a.row)!.push(k as Key)
    colMap.get(a.col)!.push(k as Key)
  })

  // Sort row keys by center X, col keys by center Y (mirrors scoring.ts)
  rowMap.forEach((list) => list.sort((a, b) => getKeyCenter(a).x - getKeyCenter(b).x))
  colMap.forEach((list) => list.sort((a, b) => getKeyCenter(a).y - getKeyCenter(b).y))

  // Draw key backgrounds — rotated keys use an SVG transform on the rect
  keys.forEach((k) => {
    if (k.ghost) return
    const fill = k.decal ? '#f0f0f0' : '#d8d8d8'
    const kx = svgX(k.x) + 1
    const ky = svgY(k.y) + 1
    const kw = (k.width ?? 1) * UNIT - 2
    const kh = (k.height ?? 1) * UNIT - 2
    const transform = keyRotateTransform(k as Key)
    elements.push(rect(kx, ky, kw, kh, fill, '#aaa', transform || undefined))
  })

  // Draw column wires (behind row wires)
  colMap.forEach((colKeys, colIdx) => {
    const color = colColor(colIdx)
    for (let i = 1; i < colKeys.length; i++) {
      const a = keyCenterSvg(colKeys[i - 1]!)
      const b = keyCenterSvg(colKeys[i]!)
      elements.push(line(a.x, a.y, b.x, b.y, color))
    }
    colKeys.forEach((k) => {
      const c = keyCenterSvg(k)
      elements.push(circle(c.x, c.y, 3, color))
    })
  })

  // Draw row wires (on top)
  rowMap.forEach((rowKeys, rowIdx) => {
    const color = rowColor(rowIdx)
    for (let i = 1; i < rowKeys.length; i++) {
      const a = keyCenterSvg(rowKeys[i - 1]!)
      const b = keyCenterSvg(rowKeys[i]!)
      elements.push(line(a.x, a.y, b.x, b.y, color))
    }
    rowKeys.forEach((k) => {
      const c = keyCenterSvg(k)
      elements.push(circle(c.x, c.y, 4, color))
    })
  })

  // Draw key labels at the rotated center position (readable, not rotated)
  keys.forEach((k, i) => {
    if (k.ghost || k.decal) return
    const a = result.assignments[i]
    const label = a && a.row !== null && a.col !== null ? `${a.row},${a.col}` : '?'
    const c = keyCenterSvg(k as Key)
    elements.push(text(c.x, c.y, label, 7))
  })

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW + PADDING * 2}" height="${svgH}" style="background:#fafafa">`,
    ...elements,
    '</svg>',
  ].join('\n')
}

export function writeSvgs(
  outDir: string,
  runs: { layoutName: string; algorithmName: string; keys: ReadonlyArray<Key>; result: AnnotationResult }[],
): void {
  mkdirSync(outDir, { recursive: true })
  for (const { layoutName, algorithmName, keys, result } of runs) {
    const svg = renderSvg(layoutName, algorithmName, keys, result)
    const filename = `${layoutName}__${algorithmName}.svg`
    writeFileSync(join(outDir, filename), svg, 'utf8')
    console.log(`  SVG: ${join(outDir, filename)}`)
  }
}
