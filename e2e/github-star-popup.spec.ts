import { test, expect } from '@playwright/test'
import { GitHubStarPopupHelper } from './helpers/github-star-popup-helpers'
import { WaitHelpers } from './helpers/wait-helpers'

test.describe('GitHub Star Popup', () => {
  let popupHelper: GitHubStarPopupHelper
  let waitHelpers: WaitHelpers

  test.beforeEach(async ({ page, context }) => {
    // Clear localStorage before each test to simulate new user
    await context.clearCookies()
    await page.goto('/')

    // Initialize helpers
    waitHelpers = new WaitHelpers(page)
    popupHelper = new GitHubStarPopupHelper(page, waitHelpers)

    // Initialize for testing
    await popupHelper.initializeForTesting()
  })

  test('should not show popup immediately on first visit', async ({ page }) => {
    await page.goto('/')

    // Wait a bit to ensure page is loaded
    await page.waitForLoadState('networkidle')

    // Popup should not be visible immediately
    await popupHelper.expectPopupNotVisible()
  })

  test('should show popup for user who has been on site > 1 minute', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Show popup after simulating 2 minutes delay
    await popupHelper.showPopupAfterDelay(120000)

    // Popup should now be visible
    await popupHelper.expectPopupVisible()

    // Check popup content
    await popupHelper.expectPopupContent()
  })

  test('should have correct GitHub link', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Show popup
    await popupHelper.showPopupAfterDelay(120000)
    await popupHelper.expectPopupVisible()

    // Check link attributes
    await popupHelper.expectCorrectGitHubLink()
  })

  test('should close popup when close button is clicked', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Show popup
    await popupHelper.showPopupAfterDelay(120000)
    await popupHelper.expectPopupVisible()

    // Click close button
    await popupHelper.closePopup()

    // Popup should disappear
    await popupHelper.expectPopupNotVisible()
  })

  test('should close popup when star button is clicked', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Show popup
    await popupHelper.showPopupAfterDelay(120000)
    await popupHelper.expectPopupVisible()

    // Click star button (will open new tab, but we're testing popup closes)
    const newPage = await popupHelper.clickStarButton()

    // Close the new page
    await newPage.close()

    // Original popup should disappear
    await popupHelper.expectPopupNotVisible()
  })

  test('should store dismissed state in localStorage', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Show popup
    await popupHelper.showPopupAfterDelay(120000)
    await popupHelper.expectPopupVisible()

    // Click close button
    await popupHelper.closePopup()

    // Check localStorage
    await popupHelper.expectDismissedStateStored()
  })

  test('should not show popup again after being dismissed', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Show popup
    await popupHelper.showPopupAfterDelay(120000)
    await popupHelper.expectPopupVisible()

    await popupHelper.closePopup()
    await popupHelper.expectPopupNotVisible()

    // Reload page (simulating returning user)
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Even after waiting, popup should not show (use RAF wait instead of hard timeout)
    await popupHelper.expectPopupNotVisibleAfterWait()
  })

  test('should show popup immediately for returning user who has been there > 1 minute', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Show popup
    await popupHelper.showPopupAfterDelay(120000)

    // Popup should show immediately
    await popupHelper.expectPopupVisible()
  })

  test('should not show popup if dismissed flag is set', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Pre-set dismissed flag
    await popupHelper.setDismissedFlag()

    // Also simulate time passed (to make sure dismissed flag takes precedence)
    await popupHelper.simulateFirstVisit(120000)

    // Reload page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Wait to ensure popup doesn't show (use RAF wait instead of hard timeout)
    await popupHelper.expectPopupNotVisibleAfterWait()
  })

  test('should have proper styling and positioning', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Show popup
    await popupHelper.showPopupAfterDelay(120000)
    await popupHelper.expectPopupVisible()

    // Check popup is positioned in bottom right
    const popup = popupHelper.getPopup()
    const box = await popup.boundingBox()

    expect(box).not.toBeNull()
    if (box) {
      // Popup should be in the lower right area of the viewport
      const viewportSize = page.viewportSize()
      if (viewportSize) {
        expect(box.x + box.width).toBeGreaterThan(viewportSize.width - 100)
        expect(box.y + box.height).toBeGreaterThan(viewportSize.height - 200)
      }
    }
  })

  test('should have close button icon', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Show popup
    await popupHelper.showPopupAfterDelay(120000)
    await popupHelper.expectPopupVisible()

    // Check for close icon (bi-x)
    await expect(popupHelper.getCloseIcon()).toBeVisible()
  })

  test('should have GitHub icon in star button', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Show popup
    await popupHelper.showPopupAfterDelay(120000)
    await popupHelper.expectPopupVisible()

    // Check for GitHub icon (bi-github)
    await expect(popupHelper.getGitHubIcon()).toBeVisible()
  })

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Show popup
    await popupHelper.showPopupAfterDelay(120000)
    await popupHelper.expectPopupVisible()

    // Popup should be visible and not overflow
    const popup = popupHelper.getPopup()
    const box = await popup.boundingBox()

    expect(box).not.toBeNull()
    if (box) {
      // Popup should fit within mobile viewport (with some margin)
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(380) // Allow small margin
    }
  })
})
