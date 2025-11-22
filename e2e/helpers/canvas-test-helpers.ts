import { Page, Locator, expect } from '@playwright/test'
import { WaitHelpers } from './wait-helpers'

export class CanvasTestHelper {
  private waitHelpers: WaitHelpers

  constructor(private page: Page) {
    this.waitHelpers = new WaitHelpers(page)
  }

  async addKey() {
    // The Add Key button has the correct title "Add Standard Key"
    await this.page.click('button[title="Add Standard Key"]')
    await this.waitForRender() // Wait for key to be added
  }

  async addMultipleKeys(count: 5 | 10 | 25) {
    // The multiple key add functionality is no longer available in the canvas toolbar
    // Fall back to adding keys individually for now
    for (let i = 0; i < count; i++) {
      await this.addKey()
    }
  }

  async setKeyLabel(
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

    const labelInput = this.page.locator('.labels-grid .form-control').nth(positions[position])
    await labelInput.fill(text)
  }

  async setKeySize(width: number, height?: number) {
    // Use first() to handle multiple Width inputs (strict mode violation fix)
    const widthInput = this.page.locator('input[title="Width"]').first()
    await widthInput.clear()
    await widthInput.fill(width.toString())
    // Trigger multiple events for cross-browser compatibility
    await widthInput.dispatchEvent('input')
    await widthInput.dispatchEvent('change')
    await widthInput.blur()

    if (height !== undefined) {
      const heightInput = this.page.locator('input[title="Height"]').first()
      await heightInput.clear()
      await heightInput.fill(height.toString())
      await heightInput.dispatchEvent('input')
      await heightInput.dispatchEvent('change')
      await heightInput.blur()
    }

    // Wait for the canvas to update with longer timeout for slower browsers
    await this.waitForRender()
  }

  async setKeyColors(keyColor?: string, textColor?: string) {
    if (keyColor) {
      // New ColorPicker component - the button has both classes on the same element
      const keyColorButton = this.page.locator('.key-color-input.color-picker-button').first()
      await keyColorButton.click()

      // Wait for picker popup to appear
      const colorPickerPopup = this.page.locator('.color-picker-popup')
      await expect(colorPickerPopup).toBeVisible()

      // Enter hex value in the hex input field of the custom color picker
      const hexInput = this.page.locator('.color-picker-popup input[placeholder="000000"]').first()
      await hexInput.fill(keyColor.replace('#', ''))
      await hexInput.press('Enter')

      // Click OK button to confirm and wait for popup to disappear
      const okButton = this.page.locator('.color-picker-popup .btn-primary')
      await okButton.click()
      await expect(colorPickerPopup).toBeHidden()
    }

    if (textColor) {
      // New ColorPicker component - the button has both classes on the same element
      const textColorButton = this.page.locator('.text-color-input.color-picker-button').first()
      await textColorButton.click()

      // Wait for picker popup to appear
      const colorPickerPopup = this.page.locator('.color-picker-popup')
      await expect(colorPickerPopup).toBeVisible()

      // Enter hex value in the hex input field of the custom color picker
      const hexInput = this.page.locator('.color-picker-popup input[placeholder="000000"]').first()
      await hexInput.fill(textColor.replace('#', ''))
      await hexInput.press('Enter')

      // Click OK button to confirm and wait for popup to disappear
      const okButton = this.page.locator('.color-picker-popup .btn-primary')
      await okButton.click()
      await expect(colorPickerPopup).toBeHidden()
    }

    // Wait for the canvas to update
    await this.waitForRender()
  }

  async setLabelTextSize(
    position:
      | 'topLeft'
      | 'topCenter'
      | 'topRight'
      | 'centerLeft'
      | 'center'
      | 'centerRight'
      | 'bottomLeft'
      | 'bottomCenter'
      | 'bottomRight',
    size: number,
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

    const textSizeInput = this.page
      .locator('.text-size-grid-layout .custom-number-input input')
      .nth(positions[position])

    await textSizeInput.clear()
    await textSizeInput.fill(size.toString())
    await textSizeInput.dispatchEvent('change')
    await textSizeInput.blur()

    // Wait for the canvas to update
    await this.waitForRender()
  }

