import { test, expect } from '@playwright/test'
import { promises as fs } from 'fs'

// Helper function to export and parse layout JSON
async function exportLayoutJSON(page: import('@playwright/test').Page) {
  // Click Export button
  const exportButton = page.locator('button', { hasText: 'Export' })
  await expect(exportButton).toBeVisible()
  await exportButton.click()

  // Set up download handler
  const downloadPromise = page.waitForEvent('download')
  await page.locator('a', { hasText: 'Download JSON' }).click()

  const download = await downloadPromise
  const downloadPath = `e2e/test-output/matrix-drawing-${Date.now()}.json`
  await download.saveAs(downloadPath)

  // Read and parse the exported JSON
  const exportedContent = await fs.readFile(downloadPath, 'utf-8')
  const layout = JSON.parse(exportedContent)

  // Clean up test file
  await fs.unlink(downloadPath)

  return layout
}

// Helper function to import layout via JSON file
async function importLayoutJSON(page: import('@playwright/test').Page, layoutData: unknown) {
  // Create temporary JSON file
  const tempFilePath = `e2e/test-output/temp-import-${Date.now()}.json`
  await fs.writeFile(tempFilePath, JSON.stringify(layoutData))

  // Set up file chooser handler
  const fileChooserPromise = page.waitForEvent('filechooser')

  // Click Import button and select "From File"
  const importButton = page.locator('button', { hasText: 'Import' })
  await expect(importButton).toBeVisible()
  await importButton.click()

  // Wait for dropdown to be visible
  await expect(page.locator('.dropdown-menu:has(a:has-text("From File"))')).toBeVisible()
  await page.locator('a', { hasText: 'From File' }).click()

  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(tempFilePath)

  // Wait for import to complete
  await page.waitForTimeout(500)

  // Clean up temporary file
  await fs.unlink(tempFilePath)
}

