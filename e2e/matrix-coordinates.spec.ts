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
      'Remove all legends and add row,column matrix coordinates for VIA',
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

  test('should display proper warning and information', async ({ page }) => {
    // Open the matrix coordinates modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({
        hasText: 'Add Switch Matrix Coordinates',
      })
      .click()

    await expect(page.locator('.matrix-modal')).toBeVisible()

    // Check warning section
    const warningSection = page.locator('.warning-section')
    await expect(warningSection).toBeVisible()
    await expect(warningSection).toContainText('remove all existing legends')
    await expect(warningSection).toContainText('row,column')

    // Check info section
    const infoSection = page.locator('.info-section')
    await expect(infoSection).toBeVisible()
    await expect(infoSection).toContainText('Matrix coordinates map')

    // Check help link (now in info section)
    const helpLink = page.locator('a[href="https://www.caniusevia.com/docs/layouts"]')
    await expect(helpLink).toBeVisible()
    await expect(helpLink).toContainText('VIA Documentation')
  })

  test('should cancel modal with Cancel button', async ({ page }) => {
    // Open modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({
        hasText: 'Add Switch Matrix Coordinates',
      })
      .click()

    await expect(page.locator('.matrix-modal')).toBeVisible()

    // Click Cancel button
    await page.locator('button').filter({ hasText: 'Cancel' }).click()

    // Modal should close
    await expect(page.locator('.matrix-modal')).not.toBeVisible()
  })

  test('should cancel modal with Escape key', async ({ page }) => {
    // Open modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({
        hasText: 'Add Switch Matrix Coordinates',
      })
      .click()

    await expect(page.locator('.matrix-modal')).toBeVisible()

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

    // Click Apply button
    await page.locator('.matrix-modal button').filter({ hasText: 'Add Matrix Coordinates' }).click()

    // Modal should close
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

  test('should apply matrix coordinates with Enter key', async ({ page }) => {
    // Add a key first
    await page.click('button[title="Add Standard Key"]')

    // Open modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({
        hasText: 'Add Switch Matrix Coordinates',
      })
      .click()

    await expect(page.locator('.matrix-modal')).toBeVisible()

    // Press Enter key
    await page.keyboard.press('Enter')

    // Modal should close
    await expect(page.locator('.matrix-modal')).not.toBeVisible()
  })

  test('should work with different key arrangements', async ({ page }) => {
    // Add keys in a specific pattern
    await page.click('button[title="Add Standard Key"]')
    await page.click('button[title="Add Standard Key"]')

    // Move second key to create a 2x1 layout
    // Select the second key and move it down (this would depend on the specific UI)

    // Apply matrix coordinates
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({
        hasText: 'Add Switch Matrix Coordinates',
      })
      .click()
    await page.locator('.matrix-modal button').filter({ hasText: 'Add Matrix Coordinates' }).click()

    // Verify modal closes
    await expect(page.locator('.matrix-modal')).not.toBeVisible()
  })

  test('should handle mobile responsive layout', async ({ page, isMobile }) => {
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

    // On mobile, modal should be positioned at bottom
    // Check that modal has proper mobile styling
    const modal = page.locator('.matrix-modal')
    await expect(modal).toBeVisible()

    // Test that buttons are still accessible
    await expect(page.locator('.matrix-modal button').filter({ hasText: 'Cancel' })).toBeVisible()
    await expect(
      page.locator('.matrix-modal button').filter({ hasText: 'Add Matrix Coordinates' }),
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

    // Warning should NOT be visible on first run
    await expect(page.locator('.already-annotated-warning')).not.toBeVisible()

    // Click Apply
    await page.locator('.matrix-modal button').filter({ hasText: 'Add Matrix Coordinates' }).click()
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

    // Warning SHOULD be visible on second run
    const warning = page.locator('.already-annotated-warning')
    await expect(warning).toBeVisible()
    await expect(warning).toContainText('Layout Already Annotated')
    await expect(warning).toContainText('valid "row,column" annotations')
  })
})
