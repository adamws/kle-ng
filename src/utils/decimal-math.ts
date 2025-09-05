import { Decimal } from 'decimal.js'

// Configure Decimal.js for keyboard layout precision
// Use 15 decimal places to avoid rounding errors while keeping performance reasonable
Decimal.set({
  precision: 15,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -7,
  toExpPos: 21,
  minE: -9e15,
  maxE: 9e15,
})

/**
 * Utility class for precise decimal arithmetic operations used in keyboard layouts.
 * Prevents floating-point precision errors for positions, rotations, and dimensions.
 */
export class DecimalMath {
  /**
   * Create a new Decimal from a number or string
   */
  static create(value: number | string | Decimal): Decimal {
    return new Decimal(value)
  }

  /**
   * Add two values with decimal precision
   */
  static add(a: number | string | Decimal, b: number | string | Decimal): number {
    return new Decimal(a).add(new Decimal(b)).toNumber()
  }

  /**
   * Subtract two values with decimal precision
   */
  static sub(a: number | string | Decimal, b: number | string | Decimal): number {
    return new Decimal(a).sub(new Decimal(b)).toNumber()
  }

  /**
   * Multiply two values with decimal precision
   */
  static mul(a: number | string | Decimal, b: number | string | Decimal): number {
    return new Decimal(a).mul(new Decimal(b)).toNumber()
  }

  /**
   * Divide two values with decimal precision
   */
  static div(a: number | string | Decimal, b: number | string | Decimal): number {
    return new Decimal(a).div(new Decimal(b)).toNumber()
  }

  /**
   * Round a value to a specific decimal places with decimal precision
   */
  static round(value: number | string | Decimal, decimalPlaces = 0): number {
    return new Decimal(value).toDecimalPlaces(decimalPlaces).toNumber()
  }

  /**
   * Round a value to the nearest step increment (like moveStep)
   */
  static roundToStep(value: number | string | Decimal, step: number | string | Decimal): number {
    const val = new Decimal(value)
    const stepDecimal = new Decimal(step)
    return val.div(stepDecimal).round().mul(stepDecimal).toNumber()
  }

  /**
   * Get the minimum of multiple values
   */
  static min(...values: (number | string | Decimal)[]): number {
    return values.reduce((min: number | string | Decimal, val) => {
      const current = new Decimal(val)
      const minDecimal = new Decimal(min)
      return current.lt(minDecimal) ? current.toNumber() : minDecimal.toNumber()
    }) as number
  }

  /**
   * Get the maximum of multiple values
   */
  static max(...values: (number | string | Decimal)[]): number {
    return values.reduce((max: number | string | Decimal, val) => {
      const current = new Decimal(val)
      const maxDecimal = new Decimal(max)
      return current.gt(maxDecimal) ? current.toNumber() : maxDecimal.toNumber()
    }) as number
  }

  /**
   * Calculate absolute value
   */
  static abs(value: number | string | Decimal): number {
    return new Decimal(value).abs().toNumber()
  }

  /**
   * Calculate square root
   */
  static sqrt(value: number | string | Decimal): number {
    return new Decimal(value).sqrt().toNumber()
  }

  /**
   * Calculate power
   */
  static pow(base: number | string | Decimal, exponent: number | string | Decimal): number {
    return new Decimal(base).pow(new Decimal(exponent)).toNumber()
  }

  /**
   * Trigonometric functions using Math but with decimal input conversion
   */
  static cos(angleRadians: number | string | Decimal): number {
    return Math.cos(new Decimal(angleRadians).toNumber())
  }

  static sin(angleRadians: number | string | Decimal): number {
    return Math.sin(new Decimal(angleRadians).toNumber())
  }

  /**
   * Convert degrees to radians with decimal precision
   */
  static degreesToRadians(degrees: number | string | Decimal): number {
    return new Decimal(degrees).mul(new Decimal(Math.PI)).div(180).toNumber()
  }

  /**
   * Modulo operation with decimal precision
   */
  static mod(a: number | string | Decimal, b: number | string | Decimal): number {
    return new Decimal(a).mod(new Decimal(b)).toNumber()
  }

  /**
   * Check if two values are equal within a small tolerance
   */
  static equals(
    a: number | string | Decimal,
    b: number | string | Decimal,
    tolerance = 1e-10,
  ): boolean {
    return new Decimal(a).sub(new Decimal(b)).abs().lt(tolerance)
  }

  /**
   * Format a number to display with limited decimal places to avoid showing precision artifacts
   */
  static format(value: number | string | Decimal, maxDecimalPlaces = 6): number {
    return new Decimal(value).toDecimalPlaces(maxDecimalPlaces).toNumber()
  }

  /**
   * Utility for coordinate transformations - applies rotation matrix transformation
   */
  static rotatePoint(
    x: number | string | Decimal,
    y: number | string | Decimal,
    angleRadians: number | string | Decimal,
  ): { x: number; y: number } {
    const xDecimal = new Decimal(x)
    const yDecimal = new Decimal(y)
    const cosAngle = new Decimal(Math.cos(new Decimal(angleRadians).toNumber()))
    const sinAngle = new Decimal(Math.sin(new Decimal(angleRadians).toNumber()))

    return {
      x: xDecimal.mul(cosAngle).sub(yDecimal.mul(sinAngle)).toNumber(),
      y: xDecimal.mul(sinAngle).add(yDecimal.mul(cosAngle)).toNumber(),
    }
  }

  /**
   * Utility for mirror operations - mirror a point across a line
   */
  static mirrorPoint(
    pointCoord: number | string | Decimal,
    lineCoord: number | string | Decimal,
    objectSize: number | string | Decimal = 0,
  ): number {
    // Formula: mirrored = 2 * line - point - size
    const point = new Decimal(pointCoord)
    const line = new Decimal(lineCoord)
    const size = new Decimal(objectSize)

    return new Decimal(2).mul(line).sub(point).sub(size).toNumber()
  }
}

// Export convenience functions for common operations
export const D = DecimalMath
