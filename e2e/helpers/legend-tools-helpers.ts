import { Page, Locator, expect } from '@playwright/test'
import { WaitHelpers } from './wait-helpers'

/**
 * Helper class for Legend Tools panel interactions in E2E tests.
 *
 * Provides reusable methods for:
 * - Panel locators and navigation
 * - Legend removal, alignment, and movement operations
 * - Tab switching and state management
 * - Panel assertions and validations
 *
 * @example
 * ```typescript
 * const legendHelper = new LegendToolsHelper(page, waitHelpers)
 * await legendHelper.openPanel()
 * await legendHelper.removeAllLegends()
 * await legendHelper.closePanel()
 * ```
 */
export class LegendToolsHelper {
  constructor(
    private page: Page,
    private waitHelpers: WaitHelpers,
  ) {}

  // ============================================================================
  // Locator Getters - Extra Tools Dropdown
  // ============================================================================

  /**
   * Get the Extra Tools button locator.
   */
  getExtraToolsButton(): Locator {
    return this.page.getByTitle('Extra Tools')
  }

  /**
   * Get the Extra Tools dropdown container locator.
   */
  getExtraToolsDropdown(): Locator {
    return this.page.locator('.extra-tools-dropdown')
  }

  /**
   * Get the Legend Tools menu item locator.
   */
  getLegendToolsMenuItem(): Locator {
    return this.page.getByRole('button', { name: 'Legend Tools' })
  }

  /**
   * Get the Move Rotation Origins menu item locator.
   */
  getMoveRotationOriginsMenuItem(): Locator {
    return this.page.getByRole('button', { name: 'Move Rotation Origins' })
  }

  // ============================================================================
  // Locator Getters - Panel Structure
  // ============================================================================

  /**
   * Get the Legend Tools panel container locator.
   */
  getPanel(): Locator {
    return this.page.locator('.legend-tools-panel')
  }

  /**
   * Get the panel title locator.
   */
  getPanelTitle(): Locator {
    return this.page.locator('.panel-title', { hasText: 'Legend Tools' })
  }

  /**
   * Get the panel close button locator.
   */
  getCloseButton(): Locator {
    return this.page.locator('.legend-tools-panel .btn-close')
  }

  /**
   * Get the drag handle locator.
   */
  getDragHandle(): Locator {
    return this.page.locator('.legend-tools-panel .drag-handle')
  }

  /**
   * Get the status count text locator.
   */
  getStatusCount(): Locator {
    return this.page.locator('text=key(s) will be affected')
  }

  // ============================================================================
  // Locator Getters - Tab Navigation
  // ============================================================================

  /**
   * Get the Remove tab radio input locator.
   */
  getRemoveTabInput(): Locator {
    return this.page.locator('#tab-remove')
  }

  /**
   * Get the Remove tab label locator.
   */
  getRemoveTabLabel(): Locator {
    return this.page.locator('label[for="tab-remove"]')
  }

  /**
   * Get the Align tab radio input locator.
   */
  getAlignTabInput(): Locator {
    return this.page.locator('#tab-align')
  }

  /**
   * Get the Align tab label locator.
   */
  getAlignTabLabel(): Locator {
    return this.page.locator('label[for="tab-align"]')
  }

  /**
   * Get the Move tab radio input locator.
   */
  getMoveTabInput(): Locator {
    return this.page.locator('#tab-move')
  }

  /**
   * Get the Move tab label locator.
   */
  getMoveTabLabel(): Locator {
    return this.page.locator('label[for="tab-move"]')
  }

  // ============================================================================
  // Locator Getters - Remove Tab Elements
  // ============================================================================

  /**
   * Get a category button in the Remove tab by name.
   *
   * @param category - Category name (e.g., 'All', 'Alphas', 'Numbers')
   */
  getCategoryButton(
    category:
      | 'All'
      | 'Alphas'
      | 'Numbers'
      | 'Punctuation'
      | 'Function'
      | 'Specials'
      | 'Others'
      | 'Decals',
  ): Locator {
    return this.page.getByRole('button', { name: category }).first()
  }

  // ============================================================================
  // Locator Getters - Align Tab Elements
  // ============================================================================

  /**
   * Get the keycap preview element in Align tab.
   */
  getKeycapPreview(): Locator {
    return this.page.locator('.keycap-preview')
  }

  /**
   * Get all alignment buttons in the Align tab.
   */
  getAlignmentButtons(): Locator {
    return this.page.locator('.align-btn')
  }

  /**
   * Get a specific alignment button by index (0-8 for 3x3 grid).
   *
   * @param index - Button index (0 = top-left, 4 = center, 8 = bottom-right)
   */
  getAlignmentButton(index: number): Locator {
    return this.page.locator('.align-btn').nth(index)
  }

  // ============================================================================
  // Locator Getters - Move Tab Elements
  // ============================================================================

  /**
   * Get all keycap selector elements in Move tab.
   */
  getKeycapSelectors(): Locator {
    return this.page.locator('.keycap-selector')
  }

  /**
   * Get all position label elements in Move tab.
   */
  getPositionLabels(): Locator {
    return this.page.locator('.position-label')
  }

