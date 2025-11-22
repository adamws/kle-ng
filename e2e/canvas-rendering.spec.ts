import { test, expect } from '@playwright/test'
import { CanvasTestHelper } from './helpers/canvas-test-helpers'

test.describe('Canvas Rendering - Layout Tests', () => {
  // Canvas rendering tests only run on Chromium since we've verified
  // pixel-perfect identical rendering across all browsers
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Canvas rendering tests only run on Chromium (verified identical across browsers)',
  )

  let helper: CanvasTestHelper

  test.beforeEach(async ({ page }) => {
    helper = new CanvasTestHelper(page)
    await page.goto('/')
    await helper.clearLayout()
  })

  test('should render basic 5-key layout', async () => {
    // Add 5 keys
    await helper.addMultipleKeys(5)

    // Verify 5 keys were added
    await helper.expectKeysCount(5)

    // Deselect all keys
    await helper.deselectAllKeys()
    await helper.waitForRender()

    // Take screenshot of the canvas
    await expect(helper.getCanvas()).toHaveScreenshot('layout-5-keys-default.png')
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

    // Wait for layout to load
    await helper.expectKeysCount(104)
    await helper.waitForRender()

    // Take screenshot of the canvas
    await expect(helper.getCanvas()).toHaveScreenshot('layout-ansi-104.png')
  })
})
