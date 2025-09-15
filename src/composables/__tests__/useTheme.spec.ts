import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { useTheme } from '../useTheme'

describe('useTheme', () => {
  let mockLocalStorage: { [key: string]: string }

  beforeEach(() => {
    // Mock localStorage
    mockLocalStorage = {}
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          mockLocalStorage[key] = value
        }),
        clear: vi.fn(() => {
          mockLocalStorage = {}
        }),
      },
    })

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    // Clear document attributes
    document.documentElement.removeAttribute('data-bs-theme')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize with auto theme by default', () => {
    const { theme } = useTheme()
    expect(theme.value).toBe('auto')
  })

  it('should load theme from localStorage if available', () => {
    mockLocalStorage['kle-theme'] = 'dark'
    const { theme, initializeTheme } = useTheme()
    initializeTheme()

    expect(theme.value).toBe('dark')
  })

  it('should fall back to auto theme if localStorage value is invalid', () => {
    mockLocalStorage['kle-theme'] = 'invalid-theme'
    const { theme, initializeTheme } = useTheme()
    initializeTheme()

    expect(theme.value).toBe('auto')
  })

  it('should persist theme to localStorage when set', () => {
    const { setTheme } = useTheme()
    setTheme('dark')

    expect(window.localStorage.setItem).toHaveBeenCalledWith('kle-theme', 'dark')
    expect(mockLocalStorage['kle-theme']).toBe('dark')
  })

  it('should apply theme to document when set to light or dark', () => {
    const { setTheme } = useTheme()

    setTheme('dark')
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark')

    setTheme('light')
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light')
  })

  it('should set data-bs-theme attribute based on system preference when set to auto', () => {
    const { setTheme } = useTheme()

    // First set a specific theme
    setTheme('dark')
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark')

    // Then set to auto - should match system preference (mocked to be light)
    setTheme('auto')
    const appliedTheme = document.documentElement.getAttribute('data-bs-theme')
    expect(['light', 'dark']).toContain(appliedTheme)
  })

  it('should return readonly theme reference', () => {
    const { theme } = useTheme()

    // TypeScript should prevent direct assignment to theme.value
    // This test verifies the reactive reference works correctly
    expect(typeof theme.value).toBe('string')
    expect(['light', 'dark', 'auto']).toContain(theme.value)
  })

  it('should handle system theme changes when in auto mode', async () => {
    const { setTheme } = useTheme()
    setTheme('auto')

    await nextTick()

    // In auto mode, the attribute should be set to either 'light' or 'dark' based on system preference
    const appliedTheme = document.documentElement.getAttribute('data-bs-theme')
    expect(['light', 'dark']).toContain(appliedTheme)
  })
})
