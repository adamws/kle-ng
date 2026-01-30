import { Page, Locator, expect } from '@playwright/test'
import { WaitHelpers } from './wait-helpers'

/**
 * Helper class for GitHub Star Popup interactions in E2E tests.
 *
 * Provides reusable methods for:
 * - Popup element locators
 * - Showing/hiding popup
 * - Popup state assertions
 * - LocalStorage state management
 *
 * @example
 * ```typescript
 * const popupHelper = new GitHubStarPopupHelper(page, waitHelpers)
 * await popupHelper.showPopupAfterDelay(120000)
 * await popupHelper.expectPopupVisible()
 * await popupHelper.closePopup()
 * ```
 */
export class GitHubStarPopupHelper {
  constructor(
    private page: Page,
    private waitHelpers: WaitHelpers,
  ) {}

  // ============================================================================
  // Locator Getters
  // ============================================================================

  /**
   * Get the GitHub star popup container locator.
   */
  getPopup(): Locator {
    return this.page.locator('.github-star-popup')
  }

  /**
   * Get the close button locator.
   */
  getCloseButton(): Locator {
    return this.page.locator('.close-btn')
  }

  /**
   * Get the star button (GitHub link) locator.
   */
  getStarButton(): Locator {
    return this.page.locator('.star-button')
  }

  /**
   * Get the popup title locator.
   */
  getPopupTitle(): Locator {
    return this.page.locator('.popup-title')
  }

  /**
   * Get the popup text locator.
   */
  getPopupText(): Locator {
    return this.page.locator('.popup-text')
  }

  /**
   * Get the close button icon locator.
   */
  getCloseIcon(): Locator {
    return this.page.locator('.close-btn')
  }

  /**
   * Get the GitHub icon in star button locator.
   */
  getGitHubIcon(): Locator {
    return this.page.locator('.star-button')
  }

  // ============================================================================
  // Setup and State Management
  // ============================================================================

  /**
   * Initialize the page for popup testing.
   * Clears localStorage and sets the E2E test flag.
   *
   * @example
   * ```typescript
   * await popupHelper.initializeForTesting()
   * ```
   */
  async initializeForTesting(): Promise<void> {
    await this.page.evaluate(() => {
      localStorage.clear()
      // Set flag to allow popup to show in E2E tests
      ;(window as typeof window & { __ALLOW_POPUP_IN_E2E__?: boolean }).__ALLOW_POPUP_IN_E2E__ =
        true
    })
  }

  /**
   * Simulate a first visit at a specific time in the past.
   *
   * @param millisecondsAgo - Time in milliseconds ago when first visit occurred
   *
   * @example
   * ```typescript
   * await popupHelper.simulateFirstVisit(120000) // 2 minutes ago
   * ```
   */
  async simulateFirstVisit(millisecondsAgo: number): Promise<void> {
    const timeAgo = Date.now() - millisecondsAgo
    await this.page.evaluate((time) => {
      localStorage.setItem('kle-ng-first-visit-time', time.toString())
    }, timeAgo)
  }

  /**
   * Set the popup dismissed flag in localStorage.
   *
   * @example
   * ```typescript
   * await popupHelper.setDismissedFlag()
   * ```
   */
  async setDismissedFlag(): Promise<void> {
    await this.page.evaluate(() => {
      localStorage.setItem('kle-ng-github-star-popup-dismissed', 'true')
    })
  }

  /**
   * Get the popup dismissed state from localStorage.
   *
   * @returns The dismissed state ('true' or null)
   *
   * @example
   * ```typescript
   * const dismissed = await popupHelper.getDismissedState()
   * ```
   */
  async getDismissedState(): Promise<string | null> {
    return await this.page.evaluate(() => {
      return localStorage.getItem('kle-ng-github-star-popup-dismissed')
    })
  }

  // ============================================================================
  // Popup Display Methods
  // ============================================================================

