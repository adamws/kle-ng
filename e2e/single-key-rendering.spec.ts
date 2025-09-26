import { test, expect } from '@playwright/test'
import { CanvasTestHelper } from './helpers/canvas-test-helpers'

test.describe('Single Key Rendering Tests', () => {
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

    // Ensure we start with a clean slate
    await helper.clearLayout()
  })

  test.describe('Basic Key Shapes and Sizes', () => {
    test('standard 1x1 key', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'A')
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('basic/1x1-key-A.png')
    })

    test('1.25u key (Tab)', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'Tab')
      await helper.setKeySize(1.25)
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('basic/1-25u-key-tab.png')
    })

    test('1.5u key (Backslash)', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', '\\')
      await helper.setKeySize(1.5)
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('basic/1-5u-key-backslash.png')
    })

    test('2u key (Backspace)', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'Backspace')
      await helper.setKeySize(2)
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('basic/2u-key-backspace.png')
    })

    test('2.25u key (Left Shift)', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'Shift')
      await helper.setKeySize(2.25)
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('basic/2-25u-key-shift.png')
    })

    test('6.25u spacebar', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'Space')
      await helper.setKeySize(6.25)
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('basic/6-25u-spacebar.png')
    })

    test('2u tall key (Enter)', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'Enter')
      await helper.setKeySize(1.25, 2)
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('basic/2u-tall-enter.png')
    })

    test('square 2x2 key', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', '+')
      await helper.setKeySize(2, 2)
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('basic/2x2-square-key.png')
    })
  })

  test.describe('Key Colors and Styling', () => {
    test('blue key with white text', async () => {
      // Fixed: Color input selectors are working correctly
      await helper.addKey()
      await helper.setKeyLabel('center', 'Ctrl')
      await helper.setKeyColors('#0066cc', '#ffffff')
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('colors/blue-key-white-text.png')
    })

    test('red key with yellow text', async () => {
      // Fixed: Color input selectors are working correctly
      await helper.addKey()
      await helper.setKeyLabel('center', 'Esc')
      await helper.setKeyColors('#cc0000', '#ffff00')
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('colors/red-key-yellow-text.png')
    })

    test('dark theme key', async () => {
      // Fixed: Color input selectors are working correctly
      await helper.addKey()
      await helper.setKeyLabel('center', 'Alt')
      await helper.setKeyColors('#333333', '#cccccc')
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('colors/dark-theme-key.png')
    })
  })

  test.describe('Key Options', () => {
    test('ghost key', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'Ghost')
      await helper.setKeyOptions({ ghost: true })
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('options/ghost-key.png')
    })

    test('stepped key', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'Caps')
      await helper.setKeySize(1.75)
      await helper.setKeyOptions({ stepped: true })
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('options/stepped-caps.png')
    })

    test('home key with nub', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'F')
      await helper.setKeyOptions({ nub: true })
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('options/home-key-nub.png')
    })

    test('decal key', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'Logo')
      await helper.setKeyOptions({ decal: true })
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('options/decal-key.png')
    })
  })

  test.describe('Key Rotations', () => {
    test('15 degree rotation', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'R15')
      await helper.setKeyRotation(15)
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('rotations/15-degree-rotation.png')
    })

    test('45 degree rotation', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'R45')
      await helper.setKeyRotation(45)
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('rotations/45-degree-rotation.png')
    })

    test('90 degree rotation', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'R90')
      await helper.setKeyRotation(90)
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('rotations/90-degree-rotation.png')
    })

    test('-45 degree rotation', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'R-45')
      await helper.setKeyRotation(-45)
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('rotations/minus-45-degree-rotation.png')
    })
  })

  test.describe('Complex Labels', () => {
    test('key with all 9 labels', async () => {
      await helper.addKey()

      // Set all label positions
      await helper.setKeyLabel('topLeft', '!')
      await helper.setKeyLabel('topCenter', '@')
      await helper.setKeyLabel('topRight', '#')
      await helper.setKeyLabel('centerLeft', '$')
      await helper.setKeyLabel('center', '5')
      await helper.setKeyLabel('centerRight', '%')
      await helper.setKeyLabel('bottomLeft', '^')
      await helper.setKeyLabel('bottomCenter', '&')
      await helper.setKeyLabel('bottomRight', '*')

      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('labels/all-9-labels.png')
    })

    test('function key with dual labels', async () => {
      await helper.addKey()
      await helper.setKeyLabel('topCenter', 'F1')
      await helper.setKeyLabel('center', '!')
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('labels/f1-dual-label.png')
    })

    test('modifier key', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'Ctrl')
      await helper.setKeySize(1.25)
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('labels/ctrl-modifier.png')
    })

    test('key with per-label text sizes and colors', async () => {
      await helper.addKey()

      // Set labels for multiple positions including front labels
      await helper.setKeyLabel('topLeft', '!')
      await helper.setKeyLabel('topCenter', '@')
      await helper.setKeyLabel('centerLeft', '$')
      await helper.setKeyLabel('center', '5')
      await helper.setKeyLabel('centerRight', '%')
      await helper.setKeyLabel('bottomLeft', 'A')
      await helper.setKeyLabel('bottomRight', 'B')

      // Add front labels to test that they maintain original positioning
      // Front labels are at indices 9, 10, 11 in the main .labels-grid
      const frontLabelInputs = helper.page.locator('.labels-grid .form-control')
      const frontInputsCount = await frontLabelInputs.count()

      // Add front labels if available (indices 9, 10, 11)
      if (frontInputsCount >= 12) {
        await frontLabelInputs.nth(9).fill('F1') // Front left (index 9)
        await frontLabelInputs.nth(10).fill('F2') // Front center (index 10)
        await frontLabelInputs.nth(11).fill('F3') // Front right (index 11)
      }

      // Set different text sizes for each position (non-default)
      await helper.setDefaultTextSize(3) // Set default to 3 first
      await helper.setLabelTextSize('topLeft', 2)
      await helper.setLabelTextSize('topCenter', 5) // Large
      await helper.setLabelTextSize('centerLeft', 4) // Larger than default
      await helper.setLabelTextSize('center', 6) // Large
      await helper.setLabelTextSize('centerRight', 8) // Larger
      await helper.setLabelTextSize('bottomLeft', 3) // Default size for contrast
      await helper.setLabelTextSize('bottomRight', 9) // Maximum size

      // Set different colors for some labels (including front labels)
      await helper.setLabelColor('topLeft', '#ff0000') // Red
      await helper.setLabelColor('topCenter', '#00ff00') // Green
      await helper.setLabelColor('center', '#0000ff') // Blue
      await helper.setLabelColor('centerRight', '#ff8800') // Orange
      await helper.setLabelColor('bottomRight', '#8800ff') // Purple

      // Set colors for front labels to verify they work correctly
      const frontColorPickers = helper.page.locator('.labels-grid .label-color-picker')
      const frontColorPickersCount = await frontColorPickers.count()

      if (frontColorPickersCount >= 12) {
        // Set color for front left label (index 9)
        await frontColorPickers.nth(9).click()
        await helper.page.locator('.color-picker-popup').waitFor({ state: 'visible' })
        await helper.page.locator('.color-picker-popup input[placeholder="000000"]').first().fill('00ffff')
        await helper.page.locator('.color-picker-popup .btn-primary').click()
        await helper.page.locator('.color-picker-popup').waitFor({ state: 'hidden' })

        // Set color for front center label (index 10)
        await frontColorPickers.nth(10).click()
        await helper.page.locator('.color-picker-popup').waitFor({ state: 'visible' })
        await helper.page.locator('.color-picker-popup input[placeholder="000000"]').first().fill('ff00ff')
        await helper.page.locator('.color-picker-popup .btn-primary').click()
        await helper.page.locator('.color-picker-popup').waitFor({ state: 'hidden' })
      }

      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('labels/per-label-text-sizes-colors.png')
    })
  })
})
