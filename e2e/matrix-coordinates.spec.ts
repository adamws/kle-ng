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
  const downloadPath = `e2e/test-output/matrix-coordinates-${Date.now()}.json`
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

test.describe('Matrix Coordinates Tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('should be accessible in Extra Tools dropdown', async ({ page }) => {
    // Click the Extra Tools button
    const extraToolsButton = page.locator('.extra-tools-group button')
    await extraToolsButton.click()

    // Wait for dropdown to appear
    await page.waitForSelector('.extra-tools-dropdown', { state: 'visible' })

    // Check that "Add Switch Matrix Coordinates" tool exists
    const matrixTool = page.locator('.extra-tools-dropdown .dropdown-item').filter({
      hasText: 'Add Switch Matrix Coordinates',
    })
    await expect(matrixTool).toBeVisible()
    await expect(matrixTool).toHaveAttribute(
      'title',
      'Assign matrix coordinates for VIA - automatic or manual drawing',
    )
  })

  test('should open modal when clicked', async ({ page }) => {
    // Open Extra Tools dropdown
    await page.locator('.extra-tools-group button').click()
    await page.waitForSelector('.extra-tools-dropdown', { state: 'visible' })

    // Click the matrix coordinates tool
    const matrixTool = page.locator('.extra-tools-dropdown .dropdown-item').filter({
      hasText: 'Add Switch Matrix Coordinates',
    })
    await matrixTool.click()

    // Check that modal opens
    await expect(page.locator('.matrix-modal')).toBeVisible()
    await expect(page.locator('.panel-title')).toContainText('Add Switch Matrix Coordinates')
  })

  test('should display proper drawing interface', async ({ page }) => {
    // Open the matrix coordinates modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({
        hasText: 'Add Switch Matrix Coordinates',
      })
      .click()

    await expect(page.locator('.matrix-modal')).toBeVisible()

    // Wait for modal content to load
    await page.waitForTimeout(500)

    // Check that we're in the drawing step (no labels on keys means direct to drawing)
    const drawSection = page.locator('.draw-section')
    await expect(drawSection).toBeVisible()

    // Check instructions section
    const infoSection = page.locator('.info-section')
    await expect(infoSection).toBeVisible()

    // Check automatic annotation button
    await expect(
      page.locator('.matrix-modal button').filter({ hasText: 'Annotate Automatically' }),
    ).toBeVisible()

    // Check close button in footer
    await expect(
      page.locator('.matrix-modal .panel-footer button').filter({ hasText: 'Close' }),
    ).toBeVisible()
  })

  test('should close modal with Close button', async ({ page }) => {
    // Open modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({
        hasText: 'Add Switch Matrix Coordinates',
      })
      .click()

    await expect(page.locator('.matrix-modal')).toBeVisible()

    // Wait for modal content to load
    await page.waitForTimeout(500)

    // Click Close button in footer
    await page.locator('.matrix-modal .panel-footer button').filter({ hasText: 'Close' }).click()

    // Modal should close
    await expect(page.locator('.matrix-modal')).not.toBeVisible()
  })

  test('should cancel modal with Escape key', async ({ page }) => {
    // First add a key to ensure warning step is shown
    await page.click('button[title="Add Standard Key"]')
    await page.waitForTimeout(300)

    // Open modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({
        hasText: 'Add Switch Matrix Coordinates',
      })
      .click()

    await expect(page.locator('.matrix-modal')).toBeVisible()

    // Wait for modal content to load
    await page.waitForTimeout(500)

    // Press Escape key
    await page.keyboard.press('Escape')

    // Modal should close
    await expect(page.locator('.matrix-modal')).not.toBeVisible()
  })

  test('should apply matrix coordinates to keyboard layout', async ({ page }) => {
    // First, add some keys to work with
    await page.click('button[title="Add Standard Key"]')
    await page.click('button[title="Add Standard Key"]')
    await page.click('button[title="Add Standard Key"]')

    // Wait a moment for keys to be added
    await page.waitForTimeout(500)

    // Open matrix coordinates modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({
        hasText: 'Add Switch Matrix Coordinates',
      })
      .click()

    await expect(page.locator('.matrix-modal')).toBeVisible()

    // Wait for modal content to load - we should be in drawing step directly
    await page.waitForTimeout(500)

    // Click Annotate Automatically button
    await page.locator('.matrix-modal button').filter({ hasText: 'Annotate Automatically' }).click()

    // Modal should not close
    await expect(page.locator('.matrix-modal')).toBeVisible()

    // Wait for automatic annotation to complete
    await page.waitForTimeout(1000)

    // Check Annotation Complete section
    const successSection = page.locator('.alert-success')
    await expect(successSection).toBeVisible()
    await expect(successSection).toContainText('Annotation Complete!')

    // Use Escape key to close the modal instead of clicking the Close button
    await page.keyboard.press('Escape')

    // Verify modal closes
    await expect(page.locator('.matrix-modal')).not.toBeVisible()

    // Check that keys now have matrix coordinates in the JSON editor
    // Open JSON editor panel (assuming it exists)
    const jsonToggle = page.locator('button').filter({ hasText: 'JSON' }).first()
    if (await jsonToggle.isVisible()) {
      await jsonToggle.click()
      await page.waitForTimeout(500)

      // Check that the JSON contains matrix coordinates
      const jsonContent = page.locator('.json-editor, textarea, .monaco-editor')
      if (await jsonContent.isVisible()) {
        const jsonText = await jsonContent.textContent()
        // The JSON should contain coordinate patterns like "0,0", "0,1", etc.
        expect(jsonText).toMatch(/["']0,\d+["']/)
      }
    }
  })

  test('should work with different key arrangements', async ({ page }) => {
    // Add keys in a specific pattern
    await page.click('button[title="Add Standard Key"]')
    await page.click('button[title="Add Standard Key"]')

    // Wait for keys to be added
    await page.waitForTimeout(300)

    // Apply matrix coordinates
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({
        hasText: 'Add Switch Matrix Coordinates',
      })
      .click()

    await expect(page.locator('.matrix-modal')).toBeVisible()

    // Wait for modal content to load - we should be in drawing step directly
    await page.waitForTimeout(500)

    // Now click Close button to exit
    await page.locator('.matrix-modal .panel-footer button').filter({ hasText: 'Close' }).click()

    // Verify modal closes
    await expect(page.locator('.matrix-modal')).not.toBeVisible()
  })

  test('should handle mobile responsive layout', async ({ page, isMobile }) => {
    // First add a key to ensure warning step is shown
    await page.click('button[title="Add Standard Key"]')
    await page.waitForTimeout(300)

    if (!isMobile) {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
    }

    // Open modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({
        hasText: 'Add Switch Matrix Coordinates',
      })
      .click()

    await expect(page.locator('.matrix-modal')).toBeVisible()

    // Wait for modal content to load
    await page.waitForTimeout(500)

    // On mobile, modal should be positioned at bottom
    // Check that modal has proper mobile styling
    const modal = page.locator('.matrix-modal')
    await expect(modal).toBeVisible()

    await expect(
      page.locator('.matrix-modal .panel-footer button').filter({ hasText: 'Close' }),
    ).toBeVisible()
  })

  test('should skip to completion state when layout is already annotated', async ({ page }) => {
    // Add keys first
    await page.click('button[title="Add Standard Key"]')
    await page.click('button[title="Add Standard Key"]')
    await page.waitForTimeout(300)

    // Apply matrix coordinates once
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({
        hasText: 'Add Switch Matrix Coordinates',
      })
      .click()

    await expect(page.locator('.matrix-modal')).toBeVisible()

    // Wait for modal content to load
    await page.waitForTimeout(500)

    // Since we have no labels, we should be in drawing step directly
    await expect(page.locator('.draw-section')).toBeVisible()

    // Click Annotate Automatically to apply coordinates
    await page.locator('.matrix-modal button').filter({ hasText: 'Annotate Automatically' }).click()

    // Wait for annotation to complete
    await page.waitForTimeout(1000)

    // Use Escape key to close the modal instead of clicking the Close button
    await page.keyboard.press('Escape')
    await expect(page.locator('.matrix-modal')).not.toBeVisible()

    // Wait for state to update
    await page.waitForTimeout(500)

    // Re-open the modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({
        hasText: 'Add Switch Matrix Coordinates',
      })
      .click()

    await expect(page.locator('.matrix-modal')).toBeVisible()

    // Wait for modal content to load
    await page.waitForTimeout(500)

    // Should skip warning and go directly to draw step with "Layout Already Annotated" message
    await expect(page.locator('.draw-section')).toBeVisible()

    const completionAlert = page.locator('.alert-success')
    await expect(completionAlert).toBeVisible()
    await expect(completionAlert).toContainText('Layout Already Annotated')
    await expect(completionAlert).toContainText('valid "row,column" annotations')
  })

  test('should NOT clear labels when modal opens with warning step', async ({ page }) => {
    // Load a layout with labels using KLE format
    const fixtureWithLabels = [
      ['A', 'B', 'C'],
      ['D', 'E', 'F'],
      ['G', 'H', 'I'],
    ]

    // Load layout with labels via JSON import
    await importLayoutJSON(page, fixtureWithLabels)
    await page.waitForTimeout(500)

    // Get initial layout via JSON export
    const initialLayout = await exportLayoutJSON(page)

    // Open Matrix Coordinates Modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({ hasText: 'Add Switch Matrix Coordinates' })
      .click()

    await expect(page.locator('.matrix-modal')).toBeVisible()
    await page.waitForTimeout(500)

    // Should be in warning step (because there are labels)
    const warningAlert = page.locator('.alert-warning')
    await expect(warningAlert).toBeVisible()
    await expect(warningAlert).toContainText('clear all existing labels')

    // Verify labels are STILL present (not cleared yet) via JSON export
    const currentLayout = await exportLayoutJSON(page)

    // Labels should be unchanged - compare the layout structure
    expect(JSON.stringify(currentLayout)).toBe(JSON.stringify(initialLayout))

    // Check that labels are present in the layout
    const hasLabels = currentLayout.some(
      (row: unknown) =>
        Array.isArray(row) &&
        row.some(
          (cell: unknown) =>
            typeof cell === 'string' &&
            ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].some((label) => cell.includes(label)),
        ),
    )
    expect(hasLabels).toBe(true)
  })

  test('should preserve labels when user clicks Cancel in warning step', async ({ page }) => {
    // Load a layout with labels
    const fixtureWithLabels = [
      ['X', 'Y', 'Z'],
      ['1', '2', '3'],
    ]

    // Ensure the app is fully loaded by waiting for a visible element
    await page.waitForSelector('.keyboard-canvas-container', { state: 'visible', timeout: 15000 })

    // Wait a bit for Vue/Pinia to initialize after the DOM is ready
    await page.waitForTimeout(1000)

    // Load layout with labels via JSON import
    await importLayoutJSON(page, fixtureWithLabels)
    await page.waitForTimeout(500)

    // Get initial layout via JSON export
    const initialLayout = await exportLayoutJSON(page)

    // Open modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({ hasText: 'Add Switch Matrix Coordinates' })
      .click()

    await expect(page.locator('.matrix-modal')).toBeVisible()
    await page.waitForTimeout(500)

    // Should show warning
    await expect(page.locator('.alert-warning')).toBeVisible()

    // Click Cancel button
    const cancelButton = page
      .locator('.matrix-modal .panel-footer button')
      .filter({ hasText: 'Cancel' })
    await cancelButton.click()

    // Modal should close
    await expect(page.locator('.matrix-modal')).not.toBeVisible()

    // Verify labels are PRESERVED via JSON export
    const finalLayout = await exportLayoutJSON(page)

    // Layout should be unchanged after cancellation
    expect(JSON.stringify(finalLayout)).toBe(JSON.stringify(initialLayout))

    // Check that specific labels are still present
    const hasLabels = finalLayout.some(
      (row: unknown) =>
        Array.isArray(row) &&
        row.some(
          (cell: unknown) =>
            typeof cell === 'string' &&
            ['X', 'Y', 'Z', '1', '2', '3'].some((label) => cell.includes(label)),
        ),
    )
    expect(hasLabels).toBe(true)
  })

  test('should clear labels ONLY when user clicks OK in warning step', async ({ page }) => {
    // Load a layout with labels
    const fixtureWithLabels = [
      ['Q', 'W', 'E'],
      ['A', 'S', 'D'],
    ]

    // Load layout with labels via JSON import
    await importLayoutJSON(page, fixtureWithLabels)
    await page.waitForTimeout(500)

    // Verify initial labels exist via JSON export
    const initialLayout = await exportLayoutJSON(page)
    const hasInitialLabels = initialLayout.some(
      (row: unknown) =>
        Array.isArray(row) &&
        row.some(
          (cell: unknown) =>
            typeof cell === 'string' &&
            ['Q', 'W', 'E', 'A', 'S', 'D'].some((label) => cell.includes(label)),
        ),
    )
    expect(hasInitialLabels).toBe(true)

    // Open modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({ hasText: 'Add Switch Matrix Coordinates' })
      .click()

    await expect(page.locator('.matrix-modal')).toBeVisible()
    await page.waitForTimeout(500)

    // Should show warning
    await expect(page.locator('.alert-warning')).toBeVisible()

    // Click OK button to proceed
    const okButton = page.locator('.matrix-modal .panel-footer button').filter({ hasText: 'OK' })
    await okButton.click()

    await page.waitForTimeout(500)

    // Should now be in draw step
    await expect(page.locator('.draw-section')).toBeVisible()

    // Verify labels are NOW CLEARED via JSON export
    const clearedLayout = await exportLayoutJSON(page)

    // All labels should be cleared - check that no cell contains the original labels
    const hasClearedLabels = clearedLayout.some(
      (row: unknown) =>
        Array.isArray(row) &&
        row.some(
          (cell: unknown) =>
            typeof cell === 'string' &&
            ['Q', 'W', 'E', 'A', 'S', 'D'].some((label) => cell.includes(label)),
        ),
    )
    expect(hasClearedLabels).toBe(false)
  })

  test('should show "Annotation Complete!" after automatic annotation', async ({ page }) => {
    // Add some keys to annotate
    await page.click('button[title="Add Standard Key"]')
    await page.click('button[title="Add Standard Key"]')
    await page.click('button[title="Add Standard Key"]')
    await page.waitForTimeout(500)

    // Open matrix coordinates modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({
        hasText: 'Add Switch Matrix Coordinates',
      })
      .click()

    await expect(page.locator('.matrix-modal')).toBeVisible()
    await page.waitForTimeout(500)

    // Should be in draw step (no labels means skip warning)
    await expect(page.locator('.draw-section')).toBeVisible()

    // Click Annotate Automatically
    await page.locator('.matrix-modal button').filter({ hasText: 'Annotate Automatically' }).click()

    // Wait for annotation to complete and success message to appear
    const completionAlert = page.locator('.alert-success')
    await expect(completionAlert).toBeVisible({ timeout: 10000 })
    await expect(completionAlert).toContainText('Annotation Complete!')
    await expect(completionAlert).toContainText('All 3 keys have been assigned')

    // Close the modal using Escape key
    await page.keyboard.press('Escape')
    await expect(page.locator('.matrix-modal')).not.toBeVisible()
    await page.waitForTimeout(300)

    // Regression test: Verify that keys can be selected after closing modal
    // (Previously, the overlay was blocking clicks after automatic annotation)
    const canvas = page.locator('canvas.keyboard-canvas')
    await expect(canvas).toBeVisible()

    // Click on a key (approximate center of first key at position 0,0)
    // With unit=54px and border=9px, first key center is at approximately (36, 36)
    await canvas.click({ position: { x: 36, y: 36 } })
    await page.waitForTimeout(200)

    // Verify that the key was selected by checking the Selected counter
    await expect(page.locator('.selected-counter')).toContainText('Selected: 1')
  })

  test('should show matrix preview for already annotated Default 60% (VIA) preset', async ({
    page,
    browserName,
  }) => {
    // Skip this test on non-Chromium browsers since we're asserting screenshots
    test.skip(browserName !== 'chromium', 'Screenshots only verified on Chromium')

    // Open the presets dropdown
    const presetButton = page.locator('.preset-dropdown button.preset-select')
    await presetButton.click()

    // Wait for dropdown items to be in DOM
    await page.waitForSelector('.preset-dropdown .dropdown-item', {
      state: 'attached',
      timeout: 5000,
    })

    // Click the Default 60% (VIA) preset item
    const viaItem = page.locator('.preset-dropdown .dropdown-item', {
      hasText: 'Default 60% (VIA)',
    })
    await viaItem.click()

    // Wait for layout to load - Default 60% has 61 keys
    await page.waitForFunction(
      () => {
        const keysCounter = document.querySelector('.keys-counter')?.textContent
        if (!keysCounter) return false
        const match = keysCounter.match(/Keys: (\d+)/)
        return match ? parseInt(match[1]) === 61 : false
      },
      { timeout: 10000 },
    )

    // Wait a bit more to ensure layout is fully rendered
    await page.waitForTimeout(500)

    // Open matrix coordinates modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({
        hasText: 'Add Switch Matrix Coordinates',
      })
      .click()

    await expect(page.locator('.matrix-modal')).toBeVisible()

    // Wait for modal content to load
    await page.waitForTimeout(500)

    // Should skip warning step and go directly to draw step
    const drawSection = page.locator('.draw-section')
    await expect(drawSection).toBeVisible()

    // Should show "Layout Already Annotated" since Default 60% (VIA) is pre-annotated
    const completionAlert = page.locator('.alert-success')
    await expect(completionAlert).toBeVisible()
    await expect(completionAlert).toContainText('Layout Already Annotated')
    await expect(completionAlert).toContainText('valid "row,column" annotations')

    // Wait for matrix overlay to be rendered on canvas
    await page.waitForTimeout(1000)

    // Take a screenshot of the keyboard canvas to verify matrix preview is rendered
    const canvas = page.locator('.keyboard-canvas-container')
    await expect(canvas).toBeVisible()

    // Take screenshot and compare with baseline
    await expect(canvas).toHaveScreenshot('default-60-via-matrix-preview.png')
  })

  test('should present choice when opening partially annotated layout', async ({ page }) => {
    const fixtureData = [
      ['0,0', '0,1', '0,2', '0,3'],
      [',0', ',1', ',2', ',3'],
      ['2,0', '2,1', '2,2', '2,3'],
    ]

    // Load layout with labels via JSON import
    await importLayoutJSON(page, fixtureData)
    await page.waitForTimeout(500)

    // Open modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({ hasText: 'Add Switch Matrix Coordinates' })
      .click()

    await expect(page.locator('.matrix-modal')).toBeVisible()
    await page.waitForTimeout(500)

    // Should show warning
    const warningAlert = page.locator('.alert-warning')
    await expect(warningAlert).toBeVisible()
    await expect(warningAlert).toContainText('Partial annotation detected')

    const continueButton = page
      .locator('.matrix-modal .panel-footer button')
      .filter({ hasText: 'Continue' })
    const startOverButton = page
      .locator('.matrix-modal .panel-footer button')
      .filter({ hasText: 'Start over' })
    await expect(continueButton).toBeVisible()
    await expect(startOverButton).toBeVisible()
  })
})
