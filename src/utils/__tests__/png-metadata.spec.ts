import { describe, it, expect } from 'vitest'
import * as LZString from 'lz-string'
import {
  addMetadataToPng,
  extractMetadataFromPng,
  hasKleMetadata,
  extractKleLayout,
  createPngWithKleLayout,
} from '../png-metadata'

// Mock PNG data - simplified version for testing
const createMockPngBlob = (): Blob => {
  // PNG signature + IHDR chunk + IEND chunk (minimal valid PNG)
  const pngData = new Uint8Array([
    // PNG signature
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    // IHDR chunk (minimal 1x1 PNG)
    0x00,
    0x00,
    0x00,
    0x0d, // length: 13
    0x49,
    0x48,
    0x44,
    0x52, // type: IHDR
    0x00,
    0x00,
    0x00,
    0x01, // width: 1
    0x00,
    0x00,
    0x00,
    0x01, // height: 1
    0x08,
    0x02,
    0x00,
    0x00,
    0x00, // bit depth, color type, compression, filter, interlace
    0x90,
    0x77,
    0x53,
    0xde, // CRC
    // IDAT chunk (minimal image data)
    0x00,
    0x00,
    0x00,
    0x0c, // length: 12
    0x49,
    0x44,
    0x41,
    0x54, // type: IDAT
    0x78,
    0x9c,
    0x62,
    0xf8,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x01,
    0x01,
    0x00,
    0x18,
    0xdd,
    0x8d,
    0xb4, // CRC
    // IEND chunk
    0x00,
    0x00,
    0x00,
    0x00, // length: 0
    0x49,
    0x45,
    0x4e,
    0x44, // type: IEND
    0xae,
    0x42,
    0x60,
    0x82, // CRC
  ])

  return new Blob([pngData], { type: 'image/png' })
}

