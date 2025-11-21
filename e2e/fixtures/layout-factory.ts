/**
 * LayoutFactory - Programmatic test layout generation
 *
 * This factory provides methods to create common keyboard layouts
 * programmatically, reducing the need for JSON fixtures and making
 * tests more maintainable.
 *
 * @example
 * // Create a simple 3x3 grid with labels
 * const layout = LayoutFactory.createGrid(3, 3, { withLabels: true })
 *
 * // Create ANSI 104 layout
 * const ansi = LayoutFactory.createANSI104()
 */
export class LayoutFactory {
  /**
   * Create a simple grid layout
   *
   * @param rows - Number of rows
   * @param cols - Number of columns
   * @param options - Optional configuration
   * @returns Layout data in KLE format
   *
   * @example
   * // Create 3x3 grid with row,col labels
   * const layout = LayoutFactory.createGrid(3, 3, {
   *   withLabels: true,
   *   labelFormat: 'row,col'
   * })
   */
  static createGrid(
    rows: number,
    cols: number,
    options?: {
      withLabels?: boolean
      labelFormat?: 'row,col' | 'number' | 'letter'
      withColors?: boolean
      withRotation?: boolean
      rotationAngle?: number
    },
  ): unknown[] {
    const layout: unknown[] = []
    let keyNumber = 0

    for (let r = 0; r < rows; r++) {
      const row: unknown[] = []

      for (let c = 0; c < cols; c++) {
        let label = ''

        if (options?.withLabels) {
          switch (options.labelFormat) {
            case 'row,col':
              label = `${r},${c}`
              break
            case 'number':
              label = `${keyNumber + 1}`
              break
            case 'letter':
              label = String.fromCharCode(65 + keyNumber) // A, B, C, ...
              break
            default:
              label = `${r},${c}`
          }
        }

        row.push(label)
        keyNumber++
      }

      layout.push(row)
    }

    return layout
  }

  /**
   * Create a single row layout
   *
   * @param keyCount - Number of keys in the row
   * @param options - Optional configuration
   * @returns Layout data in KLE format
   *
   * @example
   * // Create a row of 10 number keys
   * const layout = LayoutFactory.createRow(10, {
   *   labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
   * })
   */
  static createRow(
    keyCount: number,
    options?: {
      labels?: string[]
      keyWidth?: number
      keyHeight?: number
    },
  ): unknown[] {
    const row: unknown[] = []

    for (let i = 0; i < keyCount; i++) {
      const label = options?.labels?.[i] || ''
      row.push(label)
    }

    return [row]
  }

  /**
   * Create a layout with specific key sizes
   *
   * @param keysConfig - Array of key configurations
   * @returns Layout data in KLE format
   *
   * @example
   * // Create spacebar row with different sizes
   * const layout = LayoutFactory.createCustomRow([
   *   { label: 'Ctrl', width: 1.25 },
   *   { label: 'Win', width: 1.25 },
   *   { label: 'Alt', width: 1.25 },
   *   { label: '', width: 6.25 }, // Spacebar
   *   { label: 'Alt', width: 1.25 },
   *   { label: 'Fn', width: 1.25 },
   *   { label: 'Menu', width: 1.25 },
   *   { label: 'Ctrl', width: 1.25 },
   * ])
   */
  static createCustomRow(
    keysConfig: Array<{
      label?: string
      width?: number
      height?: number
      color?: string
      textColor?: string
    }>,
  ): unknown[] {
    const row: unknown[] = []

    for (const config of keysConfig) {
      // Add width property if specified
      if (config.width && config.width !== 1) {
        row.push({ w: config.width })
      }

      // Add height property if specified
      if (config.height && config.height !== 1) {
        if (row.length > 0 && typeof row[row.length - 1] === 'object') {
          // Add to existing properties object
          ;(row[row.length - 1] as { h?: number }).h = config.height
        } else {
          row.push({ h: config.height })
        }
      }

      // Add the label
      row.push(config.label || '')
    }

    return [row]
  }

  /**
   * Create a simple ANSI 104 layout (basic structure)
   * Note: This is a simplified version. For exact ANSI 104, use preset loading.
   *
   * @returns Basic ANSI-like layout structure
   */
  static createANSI104(): unknown[] {
    // This is a simplified version - for real ANSI 104, load from preset
    // Just create a basic rectangular layout for now
    return [
      // Row 1: Function keys + Esc
      ['Esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'],
      // Row 2: Number row
      ['~', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', { w: 2 }, 'Backspace'],
      // Row 3: Tab + QWERTY
      [{ w: 1.5 }, 'Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', { w: 1.5 }, '\\'],
      // Row 4: Caps + ASDF
      [{ w: 1.75 }, 'Caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", { w: 2.25 }, 'Enter'],
      // Row 5: Shift + ZXCV
      [{ w: 2.25 }, 'Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', { w: 2.75 }, 'Shift'],
      // Row 6: Bottom row
      [
        { w: 1.25 },
        'Ctrl',
        { w: 1.25 },
        'Win',
        { w: 1.25 },
        'Alt',
        { w: 6.25 },
        '',
        { w: 1.25 },
        'Alt',
        { w: 1.25 },
        'Win',
        { w: 1.25 },
        'Menu',
        { w: 1.25 },
        'Ctrl',
      ],
    ]
  }

  /**
   * Create a layout with rotated keys
   *
   * @param keyCount - Number of keys
   * @param angle - Rotation angle in degrees
   * @returns Layout with rotated keys
   *
   * @example
   * // Create 5 keys rotated 45 degrees
   * const layout = LayoutFactory.createRotatedLayout(5, 45)
   */
  static createRotatedLayout(keyCount: number, angle: number): unknown[] {
    const row: unknown[] = []

    for (let i = 0; i < keyCount; i++) {
      // Add rotation property
      row.push({ r: angle, rx: i, ry: 0 })
      row.push(`Key${i + 1}`)
    }

    return [row]
  }

  /**
   * Create an empty layout (for fresh start tests)
   *
   * @returns Empty layout
   */
  static createEmpty(): unknown[] {
    return []
  }

  /**
   * Create a matrix layout with specific row/column labels
   * Useful for testing matrix coordinate functionality
   *
   * @param rows - Number of rows
   * @param cols - Number of columns
   * @returns Layout with matrix coordinates as labels
   *
   * @example
   * // Create 4x4 matrix layout
   * const layout = LayoutFactory.createMatrixLayout(4, 4)
   * // Keys labeled: "0,0", "0,1", "0,2", "0,3", ...
   */
  static createMatrixLayout(rows: number, cols: number): unknown[] {
    return this.createGrid(rows, cols, {
      withLabels: true,
      labelFormat: 'row,col',
    })
  }
}
