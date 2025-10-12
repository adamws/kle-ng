import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { toast } from '@/composables/useToast'

/**
 * Font Store
 *
 * Handles font loading from CSS metadata.
 *
 * Supported CSS:
 * - @import url(...) statements for loading fonts from external sources (e.g., Google Fonts)
 *
 * The font name is automatically extracted from the URL and applied to canvas rendering only.
 * It does not affect the UI font.
 *
 * Example CSS metadata:
 * ```
 * @import url(https://fonts.googleapis.com/css2?family=Noto+Sans+JP);
 * ```
 */

export interface FontSettings {
  // Font family for key labels
  fontFamily: string
  // Google Fonts URL (if loaded from CSS @import)
  googleFontsUrl?: string
}

// Default font (matches current hardcoded font)
const DEFAULT_FONT: FontSettings = {
  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
}

export const useFontStore = defineStore('font', () => {
  const fontSettings = ref<FontSettings>({ ...DEFAULT_FONT })

  // Computed property for the actual font family string to use in canvas
  const canvasFontFamily = computed(() => {
    return fontSettings.value.fontFamily
  })

  /**
   * Parse CSS metadata and extract Google Fonts URL
   *
   * Supported patterns:
   * - @import url(...)  - Loads external font stylesheet
   *
   * @param cssString - CSS metadata string from keyboard layout
   * @returns Google Fonts URL or null if no @import found
   */
  const parseCssMetadata = (cssString: string): string | null => {
    if (!cssString) return null

    // Extract @import url(...) statements
    // Matches: @import url(http://...) or @import url("http://...") or @import url('http://...')
    const importMatch = cssString.match(/@import\s+url\(([^)]+)\)/)
    if (importMatch) {
      let url = importMatch[1].trim()
      // Remove quotes if present
      url = url.replace(/^["']|["']$/g, '')
      return url
    }

    return null
  }

  /**
   * Apply font settings from CSS metadata
   *
   * This is the main entry point for applying fonts from keyboard layouts.
   * Only @import url(...) statements are processed - all other CSS is ignored.
   * The font name is automatically extracted from the URL.
   *
   * @param cssString - CSS metadata string from keyboard layout
   * @param showNotification - Whether to show a toast notification (default: false)
   */
  const applyFromCssMetadata = async (cssString: string, showNotification = false) => {
    const googleFontsUrl = parseCssMetadata(cssString)
    if (!googleFontsUrl) {
      // No font data in CSS, reset to default
      fontSettings.value = { ...DEFAULT_FONT }
      return
    }

    // Extract font family name from URL
    // Example: https://fonts.googleapis.com/css2?family=Noto+Sans+JP
    const fontNameMatch = googleFontsUrl.match(/family=([^&:]+)/)
    if (fontNameMatch) {
      const fontFamily = fontNameMatch[1].replace(/\+/g, ' ')

      // Try to load the font from URL
      const loadSuccess = await loadFontFromUrl(googleFontsUrl, fontFamily)

      if (loadSuccess) {
        // Font loaded successfully
        fontSettings.value = {
          fontFamily: `"${fontFamily}"`,
          googleFontsUrl: googleFontsUrl,
        }

        // Show success toast notification if requested
        if (showNotification) {
          toast.showInfo(`Font loaded: ${googleFontsUrl}`)
        }
      } else {
        // Font failed to load, reset to default
        fontSettings.value = { ...DEFAULT_FONT }

        // Show error toast if requested
        if (showNotification) {
          toast.showError(
            `Failed to load font from URL. Please check the font URL and try again. Reverting to default font.`,
            'Font Loading Failed',
          )
        }
      }
    } else {
      // Could not extract font name from URL
      fontSettings.value = { ...DEFAULT_FONT }

      if (showNotification) {
        toast.showError(
          'Could not extract font name from URL. Make sure you are using a valid Google Fonts URL.',
          'Invalid Font URL',
        )
      }
    }
  }

  /**
   * Load font stylesheet from URL
   *
   * @param url - Font stylesheet URL (e.g., Google Fonts URL)
   * @param fontFamily - Font family name to check if loaded
   * @returns Promise that resolves to true if font loaded successfully, false otherwise
   */
  const loadFontFromUrl = (url: string, fontFamily: string): Promise<boolean> => {
    return new Promise((resolve) => {
      // Check if already loaded
      const existingLink = document.querySelector(`link[href="${url}"]`)
      if (existingLink) {
        resolve(true)
        return
      }

      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = url

      // Set up load and error handlers
      const timeout = setTimeout(() => {
        link.remove()
        resolve(false)
      }, 10000) // 10 second timeout

      link.onload = () => {
        clearTimeout(timeout)

        // Try to verify the font actually loaded by checking document.fonts
        if (document.fonts && document.fonts.check) {
          // Wait a bit for font to be parsed
          setTimeout(() => {
            try {
              // Try to check if font is available
              const fontLoaded = document.fonts.check(`12px "${fontFamily}"`)
              resolve(fontLoaded)
            } catch {
              // If check fails, assume font loaded since the stylesheet loaded
              resolve(true)
            }
          }, 100)
        } else {
          // Browser doesn't support document.fonts API, assume success
          resolve(true)
        }
      }

      link.onerror = () => {
        clearTimeout(timeout)
        link.remove()
        resolve(false)
      }

      document.head.appendChild(link)
    })
  }

  // Reset to default font
  const resetToDefault = () => {
    fontSettings.value = { ...DEFAULT_FONT }
  }

  return {
    fontSettings,
    canvasFontFamily,
    parseCssMetadata,
    applyFromCssMetadata,
    resetToDefault,
  }
})
