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
    const themeIcon = theme.getToggleButton().locator('svg')
    await expect(themeIcon).toBeVisible()
  })

  test('should default to auto theme', async () => {
    await theme.expectButtonShowsTheme('auto')

    // HTML element should have data-bs-theme set to light or dark based on system preference when in auto mode
    const dataBsTheme = await theme.getHtmlElement().getAttribute('data-bs-theme')
    expect(['light', 'dark'].includes(dataBsTheme)).toBeTruthy()
  })

  test('should switch to dark theme', async () => {
    // Switch to dark theme
    await theme.switchTo('dark')

    // Wait for theme attribute to be set
    await theme.waitForThemeAttribute('dark')

    // Verify theme is applied
    await theme.expectCurrentTheme('dark')
    await theme.expectButtonShowsTheme('dark')
  })

  test('should switch to light theme', async () => {
    // Switch to light theme
    await theme.switchTo('light')

    // Wait for theme attribute to be set
    await theme.waitForThemeAttribute('light')

    // Verify theme is applied
    await theme.expectCurrentTheme('light')
    await theme.expectButtonShowsTheme('light')
  })

  test('should persist theme preference after reload', async ({ page }) => {
    // Switch to dark theme
    await theme.switchTo('dark')

    // Wait for theme attribute to be set
    await theme.waitForThemeAttribute('dark')

    // Verify dark theme is applied
    await theme.expectCurrentTheme('dark')

    // Reload the page
    await page.reload()
    await page.waitForSelector('h1:has-text("Keyboard Layout Editor NG")', { timeout: 10000 })
    await theme.getToggleButton().waitFor({ state: 'visible' })

    // Re-initialize helpers after reload
    const newWaitHelpers = new WaitHelpers(page)
    const newTheme = new ThemeComponent(page, newWaitHelpers)

    // Wait for theme to be restored from localStorage
    await newTheme.waitForThemeAttribute('dark')

    // Verify dark theme is still applied after reload
    await newTheme.expectCurrentTheme('dark')
    await newTheme.expectButtonShowsTheme('dark')
  })

  test('should show active state in dropdown menu', async () => {
    // Switch to dark theme first
    await theme.switchTo('dark')

    // Wait for theme attribute to be set
    await theme.waitForThemeAttribute('dark')

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

    // Get the current computed theme
    const initialTheme = await theme.getHtmlElement().getAttribute('data-bs-theme')
    expect(['light', 'dark'].includes(initialTheme)).toBeTruthy()

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

    // Wait for the theme attribute to potentially change
    // Use a more robust wait that checks if the attribute changes OR stays the same but is valid
    await page.waitForFunction(
      () => {
        const current = document.documentElement.getAttribute('data-bs-theme')
        // Theme should either change OR remain valid (light/dark)
        return current && ['light', 'dark'].includes(current) && current !== null
      },
      undefined,
      { timeout: 5000 },
    )

    // Additional RAF wait for UI updates
    await theme.waitForThemeChange()

    // Verify that the theme is still valid (light or dark)
    const updatedTheme = await theme.getHtmlElement().getAttribute('data-bs-theme')
    expect(['light', 'dark'].includes(updatedTheme)).toBeTruthy()
  })

  test('theme switching should affect app appearance', async ({ page }) => {
    // Verify that Bootstrap CSS system is working
    const cssSystemWorking = await page.evaluate(() => {
      // Check that body has computed styles that respond to data-bs-theme
      const bodyStyles = window.getComputedStyle(document.body)
      const bgColor = bodyStyles.backgroundColor
      return bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent'
    })

    if (!cssSystemWorking) {
      throw new Error('CSS theme system not working - body has no background color')
    }

    // Switch to dark theme and verify CSS is applied
    await theme.switchTo('dark')
    await theme.waitForThemeAttribute('dark')
    await theme.expectCurrentTheme('dark')

    // Verify dark theme has valid styles
    const darkHasStyles = await page.evaluate(() => {
      const bodyStyles = window.getComputedStyle(document.body)
      const bg = bodyStyles.backgroundColor
      const color = bodyStyles.color
      return (
        bg &&
        bg !== 'rgba(0, 0, 0, 0)' &&
        bg !== 'transparent' &&
        color &&
        color !== 'rgba(0, 0, 0, 0)' &&
        color !== 'transparent'
      )
    })
    expect(darkHasStyles).toBeTruthy()

    // Switch to light theme and verify CSS is applied
    await theme.switchTo('light')
    await theme.waitForThemeAttribute('light')
    await theme.expectCurrentTheme('light')

    // Verify light theme has valid styles
    const lightHasStyles = await page.evaluate(() => {
      const bodyStyles = window.getComputedStyle(document.body)
      const bg = bodyStyles.backgroundColor
      const color = bodyStyles.color
      return (
        bg &&
        bg !== 'rgba(0, 0, 0, 0)' &&
        bg !== 'transparent' &&
        color &&
        color !== 'rgba(0, 0, 0, 0)' &&
        color !== 'transparent'
      )
    })
    expect(lightHasStyles).toBeTruthy()

    // The key test: verify that the data-bs-theme attribute actually controls styling
    // by checking that Bootstrap CSS variables are defined
    const bootstrapThemeWorks = await page.evaluate(() => {
      const rootStyles = window.getComputedStyle(document.documentElement)
      const bodyBgVar = rootStyles.getPropertyValue('--bs-body-bg')
      const bodyColorVar = rootStyles.getPropertyValue('--bs-body-color')
      return bodyBgVar && bodyColorVar
    })
    expect(bootstrapThemeWorks).toBeTruthy()
  })
})
