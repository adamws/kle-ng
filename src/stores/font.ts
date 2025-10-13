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
        // Font loaded successfully - update font settings AFTER font is loaded
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
   * Create a hidden font loader element
   */
  const createFontLoaderElement = (
    fontFamily: string,
    text: string,
    options: { fontWeight?: string; fontStyle?: string } = {},
  ): HTMLDivElement => {
    const element = document.createElement('div')
    element.style.fontFamily = `"${fontFamily}", sans-serif`
    element.style.fontSize = '16px'
    element.style.position = 'absolute'
    element.style.left = '-9999px'
    element.style.top = '-9999px'
    element.style.visibility = 'hidden'

    if (options.fontWeight) {
      element.style.fontWeight = options.fontWeight
    }
    if (options.fontStyle) {
      element.style.fontStyle = options.fontStyle
    }

    element.textContent = text
    return element
  }

  /**
   * Clean up font loader elements
   */
  const cleanupFontLoaderElements = (elements: HTMLDivElement[]): void => {
    elements.forEach((element) => {
      if (element.parentNode === document.body) {
        document.body.removeChild(element)
      }
    })
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

        // Force the browser to load the actual font files by creating multiple hidden elements
        // that use the font in different ways. This ensures the WOFF2 files are downloaded immediately.
        const fontLoaderElements = [
          createFontLoaderElement(fontFamily, 'Font Loader Test'),
          createFontLoaderElement(fontFamily, 'Font Loader Bold', { fontWeight: 'bold' }),
          createFontLoaderElement(fontFamily, 'Font Loader Italic', { fontStyle: 'italic' }),
        ]

        // Append all elements to the DOM
        fontLoaderElements.forEach((element) => {
          document.body.appendChild(element)
        })

        // Use the Font Loading API if available for more reliable font loading detection
        if (document.fonts && document.fonts.load) {
          // Load the font using the Font Loading API
          document.fonts
            .load(`16px "${fontFamily}"`)
            .then(() => {
              // Font loaded successfully
              cleanupFontLoaderElements(fontLoaderElements)
              resolve(true)
            })
            .catch(() => {
              // Font loading failed, but the stylesheet loaded so we'll assume success
              cleanupFontLoaderElements(fontLoaderElements)
              resolve(true)
            })
        } else {
          // Fallback for browsers without Font Loading API
          // Wait longer to ensure font files are downloaded
          setTimeout(() => {
            // Clean up the font loader elements
            cleanupFontLoaderElements(fontLoaderElements)

            // Try to verify font loading using document.fonts.check if available
            if (document.fonts && document.fonts.check) {
              try {
                const fontLoaded = document.fonts.check(`16px "${fontFamily}"`)
                resolve(fontLoaded)
              } catch {
                // If check fails, assume font loaded since the stylesheet loaded
                resolve(true)
              }
            } else {
              // No way to verify, assume success
              resolve(true)
            }
          }, 1000) // Wait 1 second for font files to download
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
