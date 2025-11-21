import { Page } from '@playwright/test'

/**
 * BasePage - Common functionality for all page objects
 *
 * All page object classes should extend this base class to inherit
 * common functionality like navigation and waiting.
 *
 * @example
 * export class KeyboardEditorPage extends BasePage {
 *   constructor(page: Page) {
 *     super(page)
 *   }
 * }
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /**
   * Wait for the page to finish loading (DOM content loaded)
   * Use this after navigation or when waiting for initial page load
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState('domcontentloaded')
  }

  /**
   * Wait for all network activity to complete
   * Use this when you need to ensure all resources are fully loaded
   */
  async waitForNetworkIdle() {
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * Navigate to a URL and wait for page load
   * @param url - The URL to navigate to (absolute or relative to baseURL)
   */
  async goto(url: string) {
    await this.page.goto(url)
    await this.waitForPageLoad()
  }

  /**
   * Get the current page URL
   */
  async getUrl(): Promise<string> {
    return this.page.url()
  }

  /**
   * Reload the current page
   */
  async reload() {
    await this.page.reload()
    await this.waitForPageLoad()
  }
}