  /**
   * Show the popup by simulating a first visit delay and reloading.
   *
   * @param millisecondsAgo - Time in milliseconds ago (default: 120000 = 2 minutes)
   *
   * @example
   * ```typescript
   * await popupHelper.showPopupAfterDelay(120000)
   * ```
   */
  async showPopupAfterDelay(millisecondsAgo: number = 120000): Promise<void> {
    await this.simulateFirstVisit(millisecondsAgo)
    await this.page.reload()
    await this.page.waitForLoadState('networkidle')
  }

  // ============================================================================
  // Popup Interaction Methods
  // ============================================================================

  /**
   * Close the popup by clicking the close button.
   *
   * @example
   * ```typescript
   * await popupHelper.closePopup()
   * ```
   */
  async closePopup(): Promise<void> {
    await this.getCloseButton().click()
  }

  /**
   * Click the star button and handle the new page that opens.
   * Returns the new page that was opened.
   *
   * @returns Promise resolving to the new page
   *
   * @example
   * ```typescript
   * const newPage = await popupHelper.clickStarButton()
   * await newPage.close()
   * ```
   */
  async clickStarButton(): Promise<Page> {
    const [newPage] = await Promise.all([
      this.page.context().waitForEvent('page'),
      this.getStarButton().click(),
    ])
    return newPage
  }

  // ============================================================================
  // Assertion Helpers
  // ============================================================================

  /**
   * Assert that the popup is visible.
   *
   * @param timeout - Optional timeout in milliseconds (default: 5000)
   *
   * @example
   * ```typescript
   * await popupHelper.expectPopupVisible()
   * ```
   */
  async expectPopupVisible(timeout: number = 5000): Promise<void> {
    await expect(this.getPopup()).toBeVisible({ timeout })
  }

  /**
   * Assert that the popup is NOT visible.
   *
   * @example
   * ```typescript
   * await popupHelper.expectPopupNotVisible()
   * ```
   */
  async expectPopupNotVisible(): Promise<void> {
    await expect(this.getPopup()).not.toBeVisible()
  }

  /**
   * Assert that the popup is NOT visible after waiting for animations to complete.
   * Uses RAF waits instead of hard timeout for deterministic waiting.
   *
   * @example
   * ```typescript
   * await popupHelper.expectPopupNotVisibleAfterWait()
   * ```
   */
  async expectPopupNotVisibleAfterWait(): Promise<void> {
    // Wait for any potential animations or delayed rendering
    await this.waitHelpers.waitForQuadAnimationFrame()
    await expect(this.getPopup()).not.toBeVisible()
  }

  /**
   * Assert that the popup has correct GitHub link attributes.
   *
   * @example
   * ```typescript
   * await popupHelper.expectCorrectGitHubLink()
   * ```
   */
  async expectCorrectGitHubLink(): Promise<void> {
    const starButton = this.getStarButton()
    await expect(starButton).toHaveAttribute('href', 'https://github.com/adamws/kle-ng')
    await expect(starButton).toHaveAttribute('target', '_blank')
    await expect(starButton).toHaveAttribute('rel', 'noopener noreferrer')
  }

  /**
   * Assert that the popup contains expected content.
   *
   * @example
   * ```typescript
   * await popupHelper.expectPopupContent()
   * ```
   */
  async expectPopupContent(): Promise<void> {
    await expect(this.getPopupTitle()).toContainText('Enjoying KLE-NG?')
    await expect(this.getPopupText()).toContainText('star')
    await expect(this.getStarButton()).toContainText('Star on GitHub')
  }

  /**
   * Assert that the popup dismissed state is stored in localStorage.
   *
   * @example
   * ```typescript
   * await popupHelper.expectDismissedStateStored()
   * ```
   */
  async expectDismissedStateStored(): Promise<void> {
    const dismissedState = await this.getDismissedState()
    expect(dismissedState).toBe('true')
  }
}
