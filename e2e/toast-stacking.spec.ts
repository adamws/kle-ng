import { test, expect } from '@playwright/test'
import { WaitHelpers } from './helpers/wait-helpers'

// Type declaration for the global toast helper
declare global {
  interface Window {
    __kleToast: {
      showSuccess: (message: string, title: string, options?: object) => string
      showError: (message: string, title: string, options?: object) => string
      showWarning: (message: string, title: string, options?: object) => string
      showInfo: (message: string, title: string, options?: object) => string
    }
  }
}

test.describe('Toast Stacking System', () => {
  let waitHelpers: WaitHelpers

  test.beforeEach(async ({ page }) => {
    waitHelpers = new WaitHelpers(page)
    await page.goto('/')
    await waitHelpers.waitForDoubleAnimationFrame()
  })

  test('should display single toast correctly positioned below navbar', async ({ page }) => {
    // Trigger a single toast via the global helper
    await page.evaluate(() => {
      window.__kleToast.showSuccess('Test toast message', 'Test Title')
    })

    // Wait for toast to appear
    const toast = page.locator('.toast-notification').first()
    await expect(toast).toBeVisible()

    // Check that toast is positioned below the navbar
    const navbar = page.locator('.app-header')
    const navbarBox = await navbar.boundingBox()
    const toastBox = await toast.boundingBox()

    expect(navbarBox).toBeTruthy()
    expect(toastBox).toBeTruthy()

    if (navbarBox && toastBox) {
      // Toast should be below the navbar
      expect(toastBox.y).toBeGreaterThan(navbarBox.y + navbarBox.height)
    }

    // Check toast contains correct content
    await expect(toast.locator('.toast-title')).toHaveText('Test Title')
    await expect(toast.locator('.toast-text')).toHaveText('Test toast message')
  })

  test('should stack multiple toasts vertically without overlapping', async ({ page }) => {
    // Trigger multiple toasts with delays
    await page.evaluate(() => {
      const showToast = (message: string, title: string, delay: number) => {
        setTimeout(() => {
          window.__kleToast.showSuccess(message, title)
        }, delay)
      }

      showToast('First toast', 'Toast 1', 0)
      showToast('Second toast', 'Toast 2', 100)
      showToast('Third toast', 'Toast 3', 200)
    })

    // Wait for all 3 toasts to appear
    const toasts = page.locator('.toast-notification')
    await expect(toasts).toHaveCount(3, { timeout: 5000 })

    // Allow animations to complete using RAF
    await waitHelpers.waitForQuadAnimationFrame()

    const toastCount = await toasts.count()
    expect(toastCount).toBe(3)

    // Check that toasts are stacked vertically without overlapping
    const toastBoxes = []
    for (let i = 0; i < toastCount; i++) {
      const box = await toasts.nth(i).boundingBox()
      expect(box).toBeTruthy()
      if (box) toastBoxes.push(box)
    }

    // Verify toasts are positioned vertically with no overlap
    for (let i = 0; i < toastBoxes.length - 1; i++) {
      const currentToast = toastBoxes[i]
      const nextToast = toastBoxes[i + 1]

      // Next toast should be below current toast (no overlap)
      expect(nextToast.y).toBeGreaterThanOrEqual(currentToast.y + currentToast.height)
    }

    // Verify content is correct
    await expect(toasts.nth(0).locator('.toast-title')).toHaveText('Toast 1')
    await expect(toasts.nth(1).locator('.toast-title')).toHaveText('Toast 2')
    await expect(toasts.nth(2).locator('.toast-title')).toHaveText('Toast 3')
  })

  test('should handle toast removal and remaining toasts should move up', async ({ page }) => {
    // Show multiple toasts with long duration
    await page.evaluate(() => {
      window.__kleToast.showSuccess('First toast', 'Toast 1', { duration: 10000 })
      setTimeout(() => {
        window.__kleToast.showSuccess('Second toast', 'Toast 2', { duration: 10000 })
      }, 100)
      setTimeout(() => {
        window.__kleToast.showSuccess('Third toast', 'Toast 3', { duration: 10000 })
      }, 200)
    })

    // Wait for all toasts to appear using RAF
    await waitHelpers.waitForQuadAnimationFrame()

    const toasts = page.locator('.toast-notification')
    await expect(toasts).toHaveCount(3)

    // Get initial positions
    const initialPositions = []
    for (let i = 0; i < 3; i++) {
      const box = await toasts.nth(i).boundingBox()
      if (box) initialPositions.push(box.y)
    }

    // Close the first toast by clicking its close button
    await toasts.nth(0).locator('.toast-close').click()

    // Wait for animation to complete using RAF
    await waitHelpers.waitForQuadAnimationFrame()

    // Check that only 2 toasts remain
    await expect(toasts).toHaveCount(2)

    // Verify remaining toasts moved up
    const finalPositions = []
    for (let i = 0; i < 2; i++) {
      const box = await toasts.nth(i).boundingBox()
      if (box) finalPositions.push(box.y)
    }

    // The second toast should have moved to where the first toast was
    expect(finalPositions[0]).toBeLessThan(initialPositions[1])
  })

  test('should display different toast types with correct styling', async ({ page }) => {
    // Show different types of toasts
    await page.evaluate(() => {
      window.__kleToast.showSuccess('Success message', 'Success', { duration: 10000 })
      setTimeout(() => {
        window.__kleToast.showError('Error message', 'Error', { duration: 10000 })
      }, 100)
      setTimeout(() => {
        window.__kleToast.showWarning('Warning message', 'Warning', { duration: 10000 })
      }, 200)
      setTimeout(() => {
        window.__kleToast.showInfo('Info message', 'Info', { duration: 10000 })
      }, 300)
    })

    // Wait for all toast types to appear using RAF
    await waitHelpers.waitForAnimationFrames(5)

    const toasts = page.locator('.toast-notification')
    await expect(toasts).toHaveCount(4)

    // Check that each toast has the correct type class
    await expect(toasts.nth(0)).toHaveClass(/toast-success/)
    await expect(toasts.nth(1)).toHaveClass(/toast-error/)
    await expect(toasts.nth(2)).toHaveClass(/toast-warning/)
    await expect(toasts.nth(3)).toHaveClass(/toast-info/)

    // Check that icons are present
    await expect(toasts.nth(0).locator('.toast-icon i')).toHaveClass(/bi-check-circle-fill/)
    await expect(toasts.nth(1).locator('.toast-icon i')).toHaveClass(/bi-exclamation-triangle-fill/)
    await expect(toasts.nth(2).locator('.toast-icon i')).toHaveClass(/bi-exclamation-triangle-fill/)
    await expect(toasts.nth(3).locator('.toast-icon i')).toHaveClass(/bi-info-circle-fill/)
  })

  test('should auto-dismiss toasts after specified duration', async ({ page }) => {
    // Show toast with short duration
    await page.evaluate(() => {
      window.__kleToast.showSuccess('Short duration toast', 'Test', { duration: 1000 })
    })

    const toast = page.locator('.toast-notification').first()
    await expect(toast).toBeVisible()

    // Wait for auto-dismiss (1000ms + buffer)
    await waitHelpers.waitForAnimationFrames(12) // ~1200ms at 60fps
    await expect(toast).not.toBeVisible()
  })

  test('should be responsive on mobile viewports', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    // Show a toast
    await page.evaluate(() => {
      window.__kleToast.showSuccess('Mobile toast test', 'Mobile Test')
    })

    const toast = page.locator('.toast-notification').first()
    await expect(toast).toBeVisible()

    const toastBox = await toast.boundingBox()
    expect(toastBox).toBeTruthy()

    if (toastBox) {
      // Toast should fit within viewport width with proper margins
      expect(toastBox.x).toBeGreaterThanOrEqual(20) // Left margin
      expect(toastBox.x + toastBox.width).toBeLessThanOrEqual(375 - 20) // Right margin
    }
  })

  test('should handle rapid toast creation without breaking layout', async ({ page }) => {
    // Rapidly create multiple toasts
    await page.evaluate(() => {
      for (let i = 0; i < 6; i++) {
        window.__kleToast.showInfo(`Rapid toast ${i + 1}`, `Test ${i + 1}`, { duration: 8000 })
      }
    })

    // Wait for rapid creation to complete using RAF
    await waitHelpers.waitForAnimationFrames(3)

    const toasts = page.locator('.toast-notification')
    const toastCount = await toasts.count()

    // Should have created all toasts
    expect(toastCount).toBe(6)

    // Check that all toasts are properly positioned (no overlaps)
    const positions = []
    for (let i = 0; i < toastCount; i++) {
      const box = await toasts.nth(i).boundingBox()
      if (box) positions.push(box)
    }

    // Verify no overlaps
    for (let i = 0; i < positions.length - 1; i++) {
      const current = positions[i]
      const next = positions[i + 1]
      expect(next.y).toBeGreaterThanOrEqual(current.y + current.height)
    }
  })

  test('should maintain accessibility attributes', async ({ page }) => {
    await page.evaluate(() => {
      window.__kleToast.showSuccess('Accessibility test', 'A11y Test')
    })

    const toast = page.locator('.toast-notification').first()
    await expect(toast).toBeVisible()

    // Check accessibility attributes
    await expect(toast).toHaveAttribute('role', 'alert')
    await expect(toast).toHaveAttribute('aria-live', 'polite')

    // Check close button accessibility
    const closeButton = toast.locator('.toast-close')
    await expect(closeButton).toHaveAttribute('aria-label', 'Close notification')
    await expect(closeButton).toHaveAttribute('type', 'button')
  })
})
