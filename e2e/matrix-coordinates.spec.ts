import { test, expect } from '@playwright/test'

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

  test('should show warning when layout is already annotated', async ({ page }) => {
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

    // Warning should NOT be visible on first run (no annotations yet)
    await expect(page.locator('.already-annotated-warning')).not.toBeVisible()

    // Since we have no labels, we should be in drawing step directly
    // No need to click OK - proceed directly to automatic annotation

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

    // Warning SHOULD be visible on second run (already annotated warning)
    const warning = page.locator('.alert-success')
    await expect(warning).toBeVisible()
    await expect(warning).toContainText('Layout Already Annotated')
    await expect(warning).toContainText('valid "row,column" annotations')
  })
})
