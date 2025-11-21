import { Page, Locator, expect } from '@playwright/test'

/**
 * WaitHelpers provides deterministic wait strategies to replace hard timeouts
 *
 * Usage:
 * ```typescript
 * const waitHelpers = new WaitHelpers(page)
 * await waitHelpers.waitForCanvasReady(canvasLocator)
 * ```
 */
export class WaitHelpers {
  constructor(private readonly page: Page) {}

  /**
   * Wait for a state change by polling a function
   * More reliable than waitForTimeout()
   *
   * @param fn - Function that returns the current state
   * @param expectedValue - The expected state value
   * @param options - Timeout and error message options
   *
   * @example
   * await waitHelpers.waitForStateChange(
   *   async () => await getKeyCount(),
   *   5,
   *   { timeout: 5000, message: 'Key count did not reach 5' }
   * )
   */
  async waitForStateChange<T>(
    fn: () => Promise<T>,
    expectedValue: T,
    options: { timeout?: number; message?: string } = {},
  ) {
    const { timeout = 5000, message = 'State did not change to expected value' } = options

    await expect.poll(async () => await fn(), { timeout, message }).toBe(expectedValue)
  }

  /**
   * Wait for canvas to be ready for interaction
   * Replaces: waitForRender() + waitForTimeout()
   *
   * This ensures:
   * 1. Canvas is visible in the DOM
   * 2. Canvas is attached and stable
   * 3. Rendering cycle (RAF) has completed
   *
   * @param canvasLocator - The canvas element locator
   *
   * @example
   * const canvas = page.locator('.keyboard-canvas')
   * await waitHelpers.waitForCanvasReady(canvas)
   */
  async waitForCanvasReady(canvasLocator: Locator) {
    // Wait for canvas to be visible and attached
    await expect(canvasLocator).toBeVisible()
    await canvasLocator.waitFor({ state: 'attached' })

    // Wait for requestAnimationFrame to complete
    // This ensures the renderScheduler has processed pending render callbacks
    await this.page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          // Wait one more frame to ensure render is complete
          requestAnimationFrame(() => {
            resolve()
          })
        })
      })
    })
  }

  /**
   * Wait for network to be idle AND all images to be loaded
   * Replaces: waitForLoadState('networkidle') + waitForTimeout()
   *
   * This is critical for tests with image labels, as images
   * may continue loading after network becomes idle.
   *
   * @example
   * await helper.setKeyLabel('center', '<img src="...">')
   * await waitHelpers.waitForImagesLoaded()
   */
  async waitForImagesLoaded() {
    // First wait for network to be idle
    await this.page.waitForLoadState('networkidle')

    // Then ensure all images are actually loaded
    await this.page.evaluate(() => {
      const images = Array.from(document.images)
      return Promise.all(
        images
          .filter((img) => !img.complete)
          .map(
            (img) =>
              new Promise((resolve) => {
                img.onload = img.onerror = resolve
              }),
          ),
      )
    })
  }

  /**
   * Wait for element to be in expected state
   * More explicit than generic waitForTimeout()
   *
   * @param locator - The element to wait for
   * @param state - Expected state: 'visible', 'hidden', or 'stable'
   *
   * @example
   * // Wait for modal to appear
   * await waitHelpers.waitForElementState(modal, 'visible')
   *
   * // Wait for element to stop moving (for drag operations)
   * await waitHelpers.waitForElementState(draggable, 'stable')
   */
  async waitForElementState(locator: Locator, state: 'visible' | 'hidden' | 'stable') {
    switch (state) {
      case 'visible':
        await expect(locator).toBeVisible()
        break

      case 'hidden':
        await expect(locator).toBeHidden()
        break

      case 'stable': {
        // Wait for element to stop moving/changing
        await locator.waitFor({ state: 'visible' })

        // Take two bounding box measurements
        const box1 = await locator.boundingBox()
        await this.page.waitForTimeout(100) // Small timeout to detect movement
        const box2 = await locator.boundingBox()

        // Verify element hasn't moved
        if (JSON.stringify(box1) !== JSON.stringify(box2)) {
          throw new Error(
            `Element is not stable. Position changed from ${JSON.stringify(box1)} to ${JSON.stringify(box2)}`,
          )
        }
        break
      }
    }
  }

  /**
   * Wait for a modal to be fully interactive
   * Modals often need time after appearing to become interactive
   *
   * @param modalLocator - The modal container locator
   * @param contentLocator - Optional specific content to wait for
   *
   * @example
   * const modal = page.locator('.rotation-panel')
   * const content = page.locator('.rotation-info')
   * await waitHelpers.waitForModalReady(modal, content)
   */
  async waitForModalReady(modalLocator: Locator, contentLocator?: Locator) {
    // Wait for modal to be visible
    await expect(modalLocator).toBeVisible()

    // If specific content is provided, wait for it too
    if (contentLocator) {
      await expect(contentLocator).toBeVisible()
    }

    // Ensure modal is attached and interactive
    await modalLocator.waitFor({ state: 'attached' })
  }

  /**
   * Wait for a dropdown to be fully open and interactive
   *
   * @param dropdownLocator - The dropdown menu locator
   *
   * @example
   * await button.click()
   * await waitHelpers.waitForDropdownOpen(dropdown)
   */
  async waitForDropdownOpen(dropdownLocator: Locator) {
    await expect(dropdownLocator).toBeVisible()
    await dropdownLocator.waitFor({ state: 'attached' })
  }

  /**
   * Wait for text content to change to expected value
   * Useful for counter updates, status changes, etc.
   *
   * @param locator - The element containing the text
   * @param expectedText - The expected text (string or regex)
   * @param options - Timeout options
   *
   * @example
   * await helper.addKey()
   * await waitHelpers.waitForTextChange(
   *   page.locator('.keys-counter'),
   *   'Keys: 1'
   * )
   */
  async waitForTextChange(
    locator: Locator,
    expectedText: string | RegExp,
    options: { timeout?: number } = {},
  ) {
    await expect(locator).toContainText(expectedText, options)
  }
}
