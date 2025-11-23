import { test, expect } from '@playwright/test'
import { KeyboardEditorPage } from './pages/KeyboardEditorPage'
import { PresetComponent } from './pages/components/PresetComponent'
import { WaitHelpers } from './helpers/wait-helpers'

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
    const editor = new KeyboardEditorPage(page)

    await expect(page.locator('h1')).toContainText('Keyboard Layout Editor NG')
    // Check that main components are loaded
    await editor.canvas.expectVisible()
  })

  test('should have main interface components', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)

    // Check toolbar is present
    await expect(page.getByTestId('toolbar-add-key')).toBeVisible()

    // Check canvas is present
    await editor.canvas.expectVisible()

    // Check properties panel is present
    await editor.properties.expectVisible()
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
    const editor = new KeyboardEditorPage(page)

    // Add 5 keys individually
    for (let i = 0; i < 5; i++) {
      await editor.toolbar.addKey()
    }

    // Should show 5 keys
    await editor.expectKeyCount(5)
  })

  test('should show key properties when key is selected', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)

    // Add a key
    await editor.toolbar.addKey()

    // Key should be selected after adding
    await editor.expectSelectedCount(1)

    // Should show property inputs
    await editor.properties.expectLabelInputVisible('center')
    await editor.properties.expectWidthInputVisible()
    await editor.properties.expectVisible()
  })

  test('should edit key properties', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)

    // Add a key
    await editor.toolbar.addKey()

    // Edit the center label (main label)
    await editor.properties.setLabel('center', 'Space')

    // Edit the width
    await editor.properties.setWidth(6.25)

    // Properties should persist (basic check)
    expect(await editor.properties.getLabel('center')).toBe('Space')
    await editor.properties.expectWidth(6.25)
  })

  test('should load presets', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)
    const waitHelpers = new WaitHelpers(page)
    const preset = new PresetComponent(page, waitHelpers)

    // Select ANSI 104 preset
    await preset.selectPreset('ANSI 104')

    // Wait for the preset to load using expect.poll
    await expect
      .poll(async () => {
        const keysCounter = await page.getByTestId('counter-keys').textContent()
        if (!keysCounter) return 0
        const match = keysCounter.match(/Keys: (\d+)/)
        return match ? parseInt(match[1]) : 0
      })
      .toBe(104)

    // Verify the final key count
    await editor.expectKeyCount(104)
  })

  test('should handle undo/redo operations', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)

    // Add a key
    await editor.toolbar.addKey()
    await editor.expectKeyCount(1)

    // Undo should be enabled
    await editor.toolbar.expectUndoEnabled()

    // Undo the addition
    await editor.toolbar.undo()
    await editor.expectKeyCount(0)

    // Redo should be enabled
    await editor.toolbar.expectRedoEnabled()

    // Redo the addition
    await editor.toolbar.redo()
    await editor.expectKeyCount(1)
  })

  test('should handle copy/paste operations', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)

    // Add a key
    await editor.toolbar.addKey()

    // Key should be selected by default
    await editor.expectSelectedCount(1)

    // Focus the canvas for keyboard shortcuts
    await editor.canvas.click()

    // Copy the key using keyboard shortcut (Ctrl+C)
    await page.keyboard.press('Control+c')

    // Paste the key using keyboard shortcut (Ctrl+V)
    await page.keyboard.press('Control+v')

    // Should now have 2 keys
    await editor.expectKeyCount(2)
  })

  test('should delete selected keys', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)

    // Add some keys
    await editor.toolbar.addKey()
    await editor.toolbar.addKey()
    await editor.expectKeyCount(2)

    // Select all keys
    await editor.canvas.selectAll()
    await editor.expectSelectedCount(2)

    // Delete selected keys
    await editor.toolbar.deleteKeys()

    // Should have no keys
    await editor.expectKeyCount(0)
  })

  test('should collapse properties panel', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)

    // Properties panel should be visible initially
    await editor.properties.expectVisible()

    // Find the collapse button for the properties section specifically - use section title to locate
    const propertiesSection = page
      .locator('.draggable-section')
      .filter({ hasText: 'Key Properties' })
    const collapseButton = propertiesSection.locator('.collapse-btn')
    await expect(collapseButton).toBeVisible()

    // Click to collapse
    await collapseButton.click()
    // Wait for panel to be hidden
    await editor.properties.expectHidden()

    // Properties panel should now be hidden (collapsed)
    await editor.properties.expectHidden()

    // Click to expand again
    await collapseButton.click()
    // Wait for panel to be visible again
    await editor.properties.expectVisible()

    // Properties panel should be visible again
    await editor.properties.expectVisible()
  })

  test('should show dirty state indicator', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)

    // Initially should not have unsaved changes
    await editor.expectNoUnsavedChanges()

    // Add a key to make it dirty
    await editor.toolbar.addKey()
    await editor.expectKeyCount(1)

    // Should show unsaved indicator
    await editor.expectUnsavedChanges()
  })

  test('should handle copy/paste operations via keyboard shortcuts', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)

    // Add a key first
    await editor.toolbar.addKey()

    // Ensure key is selected (should be by default)
    await editor.expectSelectedCount(1)

    // Focus the canvas for keyboard shortcuts
    await editor.canvas.click()

    // Copy using Ctrl+C
    await page.keyboard.press('Control+c')

    // Paste using Ctrl+V
    await page.keyboard.press('Control+v')

    // Should now have 2 keys
    await editor.expectKeyCount(2)

    // Test undo functionality
    await editor.toolbar.expectUndoEnabled()
    await editor.toolbar.undo()

    // Should be back to 1 key
    await editor.expectKeyCount(1)
  })
})