  /**
   * Get a position label by abbreviation.
   *
   * @param abbr - Position abbreviation (e.g., 'TL', 'CC', 'BR')
   */
  getPositionLabel(abbr: string): Locator {
    return this.page.locator(`label:has-text("${abbr}")`).first()
  }

  /**
   * Get a position radio input by value.
   *
   * @param value - Position value (0-11 for standard positions)
   * @param selector - Which selector (0 for source, 1 for destination)
   */
  getPositionRadio(value: number, selector: 0 | 1): Locator {
    return this.page.locator(`input[value="${value}"]`).nth(selector)
  }

  /**
   * Get the move button (arrow button between selectors).
   */
  getMoveButton(): Locator {
    return this.page.locator('.btn-outline-secondary i.bi-arrow-right')
  }

  // ============================================================================
  // Panel Control Methods
  // ============================================================================

  /**
   * Open the Legend Tools panel.
   *
   * @example
   * ```typescript
   * await legendHelper.openPanel()
   * ```
   */
  async openPanel(): Promise<void> {
    await this.getExtraToolsButton().click()
    await this.getLegendToolsMenuItem().click()
    await this.expectPanelVisible()
  }

  /**
   * Close the Legend Tools panel using the close button.
   *
   * @example
   * ```typescript
   * await legendHelper.closePanel()
   * ```
   */
  async closePanel(): Promise<void> {
    await this.getCloseButton().click()
    await this.expectPanelNotVisible()
  }

  /**
   * Close the panel using the Escape key.
   *
   * @example
   * ```typescript
   * await legendHelper.closePanelWithEscape()
   * ```
   */
  async closePanelWithEscape(): Promise<void> {
    await this.page.keyboard.press('Escape')
    await this.expectPanelNotVisible()
  }

  // ============================================================================
  // Tab Navigation Methods
  // ============================================================================

  /**
   * Switch to the Remove tab.
   *
   * @example
   * ```typescript
   * await legendHelper.switchToRemoveTab()
   * ```
   */
  async switchToRemoveTab(): Promise<void> {
    await this.getRemoveTabLabel().click()
    await expect(this.getRemoveTabInput()).toBeChecked()
  }

  /**
   * Switch to the Align tab.
   *
   * @example
   * ```typescript
   * await legendHelper.switchToAlignTab()
   * ```
   */
  async switchToAlignTab(): Promise<void> {
    await this.getAlignTabLabel().click()
    await expect(this.getAlignTabInput()).toBeChecked()
  }

  /**
   * Switch to the Move tab.
   *
   * @example
   * ```typescript
   * await legendHelper.switchToMoveTab()
   * ```
   */
  async switchToMoveTab(): Promise<void> {
    await this.getMoveTabLabel().click()
    await expect(this.getMoveTabInput()).toBeChecked()
  }

  // ============================================================================
  // Remove Tab Actions
  // ============================================================================

  /**
   * Remove legends by category.
   *
   * @param category - Category to remove
   *
   * @example
   * ```typescript
   * await legendHelper.removeLegendsByCategory('Alphas')
   * ```
   */
  async removeLegendsByCategory(
    category:
      | 'All'
      | 'Alphas'
      | 'Numbers'
      | 'Punctuation'
      | 'Function'
      | 'Specials'
      | 'Others'
      | 'Decals',
  ): Promise<void> {
    await this.getCategoryButton(category).click()
  }

  /**
   * Remove all legends from selected keys.
   *
   * @example
   * ```typescript
   * await legendHelper.removeAllLegends()
   * ```
   */
  async removeAllLegends(): Promise<void> {
    await this.removeLegendsByCategory('All')
  }

  // ============================================================================
  // Align Tab Actions
  // ============================================================================

  /**
   * Click an alignment button by index.
   *
   * @param index - Button index (0 = top-left, 4 = center, 8 = bottom-right)
   *
   * @example
   * ```typescript
   * await legendHelper.alignLegends(0) // Align to top-left
   * ```
   */
  async alignLegends(index: number): Promise<void> {
    await this.getAlignmentButton(index).click()
  }

  /**
   * Align legends to top-left position.
   *
   * @example
   * ```typescript
   * await legendHelper.alignToTopLeft()
   * ```
   */
  async alignToTopLeft(): Promise<void> {
    await this.alignLegends(0)
  }

  // ============================================================================
  // Move Tab Actions
  // ============================================================================

