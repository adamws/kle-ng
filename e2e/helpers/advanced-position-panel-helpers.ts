import { expect, type Locator, type Page } from '@playwright/test'
import { WaitHelpers } from './wait-helpers'

/**
 * Helper for advanced position & rotation panel interactions
 *
 * Handles:
 * - Mode toggling (basic/advanced)
 * - Secondary property inputs
 * - Panel visibility and state
 * - Special key interactions
 */
export class AdvancedPositionPanelHelper {
  constructor(
    private page: Page,
    private waitHelpers: WaitHelpers,
  ) {}

  // =============================================================================
  // Locators
  // =============================================================================

  getModeToggleButton(): Locator {
    return this.page.locator('.toggle-mode-btn')
  }

  getPanelTitle(): Locator {
    return this.page.locator('.position-rotation-container .property-group-title')
  }

  getPanelContainer(): Locator {
    return this.page.locator('.property-group.position-rotation-container')
  }

  getKeyPropertiesPanel(): Locator {
    return this.page.locator('.key-properties-panel')
  }

  getSecondaryXInput(): Locator {
    return this.page.locator('input[title="Secondary X Position"]')
  }

  getSecondaryYInput(): Locator {
    return this.page.locator('input[title="Secondary Y Position"]')
  }

  getSecondaryWidthInput(): Locator {
    return this.page.locator('input[title="Secondary Width"]')
  }

  getSecondaryHeightInput(): Locator {
    return this.page.locator('input[title="Secondary Height"]')
  }

  getPrimaryWidthInput(): Locator {
    return this.page.locator('input[title="Width"]').first()
  }

  getPrimaryHeightInput(): Locator {
    return this.page.locator('input[title="Height"]').first()
  }

  getKeysCounter(): Locator {
    return this.page.getByTestId('counter-keys')
  }

  getSelectedCounter(): Locator {
    return this.page.locator('.selected-counter')
  }

  getAddStandardKeyButton(): Locator {
    return this.page.locator('button[title="Add Standard Key"]')
  }

  getAddSpecialKeyButton(): Locator {
    return this.page.locator('button[title="Add Special Key"]')
  }

  getDropdownItem(text: string): Locator {
    return this.page.locator('.dropdown-item').filter({ hasText: text })
  }

  // =============================================================================
  // Actions
  // =============================================================================

