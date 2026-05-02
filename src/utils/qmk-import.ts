import { Key, Keyboard, KeyboardMetadata } from '@adamws/kle-serial'
import { createEmptyLabels } from '@/utils/array-helpers'
import LZString from 'lz-string'

/**
 * QMK key definition from info.json layout
 */
interface QmkKey {
  matrix: [number, number] // [row, col]
  x: number
  y: number
  w?: number // width (default: 1)
  h?: number // height (default: 1)
  r?: number // rotation angle
  rx?: number // rotation origin x
  ry?: number // rotation origin y
}

/**
 * QMK layout definition
 */
interface QmkLayout {
  layout: QmkKey[]
}

/**
 * QMK info.json data structure
 */
interface QmkData {
  keyboard_name?: string
  manufacturer?: string
  url?: string
  maintainer?: string
  layouts: Record<string, QmkLayout>
  [key: string]: unknown // Allow other properties
}

/**
 * Type guard to detect QMK info.json format
 *
 * QMK format is identified by:
 * - Having a `layouts` object
 * - At least one layout has a `layout` array
 * - Layout array contains objects with `matrix` and `x`, `y` properties
 */
export function isQmkFormat(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) {
    return false
  }

  const obj = data as Record<string, unknown>

  // Must have a 'layouts' object
  if (!obj.layouts || typeof obj.layouts !== 'object') {
    return false
  }

  const layouts = obj.layouts as Record<string, unknown>

  // Check if at least one layout has the correct structure
  for (const layoutName of Object.keys(layouts)) {
    const layout = layouts[layoutName]
    if (typeof layout !== 'object' || layout === null) {
      continue
    }

    const layoutObj = layout as Record<string, unknown>
    if (!Array.isArray(layoutObj.layout)) {
      continue
    }

    const layoutArray = layoutObj.layout as unknown[]
    if (layoutArray.length === 0) {
      continue
    }

    // Check if first key has required QMK properties
    const firstKey = layoutArray[0]
    if (typeof firstKey !== 'object' || firstKey === null) {
      continue
    }

    const keyObj = firstKey as Record<string, unknown>

    // QMK keys must have 'matrix' (array) and 'x', 'y' (numbers)
    if (
      Array.isArray(keyObj.matrix) &&
      keyObj.matrix.length === 2 &&
      typeof keyObj.x === 'number' &&
      typeof keyObj.y === 'number'
    ) {
      return true
    }
  }

  return false
}

/**
 * Extract metadata from QMK data
 */
export function extractQmkMetadata(qmkData: unknown): Partial<KeyboardMetadata> {
  const metadata: Partial<KeyboardMetadata> = {}

  if (typeof qmkData !== 'object' || qmkData === null) {
    return metadata
  }

  const data = qmkData as QmkData

  if (data.keyboard_name) {
    metadata.name = data.keyboard_name
  }

  if (data.manufacturer) {
    metadata.author = data.manufacturer
  }

  return metadata
}

/**
 * Create a key identity string for deduplication.
 * Two keys are considered the same physical key if they share matrix position
 * and all geometric properties. Labels[8] and labels[9] are excluded because
 * they carry metadata, not physical identity.
 */
function getKeyIdentity(key: Key): string {
  return JSON.stringify({
    matrix: key.labels[0],
    x: key.x,
    y: key.y,
    width: key.width,
    height: key.height,
    rotation_angle: key.rotation_angle,
    rotation_x: key.rotation_x,
    rotation_y: key.rotation_y,
  })
}

/**
 * Convert QMK info.json format to KLE Keyboard object.
 *
 * Process:
 * 1. Iterate through all layouts in qmkData.layouts
 * 2. For each unique (matrix, physical) key combination, track which layout
 *    indices include it using a membership map
 * 3. Assign labels[9] as semicolon-separated layout indices for layout-specific
 *    keys; shared keys (in every layout) get labels[9] = ''
 * 4. Sort keys by matrix position
 * 5. Return Keyboard object with metadata populated from QMK fields
 *
 * labels[9] uses the format "0", "1;2", "0;1;2", or "" (shared).
 * This does NOT use labels[8], so the VIA alternative-layouts toolbar is
 * never activated for QMK-imported keyboards.
 */
