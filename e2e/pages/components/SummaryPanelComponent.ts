import { Locator, Page, expect } from '@playwright/test'

/**
 * SummaryPanelComponent - Summary tab and Key Center Positions
 *
 * Encapsulates interactions with the Summary tab, including:
 * - Navigating to the Summary tab
 * - Accessing the Key Center Positions table
 * - Reading and validating key center coordinates
 * - Toggling between U and mm units
 *
 * @example
 * const summary = new SummaryPanelComponent(page)
 * await summary.navigateToSummaryTab()
 * const centers = await summary.getAllKeyCenterPositions()
 */
export class SummaryPanelComponent {
  private readonly summaryTabButton: Locator
  private readonly keyCentersTable: Locator
  private readonly unitsToggleU: Locator
  private readonly unitsToggleMM: Locator

  constructor(private readonly page: Page) {
    this.summaryTabButton = page.locator('button.tab-btn:has-text("Summary")')
    this.keyCentersTable = page.locator('.key-centers-table-container table')
    this.unitsToggleU = page.locator('label[for="centers-units-u"]')
    this.unitsToggleMM = page.locator('label[for="centers-units-mm"]')
  }

  /**
   * Navigate to the Summary tab
   */
  async navigateToSummaryTab() {
    await this.summaryTabButton.click()
    await this.keyCentersTable.waitFor({ state: 'visible', timeout: 5000 })
  }

  /**
   * Get the count of rows in the key centers table
   * @returns Number of keys in the table
   */
  async getKeyCenterCount(): Promise<number> {
    const rows = this.keyCentersTable.locator('tbody tr')
    return await rows.count()
  }

  /**
   * Get the center position for a specific key by index
   * @param index - Key index (0-based)
   * @returns Object with x and y coordinates as numbers (rounded to 6 decimals)
   */
  async getKeyCenterPosition(index: number): Promise<{ x: number; y: number }> {
    const rows = this.keyCentersTable.locator('tbody tr')
    const row = rows.nth(index)

    // Get the X and Y cell values (2nd and 3rd columns)
    const xCell = row.locator('td').nth(1)
    const yCell = row.locator('td').nth(2)

    const xText = await xCell.textContent()
    const yText = await yCell.textContent()

    if (!xText || !yText) {
      throw new Error(`Could not read coordinates for key at index ${index}`)
    }

    // Parse and round to 6 decimal places for exact comparison
    const x = parseFloat(parseFloat(xText.trim()).toFixed(6))
    const y = parseFloat(parseFloat(yText.trim()).toFixed(6))

    return { x, y }
  }

  /**
   * Get all key center positions from the table
   * @returns Array of objects with index, x, and y
   */
  async getAllKeyCenterPositions(): Promise<Array<{ index: number; x: number; y: number }>> {
    const count = await this.getKeyCenterCount()
    const positions: Array<{ index: number; x: number; y: number }> = []

    for (let i = 0; i < count; i++) {
      const position = await this.getKeyCenterPosition(i)
      positions.push({
        index: i,
        x: position.x,
        y: position.y,
      })
    }

    return positions
  }

  /**
   * Toggle units between U and mm
   * @param units - 'U' for units or 'mm' for millimeters
   */
  async toggleUnits(units: 'U' | 'mm') {
    if (units === 'U') {
      await this.unitsToggleU.click()
    } else {
      await this.unitsToggleMM.click()
    }
    // Wait for the table to update
    await this.page.waitForTimeout(100)
  }

  /**
   * Assert that the key centers table is visible
   */
  async expectVisible() {
    await expect(this.keyCentersTable).toBeVisible()
  }

  /**
   * Assert that the key centers table has the expected row count
   * @param expectedCount - Expected number of rows
   */
  async expectKeyCenterCount(expectedCount: number) {
    const rows = this.keyCentersTable.locator('tbody tr')
    await expect(rows).toHaveCount(expectedCount)
  }

  /**
   * Get the spacing info displayed in the summary
   * Note: This reads from the metadata, not from the UI directly
   * @returns Object with x and y spacing values
   */
  async getSpacingInfo(): Promise<{ x: number; y: number }> {
    // The spacing is passed to the KeyCentersTable component
    // We can verify it by checking the mm conversion
    // First, get a position in U mode
    await this.toggleUnits('U')
    const posU = await this.getKeyCenterPosition(0)

    // Then get the same position in mm mode
    await this.toggleUnits('mm')
    const posMM = await this.getKeyCenterPosition(0)

    // Calculate spacing from the conversion
    // mm = U * spacing, so spacing = mm / U
    const spacingX = posU.x !== 0 ? posMM.x / posU.x : 19.05
    const spacingY = posU.y !== 0 ? posMM.y / posU.y : 19.05

    return {
      x: parseFloat(spacingX.toFixed(6)),
      y: parseFloat(spacingY.toFixed(6)),
    }
  }

  /**
   * Click on a table header to sort by that column
   * @param column - Column to sort by ('index', 'x', or 'y')
   */
  async sortByColumn(column: 'index' | 'x' | 'y') {
    const headerMap = {
      index: '#',
      x: 'X',
      y: 'Y',
    }
    const header = this.keyCentersTable.locator('th').filter({ hasText: headerMap[column] })
    await header.click()
    // Wait for sort to apply
    await this.page.waitForTimeout(100)
  }

  /**
   * Get the current unit mode from the table header
   * @returns 'U' or 'mm'
   */
  async getCurrentUnits(): Promise<'U' | 'mm'> {
    const xHeader = this.keyCentersTable.locator('th').filter({ hasText: 'X' })
    const headerText = await xHeader.textContent()
    return headerText?.includes('(mm)') ? 'mm' : 'U'
  }
}
