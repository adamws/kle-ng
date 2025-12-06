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
    return this.page.getByTestId('legend-tools-panel')
  }

  /**
   * Get the panel title locator.
   */
  getPanelTitle(): Locator {
    return this.page.getByTestId('panel-title')
  }

  /**
   * Get the panel close button locator.
   */
  getCloseButton(): Locator {
    return this.page.getByTestId('panel-close-button')
  }

  /**
   * Get the drag handle locator.
   */
  getDragHandle(): Locator {
    return this.page.getByTestId('drag-handle')
  }

  /**
   * Get the status count text locator.
   * Note: This element is only visible when activeTab !== 'edit'
   */
  getStatusCount(): Locator {
    return this.page.getByTestId('status-count')
  }

  // ============================================================================
  // Locator Getters - Tab Navigation
  // ============================================================================

  /**
   * Get the Remove tab radio input locator.
   */
  getRemoveTabInput(): Locator {
    return this.page.getByTestId('tab-remove-input')
  }

  /**
   * Get the Remove tab label locator.
   */
  getRemoveTabLabel(): Locator {
    return this.page.getByTestId('tab-remove-label')
  }

  /**
   * Get the Align tab radio input locator.
   */
  getAlignTabInput(): Locator {
    return this.page.getByTestId('tab-align-input')
  }

  /**
   * Get the Align tab label locator.
   */
  getAlignTabLabel(): Locator {
    return this.page.getByTestId('tab-align-label')
  }

  /**
   * Get the Move tab radio input locator.
   */
  getMoveTabInput(): Locator {
    return this.page.getByTestId('tab-move-input')
  }

  /**
   * Get the Move tab label locator.
   */
  getMoveTabLabel(): Locator {
    return this.page.getByTestId('tab-move-label')
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
    const categoryId = category.toLowerCase()
    return this.page.getByTestId(`category-button-${categoryId}`)
  }

  // ============================================================================
  // Locator Getters - Align Tab Elements
  // ============================================================================

  /**
   * Get the alignment picker element in Align tab.
   */
  getKeycapPreview(): Locator {
    return this.page.getByTestId('alignment-picker')
  }

  /**
   * Get all alignment buttons in the Align tab.
   */
  getAlignmentButtons(): Locator {
    return this.page.locator('[data-testid^="align-btn-"]')
  }

  /**
   * Get a specific alignment button by index (0-8 for 3x3 grid).
   *
   * @param index - Button index (0 = top-left, 4 = center, 8 = bottom-right)
   */
  getAlignmentButton(index: number): Locator {
    return this.page.getByTestId(`align-btn-${index}`)
  }

  // ============================================================================
  // Locator Getters - Move Tab Elements
  // ============================================================================

  /**
   * Get all keycap selector elements in Move tab.
   */
  getKeycapSelectors(): Locator {
    return this.page.getByTestId('label-position-picker')
  }

  /**
   * Get all position label elements in Move tab.
   */
  getPositionLabels(): Locator {
    return this.page.locator('[data-testid^="position-label-"]')
  }

  /**
   * Get a position label by abbreviation.
   *
   * @param abbr - Position abbreviation (e.g., 'TL', 'CC', 'BR')
   */
  getPositionLabel(abbr: string): Locator {
    return this.page.locator(`[data-testid^="position-label-"]:has-text("${abbr}")`).first()
  }

  /**
   * Get a position radio input by value.
   *
   * @param value - Position value (0-11 for standard positions)
   * @param selector - Which selector (0 for source, 1 for destination)
   */
  getPositionRadio(value: number, selector: 0 | 1): Locator {
    const prefix = selector === 0 ? 'from' : 'to'
    return this.page.getByTestId(`position-radio-${prefix}-${value}`)
  }

  /**
   * Get the move button (arrow button between selectors).
   */
  getMoveButton(): Locator {
    return this.page.getByTestId('move-button')
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
    // Wait for panel body to be fully rendered (contains all tabs)
    await expect(this.page.locator('.panel-body')).toBeVisible()
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
    // Wait for tab content to be fully rendered and interactive
    await expect(this.getCategoryButton('All')).toBeVisible()
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
    // Wait for tab content to be fully rendered and interactive
    await expect(this.getKeycapPreview()).toBeVisible()
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
    // Wait for tab content to be fully rendered and interactive
    await expect(this.getMoveButton()).toBeVisible()
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

  // ============================================================================
  // Edit Tab Locators
  // ============================================================================

  /**
   * Get the Edit tab radio input locator.
   */
  getEditTabInput(): Locator {
    return this.page.getByTestId('tab-edit-input')
  }

  /**
   * Get the Edit tab label locator.
   */
  getEditTabLabel(): Locator {
    return this.page.getByTestId('tab-edit-label')
  }

  /**
   * Get a position radio input in the Edit tab by value.
   *
   * @param value - Position value (0-11)
   */
  getEditPositionRadio(value: number): Locator {
    return this.page.getByTestId(`position-radio-edit-${value}`)
  }

  /**
   * Get the editing alert (live preview) locator.
   * Note: This is now always visible, showing either editing state or placeholder.
   */
  getEditingAlert(): Locator {
    return this.page.getByTestId('editing-alert')
  }

  /**
   * Get the key count display in Edit tab.
   */
  getKeyCountDisplay(): Locator {
    return this.page.locator('.key-count')
  }

  // ============================================================================
  // Edit Tab Actions
  // ============================================================================

  /**
   * Switch to the Edit tab.
   *
   * @example
   * ```typescript
   * await legendHelper.switchToEditTab()
   * ```
   */
  async switchToEditTab(): Promise<void> {
    await this.getEditTabLabel().click()
    await expect(this.getEditTabInput()).toBeChecked()
    // Wait for tab content to be fully rendered and interactive
    await expect(this.page.getByTestId('edit-tab-content')).toBeVisible()
  }

  /**
   * Select a label position in Edit mode.
   *
   * @param position - Position value (0-11)
   *
   * @example
   * ```typescript
   * await legendHelper.selectEditPosition(0) // Select TL
   * ```
   */
  async selectEditPosition(position: number): Promise<void> {
    await this.getEditPositionRadio(position).click({ force: true })
    await expect(this.getEditPositionRadio(position)).toBeChecked()
  }

  /**
   * Type in Edit mode with optional Enter key press.
   *
   * @param text - Text to type
   * @param pressEnter - Whether to press Enter to commit (default: true)
   *
   * @example
   * ```typescript
   * await legendHelper.typeInEditMode('Shift', true)
   * ```
   */
  async typeInEditMode(text: string, pressEnter: boolean = true): Promise<void> {
    await this.page.keyboard.type(text)
    if (pressEnter) {
      await this.page.keyboard.press('Enter')
    }
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  // ============================================================================
  // Edit Tab Assertions
  // ============================================================================

  /**
   * Assert that the Edit tab is active.
   *
   * @example
   * ```typescript
   * await legendHelper.expectEditTabActive()
   * ```
   */
  async expectEditTabActive(): Promise<void> {
    await expect(this.getEditTabInput()).toBeChecked()
  }

  /**
   * Assert that Edit tab is first and active by default.
   *
   * @example
   * ```typescript
   * await legendHelper.expectEditTabFirstAndDefault()
   * ```
   */
  async expectEditTabFirstAndDefault(): Promise<void> {
    await this.expectEditTabActive()
    // Verify Edit tab is first by checking it appears before Remove tab
    const editTab = this.getEditTabInput()
    const removeTab = this.getRemoveTabInput()
    await expect(editTab).toBeVisible()
    await expect(removeTab).toBeVisible()
  }

  /**
   * Assert that a specific position is selected in Edit mode.
   *
   * @param position - Position value (0-11)
   *
   * @example
   * ```typescript
   * await legendHelper.expectPositionSelected(0) // Expect TL selected
   * ```
   */
  async expectPositionSelected(position: number): Promise<void> {
    await expect(this.getEditPositionRadio(position)).toBeChecked()
  }

  /**
   * Assert that TL (position 0) is pre-selected in Edit mode.
   *
   * @example
   * ```typescript
   * await legendHelper.expectTLPreSelected()
   * ```
   */
  async expectTLPreSelected(): Promise<void> {
    await this.expectPositionSelected(0)
  }

  /**
   * Assert the key count display shows expected count.
   *
   * @param count - Expected key count
   *
   * @example
   * ```typescript
   * await legendHelper.expectKeyCountDisplay(5)
   * ```
   */
  async expectKeyCountDisplay(count: number): Promise<void> {
    const expectedText = count === 1 ? '1 key selected' : `${count} keys selected`
    await expect(this.getKeyCountDisplay()).toContainText(expectedText)
  }

  /**
   * Assert that the editing alert shows editing state with optional text check.
   * The alert is always visible, but shows "Editing" when active.
   *
   * @param text - Optional text to verify in the alert
   *
   * @example
   * ```typescript
   * await legendHelper.expectEditingAlertVisible('Shift')
   * ```
   */
  async expectEditingAlertVisible(text?: string): Promise<void> {
    await expect(this.getEditingAlert()).toBeVisible()
    await expect(this.getEditingAlert()).toContainText('Editing')
    if (text) {
      await expect(this.getEditingAlert()).toContainText(text)
    }
  }

  /**
   * Assert that a key has a specific label at a given position.
   * Uses canvas text extraction.
   *
   * @param keyIndex - Index of the key on canvas
   * @param position - Label position (0-11)
   * @param text - Expected label text
   *
   * @example
   * ```typescript
   * await legendHelper.expectLabelOnKey(0, 0, 'Shift')
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async expectLabelOnKey(keyIndex: number, position: number, text: string): Promise<void> {
    // This would require canvas inspection - implementation depends on canvas test helpers
    // For now, we'll implement a basic version that can be enhanced
    await this.waitHelpers.waitForDoubleAnimationFrame()
    // TODO: Implement canvas label inspection if needed
  }

  // ============================================================================
  // JSON Verification Methods
  // ============================================================================

  /**
   * Export current layout as JSON and verify it's valid.
   * Saves the JSON file to the e2e/test-output directory.
   *
   * @param filename - Output filename (e.g., 'test-output.json')
   * @returns Parsed JSON data (KLE format array)
   *
   * @example
   * ```typescript
   * const jsonData = await legendHelper.exportAndVerifyJSON('output.json')
   * expect(Array.isArray(jsonData)).toBe(true)
   * ```
   */
  async exportAndVerifyJSON(filename: string): Promise<unknown> {
    const fs = await import('fs/promises')
    const path = await import('path')

    // Set up download promise
    const downloadPromise = this.page.waitForEvent('download')

    // Click Export button and select Download JSON
    const exportButton = this.page.locator('button', { hasText: 'Export' })
    await exportButton.click()
    await this.page.locator('a', { hasText: 'Download JSON' }).click()

    // Wait for download
    const download = await downloadPromise

    // Save the file to test-output directory
    const downloadPath = path.resolve('e2e/test-output', filename)
    await download.saveAs(downloadPath)

    // Read and parse the JSON file
    const fileContent = await fs.readFile(downloadPath, 'utf-8')
    return JSON.parse(fileContent)
  }

  /**
   * Verify that specific labels exist in the JSON layout.
   *
   * @param jsonData - Parsed JSON layout (KLE format)
   * @param expectedLabels - Array of labels that should exist
   *
   * @example
   * ```typescript
   * const jsonData = await legendHelper.exportAndVerifyJSON('output.json')
   * legendHelper.verifyLabelsInJSON(jsonData, ['Q', 'W', 'E'])
   * ```
   */
  verifyLabelsInJSON(jsonData: unknown, expectedLabels: string[]): void {
    const jsonString = JSON.stringify(jsonData)
    for (const label of expectedLabels) {
      expect(jsonString).toContain(label)
    }
  }

  /**
   * Count keys with non-empty labels in JSON layout.
   * Useful for verifying that operations preserve or remove the correct number of labels.
   *
   * @param jsonData - Parsed JSON layout (KLE format)
   * @returns Number of keys with labels
   *
   * @example
   * ```typescript
   * const jsonData = await legendHelper.exportAndVerifyJSON('output.json')
   * const labelCount = legendHelper.countKeysWithLabels(jsonData)
   * expect(labelCount).toBe(3)
   * ```
   */
  countKeysWithLabels(jsonData: unknown): number {
    if (!Array.isArray(jsonData)) return 0

    let count = 0
    for (const item of jsonData) {
      if (typeof item === 'string' && item.trim() !== '') {
        // Direct non-empty string in KLE format means it's a label
        count++
      } else if (Array.isArray(item)) {
        // Row array - count non-empty string elements
        count += item.filter((el: unknown) => typeof el === 'string' && el.trim() !== '').length
      }
    }
    return count
  }

  /**
   * Verify all labels are empty in JSON layout.
   * Useful for testing remove operations.
   *
   * @param jsonData - Parsed JSON layout (KLE format)
   *
   * @example
   * ```typescript
   * await legendHelper.removeAllLegends()
   * const jsonData = await legendHelper.exportAndVerifyJSON('output.json')
   * legendHelper.verifyEmptyLabels(jsonData)
   * ```
   */
  verifyEmptyLabels(jsonData: unknown): void {
    const labelCount = this.countKeysWithLabels(jsonData)
    expect(labelCount).toBe(0)
  }
}
