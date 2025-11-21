/**
 * Canvas dimension constants
 *
 * These constants define the sizing and positioning of elements on the canvas.
 * They are extracted from the actual application rendering logic to avoid
 * magic numbers in tests.
 */

export const CANVAS_CONSTANTS = {
  /**
   * Size of one unit (1U) in pixels
   * 1U is the width of a standard keyboard key
   */
  UNIT_SIZE: 54,

  /**
   * Canvas border width in pixels
   * This is the padding around the canvas content
   */
  BORDER: 9,

  /**
   * Offset to the center of the first key
   * Calculated as: (UNIT_SIZE / 2) + BORDER
   * This is the distance from canvas edge to first key center
   */
  get KEY_OFFSET() {
    return this.UNIT_SIZE / 2 + this.BORDER
  },

  /**
   * Calculate the canvas position for a key at given row/col
   * @param row - Row index (0-based)
   * @param col - Column index (0-based)
   * @returns Object with x, y coordinates in pixels
   */
  getKeyPosition(row: number, col: number): { x: number; y: number } {
    return {
      x: this.KEY_OFFSET + col * this.UNIT_SIZE,
      y: this.KEY_OFFSET + row * this.UNIT_SIZE,
    }
  },

  /**
   * Calculate the canvas position for a key at given absolute coordinates
   * @param xUnits - X coordinate in units (U)
   * @param yUnits - Y coordinate in units (U)
   * @returns Object with x, y coordinates in pixels
   */
  getPositionFromUnits(xUnits: number, yUnits: number): { x: number; y: number } {
    return {
      x: this.BORDER + xUnits * this.UNIT_SIZE,
      y: this.BORDER + yUnits * this.UNIT_SIZE,
    }
  },
} as const
