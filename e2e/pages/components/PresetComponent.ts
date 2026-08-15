import { Locator, Page, expect } from '@playwright/test'
import { WaitHelpers } from '../../helpers/wait-helpers'
import { SELECTORS } from '../../constants/selectors'

/**
 * PresetComponent - Keyboard layout preset selection
 *
 * Presets are a section of the Import dropdown rather than a control of their own,
 * so opening the "dropdown" here means opening the Import menu.
 *
 * @example
 * const preset = new PresetComponent(page, waitHelpers)
 * await preset.selectPreset('ANSI 104')
 * await preset.expectPresetLoaded(104)
 */
export class PresetComponent {
  private readonly dropdownButton: Locator

  constructor(
    private readonly page: Page,
    private readonly waitHelpers: WaitHelpers,
  ) {
    this.dropdownButton = page.locator(SELECTORS.PRESET.SELECT_BUTTON)
  }

  /**
   * Select a preset keyboard layout by name
   * @param presetName - Name of the preset (e.g., 'ANSI 104', 'ISO 105', 'VIA 65%')
   */
  async selectPreset(presetName: string): Promise<void> {
    await this.openDropdown()

    // Wait for dropdown items to be visible
    await this.waitHelpers.waitForDoubleAnimationFrame()

    // Find and click the preset item (exact match)
    const escaped = presetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const presetItem = this.page.locator(SELECTORS.PRESET.DROPDOWN_ITEM, {
      hasText: new RegExp(`^${escaped}$`),
    })
    await expect(presetItem).toBeVisible()
    await presetItem.click()

    // Wait for preset to load
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  /**
   * Open the preset dropdown without selecting an option
   */
  async openDropdown(): Promise<void> {
    await this.dropdownButton.click()
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  /**
   * Close the preset dropdown
   */
  async closeDropdown(): Promise<void> {
    // Click outside the dropdown to close it
    await this.page.mouse.click(10, 10)
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  /**
   * Assert that a specific preset option is visible in the dropdown
   * @param presetName - Name of the preset to check
   */
  async expectPresetOptionVisible(presetName: string): Promise<void> {
    const presetItem = this.page.locator(SELECTORS.PRESET.DROPDOWN_ITEM, {
      hasText: new RegExp(`^${presetName}$`),
    })
    await expect(presetItem).toBeVisible()
  }

  /**
   * Assert that the preset dropdown button is visible
   */
  async expectDropdownButtonVisible(): Promise<void> {
    await expect(this.dropdownButton).toBeVisible()
  }

  /**
   * Assert that the dropdown is open
   */
  async expectDropdownOpen(): Promise<void> {
    const firstItem = this.page.locator(SELECTORS.PRESET.DROPDOWN_ITEM).first()
    await expect(firstItem).toBeVisible()
  }

  /**
   * Assert that the dropdown is closed
   */
  async expectDropdownClosed(): Promise<void> {
    const firstItem = this.page.locator(SELECTORS.PRESET.DROPDOWN_ITEM).first()
    await expect(firstItem).not.toBeVisible()
  }

  /**
   * Get the dropdown button locator
   */
  getDropdownButton(): Locator {
    return this.dropdownButton
  }

  /**
   * Get all preset option locators
   */
  getPresetOptions(): Locator {
    return this.page.locator(SELECTORS.PRESET.DROPDOWN_ITEM)
  }

  /**
   * Get the count of available preset options
   * @returns Number of preset options in the dropdown
   */
  async getPresetCount(): Promise<number> {
    await this.openDropdown()
    const count = await this.getPresetOptions().count()
    await this.closeDropdown()
    return count
  }
}
