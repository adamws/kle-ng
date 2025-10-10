import { describe, it, expect } from 'vitest'
import { convertViaToKle, convertKleToVia } from '../via-import'

// VIA test data from https://github.com/the-via/keyboards
const corneliusViaLayout = {
  name: 'Cornelius',
  vendorId: '0x3265',
  productId: '0x0005',
  matrix: {
    rows: 4,
    cols: 12,
  },
  layouts: {
    keymap: [
      [
        {
          r: 10,
          rx: 1.5,
          x: 2.5,
        },
        '0,3',
      ],
      [
        {
          y: -0.875,
          x: 3.5,
        },
        '0,4',
      ],
      [
        {
          y: -0.875,
          x: 1.5,
        },
        '0,2',
        {
          x: 2,
        },
        '0,5',
      ],
      [
        {
          y: -0.625,
          x: -0.5,
        },
        '0,0',
        '0,1',
      ],
      [
        {
          y: -0.625,
          x: 2.5,
        },
        '1,3',
      ],
      [
        {
          y: -0.875,
          x: 3.5,
        },
        '1,4',
      ],
      [
        {
          y: -0.875,
          x: 1.5,
        },
        '1,2',
        {
          x: 2,
        },
        '1,5',
      ],
      [
        {
          y: -0.625,
          x: -0.5,
        },
        '1,0',
        '1,1',
      ],
      [
        {
          y: -0.625,
          x: 2.5,
        },
        '2,3',
      ],
      [
        {
          y: -0.875,
          x: 3.5,
        },
        '2,4',
      ],
      [
        {
          y: -0.875,
          x: 1.5,
        },
        '2,2',
        {
          x: 2,
        },
        '2,5',
      ],
      [
        {
          y: -0.625,
          x: -0.5,
        },
        '2,0',
        '2,1',
      ],
      [
        {
          y: -0.375,
          x: 1.5,
        },
        '3,2',
        {
          x: 0.5,
        },
        '3,3',
      ],
      [
        {
          y: -0.625,
          x: -0.5,
        },
        '3,0',
        '3,1',
      ],
      [
        {
          r: 25,
          y: -2.515,
          x: 4.97,
        },
        '3,4',
      ],
      [
        {
          r: 40,
          y: -2.6,
          x: 6.55,
        },
        '3,5',
      ],
      [
        {
          r: -40,
          rx: 13.25,
          y: 0.51,
          x: -7.55,
        },
        '3,6',
      ],
      [
        {
          r: -25,
          y: 0.6,
          x: -5.97,
        },
        '3,7',
      ],
      [
        {
          r: -10,
          y: -3.11,
          x: -3.5,
        },
        '0,8',
      ],
      [
        {
          y: -0.875,
          x: -4.5,
        },
        '0,7',
      ],
      [
        {
          y: -0.875,
          x: -5.5,
        },
        '0,6',
        {
          x: 2,
        },
        '0,9',
      ],
      [
        {
          y: -0.625,
          x: -1.5,
        },
        '0,10',
        '0,11',
      ],
      [
        {
          y: -0.625,
          x: -3.5,
        },
        '1,8',
      ],
      [
        {
          y: -0.875,
          x: -4.5,
        },
        '1,7',
      ],
      [
        {
          y: -0.875,
          x: -5.5,
        },
        '1,6',
        {
          x: 2,
        },
        '1,9',
      ],
      [
        {
          y: -0.625,
          x: -1.5,
        },
        '1,10',
        '1,11',
      ],
      [
        {
          y: -0.625,
          x: -3.5,
        },
        '2,8',
      ],
      [
        {
          y: -0.875,
          x: -4.5,
        },
        '2,7',
      ],
      [
        {
          y: -0.875,
          x: -5.5,
        },
        '2,6',
        {
          x: 2,
        },
        '2,9',
      ],
      [
        {
          y: -0.625,
          x: -1.5,
        },
        '2,10',
        '2,11',
      ],
      [
        {
          y: -0.375,
          x: -4,
        },
        '3,8',
        {
          x: 0.5,
        },
        '3,9',
      ],
      [
        {
          y: -0.625,
          x: -1.5,
        },
        '3,10',
        '3,11',
      ],
    ],
  },
}

describe('VIA Import/Export E2E Roundtrip', () => {
  it('should maintain data integrity through full roundtrip: VIA → KLE → VIA', () => {
    // Step 1: Import VIA JSON (convert to KLE format with embedded VIA metadata)
    const kleData = convertViaToKle(corneliusViaLayout)
    expect(kleData).toBeTruthy()

    // Step 2: Export as KLE JSON (this is what getSerializedData('kle') would return)
    // The kleData now contains the keymap with _kleng_via_data embedded
    const kleJson = JSON.parse(JSON.stringify(kleData))

    // Step 3: Import KLE JSON (this would be loaded back)
    // In a real scenario, this would go through the store's loadKLELayout
    // For testing, we can use the kleJson directly

    // Step 4: Export VIA JSON (convert back to VIA format)
    const exportedViaData = convertKleToVia(kleJson)
    expect(exportedViaData).toBeTruthy()

    // Verify the exported VIA data matches the original
    expect(exportedViaData).toEqual(corneliusViaLayout)
  })

  it('should remove _kleng_via_data from keymap in exported VIA JSON', () => {
    // Convert VIA to KLE (embeds _kleng_via_data)
    const kleData = convertViaToKle(corneliusViaLayout)

    // Convert back to VIA
    const exportedViaData = convertKleToVia(kleData)
    expect(exportedViaData).toBeTruthy()

    // Check that the keymap doesn't contain any _kleng_via_data
    const keymap = (exportedViaData!.layouts as Record<string, unknown>).keymap as unknown[]

    const hasViaData = (data: unknown): boolean => {
      if (typeof data === 'object' && data !== null) {
        if ('_kleng_via_data' in data) {
          return true
        }
        // Recursively check nested objects and arrays
        if (Array.isArray(data)) {
          return data.some((item) => hasViaData(item))
        }
        return Object.values(data as Record<string, unknown>).some((value) => hasViaData(value))
      }
      return false
    }

    expect(hasViaData(keymap)).toBe(false)
  })

  it('should preserve VIA metadata fields (name, vendorId, productId, matrix)', () => {
    // Convert VIA to KLE
    const kleData = convertViaToKle(corneliusViaLayout)

    // Convert back to VIA
    const exportedViaData = convertKleToVia(kleData)
    expect(exportedViaData).toBeTruthy()

    // Verify all metadata fields are preserved
    expect(exportedViaData!.name).toBe(corneliusViaLayout.name)
    expect(exportedViaData!.vendorId).toBe(corneliusViaLayout.vendorId)
    expect(exportedViaData!.productId).toBe(corneliusViaLayout.productId)
    expect(exportedViaData!.matrix).toEqual(corneliusViaLayout.matrix)
  })

  it('should preserve keymap structure and content', () => {
    // Convert VIA to KLE
    const kleData = convertViaToKle(corneliusViaLayout)

    // Convert back to VIA
    const exportedViaData = convertKleToVia(kleData)
    expect(exportedViaData).toBeTruthy()

    // Verify keymap structure
    const originalKeymap = corneliusViaLayout.layouts.keymap
    const exportedKeymap = (exportedViaData!.layouts as Record<string, unknown>).keymap as unknown[]

    expect(exportedKeymap.length).toBe(originalKeymap.length)

    // Deep comparison of keymap content
    expect(exportedKeymap).toEqual(originalKeymap)
  })
})
