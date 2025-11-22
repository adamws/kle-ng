import { expect as baseExpect, Page } from '@playwright/test'
import { SELECTORS } from '../constants/selectors'

/**
 * Custom Playwright matchers for kle-ng e2e tests
 *
 * These matchers provide more readable and reusable assertions
 * for common test scenarios.
 *
 * @example
 * import { expect } from './helpers/custom-matchers'
 *
 * await expect(page).toHaveKeyCount(5)
 * await expect(page).toHaveSelectedCount(2)
 */

// Extend Playwright's expect with custom matchers
export const expect = baseExpect.extend({
  /**
   * Assert that the page has the expected number of keys
   *
   * @param page - Playwright Page object
   * @param expectedCount - Expected number of keys
   *
   * @example
   * await expect(page).toHaveKeyCount(5)
   */
  async toHaveKeyCount(page: Page, expectedCount: number) {
    const locator = page.locator(SELECTORS.COUNTERS.KEYS)
    const text = await locator.textContent()
    const match = text?.match(/Keys: (\d+)/)
    const actualCount = match ? parseInt(match[1]) : 0

    const pass = actualCount === expectedCount

    return {
      message: () =>
        pass
          ? `Expected key count not to be ${expectedCount}`
          : `Expected key count to be ${expectedCount}, but got ${actualCount}`,
      pass,
      actual: actualCount,
      expected: expectedCount,
    }
  },

  /**
   * Assert that the page has the expected number of selected keys
   *
   * @param page - Playwright Page object
   * @param expectedCount - Expected number of selected keys
   *
   * @example
   * await expect(page).toHaveSelectedCount(2)
   */
  async toHaveSelectedCount(page: Page, expectedCount: number) {
    const locator = page.locator(SELECTORS.COUNTERS.SELECTED)
    const text = await locator.textContent()
    const match = text?.match(/Selected: (\d+)/)
    const actualCount = match ? parseInt(match[1]) : 0

    const pass = actualCount === expectedCount

    return {
      message: () =>
        pass
          ? `Expected selected count not to be ${expectedCount}`
          : `Expected selected count to be ${expectedCount}, but got ${actualCount}`,
      pass,
      actual: actualCount,
      expected: expectedCount,
    }
  },

  /**
   * Assert that the page has unsaved changes indicator
   *
   * @param page - Playwright Page object
   *
   * @example
   * await expect(page).toHaveUnsavedChanges()
   */
  async toHaveUnsavedChanges(page: Page) {
    const locator = page.locator(SELECTORS.MISC.UNSAVED_INDICATOR)
    const isVisible = await locator.isVisible().catch(() => false)

    return {
      message: () =>
        isVisible
          ? 'Expected page not to have unsaved changes'
          : 'Expected page to have unsaved changes indicator',
      pass: isVisible,
    }
  },

  /**
   * Assert that the page has no unsaved changes
   *
   * @param page - Playwright Page object
   *
   * @example
   * await expect(page).toHaveNoUnsavedChanges()
   */
  async toHaveNoUnsavedChanges(page: Page) {
    const locator = page.locator(SELECTORS.MISC.UNSAVED_INDICATOR)
    const isHidden = await locator.isHidden().catch(() => true)

    return {
      message: () =>
        isHidden
          ? 'Expected page to have unsaved changes'
          : 'Expected page not to have unsaved changes indicator',
      pass: isHidden,
    }
  },
})

// Re-export test from Playwright
export { test } from '@playwright/test'

// Type augmentation for TypeScript
declare module '@playwright/test' {
  interface Matchers<R> {
    toHaveKeyCount(expectedCount: number): R
    toHaveSelectedCount(expectedCount: number): R
    toHaveUnsavedChanges(): R
    toHaveNoUnsavedChanges(): R
  }
}
