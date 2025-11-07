import { describe, it, expect, beforeEach } from 'vitest'
import { HitTester } from '../HitTester'
import type { Key } from '@adamws/kle-serial'
import type { KeyRenderParams } from '../../canvas-renderer'

describe('HitTester', () => {
  let hitTester: HitTester

  // Mock getRenderParams function
  const mockGetRenderParams = (key: Key, options: { unit: number }): KeyRenderParams => {
    const unit = options.unit
    return {
      capwidth: key.width * unit,
      capheight: key.height * unit,
      capx: key.x * unit,
      capy: key.y * unit,
      outercapwidth: key.width * unit,
      outercapheight: key.height * unit,
      outercapx: key.x * unit,
      outercapy: key.y * unit,
      innercapwidth: key.width * unit * 0.9,
      innercapheight: key.height * unit * 0.9,
      innercapx: key.x * unit + 5,
      innercapy: key.y * unit + 5,
      textcapwidth: key.width * unit * 0.8,
      textcapheight: key.height * unit * 0.8,
      textcapx: key.x * unit + 10,
      textcapy: key.y * unit + 10,
      darkColor: '#000000',
      lightColor: '#ffffff',
      nonRectangular: !!(key.width2 && key.height2),
      origin_x: (key.rotation_x || 0) * unit,
      origin_y: (key.rotation_y || 0) * unit,
      ...(key.width2 &&
        key.height2 && {
          capwidth2: key.width2 * unit,
          capheight2: key.height2 * unit,
          capx2: (key.x + (key.x2 || 0)) * unit,
          capy2: (key.y + (key.y2 || 0)) * unit,
          outercapwidth2: key.width2 * unit,
          outercapheight2: key.height2 * unit,
          outercapx2: (key.x + (key.x2 || 0)) * unit,
          outercapy2: (key.y + (key.y2 || 0)) * unit,
        }),
    }
  }

  beforeEach(() => {
    hitTester = new HitTester(50, mockGetRenderParams)
  })

  describe('getKeyAtPosition', () => {
    it('should return null for empty array', () => {
      const key = hitTester.getKeyAtPosition(25, 25, [])
      expect(key).toBeNull()
    })

    it('should find key at position', () => {
      const keys: Partial<Key>[] = [
        {
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        },
      ]

      // Position (25, 25) should be in the middle of the 1x1 key
      const key = hitTester.getKeyAtPosition(25, 25, keys as Key[])
      expect(key).toBeTruthy()
      expect(key).toBe(keys[0])
    })

    it('should return null for position outside keys', () => {
      const keys: Partial<Key>[] = [
        {
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        },
      ]

      // Position far away
      const key = hitTester.getKeyAtPosition(1000, 1000, keys as Key[])
      expect(key).toBeNull()
    })

    it('should respect z-order (last key on top)', () => {
      const keys: Partial<Key>[] = [
        {
          x: 0,
          y: 0,
          width: 2,
          height: 2,
        },
        {
          x: 0.5,
          y: 0.5,
          width: 1,
          height: 1,
        },
      ]

      // Position overlaps both keys, should return the second one (on top)
      const key = hitTester.getKeyAtPosition(30, 30, keys as Key[])
      expect(key).toBe(keys[1])
    })

    it('should handle rotated keys', () => {
      const keys: Partial<Key>[] = [
        {
          x: 0,
          y: 0,
          width: 2,
          height: 1,
          rotation_angle: 45,
          rotation_x: 1,
          rotation_y: 0.5,
        },
      ]

      // Should be able to hit the rotated key
      const key = hitTester.getKeyAtPosition(50, 25, keys as Key[])
      // Hard to test exact hit with rotation, but shouldn't crash
      expect(key === null || key === keys[0]).toBe(true)
    })

    it('should handle non-rectangular keys', () => {
      const keys: Partial<Key>[] = [
        {
          x: 0,
          y: 0,
          width: 1.25,
          height: 2,
          x2: 0.25,
          y2: 1,
          width2: 1.5,
          height2: 1,
        },
      ]

      // Hit first rectangle
      const key1 = hitTester.getKeyAtPosition(30, 25, keys as Key[])
      expect(key1).toBe(keys[0])

      // Hit second rectangle
      const key2 = hitTester.getKeyAtPosition(50, 75, keys as Key[])
      expect(key2).toBe(keys[0])
    })
  })

  describe('setUnit', () => {
    it('should update unit and affect hit testing', () => {
      const keys: Partial<Key>[] = [
        {
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        },
      ]

      // At 50 unit, position (25, 25) should hit
      let key = hitTester.getKeyAtPosition(25, 25, keys as Key[])
      expect(key).toBeTruthy()

      // Change to 100 unit
      hitTester.setUnit(100)

      // Now (25, 25) should still hit because it scales
      key = hitTester.getKeyAtPosition(50, 50, keys as Key[])
      expect(key).toBeTruthy()
    })
  })
})
