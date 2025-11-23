import { test, expect } from '@playwright/test'
import { WaitHelpers } from './helpers/wait-helpers'

test.describe('Negative Coordinates Support', () => {
  let waitHelpers: WaitHelpers

  // Canvas rendering tests only run on Chromium since we've verified
  // pixel-perfect identical rendering across all browsers

  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Canvas rendering tests only run on Chromium (verified identical across browsers)',
  )

  test.beforeEach(async ({ page }) => {
    waitHelpers = new WaitHelpers(page)
    await page.goto('/')

    // Wait for app to load
    await expect(page.locator('.canvas-toolbar')).toBeVisible()
  })

  test('should allow moving keys to negative coordinates via mirror', async ({ page }) => {
    // Fixed: Use force clicks to bypass container pointer event interception
    // Add a key
    await page.getByTestId('toolbar-add-key').click()
    // Wait for key counter to update to ensure key is added
    await expect(page.getByTestId('counter-keys')).toContainText('Keys: 1')

    // Set key label for identification
    const centerLabelInput = page.locator('.labels-grid .form-control').nth(4)
    await centerLabelInput.fill('NEG')
    await centerLabelInput.press('Enter')

    // Click on the key to select it
    await page.getByTestId('canvas-main').click({ position: { x: 47, y: 47 }, force: true })
    // Verify key is selected
    await expect(page.getByTestId('counter-selected')).toContainText('Selected: 1')

    // Switch to vertical mirror mode
    await page.getByTestId('toolbar-mirror-vertical').click()
    // Wait for button to become active
    await expect(page.getByTestId('toolbar-mirror-vertical')).toHaveClass(/active/)

    // Verify key is still selected after switching to mirror mode
    await expect(page.getByTestId('counter-selected')).toContainText('Selected: 1')

    // Wait for canvas to adjust size for mirror mode
    await waitHelpers.waitForDoubleAnimationFrame()

    // Click on canvas at negative coordinate position (left of the key)
    await page.getByTestId('canvas-main').click({ position: { x: 10, y: 47 }, force: true })
    // Wait for mirror operation to complete - should add mirrored key
    await expect(page.getByTestId('counter-keys')).toContainText('Keys: 2')

    // Take screenshot to verify negative coordinate functionality
    await expect(page.getByTestId('canvas-main')).toHaveScreenshot(
      'negative-coordinates-mirror.png',
    )

    // Verify that the canvas shows the mirrored key (may need adjustment based on actual canvas size)
    const canvas = page.getByTestId('canvas-main')
    const canvasBox = await canvas.boundingBox()
    // Canvas should be visible and have some reasonable size - adjust expectation based on actual behavior
    expect(canvasBox?.width).toBeGreaterThan(80) // Canvas width should accommodate negative coordinates
  })

  test('should display correct mouse coordinates for negative positions', async ({ page }) => {
    // Add a key and move it to create negative space
    await page.getByTestId('toolbar-add-key').click()
    // Wait for key to be added
    await expect(page.getByTestId('counter-keys')).toContainText('Keys: 1')

    // Mirror key to create negative coordinate key
    await page.getByTestId('canvas-main').click({ position: { x: 47, y: 47 } })
    // Verify key is selected
    await expect(page.getByTestId('counter-selected')).toContainText('Selected: 1')

    await page.getByTestId('toolbar-mirror-vertical').click()
    // Wait for button to become active
    await expect(page.getByTestId('toolbar-mirror-vertical')).toHaveClass(/active/)

    // Verify key is still selected after switching to mirror mode
    await expect(page.getByTestId('counter-selected')).toContainText('Selected: 1')

    // Wait for canvas to adjust size for mirror mode
    await waitHelpers.waitForDoubleAnimationFrame()

    await page.getByTestId('canvas-main').click({ position: { x: 10, y: 47 }, force: true })
    // Wait for mirror operation to complete
    await expect(page.getByTestId('counter-keys')).toContainText('Keys: 2')

    // Move mouse to negative coordinate area and check position display
    await page.getByTestId('canvas-main').hover({ position: { x: 5, y: 47 } })
    // Position display should be visible
    await expect(page.locator('.position-values')).toBeVisible()

    // The mouse position should show negative coordinates
    const mousePosition = page.locator('.position-values')
    await expect(mousePosition).toBeVisible()

    // Verify position shows negative values (position will be slightly negative)
    const positionText = await mousePosition.textContent()
    expect(positionText).toMatch(/-.*,/) // Should contain negative X coordinate
  })

  test('should allow dragging keys to negative coordinates', async ({ page }) => {
    // Add a key
    await page.getByTestId('toolbar-add-key').click()
    // Wait for key to be added
    await expect(page.getByTestId('counter-keys')).toContainText('Keys: 1')

    // Set key label
    const centerLabelInput = page.locator('.labels-grid .form-control').nth(4)
    await centerLabelInput.fill('DRAG')
    await centerLabelInput.press('Enter')

    // Drag key to negative coordinates using middle mouse button
    const canvas = page.getByTestId('canvas-main')

    // Start drag from key position (middle button drag)
    await canvas.click({ button: 'middle', position: { x: 47, y: 47 } })

    // Drag to negative coordinate position
    await page.mouse.move(10, 47)
    await page.mouse.up({ button: 'middle' })
    // Ensure canvas is ready after drag operation
    await expect(page.getByTestId('canvas-main')).toBeVisible()

    // Take screenshot to verify key moved to negative coordinates
    await expect(page.getByTestId('canvas-main')).toHaveScreenshot('negative-coordinates-drag.png')
  })
})
