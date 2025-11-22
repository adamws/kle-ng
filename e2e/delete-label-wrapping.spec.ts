import { test, expect } from '@playwright/test'
import { WaitHelpers } from './helpers/wait-helpers'

test.describe('Delete Label Text Wrapping', () => {
  let waitHelpers: WaitHelpers

  // Canvas rendering tests only run on Chromium since we've verified
  // pixel-perfect identical rendering across all browsers
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Canvas rendering tests only run on Chromium (verified identical across browsers)',
  )

  test.beforeEach(async ({ page }) => {
    waitHelpers = new WaitHelpers(page)
  })

  test('should render Delete label on 1x1 key without wrapping', async ({ page }) => {
    await page.goto('/')

    // Wait for the keyboard canvas to be rendered (first canvas element)
    const canvas = page.locator('canvas.keyboard-canvas')
    await expect(canvas).toBeVisible()

    // Clear the keyboard first
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Delete')

    // Add a key with "Delete" label
    await page.keyboard.press('a')

    // Set the label to "Delete" in the top-left position (index 0)
    const labelInput = page.locator('.labels-grid .form-control').first()
    await labelInput.fill('Delete')

    // Wait for the canvas to update after label change
    await waitHelpers.waitForDoubleAnimationFrame()

    // Take screenshot to verify Delete label renders properly
    await expect(canvas).toHaveScreenshot('delete-label-1x1-key.png')
  })
})
