import { Locator, Page, expect } from '@playwright/test'
import { WaitHelpers } from '../../helpers/wait-helpers'

/**
 * ThemeComponent - Theme switching functionality
 *
 * Encapsulates theme toggle button and theme switching operations.
 *
 * @example
 * const theme = new ThemeComponent(page, waitHelpers)
 * await theme.switchTo('dark')
 * await theme.expectCurrentTheme('dark')
 */
export class ThemeComponent {
  private readonly themeToggleButton: Locator
  private readonly htmlElement: Locator

  constructor(
    private readonly page: Page,
    private readonly waitHelpers: WaitHelpers,
  ) {
    this.themeToggleButton = page.locator('button[title*="Current theme"]')
    this.htmlElement = page.locator('html')
  }

  /**
   * Switch to a specific theme
   * @param theme - 'light', 'dark', or 'auto'
   */
  async switchTo(theme: 'light' | 'dark' | 'auto') {
    await this.themeToggleButton.click()

    // Capitalize first letter for button text
    const buttonText = theme.charAt(0).toUpperCase() + theme.slice(1)
    await this.page.locator(`button:has-text("${buttonText}")`).click()
  }

  /**
   * Get the current theme from the HTML data attribute
   * @returns The current theme: 'light', 'dark', or null
   */
  async getCurrentTheme(): Promise<string | null> {
    return await this.htmlElement.getAttribute('data-bs-theme')
  }

  /**
   * Assert that the current theme matches expected
   * @param theme - Expected theme: 'light' or 'dark'
   */
  async expectCurrentTheme(theme: 'light' | 'dark') {
    await expect(this.htmlElement).toHaveAttribute('data-bs-theme', theme)
  }

  /**
   * Assert that the theme toggle button shows the expected theme
   * @param theme - Expected theme displayed in button title
   */
  async expectButtonShowsTheme(theme: 'light' | 'dark' | 'auto') {
    await expect(this.themeToggleButton).toHaveAttribute('title', `Current theme: ${theme}`)
  }

  /**
   * Assert that the theme icon is visible
   * @param iconClass - Bootstrap icon class (e.g., 'bi-moon-stars-fill')
   */
  async expectThemeIcon(iconClass: string) {
    const icon = this.themeToggleButton.locator(`i.${iconClass}`)
    await expect(icon).toBeVisible()
  }

  /**
   * Assert that the theme toggle button is visible
   */
  async expectToggleVisible() {
    await expect(this.themeToggleButton).toBeVisible()
  }

  /**
   * Get the theme toggle button locator
   */
  getToggleButton(): Locator {
    return this.themeToggleButton
  }

  /**
   * Get the HTML element locator
   */
  getHtmlElement(): Locator {
    return this.htmlElement
  }

  /**
   * Open the theme dropdown without selecting an option
   */
  async openDropdown(): Promise<void> {
    await this.themeToggleButton.click()
  }

  /**
   * Assert that a dropdown option is marked as active
   * @param theme - The theme option to check ('light', 'dark', or 'auto')
   */
  async expectDropdownOptionActive(theme: 'light' | 'dark' | 'auto'): Promise<void> {
    const themeName = theme.charAt(0).toUpperCase() + theme.slice(1)
    const option = this.page.locator(`.dropdown-item:has-text("${themeName}")`)
    await expect(option).toHaveClass(/active/)
  }

  /**
   * Assert that a dropdown option is NOT marked as active
   * @param theme - The theme option to check ('light', 'dark', or 'auto')
   */
  async expectDropdownOptionNotActive(theme: 'light' | 'dark' | 'auto'): Promise<void> {
    const themeName = theme.charAt(0).toUpperCase() + theme.slice(1)
    const option = this.page.locator(`.dropdown-item:has-text("${themeName}")`)
    await expect(option).not.toHaveClass(/active/)
  }

  /**
   * Wait for theme change to be processed
   * Uses RAF wait for smooth UI updates
   */
  async waitForThemeChange(): Promise<void> {
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }
}
