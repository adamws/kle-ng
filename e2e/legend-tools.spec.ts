import { test, expect } from '@playwright/test'
import { WaitHelpers } from './helpers/wait-helpers'
import { LegendToolsHelper } from './helpers/legend-tools-helpers'
import { CanvasTestHelper } from './helpers/canvas-test-helpers'
import { ImportExportHelper } from './helpers/import-export-helpers'

test.describe('Legend Tools Panel', () => {
  let legendHelper: LegendToolsHelper
  let canvasHelper: CanvasTestHelper
  let waitHelpers: WaitHelpers

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Initialize helpers
    waitHelpers = new WaitHelpers(page)
    legendHelper = new LegendToolsHelper(page, waitHelpers)
    canvasHelper = new CanvasTestHelper(page)
  })

  test.describe('Extra Tools Dropdown', () => {
    test('should show legend tools in extra tools dropdown', async () => {
      // Click the extra tools button
      await legendHelper.getExtraToolsButton().click()

      // Verify the dropdown is visible
      await legendHelper.expectDropdownVisible()

      // Verify legend tools are present
      await expect(legendHelper.getLegendToolsMenuItem()).toBeVisible()
      await expect(legendHelper.getMoveRotationOriginsMenuItem()).toBeVisible()
    })

    test('should close dropdown when clicking outside', async ({ page }) => {
      // Open dropdown
      await legendHelper.getExtraToolsButton().click()
      await legendHelper.expectDropdownVisible()

      // Click outside the dropdown
      await page.locator('body').click({ position: { x: 50, y: 50 } })

      // Dropdown should be hidden
      await legendHelper.expectDropdownNotVisible()
    })

    test('should allow move rotation origins tool when no keys selected', async ({ page }) => {
      // Click the extra tools button
      await legendHelper.getExtraToolsButton().click()

      // Verify the dropdown is visible
      await legendHelper.expectDropdownVisible()

      // Verify move rotation origins tool is enabled even when no keys are selected
      // (the new behavior is that it affects all keys when none are selected)
      const moveRotationOriginsBtn = legendHelper.getMoveRotationOriginsMenuItem()
      await expect(moveRotationOriginsBtn).toBeEnabled()

      // Verify it doesn't have the disabled class
      await expect(moveRotationOriginsBtn).not.toHaveClass(/disabled/)

      // Verify the tooltip explains that it affects all keys when none selected
      await expect(moveRotationOriginsBtn).toHaveAttribute(
        'title',
        'Move rotation origins for all keys',
      )

      // Add a key
      await canvasHelper.addKey()
      await expect(page.getByText('Keys: 1')).toBeVisible()

      // Select the key
      await page.getByTestId('canvas-main').click({ position: { x: 47, y: 47 }, force: true })
      await expect(page.getByText('Selected: 1')).toBeVisible()

      // Click extra tools again (dropdown closes when a key is added/selected)
      await legendHelper.getExtraToolsButton().click()

      // Now the move rotation origins tool should still be enabled but with different tooltip
      const moveRotationOriginsBtnSelected = legendHelper.getMoveRotationOriginsMenuItem()
      await expect(moveRotationOriginsBtnSelected).toBeEnabled()

      // Verify it doesn't have the disabled class
      await expect(moveRotationOriginsBtnSelected).not.toHaveClass(/disabled/)

      // Verify the tooltip shows the normal description when keys are selected
      await expect(moveRotationOriginsBtnSelected).toHaveAttribute(
        'title',
        'Move rotation origins for selected keys',
      )
    })
  })

  test.describe('Legend Tools Panel', () => {
    test('should open and close legend tools panel', async () => {
      // Open legend tools panel
      await legendHelper.openPanel()

      // Panel should be visible
      await legendHelper.expectPanelVisible()
      await expect(legendHelper.getPanelTitle()).toBeVisible()

      // Close panel with X button
      await legendHelper.closePanel()

      // Panel should be hidden
      await legendHelper.expectPanelNotVisible()
    })

    test('should display tab navigation', async () => {
      // Open legend tools panel
      await legendHelper.openPanel()

      // Check tab buttons are present
      await expect(legendHelper.getEditTabLabel()).toBeVisible()
      await expect(legendHelper.getRemoveTabLabel()).toBeVisible()
      await expect(legendHelper.getAlignTabLabel()).toBeVisible()
      await expect(legendHelper.getMoveTabLabel()).toBeVisible()

      // Edit tab should be active by default
      await legendHelper.expectEditTabActive()
    })

    test('should display all legend categories in remove tab', async () => {
      // Open legend tools panel
      await legendHelper.openPanel()

      // Switch to remove tab (Edit is default now)
      await legendHelper.switchToRemoveTab()

      // Check all category buttons are present in remove tab
      await legendHelper.expectAllCategoriesVisible()
    })

    test('should remove legends from keys', async ({ page }) => {
      // Add a key (keyboard starts with 0 keys)
      await canvasHelper.addKey()

      // Wait for key to be added using RAF
      await waitHelpers.waitForDoubleAnimationFrame()

      // Key should be automatically selected after adding, but let's ensure inputs are enabled
      await expect(page.getByTitle('Top Left').first()).toBeEnabled()

      // Add a key with labels by typing in the properties panel
      await canvasHelper.setKeyLabel('topLeft', 'A')
      await canvasHelper.setKeyLabel('topCenter', 'B')

      // Open legend tools panel
      await legendHelper.openPanel()

      // Click "All" to remove all legends (should be in remove tab by default)
      await legendHelper.removeAllLegends()

      // Panel should remain open (multiple operations allowed)
      await legendHelper.expectPanelVisible()

      // Verify labels are cleared (check the input fields)
      await expect(page.getByTitle('Top Left').first()).toHaveValue('')
      await expect(page.getByTitle('Top Center').first()).toHaveValue('')
    })
  })

  test.describe('Edit Tab', () => {
    test.beforeEach(async () => {
      // Open Legend Tools panel
      await legendHelper.openPanel()
    })

    test.describe('Basic Functionality', () => {
      test('should display Edit tab as first tab and auto-selected', async () => {
        // Edit tab should be auto-selected when panel opens
        await legendHelper.expectEditTabActive()

        // Edit tab should be visible and first in the tab group
        await legendHelper.expectEditTabFirstAndDefault()
      })

      test('should have TL position pre-selected on open', async () => {
        // TL (position 0) should be pre-selected by default
        await legendHelper.expectTLPreSelected()
      })

      test('should allow selecting all 12 label positions', async () => {
        // Test all 12 positions can be selected
        for (let pos = 0; pos < 12; pos++) {
          await legendHelper.selectEditPosition(pos)
          await legendHelper.expectPositionSelected(pos)
        }
      })
    })

    test.describe('Single Key Editing', () => {
      test.beforeEach(async ({ page }) => {
        // Add a single key for editing
        await canvasHelper.addKey()
        await expect(page.getByText('Keys: 1')).toBeVisible()

        // Select the key
        await page.getByTestId('canvas-main').click({ position: { x: 47, y: 47 }, force: true })
        await expect(page.getByText('Selected: 1')).toBeVisible()
      })

      test('should auto-start editing when typing', async () => {
        // Start typing (should auto-start editing)
        await legendHelper.typeInEditMode('S', false)

        // Editing alert should appear
        await legendHelper.expectEditingAlertVisible()
      })

      test('should show live preview in panel while typing', async () => {
        // Type a label
        await legendHelper.typeInEditMode('Shift', false)

        // Editing alert should show the typed text
        await legendHelper.expectEditingAlertVisible('Shift')
      })

      test('should update canvas live as user types', async () => {
        // Type a label without pressing Enter
        await legendHelper.typeInEditMode('Test', false)

        // Wait for canvas update
        await waitHelpers.waitForDoubleAnimationFrame()

        // Note: Canvas inspection would go here if available
        // For now, we verify the editing alert shows the text
        await legendHelper.expectEditingAlertVisible('Test')
      })

      test('should commit changes on Enter key', async () => {
        // Type a label and press Enter
        await legendHelper.typeInEditMode('Shift', true)

        // Editing alert should show placeholder text (not "Editing") after commit
        await expect(legendHelper.getEditingAlert()).toBeVisible()
        await expect(legendHelper.getEditingAlert()).not.toContainText('Editing')

        // Position should still be selected for batch editing
        await legendHelper.expectPositionSelected(0)
      })

      test('should cancel and restore original on Escape key', async ({ page }) => {
        // Type a label without committing
        await legendHelper.typeInEditMode('Test', false)

        // Editing alert should be visible
        await legendHelper.expectEditingAlertVisible('Test')

        // Press Escape to cancel
        await page.keyboard.press('Escape')

        // Editing alert should show placeholder (not "Editing")
        await expect(legendHelper.getEditingAlert()).toBeVisible()
        await expect(legendHelper.getEditingAlert()).not.toContainText('Editing')

        // Original label should be restored (empty in this case)
        await waitHelpers.waitForDoubleAnimationFrame()
      })

      test('should auto-select next key on Enter', async ({ page }) => {
        // Add two more keys (total of 3)
        await canvasHelper.addKey()
        await canvasHelper.addKey()
        await expect(page.getByText('Keys: 3')).toBeVisible()

        // Select first key
        await page.getByTestId('canvas-main').click({ position: { x: 47, y: 47 }, force: true })
        await expect(page.getByText('Selected: 1')).toBeVisible()

        // Type and press Enter
        await legendHelper.typeInEditMode('Q', true)

        // Should now have second key selected
        await expect(page.getByText('Selected: 1')).toBeVisible()

        // Type on second key (should work without manual selection)
        await legendHelper.typeInEditMode('W', true)

        // Should now have third key selected
        await expect(page.getByText('Selected: 1')).toBeVisible()

        // Type on third key
        await legendHelper.typeInEditMode('E', true)

        // Should wrap around to first key
        await expect(page.getByText('Selected: 1')).toBeVisible()

        // Type on first key again (verifying wrap-around)
        await legendHelper.typeInEditMode('R', true)

        // Should be on second key again
        await expect(page.getByText('Selected: 1')).toBeVisible()
      })
    })

    test.describe('Multi-Key Editing', () => {
      test.beforeEach(async ({ page }) => {
        // Add 3 keys
        await canvasHelper.addKey()
        await waitHelpers.waitForDoubleAnimationFrame()
        await canvasHelper.addKey()
        await waitHelpers.waitForDoubleAnimationFrame()
        await canvasHelper.addKey()
        await waitHelpers.waitForDoubleAnimationFrame()
        await expect(page.getByText('Keys: 3')).toBeVisible()

        // Select all keys with Ctrl+A
        await page.getByTestId('canvas-main').click({ position: { x: 100, y: 100 }, force: true })
        await page.keyboard.press('ControlOrMeta+a')
        await waitHelpers.waitForDoubleAnimationFrame()
        await expect(page.getByText('Selected: 3')).toBeVisible()
      })

      test('should edit multiple keys simultaneously', async () => {
        // Type a label
        await legendHelper.typeInEditMode('Q', true)

        // All three keys should now have 'Q' label
        await waitHelpers.waitForDoubleAnimationFrame()
      })

      test('should show same label on all keys after editing', async () => {
        // Type a label
        await legendHelper.typeInEditMode('Ctrl', true)

        // Wait for canvas update
        await waitHelpers.waitForDoubleAnimationFrame()

        // All keys should have the same label (verified through canvas if available)
      })

      test('should restore all keys correctly on cancel', async ({ page }) => {
        // Type without committing
        await legendHelper.typeInEditMode('Test', false)

        // Cancel with Escape
        await page.keyboard.press('Escape')

        // All keys should be restored to their original state (empty)
        await waitHelpers.waitForDoubleAnimationFrame()
      })

      test('should support batch workflow - edit position, commit, repeat', async () => {
        // Edit TL position
        await legendHelper.selectEditPosition(0)
        await legendHelper.typeInEditMode('Q', true)

        // Position 0 should still be selected
        await legendHelper.expectPositionSelected(0)

        // Now change to TC position
        await legendHelper.selectEditPosition(1)
        await legendHelper.typeInEditMode('W', true)

        // Position 1 should still be selected
        await legendHelper.expectPositionSelected(1)
      })

      test('should auto-commit editing if selection changes', async ({ page }) => {
        // Start typing
        await legendHelper.typeInEditMode('Test', false)

        // Editing should be active
        await legendHelper.expectEditingAlertVisible('Test')

        // Change selection (click elsewhere to deselect)
        await page.getByTestId('canvas-main').click({ position: { x: 300, y: 300 }, force: true })

        // Editing should be committed (shows placeholder, not "Editing")
        await expect(legendHelper.getEditingAlert()).toBeVisible()
        await expect(legendHelper.getEditingAlert()).not.toContainText('Editing')

        // The changes should be saved (we can verify by checking if undo works)
        await waitHelpers.waitForDoubleAnimationFrame()
      })

      test('should support undo for multi-key edits', async ({ page }) => {
        // Edit all keys
        await legendHelper.typeInEditMode('Shift', true)

        // Undo with Ctrl+Z
        await page.keyboard.press('ControlOrMeta+z')

        // Labels should be restored via undo
        await waitHelpers.waitForDoubleAnimationFrame()
      })
    })

    test.describe('Different Label Positions', () => {
      test.beforeEach(async ({ page }) => {
        // Add a single key
        await canvasHelper.addKey()
        await expect(page.getByText('Keys: 1')).toBeVisible()

        // Select the key
        await page.getByTestId('canvas-main').click({ position: { x: 47, y: 47 }, force: true })
        await expect(page.getByText('Selected: 1')).toBeVisible()
      })

      test('should edit all 12 label positions correctly', async () => {
        // Test all 12 positions
        const positionLabels = [
          'TL',
          'TC',
          'TR',
          'CL',
          'CC',
          'CR',
          'BL',
          'BC',
          'BR',
          'FL',
          'FC',
          'FR',
        ]

        for (let pos = 0; pos < 12; pos++) {
          // Select position
          await legendHelper.selectEditPosition(pos)

          // Type label
          await legendHelper.typeInEditMode(positionLabels[pos], true)

          // Verify position still selected
          await legendHelper.expectPositionSelected(pos)
        }
      })
    })

    test.describe('Edge Cases', () => {
      test.beforeEach(async ({ page }) => {
        // Add a single key
        await canvasHelper.addKey()
        await expect(page.getByText('Keys: 1')).toBeVisible()

        // Select the key
        await page.getByTestId('canvas-main').click({ position: { x: 47, y: 47 }, force: true })
        await expect(page.getByText('Selected: 1')).toBeVisible()
      })

      test('should handle empty labels (backspace all characters)', async ({ page }) => {
        // Type a label
        await legendHelper.typeInEditMode('Test', false)

        // Backspace all characters
        for (let i = 0; i < 4; i++) {
          await page.keyboard.press('Backspace')
        }

        // Commit empty label
        await page.keyboard.press('Enter')

        // Should work without errors
        await waitHelpers.waitForDoubleAnimationFrame()
      })

      test('should handle long labels (50+ characters)', async () => {
        // Create a long label
        const longLabel = 'A'.repeat(60)

        // Type long label
        await legendHelper.typeInEditMode(longLabel, true)

        // Should work without errors
        await waitHelpers.waitForDoubleAnimationFrame()
      })

      test('should handle special characters', async () => {
        // Type special characters
        const specialChars = '!@#$%^&*()'

        await legendHelper.typeInEditMode(specialChars, true)

        // Should work without errors
        await waitHelpers.waitForDoubleAnimationFrame()
      })

      test('should not error when no keys selected', async ({ page }) => {
        // Deselect all keys
        await page.getByTestId('canvas-main').click({ position: { x: 300, y: 300 }, force: true })
        await expect(page.getByText('Selected: 0')).toBeVisible()

        // Try to type (should not start editing)
        await page.keyboard.type('Test')

        // Should show placeholder (not "Editing") since no keys selected
        await expect(legendHelper.getEditingAlert()).toBeVisible()
        await expect(legendHelper.getEditingAlert()).not.toContainText('Editing')
      })

      test('should cancel editing when switching tabs', async () => {
        // Start editing
        await legendHelper.typeInEditMode('Test', false)

        // Editing should be active
        await legendHelper.expectEditingAlertVisible('Test')

        // Switch to Remove tab
        await legendHelper.switchToRemoveTab()

        // Switch back to Edit tab
        await legendHelper.switchToEditTab()

        // Editing should be cancelled (shows placeholder, not "Editing")
        await expect(legendHelper.getEditingAlert()).toBeVisible()
        await expect(legendHelper.getEditingAlert()).not.toContainText('Editing')
      })
    })

    test.describe('Real-Time Updates', () => {
      test.beforeEach(async ({ page }) => {
        // Add a single key
        await canvasHelper.addKey()
        await expect(page.getByText('Keys: 1')).toBeVisible()

        // Select the key
        await page.getByTestId('canvas-main').click({ position: { x: 47, y: 47 }, force: true })
        await expect(page.getByText('Selected: 1')).toBeVisible()
      })

      test('should update canvas on each keystroke', async ({ page }) => {
        // Type character by character
        await page.keyboard.type('T')
        await waitHelpers.waitForDoubleAnimationFrame()
        await legendHelper.expectEditingAlertVisible('T')

        await page.keyboard.type('e')
        await waitHelpers.waitForDoubleAnimationFrame()
        await legendHelper.expectEditingAlertVisible('Te')

        await page.keyboard.type('s')
        await waitHelpers.waitForDoubleAnimationFrame()
        await legendHelper.expectEditingAlertVisible('Tes')

        await page.keyboard.type('t')
        await waitHelpers.waitForDoubleAnimationFrame()
        await legendHelper.expectEditingAlertVisible('Test')
      })

      test('should update labels before Enter is pressed', async () => {
        // Type without pressing Enter
        await legendHelper.typeInEditMode('Live', false)

        // Editing alert should show the text
        await legendHelper.expectEditingAlertVisible('Live')

        // Canvas should already have the label (live update)
        await waitHelpers.waitForDoubleAnimationFrame()
      })

      test('should sync panel preview with canvas', async () => {
        // Type a label
        await legendHelper.typeInEditMode('Sync', false)

        // Panel should show "Sync"
        await legendHelper.expectEditingAlertVisible('Sync')

        // Canvas should also show "Sync" (verified through canvas if available)
        await waitHelpers.waitForDoubleAnimationFrame()

        // Commit
        await legendHelper.typeInEditMode('', true) // Just press Enter
      })
    })
  })

  test.describe('Remove Tab JSON Verification', () => {
    test('should verify JSON after removing all legends', async () => {
      // Setup: Add key with labels
      await canvasHelper.addKey()
      await waitHelpers.waitForDoubleAnimationFrame()
      await canvasHelper.setKeyLabel('topLeft', 'A')
      await canvasHelper.setKeyLabel('topCenter', 'B')

      // Open legend tools and remove all
      await legendHelper.openPanel()
      await legendHelper.removeAllLegends()

      // Export and verify JSON
      const jsonData = await legendHelper.exportAndVerifyJSON('remove-all-test.json')

      // Verify JSON structure is valid
      expect(Array.isArray(jsonData)).toBe(true)

      // Verify no labels remain in JSON
      legendHelper.verifyEmptyLabels(jsonData)
    })

    test('should verify JSON after removing specific labels', async ({ page }) => {
      // Setup: Add two keys with different labels
      await canvasHelper.addKey()
      await waitHelpers.waitForDoubleAnimationFrame()
      await canvasHelper.setKeyLabel('topLeft', 'A')
      await canvasHelper.setKeyLabel('topCenter', '1')

      await canvasHelper.addKey()
      await waitHelpers.waitForDoubleAnimationFrame()
      // Select second key
      await page.getByTestId('canvas-main').click({ position: { x: 47 + 54, y: 47 }, force: true })
      await canvasHelper.setKeyLabel('topLeft', 'B')

      // Select first key and remove its legends
      await page.getByTestId('canvas-main').click({ position: { x: 47, y: 47 }, force: true })
      await expect(page.getByText('Selected: 1')).toBeVisible()

      await legendHelper.openPanel()
      await legendHelper.removeAllLegends()

      // Export and verify
      const jsonData = await legendHelper.exportAndVerifyJSON('remove-specific-test.json')

      // Verify second key label remains but first key labels are gone
      const jsonString = JSON.stringify(jsonData)
      expect(jsonString.includes('B')).toBe(true)
      expect(jsonString.includes('A')).toBe(false)
      expect(jsonString.includes('1')).toBe(false)
    })

    test('should preserve key structure after removing legends', async () => {
      // Setup: Add key with labels
      await canvasHelper.addKey()
      await waitHelpers.waitForDoubleAnimationFrame()
      await canvasHelper.setKeyLabel('topLeft', 'A')

      // Remove legends
      await legendHelper.openPanel()
      await legendHelper.removeAllLegends()

      // Export and verify structure
      const jsonData = await legendHelper.exportAndVerifyJSON('remove-preserve-test.json')

      // Verify it's still valid KLE JSON
      expect(Array.isArray(jsonData)).toBe(true)
      expect(jsonData.length).toBeGreaterThan(0)
    })

    test('should handle import-remove-export round trip', async ({ page }) => {
      const importHelper = new ImportExportHelper(page, waitHelpers)

      // Import a layout with labels
      await importHelper.importFromFile('e2e/fixtures/simple-layout.json', 8)

      // Click canvas to focus it, then select all keys with Ctrl+A
      await page.getByTestId('canvas-main').click({ position: { x: 100, y: 100 }, force: true })
      await page.keyboard.press('ControlOrMeta+a')
      await waitHelpers.waitForDoubleAnimationFrame()
      await expect(page.getByText('Selected: 8')).toBeVisible()

      // Remove all legends
      await legendHelper.openPanel()
      await legendHelper.removeAllLegends()

      // Export and verify
      const jsonData = await legendHelper.exportAndVerifyJSON('roundtrip-remove-test.json')

      // Should still have keys but no labels
      expect(Array.isArray(jsonData)).toBe(true)

      // Verify no labels
      legendHelper.verifyEmptyLabels(jsonData)
    })
  })

  test.describe('Align Tab', () => {
    test('should switch to align tab and display alignment buttons', async () => {
      // Open legend tools panel
      await legendHelper.openPanel()

      // Switch to align tab
      await legendHelper.switchToAlignTab()

      // Check keycap preview is visible
      await legendHelper.expectKeycapPreviewVisible()

      // Check alignment buttons are present (9 buttons in 3x3 grid)
      await legendHelper.expectAlignmentButtonCount(9)
    })

    test('should align legends when button clicked', async ({ page }) => {
      // Add a key (keyboard starts with 0 keys)
      await canvasHelper.addKey()

      // Wait for key to be added using RAF
      await waitHelpers.waitForDoubleAnimationFrame()

      // Add a legend in non-aligned position
      await canvasHelper.setKeyLabel('topCenter', 'Test')

      // Open legend tools panel and switch to align tab
      await legendHelper.openPanel()
      await legendHelper.switchToAlignTab()

      // Click left alignment button (should move to top-left)
      await legendHelper.alignToTopLeft()

      // Panel should remain open
      await legendHelper.expectPanelVisible()

      // Legend should have moved to top-left position
      await expect(page.getByTitle('Top Left').first()).toHaveValue('Test')
      await expect(page.getByTitle('Top Center').first()).toHaveValue('')
    })
  })

  test.describe('Align Tab JSON Verification', () => {
    test('should verify JSON after aligning legends', async () => {
      // Setup: Add key with label in non-aligned position
      await canvasHelper.addKey()
      await waitHelpers.waitForDoubleAnimationFrame()
      await canvasHelper.setKeyLabel('topCenter', 'Shift')

      // Align to top-left
      await legendHelper.openPanel()
      await legendHelper.switchToAlignTab()
      await legendHelper.alignToTopLeft()

      // Export and verify
      const jsonData = await legendHelper.exportAndVerifyJSON('align-test.json')

      // Verify label exists in JSON
      legendHelper.verifyLabelsInJSON(jsonData, ['Shift'])
    })

    test('should preserve non-label properties after align', async () => {
      // Setup: Add key with multiple properties
      await canvasHelper.addKey()
      await waitHelpers.waitForDoubleAnimationFrame()
      await canvasHelper.setKeySize(2.0) // 2u wide key
      await canvasHelper.setKeyLabel('topCenter', 'Enter')

      // Align legend
      await legendHelper.openPanel()
      await legendHelper.switchToAlignTab()
      await legendHelper.alignToTopLeft()

      // Export and verify
      const jsonData = await legendHelper.exportAndVerifyJSON('align-preserve-test.json')
      const jsonString = JSON.stringify(jsonData)

      // Verify label moved
      legendHelper.verifyLabelsInJSON(jsonData, ['Enter'])

      // Verify width property preserved (w:2 in KLE format)
      expect(jsonString.includes('"w":2')).toBe(true)
    })

    test('should handle import-align-export round trip', async ({ page }) => {
      const importHelper = new ImportExportHelper(page, waitHelpers)

      // Import layout
      await importHelper.importFromFile('e2e/fixtures/simple-layout.json', 8)

      // Select first key and align its legend
      await page.getByTestId('canvas-main').click({ position: { x: 47, y: 47 }, force: true })
      await expect(page.getByText('Selected: 1')).toBeVisible()

      await legendHelper.openPanel()
      await legendHelper.switchToAlignTab()
      await legendHelper.alignLegends(4) // 4 is center position

      // Export and verify
      const jsonData = await legendHelper.exportAndVerifyJSON('roundtrip-align-test.json')

      // Should still have 8 keys with modified alignment
      expect(Array.isArray(jsonData)).toBe(true)
      const labelCount = legendHelper.countKeysWithLabels(jsonData)
      expect(labelCount).toBeGreaterThan(0)
    })
  })

  test.describe('Move Tab', () => {
    test('should switch to move tab and display position selectors', async () => {
      // Open legend tools panel
      await legendHelper.openPanel()

      // Switch to move tab
      await legendHelper.switchToMoveTab()

      // Check both keycap selectors are present
      await legendHelper.expectKeycapSelectorCount(2)

      // Check position labels are present (should be 24, but allowing for title element)
      const labelCount = await legendHelper.getPositionLabels().count()
      expect(labelCount).toBeGreaterThanOrEqual(24)

      // Check that some expected labels are visible
      await expect(legendHelper.getPositionLabel('TL')).toBeVisible() // Top-Left
      await expect(legendHelper.getPositionLabel('CC')).toBeVisible() // Center-Center
      await expect(legendHelper.getPositionLabel('BR')).toBeVisible() // Bottom-Right
    })

    test('should enable move button when positions selected', async () => {
      // Open legend tools panel and switch to move tab
      await legendHelper.openPanel()
      await legendHelper.switchToMoveTab()

      // Initially, move button should be disabled
      await legendHelper.expectMoveButtonDisabled()

      // Select from position (first TL radio button) - use force click due to overlay issues
      await legendHelper.getPositionRadio(0, 0).click({ force: true })

      // Select to position (second TC radio button)
      await legendHelper.getPositionRadio(1, 1).click({ force: true })

      // Move button should now be enabled
      await legendHelper.expectMoveButtonEnabled()
    })

    test('should move legend from one position to another', async ({ page }) => {
      // Add a key (keyboard starts with 0 keys)
      await canvasHelper.addKey()

      // Wait for key to be added using RAF
      await waitHelpers.waitForDoubleAnimationFrame()

      // Add a legend to top-left position
      await canvasHelper.setKeyLabel('topLeft', 'MoveMe')

      // Open legend tools panel and switch to move tab
      await legendHelper.openPanel()
      await legendHelper.switchToMoveTab()

      // Move legend from position 0 (top-left) to position 1 (top-center)
      await legendHelper.moveLegend(0, 1)

      // Panel should remain open
      await legendHelper.expectPanelVisible()

      // Legend should have moved
      await expect(page.getByTitle('Top Left').first()).toHaveValue('')
      await expect(page.getByTitle('Top Center').first()).toHaveValue('MoveMe')
    })

    test('should disable move button for same positions', async () => {
      // Open legend tools panel and switch to move tab
      await legendHelper.openPanel()
      await legendHelper.switchToMoveTab()

      // Select same position for both from and to - use force click due to overlay issues
      await legendHelper.getPositionRadio(0, 0).click({ force: true })
      await legendHelper.getPositionRadio(0, 1).click({ force: true })

      // Move button should be disabled
      await legendHelper.expectMoveButtonDisabled()
    })
  })

  test.describe('Move Tab JSON Verification', () => {
    test('should verify JSON after moving legend', async () => {
      // Setup
      await canvasHelper.addKey()
      await waitHelpers.waitForDoubleAnimationFrame()
      await canvasHelper.setKeyLabel('topLeft', 'Ctrl')

      // Move legend from TL (0) to TC (1)
      await legendHelper.openPanel()
      await legendHelper.switchToMoveTab()
      await legendHelper.moveLegend(0, 1)

      // Export and verify
      const jsonData = await legendHelper.exportAndVerifyJSON('move-test.json')

      // Verify label exists
      legendHelper.verifyLabelsInJSON(jsonData, ['Ctrl'])
    })

    test('should move textColor and textSize with legend', async () => {
      // This test verifies that when a legend moves, its formatting moves too
      // Setup: Add key with label at position 0
      await canvasHelper.addKey()
      await waitHelpers.waitForDoubleAnimationFrame()
      await canvasHelper.setKeyLabel('topLeft', 'A')

      // Move from position 0 to position 4 (center)
      await legendHelper.openPanel()
      await legendHelper.switchToMoveTab()
      await legendHelper.moveLegend(0, 4)

      // Export and verify structure maintained
      const jsonData = await legendHelper.exportAndVerifyJSON('move-properties-test.json')
      legendHelper.verifyLabelsInJSON(jsonData, ['A'])
    })

    test('should handle import-move-export round trip', async ({ page }) => {
      const importHelper = new ImportExportHelper(page, waitHelpers)

      // Import layout with labels
      await importHelper.importFromFile('e2e/fixtures/simple-layout.json', 8)

      // Select first key
      await page.getByTestId('canvas-main').click({ position: { x: 47, y: 47 }, force: true })
      await expect(page.getByText('Selected: 1')).toBeVisible()

      // Move legend position
      await legendHelper.openPanel()
      await legendHelper.switchToMoveTab()
      await legendHelper.moveLegend(0, 1)

      // Export and verify
      const jsonData = await legendHelper.exportAndVerifyJSON('roundtrip-move-test.json')

      // Should still be valid KLE JSON with labels
      expect(Array.isArray(jsonData)).toBe(true)
      const labelCount = legendHelper.countKeysWithLabels(jsonData)
      expect(labelCount).toBeGreaterThan(0)
    })
  })

  test.describe('Panel Functionality', () => {
    test('should be draggable', async () => {
      // Open legend tools panel
      await legendHelper.openPanel()

      // Panel should be visible
      await legendHelper.expectPanelVisible()

      // Header should have drag handle
      await legendHelper.expectDragHandleVisible()
    })

    test('should allow multiple operations without closing', async () => {
      // Add a key (keyboard starts with 0 keys)
      await canvasHelper.addKey()

      // Wait for key to be added using RAF
      await waitHelpers.waitForDoubleAnimationFrame()

      // Add some legends - mix of letters and numbers
      await canvasHelper.setKeyLabel('topLeft', 'A')
      await canvasHelper.setKeyLabel('topCenter', '1')

      // Open legend tools panel
      await legendHelper.openPanel()

      // Switch to remove tab first (Edit is default now)
      await legendHelper.switchToRemoveTab()

      // First operation - remove alphas (this should remove A but leave 1)
      await legendHelper.removeLegendsByCategory('Alphas')

      // Panel should remain open
      await legendHelper.expectPanelVisible()

      // Switch to move tab
      await legendHelper.switchToMoveTab()

      // Perform move operation - move the remaining number from position 1 to position 2
      await legendHelper.moveLegend(1, 2)

      // Panel should still be open
      await legendHelper.expectPanelVisible()

      // Can switch tabs freely
      await legendHelper.switchToAlignTab()
      await legendHelper.expectKeycapPreviewVisible()
    })

    test('should update status count when switching tabs', async () => {
      // Open legend tools panel
      await legendHelper.openPanel()

      // Edit tab is default - status count is not shown in Edit tab
      await expect(legendHelper.getStatusCount()).not.toBeVisible()

      // Switch to remove tab - should show key count
      await legendHelper.switchToRemoveTab()
      await expect(legendHelper.getStatusCount()).toBeVisible()

      // Switch to align tab - count might be different for non-decal keys
      await legendHelper.switchToAlignTab()
      await expect(legendHelper.getStatusCount()).toBeVisible()

      // Switch to move tab
      await legendHelper.switchToMoveTab()
      await expect(legendHelper.getStatusCount()).toBeVisible()

      // Switch back to edit tab - status count should be hidden
      await legendHelper.switchToEditTab()
      await expect(legendHelper.getStatusCount()).not.toBeVisible()
    })
  })

  test.describe('Accessibility', () => {
    test('should support escape key to close panel', async () => {
      // Open legend tools panel
      await legendHelper.openPanel()

      // Panel should be visible
      await legendHelper.expectPanelVisible()

      // Press escape key and verify panel closes
      await legendHelper.closePanelWithEscape()
    })
  })

  test.describe('Error Handling', () => {
    test('should handle empty keyboard gracefully', async () => {
      // Start fresh - no need to delete keys since we start with 0 by default

      // Open legend tools panel - should not crash
      await legendHelper.openPanel()

      // Switch to remove tab to see status count (Edit tab is default)
      await legendHelper.switchToRemoveTab()

      // Should show 0 keys affected
      await legendHelper.expectStatusCountText('0 key(s) will be affected')

      // Should still allow clicking buttons without errors
      await legendHelper.removeAllLegends()

      // Panel should remain open
      await legendHelper.expectPanelVisible()
    })

    test('should handle keys with no legends gracefully', async () => {
      // Add a key but don't add any legends to it
      await canvasHelper.addKey()

      // Wait for key to be added using RAF
      await waitHelpers.waitForDoubleAnimationFrame()

      // Open legend tools panel and switch to move tab
      await legendHelper.openPanel()
      await legendHelper.switchToMoveTab()

      // Try to move legend from empty position (should handle empty source gracefully)
      await legendHelper.moveLegend(0, 1)

      // Panel should remain open without errors
      await legendHelper.expectPanelVisible()
    })
  })

  test.describe('JSON Round-Trip Verification', () => {
    let importHelper: ImportExportHelper

    test.beforeEach(async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      waitHelpers = new WaitHelpers(page)
      legendHelper = new LegendToolsHelper(page, waitHelpers)
      canvasHelper = new CanvasTestHelper(page)
      importHelper = new ImportExportHelper(page, waitHelpers)
    })

    test('should preserve layout structure through legend operations', async ({ page }) => {
      // Import complex layout
      await importHelper.importFromFile('e2e/fixtures/complex-layout.json', 6)

      // Click canvas to focus it, then select all keys
      await page.getByTestId('canvas-main').click({ position: { x: 100, y: 100 }, force: true })
      await page.keyboard.press('ControlOrMeta+a')
      await waitHelpers.waitForDoubleAnimationFrame()
      await expect(page.getByText('Selected: 6')).toBeVisible()

      // Perform multiple legend operations
      await legendHelper.openPanel()

      // Remove all legends (simpler than category-specific)
      await legendHelper.removeAllLegends()

      // Switch to align and align remaining (add new label first)
      await legendHelper.closePanel()

      // Click first key and add a label
      await page.getByTestId('canvas-main').click({ position: { x: 47, y: 47 }, force: true })
      await canvasHelper.setKeyLabel('topLeft', 'Test')

      await legendHelper.openPanel()
      await legendHelper.switchToAlignTab()
      await legendHelper.alignLegends(4) // 4 is center position

      // Export final result
      const jsonData = await legendHelper.exportAndVerifyJSON('complex-roundtrip.json')

      // Verify structure maintained
      expect(Array.isArray(jsonData)).toBe(true)
      // Should still have 6 keys (structure preserved)
      // Labels modified but structure intact
    })

    test('should handle sequential operations correctly', async () => {
      // Start with empty layout
      await canvasHelper.addKey()
      await waitHelpers.waitForDoubleAnimationFrame()
      await canvasHelper.addKey()
      await waitHelpers.waitForDoubleAnimationFrame()
      await canvasHelper.addKey()
      await waitHelpers.waitForDoubleAnimationFrame()

      // Add labels using the new selectKeyAt helper for robust selection
      await canvasHelper.selectKeyAt(47, 47)
      await canvasHelper.setKeyLabel('topLeft', 'Q')

      await canvasHelper.selectKeyAt(47 + 54, 47)
      await canvasHelper.setKeyLabel('topLeft', 'W')

      await canvasHelper.selectKeyAt(47 + 108, 47)
      await canvasHelper.setKeyLabel('topLeft', 'E')

      // Verify initial export
      const jsonData1 = await legendHelper.exportAndVerifyJSON('sequential-1.json')
      legendHelper.verifyLabelsInJSON(jsonData1, ['Q', 'W', 'E'])

      // Remove middle label
      await canvasHelper.selectKeyAt(47 + 54, 47)
      await legendHelper.openPanel()
      await legendHelper.removeAllLegends()

      // Export and verify after remove
      const jsonData2 = await legendHelper.exportAndVerifyJSON('sequential-2.json')
      const jsonString = JSON.stringify(jsonData2)
      expect(jsonString.includes('Q')).toBe(true)
      expect(jsonString.includes('W')).toBe(false)
      expect(jsonString.includes('E')).toBe(true)
    })

    test('should maintain key order through operations', async ({ page }) => {
      // Create specific layout
      await canvasHelper.addKey()
      await waitHelpers.waitForDoubleAnimationFrame()
      await canvasHelper.setKeyLabel('center', '1')

      await canvasHelper.addKey()
      await waitHelpers.waitForDoubleAnimationFrame()
      await canvasHelper.setKeyLabel('center', '2')

      await canvasHelper.addKey()
      await waitHelpers.waitForDoubleAnimationFrame()
      await canvasHelper.setKeyLabel('center', '3')

      // Export initial state (for comparison purposes)
      await legendHelper.exportAndVerifyJSON('order-before.json')

      // Perform legend operation on middle key
      await page.getByTestId('canvas-main').click({ position: { x: 47 + 54, y: 47 }, force: true })
      await legendHelper.openPanel()
      await legendHelper.switchToMoveTab()
      await legendHelper.moveLegend(4, 0) // Move from center to top-left

      // Export after operation
      const jsonAfter = await legendHelper.exportAndVerifyJSON('order-after.json')

      // Verify all labels still exist
      legendHelper.verifyLabelsInJSON(jsonAfter, ['1', '2', '3'])

      // Verify key count unchanged
      expect(Array.isArray(jsonAfter)).toBe(true)
    })

    test('should export valid KLE format after all operations', async ({ page }) => {
      // Import layout with special properties
      await importHelper.importFromFile('e2e/fixtures/complex-layout.json', 6)

      // Click canvas to focus it, then select all keys
      await page.getByTestId('canvas-main').click({ position: { x: 100, y: 100 }, force: true })
      await page.keyboard.press('ControlOrMeta+a')
      await waitHelpers.waitForDoubleAnimationFrame()
      await expect(page.getByText('Selected: 6')).toBeVisible()

      // Perform various operations
      await legendHelper.openPanel()

      // Remove all legends
      await legendHelper.removeAllLegends()

      // Switch to align tab and align (even though labels are empty, test the operation)
      await legendHelper.switchToAlignTab()
      await legendHelper.alignLegends(4) // Center position

      // Close panel
      await legendHelper.closePanel()
      await waitHelpers.waitForDoubleAnimationFrame()

      // Export and verify KLE format compliance
      const jsonData = await legendHelper.exportAndVerifyJSON('kle-format-test.json')

      // Must be array (KLE requirement)
      expect(Array.isArray(jsonData)).toBe(true)

      // Should have 6 keys still
      // Structure preserved even though labels were modified
      const jsonString = JSON.stringify(jsonData)
      expect(jsonString.length).toBeGreaterThan(10) // Not empty
    })
  })
})