  async setLabelColor(
    position:
      | 'topLeft'
      | 'topCenter'
      | 'topRight'
      | 'centerLeft'
      | 'center'
      | 'centerRight'
      | 'bottomLeft'
      | 'bottomCenter'
      | 'bottomRight',
    color: string,
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

    // Click the color picker for this label position
    const colorPickerButton = this.page
      .locator('.labels-grid .label-color-picker')
      .nth(positions[position])
    await colorPickerButton.click()

    // Wait for picker popup to appear
    const colorPickerPopup = this.page.locator('.color-picker-popup')
    await expect(colorPickerPopup).toBeVisible()

    // Enter hex value in the hex input field of the custom color picker
    const hexInput = this.page.locator('.color-picker-popup input[placeholder="000000"]').first()
    await hexInput.fill(color.replace('#', ''))
    await hexInput.press('Enter')

    // Click OK button to confirm and wait for popup to disappear
    const okButton = this.page.locator('.color-picker-popup .btn-primary')
    await okButton.click()
    await expect(colorPickerPopup).toBeHidden()

    // Wait for the canvas to update
    await this.waitForRender()
  }

  async setDefaultTextSize(size: number) {
    const defaultTextSizeInput = this.page
      .locator('input[title="Default text size for all labels"]')
      .first()
    await defaultTextSizeInput.clear()
    await defaultTextSizeInput.fill(size.toString())
    await defaultTextSizeInput.dispatchEvent('input')
    await defaultTextSizeInput.dispatchEvent('change')
    await defaultTextSizeInput.blur()

    // Wait for the canvas to update
    await this.waitForRender()
  }

  async setKeyRotation(angle: number, originX?: number, originY?: number) {
    const rotationInput = this.page.locator('input[title="Rotation Angle in Degrees"]').first()
    await rotationInput.clear()
    await rotationInput.fill(angle.toString())
    await rotationInput.dispatchEvent('input')
    await rotationInput.dispatchEvent('change')
    await rotationInput.blur()

    if (originX !== undefined) {
      const rotationXInput = this.page.locator('input[title="Rotation Origin X"]').first()
      await rotationXInput.clear()
      await rotationXInput.fill(originX.toString())
      await rotationXInput.dispatchEvent('input')
      await rotationXInput.dispatchEvent('change')
      await rotationXInput.blur()
    }

    if (originY !== undefined) {
      const rotationYInput = this.page.locator('input[title="Rotation Origin Y"]').first()
      await rotationYInput.clear()
      await rotationYInput.fill(originY.toString())
      await rotationYInput.dispatchEvent('input')
      await rotationYInput.dispatchEvent('change')
      await rotationYInput.blur()
    }

    // Wait for the canvas to update with longer timeout for slower browsers
    await this.waitForRender()
  }

  async setKeyOptions(options: {
    ghost?: boolean
    stepped?: boolean
    nub?: boolean
    decal?: boolean
    rotaryEncoder?: boolean
  }) {
    if (options.ghost !== undefined) {
      const ghostCheckbox = this.page.locator('#ghostCheck')
      if (options.ghost) {
        await ghostCheckbox.check()
      } else {
        await ghostCheckbox.uncheck()
      }
    }

    if (options.stepped !== undefined) {
      const steppedCheckbox = this.page.locator('#steppedCheck')
      if (options.stepped) {
        await steppedCheckbox.check()
      } else {
        await steppedCheckbox.uncheck()
      }
    }

    if (options.nub !== undefined) {
      const nubCheckbox = this.page.locator('#nubCheck')
      if (options.nub) {
        await nubCheckbox.check()
      } else {
        await nubCheckbox.uncheck()
      }
    }

    if (options.decal !== undefined) {
      const decalCheckbox = this.page.locator('#decalCheck')
      if (options.decal) {
        await decalCheckbox.check()
      } else {
        await decalCheckbox.uncheck()
      }
    }

    if (options.rotaryEncoder !== undefined) {
      const rotaryEncoderCheckbox = this.page.locator('#rotaryEncoderCheck')
      if (options.rotaryEncoder) {
        await rotaryEncoderCheckbox.check()
      } else {
        await rotaryEncoderCheckbox.uncheck()
      }
    }

    // Wait for the canvas to update
    await this.waitForRender()
  }

