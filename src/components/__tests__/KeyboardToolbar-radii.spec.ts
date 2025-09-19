import { describe, it, expect } from 'vitest'
import { parseBorderRadius } from '@/utils/border-radius'

describe('Border Radius Parsing', () => {
  const canvasWidth = 400
  const canvasHeight = 200

  it('should parse single value (all corners same)', () => {
    const result = parseBorderRadius('10px', canvasWidth, canvasHeight)
    expect(result.topLeft).toEqual({ x: 10, y: 10 })
    expect(result.topRight).toEqual({ x: 10, y: 10 })
    expect(result.bottomRight).toEqual({ x: 10, y: 10 })
    expect(result.bottomLeft).toEqual({ x: 10, y: 10 })
  })

  it('should parse unitless numbers', () => {
    const result = parseBorderRadius('15', canvasWidth, canvasHeight)
    expect(result.topLeft).toEqual({ x: 15, y: 15 })
    expect(result.topRight).toEqual({ x: 15, y: 15 })
    expect(result.bottomRight).toEqual({ x: 15, y: 15 })
    expect(result.bottomLeft).toEqual({ x: 15, y: 15 })
  })

  it('should parse two values (horizontal/vertical)', () => {
    const result = parseBorderRadius('10px 20px', canvasWidth, canvasHeight)
    expect(result.topLeft).toEqual({ x: 10, y: 10 })
    expect(result.topRight).toEqual({ x: 20, y: 20 })
    expect(result.bottomRight).toEqual({ x: 10, y: 10 })
    expect(result.bottomLeft).toEqual({ x: 20, y: 20 })
  })

  it('should parse four values (all corners different)', () => {
    const result = parseBorderRadius('5px 10px 15px 20px', canvasWidth, canvasHeight)
    expect(result.topLeft).toEqual({ x: 5, y: 5 })
    expect(result.topRight).toEqual({ x: 10, y: 10 })
    expect(result.bottomRight).toEqual({ x: 15, y: 15 })
    expect(result.bottomLeft).toEqual({ x: 20, y: 20 })
  })

  it('should parse original KLE apple-wireless format', () => {
    // "6px 6px 12px 12px / 18px 18px 12px 12px"
    const result = parseBorderRadius(
      '6px 6px 12px 12px / 18px 18px 12px 12px',
      canvasWidth,
      canvasHeight,
    )
    expect(result.topLeft).toEqual({ x: 6, y: 18 })
    expect(result.topRight).toEqual({ x: 6, y: 18 })
    expect(result.bottomRight).toEqual({ x: 12, y: 12 })
    expect(result.bottomLeft).toEqual({ x: 12, y: 12 })
  })

  it('should parse original KLE pkb format with percentages', () => {
    // "30px 30px 50% 50%"
    const result = parseBorderRadius('30px 30px 50% 50%', canvasWidth, canvasHeight)
    expect(result.topLeft).toEqual({ x: 30, y: 30 })
    expect(result.topRight).toEqual({ x: 30, y: 30 })
    expect(result.bottomRight).toEqual({ x: 200, y: 100 }) // 50% of 400x200
    expect(result.bottomLeft).toEqual({ x: 200, y: 100 })
  })

  it('should handle elliptical radii with slash notation', () => {
    const result = parseBorderRadius('10px / 20px', canvasWidth, canvasHeight)
    expect(result.topLeft).toEqual({ x: 10, y: 20 })
    expect(result.topRight).toEqual({ x: 10, y: 20 })
    expect(result.bottomRight).toEqual({ x: 10, y: 20 })
    expect(result.bottomLeft).toEqual({ x: 10, y: 20 })
  })

  it('should handle percentage values correctly', () => {
    const result = parseBorderRadius('10% 5%', canvasWidth, canvasHeight)
    expect(result.topLeft).toEqual({ x: 40, y: 20 }) // 10% of 400, 10% of 200
    expect(result.topRight).toEqual({ x: 20, y: 10 }) // 5% of 400, 5% of 200
    expect(result.bottomRight).toEqual({ x: 40, y: 20 })
    expect(result.bottomLeft).toEqual({ x: 20, y: 10 })
  })

  it('should handle whitespace normalization', () => {
    const result = parseBorderRadius('  10px   20px  /  15px   25px  ', canvasWidth, canvasHeight)
    expect(result.topLeft).toEqual({ x: 10, y: 15 })
    expect(result.topRight).toEqual({ x: 20, y: 25 })
    expect(result.bottomRight).toEqual({ x: 10, y: 15 })
    expect(result.bottomLeft).toEqual({ x: 20, y: 25 })
  })

  it('should handle invalid values gracefully', () => {
    const result = parseBorderRadius('invalid 10px', canvasWidth, canvasHeight)
    expect(result.topLeft).toEqual({ x: 0, y: 0 }) // invalid becomes 0
    expect(result.topRight).toEqual({ x: 10, y: 10 })
    expect(result.bottomRight).toEqual({ x: 0, y: 0 })
    expect(result.bottomLeft).toEqual({ x: 10, y: 10 })
  })
})
