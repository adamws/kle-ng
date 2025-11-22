import { expect, type Locator, type Page } from '@playwright/test'
import { WaitHelpers } from './wait-helpers'

/**
 * Helper for lock rotations feature tests
 *
 * Handles:
 * - Rotation origin controls (absolute/relative toggle)
 * - Rotation angle input
 * - Lock rotations checkbox
 * - Key position inputs
 * - Canvas interactions (keyboard and mouse)
 */
export class LockRotationsHelper {
  constructor(
    private page: Page,
    private waitHelpers: WaitHelpers,
  ) {}

  // =============================================================================
  // Locators
  // =============================================================================

  getRotationOriginToggle(): Locator {
    return this.page.locator('.toggle-switch').first()
  }

  getRotationOriginToggleInput(): Locator {
    return this.getRotationOriginToggle().locator('.toggle-input')
  }

  getRotationXInput(): Locator {
    return this.page.locator('input[title*="Rotation Origin X"]').first()
  }

  getRotationYInput(): Locator {
    return this.page.locator('input[title*="Rotation Origin Y"]').first()
  }

  getRotationAngleInput(): Locator {
    return this.page.locator('input[title="Rotation Angle in Degrees"]').first()
  }

  getKeyXInput(): Locator {
    return this.page
      .locator('div')
      .filter({ hasText: /^X$/ })
      .locator('input[type="number"]')
      .first()
  }

  getKeyYInput(): Locator {
    return this.page
      .locator('div')
      .filter({ hasText: /^Y$/ })
      .locator('input[type="number"]')
      .first()
  }

  getLockRotationsCheckbox(): Locator {
    return this.page.locator('input[id="lockRotations"]')
  }

  getLockRotationsLabel(): Locator {
    return this.page.locator('label[for="lockRotations"]')
  }

  getLockRotationsControl(): Locator {
    return this.page.locator('.lock-rotations-control')
  }

  getMoveStepControl(): Locator {
    return this.page.locator('.move-step-control')
  }

  getCanvas(): Locator {
    return this.page.locator('.keyboard-canvas')
  }

  getCanvasToolbar(): Locator {
    return this.page.locator('.canvas-toolbar')
  }

  getKeysCounter(): Locator {
    return this.page.locator('.keys-counter')
  }

  getSelectedCounter(): Locator {
    return this.page.locator('.selected-counter')
  }

  getAddStandardKeyButton(): Locator {
    return this.page.locator('button[title="Add Standard Key"]')
  }

  // =============================================================================
  // Actions - Setup
  // =============================================================================

  /**
   * Add a standard key and wait for it to be selected
   */
  async addKey(): Promise<void> {
    await this.getAddStandardKeyButton().click()
    await this.expectKeysCount(1)
    await this.expectSelectedCount(1)
  }

  // =============================================================================
  // Actions - Rotation Origin
  // =============================================================================

  /**
   * Switch to relative rotation origin mode
   */
  async switchToRelativeMode(): Promise<void> {
    const isRelative = await this.getRotationOriginToggleInput().isChecked()
    if (!isRelative) {
      await this.getRotationOriginToggle().click()
      await this.waitHelpers.waitForDoubleAnimationFrame()
    }
  }

  /**
   * Switch to absolute rotation origin mode
   */
  async switchToAbsoluteMode(): Promise<void> {
    const isRelative = await this.getRotationOriginToggleInput().isChecked()
    if (isRelative) {
      await this.getRotationOriginToggle().click()
      await this.waitHelpers.waitForDoubleAnimationFrame()
    }
  }

