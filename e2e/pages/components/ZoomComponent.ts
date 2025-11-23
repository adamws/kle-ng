import { Locator, Page, expect } from '@playwright/test'
import { WaitHelpers } from '../../helpers/wait-helpers'

/**
 * ZoomComponent - Canvas zoom control
 *
 * Encapsulates zoom control interactions for adjusting canvas zoom level.
 *
 * @example
 * const zoom = new ZoomComponent(page, waitHelpers)
 * await zoom.setZoomLevel(150)
 * await zoom.expectZoomLevel(150)
 *
 * @remarks
 * ⚠️ TECH DEBT: This component currently uses CSS class selectors (.zoom-control)
 * instead of data-testid attributes. These should be migrated to data-testid in the future.
 */
export class ZoomComponent {
  private readonly zoomControl: Locator
  private readonly zoomInput: Locator

  constructor(
    private readonly page: Page,
    private readonly waitHelpers: WaitHelpers,
  ) {
    this.zoomControl = page.locator('.zoom-control')
    this.zoomInput = this.zoomControl.locator('.custom-number-input input')
  }

  /**
   * Set the zoom level to a specific percentage
   * @param zoomPercent - Zoom level as a percentage (e.g., 100, 150, 50)
   */
  async setZoomLevel(zoomPercent: number): Promise<void> {
    await this.zoomInput.clear()
    await this.zoomInput.fill(zoomPercent.toString())
    await this.zoomInput.dispatchEvent('change')
    await this.zoomInput.blur()
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  /**
   * Get the current zoom level as a number
   * @returns Current zoom percentage (e.g., 100, 150, 50)
   */
  async getZoomLevel(): Promise<number> {
    const zoomValue = await this.zoomInput.inputValue()
    return parseInt(zoomValue, 10)
  }

  /**
   * Assert that the zoom level matches expected value
   * @param expectedPercent - Expected zoom percentage
   */
  async expectZoomLevel(expectedPercent: number): Promise<void> {
    await expect(this.zoomInput).toHaveValue(expectedPercent.toString())
  }

  /**
   * Zoom in by a percentage increment (default: 20%)
   * @param increment - Percentage to increase zoom by (default: 20)
   */
  async zoomIn(increment: number = 20): Promise<void> {
    const currentZoom = await this.getZoomLevel()
    await this.setZoomLevel(currentZoom + increment)
  }

  /**
   * Zoom out by a percentage decrement (default: 20%)
   * @param decrement - Percentage to decrease zoom by (default: 20)
   */
  async zoomOut(decrement: number = 20): Promise<void> {
    const currentZoom = await this.getZoomLevel()
    await this.setZoomLevel(currentZoom - decrement)
  }

  /**
   * Reset zoom to 100%
   */
  async resetZoom(): Promise<void> {
    await this.setZoomLevel(100)
  }

  /**
   * Assert that the zoom control is visible
   */
  async expectZoomControlVisible(): Promise<void> {
    await expect(this.zoomControl).toBeVisible()
  }

  /**
   * Assert that the zoom input is visible
   */
  async expectZoomInputVisible(): Promise<void> {
    await expect(this.zoomInput).toBeVisible()
  }

  /**
   * Assert that the zoom input is enabled
   */
  async expectZoomInputEnabled(): Promise<void> {
    await expect(this.zoomInput).toBeEnabled()
  }

  /**
   * Assert that the zoom input is disabled
   */
  async expectZoomInputDisabled(): Promise<void> {
    await expect(this.zoomInput).toBeDisabled()
  }

  /**
   * Get the zoom input locator
   */
  getZoomInput(): Locator {
    return this.zoomInput
  }

  /**
   * Get the zoom control container locator
   */
  getZoomControl(): Locator {
    return this.zoomControl
  }
}
