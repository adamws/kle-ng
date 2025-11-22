import { Page, Locator, expect } from '@playwright/test'
import { WaitHelpers } from './wait-helpers'

/**
 * Helper class for interacting with the Move Exactly tool
 *
 * Provides methods for:
 * - Opening/closing the Move Exactly modal
 * - Setting movement values (X/Y)
 * - Switching between units (U/mm)
 * - Configuring mm spacing
 * - Applying/canceling movements
 *
 * @example
 * ```ts
 * const moveExactlyHelper = new MoveExactlyToolHelper(page, waitHelpers)
 * await moveExactlyHelper.openModal()
 * await moveExactlyHelper.setMovementValues(2.0, 1.5)
 * await moveExactlyHelper.apply()
 * ```
 */
export class MoveExactlyToolHelper {
  constructor(
    private page: Page,
    private waitHelpers: WaitHelpers,
  ) {}

  // ==================== Locators ====================

  /**
   * Get the Move Exactly tool button in the toolbar
   */
  getToolButton(): Locator {
    return this.page.locator('[title="Move Exactly - Move selected keys by exact X/Y values"]')
  }

  /**
   * Get the Move Exactly modal/panel
   */
  getModal(): Locator {
    return this.page.locator('.move-exactly-panel')
  }

  /**
   * Get the X movement input field
   */
  getXInput(): Locator {
    return this.page.locator('.movement-inputs input[type="number"]').first()
  }

  /**
   * Get the Y movement input field
   */
  getYInput(): Locator {
    return this.page.locator('.movement-inputs input[type="number"]').nth(1)
  }

  /**
   * Get the Apply button (primary action)
   */
  getApplyButton(): Locator {
    return this.page.locator('.move-exactly-panel .btn-primary')
  }

  /**
   * Get the Cancel button (secondary action)
   */
  getCancelButton(): Locator {
    return this.page.locator('.move-exactly-panel .btn-secondary')
  }

  /**
   * Get the U (internal units) radio button
   */
  getUnitURadio(): Locator {
    return this.page.locator('#unit-u')
  }

  /**
   * Get the mm (millimeters) radio button
   */
  getUnitMmRadio(): Locator {
    return this.page.locator('#unit-mm')
  }

  /**
   * Get the X spacing input (mm mode only)
   */
  getXSpacingInput(): Locator {
    return this.page.locator('.spacing-config input[type="number"]').first()
  }

  /**
   * Get the Y spacing input (mm mode only)
   */
  getYSpacingInput(): Locator {
    return this.page.locator('.spacing-config input[type="number"]').nth(1)
  }

  /**
   * Get the spacing config section (visible in mm mode)
   */
  getSpacingConfig(): Locator {
    return this.page.locator('.spacing-config')
  }

  /**
   * Get the movement inputs section
   */
  getMovementInputsSection(): Locator {
    return this.page.locator('.movement-inputs')
  }

  // ==================== Actions ====================

  /**
   * Open the Move Exactly modal by clicking the tool button
   */
  async openModal(): Promise<void> {
    await this.getToolButton().click()
    await expect(this.getModal()).toBeVisible()
  }

  /**
   * Close the modal by clicking the Cancel button
   */
  async cancel(): Promise<void> {
    await this.getCancelButton().click()
    await expect(this.getModal()).toBeHidden()
  }

  /**
   * Apply the movement by clicking the Apply button
   * Modal should close after applying
   */
  async apply(): Promise<void> {
    await this.getApplyButton().click()
    await expect(this.getModal()).toBeHidden()
  }

  /**
   * Set both X and Y movement values
   * @param x - X movement value
   * @param y - Y movement value
   */
  async setMovementValues(x: number | string, y: number | string): Promise<void> {
    await this.getXInput().fill(x.toString())
    await this.getYInput().fill(y.toString())
  }

  /**
   * Set only the X movement value
   * @param x - X movement value
   */
  async setXMovement(x: number | string): Promise<void> {
    await this.getXInput().fill(x.toString())
  }

  /**
   * Set only the Y movement value
   * @param y - Y movement value
   */
  async setYMovement(y: number | string): Promise<void> {
    await this.getYInput().fill(y.toString())
  }