  /**
   * Toggle rotation origin mode
   */
  async toggleRotationOriginMode(): Promise<void> {
    await this.getRotationOriginToggle().click()
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  /**
   * Set rotation origin X value
   */
  async setRotationX(value: string | number): Promise<void> {
    await this.getRotationXInput().fill(String(value))
    await this.getRotationXInput().press('Enter')
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  /**
   * Set rotation origin Y value
   */
  async setRotationY(value: string | number): Promise<void> {
    await this.getRotationYInput().fill(String(value))
    await this.getRotationYInput().press('Enter')
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  /**
   * Set rotation origin (X and Y)
   */
  async setRotationOrigin(x: string | number, y: string | number): Promise<void> {
    await this.setRotationX(x)
    await this.setRotationY(y)
  }

  /**
   * Set rotation angle in degrees
   */
  async setRotationAngle(angle: string | number): Promise<void> {
    await this.getRotationAngleInput().fill(String(angle))
    await this.getRotationAngleInput().press('Enter')
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  // =============================================================================
  // Actions - Lock Rotations
  // =============================================================================

  /**
   * Enable lock rotations checkbox
   */
  async enableLockRotations(): Promise<void> {
    const isChecked = await this.getLockRotationsCheckbox().isChecked()
    if (!isChecked) {
      await this.getLockRotationsCheckbox().check()
      await this.waitHelpers.waitForDoubleAnimationFrame()
    }
  }

  /**
   * Disable lock rotations checkbox
   */
  async disableLockRotations(): Promise<void> {
    const isChecked = await this.getLockRotationsCheckbox().isChecked()
    if (isChecked) {
      await this.getLockRotationsCheckbox().uncheck()
      await this.waitHelpers.waitForDoubleAnimationFrame()
    }
  }

  // =============================================================================
  // Actions - Key Movement
  // =============================================================================

  /**
   * Move key using keyboard arrow keys
   * @param direction - 'right', 'left', 'up', 'down'
   * @param steps - Number of steps (default 4 for 1U movement)
   */
  async moveKeyWithKeyboard(
    direction: 'right' | 'left' | 'up' | 'down',
    steps: number = 4,
  ): Promise<void> {
    await this.getCanvas().click() // Focus canvas

    const keyMap = {
      right: 'ArrowRight',
      left: 'ArrowLeft',
      up: 'ArrowUp',
      down: 'ArrowDown',
    }

    const key = keyMap[direction]
    for (let i = 0; i < steps; i++) {
      await this.page.keyboard.press(key)
    }

    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  /**
   * Move key right by 1U (4 steps)
   */
  async moveKeyRight1U(): Promise<void> {
    await this.moveKeyWithKeyboard('right', 4)
  }

  /**
   * Undo last action
   */
  async undo(): Promise<void> {
    await this.page.keyboard.press('Control+z')
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  /**
   * Select all keys
   */
  async selectAll(): Promise<void> {
    await this.page.keyboard.press('Control+a')
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  /**
   * Perform middle-button drag on canvas
   * @param startX - Starting X coordinate
   * @param startY - Starting Y coordinate
   * @param deltaX - X movement amount in pixels
   * @param deltaY - Y movement amount in pixels
   */
  async dragKeyWithMouse(
    startX: number,
    startY: number,
    deltaX: number,
    deltaY: number,
  ): Promise<void> {
    await this.page.mouse.move(startX, startY)
    await this.page.mouse.down({ button: 'middle' })
    await this.page.mouse.move(startX + deltaX, startY + deltaY, { steps: 10 })
    await this.page.mouse.up({ button: 'middle' })
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  // =============================================================================
  // Getters - Values
  // =============================================================================

  /**
   * Get rotation X value
   */
  async getRotationXValue(): Promise<number> {
    const value = await this.getRotationXInput().inputValue()
    return parseFloat(value)
  }

  /**
   * Get rotation Y value
   */
  async getRotationYValue(): Promise<number> {
    const value = await this.getRotationYInput().inputValue()
    return parseFloat(value)
  }

  /**
   * Get key X value
   */
  async getKeyXValue(): Promise<number> {
    const value = await this.getKeyXInput().inputValue()
    return parseFloat(value)
  }

  /**
   * Get key Y value
   */
  async getKeyYValue(): Promise<number> {
    const value = await this.getKeyYInput().inputValue()
    return parseFloat(value)
  }

  /**
   * Check if in relative mode
   */
  async isRelativeMode(): Promise<boolean> {
    return await this.getRotationOriginToggleInput().isChecked()
  }

  /**
   * Get canvas bounds
   */
  async getCanvasBounds(): Promise<{ x: number; y: number; width: number; height: number }> {
    const bounds = await this.getCanvas().boundingBox()
    if (!bounds) throw new Error('Canvas not found')
    return bounds
  }

  // =============================================================================
  // Assertions
  // =============================================================================

  /**
   * Assert keys counter
   */
  async expectKeysCount(count: number): Promise<void> {
    await expect(this.getKeysCounter()).toContainText(`Keys: ${count}`)
  }

  /**
   * Assert selected counter
   */
  async expectSelectedCount(count: number): Promise<void> {
    await expect(this.getSelectedCounter()).toContainText(`Selected: ${count}`)
  }

  /**
   * Assert canvas toolbar is visible
   */
  async expectCanvasToolbarVisible(): Promise<void> {
    await expect(this.getCanvasToolbar()).toBeVisible()
  }

  /**
   * Assert rotation origin toggle is enabled
   */
  async expectRotationOriginToggleEnabled(): Promise<void> {
    await expect(this.getRotationOriginToggle()).toBeVisible()
    await expect(this.getRotationOriginToggle()).not.toHaveClass(/disabled/)
  }

  /**
   * Assert in relative mode
   */
  async expectRelativeMode(): Promise<void> {
    await expect(this.getRotationOriginToggleInput()).toBeChecked()
  }

  /**
   * Assert in absolute mode
   */
  async expectAbsoluteMode(): Promise<void> {
    await expect(this.getRotationOriginToggleInput()).not.toBeChecked()
  }

  /**
   * Assert rotation X value
   */
  async expectRotationX(value: string | number): Promise<void> {
    await expect(this.getRotationXInput()).toHaveValue(String(value))
  }

  /**
   * Assert rotation Y value
   */
  async expectRotationY(value: string | number): Promise<void> {
    await expect(this.getRotationYInput()).toHaveValue(String(value))
  }

  /**
   * Assert rotation angle value
   */
  async expectRotationAngle(value: string | number): Promise<void> {
    await expect(this.getRotationAngleInput()).toHaveValue(String(value))
  }

  /**
   * Assert lock rotations checkbox is checked
   */
  async expectLockRotationsChecked(): Promise<void> {
    await expect(this.getLockRotationsCheckbox()).toBeChecked()
  }

  /**
   * Assert lock rotations checkbox is not checked
   */
  async expectLockRotationsNotChecked(): Promise<void> {
    await expect(this.getLockRotationsCheckbox()).not.toBeChecked()
  }

  /**
   * Assert lock rotations controls are visible
   */
  async expectLockRotationsControlsVisible(): Promise<void> {
    await expect(this.getLockRotationsCheckbox()).toBeVisible()
    await expect(this.getLockRotationsLabel()).toBeVisible()
    await expect(this.getLockRotationsLabel()).toContainText('Lock rotations')
  }

  /**
   * Assert lock rotations control and move step control are both visible
   */
  async expectLockRotationsAndMoveStepVisible(): Promise<void> {
    await expect(this.getMoveStepControl()).toBeVisible()
    await expect(this.getLockRotationsControl()).toBeVisible()
  }

  /**
   * Assert rotation X does not have a specific value
   */
  async expectRotationXNot(value: string | number): Promise<void> {
    await expect(this.getRotationXInput()).not.toHaveValue(String(value))
  }
}