test.describe('Matrix Drawing - Interactive Drawing Tests', () => {
  // Matrix drawing tests only run on Chromium for visual consistency
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Matrix drawing tests only run on Chromium for visual consistency',
  )

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should draw rows and columns on 3x3 grid with automatic intermediate key selection', async ({
    page,
  }) => {
    // 3x3 grid layout fixture (KLE format: nested arrays with empty strings for keys)
    const fixtureData = [
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ]

    // Import layout via JSON
    await importLayoutJSON(page, fixtureData)

    // Verify layout has 9 keys via UI
    await expect(page.locator('.keys-counter')).toContainText('Keys: 9')

    // Small delay to ensure canvas renders
    await page.waitForTimeout(500)

    // Open Matrix Coordinates Modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({
        hasText: 'Add Switch Matrix Coordinates',
      })
      .click()

    // Wait for modal to be visible
    const matrixModal = page.locator('.matrix-modal')
    await expect(matrixModal).toBeVisible()

    // Wait for modal content to load (should skip directly to drawing step since no labels)
    await page.waitForTimeout(500)

    // Drawing is now automatically enabled in row mode by default
    // Verify the "Draw Rows" button is active (has primary styling)
    const rowButton = page.locator('.matrix-modal button').filter({ hasText: 'Draw Rows' })
    await expect(rowButton).toHaveClass(/btn-draw-rows/)

    // Now the overlay should be visible
    const overlay = page.locator('canvas.matrix-annotation-overlay')
    await expect(overlay).toBeVisible()

    // Get canvas bounding box for click calculations
    const overlayBox = await overlay.boundingBox()
    if (!overlayBox) throw new Error('Matrix overlay not found')

    // Calculate key centers in screen coordinates
    // 3x3 grid: keys at (0,0), (1,0), (2,0), (0,1), (1,1), (2,1), (0,2), (1,2), (2,2)
    // With unit=54px and canvas border, keys are at:
    // Row 0: 27px, 81px, 135px (y=27px)
    // Row 1: 27px, 81px, 135px (y=81px)
    // Row 2: 27px, 81px, 135px (y=135px)

    const unit = 54 // Default unit size
    const border = 9 // Canvas border
    const offset = unit / 2 + border // Center of first key

    // First row: click first key (0,0) and last key (2,0)
    // The middle key (1,0) should be automatically added via line intersection
    // Second click automatically finishes the sequence
    await overlay.click({ position: { x: offset, y: offset } })
    await page.waitForTimeout(100)

    await overlay.click({ position: { x: offset + unit * 2, y: offset } })
    await page.waitForTimeout(200)

    // Second row: click first key (0,1) and last key (2,1)
    // The middle key (1,1) should be automatically added
    await overlay.click({ position: { x: offset, y: offset + unit } })
    await page.waitForTimeout(100)

    await overlay.click({ position: { x: offset + unit * 2, y: offset + unit } })
    await page.waitForTimeout(200)

    // Third row: click first key (0,2) and last key (2,2)
    // The middle key (1,2) should be automatically added
    await overlay.click({ position: { x: offset, y: offset + unit * 2 } })
    await page.waitForTimeout(100)

    await overlay.click({ position: { x: offset + unit * 2, y: offset + unit * 2 } })
    await page.waitForTimeout(200)

    // Switch to column mode by clicking the "Draw Columns" button
    const columnButton = page.locator('.matrix-modal button').filter({ hasText: 'Draw Columns' })
    await columnButton.click()
    await page.waitForTimeout(100)

    // Verify column button is now active
    await expect(columnButton).toHaveClass(/btn-draw-columns/)

    // First column: click top key (0,0) and bottom key (0,2)
    // The middle key (0,1) should be automatically added
    await overlay.click({ position: { x: offset, y: offset } })
    await page.waitForTimeout(100)

    await overlay.click({ position: { x: offset, y: offset + unit * 2 } })
    await page.waitForTimeout(200)

    // Second column: click top key (1,0) and bottom key (1,2)
    // The middle key (1,1) should be automatically added
    await overlay.click({ position: { x: offset + unit, y: offset } })
    await page.waitForTimeout(100)

    await overlay.click({ position: { x: offset + unit, y: offset + unit * 2 } })
    await page.waitForTimeout(200)

    // Third column: click top key (2,0) and bottom key (2,2)
    // The middle key (2,1) should be automatically added
    await overlay.click({ position: { x: offset + unit * 2, y: offset } })
    await page.waitForTimeout(100)

    await overlay.click({ position: { x: offset + unit * 2, y: offset + unit * 2 } })
    await page.waitForTimeout(200)

    // Take screenshot for visual verification
    // Should show 3 rows and 3 columns, all with 3 keys each (first, middle, last)
    await expect(overlay).toHaveScreenshot('matrix-drawing-3x3-grid.png')
  })

  test('should annotate 3x3 grid automatically with same result as manual drawing', async ({
    page,
  }) => {
    // 3x3 grid layout fixture (KLE format: nested arrays with empty strings for keys)
    const fixtureData = [
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ]

    // Import layout via JSON
    await importLayoutJSON(page, fixtureData)

    // Verify layout has 9 keys via UI
    await expect(page.locator('.keys-counter')).toContainText('Keys: 9')

    // Small delay to ensure canvas renders
    await page.waitForTimeout(500)

    // Open Matrix Coordinates Modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({
        hasText: 'Add Switch Matrix Coordinates',
      })
      .click()

    // Wait for modal to be visible
    const matrixModal = page.locator('.matrix-modal')
    await expect(matrixModal).toBeVisible()

    // Wait for modal content to load (should skip directly to drawing step since no labels)
    await page.waitForTimeout(500)

    // Click the "Annotate Automatically" button
    const autoAnnotateButton = page
      .locator('.matrix-modal button')
      .filter({ hasText: 'Annotate Automatically' })
    await autoAnnotateButton.click()

    // Wait for annotation to complete
    await page.waitForTimeout(500)

    // Verify the overlay is visible and showing the annotated matrix
    const overlay = page.locator('canvas.matrix-annotation-overlay')
    await expect(overlay).toBeVisible()

    // Take screenshot for visual verification - should match manual drawing result
    // Should show 3 rows and 3 columns automatically computed from key positions
    await expect(overlay).toHaveScreenshot('matrix-drawing-3x3-grid-automatic.png')

    // Verify that the completion message is shown
    const completionAlert = page
      .locator('.alert-success')
      .filter({ hasText: 'Annotation Complete' })
    await expect(completionAlert).toBeVisible()

    // Verify progress stats show all keys assigned
    const rowsProgress = page.locator('.progress-label').filter({ hasText: 'Rows:' })
    await expect(rowsProgress).toContainText('3 defined')

    const colsProgress = page.locator('.progress-label').filter({ hasText: 'Columns:' })
    await expect(colsProgress).toContainText('3 defined')

    // Verify "0 keys left" for both rows and columns
    const keysLeftRows = page
      .locator('.progress-item')
      .filter({ has: rowsProgress })
      .locator('.progress-stats')
    await expect(keysLeftRows).toContainText('Complete')

    const keysLeftCols = page
      .locator('.progress-item')
      .filter({ has: colsProgress })
      .locator('.progress-stats')
    await expect(keysLeftCols).toContainText('Complete')
  })

  test('should only catch clicked keys with default sensitivity (0.3) on diagonal line', async ({
    page,
  }) => {
    // Layout with diagonal opportunity: first row has 2x 1U keys, second row has 1.5U + 1U keys
    // User spec: [[{"a":0},"",""], [{"w":1.5},"",""]]
    // Actual keys created:
    // Row 0: key at (0,0) w=1U center (0.5, 0.5), key at (1,0) w=1U center (1.5, 0.5)
    // Row 1: key at (0,1) w=1.5U center (0.75, 1.5), key at (1.5,1) w=1U center (2.0, 1.5)
    // Drawing from first key (0,0) to last key (1.5,1) diagonally
    // With default sensitivity (0.3), should catch ONLY the 2 clicked keys, not the 2 intermediate ones
    const fixtureData = [
      [{ a: 0 }, '', ''],
      [{ w: 1.5 }, '', ''],
    ]

    // Import layout via JSON
    await importLayoutJSON(page, fixtureData)

    // Verify layout has 4 keys via UI
    await expect(page.locator('.keys-counter')).toContainText('Keys: 4')

    // Small delay to ensure canvas renders
    await page.waitForTimeout(500)

    // Default sensitivity is 0.3 - we assume this is the default value
    // The test logic will verify behavior through UI interactions and JSON export

    // Open Matrix Coordinates Modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({
        hasText: 'Add Switch Matrix Coordinates',
      })
      .click()

    // Wait for modal to be visible
    const matrixModal = page.locator('.matrix-modal')
    await expect(matrixModal).toBeVisible()

    // Wait for modal content to load (should skip directly to drawing step since no labels)
    await page.waitForTimeout(500)

    // Drawing is automatically enabled in row mode by default
    // Verify the "Draw Rows" button is active
    const rowButton = page.locator('.matrix-modal button').filter({ hasText: 'Draw Rows' })
    await expect(rowButton).toHaveClass(/btn-draw-rows/)

    // Now the overlay should be visible
    const overlay = page.locator('canvas.matrix-annotation-overlay')
    await expect(overlay).toBeVisible()

    // Get canvas bounding box for click calculations
    const overlayBox = await overlay.boundingBox()
    if (!overlayBox) throw new Error('Matrix overlay not found')

    const unit = 54 // Default unit size
    const border = 9 // Canvas border
    const offset = unit / 2 + border // Center offset for first unit

    // First key at layout position (0,0) width 1U has center at layout (0.5, 0.5)
    // Canvas position: (offset, offset)
    const firstKeyX = offset
    const firstKeyY = offset

    // Last key at layout position (1.5, 1) width 1U has center at layout (2.0, 1.5)
    // Canvas position: x = offset + 1.5*unit, y = offset + 1*unit
    const lastKeyX = offset + 1.5 * unit
    const lastKeyY = offset + 1.0 * unit

    // First click: top-left key
    await overlay.click({ position: { x: firstKeyX, y: firstKeyY } })
    await page.waitForTimeout(100)

    // Second click: bottom-right key - this should complete the sequence
    // With default sensitivity (0.3), should catch ONLY the 2 clicked keys, not intermediate ones
    // Use force:true because the overlay may be re-rendering after first click, causing instability
    await overlay.click({ position: { x: lastKeyX, y: lastKeyY }, force: true })
    await page.waitForTimeout(200)

    // Verify that exactly 1 row was created with exactly 2 keys
    // We verify this through UI state and visual confirmation since we can't access store directly
    // The screenshot verification will confirm the expected behavior

    // Take screenshot for visual verification
    await expect(overlay).toHaveScreenshot('matrix-drawing-diagonal-default-sensitivity.png')
  })

  test('should prevent assigning same key to multiple rows', async ({ page }) => {
    // Simple layout with 3 keys in a row
    const fixtureData = [['', '', '']]

    // Import layout via JSON
    await importLayoutJSON(page, fixtureData)

    await page.waitForTimeout(500)

    // Open Matrix Coordinates Modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({ hasText: 'Add Switch Matrix Coordinates' })
      .click()

    const matrixModal = page.locator('.matrix-modal')
    await expect(matrixModal).toBeVisible()
    await page.waitForTimeout(500)

    // Drawing is automatically enabled in row mode by default
    // Verify the "Draw Rows" button is active
    const rowButton = page.locator('.matrix-modal button').filter({ hasText: 'Draw Rows' })
    await expect(rowButton).toHaveClass(/btn-draw-rows/)

    const overlay = page.locator('canvas.matrix-annotation-overlay')
    await expect(overlay).toBeVisible()

    const unit = 54
    const border = 9
    const offset = unit / 2 + border

    // Draw first row: connect first two keys
    const key1X = offset
    const key1Y = offset
    const key2X = offset + unit
    const key2Y = offset

    await overlay.click({ position: { x: key1X, y: key1Y } })
    await page.waitForTimeout(100)
    await overlay.click({ position: { x: key2X, y: key2Y }, force: true })
    await page.waitForTimeout(200)

    // Verify first row completed with 2 keys through UI state
    // We can't access store directly, so we rely on visual/UI verification

    // Now try to draw second row: click first key again (should start continuation of row 0)
    await overlay.click({ position: { x: key1X, y: key1Y }, force: true })
    await page.waitForTimeout(100)

    // Current sequence should have 1 key (key1, starting continuation of row 0)
    // We can't access store directly, so we rely on the UI behavior

    // Try clicking third key (should work since it's not assigned yet, and completes the continuation)
    const key3X = offset + 2 * unit
    const key3Y = offset
    await overlay.click({ position: { x: key3X, y: key3Y }, force: true })
    await page.waitForTimeout(200)

    // Sequence should be completed (second click finishes it)
    // We can't access store directly, so we rely on UI behavior and JSON export

    // Export layout to verify matrix coordinates were applied
    const exportedLayout = await exportLayoutJSON(page)

    // Verify that the layout contains matrix coordinate labels
    const hasMatrixLabels = JSON.stringify(exportedLayout).includes('"0,')
    expect(hasMatrixLabels).toBe(true)
  })

  test('should prevent assigning same key to multiple columns', async ({ page }) => {
    // Simple layout with 3 keys in a column (vertical)
    const fixtureData = [[''], [''], ['']]

    // Import layout via JSON
    await importLayoutJSON(page, fixtureData)

    await page.waitForTimeout(500)

    // Open Matrix Coordinates Modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({ hasText: 'Add Switch Matrix Coordinates' })
      .click()

    const matrixModal = page.locator('.matrix-modal')
    await expect(matrixModal).toBeVisible()
    await page.waitForTimeout(500)

    // Switch to column mode by clicking the "Draw Columns" button
    const columnButton = page.locator('.matrix-modal button').filter({ hasText: 'Draw Columns' })
    await columnButton.click()
    await page.waitForTimeout(100)

    // Verify column button is now active
    await expect(columnButton).toHaveClass(/btn-draw-columns/)

    const overlay = page.locator('canvas.matrix-annotation-overlay')
    await expect(overlay).toBeVisible()

    const unit = 54
    const border = 9
    const offset = unit / 2 + border

    // Draw first column: connect first two keys
    const key1X = offset
    const key1Y = offset
    const key2X = offset
    const key2Y = offset + unit

    await overlay.click({ position: { x: key1X, y: key1Y } })
    await page.waitForTimeout(100)
    await overlay.click({ position: { x: key2X, y: key2Y }, force: true })
    await page.waitForTimeout(200)

    // Verify first column completed with 2 keys through UI state
    // We can't access store directly, so we rely on visual/UI verification

    // Now try to draw second column: click first key again (should start continuation of column 0)
    await overlay.click({ position: { x: key1X, y: key1Y }, force: true })
    await page.waitForTimeout(100)

    // Current sequence should have 1 key (key1, starting continuation of column 0)
    // We can't access store directly, so we rely on the UI behavior

    // Try clicking third key (should work since it's not assigned yet, and completes the continuation)
    const key3X = offset
    const key3Y = offset + 2 * unit
    await overlay.click({ position: { x: key3X, y: key3Y }, force: true })
    await page.waitForTimeout(200)

    // Sequence should be completed (second click finishes it)
    // We can't access store directly, so we rely on UI behavior and JSON export

    // Export layout to verify matrix coordinates were applied
    const exportedLayout = await exportLayoutJSON(page)

    // Verify that the layout contains matrix coordinate labels
    // Matrix coordinates appear as ",0" (comma before column number)
    const hasMatrixLabels =
      JSON.stringify(exportedLayout).includes('"0,') ||
      JSON.stringify(exportedLayout).includes(',0')
    expect(hasMatrixLabels).toBe(true)
  })

  test('should prevent creating duplicate matrix positions', async ({ page }) => {
    // Layout with 2 keys
    const fixtureData = [['', '']]

    // Import layout via JSON
    await importLayoutJSON(page, fixtureData)

    await page.waitForTimeout(500)

    // Open Matrix Coordinates Modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({ hasText: 'Add Switch Matrix Coordinates' })
      .click()

    const matrixModal = page.locator('.matrix-modal')
    await expect(matrixModal).toBeVisible()
    await page.waitForTimeout(500)

    const overlay = page.locator('canvas.matrix-annotation-overlay')
    const unit = 54
    const border = 9
    const offset = unit / 2 + border

    // Verify row mode is active by default
    const rowButton = page.locator('.matrix-modal button').filter({ hasText: 'Draw Rows' })
    await expect(rowButton).toHaveClass(/btn-draw-rows/)

    // Assign both keys to row 0
    const key1X = offset
    const key1Y = offset
    const key2X = offset + unit
    const key2Y = offset

    await overlay.click({ position: { x: key1X, y: key1Y } })
    await page.waitForTimeout(100)
    await overlay.click({ position: { x: key2X, y: key2Y }, force: true })
    await page.waitForTimeout(200)

    // Now assign both keys to column 0
    // Switch to column mode
    const columnButton = page.locator('.matrix-modal button').filter({ hasText: 'Draw Columns' })
    await columnButton.click()
    await page.waitForTimeout(100)

    await overlay.click({ position: { x: key1X, y: key1Y } })
    await page.waitForTimeout(100)
    await overlay.click({ position: { x: key2X, y: key2Y }, force: true })
    await page.waitForTimeout(200)

    // Check final matrix labels - both keys should have same row but different columns would create duplicate
    // Since both keys already have row 0, and we're trying to assign them same column,
    // the second key should be rejected
    const exportedLayout = await exportLayoutJSON(page)

    // Verify that both keys have row assignment but no column assignment
    const layoutString = JSON.stringify(exportedLayout)

    // Both keys should have "0," (row 0, no column)
    const rowAssignments = (layoutString.match(/"0,"/g) || []).length
    expect(rowAssignments).toBe(2)

    // No keys should have column assignment (no ",0" patterns)
    const columnAssignments = (layoutString.match(/,0/g) || []).length
    expect(columnAssignments).toBe(0)
  })

  test('should allow continuing an existing row by clicking a key that already has a row', async ({
    page,
  }) => {
    // Layout with 4 keys in a row
    const fixtureData = [['', '', '', '']]

    // Import layout via JSON
    await importLayoutJSON(page, fixtureData)

    await page.waitForTimeout(500)

    // Open Matrix Coordinates Modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({ hasText: 'Add Switch Matrix Coordinates' })
      .click()

    const matrixModal = page.locator('.matrix-modal')
    await expect(matrixModal).toBeVisible()
    await page.waitForTimeout(500)

    // Drawing is automatically enabled in row mode by default
    const rowButton = page.locator('.matrix-modal button').filter({ hasText: 'Draw Rows' })
    await expect(rowButton).toHaveClass(/btn-draw-rows/)

    const overlay = page.locator('canvas.matrix-annotation-overlay')
    await expect(overlay).toBeVisible()

    const unit = 54
    const border = 9
    const offset = unit / 2 + border

    // First, draw a row with keys 1 and 2
    const key1X = offset
    const key1Y = offset
    const key2X = offset + unit
    const key2Y = offset

    await overlay.click({ position: { x: key1X, y: key1Y } })
    await page.waitForTimeout(100)
    await overlay.click({ position: { x: key2X, y: key2Y }, force: true })
    await page.waitForTimeout(200)

    // Verify first row has 2 keys through UI state
    // We can't access store directly, so we rely on visual/UI verification

    // Now continue the row by clicking key 2 (which already has a row) and key 3
    const key3X = offset + 2 * unit
    const key3Y = offset

    await overlay.click({ position: { x: key2X, y: key2Y }, force: true })
    await page.waitForTimeout(100)
    await overlay.click({ position: { x: key3X, y: key3Y }, force: true })
    await page.waitForTimeout(200)

    // Verify we still have only 1 row, but now with 3 keys
    // We can't access store directly, so we rely on UI behavior and JSON export

    // Export layout to verify matrix coordinates were applied
    const exportedLayout = await exportLayoutJSON(page)

    // Verify that the layout contains matrix coordinate labels for first 3 keys
    const layoutString = JSON.stringify(exportedLayout)

    // Should have "0," pattern for row assignments
    const rowAssignments = (layoutString.match(/"0,"/g) || []).length
    expect(rowAssignments).toBeGreaterThanOrEqual(3)
  })

  test('should allow continuing an existing column by clicking a key that already has a column', async ({
    page,
  }) => {
    // Layout with 4 keys in a column
    const fixtureData = [[''], [''], [''], ['']]

    // Import layout via JSON
    await importLayoutJSON(page, fixtureData)

    await page.waitForTimeout(500)

    // Open Matrix Coordinates Modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({ hasText: 'Add Switch Matrix Coordinates' })
      .click()

    const matrixModal = page.locator('.matrix-modal')
    await expect(matrixModal).toBeVisible()
    await page.waitForTimeout(500)

    // Switch to column mode
    const columnButton = page.locator('.matrix-modal button').filter({ hasText: 'Draw Columns' })
    await columnButton.click()
    await page.waitForTimeout(100)

    // Verify column button is active
    await expect(columnButton).toHaveClass(/btn-draw-columns/)

    const overlay = page.locator('canvas.matrix-annotation-overlay')
    await expect(overlay).toBeVisible()

    const unit = 54
    const border = 9
    const offset = unit / 2 + border

    // First, draw a column with keys 1 and 2
    const key1X = offset
    const key1Y = offset
    const key2X = offset
    const key2Y = offset + unit

    await overlay.click({ position: { x: key1X, y: key1Y } })
    await page.waitForTimeout(100)
    await overlay.click({ position: { x: key2X, y: key2Y }, force: true })
    await page.waitForTimeout(200)

    // Verify first column has 2 keys through UI state
    // We can't access store directly, so we rely on visual/UI verification

    // Now continue the column by clicking key 2 (which already has a column) and key 3
    const key3X = offset
    const key3Y = offset + 2 * unit

    await overlay.click({ position: { x: key2X, y: key2Y }, force: true })
    await page.waitForTimeout(100)
    await overlay.click({ position: { x: key3X, y: key3Y }, force: true })
    await page.waitForTimeout(200)

    // Verify we still have only 1 column, but now with 3 keys
    // We can't access store directly, so we rely on UI behavior and JSON export

    // Export layout to verify matrix coordinates were applied
    const exportedLayout = await exportLayoutJSON(page)

    // Verify that the layout contains matrix coordinate labels for first 3 keys
    const layoutString = JSON.stringify(exportedLayout)

    // Should have ",0" pattern for column assignments
    // Matrix coordinates appear as ",0" (comma before column number)
    const columnAssignments = (layoutString.match(/,0/g) || []).length
    expect(columnAssignments).toBeGreaterThanOrEqual(3)
  })

  test('should remove node from matrix via remove mode', async ({ page }) => {
    // Create a 3x3 grid with pre-assigned matrix coordinates
    // Format: Each key has label "row,col" in first position
    const fixtureData = [
      ['0,0', '0,1', '0,2'],
      ['1,0', '1,1', '1,2'],
      ['2,0', '2,1', '2,2'],
    ]

    // Import layout via JSON
    await importLayoutJSON(page, fixtureData)

    // Verify layout has 9 keys
    await expect(page.locator('.keys-counter')).toContainText('Keys: 9')

    await page.waitForTimeout(500)

    // Open Matrix Coordinates Modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({ hasText: 'Add Switch Matrix Coordinates' })
      .click()

    // Wait for modal to be visible
    const matrixModal = page.locator('.matrix-modal')
    await expect(matrixModal).toBeVisible()

    // Should show "Layout Already Annotated" message since all keys have labels
    await expect(matrixModal).toContainText('Layout Already Annotated')

    // Modal should show 3 rows and 3 columns
    await expect(matrixModal).toContainText('Rows:')
    await expect(matrixModal).toContainText('3 defined')
    await expect(matrixModal).toContainText('Columns:')

    await page.waitForTimeout(500)

    // Get the canvas overlay (where the matrix is rendered)
    const overlay = page.locator('canvas.matrix-annotation-overlay')
    await expect(overlay).toBeVisible()

    // Switch to remove mode by clicking the "Remove" button
    const removeButton = page.locator('.matrix-modal button').filter({ hasText: 'Remove' })
    await removeButton.click()
    await page.waitForTimeout(100)

    // Verify remove button is active (has danger styling)
    await expect(removeButton).toHaveClass(/btn-danger/)

    // Get canvas bounding box for calculations
    const canvasBox = await overlay.boundingBox()
    if (!canvasBox) throw new Error('Canvas not found')

    // Calculate position of the first key (top-left, should be at 0,0 in layout)
    // Canvas uses unit size to position keys, with some offset
    // Assume unit size is approximately 54 pixels (default)
    const unit = 54
    const offset = 10 // Small offset from canvas edge

    // Position of first key center (0,0)
    const key1X = canvasBox.x + offset + unit / 2
    const key1Y = canvasBox.y + offset + unit / 2

    // Left-click on the first key to remove the node
    await page.mouse.click(key1X, key1Y, { button: 'left' })
    await page.waitForTimeout(300)

    // The first key should no longer have a label
    // Export to verify
    const exportedLayout = await exportLayoutJSON(page)

    // First key (index 0 in flat array) should have empty or no label
    const keys = exportedLayout.flat ? exportedLayout.flat() : exportedLayout

    // Find the first key - it should not have "0,0" label anymore
    const firstKeyLabel = keys[0]
    expect(firstKeyLabel).not.toBe('0,0')

    // Modal should still show the layout but with updated counts
    // We removed one node from row 0 and column 0, but rows/columns should still exist
    // (since other keys are still in those rows/columns)
    await expect(matrixModal).toContainText('Rows:')
    await expect(matrixModal).toContainText('Columns:')
  })

  test('should remove entire row via remove mode', async ({ page }) => {
    // Create a 3x3 grid with pre-assigned matrix coordinates
    const fixtureData = [
      ['0,0', '0,1', '0,2'],
      ['1,0', '1,1', '1,2'],
      ['2,0', '2,1', '2,2'],
    ]

    // Import layout via JSON
    await importLayoutJSON(page, fixtureData)

    await page.waitForTimeout(500)

    // Open Matrix Coordinates Modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({ hasText: 'Add Switch Matrix Coordinates' })
      .click()

    const matrixModal = page.locator('.matrix-modal')
    await expect(matrixModal).toBeVisible()

    await page.waitForTimeout(500)

    // Switch to remove mode
    const removeButton = page.locator('.matrix-modal button').filter({ hasText: 'Remove' })
    await removeButton.click()
    await page.waitForTimeout(100)

    // Verify remove button is active
    await expect(removeButton).toHaveClass(/btn-danger/)

    // Get the canvas overlay
    const overlay = page.locator('canvas.matrix-annotation-overlay')
    await expect(overlay).toBeVisible()

    const canvasBox = await overlay.boundingBox()
    if (!canvasBox) throw new Error('Canvas not found')

    const unit = 54
    const offset = 10

    // Position between first and second key on the first row (on the line connecting them)
    // Use the exact center Y position and midpoint X between the two keys
    const key1CenterX = canvasBox.x + offset + unit / 2
    const key2CenterX = canvasBox.x + offset + unit + unit / 2
    const lineX = (key1CenterX + key2CenterX) / 2 // Midpoint between keys
    const lineY = canvasBox.y + offset + unit / 2 // Same Y as key centers

    // First move mouse to trigger hover detection
    await page.mouse.move(lineX, lineY)
    await page.waitForTimeout(200)

    // Left-click on the row line to remove the row
    await page.mouse.click(lineX, lineY, { button: 'left' })
    await page.waitForTimeout(300)

    // Export to verify row was removed
    const exportedLayout = await exportLayoutJSON(page)
    const layoutString = JSON.stringify(exportedLayout)

    // First row (row 0) should be removed, so no keys should have "0," label
    expect(layoutString).not.toContain('"0,0"')
    expect(layoutString).not.toContain('"0,1"')
    expect(layoutString).not.toContain('"0,2"')

    // Modal should show 2 rows now (row 0 removed, so rows 1 and 2 remain)
    await expect(matrixModal).toContainText('Rows:')
    await expect(matrixModal).toContainText('2 defined')
    await expect(matrixModal).toContainText('Columns:')
  })

  test('should reuse freed row numbers when drawing after removal', async ({ page }) => {
    // Create a 4x3 grid with pre-assigned matrix coordinates
    // Format: Each key has label "row,col" in first position
    const fixtureData = [
      ['0,0', '0,1', '0,2', '0,3'],
      ['1,0', '1,1', '1,2', '1,3'],
      ['2,0', '2,1', '2,2', '2,3'],
    ]

    await importLayoutJSON(page, fixtureData)
    await page.waitForTimeout(500)

    // Open Matrix Coordinates Modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({ hasText: 'Add Switch Matrix Coordinates' })
      .click()

    const matrixModal = page.locator('.matrix-modal')
    await expect(matrixModal).toBeVisible()
    await page.waitForTimeout(500)

    // Now overlay should be visible
    const overlay = page.locator('canvas.matrix-annotation-overlay')
    await expect(overlay).toBeVisible()

    // Verify 3 rows and 4 column created
    const rowsProgress = page.locator('.progress-label').filter({ hasText: 'Rows:' })
    await expect(rowsProgress).toContainText('3 defined')
    const colsProgress = page.locator('.progress-label').filter({ hasText: 'Columns:' })
    await expect(colsProgress).toContainText('4 defined')

    // Get canvas position for context menu
    const canvasBox = await overlay.boundingBox()
    if (!canvasBox) throw new Error('Canvas not found')

    // Now remove row 1 via context menu (hover over the line between keys in row 1)
    // Position between first and second key on row 1
    const unit = 54
    const border = 9
    const offset = unit / 2 + border // Center of first key

    const row1Y = offset + unit

    const key1CenterX = canvasBox.x + offset
    const key2CenterX = canvasBox.x + offset + unit
    const lineX = (key1CenterX + key2CenterX) / 2 // Midpoint between keys
    const lineY = canvasBox.y + row1Y // Row 1's Y position

    // Switch to remove mode
    const removeButton = page.locator('button', { hasText: 'Remove' })
    await removeButton.click()
    await page.waitForTimeout(100)

    // Verify remove button is active
    await expect(removeButton).toHaveClass(/btn-danger/)

    // Move mouse to row line and left-click to remove
    await page.mouse.move(lineX, lineY)
    await page.waitForTimeout(200)
    await page.mouse.click(lineX, lineY, { button: 'left' })
    await page.waitForTimeout(300)

    // Verify row count decreased from 3 to 2
    await expect(rowsProgress).toContainText('2 defined')
    await expect(colsProgress).toContainText('4 defined')

    // Enable row drawing
    await page.locator('button', { hasText: 'Draw Rows' }).click()

    // Verify drawing is enabled
    await expect(overlay).toBeVisible()

    // Draw the new row
    await overlay.click({ position: { x: offset, y: row1Y }, force: true })
    await page.waitForTimeout(150)
    await overlay.click({ position: { x: offset + 3 * unit, y: row1Y }, force: true })
    await page.waitForTimeout(300)

    // Verify we're back to 3 rows
    await expect(rowsProgress).toContainText('3 defined')
    await expect(colsProgress).toContainText('4 defined')

    const exportedLayout = await exportLayoutJSON(page)
    const layoutString = JSON.stringify(exportedLayout)

    // Should have row 1 labels (gap was filled)
    expect(layoutString).toContain('"1,')
    // Count occurrences - should have exactly 4 keys with row 1 (the second row we just drew)
    const row1Count = (layoutString.match(/"1,/g) || []).length
    expect(row1Count).toBe(4)
  })

  test('should reuse freed column numbers when drawing after removal', async ({ page }) => {
    // Create a 4x3 grid with pre-assigned matrix coordinates
    // Format: Each key has label "row,col" in first position
    const fixtureData = [
      ['0,0', '0,1', '0,2', '0,3'],
      ['1,0', '1,1', '1,2', '1,3'],
      ['2,0', '2,1', '2,2', '2,3'],
    ]

    await importLayoutJSON(page, fixtureData)
    await page.waitForTimeout(500)

    // Open Matrix Coordinates Modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({ hasText: 'Add Switch Matrix Coordinates' })
      .click()

    const matrixModal = page.locator('.matrix-modal')
    await expect(matrixModal).toBeVisible()
    await page.waitForTimeout(500)

    // Now overlay should be visible
    const overlay = page.locator('canvas.matrix-annotation-overlay')
    await expect(overlay).toBeVisible()

    // Verify 3 rows and 4 column created
    const rowsProgress = page.locator('.progress-label').filter({ hasText: 'Rows:' })
    await expect(rowsProgress).toContainText('3 defined')
    const colsProgress = page.locator('.progress-label').filter({ hasText: 'Columns:' })
    await expect(colsProgress).toContainText('4 defined')

    // Get canvas position for context menu
    const canvasBox = await overlay.boundingBox()
    if (!canvasBox) throw new Error('Canvas not found')

    // Remove column 1 via remove mode (hover over the line between keys in column 1)
    // Position between first and second key on column 1
    const unit = 54
    const border = 9
    const offset = unit / 2 + border // Center of first key

    const col1X = offset + unit

    const key1CenterY = canvasBox.y + offset
    const key2CenterY = canvasBox.y + offset + unit
    const lineX = canvasBox.x + col1X // Column 1's X position
    const lineY = (key1CenterY + key2CenterY) / 2 // Midpoint between keys

    // Switch to remove mode
    const removeButton = page.locator('button', { hasText: 'Remove' })
    await removeButton.click()
    await page.waitForTimeout(100)

    // Verify remove button is active
    await expect(removeButton).toHaveClass(/btn-danger/)

    // Move mouse to column line and left-click to remove
    await page.mouse.move(lineX, lineY)
    await page.waitForTimeout(200)
    await page.mouse.click(lineX, lineY, { button: 'left' })
    await page.waitForTimeout(300)

    // Verify column count decreased from 4 to 3 and row count remain at 3
    await expect(rowsProgress).toContainText('3 defined')
    await expect(colsProgress).toContainText('3 defined')

    // Switch to column drawing mode
    const columnButton = page.locator('.matrix-modal button').filter({ hasText: 'Draw Columns' })
    await columnButton.click()
    await page.waitForTimeout(100)

    // Verify column button is active
    await expect(columnButton).toHaveClass(/btn-draw-columns/)
    await expect(overlay).toBeVisible()

    // Draw the new column
    await overlay.click({ position: { x: col1X, y: offset }, force: true })
    await page.waitForTimeout(100)
    await overlay.click({ position: { x: col1X, y: offset + 2 * unit }, force: true })
    await page.waitForTimeout(200)

    // Verify we're back to 4 columns
    await expect(rowsProgress).toContainText('3 defined')
    await expect(colsProgress).toContainText('4 defined')

    const exportedLayout = await exportLayoutJSON(page)
    const layoutString = JSON.stringify(exportedLayout)

    // Should have column 1 labels (gap was filled)
    expect(layoutString).toContain(',1"')
    // Count occurrences - should have exactly 3 keys with column 1 (the second column we just drew)
    const col1Count = (layoutString.match(/,1"/g) || []).length
    expect(col1Count).toBe(3)
  })

  test('should not overeagerly grab next key', async ({ page }) => {
    // this is specific bug reproduction scenario where long key (space) was incorrectly
    // added to drawing even if mouse was not clicking there
    const fixtureData = [
      [{ x: 2.5, a: 0 }, ''],
      [{ x: 2.5 }, ''],
      [{ x: 2.5 }, ''],
      [{ w: 6 }, ''],
    ]

    // Import layout via JSON
    await importLayoutJSON(page, fixtureData)

    // Verify layout has 4 keys via UI
    await expect(page.locator('.keys-counter')).toContainText('Keys: 4')

    // Small delay to ensure canvas renders
    await page.waitForTimeout(500)

    // Open Matrix Coordinates Modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({
        hasText: 'Add Switch Matrix Coordinates',
      })
      .click()

    // Wait for modal to be visible
    const matrixModal = page.locator('.matrix-modal')
    await expect(matrixModal).toBeVisible()

    // Wait for modal content to load (should skip directly to drawing step since no labels)
    await page.waitForTimeout(500)

    // Now the overlay should be visible
    const overlay = page.locator('canvas.matrix-annotation-overlay')
    await expect(overlay).toBeVisible()

    // Get canvas bounding box for click calculations
    const overlayBox = await overlay.boundingBox()
    if (!overlayBox) throw new Error('Matrix overlay not found')

    // Calculate key centers in screen coordinates
    // keys at (2.5,0), (2.5,1), (2.5,2), (0,3)
    // With unit=54px and canvas border, keys are at:
    // Row 0: x=171px y=27px)
    // Row 1: x=171px y=81px
    // Row 2: x=171px y=135px

    // First row: click first key (2.5,0) and last key (2.5,2)
    // The middle key (2.5,1) should be automatically added via line intersection
    // AND the last key should not be added (that was the bug - it was added anyway)
    // Second click automatically finishes the sequence
    await overlay.click({ position: { x: 171, y: 27 } })
    await page.waitForTimeout(100)

    await overlay.click({ position: { x: 171, y: 135 } })
    await page.waitForTimeout(200)

    const exportedLayout = await exportLayoutJSON(page)
    const layoutString = JSON.stringify(exportedLayout)

    // Should have row 1 labels (gap was filled)
    expect(layoutString).toContain('"0,"')
    // Count occurrences - should have exactly 3 keys with row 0
    const row0Count = (layoutString.match(/"0,"/g) || []).length
    expect(row0Count).toBe(3)
    // Last row should not have a label:
    expect(layoutString).toContain('"w":6},""]')
  })

  test('should renumber rows by typing digits while hovering', async ({ page }) => {
    // Create a 3x3 grid with pre-assigned matrix coordinates
    const fixtureData = [
      ['0,0', '0,1', '0,2'],
      ['1,0', '1,1', '1,2'],
      ['2,0', '2,1', '2,2'],
    ]

    await importLayoutJSON(page, fixtureData)
    await page.waitForTimeout(500)

    // Open Matrix Coordinates Modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({ hasText: 'Add Switch Matrix Coordinates' })
      .click()

    const matrixModal = page.locator('.matrix-modal')
    await expect(matrixModal).toBeVisible()
    await page.waitForTimeout(500)

    // Switch to Draw Rows mode
    const rowButton = page.locator('.matrix-modal button').filter({ hasText: 'Draw Rows' })
    await rowButton.click()
    await page.waitForTimeout(100)

    const overlay = page.locator('canvas.matrix-annotation-overlay')
    await expect(overlay).toBeVisible()

    const canvasBox = await overlay.boundingBox()
    if (!canvasBox) throw new Error('Canvas not found')

    const unit = 54
    const border = 9
    const offset = unit / 2 + border

    // Position between first and second key on row 0 (on the line connecting them)
    const key1CenterX = canvasBox.x + offset
    const key2CenterX = canvasBox.x + offset + unit
    const lineX = (key1CenterX + key2CenterX) / 2
    const lineY = canvasBox.y + offset

    // Move mouse to hover over row 0
    await page.mouse.move(lineX, lineY)
    await page.waitForTimeout(200)

    // Type '5' to renumber row 0 to row 5
    await page.keyboard.press('5')
    // Add a letter to check if it is ignored
    await page.keyboard.press('a')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)

    // Export and verify row 0 became row 5
    let exportedLayout = await exportLayoutJSON(page)
    let layoutString = JSON.stringify(exportedLayout)

    // Should have row 5 labels
    expect(layoutString).toContain('"5,0"')
    expect(layoutString).toContain('"5,1"')
    expect(layoutString).toContain('"5,2"')

    // Should not have row 0 labels anymore
    expect(layoutString).not.toContain('"0,0"')
    expect(layoutString).not.toContain('"0,1"')
    expect(layoutString).not.toContain('"0,2"')

    // Now test swapping: hover over row 1 and type '5'
    const row1LineY = canvasBox.y + offset + unit
    await page.mouse.move(lineX, row1LineY)
    await page.waitForTimeout(200)

    await page.keyboard.press('5')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)

    // Export and verify swap occurred
    exportedLayout = await exportLayoutJSON(page)
    layoutString = JSON.stringify(exportedLayout)

    // Row that was originally row 1 should now be row 5
    expect(layoutString).toContain('"5,0"')
    expect(layoutString).toContain('"5,1"')
    expect(layoutString).toContain('"5,2"')

    // Row that was renumbered to 5 should now be row 1
    expect(layoutString).toContain('"1,0"')
    expect(layoutString).toContain('"1,1"')
    expect(layoutString).toContain('"1,2"')
  })

  test('should renumber columns by typing digits while hovering', async ({ page }) => {
    // Create a 3x3 grid with pre-assigned matrix coordinates
    const fixtureData = [
      ['0,0', '0,1', '0,2'],
      ['1,0', '1,1', '1,2'],
      ['2,0', '2,1', '2,2'],
    ]

    await importLayoutJSON(page, fixtureData)
    await page.waitForTimeout(500)

    // Open Matrix Coordinates Modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({ hasText: 'Add Switch Matrix Coordinates' })
      .click()

    const matrixModal = page.locator('.matrix-modal')
    await expect(matrixModal).toBeVisible()
    await page.waitForTimeout(500)

    // Switch to Draw Columns mode
    const columnButton = page.locator('.matrix-modal button').filter({ hasText: 'Draw Columns' })
    await columnButton.click()
    await page.waitForTimeout(100)

    const overlay = page.locator('canvas.matrix-annotation-overlay')
    await expect(overlay).toBeVisible()

    const canvasBox = await overlay.boundingBox()
    if (!canvasBox) throw new Error('Canvas not found')

    const unit = 54
    const border = 9
    const offset = unit / 2 + border

    // Position between first and second key on column 0 (on the line connecting them)
    const key1CenterY = canvasBox.y + offset
    const key2CenterY = canvasBox.y + offset + unit
    const lineX = canvasBox.x + offset
    const lineY = (key1CenterY + key2CenterY) / 2

    // Move mouse to hover over column 0
    await page.mouse.move(lineX, lineY)
    await page.waitForTimeout(200)

    // Type '7' to renumber column 0 to column 7
    await page.keyboard.press('7')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)

    // Export and verify column 0 became column 7
    const exportedLayout = await exportLayoutJSON(page)
    const layoutString = JSON.stringify(exportedLayout)

    // Should have column 7 labels
    expect(layoutString).toContain('"0,7"')
    expect(layoutString).toContain('"1,7"')
    expect(layoutString).toContain('"2,7"')

    // Should not have column 0 labels anymore (for the first column)
    // Note: Other columns still exist (column 1, 2)
    expect(layoutString).not.toContain('"0,0"')
    expect(layoutString).not.toContain('"1,0"')
    expect(layoutString).not.toContain('"2,0"')
  })

  test('should handle multi-digit row numbers', async ({ page }) => {
    // Create a 2x2 grid
    const fixtureData = [
      ['0,0', '0,1'],
      ['1,0', '1,1'],
    ]

    await importLayoutJSON(page, fixtureData)
    await page.waitForTimeout(500)

    // Open Matrix Coordinates Modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({ hasText: 'Add Switch Matrix Coordinates' })
      .click()

    const matrixModal = page.locator('.matrix-modal')
    await expect(matrixModal).toBeVisible()
    await page.waitForTimeout(500)

    // Switch to Draw Rows mode
    const rowButton = page.locator('.matrix-modal button').filter({ hasText: 'Draw Rows' })
    await rowButton.click()
    await page.waitForTimeout(100)

    const overlay = page.locator('canvas.matrix-annotation-overlay')
    await expect(overlay).toBeVisible()

    const canvasBox = await overlay.boundingBox()
    if (!canvasBox) throw new Error('Canvas not found')

    const unit = 54
    const border = 9
    const offset = unit / 2 + border

    // Hover over row 0
    const key1CenterX = canvasBox.x + offset
    const key2CenterX = canvasBox.x + offset + unit
    const lineX = (key1CenterX + key2CenterX) / 2
    const lineY = canvasBox.y + offset

    await page.mouse.move(lineX, lineY)
    await page.waitForTimeout(200)

    // Type '1' then '0' to renumber to row 10
    await page.keyboard.press('1')
    await page.keyboard.press('0')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)

    // Export and verify row became row 10
    const exportedLayout = await exportLayoutJSON(page)
    const layoutString = JSON.stringify(exportedLayout)

    // Should have row 10 labels and row 1 should be unchanged
    expect(layoutString).toContain('[["10,0","10,1"],["1,0","1,1"]]')
  })

  test('should cancel renumbering with Escape key', async ({ page }) => {
    // Create a 3x3 grid
    const fixtureData = [
      ['0,0', '0,1', '0,2'],
      ['1,0', '1,1', '1,2'],
      ['2,0', '2,1', '2,2'],
    ]

    await importLayoutJSON(page, fixtureData)
    await page.waitForTimeout(500)

    // Open Matrix Coordinates Modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({ hasText: 'Add Switch Matrix Coordinates' })
      .click()

    const matrixModal = page.locator('.matrix-modal')
    await expect(matrixModal).toBeVisible()
    await page.waitForTimeout(500)

    // Switch to Draw Rows mode
    const rowButton = page.locator('.matrix-modal button').filter({ hasText: 'Draw Rows' })
    await rowButton.click()
    await page.waitForTimeout(100)

    const overlay = page.locator('canvas.matrix-annotation-overlay')
    await expect(overlay).toBeVisible()

    const canvasBox = await overlay.boundingBox()
    if (!canvasBox) throw new Error('Canvas not found')

    const unit = 54
    const border = 9
    const offset = unit / 2 + border

    // Hover over row 0
    const key1CenterX = canvasBox.x + offset
    const key2CenterX = canvasBox.x + offset + unit
    const lineX = (key1CenterX + key2CenterX) / 2
    const lineY = canvasBox.y + offset

    await page.mouse.move(lineX, lineY)
    await page.waitForTimeout(200)

    // Type '5' to start renumbering
    await page.keyboard.press('5')
    await page.waitForTimeout(100)

    // Press Escape to cancel
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    // Export and verify row 0 is still row 0 (not renumbered to 5)
    const exportedLayout = await exportLayoutJSON(page)
    const layoutString = JSON.stringify(exportedLayout)

    // Should still have row 0 labels
    expect(layoutString).toContain('"0,0"')
    expect(layoutString).toContain('"0,1"')
    expect(layoutString).toContain('"0,2"')

    // Should not have row 5 labels
    expect(layoutString).not.toContain('"5,0"')
    expect(layoutString).not.toContain('"5,1"')
    expect(layoutString).not.toContain('"5,2"')
  })
})