export function convertQmkToKle(qmkData: unknown): Keyboard {
  if (!isQmkFormat(qmkData)) {
    throw new Error('Invalid QMK format: missing layouts with layout arrays containing matrix data')
  }

  const data = qmkData as QmkData
  const keyboard = new Keyboard()

  // Extract metadata
  const meta = extractQmkMetadata(data)
  if (meta.name) keyboard.meta.name = meta.name
  if (meta.author) keyboard.meta.author = meta.author

  // Collect all layouts, building a membership map:
  //   key identity → { key object, set of layout indices that include it }
  const layoutNames = Object.keys(data.layouts)
  const membershipMap = new Map<string, { key: Key; indices: Set<number> }>()

  layoutNames.forEach((layoutName, layoutIndex) => {
    const layout = data.layouts[layoutName]
    if (!layout || !Array.isArray(layout.layout)) {
      return
    }

    layout.layout.forEach((item) => {
      if (
        !Array.isArray(item.matrix) ||
        item.matrix.length !== 2 ||
        typeof item.x !== 'number' ||
        typeof item.y !== 'number'
      ) {
        console.warn('Skipping invalid QMK key item:', item)
        return
      }

      const [row, col] = item.matrix
      const matrixPos = `${row},${col}`

      const key = new Key()
      key.x = item.x
      key.y = item.y

      if (item.w !== undefined && item.w !== 1) {
        key.width = item.w
      }
      if (item.h !== undefined && item.h !== 1) {
        key.height = item.h
      }
      // QMK doesn't support stepped/ISO-style keys
      key.width2 = key.width
      key.height2 = key.height

      if (item.r !== undefined && item.r !== 0) {
        key.rotation_angle = item.r
      }
      if (item.rx !== undefined) {
        key.rotation_x = item.rx
      }
      if (item.ry !== undefined) {
        key.rotation_y = item.ry
      }

      key.labels = createEmptyLabels()
      key.labels[0] = matrixPos

      const identity = getKeyIdentity(key)
      const existing = membershipMap.get(identity)
      if (existing) {
        existing.indices.add(layoutIndex)
      } else {
        membershipMap.set(identity, { key, indices: new Set([layoutIndex]) })
      }
    })
  })

  // Assign labels[9] = semicolon-separated layout indices for layout-specific keys.
  // Shared keys (present in every layout) get labels[9] = '' (no tag needed).
  // Single-layout QMK files also leave labels[9] empty (no membership ambiguity).
  const totalLayouts = layoutNames.length
  const allKeys: Key[] = []
  membershipMap.forEach(({ key, indices }) => {
    if (totalLayouts > 1 && indices.size < totalLayouts) {
      key.labels[9] = Array.from(indices)
        .sort((a, b) => a - b)
        .join(';')
    }
    allKeys.push(key)
  })

  // Sort keys by matrix position (row first, then column)
  allKeys.sort((a, b) => {
    const aPos = a.labels[0]?.split(',').map(Number) || [0, 0]
    const bPos = b.labels[0]?.split(',').map(Number) || [0, 0]

    const aRow = aPos[0] ?? 0
    const aCol = aPos[1] ?? 0
    const bRow = bPos[0] ?? 0
    const bCol = bPos[1] ?? 0

    if (aRow !== bRow) {
      return aRow - bRow
    }
    return aCol - bCol
  })

  keyboard.keys = allKeys

  // Embed QMK metadata (with layout key definitions stripped, names preserved)
  const qmkMetadataForStorage = {
    ...data,
    layouts: Object.fromEntries(Object.keys(data.layouts).map((name) => [name, {}])),
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(keyboard.meta as any)._kleng_qmk_data = LZString.compressToBase64(
    JSON.stringify(qmkMetadataForStorage),
  )

  return keyboard
}
