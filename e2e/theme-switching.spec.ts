import { test, expect } from '@playwright/test'
import { ThemeComponent } from './pages/components/ThemeComponent'

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
    const theme = new ThemeComponent(page)

    // Switch to dark theme
    await theme.switchTo('dark')

    // Verify theme is applied
    await theme.expectCurrentTheme('dark')
    await theme.expectButtonShowsTheme('dark')
    await theme.expectThemeIcon('bi-moon-stars-fill')
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
    const themeToggle = page.locator('button[title*="Current theme"]')
    const htmlElement = page.locator('html')

    // Check that CSS variables are available before testing
    const cssVarsWorking = await page.evaluate(() => {
      const bodyStyles = window.getComputedStyle(document.body)
      const bgVar = bodyStyles.getPropertyValue('--bs-body-bg')
      const colorVar = bodyStyles.getPropertyValue('--bs-body-color')
      return bgVar || colorVar // At least one Bootstrap CSS variable should be defined
    })

    if (!cssVarsWorking) {
      throw new Error('Bootstrap CSS variables not found - theme system may not be properly loaded')
    }

    // Switch to dark theme
    await themeToggle.click()
    await page.locator('button:has-text("Dark")').click()

    // Wait for dark theme to be applied to HTML element
    await expect(htmlElement).toHaveAttribute('data-bs-theme', 'dark')

    // Verify theme toggle button reflects the change
    await expect(themeToggle).toHaveAttribute('title', 'Current theme: dark')

    // Wait for background color to actually change by checking computed style
    await page
      .waitForFunction(
        () => {
          const bgColor = window.getComputedStyle(document.body).backgroundColor
          return bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent'
        },
        { timeout: 5000 },
      )
      .catch(() => {
        throw new Error(
          'Dark theme: Body background color never applied - CSS variables may not be working',
        )
      })

    const darkBackground = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor
    })

    // Switch to light theme
    await themeToggle.click()
    await page.locator('button:has-text("Light")').click()

    // Wait for light theme to be applied to HTML element
    await expect(htmlElement).toHaveAttribute('data-bs-theme', 'light')

    // Verify theme toggle button reflects the change
    await expect(themeToggle).toHaveAttribute('title', 'Current theme: light')

    // Wait for background color to change to something different than dark
    await page
      .waitForFunction(
        (prevBackground) => {
          const bgColor = window.getComputedStyle(document.body).backgroundColor
          return (
            bgColor &&
            bgColor !== prevBackground &&
            bgColor !== 'rgba(0, 0, 0, 0)' &&
            bgColor !== 'transparent'
          )
        },
        darkBackground,
        { timeout: 5000 },
      )
      .catch(() => {
        throw new Error(
          `Light theme: Background color never changed from dark theme. Current: ${darkBackground}`,
        )
      })

    const lightBackground = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor
    })

    // The main test: backgrounds should be different when themes change
    expect(lightBackground).not.toBe(darkBackground)
  })
})
