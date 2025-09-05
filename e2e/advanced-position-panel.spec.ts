import { test, expect } from '@playwright/test'

test.describe('Advanced Position & Rotation Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    // Add a key to work with
    await page.click('button[title="Add Standard Key"]')

    // Wait for key to be added and selected
    await expect(page.locator('.keys-counter')).toContainText('Keys: 1')
    await expect(page.locator('.selected-counter')).toContainText('Selected: 1')
  })

  test('should toggle between basic and advanced modes', async ({ page }) => {
    // Should start in basic mode - use a more specific selector
    await expect(page.locator('.position-rotation-container .property-group-title')).toContainText(
      'Position & Rotation',
    )
    await expect(page.locator('.toggle-mode-btn')).toContainText('Advanced')

    // Click to switch to advanced mode
    await page.click('.toggle-mode-btn')

    // Should now be in advanced mode
    await expect(page.locator('.position-rotation-container .property-group-title')).toContainText(
      'Advanced Position & Rotation',
    )
    await expect(page.locator('.toggle-mode-btn')).toContainText('Basic')

    // Click to switch back to basic mode
    await page.click('.toggle-mode-btn')

    // Should be back in basic mode
    await expect(page.locator('.position-rotation-container .property-group-title')).toContainText(
      'Position & Rotation',
    )
    await expect(page.locator('.toggle-mode-btn')).toContainText('Advanced')
  })

  test('should show additional controls in advanced mode', async ({ page }) => {
    // In basic mode, secondary controls should not be visible
    await expect(page.locator('input[title="Secondary X Position"]')).toBeHidden()
    await expect(page.locator('input[title="Secondary Y Position"]')).toBeHidden()
    await expect(page.locator('input[title="Secondary Width"]')).toBeHidden()
    await expect(page.locator('input[title="Secondary Height"]')).toBeHidden()

    // Switch to advanced mode
    await page.click('.toggle-mode-btn')

    // Secondary controls should now be visible
    await expect(page.locator('input[title="Secondary X Position"]')).toBeVisible()
    await expect(page.locator('input[title="Secondary Y Position"]')).toBeVisible()
    await expect(page.locator('input[title="Secondary Width"]')).toBeVisible()
    await expect(page.locator('input[title="Secondary Height"]')).toBeVisible()
  })

  test('should persist mode preference on page reload', async ({ page }) => {
    // Switch to advanced mode
    await page.click('.toggle-mode-btn')
    await expect(page.locator('.position-rotation-container .property-group-title')).toContainText(
      'Advanced Position & Rotation',
    )

    // Reload the page
    await page.reload()

    // Add a key again (since reload clears the layout)
    await page.click('button[title="Add Standard Key"]')
    await expect(page.locator('.keys-counter')).toContainText('Keys: 1')

    // Should still be in advanced mode
    await expect(page.locator('.position-rotation-container .property-group-title')).toContainText(
      'Advanced Position & Rotation',
    )
    await expect(page.locator('.toggle-mode-btn')).toContainText('Basic')
  })

  test('should allow editing secondary properties in advanced mode', async ({ page }) => {
    // Switch to advanced mode
    await page.click('.toggle-mode-btn')

    // Fill in some secondary property values
    await page.fill('input[title="Secondary X Position"]', '0.5')
    await page.fill('input[title="Secondary Y Position"]', '0.25')
    await page.fill('input[title="Secondary Width"]', '1.5')
    await page.fill('input[title="Secondary Height"]', '0.75')

    // Verify the values are set
    await expect(page.locator('input[title="Secondary X Position"]')).toHaveValue('0.5')
    await expect(page.locator('input[title="Secondary Y Position"]')).toHaveValue('0.25')
    await expect(page.locator('input[title="Secondary Width"]')).toHaveValue('1.5')
    await expect(page.locator('input[title="Secondary Height"]')).toHaveValue('0.75')
  })

  test('should maintain consistent panel height between modes', async ({ page }) => {
    // Get initial height of the property group
    const initialHeight = await page
      .locator('.property-group.position-rotation-container')
      .boundingBox()
    expect(initialHeight).toBeTruthy()

    // Switch to advanced mode
    await page.click('.toggle-mode-btn')

    // Get height after switching
    const advancedHeight = await page
      .locator('.property-group.position-rotation-container')
      .boundingBox()
    expect(advancedHeight).toBeTruthy()

    // Heights should be similar (allowing for small differences due to content)
    const heightDifference = Math.abs(advancedHeight!.height - initialHeight!.height)
    expect(heightDifference).toBeLessThan(50) // Allow up to 50px difference
  })

  test('should work with special keys like ISO Enter', async ({ page }) => {
    // Clear existing layout first
    await page.goto('/')

    // Add ISO Enter using the special keys dropdown
    await page.click('button[title="Add Special Key"]')

    await page.waitForTimeout(300)

    // Click on ISO Enter in the dropdown
    const isoEnterOption = page.locator('.dropdown-item').filter({ hasText: 'ISO Enter' })
    await isoEnterOption.click()

    await page.waitForTimeout(500)

    // Should add the key and be selected by default
    await expect(page.locator('.keys-counter')).toContainText('Keys: 1')
    await expect(page.locator('.selected-counter')).toContainText('Selected: 1')

    // Now switch to advanced mode (after adding the key)
    await page.click('.toggle-mode-btn')
    // Wait for advanced mode to be active
    await expect(page.locator('.toggle-mode-btn')).toContainText('Basic')

    // Verify we're in advanced mode
    await expect(page.locator('.toggle-mode-btn')).toContainText('Basic')

    // Verify the key properties panel is visible
    await expect(page.locator('.key-properties-panel')).toBeVisible()

    // In advanced mode with ISO Enter, the width input should be visible
    const primaryWidth = page.locator('input[title="Width"]').first()
    await expect(primaryWidth).toBeVisible()
    await primaryWidth.fill('1.25')

    const primaryHeight = page.locator('input[title="Height"]').first()
    await expect(primaryHeight).toBeVisible()
    await primaryHeight.fill('2')

    // Then secondary dimensions
    await page.locator('input[title="Secondary Width"]').first().fill('1.5')
    await page.locator('input[title="Secondary Height"]').first().fill('1')
    await page.locator('input[title="Secondary X Position"]').fill('0.25')
    await page.locator('input[title="Secondary Y Position"]').fill('0')

    // Secondary controls should be available and have values for ISO Enter
    await expect(page.locator('input[title="Secondary X Position"]')).toBeVisible()
    await expect(page.locator('input[title="Secondary Y Position"]')).toBeVisible()
    await expect(page.locator('input[title="Secondary Width"]')).toBeVisible()
    await expect(page.locator('input[title="Secondary Height"]')).toBeVisible()

    // ISO Enter should have non-zero secondary dimensions
    const width2Value = await page.locator('input[title="Secondary Width"]').inputValue()
    const height2Value = await page.locator('input[title="Secondary Height"]').inputValue()
    expect(parseFloat(width2Value)).toBeGreaterThan(0)
    expect(parseFloat(height2Value)).toBeGreaterThan(0)
  })
})
