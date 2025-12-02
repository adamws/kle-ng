import { describe, it, expect } from 'vitest'
import {
  hexToRgb,
  rgbToHex,
  hsvToRgb,
  rgbToHsv,
  hexToHsv,
  hsvToHex,
  isValidHex,
  normalizeHex,
  type RGB,
} from '../color-utils'

describe('Color Utils', () => {
  describe('hexToRgb', () => {
    it('converts hex to RGB correctly', () => {
      expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 })
      expect(hexToRgb('#00FF00')).toEqual({ r: 0, g: 255, b: 0 })
      expect(hexToRgb('#0000FF')).toEqual({ r: 0, g: 0, b: 255 })
      expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 })
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 })
    })

    it('handles hex without # prefix', () => {
      expect(hexToRgb('FF0000')).toEqual({ r: 255, g: 0, b: 0 })
      expect(hexToRgb('00FF00')).toEqual({ r: 0, g: 255, b: 0 })
    })

    it('handles lowercase hex', () => {
      expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 })
      expect(hexToRgb('#abcdef')).toEqual({ r: 171, g: 205, b: 239 })
    })

    it('returns black for invalid hex', () => {
      expect(hexToRgb('invalid')).toEqual({ r: 0, g: 0, b: 0 })
      expect(hexToRgb('#ZZZ')).toEqual({ r: 0, g: 0, b: 0 })
      expect(hexToRgb('')).toEqual({ r: 0, g: 0, b: 0 })
    })
  })

  describe('rgbToHex', () => {
    it('converts RGB to hex correctly', () => {
      expect(rgbToHex(255, 0, 0)).toBe('#ff0000')
      expect(rgbToHex(0, 255, 0)).toBe('#00ff00')
      expect(rgbToHex(0, 0, 255)).toBe('#0000ff')
      expect(rgbToHex(255, 255, 255)).toBe('#ffffff')
      expect(rgbToHex(0, 0, 0)).toBe('#000000')
    })

    it('handles edge values correctly', () => {
      expect(rgbToHex(128, 128, 128)).toBe('#808080')
      expect(rgbToHex(171, 205, 239)).toBe('#abcdef')
    })

    it('clamps values to valid range', () => {
      expect(rgbToHex(-10, 300, 128)).toBe('#00ff80')
      expect(rgbToHex(256, -5, 400)).toBe('#ff00ff')
    })

    it('rounds decimal values', () => {
      expect(rgbToHex(255.7, 0.3, 127.8)).toBe('#ff0080')
    })
  })

  describe('hsvToRgb', () => {
    it('converts HSV to RGB correctly', () => {
      // Red
      expect(hsvToRgb(0, 100, 100)).toEqual({ r: 255, g: 0, b: 0 })
      // Green
      expect(hsvToRgb(120, 100, 100)).toEqual({ r: 0, g: 255, b: 0 })
      // Blue
      expect(hsvToRgb(240, 100, 100)).toEqual({ r: 0, g: 0, b: 255 })
      // White
      expect(hsvToRgb(0, 0, 100)).toEqual({ r: 255, g: 255, b: 255 })
      // Black
      expect(hsvToRgb(0, 0, 0)).toEqual({ r: 0, g: 0, b: 0 })
    })

    it('handles intermediate values', () => {
      // Yellow
      expect(hsvToRgb(60, 100, 100)).toEqual({ r: 255, g: 255, b: 0 })
      // Cyan
      expect(hsvToRgb(180, 100, 100)).toEqual({ r: 0, g: 255, b: 255 })
      // Magenta
      expect(hsvToRgb(300, 100, 100)).toEqual({ r: 255, g: 0, b: 255 })
    })

    it('handles gray values', () => {
      expect(hsvToRgb(0, 0, 50)).toEqual({ r: 128, g: 128, b: 128 })
      expect(hsvToRgb(120, 0, 75)).toEqual({ r: 191, g: 191, b: 191 })
    })
  })

  describe('rgbToHsv', () => {
    it('converts RGB to HSV correctly', () => {
      // Red
      expect(rgbToHsv(255, 0, 0)).toEqual({ h: 0, s: 100, v: 100 })
      // Green
      expect(rgbToHsv(0, 255, 0)).toEqual({ h: 120, s: 100, v: 100 })
      // Blue
      expect(rgbToHsv(0, 0, 255)).toEqual({ h: 240, s: 100, v: 100 })
      // White
      expect(rgbToHsv(255, 255, 255)).toEqual({ h: 0, s: 0, v: 100 })
      // Black
      expect(rgbToHsv(0, 0, 0)).toEqual({ h: 0, s: 0, v: 0 })
    })

    it('handles intermediate colors', () => {
      // Yellow
      expect(rgbToHsv(255, 255, 0)).toEqual({ h: 60, s: 100, v: 100 })
      // Cyan
      expect(rgbToHsv(0, 255, 255)).toEqual({ h: 180, s: 100, v: 100 })
      // Magenta
      expect(rgbToHsv(255, 0, 255)).toEqual({ h: 300, s: 100, v: 100 })
    })

    it('handles gray values', () => {
      expect(rgbToHsv(128, 128, 128)).toEqual({ h: 0, s: 0, v: 50 })
      expect(rgbToHsv(191, 191, 191)).toEqual({ h: 0, s: 0, v: 75 })
    })
  })

  describe('hexToHsv', () => {
    it('converts hex to HSV correctly', () => {
      expect(hexToHsv('#FF0000')).toEqual({ h: 0, s: 100, v: 100 })
      expect(hexToHsv('#00FF00')).toEqual({ h: 120, s: 100, v: 100 })
      expect(hexToHsv('#0000FF')).toEqual({ h: 240, s: 100, v: 100 })
      expect(hexToHsv('#FFFFFF')).toEqual({ h: 0, s: 0, v: 100 })
      expect(hexToHsv('#000000')).toEqual({ h: 0, s: 0, v: 0 })
    })

    it('handles hex without # prefix', () => {
      expect(hexToHsv('FF0000')).toEqual({ h: 0, s: 100, v: 100 })
    })
  })

  describe('hsvToHex', () => {
    it('converts HSV to hex correctly', () => {
      expect(hsvToHex(0, 100, 100)).toBe('#ff0000')
      expect(hsvToHex(120, 100, 100)).toBe('#00ff00')
      expect(hsvToHex(240, 100, 100)).toBe('#0000ff')
      expect(hsvToHex(0, 0, 100)).toBe('#ffffff')
      expect(hsvToHex(0, 0, 0)).toBe('#000000')
    })

    it('handles intermediate values', () => {
      expect(hsvToHex(60, 100, 100)).toBe('#ffff00')
      expect(hsvToHex(180, 100, 100)).toBe('#00ffff')
      expect(hsvToHex(300, 100, 100)).toBe('#ff00ff')
    })
  })

  describe('isValidHex', () => {
    it('validates correct hex colors', () => {
      expect(isValidHex('#FF0000')).toBe(true)
      expect(isValidHex('#ffffff')).toBe(true)
      expect(isValidHex('#AbCdEf')).toBe(true)
      expect(isValidHex('#123456')).toBe(true)
    })

    it('validates hex without # prefix', () => {
      expect(isValidHex('FF0000')).toBe(true)
      expect(isValidHex('ffffff')).toBe(true)
      expect(isValidHex('AbCdEf')).toBe(true)
    })

    it('rejects invalid hex colors', () => {
      expect(isValidHex('#GG0000')).toBe(false)
      expect(isValidHex('#FF00')).toBe(false)
      expect(isValidHex('#FF000000')).toBe(false)
      expect(isValidHex('invalid')).toBe(false)
      expect(isValidHex('')).toBe(false)
      expect(isValidHex('#')).toBe(false)
    })
  })

  describe('normalizeHex', () => {
    it('adds # prefix when missing', () => {
      expect(normalizeHex('FF0000')).toBe('#FF0000')
      expect(normalizeHex('ffffff')).toBe('#ffffff')
      expect(normalizeHex('AbCdEf')).toBe('#AbCdEf')
    })

    it('preserves # prefix when present', () => {
      expect(normalizeHex('#FF0000')).toBe('#FF0000')
      expect(normalizeHex('#ffffff')).toBe('#ffffff')
      expect(normalizeHex('#AbCdEf')).toBe('#AbCdEf')
    })
  })

  describe('Round-trip conversions', () => {
    it('maintains color integrity through RGB-HSV-RGB conversion', () => {
      const testColors: RGB[] = [
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 255, b: 0 },
        { r: 0, g: 0, b: 255 },
        { r: 255, g: 255, b: 0 },
        { r: 128, g: 64, b: 192 },
      ]

      testColors.forEach((original) => {
        const hsv = rgbToHsv(original.r, original.g, original.b)
        const converted = hsvToRgb(hsv.h, hsv.s, hsv.v)

        // Allow for small rounding differences
        expect(Math.abs(converted.r - original.r)).toBeLessThanOrEqual(1)
        expect(Math.abs(converted.g - original.g)).toBeLessThanOrEqual(1)
        expect(Math.abs(converted.b - original.b)).toBeLessThanOrEqual(1)
      })
    })

    it('maintains color integrity through HEX-HSV-HEX conversion', () => {
      const testColors = [
        { original: '#FF0000', tolerance: 0 },
        { original: '#00FF00', tolerance: 0 },
        { original: '#0000FF', tolerance: 0 },
        { original: '#FFFF00', tolerance: 0 },
        { original: '#8040C0', tolerance: 1 }, // This color may have minor rounding differences
      ]

      // Split colors into exact and tolerant groups
      const exactColors = testColors.filter((t) => t.tolerance === 0)
      const tolerantColors = testColors.filter((t) => t.tolerance > 0)

      // Test exact conversions (should round-trip perfectly)
      exactColors.forEach(({ original }) => {
        const hsv = hexToHsv(original)
        const converted = hsvToHex(hsv.h, hsv.s, hsv.v)
        expect(converted.toLowerCase()).toBe(original.toLowerCase())
      })

      // Test tolerant conversions (allow small rounding differences)
      tolerantColors.forEach(({ original, tolerance }) => {
        const hsv = hexToHsv(original)
        const converted = hsvToHex(hsv.h, hsv.s, hsv.v)
        const originalRgb = hexToRgb(original)
        const convertedRgb = hexToRgb(converted)

        expect(Math.abs(convertedRgb.r - originalRgb.r)).toBeLessThanOrEqual(tolerance)
        expect(Math.abs(convertedRgb.g - originalRgb.g)).toBeLessThanOrEqual(tolerance)
        expect(Math.abs(convertedRgb.b - originalRgb.b)).toBeLessThanOrEqual(tolerance)
      })

      // Verify we tested both types
      expect(exactColors.length).toBeGreaterThan(0)
      expect(tolerantColors.length).toBeGreaterThan(0)
    })
  })
})
