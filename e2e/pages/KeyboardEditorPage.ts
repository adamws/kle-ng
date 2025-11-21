import { Locator, Page, expect } from '@playwright/test'
import { BasePage } from './BasePage'
import { ToolbarComponent } from './components/ToolbarComponent'
import { CanvasComponent } from './components/CanvasComponent'
import { SELECTORS } from '../constants/selectors'

/**
 * KeyboardEditorPage - Main page object for the keyboard editor
 *
 * This is the primary page object for testing the keyboard editor.
 * It composes various components (toolbar, canvas, etc.) and provides
 * high-level methods for common operations.
 *
 * @example
 * test('add a key', async ({ page }) => {
 *   const editor = new KeyboardEditorPage(page)
 *   await editor.goto()
 *   await editor.toolbar.addKey()
 *   await editor.expectKeyCount(1)
 * })
 */
export class KeyboardEditorPage extends BasePage {
  readonly toolbar: ToolbarComponent
  readonly canvas: CanvasComponent

  private readonly keysCounter: Locator
  private readonly selectedCounter: Locator
  private readonly unsavedIndicator: Locator

  constructor(page: Page) {
    super(page)
    this.toolbar = new ToolbarComponent(page)
    this.canvas = new CanvasComponent(page)

    // Initialize locators for counters and indicators
    this.keysCounter = page.locator(SELECTORS.COUNTERS.KEYS)
    this.selectedCounter = page.locator(SELECTORS.COUNTERS.SELECTED)
    this.unsavedIndicator = page.locator(SELECTORS.MISC.UNSAVED_INDICATOR)
  }

  /**
   * Navigate to the keyboard editor (root page)
   */
  async goto() {
    await super.goto('/')
  }

  /**
   * Get the current number of keys
   * @returns The number of keys as displayed in the UI
   */
  async getKeyCount(): Promise<number> {
    const text = await this.keysCounter.textContent()
    const match = text?.match(/Keys: (\d+)/)
    return match ? parseInt(match[1]) : 0
  }

  /**
   * Get the current number of selected keys
   * @returns The number of selected keys as displayed in the UI
   */
  async getSelectedCount(): Promise<number> {
    const text = await this.selectedCounter.textContent()
    const match = text?.match(/Selected: (\d+)/)
    return match ? parseInt(match[1]) : 0
  }

  /**
   * Assert that the key counter shows the expected count
   * @param count - Expected number of keys
   */
  async expectKeyCount(count: number) {
    await expect(this.keysCounter).toContainText(`Keys: ${count}`)
  }

  /**
   * Assert that the selected counter shows the expected count
   * @param count - Expected number of selected keys
   */
  async expectSelectedCount(count: number) {
    await expect(this.selectedCounter).toContainText(`Selected: ${count}`)
  }

  /**
   * Check if there are unsaved changes
   * @returns true if the unsaved changes indicator is visible
   */
  async hasUnsavedChanges(): Promise<boolean> {
    return await this.unsavedIndicator.isVisible()
  }

  /**
   * Assert that there are unsaved changes
   */
  async expectUnsavedChanges() {
    await expect(this.unsavedIndicator).toBeVisible()
  }

  /**
   * Assert that there are no unsaved changes
   */
  async expectNoUnsavedChanges() {
    await expect(this.unsavedIndicator).toBeHidden()
  }

  /**
   * Assert that the key counter is visible
   */
  async expectCountersVisible() {
    await expect(this.keysCounter).toBeVisible()
    await expect(this.selectedCounter).toBeVisible()
  }
}
