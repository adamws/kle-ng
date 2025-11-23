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

  /**
   * Get the position input locator for a specific axis
   * @param axis - 'x' or 'y' axis
   * @returns Position input locator
   */
  getPositionInput(axis: 'x' | 'y'): Locator {
    const title = axis === 'x' ? 'X Position' : 'Y Position'
    return this.page.locator(`input[title="${title}"]`).first()
  }

  /**
   * Set the position of the selected key(s)
   * @param x - X coordinate
   * @param y - Y coordinate
   */
  async setPosition(x: number, y: number): Promise<void> {
    const xInput = this.getPositionInput('x')
    const yInput = this.getPositionInput('y')

    await xInput.clear()
    await xInput.fill(x.toString())
    await xInput.dispatchEvent('input')
    await xInput.dispatchEvent('change')
    await xInput.blur()

    await yInput.clear()
    await yInput.fill(y.toString())
    await yInput.dispatchEvent('input')
    await yInput.dispatchEvent('change')
    await yInput.blur()
  }

  /**
   * Get the current position value for a specific axis
   * @param axis - 'x' or 'y' axis
   * @returns Current position value as string
   */
  async getPositionValue(axis: 'x' | 'y'): Promise<string> {
    const input = this.getPositionInput(axis)
    return await input.inputValue()
  }

  /**
   * Assert that the position inputs have expected values
   * @param x - Expected X coordinate
   * @param y - Expected Y coordinate
   */
  async expectPosition(x: number, y: number): Promise<void> {
    const xInput = this.getPositionInput('x')
    const yInput = this.getPositionInput('y')

    await expect(xInput).toHaveValue(x.toString())
    await expect(yInput).toHaveValue(y.toString())
  }

  /**
   * Assert that a position input has the expected step attribute
   * @param axis - 'x' or 'y' axis
   * @param step - Expected step value
   */
  async expectPositionInputStep(axis: 'x' | 'y', step: string): Promise<void> {
    const input = this.getPositionInput(axis)
    await expect(input).toHaveAttribute('step', step)
  }

  /**
   * Get the rotation input locator
   * @returns Rotation input locator
   */
  getRotationInput(): Locator {
    return this.page.locator('input[title="Rotation Angle in Degrees"]').first()
  }

  /**
   * Set the rotation angle of the selected key(s)
   * @param degrees - Rotation angle in degrees
   */
  async setRotation(degrees: number): Promise<void> {
    const rotationInput = this.getRotationInput()
    await rotationInput.clear()
    await rotationInput.fill(degrees.toString())
    await rotationInput.dispatchEvent('input')
    await rotationInput.dispatchEvent('change')
    await rotationInput.blur()
  }

  /**
   * Get the current rotation value
   * @returns Current rotation angle as string
   */
  async getRotationValue(): Promise<string> {
    const rotationInput = this.getRotationInput()
    return await rotationInput.inputValue()
  }

  /**
   * Assert that the rotation input has the expected value
   * @param expectedDegrees - Expected rotation angle
   */
  async expectRotation(expectedDegrees: number): Promise<void> {
    const rotationInput = this.getRotationInput()
    await expect(rotationInput).toHaveValue(expectedDegrees.toString())
  }

  /**
   * Assert that a label input at a specific position is visible
   * @param position - Label position (center, topLeft, etc.)
   */
  async expectLabelInputVisible(
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
  ): Promise<void> {
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
    await expect(labelInput).toBeVisible()
  }

  /**
   * Assert that the width input is visible
   */
  async expectWidthInputVisible(): Promise<void> {
    const widthInput = this.page.locator('input[title="Width"]').first()
    await expect(widthInput).toBeVisible()
  }

  /**
   * Assert that the height input is visible
   */
  async expectHeightInputVisible(): Promise<void> {
    const heightInput = this.page.locator('input[title="Height"]').first()
    await expect(heightInput).toBeVisible()
  }
}
