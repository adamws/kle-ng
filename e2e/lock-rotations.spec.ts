import { test, expect } from '@playwright/test'
import { LockRotationsHelper } from './helpers/lock-rotations-helpers'
import { WaitHelpers } from './helpers/wait-helpers'

test.describe('Lock Rotations Feature', () => {
  // Canvas rendering tests only run on Chromium since we've verified
  // pixel-perfect identical rendering across all browsers

  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Canvas rendering tests only run on Chromium (verified identical across browsers)',
  )

  let helper: LockRotationsHelper
  let waitHelpers: WaitHelpers

  test.beforeEach(async ({ page }) => {
    waitHelpers = new WaitHelpers(page)
    helper = new LockRotationsHelper(page, waitHelpers)

    await page.goto('/')
    await helper.expectCanvasToolbarVisible()
  })

  test('should maintain rotation origin offset when moving key with lock rotations enabled', async () => {
    // Step 1: Add a single key
    await helper.addKey()

    // Step 2: Switch to relative rotation origin mode
    await helper.expectRotationOriginToggleEnabled()
    await helper.switchToRelativeMode()
    await helper.expectRelativeMode()

    // Step 3: Set rotation origin to 0.5, 0.5 (key center)
    await helper.setRotationOrigin('0.5', '0.5')
    await helper.expectRotationX('0.5')
    await helper.expectRotationY('0.5')

    // Step 4: Set rotation to 30 degrees
    await helper.setRotationAngle('30')
    await helper.expectRotationAngle('30')

    // Get initial key position
    const initialKeyX = await helper.getKeyXValue()
    const initialKeyY = await helper.getKeyYValue()

    // Switch to absolute mode to read absolute rotation origin values
    await helper.switchToAbsoluteMode()
    const initialAbsoluteRotationX = await helper.getRotationXValue()
    const initialAbsoluteRotationY = await helper.getRotationYValue()

    // Switch back to relative mode
    await helper.switchToRelativeMode()
    await helper.expectRelativeMode()

    // Step 5: Enable 'Lock rotations' checkbox
    await helper.enableLockRotations()
    await helper.expectLockRotationsChecked()

    // Step 6a: Move key using keyboard arrow keys (1U right)
    await helper.moveKeyRight1U()

    // Step 7: Validate key position changed
    const newKeyX = await helper.getKeyXValue()
    const newKeyY = await helper.getKeyYValue()

    expect(newKeyX).toBe(initialKeyX + 1)
    expect(newKeyY).toBe(initialKeyY)

    // Step 8: Validate rotation origin offset is maintained in relative mode
    await helper.expectRotationX('0.5')
    await helper.expectRotationY('0.5')

    // Step 9: Validate absolute rotation origin changed by same amount as key
    await helper.switchToAbsoluteMode()

    const newAbsoluteRotationX = await helper.getRotationXValue()
    const newAbsoluteRotationY = await helper.getRotationYValue()

    expect(newAbsoluteRotationX).toBe(initialAbsoluteRotationX + 1)
    expect(newAbsoluteRotationY).toBe(initialAbsoluteRotationY)
  })

  test('should not maintain rotation origin offset when lock rotations is disabled', async () => {
    // Add a key and set up rotation
    await helper.addKey()
    await helper.switchToRelativeMode()

    await helper.setRotationOrigin('0.5', '0.5')

    // Get initial absolute rotation origin
    await helper.switchToAbsoluteMode()
    const initialAbsoluteRotationX = await helper.getRotationXValue()
    const initialAbsoluteRotationY = await helper.getRotationYValue()
    await helper.switchToRelativeMode()

    // Ensure lock rotations is disabled (default state)
    await helper.expectLockRotationsNotChecked()

    // Move key using keyboard (1U right)
    await helper.moveKeyRight1U()

    // With lock rotations disabled, relative values should change
    await helper.expectRotationXNot('0.5')
    await helper.expectRotationY('0.5') // Y should remain the same

    // The absolute rotation origin should NOT have moved
    await helper.switchToAbsoluteMode()

    await helper.expectRotationX(initialAbsoluteRotationX.toString())
    await helper.expectRotationY(initialAbsoluteRotationY.toString())
  })

  test('should show lock rotations checkbox is properly positioned', async () => {
    // Check that lock rotations controls are visible
    await helper.expectLockRotationsControlsVisible()

    // Check that both move step and lock rotations controls are visible
    await helper.expectLockRotationsAndMoveStepVisible()
  })

  test('should move rotated key identically with mouse and keyboard when lock rotations enabled', async () => {
    // Regression test for bug where mouse movement applied rotation transformation
    // even when lockRotations was enabled, causing different behavior than keyboard

    // Add a key
    await helper.addKey()

    // Set rotation to 30 degrees
    await helper.setRotationAngle('30')
    await helper.expectRotationAngle('30')

    // Switch to absolute rotation origin mode to read rx/ry values
    await helper.switchToAbsoluteMode()

    // Get initial positions
    const initialX = await helper.getKeyXValue()
    const initialY = await helper.getKeyYValue()
    const initialRx = await helper.getRotationXValue()
    const initialRy = await helper.getRotationYValue()

    // Enable lock rotations
    await helper.enableLockRotations()

    // Test keyboard movement (4 steps right = 1U)
    await helper.moveKeyRight1U()

    // Verify keyboard movement: both x and rx should increase by 1.0
    const keyboardX = await helper.getKeyXValue()
    const keyboardY = await helper.getKeyYValue()
    const keyboardRx = await helper.getRotationXValue()
    const keyboardRy = await helper.getRotationYValue()

    expect(keyboardX).toBeCloseTo(initialX + 1.0, 2)
    expect(keyboardY).toBeCloseTo(initialY, 2)
    expect(keyboardRx).toBeCloseTo(initialRx + 1.0, 2)
    expect(keyboardRy).toBeCloseTo(initialRy, 2)

    // Undo the keyboard movement
    await helper.undo()

    // Verify we're back to initial state
    expect(await helper.getKeyXValue()).toBeCloseTo(initialX, 2)
    expect(await helper.getKeyYValue()).toBeCloseTo(initialY, 2)
    expect(await helper.getRotationXValue()).toBeCloseTo(initialRx, 2)
    expect(await helper.getRotationYValue()).toBeCloseTo(initialRy, 2)

    // Now test mouse movement with middle-button drag
    await helper.selectAll()
    await helper.expectSelectedCount(1)

    // Get canvas bounds for positioning
    const canvasBounds = await helper.getCanvasBounds()

    // Use a position that should intersect with the rendered key
    const startX = canvasBounds.x + 150
    const startY = canvasBounds.y + 150

    // Perform middle-button drag (54 pixels = 1U)
    await helper.dragKeyWithMouse(startX, startY, 54, 0)

    // Verify mouse movement: should match keyboard movement
    const mouseX = await helper.getKeyXValue()
    const mouseY = await helper.getKeyYValue()
    const mouseRx = await helper.getRotationXValue()
    const mouseRy = await helper.getRotationYValue()

    // The critical assertion: mouse and keyboard should move in the same direction
    const mouseDeltaX = mouseX - initialX
    const mouseDeltaRx = mouseRx - initialRx

    // Verify mouse moved both x and rx by the same amount (within tolerance)
    expect(mouseDeltaX).toBeCloseTo(mouseDeltaRx, 1)

    // Verify the movement is in the correct direction and reasonable magnitude
    expect(mouseDeltaX).toBeGreaterThan(0.5)
    expect(mouseDeltaX).toBeLessThan(1.5)

    // Y coordinates should not change
    expect(mouseY).toBeCloseTo(initialY, 1)
    expect(mouseRy).toBeCloseTo(initialRy, 1)

    // Most importantly: the bug was that rx moved differently than x when rotated
    expect(Math.abs(mouseDeltaX - mouseDeltaRx)).toBeLessThan(0.1)
  })
})
