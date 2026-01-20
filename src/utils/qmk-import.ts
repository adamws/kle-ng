import { Key, Keyboard, KeyboardMetadata } from '@adamws/kle-serial'
import { createEmptyLabels } from '@/utils/array-helpers'

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
 * Create a key identity string for deduplication
 * Keys are considered identical if they have the same position and properties
 * (except for layout option label)
 */
function getKeyIdentity(key: Key, excludeLayoutOption = true): string {
  const props = {
    x: key.x,
    y: key.y,
    width: key.width,
    height: key.height,
    rotation_angle: key.rotation_angle,
    rotation_x: key.rotation_x,
    rotation_y: key.rotation_y,
    matrix: key.labels[0], // Matrix position
    // Exclude labels[8] (layout option) from identity comparison if requested
    layoutOption: excludeLayoutOption ? undefined : key.labels[8],
  }
  return JSON.stringify(props)
}

/**
 * Convert QMK info.json format to KLE Keyboard object
 *
 * Process:
 * 1. Iterate through all layouts in qmkData.layouts
 * 2. For each key in each layout:
 *    - Create Key object with x, y, width, height, rotation properties
 *    - Store matrix coordinates in labels[0] as "row,col" string
 *    - Store layout option index in labels[8] as "0,layoutIndex"
 * 3. Deduplicate keys across layouts (same position, same properties except label[8])
 * 4. Sort keys by matrix position
 * 5. Return Keyboard object with metadata populated from QMK fields
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

  // Collect all keys from all layouts
  const allKeys: Key[] = []
  const layoutNames = Object.keys(data.layouts)

  // Track keys by matrix position for deduplication
  // Key: "row,col", Value: array of keys at that position
  const keysByMatrix: Map<string, Key[]> = new Map()

  layoutNames.forEach((layoutName, layoutIndex) => {
    const layout = data.layouts[layoutName]
    if (!layout || !Array.isArray(layout.layout)) {
      return
    }

    layout.layout.forEach((item) => {
      // Validate required fields
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

      // Create KLE key
      const key = new Key()
      key.x = item.x
      key.y = item.y

      // Set dimensions - QMK only supports rectangular keys
      // Set secondary dimensions equal to primary to ensure rectangular keys
      // and avoid unnecessary w2/h2 in serialized output
      if (item.w !== undefined && item.w !== 1) {
        key.width = item.w
      }
      if (item.h !== undefined && item.h !== 1) {
        key.height = item.h
      }
      // Ensure keys are rectangular (QMK doesn't support stepped/ISO-style keys)
      key.width2 = key.width
      key.height2 = key.height

      // Set optional rotation
      if (item.r !== undefined && item.r !== 0) {
        key.rotation_angle = item.r
      }
      if (item.rx !== undefined) {
        key.rotation_x = item.rx
      }
      if (item.ry !== undefined) {
        key.rotation_y = item.ry
      }

      // Initialize labels array
      key.labels = createEmptyLabels()

      // Store matrix coordinates in label position 0
      key.labels[0] = matrixPos

      // Store layout option in label position 8
      // Format: "option,choice" where option is always 0 for QMK imports
      // and choice is the layout index
      if (layoutNames.length > 1) {
        key.labels[8] = `0,${layoutIndex}`
      }

      // Add to collection by matrix position
      if (!keysByMatrix.has(matrixPos)) {
        keysByMatrix.set(matrixPos, [])
      }
      keysByMatrix.get(matrixPos)!.push(key)
    })
  })

  // Deduplicate keys
  // Keys at the same matrix position that are identical (except layout option) should be merged
  keysByMatrix.forEach((keysAtPosition) => {
    if (keysAtPosition.length === 1) {
      // Single key at this position - clear layout option label since no variants
      const key = keysAtPosition[0]
      if (key) {
        key.labels[8] = ''
        allKeys.push(key)
      }
    } else {
      // Multiple keys at this position - deduplicate
      const uniqueKeys: Map<string, Key> = new Map()

      keysAtPosition.forEach((key) => {
        const identity = getKeyIdentity(key, true) // Exclude layout option from identity

        if (!uniqueKeys.has(identity)) {
          // First occurrence of this key configuration
          uniqueKeys.set(identity, key)
        }
        // If we already have this key configuration, skip (deduplicate)
      })

      // If after deduplication we have only one unique key, clear the layout option
      if (uniqueKeys.size === 1) {
        const key = uniqueKeys.values().next().value
        if (key) {
          key.labels[8] = ''
          allKeys.push(key)
        }
      } else {
        // Multiple unique configurations - keep all with their layout options
        uniqueKeys.forEach((key) => {
          allKeys.push(key)
        })
      }
    }
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
  return keyboard
}
