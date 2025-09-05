import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as LZString from 'lz-string'
import {
  encodeLayoutToUrl,
  decodeLayoutFromUrl,
  generateShareableUrl,
  extractLayoutFromCurrentUrl,
  clearShareFromUrl,
} from '../url-sharing'
import { Key, KeyboardMetadata } from '@ijprest/kle-serial'
import type { LayoutData } from '../url-sharing'

// Mock window.location
const mockLocation = {
  href: 'http://localhost:3000/',
  origin: 'http://localhost:3000',
  pathname: '/',
  hash: '',
}

// Mock window.history
const mockHistory = {
  replaceState: vi.fn(),
}

// Setup global mocks
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
})

Object.defineProperty(window, 'history', {
  value: mockHistory,
  writable: true,
})

describe('url-sharing', () => {
  let sampleLayoutData: LayoutData

  beforeEach(() => {
    // Create sample layout data
    const key1 = new Key()
    key1.x = 0
    key1.y = 0
    key1.width = 1
    key1.height = 1

    const key2 = new Key()
    key2.x = 1
    key2.y = 0
    key2.width = 1
    key2.height = 1

    const metadata = new KeyboardMetadata()
    metadata.name = 'Test Keyboard'
    metadata.author = 'Test Author'

    sampleLayoutData = {
      keys: [key1, key2],
      metadata,
    }

    // Reset mocks
    mockLocation.hash = ''
    mockHistory.replaceState.mockClear()
  })

  afterEach(() => {
    // Clean up
    mockLocation.hash = ''
  })

  describe('encodeLayoutToUrl', () => {
    it('should encode layout data to a URL-safe string', () => {
      const encoded = encodeLayoutToUrl(sampleLayoutData)

      expect(encoded).toBeTypeOf('string')
      expect(encoded.length).toBeGreaterThan(0)
      expect(encoded).toMatch(/^[A-Za-z0-9+/=_-]*$/) // URL-safe base64 pattern
    })

    it('should throw error for invalid data', () => {
      // Create invalid data that will cause KLE serialization to fail
      const invalidData: LayoutData = {
        keys: null as unknown as Key[], // This will cause Serial.serialize to fail
        metadata: new KeyboardMetadata(),
      }

      expect(() => {
        encodeLayoutToUrl(invalidData)
      }).toThrow('Failed to encode layout data')
    })
  })

  describe('decodeLayoutFromUrl', () => {
    it('should decode previously encoded layout data', () => {
      const encoded = encodeLayoutToUrl(sampleLayoutData)
      const decoded = decodeLayoutFromUrl(encoded)

      expect(decoded).toEqual(sampleLayoutData)
      expect(decoded.keys).toHaveLength(2)
      expect(decoded.metadata.name).toBe('Test Keyboard')
    })

    it('should throw error for invalid encoded string', () => {
      expect(() => {
        decodeLayoutFromUrl('invalid-data')
      }).toThrow('Failed to decode layout data from URL')
    })

    it('should throw error for malformed JSON structure', () => {
      // Create a manually crafted invalid compressed string that will decode to invalid KLE data
      const invalidKleData = { not: 'kle-format' }
      const invalidJson = JSON.stringify(invalidKleData)
      const invalidEncoded = LZString.compressToEncodedURIComponent(invalidJson)

      expect(() => {
        decodeLayoutFromUrl(invalidEncoded!)
      }).toThrow('Failed to decode layout data from URL')
    })
  })

  describe('generateShareableUrl', () => {
    it('should generate a complete shareable URL', () => {
      const shareUrl = generateShareableUrl(sampleLayoutData)

      expect(shareUrl).toMatch(/^http:\/\/localhost:3000\/#share=/)
      expect(shareUrl).toContain('#share=')
    })

    it('should use custom base URL when provided', () => {
      const customBase = 'https://example.com/app'
      const shareUrl = generateShareableUrl(sampleLayoutData, customBase)

      expect(shareUrl).toMatch(/^https:\/\/example\.com\/app#share=/)
    })

    it('should generate URL that can be decoded back', () => {
      const shareUrl = generateShareableUrl(sampleLayoutData)
      const hashPart = shareUrl.split('#share=')[1]
      const decoded = decodeLayoutFromUrl(hashPart)

      expect(decoded).toEqual(sampleLayoutData)
    })
  })

  describe('extractLayoutFromCurrentUrl', () => {
    it('should extract layout data from URL hash', () => {
      const encoded = encodeLayoutToUrl(sampleLayoutData)
      mockLocation.hash = `#share=${encoded}`

      const extracted = extractLayoutFromCurrentUrl()

      expect(extracted).toEqual(sampleLayoutData)
    })

    it('should return null when no share hash present', () => {
      mockLocation.hash = ''

      const extracted = extractLayoutFromCurrentUrl()

      expect(extracted).toBeNull()
    })

    it('should return null when hash is not a share URL', () => {
      mockLocation.hash = '#some-other-hash'

      const extracted = extractLayoutFromCurrentUrl()

      expect(extracted).toBeNull()
    })

    it('should return null and log error for invalid share data', () => {
      mockLocation.hash = '#share=invalid-data'
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const extracted = extractLayoutFromCurrentUrl()

      expect(extracted).toBeNull()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('clearShareFromUrl', () => {
    it('should clear share hash from URL', () => {
      mockLocation.hash = '#share=some-data'
      mockLocation.href = 'http://localhost:3000/#share=some-data'

      clearShareFromUrl()

      expect(mockHistory.replaceState).toHaveBeenCalledWith(
        {},
        document.title,
        'http://localhost:3000/',
      )
    })

    it('should not call replaceState when no share hash present', () => {
      mockLocation.hash = ''
      mockLocation.href = 'http://localhost:3000/'

      clearShareFromUrl()

      expect(mockHistory.replaceState).not.toHaveBeenCalled()
    })

    it('should not clear non-share hashes', () => {
      mockLocation.hash = '#some-other-hash'
      mockLocation.href = 'http://localhost:3000/#some-other-hash'

      clearShareFromUrl()

      expect(mockHistory.replaceState).not.toHaveBeenCalled()
    })
  })

  describe('integration tests', () => {
    it('should handle complete encode -> URL -> decode cycle', () => {
      // Generate shareable URL
      const shareUrl = generateShareableUrl(sampleLayoutData)

      // Simulate navigating to that URL
      const urlParts = shareUrl.split('#')
      mockLocation.hash = `#${urlParts[1]}`

      // Extract layout from URL
      const extracted = extractLayoutFromCurrentUrl()

      expect(extracted).toEqual(sampleLayoutData)
    })

    it('should handle empty layout data', () => {
      const emptyLayout: LayoutData = {
        keys: [],
        metadata: new KeyboardMetadata(),
      }

      const encoded = encodeLayoutToUrl(emptyLayout)
      const decoded = decodeLayoutFromUrl(encoded)

      expect(decoded.keys).toHaveLength(0)
      expect(decoded.metadata).toBeInstanceOf(Object)
    })

    it('should handle complex layout with rotated keys', () => {
      const complexKey = new Key()
      complexKey.x = 2.5
      complexKey.y = 1.25
      complexKey.width = 1.5
      complexKey.height = 2
      complexKey.rotation_angle = 45
      complexKey.rotation_x = 3
      complexKey.rotation_y = 2

      const complexLayout: LayoutData = {
        keys: [complexKey],
        metadata: sampleLayoutData.metadata,
      }

      const encoded = encodeLayoutToUrl(complexLayout)
      const decoded = decodeLayoutFromUrl(encoded)

      expect(decoded.keys[0].x).toBe(2.5)
      expect(decoded.keys[0].rotation_angle).toBe(45)
      expect(decoded.keys[0].rotation_x).toBe(3)
      expect(decoded.keys[0].rotation_y).toBe(2)
    })
  })
})
