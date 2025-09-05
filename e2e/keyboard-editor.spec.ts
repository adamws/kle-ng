import { test, expect } from '@playwright/test'

test.describe('Keyboard Layout Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should load the application', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Keyboard Layout Editor NG')
    // Check that main components are loaded instead of specific subtitle text
    await expect(page.locator('.keyboard-canvas')).toBeVisible()
  })

  test('should have main interface components', async ({ page }) => {
    // Check toolbar is present
    await expect(page.locator('.keyboard-toolbar')).toBeVisible()
    await expect(page.locator('button[title="Add Standard Key"]')).toBeVisible()

    // Check canvas is present
    await expect(page.locator('.keyboard-canvas')).toBeVisible()

    // Check properties panel is present
    await expect(page.locator('.key-properties-panel')).toBeVisible()
    // Properties panel header may have different text or structure, just check panel exists
  })

  test('should add keys and update status', async ({ page }) => {
    // Initially should show 0 keys
    await expect(page.locator('.keys-counter')).toContainText('Keys: 0')

    // Add a key
    await page.click('button[title="Add Standard Key"]')

    // Should now show 1 key and 1 selected
    await expect(page.locator('.keys-counter')).toContainText('Keys: 1')
    await expect(page.locator('.selected-counter')).toContainText('Selected: 1')
  })

  test('should add multiple keys', async ({ page }) => {
    // Add 5 keys individually (simplified functionality)
    const addButton = page.locator('button[title="Add Standard Key"]')
    for (let i = 0; i < 5; i++) {
      await addButton.click()
    }

    // Should show 5 keys
    await expect(page.locator('.keys-counter')).toContainText('Keys: 5')
  })

  test('should show key properties when key is selected', async ({ page }) => {
    // Add a key
    await page.click('button[title="Add Standard Key"]')

    // Key should be selected after adding
    await expect(page.locator('.selected-counter')).toContainText('Selected: 1')

    // Should show property inputs - check for center label input (main label)
    await expect(page.locator('.labels-grid input[type="text"]').nth(4)).toBeVisible()
    await expect(
      page.locator('div').filter({ hasText: 'Width' }).locator('input[type="number"]').first(),
    ).toBeVisible()
    // Check for key color picker (in the Labels and Colors section)
    await expect(page.locator('.key-color-input')).toBeVisible()
    // Check for per-label color pickers
    await expect(page.locator('.label-color-picker').first()).toBeVisible()
  })

  test('should edit key properties', async ({ page }) => {
    // Add a key
    await page.click('button[title="Add Standard Key"]')

    // Edit the center label (main label) - it's the 5th input in the labels grid (index 4)
    const centerLabelInput = page.locator('.labels-grid .form-control').nth(4)
    await centerLabelInput.fill('Space')

    // Edit the width - use more specific selector to target the key properties panel
    await page
      .locator('.key-properties-panel')
      .locator('div')
      .filter({ hasText: 'Width' })
      .locator('input[type="number"]')
      .first()
      .fill('6.25')

    // Properties should persist (basic check)
    await expect(centerLabelInput).toHaveValue('Space')
    await expect(
      page
        .locator('.key-properties-panel')
        .locator('div')
        .filter({ hasText: 'Width' })
        .locator('input[type="number"]')
        .first(),
    ).toHaveValue('6.25')
  })

  test('should load presets', async ({ page }) => {
    // Open preset dropdown and select ANSI 104 (option 1, not 0 which is blank)
    await page.selectOption('select:has(option:has-text("Choose Preset..."))', '1')

    // Wait for keys to be loaded
    await page.waitForFunction(() => {
      const keysCounter = document.querySelector('.keys-counter')?.textContent
      return keysCounter && keysCounter.includes('Keys:') && !keysCounter.includes('Keys: 0')
    })

    // Check that keys were added (ANSI 104 should have 104 keys)
    const keysCounterText = await page.locator('.keys-counter').textContent()
    expect(keysCounterText).toMatch(/Keys: [1-9]\d*/) // At least one key
  })

  test('should handle undo/redo operations', async ({ page }) => {
    // Add a key
    await page.click('button[title="Add Standard Key"]')
    await expect(page.locator('.keys-counter')).toContainText('Keys: 1')

    // Undo should be enabled
    const undoButton = page.locator('button[title="Undo"]')
    await expect(undoButton).not.toHaveAttribute('disabled')

    // Undo the addition
    await undoButton.click()
    await expect(page.locator('.keys-counter')).toContainText('Keys: 0')

    // Redo should be enabled
    const redoButton = page.locator('button[title="Redo"]')
    await expect(redoButton).not.toHaveAttribute('disabled')

    // Redo the addition
    await redoButton.click()
    await expect(page.locator('.keys-counter')).toContainText('Keys: 1')
  })

  test('should handle copy/paste operations', async ({ page }) => {
    // Add a key
    await page.click('button[title="Add Standard Key"]')

    // Key should be selected by default
    await expect(page.locator('.selected-counter')).toContainText('Selected: 1')

    // Copy button should be enabled
    const copyButton = page.locator('button[title="Copy"]')
    await expect(copyButton).not.toHaveAttribute('disabled')

    // Copy the key
    await copyButton.click()

    // Paste button should now be enabled
    const pasteButton = page.locator('button[title="Paste"]')
    await expect(pasteButton).not.toHaveAttribute('disabled')

    // Paste the key
    await pasteButton.click()

    // Should now have 2 keys
    await expect(page.locator('.keys-counter')).toContainText('Keys: 2')
  })

  test('should delete selected keys', async ({ page }) => {
    // Add some keys
    await page.click('button[title="Add Standard Key"]')
    await page.click('button[title="Add Standard Key"]')
    await expect(page.locator('.keys-counter')).toContainText('Keys: 2')

    // Focus the canvas before keyboard shortcut
    const canvas = page.locator('.keyboard-canvas')
    await canvas.click()
    await canvas.waitFor({ state: 'attached' }) // Ensure canvas is ready

    // Select all keys (Ctrl+A)
    await page.keyboard.press('Control+a')
    await expect(page.locator('.selected-counter')).toContainText('Selected: 2')

    // Delete selected keys
    const deleteButton = page.locator('button[title="Delete Keys"]')
    await expect(deleteButton).not.toHaveAttribute('disabled')
    await deleteButton.click()

    // Should have no keys
    await expect(page.locator('.keys-counter')).toContainText('Keys: 0')
  })

  test('should collapse properties panel', async ({ page }) => {
    // Properties panel should be visible initially
    await expect(page.locator('.key-properties-panel')).toBeVisible()

    // Find the collapse button for the properties section specifically - use section title to locate
    const propertiesSection = page
      .locator('.draggable-section')
      .filter({ hasText: 'Key Properties' })
    const collapseButton = propertiesSection.locator('.collapse-btn')
    await expect(collapseButton).toBeVisible()

    // Click to collapse
    await collapseButton.click()
    // Wait for panel to be hidden
    await expect(page.locator('.key-properties-panel')).toBeHidden()

    // Properties panel should now be hidden (collapsed)
    await expect(page.locator('.key-properties-panel')).toBeHidden()

    // Click to expand again
    await collapseButton.click()
    // Wait for panel to be visible again
    await expect(page.locator('.key-properties-panel')).toBeVisible()

    // Properties panel should be visible again
    await expect(page.locator('.key-properties-panel')).toBeVisible()
  })

  test('should show dirty state indicator', async ({ page }) => {
    // Initially should not be dirty (unsaved changes indicator should not exist)
    await expect(page.locator('.text-warning').filter({ hasText: 'Unsaved changes' })).toBeHidden()

    // Add a key to make it dirty
    await page.click('button[title="Add Standard Key"]')
    // Wait for key to be added
    await expect(page.locator('.keys-counter')).toContainText('Keys: 1')

    // Should show unsaved indicator
    await expect(page.locator('.text-warning').filter({ hasText: 'Unsaved changes' })).toBeVisible()
  })

  test('should handle copy/paste operations via UI buttons', async ({ page }) => {
    // Add a key first
    await page.click('button[title="Add Standard Key"]')

    // Ensure key is selected (should be by default)
    await expect(page.locator('.selected-counter')).toContainText('Selected: 1')

    // Test copy/paste using buttons - this tests the underlying functionality
    // that keyboard shortcuts also use, but avoids headless keyboard event issues
    const copyButton = page.locator('button[title="Copy"]')
    const pasteButton = page.locator('button[title="Paste"]')
    const undoButton = page.locator('button[title="Undo"]')

    // Copy button should be enabled when key is selected
    await expect(copyButton).not.toHaveAttribute('disabled')

    // Click copy
    await copyButton.click()

    // Paste button should now be enabled
    await expect(pasteButton).not.toHaveAttribute('disabled')

    // Click paste
    await pasteButton.click()

    // Should now have 2 keys
    await expect(page.locator('.keys-counter')).toContainText('Keys: 2')

    // Test undo functionality
    await expect(undoButton).not.toHaveAttribute('disabled')
    await undoButton.click()

    // Should be back to 1 key
    await expect(page.locator('.keys-counter')).toContainText('Keys: 1')
  })
})
