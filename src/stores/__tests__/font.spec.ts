import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFontStore } from '../font'

describe('font store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('parseCssMetadata', () => {
    it('should extract Google Fonts URL from @import statement', () => {
      const fontStore = useFontStore()
      const css = '@import url(https://fonts.googleapis.com/css2?family=Roboto);'
      const result = fontStore.parseCssMetadata(css)
      expect(result).toBe('https://fonts.googleapis.com/css2?family=Roboto')
    })

    it('should extract Google Fonts URL with quotes', () => {
      const fontStore = useFontStore()
      const css = '@import url("https://fonts.googleapis.com/css2?family=Open+Sans");'
      const result = fontStore.parseCssMetadata(css)
      expect(result).toBe('https://fonts.googleapis.com/css2?family=Open+Sans')
    })

    it('should return null for empty CSS', () => {
      const fontStore = useFontStore()
      const result = fontStore.parseCssMetadata('')
      expect(result).toBeNull()
    })

    it('should return null for CSS without @import', () => {
      const fontStore = useFontStore()
      const css = '.some-class { color: red; }'
      const result = fontStore.parseCssMetadata(css)
      expect(result).toBeNull()
    })
  })

  describe('applyFromCssMetadata', () => {
    it('should reset to default font when no CSS metadata', async () => {
      const fontStore = useFontStore()
      await fontStore.applyFromCssMetadata('')
      expect(fontStore.fontSettings.fontFamily).toBe(
        '"Helvetica Neue", Helvetica, Arial, sans-serif',
      )
    })

    it('should handle invalid font URL gracefully', async () => {
      const fontStore = useFontStore()
      const css = '@import url(https://invalid-font-url.com);'

      // Mock document.fonts to simulate font loading failure
      const originalCheck = document.fonts?.check
      if (document.fonts) {
        document.fonts.check = vi.fn().mockReturnValue(false)
      }

      await fontStore.applyFromCssMetadata(css)

      // Should reset to default font on failure
      expect(fontStore.fontSettings.fontFamily).toBe(
        '"Helvetica Neue", Helvetica, Arial, sans-serif',
      )

      // Restore original document.fonts.check
      if (document.fonts && originalCheck) {
        document.fonts.check = originalCheck
      }
    })

    it('should handle CSS with font family name extraction failure', async () => {
      const fontStore = useFontStore()
      const css = '@import url(https://fonts.googleapis.com/css2?invalid=param);'

      await fontStore.applyFromCssMetadata(css)

      // Should reset to default font when font name can't be extracted
      expect(fontStore.fontSettings.fontFamily).toBe(
        '"Helvetica Neue", Helvetica, Arial, sans-serif',
      )
    })
  })

  describe('resetToDefault', () => {
    it('should reset font settings to default', () => {
      const fontStore = useFontStore()

      // Set some custom font first
      fontStore.fontSettings = {
        fontFamily: '"Custom Font"',
        googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Custom+Font',
      }

      // Reset to default
      fontStore.resetToDefault()

      expect(fontStore.fontSettings.fontFamily).toBe(
        '"Helvetica Neue", Helvetica, Arial, sans-serif',
      )
      expect(fontStore.fontSettings.googleFontsUrl).toBeUndefined()
    })
  })

  describe('canvasFontFamily computed property', () => {
    it('should return current font family for canvas', () => {
      const fontStore = useFontStore()

      // Test with default font
      expect(fontStore.canvasFontFamily).toBe('"Helvetica Neue", Helvetica, Arial, sans-serif')

      // Test with custom font
      fontStore.fontSettings = {
        fontFamily: '"Roboto"',
        googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Roboto',
      }

      expect(fontStore.canvasFontFamily).toBe('"Roboto"')
    })
  })
})
