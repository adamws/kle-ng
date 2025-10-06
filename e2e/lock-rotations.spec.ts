import { test, expect } from '@playwright/test'

test.describe('Lock Rotations Feature', () => {
  // Canvas rendering tests only run on Chromium since we've verified
  // pixel-perfect identical rendering across all browsers

  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Canvas rendering tests only run on Chromium (verified identical across browsers)',
  )

  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    // Wait for app to load
    await expect(page.locator('.canvas-toolbar')).toBeVisible()
  })

  test('should maintain rotation origin offset when moving key with lock rotations enabled', async ({
    page,
  }) => {
    // Step 1: Add a single key
    await page.locator('button[title="Add Standard Key"]').click()
    // Wait for key counter to update to ensure key is added
    await expect(page.locator('.keys-counter')).toContainText('Keys: 1')

    // Ensure key is selected
    await expect(page.locator('.selected-counter')).toContainText('Selected: 1')

    // Step 2: Switch to relative rotation origin mode
    const rotationOriginToggle = page.locator('.toggle-switch').first()
    await expect(rotationOriginToggle).toBeVisible()
    await expect(rotationOriginToggle).not.toHaveClass(/disabled/)

    // Click the toggle to switch to relative mode
    await rotationOriginToggle.click()

    // Verify we're in relative mode (check the input is checked)
    await expect(rotationOriginToggle.locator('.toggle-input')).toBeChecked()

    // Step 3: Set rotation origin to 0.5, 0.5 (key center)
    const rotationXInput = page.locator('input[title*="Rotation Origin X"]').first()
    const rotationYInput = page.locator('input[title*="Rotation Origin Y"]').first()

    await rotationXInput.fill('0.5')
    await rotationXInput.press('Enter')
    await rotationYInput.fill('0.5')
    await rotationYInput.press('Enter')

    // Verify the values are set
    await expect(rotationXInput).toHaveValue('0.5')
    await expect(rotationYInput).toHaveValue('0.5')

    // Step 4: Set rotation to 30 degrees
    const rotationAngleInput = page.locator('input[title="Rotation Angle in Degrees"]').first()
    await rotationAngleInput.fill('30')
    await rotationAngleInput.press('Enter')
    await expect(rotationAngleInput).toHaveValue('30')

    // Get initial key position and absolute rotation origin values
    const keyXInput = page
      .locator('div')
      .filter({ hasText: /^X$/ })
      .locator('input[type="number"]')
      .first()
    const keyYInput = page
      .locator('div')
      .filter({ hasText: /^Y$/ })
      .locator('input[type="number"]')
      .first()

    const initialKeyX = await keyXInput.inputValue()
    const initialKeyY = await keyYInput.inputValue()

    // Switch to absolute mode to read absolute rotation origin values
    await rotationOriginToggle.click()
    await expect(rotationOriginToggle.locator('.toggle-input')).not.toBeChecked()

    const initialAbsoluteRotationX = await rotationXInput.inputValue()
    const initialAbsoluteRotationY = await rotationYInput.inputValue()

    // Switch back to relative mode
    await rotationOriginToggle.click()
    await expect(rotationOriginToggle.locator('.toggle-input')).toBeChecked()

    // Step 5: Enable 'Lock rotations' checkbox
    const lockRotationsCheckbox = page.locator('input[id="lockRotations"]')
    await expect(lockRotationsCheckbox).toBeVisible()
    await lockRotationsCheckbox.check()
    await expect(lockRotationsCheckbox).toBeChecked()

    // Step 6a: Move key using keyboard arrow keys
    const canvas = page.locator('.keyboard-canvas')
    await canvas.click() // Focus the canvas

    // Move right by 1 unit (arrow keys move by step size, default is 0.25U)
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight') // 4 presses = 1U movement

    // Step 7: Validate key position changed
    const newKeyX = await keyXInput.inputValue()
    const newKeyY = await keyYInput.inputValue()

    expect(parseFloat(newKeyX)).toBe(parseFloat(initialKeyX) + 1)
    expect(parseFloat(newKeyY)).toBe(parseFloat(initialKeyY))

    // Step 8: Validate rotation origin offset is maintained in relative mode
    const newRelativeRotationX = rotationXInput
    const newRelativeRotationY = rotationYInput

    // The relative offset should remain 0.5, 0.5 (unchanged)
    await expect(newRelativeRotationX).toHaveValue('0.5')
    await expect(newRelativeRotationY).toHaveValue('0.5')

    // Step 9: Validate absolute rotation origin changed by same amount as key
    await rotationOriginToggle.click() // Switch to absolute mode
    await expect(rotationOriginToggle.locator('.toggle-input')).not.toBeChecked()

    const newAbsoluteRotationX = await rotationXInput.inputValue()
    const newAbsoluteRotationY = await rotationYInput.inputValue()

    // The absolute rotation origin should have moved by the same delta as the key
    expect(parseFloat(newAbsoluteRotationX)).toBe(parseFloat(initialAbsoluteRotationX) + 1)
    expect(parseFloat(newAbsoluteRotationY)).toBe(parseFloat(initialAbsoluteRotationY))
  })

  test('should not maintain rotation origin offset when lock rotations is disabled', async ({
    page,
  }) => {
    // Add a key and set up rotation
    await page.locator('button[title="Add Standard Key"]').click()
    await expect(page.locator('.keys-counter')).toContainText('Keys: 1')

    const rotationOriginToggle = page.locator('.toggle-switch').first()
    await rotationOriginToggle.click() // Switch to relative

    const rotationXInput = page.locator('input[title*="Rotation Origin X"]').first()
    const rotationYInput = page.locator('input[title*="Rotation Origin Y"]').first()

    await rotationXInput.fill('0.5')
    await rotationXInput.press('Enter')
    await rotationYInput.fill('0.5')
    await rotationYInput.press('Enter')

    // Get initial absolute rotation origin
    await rotationOriginToggle.click() // Switch to absolute
    const initialAbsoluteRotationX = await rotationXInput.inputValue()
    const initialAbsoluteRotationY = await rotationYInput.inputValue()
    await rotationOriginToggle.click() // Switch back to relative

    // Ensure lock rotations is disabled (default state)
    const lockRotationsCheckbox = page.locator('input[id="lockRotations"]')
    await expect(lockRotationsCheckbox).not.toBeChecked()

    // Move key using keyboard
    const canvas = page.locator('.keyboard-canvas')
    await canvas.click()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight') // Move 1U right

    // The relative offset should change (not maintained)
    const newRelativeRotationX = rotationXInput
    const newRelativeRotationY = rotationYInput

    // With lock rotations disabled, relative values should change
    await expect(newRelativeRotationX).not.toHaveValue('0.5')
    await expect(newRelativeRotationY).toHaveValue('0.5') // Y should remain the same since we only moved horizontally

    // The absolute rotation origin should NOT have moved
    await rotationOriginToggle.click() // Switch to absolute
    const newAbsoluteRotationX = rotationXInput
    const newAbsoluteRotationY = rotationYInput

    await expect(newAbsoluteRotationX).toHaveValue(initialAbsoluteRotationX)
    await expect(newAbsoluteRotationY).toHaveValue(initialAbsoluteRotationY)
  })

  test('should show lock rotations checkbox is properly positioned', async ({ page }) => {
    // Check that lock rotations checkbox is visible in the canvas status area
    const lockRotationsCheckbox = page.locator('input[id="lockRotations"]')
    const lockRotationsLabel = page.locator('label[for="lockRotations"]')

    await expect(lockRotationsCheckbox).toBeVisible()
    await expect(lockRotationsLabel).toBeVisible()
    await expect(lockRotationsLabel).toContainText('Lock rotations')

    // Check that it's positioned near the Move Step control
    const moveStepControl = page.locator('.move-step-control')
    await expect(moveStepControl).toBeVisible()

    // Both should be visible and in the same general area
    const lockRotationsControl = page.locator('.lock-rotations-control')
    await expect(lockRotationsControl).toBeVisible()
  })

  test('should move rotated key identically with mouse and keyboard when lock rotations enabled', async ({
    page,
  }) => {
    // Regression test for bug where mouse movement applied rotation transformation
    // even when lockRotations was enabled, causing different behavior than keyboard

    // Add a key
    await page.locator('button[title="Add Standard Key"]').click()
    await expect(page.locator('.keys-counter')).toContainText('Keys: 1')
    await expect(page.locator('.selected-counter')).toContainText('Selected: 1')

    // Set rotation to 30 degrees
    const rotationAngleInput = page.locator('input[title="Rotation Angle in Degrees"]').first()
    await rotationAngleInput.fill('30')
    await rotationAngleInput.press('Enter')
    await expect(rotationAngleInput).toHaveValue('30')

    // Switch to absolute rotation origin mode to read rx/ry values
    const rotationOriginToggle = page.locator('.toggle-switch').first()
    const toggleInput = rotationOriginToggle.locator('.toggle-input')

    // Check if we need to click to get to absolute mode (unchecked = absolute)
    const isRelativeMode = await toggleInput.isChecked()
    if (isRelativeMode) {
      await rotationOriginToggle.click() // Switch to absolute mode
    }
    await expect(toggleInput).not.toBeChecked()

    // Get initial positions
    const rotationXInput = page.locator('input[title*="Rotation Origin X"]').first()
    const rotationYInput = page.locator('input[title*="Rotation Origin Y"]').first()
    const keyXInput = page
      .locator('div')
      .filter({ hasText: /^X$/ })
      .locator('input[type="number"]')
      .first()
    const keyYInput = page
      .locator('div')
      .filter({ hasText: /^Y$/ })
      .locator('input[type="number"]')
      .first()

    const initialX = parseFloat(await keyXInput.inputValue())
    const initialY = parseFloat(await keyYInput.inputValue())
    const initialRx = parseFloat(await rotationXInput.inputValue())
    const initialRy = parseFloat(await rotationYInput.inputValue())

    // Enable lock rotations
    const lockRotationsCheckbox = page.locator('input[id="lockRotations"]')
    await lockRotationsCheckbox.check()
    await expect(lockRotationsCheckbox).toBeChecked()

    // Test keyboard movement (4 steps right = 1U)
    const canvas = page.locator('.keyboard-canvas')
    await canvas.click() // Focus the canvas
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')

    // Verify keyboard movement: both x and rx should increase by 1.0
    const keyboardX = parseFloat(await keyXInput.inputValue())
    const keyboardY = parseFloat(await keyYInput.inputValue())
    const keyboardRx = parseFloat(await rotationXInput.inputValue())
    const keyboardRy = parseFloat(await rotationYInput.inputValue())

    expect(keyboardX).toBeCloseTo(initialX + 1.0, 2)
    expect(keyboardY).toBeCloseTo(initialY, 2) // Y unchanged
    expect(keyboardRx).toBeCloseTo(initialRx + 1.0, 2)
    expect(keyboardRy).toBeCloseTo(initialRy, 2) // RY unchanged

    // Undo the keyboard movement
    await page.keyboard.press('Control+z')

    // Verify we're back to initial state
    expect(parseFloat(await keyXInput.inputValue())).toBeCloseTo(initialX, 2)
    expect(parseFloat(await keyYInput.inputValue())).toBeCloseTo(initialY, 2)
    expect(parseFloat(await rotationXInput.inputValue())).toBeCloseTo(initialRx, 2)
    expect(parseFloat(await rotationYInput.inputValue())).toBeCloseTo(initialRy, 2)

    // Now test mouse movement with middle-button drag
    // Select the key again (undo deselects)
    await page.keyboard.press('Control+a')
    await expect(page.locator('.selected-counter')).toContainText('Selected: 1')

    // Get canvas bounds for positioning
    const canvasBounds = await canvas.boundingBox()
    if (!canvasBounds) throw new Error('Canvas not found')

    // Keys are rendered with some offset from canvas origin
    // Use a position that should intersect with the rendered key
    const startX = canvasBounds.x + 150
    const startY = canvasBounds.y + 150

    // Perform middle-button drag (54 pixels = 1U)
    await page.mouse.move(startX, startY)
    await page.mouse.down({ button: 'middle' })
    await page.mouse.move(startX + 54, startY, { steps: 10 })
    await page.mouse.up({ button: 'middle' })

    // Wait for drag operation to complete
    await page.waitForTimeout(200)

    // Verify mouse movement: should match keyboard movement
    const mouseX = parseFloat(await keyXInput.inputValue())
    const mouseY = parseFloat(await keyYInput.inputValue())
    const mouseRx = parseFloat(await rotationXInput.inputValue())
    const mouseRy = parseFloat(await rotationYInput.inputValue())

    // The critical assertion: mouse and keyboard should move in the same direction
    // with similar magnitudes. The key test is that rx and x move by the same delta.
    const mouseDeltaX = mouseX - initialX
    const mouseDeltaRx = mouseRx - initialRx

    // Verify mouse moved both x and rx by the same amount (within tolerance)
    expect(mouseDeltaX).toBeCloseTo(mouseDeltaRx, 1)

    // Verify the movement is in the correct direction and reasonable magnitude
    expect(mouseDeltaX).toBeGreaterThan(0.5) // Moved right at least 0.5U
    expect(mouseDeltaX).toBeLessThan(1.5) // But not more than 1.5U

    // Y coordinates should not change
    expect(mouseY).toBeCloseTo(initialY, 1)
    expect(mouseRy).toBeCloseTo(initialRy, 1)

    // Most importantly: the bug was that rx moved differently than x when rotated
    // Now they should move by the same delta (that's what lockRotations means!)
    expect(Math.abs(mouseDeltaX - mouseDeltaRx)).toBeLessThan(0.1)
  })
})
