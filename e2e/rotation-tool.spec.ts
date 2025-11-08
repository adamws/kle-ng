// Selection rotation tool e2e tests with canvas baseline approach
import { test, expect } from '@playwright/test'
import { CanvasTestHelper } from './helpers/canvas-test-helpers'
import { promises as fs } from 'fs'

test.describe('Selection Rotation Tool', () => {
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

  test('should successfully rotate multiple selected keys', async ({ page }) => {
    // Add three keys
    await canvasHelper.addKey()
    await canvasHelper.addKey()
    await canvasHelper.addKey()
    await expect(page.locator('.keys-counter')).toContainText('Keys: 3')
    await canvasHelper.expectCanvasScreenshot('rotation-01-three-keys-added')

    // First rotation: Select all keys and rotate by 30 degrees
    await canvasHelper.selectAllKeys()
    await expect(page.locator('.selected-counter')).toContainText('Selected: 3')

    const rotationToolButton = page.locator('button[title="Rotate Selection"]')
    await expect(rotationToolButton).toBeEnabled()
    await rotationToolButton.click()

    const rotationModal = page.locator('.rotation-panel')
    await expect(rotationModal).toBeVisible()
    // Wait for modal to be fully interactive before proceeding
    await page.waitForTimeout(100)
    await expect(page.locator('.rotation-info')).toContainText('Select rotation anchor point')

    const canvas = canvasHelper.getCanvas()
    await canvas.click({ position: { x: 0, y: 63 }, force: true })
    await expect(page.locator('.rotation-info')).toContainText('Origin:')

    const angleInput = page.locator('.rotation-panel input[type="number"]')
    await expect(angleInput).toBeVisible()
    await expect(angleInput).toBeEnabled()
    // Wait for the input to be focused and ready (auto-focus happens on anchor selection)
    await page.waitForTimeout(100)
    await angleInput.fill('30')
    // Wait for the angle change to be processed
    await canvasHelper.waitForRender()

    const applyButton = page.locator('.rotation-panel .btn-primary')
    await expect(applyButton).toBeVisible()
    await expect(applyButton).toBeEnabled()
    await applyButton.click()
    await expect(rotationModal).toBeHidden()

    // Wait for the rotation to be applied and rendered
    await canvasHelper.waitForRender()
    // Additional wait to ensure state is fully updated
    await page.waitForTimeout(100)

    await canvasHelper.expectCanvasScreenshot('rotation-02-after-first-rotation')
    await expect(page.locator('.selected-counter')).toContainText('Selected: 3')

    // Second rotation: Select third key and rotate by another 30 degrees
    await canvasHelper.deselectAllKeys()
    await expect(page.locator('.selected-counter')).toContainText('Selected: 0')

    // Wait for deselection to complete and render
    await canvasHelper.waitForRender()

    // Select third key at position (2.5, 1.8) in key coordinates -> (135 + 9, 97.2 + 9) canvas
    await canvas.click({ position: { x: 144, y: 106.2 }, force: true })
    await expect(page.locator('.selected-counter')).toContainText('Selected: 1')

    await rotationToolButton.click()
    await expect(rotationModal).toBeVisible()
    // Wait for modal to be fully interactive before proceeding
    await page.waitForTimeout(100)
    await expect(page.locator('.rotation-info')).toContainText('Select rotation anchor point')

    // Select anchor point at (1.69, 2.0) in key coordinates -> (91.26 + 9, 108 + 9) canvas
    await canvas.click({ position: { x: 101.26, y: 117 }, force: true })
    await expect(page.locator('.rotation-info')).toContainText('Origin:')

    // Wait for the input to be focused and ready
    await expect(angleInput).toBeVisible()
    await expect(angleInput).toBeEnabled()
    await page.waitForTimeout(100)
    await angleInput.fill('30')
    // Wait for the angle change to be processed
    await canvasHelper.waitForRender()

    await expect(applyButton).toBeVisible()
    await expect(applyButton).toBeEnabled()
    await applyButton.click()
    await expect(rotationModal).toBeHidden()

    // Wait for the rotation to be applied and rendered
    await canvasHelper.waitForRender()
    // Additional wait to ensure state is fully updated
    await page.waitForTimeout(100)

    await canvasHelper.expectCanvasScreenshot('rotation-03-after-second-rotation')
    await expect(page.locator('.selected-counter')).toContainText('Selected: 1')

    // Verify JSON layout matches expected result
    await canvasHelper.selectAllKeys()
    // Wait for selection to complete
    await page.waitForTimeout(100)

    // Export JSON and verify layout
    const exportButton = page.locator('button', { hasText: 'Export' })
    await expect(exportButton).toBeVisible()
    await exportButton.click()

    // Set up download handler
    const downloadPromise = page.waitForEvent('download')
    await page.locator('a', { hasText: 'Download JSON' }).click()

    const download = await downloadPromise
    const downloadPath = `e2e/test-output/rotation-test-${Date.now()}.json`
    await download.saveAs(downloadPath)

    // Read and verify the exported JSON
    const exportedContent = await fs.readFile(downloadPath, 'utf-8')
    const layout = JSON.parse(exportedContent)

    // Expected layout structure:
    // [[{"r":30,"ry":1,"y":-1,"a":0},"",""],
    // [{"r":60,"rx":1.732051,"ry":2,"x":0,"y":-1},""]]
    expect(Array.isArray(layout)).toBe(true)
    expect(layout.length).toBe(2) // Two rows

    // First row: All keys rotated 30 degrees
    expect(layout[0][0]).toMatchObject({
      r: 30,
      ry: 1,
      y: -1,
      a: 0,
    })

    // Second row: Third key rotated additional 30 degrees (total 60)
    expect(layout[1][0].r).toBe(60)
    expect(layout[1][0].y).toBe(-1)
    expect(layout[1][0].rx).toBe(1.732051)
    expect(layout[1][0].ry).toBe(2)

    // Clean up test file
    await fs.unlink(downloadPath)
  })

  test('should handle rotation modal cancellation', async ({ page }) => {
    // Add and select keys
    await canvasHelper.addKey()
    await canvasHelper.addKey()
    await canvasHelper.selectAllKeys()

    // Open rotation tool
    const rotationToolButton = page.locator('button[title="Rotate Selection"]')
    await rotationToolButton.click()

    const rotationModal = page.locator('.rotation-panel')
    await expect(rotationModal).toBeVisible()

    // Cancel without selecting anchor
    const cancelButton = page.locator('.rotation-panel .btn-secondary')
    await cancelButton.click()

    // Modal should be gone
    await expect(rotationModal).toBeHidden()

    // Keys should still be selected
    await expect(page.locator('.selected-counter')).toContainText('Selected: 2')
    await expect(rotationToolButton).toBeEnabled()
  })

  test('should disable rotation tool when no keys selected', async ({ page }) => {
    // Add keys but don't select any
    await canvasHelper.addKey()

    // Use reliable deselect method
    await canvasHelper.deselectAllKeys()
    await expect(page.locator('.selected-counter')).toContainText('Selected: 0')

    // Rotation tool should be disabled
    const rotationToolButton = page.locator('button[title="Rotate Selection"]')
    await expect(rotationToolButton).toBeDisabled()
  })

  test('should enable rotation tool when one key selected', async ({ page }) => {
    // Add key - single key should be selected by default
    await canvasHelper.addKey()

    // Single key should be selected by default after adding
    await expect(page.locator('.selected-counter')).toContainText('Selected: 1')

    // Rotation tool should be enabled (works with any selected keys)
    const rotationToolButton = page.locator('button[title="Rotate Selection"]')
    await expect(rotationToolButton).toBeEnabled()
  })

  test('should enable rotation tool when multiple keys selected', async ({ page }) => {
    // Add keys and select multiple
    await canvasHelper.addKey()
    await canvasHelper.addKey()

    // Select both keys
    await canvasHelper.selectAllKeys()
    await expect(page.locator('.selected-counter')).toContainText('Selected: 2')

    // Rotation tool should be enabled
    const rotationToolButton = page.locator('button[title="Rotate Selection"]')
    await expect(rotationToolButton).toBeEnabled()
  })

  test('should support cancellation after anchor selection - regression test for key movement bug', async ({
    page,
  }) => {
    // REGRESSION TEST: This reproduces and tests the fix for a bug where cancelling rotation
    // after selecting an anchor point would cause already-rotated keys to move from their positions

    // BUG SCENARIO:
    // 1. Create a key and move it to explicit coordinates (x: 2, y: 1)
    // 2. Start rotation and select a new anchor point (this modifies key position internally)
    // 3. Cancel rotation - without the fix, key would stay in wrong position
    // 4. With the fix, key should return to its original position (x: 2, y: 1)

    // Step 1: Create a key and move it to explicit coordinates
    await canvasHelper.addKey()
    await expect(page.locator('.selected-counter')).toContainText('Selected: 1')

    // Move key to explicit position (x: 2, y: 1) and rotation (15)
    await page.locator('input[title="X Position"]').first().fill('2')
    await page.locator('input[title="Y Position"]').first().fill('1')
    await page.locator('input[title="Rotation Angle in Degrees"]').first().fill('15')
    await canvasHelper.waitForRender()

    // Step 2: Export current layout to capture key position before rotation attempt
    await page.locator('button', { hasText: 'Export' }).click()
    const downloadPromise = page.waitForEvent('download')
    await page.locator('a', { hasText: 'Download JSON' }).click()
    const download = await downloadPromise
    const beforePath = `e2e/test-output/rotation-before-cancel-${Date.now()}.json`
    await download.saveAs(beforePath)

    const beforeContent = await fs.readFile(beforePath, 'utf-8')
    const beforeLayout = JSON.parse(beforeContent)
    const keyBeforeCancel = beforeLayout[0][0] // First key in layout

    // Step 3: Start rotation, select anchor point, but then CANCEL
    const rotationToolButton = page.locator('button[title="Rotate Selection"]')
    await rotationToolButton.click()
    const rotationModal = page.locator('.rotation-panel')
    await expect(rotationModal).toBeVisible()
    await expect(page.locator('.rotation-info')).toContainText('Select rotation anchor point')

    // THIS IS THE CRITICAL STEP: Select a different anchor point
    // This internally calls transformRotationOrigin which modifies key positions
    const canvas = canvasHelper.getCanvas()

    // Anchor point at (1.37, 2.52) in key coordinates -> (73.98 + 9, 136.08 + 9) canvas
    await canvas.click({ position: { x: 83, y: 145 }, force: true })
    await expect(page.locator('.rotation-info')).toContainText('Origin:')

    // Now cancel - this should restore the original position
    const cancelButton = page.locator('.rotation-panel .btn-secondary')
    await cancelButton.click()
    await expect(rotationModal).toBeHidden()
    await canvasHelper.waitForRender()

    // Step 4: Verify key position is unchanged after cancellation
    await page.locator('button', { hasText: 'Export' }).click()
    const downloadPromise2 = page.waitForEvent('download')
    await page.locator('a', { hasText: 'Download JSON' }).click()
    const download2 = await downloadPromise2
    const afterPath = `e2e/test-output/rotation-after-cancel-${Date.now()}.json`
    await download2.saveAs(afterPath)

    const afterContent = await fs.readFile(afterPath, 'utf-8')
    const afterLayout = JSON.parse(afterContent)
    const keyAfterCancel = afterLayout[0][0] // First key in layout

    // Assert that key position and rotation are exactly the same
    expect(keyAfterCancel.x).toBe(keyBeforeCancel.x)
    expect(keyAfterCancel.y).toBe(keyBeforeCancel.y)
    expect(keyAfterCancel.rotation_angle).toBe(keyBeforeCancel.rotation_angle)
    expect(keyAfterCancel.rotation_x).toBe(keyBeforeCancel.rotation_x)
    expect(keyAfterCancel.rotation_y).toBe(keyBeforeCancel.rotation_y)

    // Clean up test files
    await fs.unlink(beforePath)
    await fs.unlink(afterPath)

    // Key should still be selected and functional
    await expect(page.locator('.selected-counter')).toContainText('Selected: 1')
  })
})