  /**
   * Switch to U (internal units) mode
   */
  async switchToUnitU(): Promise<void> {
    await this.page.click('label[for="unit-u"]')
    await expect(this.getUnitURadio()).toBeChecked()
  }

  /**
   * Switch to mm (millimeters) mode
   */
  async switchToUnitMm(): Promise<void> {
    await this.page.click('label[for="unit-mm"]')
    await expect(this.getUnitMmRadio()).toBeChecked()
  }

  /**
   * Set custom mm spacing values
   * Only works when in mm mode
   * @param xSpacing - X spacing in mm per U
   * @param ySpacing - Y spacing in mm per U
   */
  async setMmSpacing(xSpacing: number | string, ySpacing: number | string): Promise<void> {
    await this.getXSpacingInput().fill(xSpacing.toString())
    await this.getYSpacingInput().fill(ySpacing.toString())
  }

  /**
   * Complete workflow: open modal, set values, and apply
   * @param x - X movement value
   * @param y - Y movement value
   * @param unit - Unit mode ('u' or 'mm'), defaults to 'u'
   */
  async moveKeys(x: number | string, y: number | string, unit: 'u' | 'mm' = 'u'): Promise<void> {
    await this.openModal()

    if (unit === 'mm') {
      await this.switchToUnitMm()
    }

    await this.setMovementValues(x, y)
    await this.apply()
  }

  /**
   * Complete workflow: open modal, set values with custom spacing, and apply
   * @param x - X movement value
   * @param y - Y movement value
   * @param xSpacing - X spacing in mm per U
   * @param ySpacing - Y spacing in mm per U
   */
  async moveKeysWithCustomSpacing(
    x: number | string,
    y: number | string,
    xSpacing: number | string,
    ySpacing: number | string,
  ): Promise<void> {
    await this.openModal()
    await this.switchToUnitMm()
    await this.setMmSpacing(xSpacing, ySpacing)
    await this.setMovementValues(x, y)
    await this.apply()
  }

  // ==================== Assertions ====================

  /**
   * Assert that the Move Exactly tool button is enabled
   */
  async expectToolEnabled(): Promise<void> {
    await expect(this.getToolButton()).toBeEnabled()
  }

  /**
   * Assert that the Move Exactly tool button is disabled
   */
  async expectToolDisabled(): Promise<void> {
    await expect(this.getToolButton()).toBeDisabled()
  }

  /**
   * Assert that the modal is visible
   */
  async expectModalVisible(): Promise<void> {
    await expect(this.getModal()).toBeVisible()
  }

  /**
   * Assert that the modal is hidden
   */
  async expectModalHidden(): Promise<void> {
    await expect(this.getModal()).toBeHidden()
  }

  /**
   * Assert that U mode is selected
   */
  async expectUnitUSelected(): Promise<void> {
    await expect(this.getUnitURadio()).toBeChecked()
  }

  /**
   * Assert that mm mode is selected
   */
  async expectUnitMmSelected(): Promise<void> {
    await expect(this.getUnitMmRadio()).toBeChecked()
  }

  /**
   * Assert that X input has a specific value
   * @param value - Expected value (as string)
   */
  async expectXInputValue(value: string): Promise<void> {
    await expect(this.getXInput()).toHaveValue(value)
  }

  /**
   * Assert that Y input has a specific value
   * @param value - Expected value (as string)
   */
  async expectYInputValue(value: string): Promise<void> {
    await expect(this.getYInput()).toHaveValue(value)
  }

  /**
   * Assert that X spacing input has a specific value
   * @param value - Expected value (as string)
   */
  async expectXSpacingValue(value: string): Promise<void> {
    await expect(this.getXSpacingInput()).toHaveValue(value)
  }

  /**
   * Assert that Y spacing input has a specific value
   * @param value - Expected value (as string)
   */
  async expectYSpacingValue(value: string): Promise<void> {
    await expect(this.getYSpacingInput()).toHaveValue(value)
  }

  /**
   * Assert that the X input is focused
   */
  async expectXInputFocused(): Promise<void> {
    await expect(this.getXInput()).toBeFocused()
  }

  /**
   * Assert that spacing config section is visible
   */
  async expectSpacingConfigVisible(): Promise<void> {
    await expect(this.getSpacingConfig()).toBeVisible()
  }
}
