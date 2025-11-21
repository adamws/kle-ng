import { Locator, Page, expect } from '@playwright/test'

/**
 * RotationToolComponent - Rotation modal interactions
 *
 * Encapsulates interactions with the rotation tool modal,
 * including anchor selection, angle input, and modal actions.
 *
 * @example
 * const rotation = new RotationToolComponent(page)
 * await rotation.open()
 * await rotation.selectAnchor(100, 100)
 * await rotation.setAngle(30)
 * await rotation.apply()
 */
export class RotationToolComponent {
  private readonly toolButton: Locator
  private readonly modal: Locator
  private readonly angleInput: Locator
  private readonly applyButton: Locator
  private readonly cancelButton: Locator
  private readonly rotationInfo: Locator

  constructor(private readonly page: Page) {
    this.toolButton = page.locator('button[title="Rotate Selection"]')
    this.modal = page.locator('.rotation-panel')
    this.angleInput = page.locator('.rotation-panel input[type="number"]')
    this.applyButton = page.locator('.rotation-panel .btn-primary')
    this.cancelButton = page.locator('.rotation-panel .btn-secondary')
    this.rotationInfo = page.locator('.rotation-info')
  }

  /**
   * Open the rotation tool modal
   */
  async open() {
    await this.toolButton.click()
    await expect(this.modal).toBeVisible()

    // Wait for modal to be fully ready using RAF instead of hard timeout
    await this.page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve())
        })
      })
    })
  }

  /**
   * Select anchor point for rotation
   * @param x - X coordinate on canvas
   * @param y - Y coordinate on canvas
   */
  async selectAnchor(x: number, y: number) {
    await expect(this.rotationInfo).toContainText('Select rotation anchor point')

    const canvas = this.page.locator('.keyboard-canvas')
    await canvas.click({ position: { x, y }, force: true })

    await expect(this.rotationInfo).toContainText('Origin:')
  }

  /**
   * Set the rotation angle
   * @param angle - Rotation angle in degrees
   */
  async setAngle(angle: number) {
    await expect(this.angleInput).toBeVisible()
    await expect(this.angleInput).toBeEnabled()

    // Wait for input to be ready using RAF instead of hard timeout
    await this.page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve())
        })
      })
    })

    await this.angleInput.fill(angle.toString())

    // Wait for angle change to be processed
    await this.page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve())
        })
      })
    })
  }

  /**
   * Apply the rotation
   */
  async apply() {
    await expect(this.applyButton).toBeVisible()
    await expect(this.applyButton).toBeEnabled()
    await this.applyButton.click()
    await expect(this.modal).toBeHidden()

    // Wait for rotation to be applied using RAF
    await this.page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve())
        })
      })
    })
  }

  /**
   * Cancel the rotation
   */
  async cancel() {
    await this.cancelButton.click()
    await expect(this.modal).toBeHidden()
  }

  /**
   * Assert that the rotation tool button is enabled
   */
  async expectEnabled() {
    await expect(this.toolButton).toBeEnabled()
  }

  /**
   * Assert that the rotation tool button is disabled
   */
  async expectDisabled() {
    await expect(this.toolButton).toBeDisabled()
  }

  /**
   * Assert that the modal is visible
   */
  async expectModalVisible() {
    await expect(this.modal).toBeVisible()
  }

  /**
   * Assert that the modal is hidden
   */
  async expectModalHidden() {
    await expect(this.modal).toBeHidden()
  }

  /**
   * Get the rotation tool button locator
   */
  getButton(): Locator {
    return this.toolButton
  }
}
