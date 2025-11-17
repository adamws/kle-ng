import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as LZString from 'lz-string'
import {
  encodeLayoutToUrl,
  decodeLayoutFromUrl,
  generateShareableUrl,
  extractLayoutFromCurrentUrl,
  clearShareFromUrl,
  extractGistFromCurrentUrl,
  fetchGistLayout,
  clearGistFromUrl,
  extractErgogenUrlData,
} from '../url-sharing'
import { Key, KeyboardMetadata, Keyboard } from '@adamws/kle-serial'

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
  let sampleKeyboard: Keyboard

  beforeEach(() => {
    // Create sample keyboard
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

    sampleKeyboard = new Keyboard()
    sampleKeyboard.keys = [key1, key2]
    sampleKeyboard.meta = metadata

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
      const encoded = encodeLayoutToUrl(sampleKeyboard)

      expect(encoded).toBeTypeOf('string')
      expect(encoded.length).toBeGreaterThan(0)
      expect(encoded).toMatch(/^[A-Za-z0-9+/=_-]*$/) // URL-safe base64 pattern
    })

    it('should throw error for invalid data', () => {
      // Create invalid data that will cause KLE serialization to fail
      const invalidKeyboard = new Keyboard()
      invalidKeyboard.keys = null as unknown as Key[] // This will cause Serial.serialize to fail
      invalidKeyboard.meta = new KeyboardMetadata()

      expect(() => {
        encodeLayoutToUrl(invalidKeyboard)
      }).toThrow('Failed to encode layout data')
    })
  })

  describe('decodeLayoutFromUrl', () => {
    it('should decode previously encoded layout data', () => {
      const encoded = encodeLayoutToUrl(sampleKeyboard)
      const decoded = decodeLayoutFromUrl(encoded)

      expect(decoded).toEqual(sampleKeyboard)
      expect(decoded.keys).toHaveLength(2)
      expect(decoded.meta.name).toBe('Test Keyboard')
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
      const shareUrl = generateShareableUrl(sampleKeyboard)

      expect(shareUrl).toMatch(/^http:\/\/localhost:3000\/#share=/)
      expect(shareUrl).toContain('#share=')
    })

    it('should use custom base URL when provided', () => {
      const customBase = 'https://example.com/app'
      const shareUrl = generateShareableUrl(sampleKeyboard, customBase)

      expect(shareUrl).toMatch(/^https:\/\/example\.com\/app#share=/)
    })

    it('should generate URL that can be decoded back', () => {
      const shareUrl = generateShareableUrl(sampleKeyboard)
      const hashPart = shareUrl.split('#share=')[1]
      expect(hashPart).toBeDefined()
      const decoded = decodeLayoutFromUrl(hashPart!)

      expect(decoded).toEqual(sampleKeyboard)
    })
  })

  describe('extractLayoutFromCurrentUrl', () => {
    it('should extract layout data from URL hash', () => {
      const encoded = encodeLayoutToUrl(sampleKeyboard)
      mockLocation.hash = `#share=${encoded}`

      const extracted = extractLayoutFromCurrentUrl()

      expect(extracted).toEqual(sampleKeyboard)
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
      const shareUrl = generateShareableUrl(sampleKeyboard)

      // Simulate navigating to that URL
      const urlParts = shareUrl.split('#')
      mockLocation.hash = `#${urlParts[1]}`

      // Extract layout from URL
      const extracted = extractLayoutFromCurrentUrl()

      expect(extracted).toEqual(sampleKeyboard)
    })

    it('should handle empty layout data', () => {
      const emptyKeyboard = new Keyboard()
      emptyKeyboard.keys = []
      emptyKeyboard.meta = new KeyboardMetadata()

      const encoded = encodeLayoutToUrl(emptyKeyboard)
      const decoded = decodeLayoutFromUrl(encoded)

      expect(decoded.keys).toHaveLength(0)
      expect(decoded.meta).toBeInstanceOf(Object)
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

      const complexKeyboard = new Keyboard()
      complexKeyboard.keys = [complexKey]
      complexKeyboard.meta = sampleKeyboard.meta

      const encoded = encodeLayoutToUrl(complexKeyboard)
      const decoded = decodeLayoutFromUrl(encoded)

      const firstKey = decoded.keys[0]
      expect(firstKey).toBeDefined()
      expect(firstKey!.x).toBe(2.5)
      expect(firstKey!.rotation_angle).toBe(45)
      expect(firstKey!.rotation_x).toBe(3)
      expect(firstKey!.rotation_y).toBe(2)
    })
  })

  describe('gist functionality', () => {
    // Mock fetch for testing gist API calls
    const mockFetch = vi.fn()
    global.fetch = mockFetch

    beforeEach(() => {
      mockFetch.mockClear()
    })

    describe('extractGistFromCurrentUrl', () => {
      it('should extract gist ID from gist hash', () => {
        mockLocation.hash = '#gist=d760b7f76f2b703cbceaefd3b6646416'

        const gistId = extractGistFromCurrentUrl()

        expect(gistId).toBe('d760b7f76f2b703cbceaefd3b6646416')
      })

      it('should extract gist ID from full gist URL', () => {
        mockLocation.hash = '#gist=https://gist.github.com/tfuxu/d760b7f76f2b703cbceaefd3b6646416'

        const gistId = extractGistFromCurrentUrl()

        expect(gistId).toBe('d760b7f76f2b703cbceaefd3b6646416')
      })

      it('should return null when no gist hash present', () => {
        mockLocation.hash = ''

        const gistId = extractGistFromCurrentUrl()

        expect(gistId).toBeNull()
      })

      it('should return null when hash is not a gist URL', () => {
        mockLocation.hash = '#share=some-data'

        const gistId = extractGistFromCurrentUrl()

        expect(gistId).toBeNull()
      })

      it('should return null for invalid gist ID format', () => {
        mockLocation.hash = '#gist=invalid-gist-id'
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        const gistId = extractGistFromCurrentUrl()

        expect(gistId).toBeNull()
        expect(consoleSpy).toHaveBeenCalled()

        consoleSpy.mockRestore()
      })

      it('should return null for invalid full gist URL', () => {
        mockLocation.hash = '#gist=https://invalid-gist-url.com/test'
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        const gistId = extractGistFromCurrentUrl()

        expect(gistId).toBeNull()
        expect(consoleSpy).toHaveBeenCalled()

        consoleSpy.mockRestore()
      })
    })

    describe('fetchGistLayout', () => {
      const mockGistResponse = {
        files: {
          'layout.json': {
            content: JSON.stringify([
              ['Q', 'W', 'E', 'R'],
              ['A', 'S', 'D', 'F'],
            ]),
          },
        },
      }

      it('should fetch and parse gist layout successfully', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockGistResponse),
        })

        const layout = await fetchGistLayout('test-gist-id')

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.github.com/gists/test-gist-id',
          expect.objectContaining({
            headers: expect.objectContaining({
              Accept: 'application/vnd.github+json',
            }),
          }),
        )
        expect(layout.keys).toBeDefined()
        expect(Array.isArray(layout.keys)).toBe(true)
      })

      it('should throw error for 404 gist not found', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 404,
        })

        await expect(fetchGistLayout('nonexistent-gist')).rejects.toThrow('Gist not found')
      })

      it('should throw error for 403 rate limit exceeded', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 403,
        })

        await expect(fetchGistLayout('test-gist-id')).rejects.toThrow(
          'Rate limit exceeded or access denied',
        )
      })

      it('should throw error when no layout file found in gist', async () => {
        const emptyGistResponse = {
          files: {
            'readme.txt': {
              content: 'This is just a readme',
            },
          },
        }

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(emptyGistResponse),
        })

        await expect(fetchGistLayout('test-gist-id')).rejects.toThrow(
          'No keyboard layout file found in gist',
        )
      })

      it('should throw error for invalid JSON in layout file', async () => {
        const invalidJsonGistResponse = {
          files: {
            'layout.json': {
              content: 'invalid json content',
            },
          },
        }

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(invalidJsonGistResponse),
        })

        await expect(fetchGistLayout('test-gist-id')).rejects.toThrow(
          'Invalid JSON format in layout file',
        )
      })

      it('should throw error for non-array KLE data', async () => {
        const invalidKleResponse = {
          files: {
            'layout.json': {
              content: JSON.stringify({ not: 'an array' }),
            },
          },
        }

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(invalidKleResponse),
        })

        await expect(fetchGistLayout('test-gist-id')).rejects.toThrow(
          'Invalid KLE layout data structure - expected array format',
        )
      })

      it('should prioritize layout.json over other JSON files', async () => {
        const multiFileGistResponse = {
          files: {
            'other.json': {
              content: JSON.stringify([['Wrong', 'Layout']]),
            },
            'layout.json': {
              content: JSON.stringify([['Correct', 'Layout']]),
            },
            'random.json': {
              content: JSON.stringify([['Another', 'Wrong']]),
            },
          },
        }

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(multiFileGistResponse),
        })

        const layout = await fetchGistLayout('test-gist-id')

        expect(layout.keys).toBeDefined()
        expect(Array.isArray(layout.keys)).toBe(true)
        // Should have used layout.json, not other files
      })

      it('should handle network errors', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'))

        await expect(fetchGistLayout('test-gist-id')).rejects.toThrow('Network error')
      })
    })

    describe('clearGistFromUrl', () => {
      it('should clear gist hash from URL', () => {
        mockLocation.hash = '#gist=test-gist-id'
        mockLocation.href = 'http://localhost:3000/#gist=test-gist-id'

        clearGistFromUrl()

        expect(mockHistory.replaceState).toHaveBeenCalledWith(
          {},
          document.title,
          'http://localhost:3000/',
        )
      })

      it('should not call replaceState when no gist hash present', () => {
        mockLocation.hash = ''
        mockLocation.href = 'http://localhost:3000/'

        clearGistFromUrl()

        expect(mockHistory.replaceState).not.toHaveBeenCalled()
      })

      it('should not clear non-gist hashes', () => {
        mockLocation.hash = '#share=some-data'
        mockLocation.href = 'http://localhost:3000/#share=some-data'

        clearGistFromUrl()

        expect(mockHistory.replaceState).not.toHaveBeenCalled()
      })
    })

    describe('integration with hash changes', () => {
      it('should extract gist ID after hash change simulation', () => {
        // Simulate starting with no hash
        mockLocation.hash = ''
        expect(extractGistFromCurrentUrl()).toBeNull()

        // Simulate hash change to gist URL (valid hex gist ID)
        mockLocation.hash = '#gist=d760b7f76f2b703cbceaefd3b6646416'
        expect(extractGistFromCurrentUrl()).toBe('d760b7f76f2b703cbceaefd3b6646416')
      })

      it('should handle switching between share and gist URLs', () => {
        // Start with share URL
        const encoded = encodeLayoutToUrl(sampleKeyboard)
        mockLocation.hash = `#share=${encoded}`

        const extracted1 = extractLayoutFromCurrentUrl()

        expect(extracted1).toEqual(sampleKeyboard)
        expect(extractGistFromCurrentUrl()).toBeNull()

        // Switch to gist URL (valid hex gist ID)
        mockLocation.hash = '#gist=d760b7f76f2b703cbceaefd3b6646416'
        expect(extractLayoutFromCurrentUrl()).toBeNull()
        expect(extractGistFromCurrentUrl()).toBe('d760b7f76f2b703cbceaefd3b6646416')

        // Switch back to share URL
        mockLocation.hash = `#share=${encoded}`

        const extracted2 = extractLayoutFromCurrentUrl()

        expect(extracted2).toEqual(sampleKeyboard)
        expect(extractGistFromCurrentUrl()).toBeNull()
      })
    })
  })

  describe('ergogen functionality', () => {
    describe('extractErgogenUrlData', () => {
      // Real Ergogen URL from ergogen.xyz
      const ERGOGEN_URL =
        'https://ergogen.xyz/#N4Igxg9gdgZglgcxALhAWwKYBcCGyA6UABERlAnFBskQCwB0AjPQAyEAOElWAzgcUQBe0DH0IkSaHFgBOcAB78JEnFDAALCDKXKJMiLizUiAVnG7IAGwCuaKGIG6i7SgGsAnjqdzyXp0VcMd3oedkscTyIAWjNHf0DgrURKGgBtKMYAJgAaaMYATgBdc38AoJDcBAQMbSIskt00OAATZstqBqcEipwqmppY0spmjEVO3W6eSuraqIA2cZJKKm1FiUnp-ujM8f0AdwdSgCMDLAg0P2VNTEuJM-Y-LHVbI5hVW9UNLVuSGQwYGhSWQKAD6yxqIJOWDOaDWPHUcBgWDSUQA7LkMkVxlZbPYfkQqDhVnErucOiSJuVQn8cM0aJlmJlBqUysFQuFIlFMgAONYkbpJChQFGMZiokwYrEUkhvYks1khdg0ulEBn0Jl8hXsiI0Lm86XrcqClJEdL5egS6JS7wQA74p4vHT6QzGLlsARNGT6OV6f6A6RyeQglxQDwg64YBrNOBTT7GTKZADM9HFmXyqNR3JAAF8gA'

      // Extract just the hash part for testing
      const ERGOGEN_HASH =
        'N4Igxg9gdgZglgcxALhAWwKYBcCGyA6UABERlAnFBskQCwB0AjPQAyEAOElWAzgcUQBe0DH0IkSaHFgBOcAB78JEnFDAALCDKXKJMiLizUiAVnG7IAGwCuaKGIG6i7SgGsAnjqdzyXp0VcMd3oedkscTyIAWjNHf0DgrURKGgBtKMYAJgAaaMYATgBdc38AoJDcBAQMbSIskt00OAATZstqBqcEipwqmppY0spmjEVO3W6eSuraqIA2cZJKKm1FiUnp-ujM8f0AdwdSgCMDLAg0P2VNTEuJM-Y-LHVbI5hVW9UNLVuSGQwYGhSWQKAD6yxqIJOWDOaDWPHUcBgWDSUQA7LkMkVxlZbPYfkQqDhVnErucOiSJuVQn8cM0aJlmJlBqUysFQuFIlFMgAONYkbpJChQFGMZiokwYrEUkhvYks1khdg0ulEBn0Jl8hXsiI0Lm86XrcqClJEdL5egS6JS7wQA74p4vHT6QzGLlsARNGT6OV6f6A6RyeQglxQDwg64YBrNOBTT7GTKZADM9HFmXyqNR3JAAF8gA'

      it('should extract config from ergogen.xyz URL', () => {
        mockLocation.href = ERGOGEN_URL
        mockLocation.hash = `#${ERGOGEN_HASH}`

        const extracted = extractErgogenUrlData()

        expect(extracted).toBeDefined()
        expect(extracted).toHaveProperty('config')
        expect(typeof extracted!.config).toBe('string')
        expect(extracted!.config).toContain('meta:')
        expect(extracted!.config).toContain('points:')
      })

      it('should return null for non-ergogen URLs', () => {
        mockLocation.href = 'http://localhost:3000/'
        mockLocation.hash = '#share=some-data'

        const extracted = extractErgogenUrlData()

        expect(extracted).toBeNull()
      })

      it('should return null when ergogen URL has no hash', () => {
        mockLocation.href = 'https://ergogen.xyz/'
        mockLocation.hash = ''

        const extracted = extractErgogenUrlData()

        expect(extracted).toBeNull()
      })

      it('should return null for invalid compressed data', () => {
        mockLocation.href = 'https://ergogen.xyz/#invalid-data'
        mockLocation.hash = '#invalid-data'
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        const extracted = extractErgogenUrlData()

        expect(extracted).toBeNull()
        expect(consoleSpy).toHaveBeenCalled()

        consoleSpy.mockRestore()
      })

      it('should extract YAML config that can be processed by ergogen', async () => {
        const yaml = await import('js-yaml')
        const { ergogenGetPoints, ergogenPointsToKeyboard } = await import('../ergogen-converter')

        mockLocation.href = ERGOGEN_URL
        mockLocation.hash = `#${ERGOGEN_HASH}`

        const extracted = extractErgogenUrlData()

        expect(extracted).toBeDefined()

        // Parse YAML
        const config = yaml.load(extracted!.config)
        expect(config).toBeDefined()

        const points = await ergogenGetPoints(config)
        expect(points).toBeDefined()

        // Convert to keyboard
        const keyboard = ergogenPointsToKeyboard(points)
        expect(keyboard).toBeDefined()
        expect(keyboard.keys).toBeDefined()
        expect(keyboard.keys.length).toBeGreaterThan(0)

        // This specific URL should generate a layout with multiple keys
        // (exact count depends on the YAML config, but it should be > 10)
        expect(keyboard.keys.length).toBeGreaterThan(10)
      })

      it('should handle malformed JSON in decompressed data', () => {
        // Create a compressed string that decodes to invalid JSON
        const invalidData = 'not valid json'
        const compressed = LZString.compressToEncodedURIComponent(invalidData)

        mockLocation.href = `https://ergogen.xyz/#${compressed}`
        mockLocation.hash = `#${compressed}`
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        const extracted = extractErgogenUrlData()

        expect(extracted).toBeNull()
        expect(consoleSpy).toHaveBeenCalled()

        consoleSpy.mockRestore()
      })

      it('should return null when decompressed JSON lacks config property', () => {
        // Create a compressed string with valid JSON but wrong structure
        const wrongStructure = { notConfig: 'some data' }
        const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(wrongStructure))

        mockLocation.href = `https://ergogen.xyz/#${compressed}`
        mockLocation.hash = `#${compressed}`

        const extracted = extractErgogenUrlData()

        expect(extracted).toBeNull()
      })
    })
  })
})
