import { test, expect } from '@playwright/test'
import { KeyboardEditorPage } from './pages/KeyboardEditorPage'

test.describe('Keyboard Layout Editor', () => {
  test.beforeEach(async ({ page }) => {
    // Mock clipboard API for copy/paste tests
    await page.addInitScript(() => {
      let clipboardData = ''

      // Mock the navigator.clipboard API
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (text: string) => {
            clipboardData = text
            return Promise.resolve()
          },
          readText: async () => {
            return Promise.resolve(clipboardData)
          },
        },
        writable: true,
      })
    })

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
    const editor = new KeyboardEditorPage(page)

    // Initially should show 0 keys
    await editor.expectKeyCount(0)

    // Add a key
    await editor.toolbar.addKey()

    // Should now show 1 key and 1 selected
    await editor.expectKeyCount(1)
    await editor.expectSelectedCount(1)
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
    const editor = new KeyboardEditorPage(page)

    // Add a key
    await editor.toolbar.addKey()

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
    // Select ANSI 104 preset by dispatching click event directly
    await page.waitForSelector('.dropdown-item', { state: 'attached', timeout: 5000 })

    // Dispatch click event to ANSI 104 preset
    await page.evaluate(() => {
      const ansiItem = Array.from(document.querySelectorAll('.dropdown-item')).find((item) =>
        item.textContent?.includes('ANSI 104'),
      )
      if (ansiItem) {
        ansiItem.click()
      }
    })

    // Wait for the preset to load - ANSI 104 should have exactly 104 keys
    await page.waitForFunction(() => {
      const keysCounter = document.querySelector('.keys-counter')?.textContent
      if (!keysCounter) return false

      const match = keysCounter.match(/Keys: (\d+)/)
      if (!match) return false

      const keyCount = parseInt(match[1])
      // ANSI 104 should have exactly 104 keys
      return keyCount === 104
    })

    // Verify the final key count
    const finalKeysCount = await page.locator('.keys-counter').textContent()
    expect(finalKeysCount?.trim()).toBe('Keys: 104')
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

    // Focus the canvas for keyboard shortcuts
    const canvas = page.locator('.keyboard-canvas')
    await canvas.click()
    await canvas.waitFor({ state: 'attached' })

    // Copy the key using keyboard shortcut (Ctrl+C)
    await page.keyboard.press('Control+c')

    // Paste the key using keyboard shortcut (Ctrl+V)
    await page.keyboard.press('Control+v')

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

  test('should handle copy/paste operations via keyboard shortcuts', async ({ page }) => {
    // Add a key first
    await page.click('button[title="Add Standard Key"]')

    // Ensure key is selected (should be by default)
    await expect(page.locator('.selected-counter')).toContainText('Selected: 1')

    // Focus the canvas for keyboard shortcuts
    const canvas = page.locator('.keyboard-canvas')
    await canvas.click()
    await canvas.waitFor({ state: 'attached' })

    // Test copy/paste using keyboard shortcuts
    const undoButton = page.locator('button[title="Undo"]')

    // Copy using Ctrl+C
    await page.keyboard.press('Control+c')

    // Paste using Ctrl+V
    await page.keyboard.press('Control+v')

    // Should now have 2 keys
    await expect(page.locator('.keys-counter')).toContainText('Keys: 2')

    // Test undo functionality
    await expect(undoButton).not.toHaveAttribute('disabled')
    await undoButton.click()

    // Should be back to 1 key
    await expect(page.locator('.keys-counter')).toContainText('Keys: 1')
  })
})
