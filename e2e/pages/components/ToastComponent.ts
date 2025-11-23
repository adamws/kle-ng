import { Locator, Page, expect } from '@playwright/test'
import { WaitHelpers } from '../../helpers/wait-helpers'

/**
 * ToastComponent - Toast notification interactions
 *
 * Encapsulates toast notification elements and assertions for success/error messages.
 *
 * @example
 * const toast = new ToastComponent(page, waitHelpers)
 * await toast.expectToastVisible('Import successful')
 * await toast.expectToastType('success')
 *
 * @example
 * // Working with specific toast in a stack
 * await toast.expectToastAtIndex(0, 'Toast 1')
 * await toast.close(0)
 *
 * @remarks
 * ⚠️ TECH DEBT: This component currently uses CSS class selectors (.toast-notification)
 * instead of data-testid attributes. These should be migrated to data-testid in the future.
 */
export class ToastComponent {
  private readonly toastContainer: Locator

  constructor(
    private readonly page: Page,
    private readonly waitHelpers: WaitHelpers,
  ) {
    this.toastContainer = page.locator('.toast-notification')
  }

  /**
   * Assert that a toast notification is visible with optional title check
   * @param title - Optional expected title text
   */
  async expectToastVisible(title?: string): Promise<void> {
    await expect(this.toastContainer.first()).toBeVisible()

    if (title) {
      const toastTitle = this.toastContainer.first().locator('.toast-title')
      await expect(toastTitle).toContainText(title)
    }
  }

  /**
   * Assert that a toast notification has the expected type
   * @param type - Toast type: 'success', 'error', 'warning', or 'info'
   */
  async expectToastType(type: 'success' | 'error' | 'warning' | 'info'): Promise<void> {
    await expect(this.toastContainer.first()).toHaveClass(new RegExp(`toast-${type}`))
  }

  /**
   * Assert that a toast notification contains specific message text
   * @param message - Expected message text
   */
  async expectToastMessage(message: string): Promise<void> {
    const toastText = this.toastContainer.first().locator('.toast-text')
    await expect(toastText).toContainText(message)
  }

  /**
   * Assert that a toast notification has specific title
   * @param title - Expected title text
   */
  async expectToastTitle(title: string): Promise<void> {
    const toastTitle = this.toastContainer.first().locator('.toast-title')
    await expect(toastTitle).toHaveText(title)
  }

  /**
   * Assert that a specific toast in a stack has the expected title
   * @param index - Index of the toast (0-based)
   * @param title - Expected title text
   */
  async expectToastAtIndex(index: number, title: string): Promise<void> {
    const toastTitle = this.toastContainer.nth(index).locator('.toast-title')
    await expect(toastTitle).toHaveText(title)
  }

  /**
   * Close a toast notification
   * @param index - Index of the toast to close (default: 0 for first toast)
   */
  async close(index: number = 0): Promise<void> {
    const closeButton = this.toastContainer.nth(index).locator('.toast-close, button.btn-close')
    await closeButton.click()
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  /**
   * Assert that no toast notifications are visible
   */
  async expectNoToast(): Promise<void> {
    await expect(this.toastContainer).toHaveCount(0)
  }

  /**
   * Assert that a specific number of toasts are visible
   * @param count - Expected number of toasts
   */
  async expectToastCount(count: number): Promise<void> {
    await expect(this.toastContainer).toHaveCount(count)
  }

  /**
   * Wait for a toast to appear
   * @param timeout - Maximum time to wait in milliseconds (default: 5000)
   */
  async waitForToast(timeout: number = 5000): Promise<void> {
    await expect(this.toastContainer.first()).toBeVisible({ timeout })
  }

  /**
   * Wait for a toast to disappear
   * @param index - Index of the toast (default: 0)
   * @param timeout - Maximum time to wait in milliseconds (default: 5000)
   */
  async waitForToastToDisappear(index: number = 0, timeout: number = 5000): Promise<void> {
    await expect(this.toastContainer.nth(index)).not.toBeVisible({ timeout })
  }

  /**
   * Wait for all toasts to disappear
   * @param timeout - Maximum time to wait in milliseconds (default: 10000)
   */
  async waitForAllToastsToDisappear(timeout: number = 10000): Promise<void> {
    await expect(this.toastContainer).toHaveCount(0, { timeout })
  }

  /**
   * Get the first toast notification locator
   */
  getFirstToast(): Locator {
    return this.toastContainer.first()
  }

  /**
   * Get a toast notification at a specific index
   * @param index - Index of the toast (0-based)
   */
  getToastAtIndex(index: number): Locator {
    return this.toastContainer.nth(index)
  }

  /**
   * Get all toast notification locators
   */
  getAllToasts(): Locator {
    return this.toastContainer
  }

  /**
   * Get the count of currently visible toasts
   * @returns Number of visible toast notifications
   */
  async getToastCount(): Promise<number> {
    return await this.toastContainer.count()
  }
}
