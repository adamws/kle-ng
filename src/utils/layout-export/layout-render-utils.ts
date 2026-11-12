import type { Key, KeyboardMetadata } from '@adamws/kle-serial'
import type { LayoutRenderInput, KeyRenderData, LabelData } from './LayoutRendererTypes'
import { BoundsCalculator } from '../utils/BoundsCalculator'
export { lightenColor } from '../color-utils'
import { lightenColor } from '../color-utils'
import { LABEL_POSITIONS } from '../label-positions'
import { isNonRectangular } from '../key-utils'

export const DEFAULT_UNIT = 54

/** Visual padding around the key area — matches KeyboardCanvas.vue CANVAS_BORDER */
export const LAYOUT_PADDING = 9

/** Escape text for safe embedding in HTML/SVG attributes and content */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** Sanitize a label string for safe embedding in HTML template literals */
export function sanitizeLabelForHtml(s: string): string {
  return s.replace(/`/g, '&#96;').replace(/<\/script/gi, '<\\/script')
}

/** Get the label at a given index from a key, sanitized for HTML */
export function getLabelAtIndex(key: Key, index: number): string {
  if (key.labels && Array.isArray(key.labels)) {
    const v = key.labels[index]
    if (typeof v === 'string' && v.trim().length > 0) {
      return sanitizeLabelForHtml(v)
    }
  }
  return ''
}

/**
 * Normalize raw store data into a LayoutRenderInput.
 * Pure function — no Vue/store dependencies.
 */
export function normalizeLayoutInput(
  keys: Key[],
  metadata: KeyboardMetadata,
  filename: string,
  unit: number = DEFAULT_UNIT,
): LayoutRenderInput {
  // Use BoundsCalculator to get the true axis-aligned bounding box, which
  // accounts for rotation by transforming all 4 key corners and finding min/max.
  const boundsCalc = new BoundsCalculator(unit)
  const bounds = boundsCalc.calculateBounds(keys)

  // Pixel-space minimum corner (may differ from key.x * unit when keys are rotated)
  const minPxX = bounds.x
  const minPxY = bounds.y

  const boardWidth = Math.max(0, bounds.width) + LAYOUT_PADDING * 2
  const boardHeight = Math.max(0, bounds.height) + LAYOUT_PADDING * 2

  const normalizedKeys: KeyRenderData[] = keys.map((key) => {
    const darkColor = key.color || '#cccccc'
    const lightColor = lightenColor(darkColor)

    const width = Number(key.width ?? 1) * unit
    const height = Number(key.height ?? 1) * unit
    const maxWidth = Math.max(1, width - 16)
    const maxHeight = Math.max(1, height - 18)

    const labels: LabelData[] = []
    for (let i = 0; i < 12; i++) {
      const text = getLabelAtIndex(key, i)
      if (!text) continue

      const textSize = key.textSize[i] || key.default.textSize || 3
      let fontSize = 6 + 2 * textSize
      if (i >= 9) {
        fontSize = Math.min(10, fontSize * 0.8)
      }

      const color = key.textColor[i] || key.default.textColor || '#000000'
      const { align, baseline } = LABEL_POSITIONS[i]!

      let relX: number
      if (align === 'left') relX = 8
      else if (align === 'right') relX = width - 8
      else relX = width / 2

      let relY: number
      if (i <= 2)
        relY = 4 // top row: hanging
      else if (i <= 5)
        relY = height / 2 - 2 // middle row: middle
      else if (i <= 8)
        relY = height - 14 // bottom row: alphabetic
      else relY = height - 8 // front row: hanging

      labels.push({ text, fontSize, color, align, baseline, relX, relY, maxWidth, maxHeight })
    }

    const ghost = key.ghost || false
    const decal = key.decal || false
    const nub = key.nub || false
    const isRotaryEncoder = key.sm === 'rot_ec11'
    const nonRect = isNonRectangular(key)
    const stepped = nonRect && (key.stepped || false)

    let left2: number | undefined
    let top2: number | undefined
    let width2: number | undefined
    let height2: number | undefined

    if (nonRect) {
      left2 = (key.x + (key.x2 || 0)) * unit - minPxX + LAYOUT_PADDING
      top2 = (key.y + (key.y2 || 0)) * unit - minPxY + LAYOUT_PADDING
      width2 = (key.width2 || key.width) * unit
      height2 = (key.height2 || key.height) * unit
    }

    return {
      left: key.x * unit - minPxX + LAYOUT_PADDING,
      top: key.y * unit - minPxY + LAYOUT_PADDING,
      width,
      height,
      labels,
      rotationAngle: key.rotation_angle || 0,
      rotationOriginX: (key.rotation_x || 0) * unit - minPxX + LAYOUT_PADDING,
      rotationOriginY: (key.rotation_y || 0) * unit - minPxY + LAYOUT_PADDING,
      darkColor,
      lightColor,
      ...(ghost && { ghost }),
      ...(decal && { decal }),
      ...(nub && { nub }),
      ...(isRotaryEncoder && { isRotaryEncoder }),
      ...(nonRect && { left2, top2, width2, height2 }),
      ...(stepped && { stepped }),
    }
  })

  return {
    layoutName: metadata.name || filename || 'Keyboard Layout',
    author: metadata.author || '',
    backColor: metadata.backcolor || '#ffffff',
    radiiValue: metadata.radii?.trim() || '6px',
    unit,
    boardWidth,
    boardHeight,
    keys: normalizedKeys,
  }
}
