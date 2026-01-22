import { describe, it, expect } from 'vitest'
import { findKeyRangesInJson } from '../json-key-positions'
import { Key } from '@adamws/kle-serial'

// Helper to create a mock Key
function createKey(x: number, y: number): Key {
  const key = new Key()
  key.x = x
  key.y = y
  return key
}

describe('json-key-positions', () => {
  describe('findKeyRangesInJson', () => {
    it('should return empty array for empty JSON', () => {
      const ranges = findKeyRangesInJson('[]', [], [])
      expect(ranges).toEqual([])
    })

    it('should return empty array when no keys are selected', () => {
      const json = '[["Q","W","E"]]'
      const storeKeys = [createKey(0, 0), createKey(1, 0), createKey(2, 0)]
      const selectedKeys: Key[] = []

      const ranges = findKeyRangesInJson(json, storeKeys, selectedKeys)
      expect(ranges).toEqual([])
    })

    it('should find range for a single selected key', () => {
      const json = '[["Q","W","E"]]'
      const storeKeys = [createKey(0, 0), createKey(1, 0), createKey(2, 0)]
      const selectedKeys = [storeKeys[0]!]

      const ranges = findKeyRangesInJson(json, storeKeys, selectedKeys)
      expect(ranges.length).toBe(1)
      // Should highlight only the "Q" string (positions 2-5)
      expect(json.substring(ranges[0]!.from, ranges[0]!.to)).toBe('"Q"')
    })

    it('should find ranges for multiple selected keys in same row', () => {
      const json = '[["Q","W","E"]]'
      const storeKeys = [createKey(0, 0), createKey(1, 0), createKey(2, 0)]
      const selectedKeys = [storeKeys[0]!, storeKeys[1]!]

      const ranges = findKeyRangesInJson(json, storeKeys, selectedKeys)
      // Two keys selected, two ranges
      expect(ranges.length).toBe(2)
      expect(json.substring(ranges[0]!.from, ranges[0]!.to)).toBe('"Q"')
      expect(json.substring(ranges[1]!.from, ranges[1]!.to)).toBe('"W"')
    })

    it('should find ranges for keys in different rows', () => {
      const json = '[["Q","W","E"],\n["A","S","D"]]'
      const storeKeys = [
        createKey(0, 0),
        createKey(1, 0),
        createKey(2, 0),
        createKey(0, 1),
        createKey(1, 1),
        createKey(2, 1),
      ]
      const selectedKeys = [storeKeys[0]!, storeKeys[3]!]

      const ranges = findKeyRangesInJson(json, storeKeys, selectedKeys)
      expect(ranges.length).toBe(2)
      expect(json.substring(ranges[0]!.from, ranges[0]!.to)).toBe('"Q"')
      expect(json.substring(ranges[1]!.from, ranges[1]!.to)).toBe('"A"')
    })

    it('should handle keys with x offset properties', () => {
      const json = '[[{"x":1},"Q","W"]]'
      const storeKeys = [createKey(1, 0), createKey(2, 0)]
      const selectedKeys = [storeKeys[0]!]

      const ranges = findKeyRangesInJson(json, storeKeys, selectedKeys)
      expect(ranges.length).toBe(1)
      expect(json.substring(ranges[0]!.from, ranges[0]!.to)).toBe('"Q"')
    })

    it('should handle keys with width properties', () => {
      const json = '[[{"w":1.5},"Tab","Q"]]'
      const storeKeys = [createKey(0, 0), createKey(1.5, 0)]
      const selectedKeys = [storeKeys[1]!]

      const ranges = findKeyRangesInJson(json, storeKeys, selectedKeys)
      expect(ranges.length).toBe(1)
      expect(json.substring(ranges[0]!.from, ranges[0]!.to)).toBe('"Q"')
    })

    it('should handle metadata at top level', () => {
      const json = '[{"name":"Test"},["Q","W"]]'
      const storeKeys = [createKey(0, 0), createKey(1, 0)]
      const selectedKeys = [storeKeys[0]!]

      const ranges = findKeyRangesInJson(json, storeKeys, selectedKeys)
      expect(ranges.length).toBe(1)
      // Should only highlight the "Q" string, not the metadata
      expect(json.substring(ranges[0]!.from, ranges[0]!.to)).toBe('"Q"')
    })

    it('should handle escaped characters in labels', () => {
      const json = '[["Line\\nBreak","Normal"]]'
      const storeKeys = [createKey(0, 0), createKey(1, 0)]
      const selectedKeys = [storeKeys[0]!]

      const ranges = findKeyRangesInJson(json, storeKeys, selectedKeys)
      expect(ranges.length).toBe(1)
      expect(json.substring(ranges[0]!.from, ranges[0]!.to)).toBe('"Line\\nBreak"')
    })

    it('should handle decimal positions', () => {
      const json = '[[{"x":0.5},"Q"]]'
      const storeKeys = [createKey(0.5, 0)]
      const selectedKeys = [storeKeys[0]!]

      const ranges = findKeyRangesInJson(json, storeKeys, selectedKeys)
      expect(ranges.length).toBe(1)
      expect(json.substring(ranges[0]!.from, ranges[0]!.to)).toBe('"Q"')
    })

    it('should return empty for malformed JSON', () => {
      const json = 'not valid json'
      const storeKeys = [createKey(0, 0)]
      const selectedKeys = [storeKeys[0]!]

      const ranges = findKeyRangesInJson(json, storeKeys, selectedKeys)
      expect(ranges).toEqual([])
    })

    it('should highlight all selected keys independently', () => {
      const json = '[["A","B","C"],["D","E","F"]]'
      const storeKeys = [
        createKey(0, 0),
        createKey(1, 0),
        createKey(2, 0),
        createKey(0, 1),
        createKey(1, 1),
        createKey(2, 1),
      ]
      // Select B, D, and F
      const selectedKeys = [storeKeys[1]!, storeKeys[3]!, storeKeys[5]!]

      const ranges = findKeyRangesInJson(json, storeKeys, selectedKeys)
      expect(ranges.length).toBe(3)
      expect(json.substring(ranges[0]!.from, ranges[0]!.to)).toBe('"B"')
      expect(json.substring(ranges[1]!.from, ranges[1]!.to)).toBe('"D"')
      expect(json.substring(ranges[2]!.from, ranges[2]!.to)).toBe('"F"')
    })
  })
})
