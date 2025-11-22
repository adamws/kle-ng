import { test, expect } from '@playwright/test'
import { ThemeComponent } from './pages/components/ThemeComponent'
import { WaitHelpers } from './helpers'

test.describe('Theme switching functionality', () => {
  let theme: ThemeComponent
  let waitHelpers: WaitHelpers

  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    // Clear any existing theme preference from localStorage
    await page.evaluate(() => {
      localStorage.removeItem('kle-theme')
    })

    // Wait for the app to load
    await page.waitForSelector('h1:has-text("Keyboard Layout Editor NG")', { timeout: 10000 })

    // Initialize helpers
    waitHelpers = new WaitHelpers(page)
    theme = new ThemeComponent(page, waitHelpers)
  })

  test('theme toggle button should be visible in header', async () => {
    await theme.expectToggleVisible()

    // Should show some theme icon
    const themeIcon = theme.getToggleButton().locator('i')
    await expect(themeIcon).toBeVisible()
  })

  test('should default to auto theme', async () => {
    await theme.expectThemeIcon('bi-circle-half')

    // HTML element should have data-bs-theme set to light or dark based on system preference when in auto mode
    const dataBsTheme = await theme.getHtmlElement().getAttribute('data-bs-theme')
    expect(['light', 'dark'].includes(dataBsTheme)).toBeTruthy()
  })

  test('should switch to dark theme', async () => {
    // Switch to dark theme
    await theme.switchTo('dark')

    // Verify theme is applied
    await theme.expectCurrentTheme('dark')
    await theme.expectButtonShowsTheme('dark')
    await theme.expectThemeIcon('bi-moon-stars-fill')
  })

  test('should switch to light theme', async () => {
    // Switch to light theme
    await theme.switchTo('light')

    // Verify theme is applied
    await theme.expectCurrentTheme('light')
    await theme.expectButtonShowsTheme('light')
    await theme.expectThemeIcon('bi-sun-fill')
  })

  test('should persist theme preference after reload', async ({ page }) => {
    // Switch to dark theme
    await theme.switchTo('dark')

    // Verify dark theme is applied
    await theme.expectCurrentTheme('dark')

    // Reload the page
    await page.reload()
    await theme.getToggleButton().waitFor({ state: 'visible' })

    // Re-initialize helpers after reload
    const newWaitHelpers = new WaitHelpers(page)
    const newTheme = new ThemeComponent(page, newWaitHelpers)

    // Verify dark theme is still applied after reload
    await newTheme.expectCurrentTheme('dark')
    await newTheme.expectButtonShowsTheme('dark')
  })

  test('should show active state in dropdown menu', async () => {
    // Switch to dark theme first
    await theme.switchTo('dark')

    // Open dropdown again
    await theme.openDropdown()

    // Verify Dark option is marked as active
    await theme.expectDropdownOptionActive('dark')

    // Verify other options are not active
    await theme.expectDropdownOptionNotActive('light')
    await theme.expectDropdownOptionNotActive('auto')
  })

  test('should handle auto theme mode', async () => {
    // Switch to light first, then to auto
    await theme.switchTo('light')
    await theme.switchTo('auto')

    // Verify auto theme
    await theme.expectButtonShowsTheme('auto')

    // For auto mode, HTML should have data-bs-theme set to light or dark based on system preference
    const dataBsTheme = await theme.getHtmlElement().getAttribute('data-bs-theme')
    expect(['light', 'dark'].includes(dataBsTheme)).toBeTruthy()
  })

  test('auto theme mode should respond to system preference changes', async ({ page }) => {
    // Switch to auto mode
    await theme.switchTo('auto')

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

    // Wait for the change to be processed using RAF wait
    await theme.waitForThemeChange()

    // Verify that the theme is still valid (light or dark)
    const updatedTheme = await theme.getHtmlElement().getAttribute('data-bs-theme')
    expect(['light', 'dark'].includes(updatedTheme)).toBeTruthy()
  })

  test('theme switching should affect app appearance', async ({ page }) => {
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
    await theme.switchTo('dark')

    // Verify dark theme is applied
    await theme.expectCurrentTheme('dark')
    await theme.expectButtonShowsTheme('dark')

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
    await theme.switchTo('light')

    // Verify light theme is applied
    await theme.expectCurrentTheme('light')
    await theme.expectButtonShowsTheme('light')

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
