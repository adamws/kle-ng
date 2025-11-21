import { Locator, Page, expect } from '@playwright/test'

/**
 * MatrixModalComponent - Matrix coordinates modal interactions
 *
 * Encapsulates interactions with the matrix coordinates drawing modal,
 * including opening, drawing rows/columns, and applying coordinates.
 *
 * @example
 * const matrix = new MatrixModalComponent(page)
 * await matrix.open()
 * await matrix.drawRow(0, 2)  // Draw from column 0 to column 2
 * await matrix.apply()
 */
export class MatrixModalComponent {
  private readonly modal: Locator
  private readonly overlay: Locator
  private readonly rowButton: Locator
  private readonly columnButton: Locator
  private readonly applyButton: Locator
  private readonly autoAnnotateButton: Locator

  // Canvas constants
  private readonly UNIT = 54 // Default unit size
  private readonly BORDER = 9 // Canvas border
  private readonly OFFSET = this.UNIT / 2 + this.BORDER // Center of first key

  constructor(private readonly page: Page) {
    this.modal = page.locator('.matrix-modal')
    this.overlay = page.locator('canvas.matrix-annotation-overlay')
    this.rowButton = page.locator('.matrix-modal button').filter({ hasText: 'Draw Rows' })
    this.columnButton = page.locator('.matrix-modal button').filter({ hasText: 'Draw Columns' })
    this.applyButton = page.locator('.matrix-modal button').filter({ hasText: 'Apply' })
    this.autoAnnotateButton = page
      .locator('.matrix-modal button')
      .filter({ hasText: 'Auto-Annotate' })
  }

  /**
   * Open the matrix coordinates modal
   */
  async open() {
    await this.page.locator('.extra-tools-group button').click()
    await this.page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({
        hasText: 'Add Switch Matrix Coordinates',
      })
      .click()

    await expect(this.modal).toBeVisible()

    // Wait for modal to be ready using RAF
    await this.page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve())
        })
      })
    })
  }

  /**
   * Switch to row drawing mode
   */
  async switchToRowMode() {
    await this.rowButton.click()

    // Wait for mode switch using RAF
    await this.page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve())
        })
      })
    })
  }

  /**
   * Switch to column drawing mode
   */
  async switchToColumnMode() {
    await this.columnButton.click()

    // Wait for mode switch using RAF
    await this.page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve())
        })
      })
    })
  }

  /**
   * Click auto-annotate button
   */
  async autoAnnotate() {
    await this.autoAnnotateButton.click()

    // Wait for auto-annotation using RAF
    await this.page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve())
        })
      })
    })
  }

  /**
   * Draw a row by clicking start and end positions
   * @param startCol - Starting column index
   * @param endCol - Ending column index
   * @param rowIndex - Row index (0-based)
   */
  async drawRow(startCol: number, endCol: number, rowIndex: number = 0) {
    const startX = this.OFFSET + startCol * this.UNIT
    const endX = this.OFFSET + endCol * this.UNIT
    const y = this.OFFSET + rowIndex * this.UNIT

    // Click start position
    await this.overlay.click({ position: { x: startX, y } })

    // Wait for click to register using RAF
    await this.page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
    })

    // Click end position
    await this.overlay.click({ position: { x: endX, y } })

    // Wait for row to be drawn using RAF
    await this.page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve())
        })
      })
    })
  }

  /**
   * Draw a column by clicking start and end positions
   * @param startRow - Starting row index
   * @param endRow - Ending row index
   * @param colIndex - Column index (0-based)
   */
  async drawColumn(startRow: number, endRow: number, colIndex: number = 0) {
    const x = this.OFFSET + colIndex * this.UNIT
    const startY = this.OFFSET + startRow * this.UNIT
    const endY = this.OFFSET + endRow * this.UNIT

    // Click start position
    await this.overlay.click({ position: { x, y: startY } })

    // Wait for click to register using RAF
    await this.page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
    })

    // Click end position
    await this.overlay.click({ position: { x, y: endY } })

    // Wait for column to be drawn using RAF
    await this.page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve())
        })
      })
    })
  }

  /**
   * Click at a specific canvas position
   * @param x - X coordinate
   * @param y - Y coordinate
   */
  async clickAt(x: number, y: number) {
    await this.overlay.click({ position: { x, y } })

    // Wait for click using RAF
    await this.page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
    })
  }

  /**
   * Apply the matrix coordinates
   */
  async apply() {
    await this.applyButton.click()
    await expect(this.modal).toBeHidden()
  }

  /**
   * Assert that the overlay has the expected screenshot
   * @param name - Screenshot name
   */
  async expectOverlayScreenshot(name: string) {
    await expect(this.overlay).toHaveScreenshot(name)
  }

  /**
   * Assert that the modal is visible
   */
  async expectVisible() {
    await expect(this.modal).toBeVisible()
  }

  /**
   * Assert that row mode is active
   */
  async expectRowModeActive() {
    await expect(this.rowButton).toHaveClass(/btn-draw-rows/)
  }

  /**
   * Assert that column mode is active
   */
  async expectColumnModeActive() {
    await expect(this.columnButton).toHaveClass(/btn-draw-columns/)
  }

  /**
   * Get the overlay locator for advanced operations
   */
  getOverlay(): Locator {
    return this.overlay
  }
}
