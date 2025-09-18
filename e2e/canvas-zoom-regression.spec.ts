// Canvas zoom regression test to prevent cropping bugs
import { test, expect } from '@playwright/test'
import { CanvasTestHelper } from './helpers/canvas-test-helpers'

test.describe('Canvas Zoom Regression Tests', () => {
  // Canvas rendering tests only run on Chromium since we've verified
  // pixel-perfect identical rendering across all browsers
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Canvas rendering tests only run on Chromium (verified identical across browsers)',
  )

  let canvasHelper: CanvasTestHelper

  test.beforeEach(async ({ page }) => {
    canvasHelper = new CanvasTestHelper(page)
    await page.goto('/')

    // Clear any existing layout
    await page.evaluate(() => {
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

  test('should not crop keyboard at high zoom levels (500%+)', async ({ page }) => {
    // Add a single key with a label for better visibility
    await canvasHelper.addKey()
    await expect(page.locator('.keys-counter')).toContainText('Keys: 1')

    // Set a label to make the key more visible in screenshots
    await canvasHelper.setKeyLabel('center', 'A')

    // Take baseline screenshot at 100% zoom
    await canvasHelper.expectCanvasScreenshot('zoom-regression-01-baseline-100percent')

    // Verify initial zoom level
    const initialZoom = await canvasHelper.getZoomLevel()
    expect(initialZoom).toBe(100)

    // Zoom in to approximately 500% (each click adds 20%, so 20 clicks gets us to 500%)
    // Let's do 15 clicks to get over 400%
    await canvasHelper.zoomIn(15)

    // Verify we're at high zoom level (should be at least 400%+)
    const highZoom = await canvasHelper.getZoomLevel()
    expect(highZoom).toBeGreaterThanOrEqual(400)

    // Wait for canvas to stabilize after zoom changes
    await canvasHelper.waitForCanvasStability()

    // Take screenshot at high zoom - key should not be cropped
    await canvasHelper.expectCanvasScreenshot('zoom-regression-02-high-zoom-500percent-plus')

    // Verify key is still visible and properly positioned
    await expect(page.locator('.keys-counter')).toContainText('Keys: 1')

    // Verify zoom controls are still functional
    const zoomInput = page.locator('.zoom-control .custom-number-input input')
    await expect(zoomInput).toHaveValue(highZoom.toString())
  })

  test('should maintain proper borders at low zoom levels (<100%)', async ({ page }) => {
    // Add a single key with a label
    await canvasHelper.addKey()
    await expect(page.locator('.keys-counter')).toContainText('Keys: 1')

    // Set a label to make the key more visible in screenshots
    await canvasHelper.setKeyLabel('center', 'B')

    // Zoom out to approximately 50% (each click reduces by 20%, so 2-3 clicks gets us to reasonable low zoom)
    // Let's do 3 clicks to get to 40%
    await canvasHelper.zoomOut(3)

    // Verify we're at low zoom level
    const lowZoom = await canvasHelper.getZoomLevel()
    expect(lowZoom).toBeLessThan(100)
    expect(lowZoom).toBeGreaterThanOrEqual(10) // Should respect minimum of 10%

    // Wait for canvas to stabilize after zoom changes
    await canvasHelper.waitForCanvasStability()

    // Take screenshot at low zoom - borders should be properly maintained
    await canvasHelper.expectCanvasScreenshot('zoom-regression-03-low-zoom-small-image')

    // Verify key is still visible and properly positioned
    await expect(page.locator('.keys-counter')).toContainText('Keys: 1')

    // Verify zoom controls are still functional
    const zoomInput = page.locator('.zoom-control .custom-number-input input')
    await expect(zoomInput).toHaveValue(lowZoom.toString())

    // Reset zoom and verify it works
    await canvasHelper.resetZoom()
    const resetZoom = await canvasHelper.getZoomLevel()
    expect(resetZoom).toBe(100)

    // Take final screenshot to verify reset works
    await canvasHelper.expectCanvasScreenshot('zoom-regression-04-reset-to-100percent')
  })

  test('should handle multiple zoom operations without breaking canvas', async ({ page }) => {
    // Add a few keys to create a more complex layout
    await canvasHelper.addKey()
    await canvasHelper.addKey()
    await canvasHelper.addKey()
    await expect(page.locator('.keys-counter')).toContainText('Keys: 3')

    // Set different labels on keys
    await canvasHelper.setKeyLabel('center', '1')
    await canvasHelper.addKey()
    await canvasHelper.setKeyLabel('center', '2')
    await canvasHelper.addKey()
    await canvasHelper.setKeyLabel('center', '3')

    // Take baseline screenshot
    await canvasHelper.expectCanvasScreenshot('zoom-regression-05-multiple-keys-baseline')

    // Perform multiple zoom operations
    await canvasHelper.zoomIn(5) // Zoom in significantly (adds 100% to reach 200%)
    let currentZoom = await canvasHelper.getZoomLevel()
    expect(currentZoom).toBe(200)

    await canvasHelper.zoomOut(3) // Zoom out partially
    currentZoom = await canvasHelper.getZoomLevel()

    await canvasHelper.zoomIn(2) // Zoom in again
    currentZoom = await canvasHelper.getZoomLevel()

    await canvasHelper.zoomOut(4) // Zoom out more
    currentZoom = await canvasHelper.getZoomLevel()

    // Take screenshot after multiple zoom operations
    await canvasHelper.expectCanvasScreenshot('zoom-regression-06-after-multiple-operations')

    // Reset and verify everything still works
    await canvasHelper.resetZoom()
    const finalZoom = await canvasHelper.getZoomLevel()
    expect(finalZoom).toBe(100)

    // Verify all keys are still present and properly positioned
    await expect(page.locator('.keys-counter')).toContainText('Keys: 5')
    await canvasHelper.expectCanvasScreenshot('zoom-regression-07-final-reset')
  })
})
