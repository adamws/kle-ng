import { Locator, Page, expect } from '@playwright/test'

/**
 * PropertiesPanelComponent - Key properties editing
 *
 * Encapsulates interactions with the key properties panel,
 * including size, labels, colors, and other key attributes.
 *
 * @example
 * const props = new PropertiesPanelComponent(page)
 * await props.setWidth(6.25)
 * await props.setLabel('center', 'Space')
 */
export class PropertiesPanelComponent {
  private readonly panel: Locator
  private readonly labelsGrid: Locator

  constructor(private readonly page: Page) {
    this.panel = page.locator('.key-properties-panel')
    this.labelsGrid = page.locator('.labels-grid')
  }

  /**
   * Set the width of the selected key(s)
   * @param width - Width in units (U)
   */
  async setWidth(width: number) {
    const widthInput = this.page.locator('input[title="Width"]').first()
    await widthInput.clear()
    await widthInput.fill(width.toString())
    await widthInput.dispatchEvent('input')
    await widthInput.dispatchEvent('change')
    await widthInput.blur()
  }

  /**
   * Set the height of the selected key(s)
   * @param height - Height in units (U)
   */
  async setHeight(height: number) {
    const heightInput = this.page.locator('input[title="Height"]').first()
    await heightInput.clear()
    await heightInput.fill(height.toString())
    await heightInput.dispatchEvent('input')
    await heightInput.dispatchEvent('change')
    await heightInput.blur()
  }

  /**
   * Set both width and height
   * @param width - Width in units
   * @param height - Height in units
   */
  async setSize(width: number, height: number) {
    await this.setWidth(width)
    await this.setHeight(height)
  }

  /**
   * Set a label at a specific position on the key
   *
   * @param position - Label position (center, topLeft, etc.)
   * @param text - Label text
   *
   * @example
   * await props.setLabel('center', 'A')
   * await props.setLabel('topLeft', 'Shift')
   */
  async setLabel(
    position:
      | 'center'
      | 'topLeft'
      | 'topCenter'
      | 'topRight'
      | 'centerLeft'
      | 'centerRight'
      | 'bottomLeft'
      | 'bottomCenter'
      | 'bottomRight',
    text: string,
  ) {
    const positions = {
      topLeft: 0,
      topCenter: 1,
      topRight: 2,
      centerLeft: 3,
      center: 4,
      centerRight: 5,
      bottomLeft: 6,
      bottomCenter: 7,
      bottomRight: 8,
    }

    const labelInput = this.labelsGrid.locator('.form-control').nth(positions[position])
    await labelInput.fill(text)
  }

  /**
   * Get the value of a label at a specific position
   * @param position - Label position
   * @returns The current label text
   */
  async getLabel(
    position:
      | 'center'
      | 'topLeft'
      | 'topCenter'
      | 'topRight'
      | 'centerLeft'
      | 'centerRight'
      | 'bottomLeft'
      | 'bottomCenter'
      | 'bottomRight',
  ): Promise<string> {
    const positions = {
      topLeft: 0,
      topCenter: 1,
      topRight: 2,
      centerLeft: 3,
      center: 4,
      centerRight: 5,
      bottomLeft: 6,
      bottomCenter: 7,
      bottomRight: 8,
    }

    const labelInput = this.labelsGrid.locator('.form-control').nth(positions[position])
    return (await labelInput.inputValue()) || ''
  }

  /**
   * Assert that the center label has the expected value
   * @param expectedValue - Expected label text
   */
  async expectCenterLabel(expectedValue: string) {
    const centerInput = this.labelsGrid.locator('.form-control').nth(4)
    await expect(centerInput).toHaveValue(expectedValue)
  }

  /**
   * Assert that the width input has the expected value
   * @param expectedValue - Expected width
   */
  async expectWidth(expectedValue: string | number) {
    const widthInput = this.page.locator('input[title="Width"]').first()
    await expect(widthInput).toHaveValue(expectedValue.toString())
  }

  /**
   * Assert that the height input has the expected value
   * @param expectedValue - Expected height
   */
  async expectHeight(expectedValue: string | number) {
    const heightInput = this.page.locator('input[title="Height"]').first()
    await expect(heightInput).toHaveValue(expectedValue.toString())
  }

  /**
   * Assert that the properties panel is visible
   */
  async expectVisible() {
    await expect(this.panel).toBeVisible()
  }

  /**
   * Assert that the properties panel is hidden
   */
  async expectHidden() {
    await expect(this.panel).toBeHidden()
  }

  /**
   * Get the panel locator for advanced operations
   */
  getLocator(): Locator {
    return this.panel
  }
}
