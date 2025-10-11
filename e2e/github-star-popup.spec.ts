import { test, expect } from '@playwright/test'

test.describe('GitHub Star Popup', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear localStorage before each test to simulate new user
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      // Set flag to allow popup to show in E2E tests
      ;(window as typeof window & { __ALLOW_POPUP_IN_E2E__?: boolean }).__ALLOW_POPUP_IN_E2E__ =
        true
    })
  })

  // Helper function to simulate time passed by manipulating localStorage
  async function simulateFirstVisit(page, millisecondsAgo: number) {
    const timeAgo = Date.now() - millisecondsAgo
    await page.evaluate((time) => {
      localStorage.setItem('kle-ng-first-visit-time', time.toString())
    }, timeAgo)
  }

  test('should not show popup immediately on first visit', async ({ page }) => {
    await page.goto('/')

    // Wait a bit to ensure page is loaded
    await page.waitForLoadState('networkidle')

    // Popup should not be visible immediately
    await expect(page.locator('.github-star-popup')).not.toBeVisible()
  })

  test('should show popup for user who has been on site > 1 minute', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Simulate that user visited 2 minutes ago
    await simulateFirstVisit(page, 120000)

    // Reload page to trigger popup check
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Popup should now be visible
    await expect(page.locator('.github-star-popup')).toBeVisible({ timeout: 5000 })

    // Check popup content
    await expect(page.locator('.popup-title')).toContainText('Enjoying KLE-NG?')
    await expect(page.locator('.popup-text')).toContainText('star')
    await expect(page.locator('.star-button')).toContainText('Star on GitHub')
  })

  test('should have correct GitHub link', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Simulate user who has been here > 1 minute
    await simulateFirstVisit(page, 120000)
    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.github-star-popup')).toBeVisible({ timeout: 5000 })

    // Check link attributes
    const starButton = page.locator('.star-button')
    await expect(starButton).toHaveAttribute('href', 'https://github.com/adamws/kle-ng')
    await expect(starButton).toHaveAttribute('target', '_blank')
    await expect(starButton).toHaveAttribute('rel', 'noopener noreferrer')
  })

  test('should close popup when close button is clicked', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Show popup by simulating time passed
    await simulateFirstVisit(page, 120000)
    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.github-star-popup')).toBeVisible({ timeout: 5000 })

    // Click close button
    await page.locator('.close-btn').click()

    // Popup should disappear
    await expect(page.locator('.github-star-popup')).not.toBeVisible()
  })

  test('should close popup when star button is clicked', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Show popup
    await simulateFirstVisit(page, 120000)
    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.github-star-popup')).toBeVisible({ timeout: 5000 })

    // Click star button (will open new tab, but we're testing popup closes)
    // Need to handle the new page that opens
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      page.locator('.star-button').click(),
    ])

    // Close the new page
    await newPage.close()

    // Original popup should disappear
    await expect(page.locator('.github-star-popup')).not.toBeVisible()
  })

  test('should store dismissed state in localStorage', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Show popup
    await simulateFirstVisit(page, 120000)
    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.github-star-popup')).toBeVisible({ timeout: 5000 })

    // Click close button
    await page.locator('.close-btn').click()

    // Check localStorage
    const dismissedState = await page.evaluate(() => {
      return localStorage.getItem('kle-ng-github-star-popup-dismissed')
    })

    expect(dismissedState).toBe('true')
  })

  test('should not show popup again after being dismissed', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Show popup
    await simulateFirstVisit(page, 120000)
    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.github-star-popup')).toBeVisible({ timeout: 5000 })

    await page.locator('.close-btn').click()
    await expect(page.locator('.github-star-popup')).not.toBeVisible()

    // Reload page (simulating returning user)
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Even after waiting, popup should not show
    await page.waitForTimeout(1000)
    await expect(page.locator('.github-star-popup')).not.toBeVisible()
  })

  test('should show popup immediately for returning user who has been there > 1 minute', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Simulate a user who visited 2 minutes ago
    await simulateFirstVisit(page, 120000)

    // Reload page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Popup should show immediately
    await expect(page.locator('.github-star-popup')).toBeVisible({ timeout: 5000 })
  })

  test('should not show popup if dismissed flag is set', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Pre-set dismissed flag
    await page.evaluate(() => {
      localStorage.setItem('kle-ng-github-star-popup-dismissed', 'true')
    })

    // Also simulate time passed (to make sure dismissed flag takes precedence)
    await simulateFirstVisit(page, 120000)

    // Reload page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Wait to ensure popup doesn't show
    await page.waitForTimeout(1000)

    // Popup should never appear
    await expect(page.locator('.github-star-popup')).not.toBeVisible()
  })

  test('should have proper styling and positioning', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Show popup
    await simulateFirstVisit(page, 120000)
    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.github-star-popup')).toBeVisible({ timeout: 5000 })

    // Check popup is positioned in bottom right
    const popup = page.locator('.github-star-popup')
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

    await simulateFirstVisit(page, 120000)
    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.github-star-popup')).toBeVisible({ timeout: 5000 })

    // Check for close icon (bi-x)
    await expect(page.locator('.close-btn i.bi-x')).toBeVisible()
  })

  test('should have GitHub icon in star button', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await simulateFirstVisit(page, 120000)
    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.github-star-popup')).toBeVisible({ timeout: 5000 })

    // Check for GitHub icon (bi-github)
    await expect(page.locator('.star-button i.bi-github')).toBeVisible()
  })

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await simulateFirstVisit(page, 120000)
    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.github-star-popup')).toBeVisible({ timeout: 5000 })

    // Popup should be visible and not overflow
    const popup = page.locator('.github-star-popup')
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
