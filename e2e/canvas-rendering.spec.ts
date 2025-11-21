// Canvas rendering tests with proper waiting strategies
import { test, expect } from '@playwright/test'
import { KeyboardEditorPage } from './pages/KeyboardEditorPage'

test.describe('Canvas Rendering - Layout Tests', () => {
  // Canvas rendering tests only run on Chromium since we've verified
  // pixel-perfect identical rendering across all browsers

  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Canvas rendering tests only run on Chromium (verified identical across browsers)',
  )

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Clear any existing layout
    await page.evaluate(() => {
      // Access the keyboard store and clear it
      const store = (
        window as {
          __VUE_DEVTOOLS_GLOBAL_HOOK__?: { apps?: { store?: { clearKeys?: () => void } }[] }
        }
      ).__VUE_DEVTOOLS_GLOBAL_HOOK__?.apps?.[0]?.store
      if (store) {
        store.clearKeys()
      }
    })
  })

  test('should render basic 5-key layout', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)

    // Add 5 keys using the toolbar
    for (let i = 0; i < 5; i++) {
      await editor.toolbar.addKey()
    }

    // Verify 5 keys were added
    await editor.expectKeyCount(5)

    // Click empty area to deselect all keys
    await editor.canvas.clickAt(50, 50)

    // Take screenshot of the canvas
    await editor.canvas.expectScreenshot('layout-5-keys-default')
  })

  test('should render ANSI 104 layout', async ({ page }) => {
    // Open the presets dropdown
    const presetButton = page.locator('.preset-dropdown button.preset-select')
    await presetButton.click()

    // Wait for dropdown items to be in DOM
    await page.waitForSelector('.preset-dropdown .dropdown-item', {
      state: 'attached',
      timeout: 5000,
    })

    // Click the ANSI 104 preset item (exact match to avoid "ANSI 104 (big-ass enter)")
    const ansiItem = page.locator('.preset-dropdown .dropdown-item', { hasText: /^ANSI 104$/ })
    await ansiItem.click()

    // Wait for layout to load with increased timeout for CI environments
    await page.waitForFunction(
      () => {
        const statusText = document.querySelector('.keys-counter')?.textContent
        if (!statusText) return false
        const match = statusText.match(/Keys: (\d+)/)
        return match && parseInt(match[1]) >= 100 // ANSI 104 should have 104 keys
      },
      { timeout: 60000 },
    )

    // Ensure canvas is ready with loaded content
    await expect(page.locator('.keyboard-canvas')).toBeVisible()

    const canvas = page.locator('.keyboard-canvas')
    await expect(canvas).toHaveScreenshot('layout-ansi-104.png')
  })
})
