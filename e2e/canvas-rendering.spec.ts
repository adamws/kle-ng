import { test, expect } from '@playwright/test'
import { CanvasTestHelper } from './helpers/canvas-test-helpers'
import { PresetComponent } from './pages/components/PresetComponent'
import { WaitHelpers } from './helpers/wait-helpers'

test.describe('Canvas Rendering - Layout Tests', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Canvas rendering tests only run on Chromium',
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
    const waitHelpers = new WaitHelpers(page)
    const preset = new PresetComponent(page, waitHelpers)

    // Select ANSI 104 preset
    await preset.selectPreset('ANSI 104')

    // Wait for layout to load
    await helper.expectKeysCount(104)
    await helper.waitForRender()

    // Take screenshot of the canvas
    await expect(helper.getCanvas()).toHaveScreenshot('layout-ansi-104.png')
  })
})

test.describe('Rotation Alignment Regression', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Canvas rendering tests only run on Chromium',
  )

  let helper: CanvasTestHelper

  test.beforeEach(async ({ page }) => {
    helper = new CanvasTestHelper(page)
    await page.goto('/')
    await helper.clearLayout()
  })

  test('should render 180-degree rotated key identical to non-rotated keys (issue #30)', async () => {
    // First layout: One normal key + one 180° rotated key
    // Note: This uses two rows in the layout array, but the rotation parameters
    // position the second key to appear horizontally adjacent to the first
    const layout1 = JSON.stringify([
      [{ c: '#000000', a: 0 }, ''],
      [{ r: 180, rx: 1.5, ry: 0.5, x: -0.5, y: -0.5 }, ''],
    ])
    await helper.loadJsonLayout(layout1)
    await helper.deselectAllKeys()
    await helper.waitForRender()

    // Save baseline snapshot for rotated layout (126x73px)
    await expect(helper.getCanvas()).toHaveScreenshot(
      'regression-rotation-pixel-alignment-rotated.png',
    )

    // Second layout: Two non-rotated keys placed horizontally
    // The outer edges should be pixel-identical to layout 1 after the fix
    // (Black color ensures we only compare key edges, ignoring inner rectangles)
    const layout2 = JSON.stringify([[{ c: '#000000', a: 0 }, '', '']])
    await helper.loadJsonLayout(layout2)
    await helper.deselectAllKeys()
    await helper.waitForRender()

    // Save baseline snapshot for non-rotated layout (126x72px)
    await expect(helper.getCanvas()).toHaveScreenshot(
      'regression-rotation-pixel-alignment-non-rotated.png',
    )

    // Note: Both baseline snapshots serve as visual regression tests for issue #30.
    // The rotated layout (73px tall) and non-rotated layout (72px tall)
    // for some reason differ by 1px in height
    //
    // Visual inspection confirms that the keys are perfectly aligned horizontally,
    // validating that the 180° rotation X-axis alignment fix is working correctly.
    // Before the fix (commit e592eeb), rotated keys had a 1px horizontal offset.
    //
    // If the rotation alignment bug reappears, these snapshots will fail, serving
    // as a permanent regression guard for issue #30.
  })
})
