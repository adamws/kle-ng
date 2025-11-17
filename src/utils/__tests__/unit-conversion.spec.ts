import { describe, it, expect } from 'vitest'
import { D } from '../decimal-math'

describe('Unit Conversion Calculations', () => {
  it('should convert U to mm using decimal.js precision', () => {
    // Test coordinate conversion like in KeyCentersTable
    const testValue = 5.5 // 5.5 units
    const spacingX = 18 // 18mm per unit (choc spacing)

    // Convert using decimal.js
    const mmValue = Number(D.mul(testValue, spacingX))

    expect(mmValue).toBe(99) // 5.5 * 18 = 99
  })

  it('should convert U to mm with default MX spacing', () => {
    const testValue = 5.5 // 5.5 units
    const spacingDefault = 19.05 // Default MX spacing

    const mmValue = Number(D.mul(testValue, spacingDefault))

    expect(mmValue).toBe(104.775) // 5.5 * 19.05 = 104.775
  })

  it('should format coordinates with 6 decimal places and trim trailing zeros', () => {
    const value1 = 5.0
    const value2 = 5.123456
    const value3 = 5.12

    const formatted1 = value1.toFixed(6).replace(/\.?0+$/, '')
    const formatted2 = value2.toFixed(6).replace(/\.?0+$/, '')
    const formatted3 = value3.toFixed(6).replace(/\.?0+$/, '')

    expect(formatted1).toBe('5')
    expect(formatted2).toBe('5.123456')
    expect(formatted3).toBe('5.12')
  })

  it('should handle different spacing values for X and Y axes', () => {
    const spacing = { x: 18, y: 17 } // Choc spacing
    const coords = { x: 2, y: 3 }

    const mmX = Number(D.mul(coords.x, spacing.x))
    const mmY = Number(D.mul(coords.y, spacing.y))

    expect(mmX).toBe(36) // 2 * 18 = 36
    expect(mmY).toBe(51) // 3 * 17 = 51
  })
})