describe('png-metadata', () => {
  describe('addMetadataToPng', () => {
    it('should add metadata to PNG file', async () => {
      const originalPng = createMockPngBlob()
      const metadata = {
        'Test-Key': 'Test Value',
        'KLE-Layout': '[[{"t":"Test"}]]',
      }

      const result = await addMetadataToPng(originalPng, metadata)
      expect(result).toBeInstanceOf(Blob)
      expect(result.type).toBe('image/png')
      expect(result.size).toBeGreaterThan(originalPng.size)
    })

    it('should handle empty metadata', async () => {
      const originalPng = createMockPngBlob()
      const metadata = {}

      const result = await addMetadataToPng(originalPng, metadata)
      expect(result).toBeInstanceOf(Blob)
      expect(result.type).toBe('image/png')
    })
  })

  describe('extractMetadataFromPng', () => {
    it('should extract metadata from PNG with embedded data', async () => {
      const originalPng = createMockPngBlob()
      const metadata = {
        'Test-Key': 'Test Value',
        Author: 'Test Author',
      }

      const pngWithMetadata = await addMetadataToPng(originalPng, metadata)
      const extractedMetadata = await extractMetadataFromPng(pngWithMetadata)

      expect(extractedMetadata).toEqual(metadata)
    })

    it('should return empty object for PNG without metadata', async () => {
      const originalPng = createMockPngBlob()
      const extractedMetadata = await extractMetadataFromPng(originalPng)

      expect(extractedMetadata).toEqual({})
    })

    it('should throw error for invalid PNG data', async () => {
      const invalidBlob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' })

      await expect(extractMetadataFromPng(invalidBlob)).rejects.toThrow('Invalid PNG file format')
    })
  })

  describe('hasKleMetadata', () => {
    it('should return true for PNG with KLE layout metadata', async () => {
      const originalPng = createMockPngBlob()
      const metadata = {
        'KLE-Layout': '[[{"t":"Test"}]]',
      }

      const pngWithMetadata = await addMetadataToPng(originalPng, metadata)
      const hasMetadata = await hasKleMetadata(pngWithMetadata)

      expect(hasMetadata).toBe(true)
    })

    it('should return false for PNG without KLE metadata', async () => {
      const originalPng = createMockPngBlob()
      const hasMetadata = await hasKleMetadata(originalPng)

      expect(hasMetadata).toBe(false)
    })

    it('should handle corrupted PNG gracefully', async () => {
      const invalidBlob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' })
      const hasMetadata = await hasKleMetadata(invalidBlob)

      expect(hasMetadata).toBe(false)
    })
  })

  describe('extractKleLayout', () => {
    it('should extract KLE layout from compressed PNG metadata', async () => {
      const originalPng = createMockPngBlob()
      const layoutData = [
        ['Q', 'W', 'E'],
        ['A', 'S', 'D'],
      ]

      // Use createPngWithKleLayout which now uses compression
      const pngWithLayout = await createPngWithKleLayout(originalPng, layoutData)
      const extractedLayout = await extractKleLayout(pngWithLayout)

      expect(extractedLayout).toEqual(layoutData)
    })

    it('should extract KLE layout from uncompressed PNG metadata (backward compatibility)', async () => {
      const originalPng = createMockPngBlob()
      const layoutData = [
        ['Q', 'W', 'E'],
        ['A', 'S', 'D'],
      ]
      // Manually create uncompressed metadata for backward compatibility test
      const metadata = {
        'KLE-Layout': JSON.stringify(layoutData),
      }

      const pngWithMetadata = await addMetadataToPng(originalPng, metadata)
      const extractedLayout = await extractKleLayout(pngWithMetadata)

      expect(extractedLayout).toEqual(layoutData)
    })

    it('should verify compression is working correctly', async () => {
      const originalPng = createMockPngBlob()
      const layoutData = [
        ['Q', 'W', 'E', 'R', 'T', 'Y'],
        ['A', 'S', 'D', 'F', 'G', 'H'],
        [{ w: 2.25 }, 'Shift', 'Z', 'X', 'C', 'V', 'B'],
      ]

      const pngWithLayout = await createPngWithKleLayout(originalPng, layoutData)
      const metadata = await extractMetadataFromPng(pngWithLayout)

      // Verify the stored data is compressed (not readable JSON)
      const storedData = metadata['KLE-Layout']
      expect(() => JSON.parse(storedData)).toThrow()

      // But decompression should work
      const decompressed = LZString.decompressFromBase64(storedData)
      expect(decompressed).toBeTruthy()
      expect(JSON.parse(decompressed!)).toEqual(layoutData)

      // And extractKleLayout should work
      const extractedLayout = await extractKleLayout(pngWithLayout)
      expect(extractedLayout).toEqual(layoutData)
    })

    it('should return null for PNG without KLE metadata', async () => {
      const originalPng = createMockPngBlob()
      const extractedLayout = await extractKleLayout(originalPng)

      expect(extractedLayout).toBeNull()
    })

    it('should return null for PNG with invalid KLE JSON', async () => {
      const originalPng = createMockPngBlob()
      const metadata = {
        'KLE-Layout': 'invalid json',
      }

      const pngWithMetadata = await addMetadataToPng(originalPng, metadata)
      const extractedLayout = await extractKleLayout(pngWithMetadata)

      expect(extractedLayout).toBeNull()
    })
  })

  describe('createPngWithKleLayout', () => {
    it('should create PNG with embedded KLE layout', async () => {
      const originalPng = createMockPngBlob()
      const layoutData = [
        ['Q', 'W', 'E'],
        ['A', 'S', 'D'],
      ]

      const result = await createPngWithKleLayout(originalPng, layoutData)

      expect(result).toBeInstanceOf(Blob)
      expect(result.type).toBe('image/png')
      expect(result.size).toBeGreaterThan(originalPng.size)

      // Verify the layout can be extracted
      const extractedLayout = await extractKleLayout(result)
      expect(extractedLayout).toEqual(layoutData)

      // Verify standard metadata is added
      const metadata = await extractMetadataFromPng(result)
      expect(metadata).toHaveProperty('Software', 'Keyboard Layout Editor NG')
      expect(metadata).toHaveProperty('Creation-Time')
    })

    it('should include additional metadata', async () => {
      const originalPng = createMockPngBlob()
      const layoutData = [['Test']]
      const additionalMetadata = {
        Title: 'Test Layout',
        Author: 'Test Author',
      }

      const result = await createPngWithKleLayout(originalPng, layoutData, additionalMetadata)
      const metadata = await extractMetadataFromPng(result)

      expect(metadata).toHaveProperty('Title', 'Test Layout')
      expect(metadata).toHaveProperty('Author', 'Test Author')
      expect(metadata).toHaveProperty('Software', 'Keyboard Layout Editor NG')
    })
  })

  describe('Complete Roundtrip Tests', () => {
    it('should maintain perfect data integrity for simple layouts', async () => {
      const originalPng = createMockPngBlob()
      const originalLayout = [
        ['Esc', 'F1', 'F2', 'F3'],
        ['~', '1', '2', '3', '4'],
        [{ w: 1.5 }, 'Tab', 'Q', 'W', 'E'],
      ]

      // Original → PNG with metadata → Extract → Compare
      const pngWithLayout = await createPngWithKleLayout(originalPng, originalLayout)
      const extractedLayout = await extractKleLayout(pngWithLayout)

      expect(extractedLayout).toEqual(originalLayout)
    })

    it('should maintain data integrity for complex layouts with properties', async () => {
      const originalPng = createMockPngBlob()
      const complexLayout = [
        [{ c: '#ff0000', t: '#ffffff' }, 'Esc', { x: 1, c: '#00ff00' }, 'F1', 'F2'],
        [{ y: 0.5, w: 1.25, h: 2, r: 15, rx: 2, ry: 1 }, 'Shift', { x: 2.75 }, 'A', 'S', 'D'],
        [{ w: 6.25 }, '', { w: 1.5 }, 'Alt', { w: 1.5 }, 'Ctrl'],
      ]

      // Test the full roundtrip
      const pngWithLayout = await createPngWithKleLayout(originalPng, complexLayout)
      const extractedLayout = await extractKleLayout(pngWithLayout)

      // Verify exact data match
      expect(extractedLayout).toEqual(complexLayout)
      expect(JSON.stringify(extractedLayout)).toBe(JSON.stringify(complexLayout))
    })

    it('should handle unicode characters and special cases', async () => {
      const originalPng = createMockPngBlob()
      const unicodeLayout = [
        ['Esc', 'α', 'β', 'γ'],
        ['🔥', '💻', '⌘', '⌥'],
        [{ t: 'Special\nMultiline\nText' }, 'Key', 'With', 'Unicode: ♪♫♬'],
      ]

      const pngWithLayout = await createPngWithKleLayout(originalPng, unicodeLayout)
      const extractedLayout = await extractKleLayout(pngWithLayout)

      expect(extractedLayout).toEqual(unicodeLayout)
    })

    it('should verify compression is providing size benefits', async () => {
      const originalPng = createMockPngBlob()

      // Create a reasonably large layout to test compression effectiveness
      const largeLayout = []
      for (let row = 0; row < 6; row++) {
        const currentRow = []
        for (let col = 0; col < 21; col++) {
          if (Math.random() > 0.7) {
            // Add some properties to make it larger
            currentRow.push({
              c: '#' + Math.floor(Math.random() * 16777215).toString(16),
              w: 1 + Math.random(),
              h: 1 + Math.random() * 0.5,
            })
          }
          currentRow.push(`Key${row}-${col}`)
        }
        largeLayout.push(currentRow)
      }

      // Test compression
      const uncompressedSize = JSON.stringify(largeLayout).length
      const pngWithLayout = await createPngWithKleLayout(originalPng, largeLayout)
      const metadata = await extractMetadataFromPng(pngWithLayout)
      const compressedSize = metadata['KLE-Layout'].length

      // Verify compression provides benefit
      expect(compressedSize).toBeLessThan(uncompressedSize)

      // Verify data integrity despite compression
      const extractedLayout = await extractKleLayout(pngWithLayout)
      expect(extractedLayout).toEqual(largeLayout)

      console.log(
        `Compression test: ${uncompressedSize} bytes → ${compressedSize} bytes (${Math.round((1 - compressedSize / uncompressedSize) * 100)}% reduction)`,
      )
    })

    it('should maintain data types and precision', async () => {
      const originalPng = createMockPngBlob()
      const precisionLayout = [
        [
          {
            x: 0.123456789,
            y: 0.987654321,
            w: 1.5,
            h: 2.0,
            r: 15.5,
            rx: 2.25,
            ry: 1.75,
            c: '#ff0000',
            t: '#ffffff',
            a: 7,
          },
          'Test Key',
          {
            f: 3,
            f2: 1,
            w2: 1.25,
            h2: 1.5,
            x2: 0.25,
            y2: 0.125,
          },
          'Another Key',
        ],
      ]

      const pngWithLayout = await createPngWithKleLayout(originalPng, precisionLayout)
      const extractedLayout = await extractKleLayout(pngWithLayout)

      // Verify exact precision is maintained
      expect(extractedLayout).toEqual(precisionLayout)

      // Test specific numeric precision
      const originalProps = precisionLayout[0][0] as Record<string, unknown>
      const extractedProps = (extractedLayout as unknown[][])[0][0] as Record<string, unknown>

      expect(extractedProps.x).toBe(originalProps.x)
      expect(extractedProps.y).toBe(originalProps.y)
      expect(extractedProps.w).toBe(originalProps.w)
      expect(extractedProps.r).toBe(originalProps.r)
    })
  })
})
