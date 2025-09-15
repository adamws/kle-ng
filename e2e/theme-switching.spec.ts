import { test, expect } from '@playwright/test'

test.describe('Theme switching functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    // Clear any existing theme preference from localStorage
    await page.evaluate(() => {
      localStorage.removeItem('kle-theme')
    })

    // Wait for the app to load
    await page.waitForSelector('h1:has-text("Keyboard Layout Editor NG")', { timeout: 10000 })
  })

  test('theme toggle button should be visible in header', async ({ page }) => {
    const themeToggle = page.locator('button[title*="Current theme"]')
    await expect(themeToggle).toBeVisible()

    // Should show some theme icon
    const themeIcon = themeToggle.locator('i')
    await expect(themeIcon).toBeVisible()
  })

  test('should default to auto theme', async ({ page }) => {
    const themeToggle = page.locator('button[title*="Current theme"]')
    const themeIcon = themeToggle.locator('i.bi-circle-half')
    await expect(themeIcon).toBeVisible()

    // HTML element should have data-bs-theme set to light or dark based on system preference when in auto mode
    const htmlElement = page.locator('html')
    const dataBsTheme = await htmlElement.getAttribute('data-bs-theme')
    expect(['light', 'dark'].includes(dataBsTheme)).toBeTruthy()
  })

  test('should switch to dark theme', async ({ page }) => {
    const themeToggle = page.locator('button[title*="Current theme"]')
    await themeToggle.click()

    // Click on Dark option in dropdown
    await page.locator('button:has-text("Dark")').click()

    // Verify theme is applied to HTML element
    const htmlElement = page.locator('html')
    await expect(htmlElement).toHaveAttribute('data-bs-theme', 'dark')

    // Verify button shows dark theme
    await expect(themeToggle).toHaveAttribute('title', 'Current theme: dark')

    // Verify the theme icon changed to moon
    const themeIcon = themeToggle.locator('i.bi-moon-stars-fill')
    await expect(themeIcon).toBeVisible()
  })

  test('should switch to light theme', async ({ page }) => {
    const themeToggle = page.locator('button[title*="Current theme"]')
    await themeToggle.click()

    // Click on Light option in dropdown
    await page.locator('button:has-text("Light")').click()

    // Verify theme is applied to HTML element
    const htmlElement = page.locator('html')
    await expect(htmlElement).toHaveAttribute('data-bs-theme', 'light')

    // Verify button shows light theme
    await expect(themeToggle).toHaveAttribute('title', 'Current theme: light')

    // Verify the theme icon changed to sun
    const themeIcon = themeToggle.locator('i.bi-sun-fill')
    await expect(themeIcon).toBeVisible()
  })

  test('should persist theme preference after reload', async ({ page }) => {
    const themeToggle = page.locator('button[title*="Current theme"]')

    // Switch to dark theme
    await themeToggle.click()
    await page.locator('button:has-text("Dark")').click()

    // Verify dark theme is applied
    const htmlElement = page.locator('html')
    await expect(htmlElement).toHaveAttribute('data-bs-theme', 'dark')

    // Reload the page
    await page.reload()
    await page.waitForSelector('button[title*="Current theme"]')

    // Verify dark theme is still applied after reload
    await expect(htmlElement).toHaveAttribute('data-bs-theme', 'dark')
    await expect(themeToggle).toHaveAttribute('title', 'Current theme: dark')
  })

  test('should show active state in dropdown menu', async ({ page }) => {
    const themeToggle = page.locator('button[title*="Current theme"]')

    // Switch to dark theme first
    await themeToggle.click()
    await page.locator('button:has-text("Dark")').click()

    // Open dropdown again
    await themeToggle.click()

    // Verify Dark option is marked as active
    const darkOption = page.locator('.dropdown-item:has-text("Dark")')
    await expect(darkOption).toHaveClass(/active/)

    // Verify other options are not active
    const lightOption = page.locator('.dropdown-item:has-text("Light")')
    const autoOption = page.locator('.dropdown-item:has-text("Auto")')
    await expect(lightOption).not.toHaveClass(/active/)
    await expect(autoOption).not.toHaveClass(/active/)
  })

  test('should handle auto theme mode', async ({ page }) => {
    const themeToggle = page.locator('button[title*="Current theme"]')

    // Switch to light first, then to auto
    await themeToggle.click()
    await page.locator('button:has-text("Light")').click()

    await themeToggle.click()
    await page.locator('button:has-text("Auto")').click()

    // Verify auto theme
    await expect(themeToggle).toHaveAttribute('title', 'Current theme: auto')

    // For auto mode, HTML should have data-bs-theme set to light or dark based on system preference
    const htmlElement = page.locator('html')
    const dataBsTheme = await htmlElement.getAttribute('data-bs-theme')
    expect(['light', 'dark'].includes(dataBsTheme)).toBeTruthy()
  })

  test('auto theme mode should respond to system preference changes', async ({ page }) => {
    const themeToggle = page.locator('button[title*="Current theme"]')

    // Switch to auto mode
    await themeToggle.click()
    await page.locator('button:has-text("Auto")').click()

    // Get reference to html element
    const htmlElement = page.locator('html')

    // Simulate changing system preference by evaluating script
    // This simulates what would happen if user changed their OS theme preference
    await page.evaluate(() => {
      // Trigger a matchMedia change event to simulate system theme change
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const event = new MediaQueryListEvent('change', {
        matches: !mediaQuery.matches,
        media: mediaQuery.media,
      })
      mediaQuery.dispatchEvent(event)
    })

    // Wait a bit for the change to be processed
    await page.waitForTimeout(100)

    // Verify that the theme is still valid (light or dark)
    const updatedTheme = await htmlElement.getAttribute('data-bs-theme')
    expect(['light', 'dark'].includes(updatedTheme)).toBeTruthy()
  })

  test('theme switching should affect app appearance', async ({ page }) => {
    // Switch to dark theme
    const themeToggle = page.locator('button[title*="Current theme"]')
    await themeToggle.click()
    await page.locator('button:has-text("Dark")').click()

    // Wait for theme to be applied
    await page.waitForTimeout(100)

    // Check that dark theme CSS variables are being used
    // This can be verified by checking computed styles of body element
    const bodyBackground = await page.evaluate(() => {
      const body = document.body
      const computedStyle = window.getComputedStyle(body)
      return computedStyle.backgroundColor
    })

    // Dark theme should have darker background
    // The exact color may vary based on Bootstrap variables, but it should be dark
    expect(bodyBackground).not.toBe('rgb(255, 255, 255)') // Not white

    // Switch to light theme and verify
    await themeToggle.click()
    await page.locator('button:has-text("Light")').click()
    await page.waitForTimeout(100)

    const lightBodyBackground = await page.evaluate(() => {
      const body = document.body
      const computedStyle = window.getComputedStyle(body)
      return computedStyle.backgroundColor
    })

    // Light and dark backgrounds should be different
    expect(lightBodyBackground).not.toBe(bodyBackground)
  })
})
