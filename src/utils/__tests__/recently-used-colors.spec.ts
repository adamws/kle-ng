import { describe, it, expect, beforeEach, vi } from 'vitest'
import { recentlyUsedColorsManager } from '../recently-used-colors'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('Recently Used Colors Manager', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()
  })

  describe('getRecentlyUsedColors', () => {
    it('returns empty array when no colors are stored', () => {
      localStorageMock.getItem.mockReturnValue(null)

      const colors = recentlyUsedColorsManager.getRecentlyUsedColors()

      expect(colors).toEqual([])
      expect(localStorageMock.getItem).toHaveBeenCalledWith('kle-ng-recently-used-colors')
    })

    it('returns stored colors when available', () => {
      const storedColors = ['#ff0000', '#00ff00', '#0000ff']
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedColors))

      const colors = recentlyUsedColorsManager.getRecentlyUsedColors()

      expect(colors).toEqual(storedColors)
    })

    it('limits returned colors to maximum of 12', () => {
      const storedColors = Array.from(
        { length: 15 },
        (_, i) => `#${i.toString(16).padStart(6, '0')}`,
      )
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedColors))

      const colors = recentlyUsedColorsManager.getRecentlyUsedColors()

      expect(colors).toHaveLength(12)
      expect(colors).toEqual(storedColors.slice(0, 12))
    })

    it('handles invalid JSON gracefully', () => {
      localStorageMock.getItem.mockReturnValue('invalid-json')
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const colors = recentlyUsedColorsManager.getRecentlyUsedColors()

      expect(colors).toEqual([])
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load recently used colors from localStorage:',
        expect.any(Error),
      )

      consoleSpy.mockRestore()
    })

    it('handles non-array data gracefully', () => {
      localStorageMock.getItem.mockReturnValue('"not-an-array"')

      const colors = recentlyUsedColorsManager.getRecentlyUsedColors()

      expect(colors).toEqual([])
    })
  })

  describe('addColor', () => {
    it('adds a new color to the beginning of the list', () => {
      localStorageMock.getItem.mockReturnValue('[]')

      recentlyUsedColorsManager.addColor('#ff0000')

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'kle-ng-recently-used-colors',
        JSON.stringify(['#ff0000']),
      )
    })

    it('moves existing color to the beginning', () => {
      const existingColors = ['#ff0000', '#00ff00', '#0000ff']
      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingColors))

      recentlyUsedColorsManager.addColor('#00FF00') // Different case

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'kle-ng-recently-used-colors',
        JSON.stringify(['#00ff00', '#ff0000', '#0000ff']),
      )
    })

    it('limits stored colors to maximum of 12', () => {
      const existingColors = Array.from(
        { length: 12 },
        (_, i) => `#${i.toString(16).padStart(6, '0')}`,
      )
      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingColors))

      recentlyUsedColorsManager.addColor('#ffffff')

      const expectedColors = ['#ffffff', ...existingColors.slice(0, 11)]
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'kle-ng-recently-used-colors',
        JSON.stringify(expectedColors),
      )
    })

    it('ignores invalid colors', () => {
      localStorageMock.getItem.mockReturnValue('[]')

      recentlyUsedColorsManager.addColor('invalid-color')
      recentlyUsedColorsManager.addColor('')
      recentlyUsedColorsManager.addColor('red')

      expect(localStorageMock.setItem).not.toHaveBeenCalled()
    })

    it('normalizes color to lowercase', () => {
      localStorageMock.getItem.mockReturnValue('[]')

      recentlyUsedColorsManager.addColor('#FF0000')

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'kle-ng-recently-used-colors',
        JSON.stringify(['#ff0000']),
      )
    })

    it('handles localStorage errors gracefully', () => {
      localStorageMock.getItem.mockReturnValue('[]')
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      recentlyUsedColorsManager.addColor('#ff0000')

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save recently used colors to localStorage:',
        expect.any(Error),
      )

      consoleSpy.mockRestore()
    })
  })

  describe('clear', () => {
    it('removes colors from localStorage', () => {
      recentlyUsedColorsManager.clear()

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('kle-ng-recently-used-colors')
    })

    it('handles localStorage errors gracefully', () => {
      localStorageMock.removeItem.mockImplementation(() => {
        throw new Error('Storage error')
      })
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      recentlyUsedColorsManager.clear()

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to clear recently used colors from localStorage:',
        expect.any(Error),
      )

      consoleSpy.mockRestore()
    })
  })

  describe('integration tests', () => {
    it('maintains color order correctly through multiple operations', () => {
      localStorageMock.getItem.mockReturnValue('[]')

      // Add first color
      recentlyUsedColorsManager.addColor('#ff0000')
      expect(localStorageMock.setItem).toHaveBeenLastCalledWith(
        'kle-ng-recently-used-colors',
        JSON.stringify(['#ff0000']),
      )

      // Add second color
      localStorageMock.getItem.mockReturnValue(JSON.stringify(['#ff0000']))
      recentlyUsedColorsManager.addColor('#00ff00')
      expect(localStorageMock.setItem).toHaveBeenLastCalledWith(
        'kle-ng-recently-used-colors',
        JSON.stringify(['#00ff00', '#ff0000']),
      )

      // Re-add first color (should move to front)
      localStorageMock.getItem.mockReturnValue(JSON.stringify(['#00ff00', '#ff0000']))
      recentlyUsedColorsManager.addColor('#ff0000')
      expect(localStorageMock.setItem).toHaveBeenLastCalledWith(
        'kle-ng-recently-used-colors',
        JSON.stringify(['#ff0000', '#00ff00']),
      )
    })
  })
})
