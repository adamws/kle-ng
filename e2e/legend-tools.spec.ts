import { test, expect } from '@playwright/test'

test.describe('Legend Tools Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test.describe('Extra Tools Dropdown', () => {
    test('should show legend tools in extra tools dropdown', async ({ page }) => {
      // Click the extra tools button (tools icon)
      await page.locator('[title="Extra Tools"]').click()

      // Verify the dropdown is visible
      await expect(page.locator('.extra-tools-dropdown')).toBeVisible()

      // Verify legend tools are present
      await expect(page.locator('button:has-text("Legend Tools")')).toBeVisible()
      await expect(
        page.locator('button:has-text("Move rotation origins to key centers")'),
      ).toBeVisible()
    })

    test('should close dropdown when clicking outside', async ({ page }) => {
      // Open dropdown
      await page.locator('[title="Extra Tools"]').click()
      await expect(page.locator('.extra-tools-dropdown')).toBeVisible()

      // Click outside the dropdown
      await page.locator('body').click({ position: { x: 50, y: 50 } })

      // Dropdown should be hidden
      await expect(page.locator('.extra-tools-dropdown')).not.toBeVisible()
    })
  })

  test.describe('Legend Tools Panel', () => {
    test('should open and close legend tools panel', async ({ page }) => {
      // Open extra tools dropdown
      await page.locator('[title="Extra Tools"]').click()

      // Click Legend Tools
      await page.locator('button:has-text("Legend Tools")').click()

      // Panel should be visible
      await expect(page.locator('.legend-tools-panel')).toBeVisible()
      await expect(page.locator('.panel-title:has-text("Legend Tools")')).toBeVisible()

      // Close panel with X button
      await page.locator('.btn-close').click()

      // Panel should be hidden
      await expect(page.locator('.legend-tools-panel')).not.toBeVisible()
    })

    test('should display tab navigation', async ({ page }) => {
      // Open legend tools panel
      await page.locator('[title="Extra Tools"]').click()
      await page.locator('button:has-text("Legend Tools")').click()

      // Check tab buttons are present
      await expect(page.locator('label[for="tab-remove"]')).toBeVisible()
      await expect(page.locator('label[for="tab-align"]')).toBeVisible()
      await expect(page.locator('label[for="tab-move"]')).toBeVisible()

      // Remove tab should be active by default
      await expect(page.locator('#tab-remove')).toBeChecked()
    })

    test('should display all legend categories in remove tab', async ({ page }) => {
      // Open legend tools panel
      await page.locator('[title="Extra Tools"]').click()
      await page.locator('button:has-text("Legend Tools")').click()

      // Check all category buttons are present in remove tab
      const categories = [
        'All',
        'Alphas',
        'Numbers',
        'Punctuation',
        'Function',
        'Specials',
        'Others',
        'Decals',
      ]
      for (const category of categories) {
        await expect(page.locator(`button:has-text("${category}")`).first()).toBeVisible()
      }
    })

    test('should remove legends from keys', async ({ page }) => {
      // Wait for the page to be fully loaded
      await page.waitForLoadState('networkidle')

      // First add a key if none exists (keyboard starts with 0 keys)
      await page.locator('button[title="Add Standard Key"]').click()
      await page.waitForTimeout(100)

      // Key should be automatically selected after adding, but let's ensure inputs are enabled
      await expect(page.locator('input[title="Top Left"]').first()).toBeEnabled()

      // Add a key with labels by typing in the properties panel using title selectors
      await page.locator('input[title="Top Left"]').first().fill('A')
      await page.locator('input[title="Top Center"]').first().fill('B')

      // Open legend tools panel
      await page.locator('[title="Extra Tools"]').click()
      await page.locator('button:has-text("Legend Tools")').click()

      // Click "All" to remove all legends (should be in remove tab by default)
      await page.locator('button:has-text("All")').first().click()

      // Panel should remain open (multiple operations allowed)
      await expect(page.locator('.legend-tools-panel')).toBeVisible()

      // Verify labels are cleared (check the input fields)
      await expect(page.locator('input[title="Top Left"]').first()).toHaveValue('')
      await expect(page.locator('input[title="Top Center"]').first()).toHaveValue('')
    })
  })

  test.describe('Align Tab', () => {
    test('should switch to align tab and display alignment buttons', async ({ page }) => {
      // Open legend tools panel
      await page.locator('[title="Extra Tools"]').click()
      await page.locator('button:has-text("Legend Tools")').click()

      // Switch to align tab
      await page.locator('label[for="tab-align"]').click()
      await expect(page.locator('#tab-align')).toBeChecked()

      // Check keycap preview is visible
      await expect(page.locator('.keycap-preview')).toBeVisible()

      // Check alignment buttons are present (9 buttons in 3x3 grid)
      const alignButtons = page.locator('.align-btn')
      await expect(alignButtons).toHaveCount(9)
    })

    test('should align legends when button clicked', async ({ page }) => {
      // First add a key (keyboard starts with 0 keys)
      await page.locator('button[title="Add Standard Key"]').click()
      await page.waitForTimeout(100)

      // Add a legend in non-aligned position
      await page.locator('input[title="Top Center"]').first().fill('Test') // Top-center position

      // Open legend tools panel and switch to align tab
      await page.locator('[title="Extra Tools"]').click()
      await page.locator('button:has-text("Legend Tools")').click()
      await page.locator('label[for="tab-align"]').click()

      // Click left alignment button (should move to top-left)
      await page.locator('.align-btn').first().click()

      // Panel should remain open
      await expect(page.locator('.legend-tools-panel')).toBeVisible()

      // Legend should have moved to top-left position
      await expect(page.locator('input[title="Top Left"]').first()).toHaveValue('Test')
      await expect(page.locator('input[title="Top Center"]').first()).toHaveValue('')
    })
  })

  test.describe('Move Tab', () => {
    test('should switch to move tab and display position selectors', async ({ page }) => {
      // Open legend tools panel
      await page.locator('[title="Extra Tools"]').click()
      await page.locator('button:has-text("Legend Tools")').click()

      // Switch to move tab
      await page.locator('label[for="tab-move"]').click()
      await expect(page.locator('#tab-move')).toBeChecked()

      // Check both keycap selectors are present
      await expect(page.locator('.keycap-selector')).toHaveCount(2)

      // Check position labels are present (should be 24, but allowing for title element)
      const labelCount = await page.locator('.position-label').count()
      expect(labelCount).toBeGreaterThanOrEqual(24)

      // Check that some expected labels are visible
      await expect(page.locator('label:has-text("TL")').first()).toBeVisible() // Top-Left
      await expect(page.locator('label:has-text("CC")').first()).toBeVisible() // Center-Center
      await expect(page.locator('label:has-text("BR")').first()).toBeVisible() // Bottom-Right
    })

    test('should enable move button when positions selected', async ({ page }) => {
      // Open legend tools panel and switch to move tab
      await page.locator('[title="Extra Tools"]').click()
      await page.locator('button:has-text("Legend Tools")').click()
      await page.locator('label[for="tab-move"]').click()

      // Initially, move button should be disabled
      await expect(page.locator('.btn-outline-secondary i.bi-arrow-right')).toBeDisabled()

      // Select from position (first TL radio button) - use force click due to overlay issues
      await page.locator('input[value="0"]').first().click({ force: true })

      // Select to position (second TC radio button)
      await page.locator('input[value="1"]').nth(1).click({ force: true })

      // Move button should now be enabled
      await expect(page.locator('.btn-outline-secondary i.bi-arrow-right')).toBeEnabled()
    })

    test('should move legend from one position to another', async ({ page }) => {
      // First add a key (keyboard starts with 0 keys)
      await page.locator('button[title="Add Standard Key"]').click()
      await page.waitForTimeout(100)

      // Add a legend to top-left position
      await page.locator('input[title="Top Left"]').first().fill('MoveMe')

      // Open legend tools panel and switch to move tab
      await page.locator('[title="Extra Tools"]').click()
      await page.locator('button:has-text("Legend Tools")').click()
      await page.locator('label[for="tab-move"]').click()

      // Select from position 0 (top-left) - use force click due to overlay issues
      await page.locator('input[value="0"]').first().click({ force: true })

      // Select to position 1 (top-center)
      await page.locator('input[value="1"]').nth(1).click({ force: true })

      // Click move button
      await page.locator('.btn-outline-secondary i.bi-arrow-right').click()
      await page.waitForTimeout(100) // Allow move operation to complete

      // Panel should remain open
      await expect(page.locator('.legend-tools-panel')).toBeVisible()

      // Legend should have moved
      await expect(page.locator('input[title="Top Left"]').first()).toHaveValue('')
      await expect(page.locator('input[title="Top Center"]').first()).toHaveValue('MoveMe')
    })

    test('should disable move button for same positions', async ({ page }) => {
      // Open legend tools panel and switch to move tab
      await page.locator('[title="Extra Tools"]').click()
      await page.locator('button:has-text("Legend Tools")').click()
      await page.locator('label[for="tab-move"]').click()

      // Select same position for both from and to - use force click due to overlay issues
      await page.locator('input[value="0"]').first().click({ force: true })
      await page.locator('input[value="0"]').nth(1).click({ force: true })

      // Move button should be disabled
      await expect(page.locator('.btn-outline-secondary i.bi-arrow-right')).toBeDisabled()
    })
  })

  test.describe('Panel Functionality', () => {
    test('should be draggable', async ({ page }) => {
      // Open legend tools panel
      await page.locator('[title="Extra Tools"]').click()
      await page.locator('button:has-text("Legend Tools")').click()

      // Panel should be visible
      await expect(page.locator('.legend-tools-panel')).toBeVisible()

      // Header should have drag handle
      await expect(page.locator('.legend-tools-panel .drag-handle')).toBeVisible()
    })

    test('should allow multiple operations without closing', async ({ page }) => {
      // First add a key (keyboard starts with 0 keys)
      await page.locator('button[title="Add Standard Key"]').click()
      await page.waitForTimeout(100)

      // Add some legends - mix of letters and numbers
      await page.locator('input[title="Top Left"]').first().fill('A')
      await page.locator('input[title="Top Center"]').first().fill('1')

      // Open legend tools panel
      await page.locator('[title="Extra Tools"]').click()
      await page.locator('button:has-text("Legend Tools")').click()

      // First operation - remove alphas (this should remove A but leave 1)
      await page.locator('button:has-text("Alphas")').click()

      // Panel should remain open
      await expect(page.locator('.legend-tools-panel')).toBeVisible()

      // Switch to move tab
      await page.locator('label[for="tab-move"]').click()

      // Perform move operation - move the remaining number from position 1 to position 2
      await page.locator('input[value="1"]').first().click({ force: true }) // From position 1
      await page.locator('input[value="2"]').nth(1).click({ force: true }) // To position 2
      await page.locator('.btn-outline-secondary i.bi-arrow-right').click()
      await page.waitForTimeout(100) // Allow move operation to complete

      // Panel should still be open
      await expect(page.locator('.legend-tools-panel')).toBeVisible()

      // Can switch tabs freely
      await page.locator('label[for="tab-align"]').click()
      await expect(page.locator('.keycap-preview')).toBeVisible()
    })

    test('should update status count when switching tabs', async ({ page }) => {
      // Open legend tools panel
      await page.locator('[title="Extra Tools"]').click()
      await page.locator('button:has-text("Legend Tools")').click()

      // Should show key count in remove tab
      await expect(page.locator('text=key(s) will be affected')).toBeVisible()

      // Switch to align tab - count might be different for non-decal keys
      await page.locator('label[for="tab-align"]').click()
      await expect(page.locator('text=key(s) will be affected')).toBeVisible()

      // Switch to move tab
      await page.locator('label[for="tab-move"]').click()
      await expect(page.locator('text=key(s) will be affected')).toBeVisible()
    })
  })

  test.describe('Accessibility', () => {
    test('should support escape key to close panel', async ({ page }) => {
      // Open legend tools panel
      await page.locator('[title="Extra Tools"]').click()
      await page.locator('button:has-text("Legend Tools")').click()

      // Panel should be visible
      await expect(page.locator('.legend-tools-panel')).toBeVisible()

      // Press escape key
      await page.keyboard.press('Escape')

      // Panel should close
      await expect(page.locator('.legend-tools-panel')).not.toBeVisible()
    })
  })

  test.describe('Error Handling', () => {
    test('should handle empty keyboard gracefully', async ({ page }) => {
      // Start fresh - no need to delete keys since we start with 0 by default

      // Open legend tools panel - should not crash
      await page.locator('[title="Extra Tools"]').click()
      await page.locator('button:has-text("Legend Tools")').click()

      // Should show 0 keys affected
      await expect(page.locator('text=0 key(s) will be affected')).toBeVisible()

      // Should still allow clicking buttons without errors
      await page.locator('button:has-text("All")').first().click()

      // Panel should remain open
      await expect(page.locator('.legend-tools-panel')).toBeVisible()
    })

    test('should handle keys with no legends gracefully', async ({ page }) => {
      // Add a key but don't add any legends to it
      await page.locator('button[title="Add Standard Key"]').click()
      await page.waitForTimeout(100)

      // Open legend tools panel and switch to move tab
      await page.locator('[title="Extra Tools"]').click()
      await page.locator('button:has-text("Legend Tools")').click()
      await page.locator('label[for="tab-move"]').click()

      // Select positions - use force click due to overlay issues
      await page.locator('input[value="0"]').first().click({ force: true })
      await page.locator('input[value="1"]').nth(1).click({ force: true })

      // Try to move (should handle empty source gracefully)
      await page.locator('.btn-outline-secondary i.bi-arrow-right').click()

      // Panel should remain open without errors
      await expect(page.locator('.legend-tools-panel')).toBeVisible()
    })
  })
})
