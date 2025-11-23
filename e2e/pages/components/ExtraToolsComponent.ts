import { Locator, Page, expect } from '@playwright/test'
import { WaitHelpers } from '../../helpers/wait-helpers'

/**
 * ExtraToolsComponent - Extra tools dropdown interactions
 *
 * Encapsulates extra tools dropdown for accessing additional features like
 * matrix coordinates, legend tools, and other specialized utilities.
 *
 * @example
 * const extraTools = new ExtraToolsComponent(page, waitHelpers)
 * await extraTools.selectTool('Matrix Coordinates')
 * await extraTools.expectToolEnabled('Matrix Coordinates')
 *
 * @remarks
 * ⚠️ TECH DEBT: This component currently uses CSS class selectors (.extra-tools-group)
 * instead of data-testid attributes. These should be migrated to data-testid in the future.
 */
export class ExtraToolsComponent {
  private readonly extraToolsButton: Locator
  private readonly dropdown: Locator

  constructor(
    private readonly page: Page,
    private readonly waitHelpers: WaitHelpers,
  ) {
    this.extraToolsButton = page.locator('.extra-tools-group button')
    this.dropdown = page.locator('.extra-tools-dropdown')
  }

  /**
   * Open the extra tools dropdown
   */
  async openDropdown(): Promise<void> {
    await this.extraToolsButton.click()
    await this.waitHelpers.waitForDoubleAnimationFrame()
    await expect(this.dropdown).toBeVisible()
  }

  /**
   * Close the extra tools dropdown
   */
  async closeDropdown(): Promise<void> {
    // Click outside the dropdown to close it
    await this.page.mouse.click(10, 10)
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  /**
   * Select a specific tool from the dropdown
   * @param toolName - Name of the tool (e.g., 'Matrix Coordinates', 'Legend Tools')
   */
  async selectTool(toolName: string): Promise<void> {
    await this.openDropdown()

    const toolItem = this.dropdown.locator('.dropdown-item').filter({
      hasText: toolName,
    })
    await expect(toolItem).toBeVisible()
    await toolItem.click()

    // Wait for tool to activate
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  /**
   * Assert that a specific tool option is visible in the dropdown
   * @param toolName - Name of the tool to check
   */
  async expectToolOptionVisible(toolName: string): Promise<void> {
    const toolItem = this.dropdown.locator('.dropdown-item').filter({
      hasText: toolName,
    })
    await expect(toolItem).toBeVisible()
  }

  /**
   * Assert that a specific tool option is enabled (not disabled)
   * @param toolName - Name of the tool to check
   */
  async expectToolEnabled(toolName: string): Promise<void> {
    const toolItem = this.dropdown.locator('.dropdown-item').filter({
      hasText: toolName,
    })
    await expect(toolItem).not.toHaveClass(/disabled/)
  }

  /**
   * Assert that a specific tool option is disabled
   * @param toolName - Name of the tool to check
   */
  async expectToolDisabled(toolName: string): Promise<void> {
    const toolItem = this.dropdown.locator('.dropdown-item').filter({
      hasText: toolName,
    })
    await expect(toolItem).toHaveClass(/disabled/)
  }

  /**
   * Assert that the extra tools button is visible
   */
  async expectButtonVisible(): Promise<void> {
    await expect(this.extraToolsButton).toBeVisible()
  }

  /**
   * Assert that the dropdown is open
   */
  async expectDropdownOpen(): Promise<void> {
    await expect(this.dropdown).toBeVisible()
  }

  /**
   * Assert that the dropdown is closed
   */
  async expectDropdownClosed(): Promise<void> {
    await expect(this.dropdown).not.toBeVisible()
  }

  /**
   * Get the extra tools button locator
   */
  getButton(): Locator {
    return this.extraToolsButton
  }

  /**
   * Get the dropdown locator
   */
  getDropdown(): Locator {
    return this.dropdown
  }

  /**
   * Get all tool option locators
   */
  getToolOptions(): Locator {
    return this.dropdown.locator('.dropdown-item')
  }

  /**
   * Get the count of available tool options
   * @returns Number of tool options in the dropdown
   */
  async getToolCount(): Promise<number> {
    await this.openDropdown()
    const count = await this.getToolOptions().count()
    await this.closeDropdown()
    return count
  }
}
