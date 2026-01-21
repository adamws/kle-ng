import { Locator, Page, expect } from '@playwright/test'
import { SELECTORS } from '../../constants/selectors'

/**
 * KeySelectionPopupComponent - Overlapping key selection popup
 *
 * Encapsulates interactions with the key selection disambiguation popup
 * that appears when clicking on a position where multiple keys overlap.
 *
 * @example
 * const popup = new KeySelectionPopupComponent(page)
 * await popup.expectVisible()
 * await popup.selectKeyByIndex(1)
 */
export class KeySelectionPopupComponent {
  private readonly overlay: Locator
  private readonly popup: Locator

  constructor(private readonly page: Page) {
    this.overlay = page.locator(SELECTORS.KEY_SELECTION_POPUP.OVERLAY)
    this.popup = page.locator(SELECTORS.KEY_SELECTION_POPUP.POPUP)
  }

  /**
   * Get a popup item by index (0-based, topmost key first)
   * @param index - Zero-based index of the item
   */
  private getItem(index: number): Locator {
    return this.page.locator(
      `[data-testid="${SELECTORS.KEY_SELECTION_POPUP.ITEM_PREFIX}-${index}"]`,
    )
  }

  /**
   * Get all popup items
   */
  private getAllItems(): Locator {
    return this.page.locator(`[data-testid^="${SELECTORS.KEY_SELECTION_POPUP.ITEM_PREFIX}-"]`)
  }

  /**
   * Assert that the popup is visible
   */
  async expectVisible() {
    await expect(this.popup).toBeVisible()
    await expect(this.overlay).toBeVisible()
  }

  /**
   * Assert that the popup is hidden
   */
  async expectHidden() {
    await expect(this.popup).toBeHidden()
  }

  /**
   * Assert the number of items in the popup
   * @param count - Expected number of items
   */
  async expectItemCount(count: number) {
    await expect(this.getAllItems()).toHaveCount(count)
  }

  /**
   * Click on an item to select it
   * @param index - Zero-based index of the item to select
   */
  async selectKeyByIndex(index: number) {
    await this.getItem(index).click()
  }

  /**
   * Hover over an item
   * @param index - Zero-based index of the item to hover
   */
  async hoverKeyByIndex(index: number) {
    await this.getItem(index).hover()
  }

  /**
   * Close the popup by clicking the overlay
   */
  async close() {
    await this.overlay.click({ position: { x: 10, y: 10 } })
  }

  /**
   * Close the popup with Escape key
   */
  async closeWithEscape() {
    await this.page.keyboard.press('Escape')
  }

  /**
   * Navigate down in the list (ArrowDown)
   * Note: The popup must be focused for keyboard navigation to work.
   */
  async navigateDown() {
    // Focus the popup first to ensure it receives keyboard events
    await this.popup.focus()
    await this.popup.press('ArrowDown')
  }

  /**
   * Navigate up in the list (ArrowUp)
   * Note: The popup must be focused for keyboard navigation to work.
   */
  async navigateUp() {
    await this.popup.focus()
    await this.popup.press('ArrowUp')
  }

  /**
   * Select the focused item with Enter key
   * Note: The popup must be focused for keyboard navigation to work.
   */
  async selectWithEnter() {
    await this.popup.focus()
    await this.popup.press('Enter')
  }

  /**
   * Assert the label text of an item
   * @param index - Zero-based index of the item
   * @param expectedLabel - Expected label text (can be partial match)
   */
  async expectItemLabel(index: number, expectedLabel: string | RegExp) {
    const item = this.getItem(index)
    const label = item.locator(SELECTORS.KEY_SELECTION_POPUP.KEY_LABEL)
    await expect(label).toContainText(expectedLabel)
  }

  /**
   * Assert that an item has focus
   * @param index - Zero-based index of the item
   */
  async expectItemFocused(index: number) {
    const item = this.getItem(index)
    await expect(item).toHaveClass(/popup-item--focused/)
  }

  /**
   * Get the popup locator for advanced operations
   */
  getPopup(): Locator {
    return this.popup
  }

  /**
   * Get the overlay locator for advanced operations
   */
  getOverlay(): Locator {
    return this.overlay
  }
}
