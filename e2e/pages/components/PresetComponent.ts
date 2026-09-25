import { Locator, Page, expect } from '@playwright/test'
import { WaitHelpers } from '../../helpers/wait-helpers'
import { SELECTORS } from '../../constants/selectors'

/**
 * PresetComponent - Keyboard layout preset selection
 *
 * Presets live on two surfaces. The Import dropdown lists a curated shortlist, and
 * "From Preset" in the same menu opens a modal holding the whole library. Opening the
 * "dropdown" here means opening the Import menu.
 *
 * `selectPreset()` spans both: it clicks the shortlist entry when there is one and
 * otherwise goes through the modal, so callers only ever name the preset they want.
 *
 * Some presets ship with more than one set of legends. Clicking such a card loads it
 * in one click; the alternatives live behind an optional control in the card's corner
 * which only STAGES a choice — the card still has to be clicked to import. Pass
 * `language` to set it first.
 *
 * @example
 * const preset = new PresetComponent(page, waitHelpers)
 * await preset.selectPreset('ANSI 104')          // from the shortlist
 * await preset.selectPreset('Kinesis Advantage') // via the modal, transparently
 * await preset.selectPresetFromModal('ANSI 104', { language: 'Polish' })
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
   * Select a keyboard layout preset by name, from wherever it lives
   * @param presetName - Name of the preset (e.g., 'ANSI 104', 'ISO 105', 'Planck')
   */
  async selectPreset(presetName: string, { language }: { language?: string } = {}): Promise<void> {
    await this.openDropdown()

    // Wait for dropdown items to be visible
    await this.waitHelpers.waitForDoubleAnimationFrame()

    const escaped = presetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const shortlistItem = this.page.locator(SELECTORS.PRESET.DROPDOWN_ITEM, {
      hasText: new RegExp(`^${escaped}$`),
    })

    if ((await shortlistItem.count()) > 0) {
      await expect(shortlistItem).toBeVisible()
      await shortlistItem.click()
    } else {
      await this.selectPresetFromModal(presetName, { menuAlreadyOpen: true, language })
    }

    // Wait for preset to load
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  /**
   * Open the full preset library modal
   * @returns The modal locator, already visible
   */
  async openPresetModal(): Promise<Locator> {
    await this.openDropdown()
    await this.waitHelpers.waitForDoubleAnimationFrame()
    return this.openPresetModalFromOpenMenu()
  }

  /**
   * Pick a preset from the library modal by name
   * @param presetName - Name of the preset
   * @param options.menuAlreadyOpen - Skip opening the Import menu; it is already open
   * @param options.language - Display name of the language to import, for a
   *   multilingual preset (e.g. 'Polish')
   */
  async selectPresetFromModal(
    presetName: string,
    { menuAlreadyOpen = false, language }: { menuAlreadyOpen?: boolean; language?: string } = {},
  ): Promise<void> {
    const modal = menuAlreadyOpen
      ? await this.openPresetModalFromOpenMenu()
      : await this.openPresetModal()

    // Narrow first so the card is on screen without scrolling, then match on the
    // attribute rather than the text: search highlighting wraps fragments of the
    // rendered name in <mark>.
    await modal.locator(SELECTORS.PRESET.SEARCH).fill(presetName)
    const card = modal.locator(`${SELECTORS.PRESET.CARD}[data-preset-name="${presetName}"]`)
    await expect(card).toBeVisible()

    if (language !== undefined) {
      const menu = await this.openLanguageMenu(presetName, { modalAlreadyOpen: true })
      await menu.locator(SELECTORS.PRESET.LANGUAGE_OPTION, { hasText: language }).click()
      await expect(menu).toBeHidden()
      // Staging only — the import is still the click on the card below.
      await expect(modal).toBeVisible()
    }

    await card.click()
    await expect(modal).toBeHidden()
  }

  /**
   * Open a card's language menu, leaving it open
   * @param presetName - Name of the preset
   * @param options.modalAlreadyOpen - The library modal is open and already filtered
   * @returns The menu locator, already visible
   */
  async openLanguageMenu(presetName: string, { modalAlreadyOpen = false } = {}): Promise<Locator> {
    if (!modalAlreadyOpen) {
      const modal = await this.openPresetModal()
      await modal.locator(SELECTORS.PRESET.SEARCH).fill(presetName)
    }

    const slot = this.page
      .locator('.preset-card-slot')
      .filter({ has: this.page.locator(`[data-preset-name="${presetName}"]`) })
    await slot.locator(SELECTORS.PRESET.LANGUAGE_TOGGLE).click()

    const menu = this.page.locator(SELECTORS.PRESET.LANGUAGE_MENU)
    await expect(menu).toBeVisible()
    return menu
  }

  /**
   * Open the Import menu, which is where presets live
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
   * Assert that a specific preset option is visible in the dropdown shortlist
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
   * Get all shortlist preset option locators
   */
  getPresetOptions(): Locator {
    return this.page.locator(SELECTORS.PRESET.DROPDOWN_ITEM)
  }

  /**
   * Get the count of presets listed directly in the Import menu
   *
   * This is the curated shortlist, not the whole library — use
   * {@link getLibraryPresetCount} for that.
   *
   * @returns Number of preset options in the dropdown
   */
  async getPresetCount(): Promise<number> {
    await this.openDropdown()
    const count = await this.getPresetOptions().count()
    await this.closeDropdown()
    return count
  }

  /**
   * Get the count of presets in the full library modal
   * @returns Number of preset cards in the modal
   */
  async getLibraryPresetCount(): Promise<number> {
    const modal = await this.openPresetModal()
    const count = await modal.locator(SELECTORS.PRESET.CARD).count()
    await this.page.keyboard.press('Escape')
    await expect(modal).toBeHidden()
    return count
  }

  /** Clicks "From Preset" in an Import menu that is already open. */
  private async openPresetModalFromOpenMenu(): Promise<Locator> {
    await this.page.click(SELECTORS.PRESET.BROWSE_ITEM)
    const modal = this.page.locator(SELECTORS.PRESET.MODAL)
    await expect(modal).toBeVisible()
    return modal
  }
}