  /**
   * Toggle between basic and advanced modes
   */
  async toggleMode(): Promise<void> {
    await this.getModeToggleButton().click()
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  /**
   * Switch to advanced mode (if not already)
   */
  async switchToAdvancedMode(): Promise<void> {
    const buttonText = await this.getModeToggleButton().textContent()
    if (buttonText?.includes('Advanced')) {
      await this.toggleMode()
    }
  }

  /**
   * Switch to basic mode (if not already)
   */
  async switchToBasicMode(): Promise<void> {
    const buttonText = await this.getModeToggleButton().textContent()
    if (buttonText?.includes('Basic')) {
      await this.toggleMode()
    }
  }

  /**
   * Set secondary X position
   */
  async setSecondaryX(value: string | number): Promise<void> {
    await this.getSecondaryXInput().fill(String(value))
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  /**
   * Set secondary Y position
   */
  async setSecondaryY(value: string | number): Promise<void> {
    await this.getSecondaryYInput().fill(String(value))
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  /**
   * Set secondary width
   */
  async setSecondaryWidth(value: string | number): Promise<void> {
    await this.getSecondaryWidthInput().first().fill(String(value))
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  /**
   * Set secondary height
   */
  async setSecondaryHeight(value: string | number): Promise<void> {
    await this.getSecondaryHeightInput().first().fill(String(value))
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  /**
   * Set all secondary properties at once
   */
  async setSecondaryProperties(props: {
    x?: string | number
    y?: string | number
    width?: string | number
    height?: string | number
  }): Promise<void> {
    if (props.x !== undefined) {
      await this.setSecondaryX(props.x)
    }
    if (props.y !== undefined) {
      await this.setSecondaryY(props.y)
    }
    if (props.width !== undefined) {
      await this.setSecondaryWidth(props.width)
    }
    if (props.height !== undefined) {
      await this.setSecondaryHeight(props.height)
    }
  }

  /**
   * Set primary width
   */
  async setPrimaryWidth(value: string | number): Promise<void> {
    await this.getPrimaryWidthInput().fill(String(value))
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  /**
   * Set primary height
   */
  async setPrimaryHeight(value: string | number): Promise<void> {
    await this.getPrimaryHeightInput().fill(String(value))
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  /**
   * Add a standard key
   */
  async addStandardKey(): Promise<void> {
    await this.getAddStandardKeyButton().click()
    await this.expectKeysCount(1)
    await this.expectSelectedCount(1)
  }

  /**
   * Add a special key from dropdown
   */
  async addSpecialKey(keyType: string): Promise<void> {
    await this.getAddSpecialKeyButton().click()
    await this.waitHelpers.waitForDoubleAnimationFrame()

    const option = this.getDropdownItem(keyType)
    await option.click()
    await this.waitHelpers.waitForDoubleAnimationFrame()

    await this.expectKeysCount(1)
    await this.expectSelectedCount(1)
  }

  /**
   * Get panel height
   */
  async getPanelHeight(): Promise<number> {
    const box = await this.getPanelContainer().boundingBox()
    expect(box).toBeTruthy()
    return box!.height
  }

  // =============================================================================
  // Assertions
  // =============================================================================

  /**
   * Assert panel is in basic mode
   */
  async expectBasicMode(): Promise<void> {
    await expect(this.getPanelTitle()).toContainText('Position & Rotation')
    await expect(this.getModeToggleButton()).toContainText('Advanced')
  }

  /**
   * Assert panel is in advanced mode
   */
  async expectAdvancedMode(): Promise<void> {
    await expect(this.getPanelTitle()).toContainText('Advanced Position & Rotation')
    await expect(this.getModeToggleButton()).toContainText('Basic')
  }

  /**
   * Assert secondary controls are visible
   */
  async expectSecondaryControlsVisible(): Promise<void> {
    await expect(this.getSecondaryXInput()).toBeVisible()
    await expect(this.getSecondaryYInput()).toBeVisible()
    await expect(this.getSecondaryWidthInput()).toBeVisible()
    await expect(this.getSecondaryHeightInput()).toBeVisible()
  }

  /**
   * Assert secondary controls are hidden
   */
  async expectSecondaryControlsHidden(): Promise<void> {
    await expect(this.getSecondaryXInput()).toBeHidden()
    await expect(this.getSecondaryYInput()).toBeHidden()
    await expect(this.getSecondaryWidthInput()).toBeHidden()
    await expect(this.getSecondaryHeightInput()).toBeHidden()
  }

  /**
   * Assert secondary X value
   */
  async expectSecondaryX(value: string | number): Promise<void> {
    await expect(this.getSecondaryXInput()).toHaveValue(String(value))
  }

  /**
   * Assert secondary Y value
   */
  async expectSecondaryY(value: string | number): Promise<void> {
    await expect(this.getSecondaryYInput()).toHaveValue(String(value))
  }

  /**
   * Assert secondary width value
   */
  async expectSecondaryWidth(value: string | number): Promise<void> {
    await expect(this.getSecondaryWidthInput()).toHaveValue(String(value))
  }

  /**
   * Assert secondary height value
   */
  async expectSecondaryHeight(value: string | number): Promise<void> {
    await expect(this.getSecondaryHeightInput()).toHaveValue(String(value))
  }

  /**
   * Assert all secondary properties at once
   */
  async expectSecondaryProperties(props: {
    x?: string | number
    y?: string | number
    width?: string | number
    height?: string | number
  }): Promise<void> {
    if (props.x !== undefined) {
      await this.expectSecondaryX(props.x)
    }
    if (props.y !== undefined) {
      await this.expectSecondaryY(props.y)
    }
    if (props.width !== undefined) {
      await this.expectSecondaryWidth(props.width)
    }
    if (props.height !== undefined) {
      await this.expectSecondaryHeight(props.height)
    }
  }

  /**
   * Assert keys count
   */
  async expectKeysCount(count: number): Promise<void> {
    await expect(this.getKeysCounter()).toContainText(`Keys: ${count}`)
  }

  /**
   * Assert selected count
   */
  async expectSelectedCount(count: number): Promise<void> {
    await expect(this.getSelectedCounter()).toContainText(`Selected: ${count}`)
  }

  /**
   * Assert key properties panel is visible
   */
  async expectKeyPropertiesPanelVisible(): Promise<void> {
    await expect(this.getKeyPropertiesPanel()).toBeVisible()
  }

  /**
   * Assert secondary dimensions are greater than zero
   */
  async expectSecondaryDimensionsGreaterThanZero(): Promise<void> {
    const width = await this.getSecondaryWidthInput().inputValue()
    const height = await this.getSecondaryHeightInput().inputValue()
    expect(parseFloat(width)).toBeGreaterThan(0)
    expect(parseFloat(height)).toBeGreaterThan(0)
  }

  /**
   * Assert panel height difference is within tolerance
   */
  async expectPanelHeightSimilar(otherHeight: number, tolerance: number = 50): Promise<void> {
    const currentHeight = await this.getPanelHeight()
    const difference = Math.abs(currentHeight - otherHeight)
    expect(difference).toBeLessThan(tolerance)
  }
}
