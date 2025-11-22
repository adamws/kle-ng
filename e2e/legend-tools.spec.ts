import { test, expect } from '@playwright/test'
import { WaitHelpers } from './helpers/wait-helpers'
import { LegendToolsHelper } from './helpers/legend-tools-helpers'
import { CanvasTestHelper } from './helpers/canvas-test-helpers'

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
      await page.locator('.keyboard-canvas').click({ position: { x: 47, y: 47 }, force: true })
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
      await expect(legendHelper.getRemoveTabLabel()).toBeVisible()
      await expect(legendHelper.getAlignTabLabel()).toBeVisible()
      await expect(legendHelper.getMoveTabLabel()).toBeVisible()

      // Remove tab should be active by default
      await legendHelper.expectRemoveTabActive()
    })

    test('should display all legend categories in remove tab', async () => {
      // Open legend tools panel
      await legendHelper.openPanel()

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

      // Should show key count in remove tab
      await expect(legendHelper.getStatusCount()).toBeVisible()

      // Switch to align tab - count might be different for non-decal keys
      await legendHelper.switchToAlignTab()
      await expect(legendHelper.getStatusCount()).toBeVisible()

      // Switch to move tab
      await legendHelper.switchToMoveTab()
      await expect(legendHelper.getStatusCount()).toBeVisible()
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
})
