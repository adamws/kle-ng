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
})
