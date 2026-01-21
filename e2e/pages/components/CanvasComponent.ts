import { Locator, Page, expect } from '@playwright/test'
import { SELECTORS } from '../../constants/selectors'
import { CANVAS_CONSTANTS } from '../../constants/canvas-dimensions'

/**
 * CanvasComponent - Canvas interactions and rendering
 *
 * Encapsulates all canvas-related interactions including clicking,
 * selecting, and waiting for rendering.
 *
 * @example
 * const canvas = new CanvasComponent(page)
 * await canvas.clickKey(0) // Click first key
 * await canvas.waitForRender()
 */
export class CanvasComponent {
  private readonly canvas: Locator

  constructor(private readonly page: Page) {
    this.canvas = page.locator(SELECTORS.CANVAS.MAIN)
  }

  /**
   * Click on the canvas to focus it
   */
  async click() {
    await this.canvas.click()
  }

  /**
   * Click on a key at the given row/column position
   * @param row - Row index (0-based)
   * @param col - Column index (0-based, defaults to 0)
   */
  async clickKey(row: number, col: number = 0) {
    const position = CANVAS_CONSTANTS.getKeyPosition(row, col)
    await this.canvas.click({ position })
  }

  /**
   * Click at specific pixel coordinates on the canvas
   * @param x - X coordinate in pixels
   * @param y - Y coordinate in pixels
   * @param options - Additional click options
   */
  async clickAt(
    x: number,
    y: number,
    options?: {
      force?: boolean
      modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift'>
    },
  ) {
    await this.canvas.click({ position: { x, y }, ...options })
  }

  /**
   * Click at coordinates specified in units (U)
   * @param xUnits - X coordinate in units (1U = standard key width)
   * @param yUnits - Y coordinate in units
   * @param options - Additional click options
   */
  async clickAtUnits(
    xUnits: number,
    yUnits: number,
    options?: {
      force?: boolean
      modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift'>
    },
  ) {
    const position = CANVAS_CONSTANTS.getPositionFromUnits(xUnits, yUnits)
    await this.canvas.click({ position, ...options })
  }

  /**
   * Select all keys using keyboard shortcut (Ctrl+A)
   */
  async selectAll() {
    // Canvas is sized to fit keys.
    // Border is 9px, so clicking at (5, 5) hits the border area (empty)
    // avoiding potential issues with overlaping keys selection dropdown
    await this.clickAt(5, 5)
    await this.canvas.focus() // Ensure focus in case popup appeared
    await this.page.keyboard.press('Control+a')
  }

  /**
   * Deselect all keys by pressing Escape
   */
  async deselectAll() {
    await this.canvas.focus()
    await this.page.keyboard.press('Escape')
  }

  /**
   * Wait for canvas rendering to complete
   *
   * This ensures:
   * 1. Canvas is visible
   * 2. Canvas is attached to DOM
   * 3. requestAnimationFrame cycles have completed
   */
  async waitForRender() {
    // Wait for canvas to be visible and attached
    await expect(this.canvas).toBeVisible()
    await this.canvas.waitFor({ state: 'attached' })

    // Wait for requestAnimationFrame to complete
    // This ensures the renderScheduler has processed any pending render callbacks
    await this.page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          // Wait one more frame to ensure the render has completed
          requestAnimationFrame(() => {
            resolve()
          })
        })
      })
    })
  }

  /**
   * Get the canvas locator for advanced operations
   */
  getLocator(): Locator {
    return this.canvas
  }

  /**
   * Take a screenshot of the canvas and compare with baseline
   * @param name - Screenshot name (without extension)
   */
  async expectScreenshot(name: string, options?: { failureMessage?: string }) {
    await expect(this.canvas, options?.failureMessage).toHaveScreenshot(`${name}.png`)
  }

  /**
   * Assert that the canvas is visible
   */
  async expectVisible() {
    await expect(this.canvas).toBeVisible()
  }

  /**
   * Get the bounding box of the canvas
   */
  async getBoundingBox() {
    return await this.canvas.boundingBox()
  }
}
