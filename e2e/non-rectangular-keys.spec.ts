import { test } from '@playwright/test'
import { NonRectangularKeysHelper } from './helpers/non-rectangular-keys-helpers'
import { WaitHelpers } from './helpers/wait-helpers'

test.describe('Non-Rectangular Keys Rendering', () => {
  // Canvas rendering tests only run on Chromium since we've verified
  // pixel-perfect identical rendering across all browsers

  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Canvas rendering tests only run on Chromium (verified identical across browsers)',
  )

  let helper: NonRectangularKeysHelper
  let waitHelpers: WaitHelpers

  test.beforeEach(async ({ page }) => {
    waitHelpers = new WaitHelpers(page)
    helper = new NonRectangularKeysHelper(page, waitHelpers)

    await page.goto('/')
    await helper.clearLayout()
  })

  test('should render big-ass-enter key correctly', async () => {
    await helper.loadBigAssEnterLayout()
    await helper.expectKeysCount(1)
    await helper.expectCanvasScreenshot('big-ass-enter-key.png')
  })

  test('should render ISO enter key correctly', async () => {
    await helper.loadISOEnterLayout()
    await helper.expectKeysCount(1)
    await helper.expectCanvasScreenshot('iso-enter-key.png')
  })

  test('should render custom non-rectangular key', async () => {
    await helper.loadCustomJLayout()
    await helper.expectKeysCount(1)
    await helper.expectCanvasScreenshot('custom-non-rectangular-key.png')
  })

  test('should handle non-rectangular key selection properly', async () => {
    await helper.loadBigAssEnterLayout()
    await helper.expectKeysCount(1)

    // Click on the key to select it
    await helper.selectBigAssEnterKey()

    // Check that the key is selected (should show properties panel)
    await helper.expectPropertiesPanelVisible()

    // Take screenshot showing selected state
    await helper.expectCanvasScreenshot('big-ass-enter-selected.png')
  })

  test('should render multiple non-rectangular keys in same layout', async () => {
    await helper.loadMixedNonRectangularLayout()
    await helper.expectCanvasScreenshot('mixed-non-rectangular-keys.png')
  })

  test('should render non-rectangular keys with custom colors', async () => {
    await helper.loadColoredBigAssEnterLayout()
    await helper.expectKeysCount(1)
    await helper.expectCanvasScreenshot('big-ass-enter-colored.png')
  })
})
