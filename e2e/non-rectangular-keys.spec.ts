import { test, expect } from '@playwright/test'

test.describe('Non-Rectangular Keys Rendering', () => {
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

  test('should render big-ass-enter key correctly', async ({ page }) => {
    // Load the big-ass-enter JSON data directly
    const bigAssEnterLayout = JSON.stringify([
      [{ x: 0.75, a: 0, w: 1.5, h: 2, w2: 2.25, h2: 1, x2: -0.75, y2: 1 }, 'Enter'],
    ])

    // Navigate to JSON editor panel
    const jsonTextarea = page.locator('textarea.form-control.font-monospace')
    await jsonTextarea.clear()
    await jsonTextarea.fill(bigAssEnterLayout)

    // Apply changes
    await page.click('button:has-text("Apply Changes")')

    // Wait for rendering to complete
    await expect(page.locator('.keys-counter')).toContainText('Keys: 1')

    // Take screenshot of the canvas area
    const canvas = page.locator('.keyboard-canvas')
    await expect(canvas).toHaveScreenshot('big-ass-enter-key.png')
  })

  test('should render ISO enter key correctly', async ({ page }) => {
    // Load ISO enter layout
    const isoEnterLayout = JSON.stringify([
      [{ x: 0.25, w: 1.25, h: 2, w2: 1.5, h2: 1, x2: -0.25 }, 'ISO Enter'],
    ])

    // Navigate to JSON editor panel
    const jsonTextarea = page.locator('textarea.form-control.font-monospace')
    await jsonTextarea.clear()
    await jsonTextarea.fill(isoEnterLayout)

    // Apply changes
    await page.click('button:has-text("Apply Changes")')

    // Wait for rendering to complete
    await expect(page.locator('.keys-counter')).toContainText('Keys: 1')

    // Take screenshot of the canvas area
    const canvas = page.locator('.keyboard-canvas')
    await expect(canvas).toHaveScreenshot('iso-enter-key.png')
  })

  test('should render custom J-shaped key', async ({ page }) => {
    // Create a custom J-shaped key with different dimensions
    const customJLayout = JSON.stringify([
      [{ x: 0, w: 2, h: 1, w2: 1, h2: 2, x2: 1, y2: 0.75 }, 'Custom J'],
    ])

    // Navigate to JSON editor panel
    const jsonTextarea = page.locator('textarea.form-control.font-monospace')
    await jsonTextarea.clear()
    await jsonTextarea.fill(customJLayout)

    // Apply changes
    await page.click('button:has-text("Apply Changes")')

    // Wait for rendering to complete
    await expect(page.locator('.keys-counter')).toContainText('Keys: 1')

    // Take screenshot of the canvas area
    const canvas = page.locator('.keyboard-canvas')
    await expect(canvas).toHaveScreenshot('custom-j-shaped-key.png')
  })

  test('should handle J-shaped key selection properly', async ({ page }) => {
    // Fixed: Updating baseline for new canvas dimensions
    // Load the big-ass-enter layout
    const bigAssEnterLayout = JSON.stringify([
      [{ x: 0.75, a: 0, w: 1.5, h: 2, w2: 2.25, h2: 1, x2: -0.75, y2: 1 }, 'Enter'],
    ])

    const jsonTextarea = page.locator('textarea.form-control.font-monospace')
    await jsonTextarea.clear()
    await jsonTextarea.fill(bigAssEnterLayout)
    await page.click('button:has-text("Apply Changes")')

    // Wait for layout to be applied and rendered

    await page.waitForTimeout(1000)

    // Click on the key to select it - click on the main rectangle part
    const canvas = page.locator('.keyboard-canvas')

    await canvas.click({ position: { x: 140, y: 80 }, force: true }) // Approximate position of the key

    // Wait for selection to take effect

    await page.waitForTimeout(500)

    // Check that the key is selected (should show properties panel)
    const propertiesPanel = page.locator('.key-properties-panel')
    await expect(propertiesPanel).toBeVisible()

    // Take screenshot showing selected state
    await expect(canvas).toHaveScreenshot('big-ass-enter-selected.png')
  })

  test('should render multiple J-shaped keys in same layout', async ({ page }) => {
    // Create a layout with both ISO enter and big-ass-enter
    const mixedLayout = JSON.stringify([
      [{ w: 1.5 }, 'Tab', { w: 1, h: 1 }, 'Q', 'W', 'E'],
      [{ w: 1.75 }, 'Caps', 'A', 'S', 'D'],
      [{ x: 0.25, w: 1.25, h: 2, w2: 1.5, h2: 1, x2: -0.25 }, 'ISO Enter'],
      [{ x: 2.75, w: 1.5, h: 2, w2: 2.25, h2: 1, x2: -0.75, y2: 1 }, 'Big Ass Enter'],
    ])

    const jsonTextarea = page.locator('textarea.form-control.font-monospace')
    await jsonTextarea.clear()
    await jsonTextarea.fill(mixedLayout)
    await page.click('button:has-text("Apply Changes")')

    // Wait for layout to be applied and rendered

    await page.waitForTimeout(1000)

    const canvas = page.locator('.keyboard-canvas')
    await expect(canvas).toHaveScreenshot('mixed-j-shaped-keys.png')
  })

  test('should render J-shaped keys with custom colors', async ({ page }) => {
    // Load big-ass-enter with custom colors
    const coloredLayout = JSON.stringify([
      [
        {
          x: 0.75,
          a: 0,
          w: 1.5,
          h: 2,
          w2: 2.25,
          h2: 1,
          x2: -0.75,
          y2: 1,
          c: '#ff6b35',
          t: '#ffffff',
        },
        'Enter',
      ],
    ])

    const jsonTextarea = page.locator('textarea.form-control.font-monospace')
    await jsonTextarea.clear()
    await jsonTextarea.fill(coloredLayout)
    await page.click('button:has-text("Apply Changes")')

    // Wait for rendering to complete
    await expect(page.locator('.keys-counter')).toContainText('Keys: 1')

    const canvas = page.locator('.keyboard-canvas')
    await expect(canvas).toHaveScreenshot('big-ass-enter-colored.png')
  })
})