  async waitForRender() {
    // Wait for canvas to be visible and any pending renders to complete
    await expect(this.getCanvas()).toBeVisible()
    // Ensure canvas is attached and ready for interaction
    await this.getCanvas().waitFor({ state: 'attached' })
    // Wait for double animation frame - this ensures the renderScheduler
    // has processed any pending render callbacks
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  getCanvas(): Locator {
    return this.page.locator('.keyboard-canvas')
  }

  async expectCanvasScreenshot(name: string) {
    // For canvas rendering tests, all browsers should produce identical results
    const canvas = this.getCanvas()
    await expect(canvas).toHaveScreenshot(`${name}.png`)
  }

  async clearLayout() {
    // Clear any existing keys by evaluating JavaScript if needed
    await this.page.evaluate(() => {
      // This would need to be implemented based on the actual store API
      console.log('Clearing layout - implement if needed')
    })
  }

  async loadPreset(presetIndex: number) {
    // Open the presets dropdown
    const presetButton = this.page.locator('.preset-dropdown button.preset-select')
    await presetButton.click()

    // Click the specific preset item
    const presetItems = this.page.locator('.preset-dropdown .dropdown-item')
    await presetItems.nth(presetIndex).click()

    // Wait for layout to load with increased timeout for CI environments
    await this.page.waitForFunction(
      () => {
        const keysCounter = document.querySelector('.keys-counter')?.textContent
        if (!keysCounter) return false
        const match = keysCounter.match(/Keys: (\d+)/)
        return match && parseInt(match[1]) >= 10 // At least 10 keys for most presets
      },
      { timeout: 60000 },
    )
  }

  async selectAllKeys() {
    const canvas = this.getCanvas()
    await canvas.click()
    await this.page.keyboard.press('Control+a')
  }

  async deselectAllKeys() {
    const canvas = this.getCanvas()
    // Focus the canvas and press Escape to deselect all keys
    await canvas.focus()
    await this.page.keyboard.press('Escape')
  }

  // Helper to wait for UI state changes with proper assertions
  async waitForUIState(
    locator: Locator,
    expectedState: 'visible' | 'hidden' | 'enabled' | 'disabled',
  ) {
    switch (expectedState) {
      case 'visible':
        await expect(locator).toBeVisible()
        break
      case 'hidden':
        await expect(locator).toBeHidden()
        break
      case 'enabled':
        await expect(locator).toBeEnabled()
        break
      case 'disabled':
        await expect(locator).toBeDisabled()
        break
    }
  }

  // Helper to wait for text changes
  async waitForTextChange(locator: Locator, expectedText: string | RegExp) {
    await expect(locator).toContainText(expectedText)
  }

  // Helper for operations that need canvas stabilization
  async waitForCanvasStability() {
    const canvas = this.getCanvas()
    await expect(canvas).toBeVisible()
    // Ensure canvas is ready for interaction
    await canvas.waitFor({ state: 'attached' })
  }

  // Zoom controls for regression testing
  async zoomIn(clicks: number = 1) {
    // With new zoom input, simulate zoom in by increasing by 20% per click
    const currentZoom = await this.getZoomLevel()
    const targetZoom = Math.min(500, currentZoom + clicks * 20)
    await this.setZoomLevel(targetZoom)
  }

  async zoomOut(clicks: number = 1) {
    // With new zoom input, simulate zoom out by decreasing by 20% per click
    const currentZoom = await this.getZoomLevel()
    const targetZoom = Math.max(10, currentZoom - clicks * 20)
    await this.setZoomLevel(targetZoom)
  }

  async setZoomLevel(zoomPercent: number) {
    // Set zoom level via the new custom number input
    const zoomInput = this.page.locator('.zoom-control .custom-number-input input')
    await zoomInput.clear()
    await zoomInput.fill(zoomPercent.toString())
    await zoomInput.dispatchEvent('change')
    await zoomInput.blur()
    await this.waitForRender()
  }

  async resetZoom() {
    // Reset zoom by setting the zoom input to 100%
    await this.setZoomLevel(100)
  }

  async getZoomLevel() {
    // Get zoom percentage from the zoom input value
    const zoomInput = this.page.locator('.zoom-control .custom-number-input input')
    const zoomValue = await zoomInput.inputValue()
    return parseInt(zoomValue || '100')
  }

  // =============================================================================
  // Non-Rectangular Key Layout Methods
  // =============================================================================

  /**
   * Load a custom JSON layout by directly manipulating the JSON editor
   */
  async loadJsonLayout(jsonString: string) {
    const jsonTextarea = this.page.locator('textarea.form-control.font-monospace')
    await jsonTextarea.clear()
    await jsonTextarea.fill(jsonString)
    await this.page.click('button:has-text("Apply Changes")')
    await this.waitHelpers.waitForQuadAnimationFrame()
  }

  /**
   * Load a big-ass-enter key layout
   */
  async loadBigAssEnterLayout() {
    const layout = JSON.stringify([
      [{ x: 0.75, a: 0, w: 1.5, h: 2, w2: 2.25, h2: 1, x2: -0.75, y2: 1 }, 'Enter'],
    ])
    await this.loadJsonLayout(layout)
  }

  /**
   * Load an ISO enter key layout
   */
  async loadISOEnterLayout() {
    const layout = JSON.stringify([
      [{ x: 0.25, w: 1.25, h: 2, w2: 1.5, h2: 1, x2: -0.25 }, 'ISO Enter'],
    ])
    await this.loadJsonLayout(layout)
  }

  /**
   * Load a custom non-rectangular J-shaped key layout
   */
  async loadCustomJLayout() {
    const layout = JSON.stringify([
      [{ x: 0, w: 2, h: 1, w2: 1, h2: 2, x2: 1, y2: 0.75 }, 'Custom J'],
    ])
    await this.loadJsonLayout(layout)
  }

  /**
   * Load a layout with multiple non-rectangular keys
   */
  async loadMixedNonRectangularLayout() {
    const layout = JSON.stringify([
      [{ w: 1.5 }, 'Tab', { w: 1, h: 1 }, 'Q', 'W', 'E'],
      [{ w: 1.75 }, 'Caps', 'A', 'S', 'D'],
      [{ x: 0.25, w: 1.25, h: 2, w2: 1.5, h2: 1, x2: -0.25 }, 'ISO Enter'],
      [{ x: 2.75, w: 1.5, h: 2, w2: 2.25, h2: 1, x2: -0.75, y2: 1 }, 'Big Ass Enter'],
    ])
    await this.loadJsonLayout(layout)
  }

  /**
   * Load a colored big-ass-enter key layout
   */
  async loadColoredBigAssEnterLayout() {
    const layout = JSON.stringify([
      [
        {
          x: 0.75,
          a: 0,
          w: 1.5,
          h: 2,
          w2: 2.25,
          h2: 1,
          x2: -0.75,
          y2: 1,
          c: '#ff6b35',
          t: '#ffffff',
        },
        'Enter',
      ],
    ])
    await this.loadJsonLayout(layout)
  }

  /**
   * Click on canvas at specific position
   */
  async clickCanvasAt(x: number, y: number) {
    await this.getCanvas().click({ position: { x, y }, force: true })
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  /**
   * Click on the big-ass-enter key to select it
   * Uses known position for reliable selection
   */
  async selectBigAssEnterKey() {
    await this.clickCanvasAt(140, 80)
  }

  /**
   * Get keys counter locator
   */
  getKeysCounter() {
    return this.page.locator('.keys-counter')
  }

  /**
   * Get properties panel locator
   */
  getPropertiesPanel() {
    return this.page.locator('.key-properties-panel')
  }

  /**
   * Assert keys counter shows expected count
   */
  async expectKeysCount(count: number) {
    await expect(this.getKeysCounter()).toContainText(`Keys: ${count}`)
  }

  /**
   * Assert properties panel is visible
   */
  async expectPropertiesPanelVisible() {
    await expect(this.getPropertiesPanel()).toBeVisible()
  }
}
