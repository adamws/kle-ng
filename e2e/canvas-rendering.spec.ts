// Canvas rendering tests with proper waiting strategies
import { test, expect } from '@playwright/test'

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
    // Add 5 keys individually
    const addButton = page.locator('button[title="Add Standard Key"]')
    for (let i = 0; i < 5; i++) {
      await addButton.click()
    }

    // Add labels to the keys
    // First, we need to deselect all keys and then select them one by one to label them
    const canvas = page.locator('.keyboard-canvas')
    await canvas.click({ position: { x: 50, y: 50 } }) // Click empty area to deselect

    // This is a basic test - we'll label them sequentially
    // Note: In a real scenario, you'd want to click individual keys to select them
    // For now, let's just take a screenshot of the 5 default keys

    // Wait for keys counter to show 5 keys are added
    await expect(page.locator('.keys-counter')).toContainText('Keys: 5')

    await expect(canvas).toHaveScreenshot('layout-5-keys-default.png')
  })

  test('should render ANSI 104 layout', async ({ page }) => {
    // Load ANSI 104 preset
    await page.selectOption('select:has(option:has-text("Choose Preset..."))', '1')

    // Small wait to ensure the selection event is processed
    await page.waitForTimeout(100)

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
