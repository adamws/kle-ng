import { Locator, Page, expect } from '@playwright/test'
import { WaitHelpers } from '../../helpers/wait-helpers'
import { SELECTORS } from '../../constants/selectors'

/**
 * LayoutOptionToolbarComponent - Alternative layouts preview toolbar
 *
 * Encapsulates the bubble-button toolbar that appears below the canvas when a
 * VIA-annotated layout contains alternative-layout keys (`labels[8]` set to
 * `"option,choice"`). Provides actions for toggling between "All" (editable)
 * and read-only preview choices.
 *
 * @example
 * const toolbar = new LayoutOptionToolbarComponent(page, waitHelpers)
 * await toolbar.expectVisible()
 * await toolbar.clickChoice(0, 1)
 * await toolbar.expectChoiceActive(0, 1)
 * await toolbar.expectPreviewHintVisible()
 */
export class LayoutOptionToolbarComponent {
  private readonly toolbar: Locator
  private readonly allButton: Locator
  private readonly previewHint: Locator

  constructor(
    private readonly page: Page,
    private readonly waitHelpers: WaitHelpers,
  ) {
    this.toolbar = page.locator(SELECTORS.LAYOUT_OPTIONS.TOOLBAR)
    this.allButton = page.locator(SELECTORS.LAYOUT_OPTIONS.ALL_BUTTON)
    this.previewHint = page.locator(SELECTORS.LAYOUT_OPTIONS.PREVIEW_HINT)
  }

  /**
   * Get the toolbar root locator
   */
  getToolbar(): Locator {
    return this.toolbar
  }

  /**
   * Get the "All" button locator
   */
  getAllButton(): Locator {
    return this.allButton
  }

  /**
   * Get the locator for a specific choice button by option and choice index
   * @param option - Option group index (0-based)
   * @param choice - Choice index within the group
   */
  getChoiceButton(option: number, choice: number): Locator {
    return this.page.locator(
      `${SELECTORS.LAYOUT_OPTIONS.CHOICE_BUTTON}[data-option="${option}"][data-choice="${choice}"]`,
    )
  }

  /**
   * Get the preview hint element locator
   */
  getPreviewHint(): Locator {
    return this.previewHint
  }

  /**
   * Count the number of option groups rendered in the toolbar
   */
  async getOptionGroupCount(): Promise<number> {
    return this.page.locator(SELECTORS.LAYOUT_OPTIONS.OPTION_GROUP).count()
  }

  /**
   * Count the number of choice buttons for a specific option group
   * @param option - Option group index
   */
  async getChoiceCount(option: number): Promise<number> {
    return this.page
      .locator(
        `${SELECTORS.LAYOUT_OPTIONS.OPTION_GROUP}[data-option="${option}"] ${SELECTORS.LAYOUT_OPTIONS.CHOICE_BUTTON}`,
      )
      .count()
  }

  /**
   * Assert that the toolbar is visible (layout has alt-layout groups)
   */
  async expectVisible(): Promise<void> {
    await expect(this.toolbar).toBeVisible()
  }

  /**
   * Assert that the toolbar is not visible (layout has no alt-layout groups)
   */
  async expectHidden(): Promise<void> {
    await expect(this.toolbar).not.toBeVisible()
  }

  /**
   * Click the "All" button to exit preview mode (awaits RAF settle)
   */
  async clickAll(): Promise<void> {
    await this.allButton.click()
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  /**
   * Click a specific choice button to enter / update preview mode (awaits RAF settle)
   * @param option - Option group index
   * @param choice - Choice index within the group
   */
  async clickChoice(option: number, choice: number): Promise<void> {
    await this.getChoiceButton(option, choice).click()
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  /**
   * Assert that the "All" button has the active class (not in preview mode)
   */
  async expectAllActive(): Promise<void> {
    await expect(this.allButton).toHaveClass(/active/)
  }

  /**
   * Assert that a specific choice button has the active class
   * @param option - Option group index
   * @param choice - Choice index
   */
  async expectChoiceActive(option: number, choice: number): Promise<void> {
    await expect(this.getChoiceButton(option, choice)).toHaveClass(/active/)
  }

  /**
   * Assert that a specific choice button does NOT have the active class
   * @param option - Option group index
   * @param choice - Choice index
   */
  async expectChoiceInactive(option: number, choice: number): Promise<void> {
    await expect(this.getChoiceButton(option, choice)).not.toHaveClass(/active/)
  }

  /**
   * Assert that the preview hint text is visible (in preview mode)
   */
  async expectPreviewHintVisible(): Promise<void> {
    await expect(this.previewHint).toBeVisible()
  }

  /**
   * Assert that the preview hint text is not visible (not in preview mode)
   */
  async expectPreviewHintHidden(): Promise<void> {
    await expect(this.previewHint).not.toBeVisible()
  }
}
