import { test, expect } from '@playwright/test'
import { CanvasTestHelper } from './helpers/canvas-test-helpers'

test.describe('Canvas Resize Bug - Different rendering between UI and keyboard shortcuts', () => {
  // This test reproduces a bug where keys resized using keyboard shortcuts
  // render differently than keys resized using the Key Properties panel,
  // even when they have the same final dimensions.

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

  test('should render identical keys when resized via properties panel vs keyboard shortcuts', async ({
    page,
  }) => {
    const helper = new CanvasTestHelper(page)

    // Add a single key to canvas
    await helper.addKey()

    // Wait for key to be added and canvas to render
    await helper.waitForRender()
    await expect(helper.getKeysCounter()).toContainText('Keys: 1')

    // Verify the key is selected (newly added keys should be selected by default)
    await expect(page.locator('.selected-counter')).toContainText('Selected: 1')

    // STEP 1: Resize key to width 1.25 using Key Properties panel
    await helper.setKeySize(1.25)
    await helper.waitForRender()

    // Take screenshot of key resized via properties panel
    await helper.expectCanvasScreenshot('key-1.25-via-properties-panel')

    // STEP 2: Reset key back to 1x1
    await helper.setKeySize(1.0)
    await helper.waitForRender()

    // Verify key is back to 1x1
    await helper.expectCanvasScreenshot('key-1x1-reset')

    // STEP 3: Resize same key to width 1.25 using keyboard shortcuts
    // Make sure canvas has focus for keyboard events
    const canvas = helper.getCanvas()
    await canvas.focus()

    // Use Shift + ArrowRight to increase width by moveStep (0.25)
    // Since moveStep is 0.25 and we start at 1.0, one press should get us to 1.25
    await page.keyboard.press('Shift+ArrowRight')
    await helper.waitForRender()

    // Take screenshot of key resized via keyboard shortcut
    await helper.expectCanvasScreenshot('key-1.25-via-keyboard-shortcut')

    // The bug: These screenshots should be identical but they're not
    // This test will catch the regression once we fix the rendering issue
  })

  test('should have consistent key dimensions regardless of resize method', async ({ page }) => {
    const helper = new CanvasTestHelper(page)

    // Add a single key to canvas
    await helper.addKey()
    await helper.waitForRender()

    // Verify the key is selected (newly added keys should be selected by default)
    await expect(page.locator('.selected-counter')).toContainText('Selected: 1')

    // Test multiple resize operations to see if the issue compounds

    // Resize via properties panel: 1.0 -> 1.25 -> 1.5
    await helper.setKeySize(1.25)
    await helper.waitForRender()
    await helper.setKeySize(1.5)
    await helper.waitForRender()

    // Take screenshot
    await helper.expectCanvasScreenshot('key-1.5-via-properties-multiple')

    // Reset to 1.0
    await helper.setKeySize(1.0)
    await helper.waitForRender()

    // Resize via keyboard shortcuts: 1.0 -> 1.25 -> 1.5
    const canvas = helper.getCanvas()
    await canvas.focus()
    await page.keyboard.press('Shift+ArrowRight') // 1.0 -> 1.25
    await helper.waitForRender()
    await page.keyboard.press('Shift+ArrowRight') // 1.25 -> 1.5
    await helper.waitForRender()

    // Take screenshot
    await helper.expectCanvasScreenshot('key-1.5-via-keyboard-multiple')

    // These should also be identical
  })
})
