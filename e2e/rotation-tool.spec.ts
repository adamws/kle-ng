// Selection rotation tool e2e tests with canvas baseline approach
import { test, expect } from '@playwright/test'
import { CanvasTestHelper } from './helpers/canvas-test-helpers'
import { KeyboardEditorPage } from './pages/KeyboardEditorPage'
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
    const editor = new KeyboardEditorPage(page)

    // Add three keys
    await canvasHelper.addKey()
    await canvasHelper.addKey()
    await canvasHelper.addKey()
    await editor.expectKeyCount(3)
    await canvasHelper.expectCanvasScreenshot('rotation-01-three-keys-added')

    // First rotation: Select all keys and rotate by 30 degrees
    await canvasHelper.selectAllKeys()
    await editor.expectSelectedCount(3)

    await editor.rotation.expectEnabled()
    await editor.rotation.open()

    const canvas = canvasHelper.getCanvas()
    await editor.rotation.selectAnchor(0, 63)
    await editor.rotation.setAngle(30)

    // Wait for angle change to render
    await canvasHelper.waitForRender()

    await editor.rotation.apply()

    // Wait for rotation to be applied and rendered
    await canvasHelper.waitForRender()

    await canvasHelper.expectCanvasScreenshot('rotation-02-after-first-rotation')
    await editor.expectSelectedCount(3)

    // Second rotation: Select third key and rotate by another 30 degrees
    await canvasHelper.deselectAllKeys()
    await editor.expectSelectedCount(0)

    // Wait for deselection to complete and render
    await canvasHelper.waitForRender()

    // Select third key at position (2.5, 1.8) in key coordinates -> (135 + 9, 97.2 + 9) canvas
    await canvas.click({ position: { x: 144, y: 106.2 }, force: true })
    await editor.expectSelectedCount(1)

    await editor.rotation.open()

    // Select anchor point at (1.69, 2.0) in key coordinates -> (91.26 + 9, 108 + 9) canvas
    await editor.rotation.selectAnchor(101.26, 117)
    await editor.rotation.setAngle(30)

    // Wait for angle change to be processed
    await canvasHelper.waitForRender()

    await editor.rotation.apply()

    // Wait for rotation to be applied and rendered
    await canvasHelper.waitForRender()

    await canvasHelper.expectCanvasScreenshot('rotation-03-after-second-rotation')
    await editor.expectSelectedCount(1)

    // Verify JSON layout matches expected result
    await canvasHelper.selectAllKeys()
    // Wait for selection to complete
    await canvasHelper.waitForRender()

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
    const editor = new KeyboardEditorPage(page)

    // Add and select keys
    await canvasHelper.addKey()
    await canvasHelper.addKey()
    await canvasHelper.selectAllKeys()

    // Open rotation tool
    await editor.rotation.open()
    await editor.rotation.expectModalVisible()

    // Cancel without selecting anchor
    await editor.rotation.cancel()

    // Modal should be gone
    await editor.rotation.expectModalHidden()

    // Keys should still be selected
    await editor.expectSelectedCount(2)
    await editor.rotation.expectEnabled()
  })

  test('should disable rotation tool when no keys selected', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)

    // Add keys but don't select any
    await canvasHelper.addKey()

    // Use reliable deselect method
    await canvasHelper.deselectAllKeys()
    await editor.expectSelectedCount(0)

    // Rotation tool should be disabled
    await editor.rotation.expectDisabled()
  })

  test('should enable rotation tool when one key selected', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)

    // Add key - single key should be selected by default
    await canvasHelper.addKey()

    // Single key should be selected by default after adding
    await editor.expectSelectedCount(1)

    // Rotation tool should be enabled (works with any selected keys)
    await editor.rotation.expectEnabled()
  })

  test('should enable rotation tool when multiple keys selected', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)

    // Add keys and select multiple
    await canvasHelper.addKey()
    await canvasHelper.addKey()

    // Select both keys
    await canvasHelper.selectAllKeys()
    await editor.expectSelectedCount(2)

    // Rotation tool should be enabled
    await editor.rotation.expectEnabled()
  })

  test('should support cancellation after anchor selection - regression test for key movement bug', async ({
    page,
  }) => {
    const editor = new KeyboardEditorPage(page)

    // REGRESSION TEST: This reproduces and tests the fix for a bug where cancelling rotation
    // after selecting an anchor point would cause already-rotated keys to move from their positions

    // BUG SCENARIO:
    // 1. Create a key and move it to explicit coordinates (x: 2, y: 1)
    // 2. Start rotation and select a new anchor point (this modifies key position internally)
    // 3. Cancel rotation - without the fix, key would stay in wrong position
    // 4. With the fix, key should return to its original position (x: 2, y: 1)

    // Step 1: Create a key and move it to explicit coordinates
    await canvasHelper.addKey()
    await editor.expectSelectedCount(1)

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
    await editor.rotation.open()

    // THIS IS THE CRITICAL STEP: Select a different anchor point
    // This internally calls transformRotationOrigin which modifies key positions
    // Anchor point at (1.37, 2.52) in key coordinates -> (73.98 + 9, 136.08 + 9) canvas
    await editor.rotation.selectAnchor(83, 145)

    // Now cancel - this should restore the original position
    await editor.rotation.cancel()
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
    await editor.expectSelectedCount(1)
  })

  test('should resize canvas while entering rotation angle (issue #31)', async ({
    page,
  }) => {
    const editor = new KeyboardEditorPage(page)

    // REGRESSION TEST: This tests the fix for a bug where the canvas would NOT resize
    // while the user was entering a rotation angle value in the rotation tool modal.
    // This caused keys to render outside the canvas edges during rotation preview.

    // BUG SCENARIO (#31):
    // 1. Add keys and open rotation tool
    // 2. Select an anchor point
    // 3. Enter a rotation angle value
    // 4. BUG: Canvas would NOT resize during step 3, causing keys to render outside canvas
    // 5. FIX: Canvas SHOULD resize during angle input to accommodate rotated keys preview

    // Step 1: Add keys and select them
    await canvasHelper.addKey()
    await canvasHelper.addKey()
    await canvasHelper.addKey()
    await editor.expectKeyCount(3)
    await canvasHelper.selectAllKeys()
    await editor.expectSelectedCount(3)

    // Step 2: Open rotation tool
    await editor.rotation.expectEnabled()
    await editor.rotation.open()

    // Step 3: Select anchor point at first key
    const canvas = canvasHelper.getCanvas()
    await editor.rotation.selectAnchor(0, 63)

    // Wait for anchor selection to complete
    await canvasHelper.waitForRender()

    // Step 4: Capture canvas dimensions BEFORE entering rotation angle
    const canvasBefore = await canvas.boundingBox()
    expect(canvasBefore).not.toBeNull()
    const widthBefore = canvasBefore!.width
    const heightBefore = canvasBefore!.height

    // Step 5: Enter rotation angle value in the input field
    // This is the critical moment - canvas SHOULD resize here
    await editor.rotation.setAngle(45)

    // Wait for angle change to be processed
    await canvasHelper.waitForRender()

    // Step 6: Verify canvas dimensions HAVE CHANGED while modal is still open
    // This is the key assertion - without the fix, canvas would not resize and keys would render out of bounds
    const canvasDuring = await canvas.boundingBox()
    expect(canvasDuring).not.toBeNull()
    const widthDuring = canvasDuring!.width
    const heightDuring = canvasDuring!.height

    // CRITICAL ASSERTION: Canvas dimensions must have changed to accommodate rotation preview
    // At least one dimension should be different (typically both will change for 45 degree rotation)
    const hasResized = widthDuring !== widthBefore || heightDuring !== heightBefore
    expect(hasResized).toBe(true)

    // Step 7: Verify modal is still visible (we haven't applied or cancelled yet)
    await editor.rotation.expectModalVisible()

    // Step 8: Apply the rotation
    await editor.rotation.apply()
    await canvasHelper.waitForRender()

    // Verify rotation was actually applied
    await editor.expectSelectedCount(3)
  })
})