  /**
   * Select source and destination positions and perform move.
   *
   * @param fromPosition - Source position value (0-11)
   * @param toPosition - Destination position value (0-11)
   *
   * @example
   * ```typescript
   * await legendHelper.moveLegend(0, 1) // Move from top-left to top-center
   * ```
   */
  async moveLegend(fromPosition: number, toPosition: number): Promise<void> {
    await this.getPositionRadio(fromPosition, 0).click({ force: true })
    await this.getPositionRadio(toPosition, 1).click({ force: true })
    await this.getMoveButton().click()
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  // ============================================================================
  // Assertion Helpers
  // ============================================================================

  /**
   * Assert that the Legend Tools panel is visible.
   *
   * @example
   * ```typescript
   * await legendHelper.expectPanelVisible()
   * ```
   */
  async expectPanelVisible(): Promise<void> {
    await expect(this.getPanel()).toBeVisible()
  }

  /**
   * Assert that the Legend Tools panel is NOT visible.
   *
   * @example
   * ```typescript
   * await legendHelper.expectPanelNotVisible()
   * ```
   */
  async expectPanelNotVisible(): Promise<void> {
    await expect(this.getPanel()).not.toBeVisible()
  }

  /**
   * Assert that the Extra Tools dropdown is visible.
   *
   * @example
   * ```typescript
   * await legendHelper.expectDropdownVisible()
   * ```
   */
  async expectDropdownVisible(): Promise<void> {
    await expect(this.getExtraToolsDropdown()).toBeVisible()
  }

  /**
   * Assert that the Extra Tools dropdown is NOT visible.
   *
   * @example
   * ```typescript
   * await legendHelper.expectDropdownNotVisible()
   * ```
   */
  async expectDropdownNotVisible(): Promise<void> {
    await expect(this.getExtraToolsDropdown()).not.toBeVisible()
  }

  /**
   * Assert that the Remove tab is active.
   *
   * @example
   * ```typescript
   * await legendHelper.expectRemoveTabActive()
   * ```
   */
  async expectRemoveTabActive(): Promise<void> {
    await expect(this.getRemoveTabInput()).toBeChecked()
  }

  /**
   * Assert that the Align tab is active.
   *
   * @example
   * ```typescript
   * await legendHelper.expectAlignTabActive()
   * ```
   */
  async expectAlignTabActive(): Promise<void> {
    await expect(this.getAlignTabInput()).toBeChecked()
  }

  /**
   * Assert that the Move tab is active.
   *
   * @example
   * ```typescript
   * await legendHelper.expectMoveTabActive()
   * ```
   */
  async expectMoveTabActive(): Promise<void> {
    await expect(this.getMoveTabInput()).toBeChecked()
  }

  /**
   * Assert that all category buttons are visible in Remove tab.
   *
   * @example
   * ```typescript
   * await legendHelper.expectAllCategoriesVisible()
   * ```
   */
  async expectAllCategoriesVisible(): Promise<void> {
    const categories: Array<
      'All' | 'Alphas' | 'Numbers' | 'Punctuation' | 'Function' | 'Specials' | 'Others' | 'Decals'
    > = ['All', 'Alphas', 'Numbers', 'Punctuation', 'Function', 'Specials', 'Others', 'Decals']

    for (const category of categories) {
      await expect(this.getCategoryButton(category)).toBeVisible()
    }
  }

  /**
   * Assert that the keycap preview is visible in Align tab.
   *
   * @example
   * ```typescript
   * await legendHelper.expectKeycapPreviewVisible()
   * ```
   */
  async expectKeycapPreviewVisible(): Promise<void> {
    await expect(this.getKeycapPreview()).toBeVisible()
  }

  /**
   * Assert the number of alignment buttons.
   *
   * @param count - Expected button count (default: 9)
   *
   * @example
   * ```typescript
   * await legendHelper.expectAlignmentButtonCount(9)
   * ```
   */
  async expectAlignmentButtonCount(count: number = 9): Promise<void> {
    await expect(this.getAlignmentButtons()).toHaveCount(count)
  }

  /**
   * Assert the number of keycap selectors in Move tab.
   *
   * @param count - Expected selector count (default: 2)
   *
   * @example
   * ```typescript
   * await legendHelper.expectKeycapSelectorCount(2)
   * ```
   */
  async expectKeycapSelectorCount(count: number = 2): Promise<void> {
    await expect(this.getKeycapSelectors()).toHaveCount(count)
  }

  /**
   * Assert that the move button is enabled.
   *
   * @example
   * ```typescript
   * await legendHelper.expectMoveButtonEnabled()
   * ```
   */
  async expectMoveButtonEnabled(): Promise<void> {
    await expect(this.getMoveButton()).toBeEnabled()
  }

  /**
   * Assert that the move button is disabled.
   *
   * @example
   * ```typescript
   * await legendHelper.expectMoveButtonDisabled()
   * ```
   */
  async expectMoveButtonDisabled(): Promise<void> {
    await expect(this.getMoveButton()).toBeDisabled()
  }

  /**
   * Assert that the status count contains specific text.
   *
   * @param text - Expected text (e.g., '0 key(s)', '5 key(s)')
   *
   * @example
   * ```typescript
   * await legendHelper.expectStatusCount('5 key(s) will be affected')
   * ```
   */
  async expectStatusCountText(text: string): Promise<void> {
    await expect(this.getStatusCount()).toContainText(text)
  }

  /**
   * Assert that the drag handle is visible.
   *
   * @example
   * ```typescript
   * await legendHelper.expectDragHandleVisible()
   * ```
   */
  async expectDragHandleVisible(): Promise<void> {
    await expect(this.getDragHandle()).toBeVisible()
  }
}
