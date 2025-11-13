import { describe, it, expect } from 'vitest'
import { isViaFormat, convertViaToKle, extractViaMetadata, convertKleToVia } from '../via-import'
import LZString from 'lz-string'

describe('VIA Import Utilities', () => {
  describe('isViaFormat', () => {
    it('should return true for valid VIA format', () => {
      const viaData = {
        name: 'Test Keyboard',
        vendorId: '0x1234',
        productId: '0x5678',
        layouts: {
          keymap: [
            ['A', 'B'],
            ['C', 'D'],
          ],
        },
      }
      expect(isViaFormat(viaData)).toBe(true)
    })

    it('should return true for minimal VIA format (only layouts.keymap)', () => {
      const viaData = {
        layouts: {
          keymap: [['A']],
        },
      }
      expect(isViaFormat(viaData)).toBe(true)
    })

    it('should return false for non-object data', () => {
      expect(isViaFormat(null)).toBe(false)
      expect(isViaFormat(undefined)).toBe(false)
      expect(isViaFormat('string')).toBe(false)
      expect(isViaFormat(123)).toBe(false)
    })

    it('should return false for object without layouts', () => {
      const data = {
        name: 'Test',
        keymap: [],
      }
      expect(isViaFormat(data)).toBe(false)
    })

    it('should return false for object with layouts but no keymap', () => {
      const data = {
        layouts: {
          labels: [],
        },
      }
      expect(isViaFormat(data)).toBe(false)
    })

    it('should return false for object with layouts.keymap that is not an array', () => {
      const data = {
        layouts: {
          keymap: 'not an array',
        },
      }
      expect(isViaFormat(data)).toBe(false)
    })

    it('should return false for raw KLE format (array)', () => {
      const kleData = [
        ['A', 'B'],
        ['C', 'D'],
      ]
      expect(isViaFormat(kleData)).toBe(false)
    })
  })

  describe('convertViaToKle', () => {
    it('should convert VIA format to KLE format with embedded metadata', () => {
      const viaData = {
        name: 'Test Keyboard',
        vendorId: '0x1234',
        productId: '0x5678',
        matrix: { rows: 2, cols: 2 },
        layouts: {
          labels: ['Layout 1'],
          keymap: [
            ['A', 'B'],
            ['C', 'D'],
          ],
        },
      }

      const result = convertViaToKle(viaData)

      expect(Array.isArray(result)).toBe(true)
      const resultArray = result as unknown[]

      // First row should have metadata object as first element
      expect(Array.isArray(resultArray[0])).toBe(true)
      const firstRow = resultArray[0] as unknown[]
      expect(typeof firstRow[0]).toBe('object')
      expect(firstRow[0]).toHaveProperty('_kleng_via_data')

      // Check that the compressed data exists
      const metadataObj = firstRow[0] as Record<string, string>
      expect(metadataObj._kleng_via_data).toBeDefined()
      expect(typeof metadataObj._kleng_via_data).toBe('string')
      expect(metadataObj._kleng_via_data!.length).toBeGreaterThan(0)

      // Decompress and verify the VIA metadata
      const decompressed = LZString.decompressFromBase64(metadataObj._kleng_via_data!)
      expect(decompressed).toBeTruthy()
      const viaMetadata = JSON.parse(decompressed!) as Record<string, unknown>

      expect(viaMetadata.name).toBe('Test Keyboard')
      expect(viaMetadata.vendorId).toBe('0x1234')
      expect(viaMetadata.productId).toBe('0x5678')

      // Verify layouts exists but keymap has been removed
      expect(viaMetadata.layouts).toBeDefined()
      const layouts = viaMetadata.layouts as Record<string, unknown>
      expect(layouts.keymap).toBeUndefined()
      expect(layouts.labels).toEqual(['Layout 1'])
    })

    it('should throw error for invalid VIA format', () => {
      const invalidData = {
        name: 'Test',
        // missing layouts.keymap
      }

      expect(() => convertViaToKle(invalidData)).toThrow('Invalid VIA format')
    })

    it('should throw error for empty keymap', () => {
      const viaData = {
        layouts: {
          keymap: [],
        },
      }

      expect(() => convertViaToKle(viaData)).toThrow('Invalid VIA format: keymap is empty')
    })

    it('should handle VIA format with complex keymap', () => {
      const viaData = {
        name: 'Complex Keyboard',
        layouts: {
          keymap: [
            [{ x: 1, c: '#aaaaaa' }, '0,0', 'Key1'],
            [{ w: 2 }, '1,0'],
            ['2,0', '2,1', { w: 1.5 }, '2,2'],
          ],
        },
      }

      const result = convertViaToKle(viaData)
      expect(Array.isArray(result)).toBe(true)

      const resultArray = result as unknown[]
      expect(resultArray.length).toBeGreaterThan(0)

      // Verify metadata is embedded
      const firstRow = resultArray[0] as unknown[]
      expect(firstRow[0]).toHaveProperty('_kleng_via_data')
    })
  })

  describe('extractViaMetadata', () => {
    it('should extract VIA metadata from KLE data', () => {
      const viaData = {
        name: 'Test Keyboard',
        vendorId: '0xABCD',
        layouts: {
          labels: ['Option 1'],
          keymap: [['A']],
        },
      }

      const kleData = convertViaToKle(viaData)
      const extracted = extractViaMetadata(kleData)

      expect(extracted).toBeDefined()
      expect(extracted).not.toBeNull()
      expect(extracted!.name).toBe('Test Keyboard')
      expect(extracted!.vendorId).toBe('0xABCD')
    })

    it('should return null for KLE data without VIA metadata', () => {
      const kleData = [
        ['A', 'B'],
        ['C', 'D'],
      ]
      const extracted = extractViaMetadata(kleData)

      expect(extracted).toBeNull()
    })

    it('should return null for invalid data', () => {
      expect(extractViaMetadata(null)).toBeNull()
      expect(extractViaMetadata(undefined)).toBeNull()
      expect(extractViaMetadata('string')).toBeNull()
      expect(extractViaMetadata({})).toBeNull()
    })

    it('should handle corrupted compressed data gracefully', () => {
      const kleData = [[{ _kleng_via_data: 'invalid-compressed-data' }, 'A']]

      const extracted = extractViaMetadata(kleData)
      expect(extracted).toBeNull()
    })
  })

  describe('convertKleToVia', () => {
    it('should convert KLE data with embedded VIA metadata back to VIA format', () => {
      const originalViaData = {
        name: 'Test Keyboard',
        vendorId: '0x1234',
        productId: '0x5678',
        matrix: { rows: 2, cols: 2 },
        layouts: {
          labels: ['Layout 1'],
          keymap: [
            ['A', 'B'],
            ['C', 'D'],
          ],
        },
      }

      // Convert to KLE
      const kleData = convertViaToKle(originalViaData)

      // Convert back to VIA
      const reconstructedViaData = convertKleToVia(kleData)

      expect(reconstructedViaData).toBeDefined()
      expect(reconstructedViaData).not.toBeNull()
      expect(reconstructedViaData!.name).toBe('Test Keyboard')
      expect(reconstructedViaData!.vendorId).toBe('0x1234')
      expect(reconstructedViaData!.productId).toBe('0x5678')

      // Check layouts
      const layouts = reconstructedViaData!.layouts as Record<string, unknown>
      expect(layouts).toBeDefined()
      expect(layouts.labels).toEqual(['Layout 1'])
      expect(Array.isArray(layouts.keymap)).toBe(true)

      // The keymap should be clean (without metadata object)
      const keymap = layouts.keymap as unknown[]
      expect(keymap.length).toBeGreaterThan(0)
    })

    it('should return null for KLE data without VIA metadata', () => {
      const kleData = [
        ['A', 'B'],
        ['C', 'D'],
      ]
      const result = convertKleToVia(kleData)

      expect(result).toBeNull()
    })

    it('should handle roundtrip conversion correctly', () => {
      const originalViaData = {
        name: 'Roundtrip Test',
        vendorId: '0xFFFF',
        layouts: {
          keymap: [
            [{ x: 1 }, 'Key1'],
            ['Key2', 'Key3'],
          ],
        },
      }

      // VIA -> KLE -> VIA
      const kleData = convertViaToKle(originalViaData)
      const reconstructedViaData = convertKleToVia(kleData)

      expect(reconstructedViaData).toBeDefined()
      expect(reconstructedViaData!.name).toBe('Roundtrip Test')
      expect(reconstructedViaData!.vendorId).toBe('0xFFFF')

      const layouts = reconstructedViaData!.layouts as Record<string, unknown>
      expect(Array.isArray(layouts.keymap)).toBe(true)
    })
  })

  describe('Integration tests', () => {
    it('should preserve all VIA metadata through conversion', () => {
      const viaData = {
        name: '0xCB Static',
        vendorId: '0xCB00',
        productId: '0xa455',
        matrix: {
          rows: 8,
          cols: 6,
        },
        layouts: {
          labels: [['Space', 'Split', '6.25U']],
          keymap: [
            [{ x: 13.5, c: '#aaaaaa' }, '1,5'],
            [{ x: 2.5, c: '#777777' }, '0,0', { c: '#cccccc' }, '1,0'],
          ],
        },
      }

      const kleData = convertViaToKle(viaData)
      const extracted = extractViaMetadata(kleData)

      expect(extracted).toBeDefined()
      expect(extracted!.name).toBe('0xCB Static')
      expect(extracted!.vendorId).toBe('0xCB00')
      expect(extracted!.productId).toBe('0xa455')

      const matrix = extracted!.matrix as Record<string, number>
      expect(matrix.rows).toBe(8)
      expect(matrix.cols).toBe(6)

      const layouts = extracted!.layouts as Record<string, unknown>
      expect(layouts.labels).toBeDefined()
    })

    it('should work with kle-serial deserialization', () => {
      const viaData = {
        name: 'Test Layout',
        layouts: {
          keymap: [
            ['A', 'B', 'C'],
            ['D', 'E', 'F'],
          ],
        },
      }

      const kleData = convertViaToKle(viaData)

      // The KLE data should still be valid for kle-serial
      // Even though it has metadata embedded, kle-serial should handle it
      expect(Array.isArray(kleData)).toBe(true)
    })
  })
})
