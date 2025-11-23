import { Page, Locator, expect } from '@playwright/test'
import { WaitHelpers } from './wait-helpers'

/**
 * Helper class for canvas toolbar interactions in E2E tests.
 *
 * Provides reusable methods for:
 * - Tool selection (Selection Mode, Mirror tools)
 * - Move step control
 * - Toolbar state assertions
 *
 * @example
 * ```typescript
 * const toolbarHelper = new CanvasToolbarHelper(page, waitHelpers)
 * await toolbarHelper.selectSelectionMode()
 * await toolbarHelper.selectMirrorHorizontal()
 * ```
 */
export class CanvasToolbarHelper {
  constructor(
    private page: Page,
    private waitHelpers: WaitHelpers,
  ) {}

  // ============================================================================
  // Locator Getters
  // ============================================================================

  /**
   * Get the Selection Mode button locator.
   */
  getSelectionButton(): Locator {
    return this.page.locator(
      'button[title="Selection Mode - Left click to select, middle drag to move"]',
    )
  }

  /**
   * Get the Mirror Vertical button locator (main mirror button).
   */
  getMirrorButton(): Locator {
    return this.page.getByTestId('toolbar-mirror-vertical')
  }

  /**
   * Get the mirror dropdown button locator.
   */
  getMirrorDropdownButton(): Locator {
    return this.page.locator('.mirror-group .dropdown-btn')
  }

  /**
   * Get the move step input control locator.
   */
  getMoveStepInput(): Locator {
    return this.page.locator('.move-step-control input[type="number"]')
  }

  /**
   * Get the canvas toolbar locator.
   */
  getCanvasToolbar(): Locator {
    return this.page.locator('.canvas-toolbar')
  }

  // ============================================================================
  // Tool Selection Methods
  // ============================================================================

  /**
   * Select the Selection Mode tool.
   *
   * @example
   * ```typescript
   * await toolbarHelper.selectSelectionMode()
   * ```
   */
  async selectSelectionMode(): Promise<void> {
    await this.getSelectionButton().click()
    await expect(this.getSelectionButton()).toHaveClass(/active/)
  }

  /**
   * Select the Mirror Vertical tool.
   *
   * @example
   * ```typescript
   * await toolbarHelper.selectMirrorVertical()
   * ```
   */
  async selectMirrorVertical(): Promise<void> {
    await this.getMirrorButton().click()
    await expect(this.getMirrorButton()).toHaveClass(/active/)
  }

  /**
   * Select the Mirror Horizontal tool from the dropdown.
   *
   * @example
   * ```typescript
   * await toolbarHelper.selectMirrorHorizontal()
   * ```
   */
  async selectMirrorHorizontal(): Promise<void> {
    await this.getMirrorDropdownButton().click()
    await this.page
      .locator('.mirror-dropdown .dropdown-item')
      .filter({ hasText: 'Mirror Horizontal' })
      .click()
    await expect(this.getMirrorButton()).toHaveClass(/active/)
  }

  // ============================================================================
  // Move Step Control Methods
  // ============================================================================

  /**
   * Set the move step value.
   *
   * @param value - The move step value (e.g., 0.5, 1.0)
   *
   * @example
   * ```typescript
   * await toolbarHelper.setMoveStep(0.5)
   * ```
   */
  async setMoveStep(value: number | string): Promise<void> {
    const stepInput = this.getMoveStepInput()
    await stepInput.fill(value.toString())
    await stepInput.blur()
  }

  /**
   * Get the current move step value.
   *
   * @returns The current move step value as a string
   *
   * @example
   * ```typescript
   * const step = await toolbarHelper.getMoveStep()
   * ```
   */
  async getMoveStep(): Promise<string> {
    return await this.getMoveStepInput().inputValue()
  }

  // ============================================================================
  // Assertion Helpers
  // ============================================================================

  /**
   * Assert that the canvas toolbar is visible.
   *
   * @example
   * ```typescript
   * await toolbarHelper.expectToolbarVisible()
   * ```
   */
  async expectToolbarVisible(): Promise<void> {
    await expect(this.getCanvasToolbar()).toBeVisible()
  }

  /**
   * Assert that Selection Mode is active.
   *
   * @example
   * ```typescript
   * await toolbarHelper.expectSelectionModeActive()
   * ```
   */
  async expectSelectionModeActive(): Promise<void> {
    await expect(this.getSelectionButton()).toHaveClass(/active/)
  }

  /**
   * Assert that Selection Mode is NOT active.
   *
   * @example
   * ```typescript
   * await toolbarHelper.expectSelectionModeInactive()
   * ```
   */
  async expectSelectionModeInactive(): Promise<void> {
    await expect(this.getSelectionButton()).not.toHaveClass(/active/)
  }

  /**
   * Assert that Mirror tool is active.
   *
   * @example
   * ```typescript
   * await toolbarHelper.expectMirrorModeActive()
   * ```
   */
  async expectMirrorModeActive(): Promise<void> {
    await expect(this.getMirrorButton()).toHaveClass(/active/)
  }

  /**
   * Assert that Mirror tool is NOT active.
   *
   * @example
   * ```typescript
   * await toolbarHelper.expectMirrorModeInactive()
   * ```
   */
  async expectMirrorModeInactive(): Promise<void> {
    await expect(this.getMirrorButton()).not.toHaveClass(/active/)
  }

  /**
   * Assert the move step has a specific value.
   *
   * Accepts both exact values and regex patterns for normalized values
   * (e.g., browsers may show "1" instead of "1.0").
   *
   * @param value - Expected value (string or RegExp)
   *
   * @example
   * ```typescript
   * await toolbarHelper.expectMoveStep('0.5')
   * await toolbarHelper.expectMoveStep(/^1(\.0)?$/)  // Matches "1" or "1.0"
   * ```
   */
  async expectMoveStep(value: string | RegExp): Promise<void> {
    if (typeof value === 'string') {
      await expect(this.getMoveStepInput()).toHaveValue(value)
    } else {
      const actualValue = await this.getMoveStepInput().inputValue()
      expect(actualValue).toMatch(value)
    }
  }

  // ============================================================================
  // Complex Interaction Helpers
  // ============================================================================

  /**
   * Clear selection by clicking an empty area of the canvas.
   *
   * Uses RAF waits instead of hard timeout to ensure selection clears properly.
   *
   * @param canvas - The canvas locator
   *
   * @example
   * ```typescript
   * const canvas = canvasHelper.getCanvas()
   * await toolbarHelper.clearSelectionByCanvasClick(canvas)
   * ```
   */
  async clearSelectionByCanvasClick(canvas: Locator): Promise<void> {
    // Click empty area to clear selection
    await canvas.click({ position: { x: 10, y: 10 } })

    // Wait for selection to clear using RAF instead of hard timeout
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }
}
