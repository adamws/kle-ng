import { test } from '@playwright/test'
import { KeyboardEditorPage } from './pages/KeyboardEditorPage'
import { KeySelectionPopupComponent } from './pages/components/KeySelectionPopupComponent'
import { CanvasTestHelper } from './helpers/canvas-test-helpers'
import { WaitHelpers } from './helpers/wait-helpers'
import { CANVAS_CONSTANTS } from './constants/canvas-dimensions'

test.describe('Overlapping Key Selection', () => {
  let editor: KeyboardEditorPage
  let popup: KeySelectionPopupComponent
  let helper: CanvasTestHelper
  let waitHelpers: WaitHelpers

  test.beforeEach(async ({ page }) => {
    editor = new KeyboardEditorPage(page)
    popup = new KeySelectionPopupComponent(page)
    helper = new CanvasTestHelper(page)
    waitHelpers = new WaitHelpers(page)

    await page.goto('/')
    await editor.clearLayout()
  })

  test.describe('MVP Tests - Basic Popup Behavior', () => {
    test('1.1 - should show popup when clicking on overlapping keys', async () => {
      // Create two keys at same position (0, 0)
      await helper.createOverlappingKeys(0, 0)

      // Verify both keys exist
      await editor.expectKeyCount(2)

      // Click empty area to deselect
      await editor.canvas.deselectAll()
      await waitHelpers.waitForDoubleAnimationFrame()
      await editor.expectSelectedCount(0)

      // Click at overlapping position (center of 1u key at 0,0)
      const position = CANVAS_CONSTANTS.getPositionFromUnits(0.5, 0.5)
      await editor.canvas.clickAt(position.x, position.y)
      await waitHelpers.waitForDoubleAnimationFrame()

      // Verify popup appears with 2 items
      await popup.expectVisible()
      await popup.expectItemCount(2)

      // Verify item labels (topmost first: "Key 2", then "Key 1")
      await popup.expectItemLabel(0, 'Key 2')
      await popup.expectItemLabel(1, 'Key 1')
    })

    test('1.2 - should select key from popup', async () => {
      // Create overlapping keys
      await helper.createOverlappingKeys(0, 0)

      // Deselect all
      await editor.canvas.deselectAll()
      await waitHelpers.waitForDoubleAnimationFrame()

      // Click to show popup
      const position = CANVAS_CONSTANTS.getPositionFromUnits(0.5, 0.5)
      await editor.canvas.clickAt(position.x, position.y)
      await waitHelpers.waitForDoubleAnimationFrame()

      await popup.expectVisible()

      // Click second item in popup (Key 1)
      await popup.selectKeyByIndex(1)
      await waitHelpers.waitForDoubleAnimationFrame()

      // Verify popup closes
      await popup.expectHidden()

      // Verify correct key is selected
      await editor.expectSelectedCount(1)
    })

    test('1.3 - should close popup with Escape key', async () => {
      // Create overlapping keys
      await helper.createOverlappingKeys(0, 0)

      // Deselect all
      await editor.canvas.deselectAll()
      await waitHelpers.waitForDoubleAnimationFrame()

      // Click to show popup
      const position = CANVAS_CONSTANTS.getPositionFromUnits(0.5, 0.5)
      await editor.canvas.clickAt(position.x, position.y)
      await waitHelpers.waitForDoubleAnimationFrame()

      await popup.expectVisible()

      // Press Escape
      await popup.closeWithEscape()
      await waitHelpers.waitForDoubleAnimationFrame()

      // Verify popup closes
      await popup.expectHidden()

      // Verify no key selected
      await editor.expectSelectedCount(0)
    })

    test('1.4 - should close popup by clicking outside', async () => {
      // Create overlapping keys
      await helper.createOverlappingKeys(0, 0)

      // Deselect all
      await editor.canvas.deselectAll()
      await waitHelpers.waitForDoubleAnimationFrame()

      // Click to show popup
      const position = CANVAS_CONSTANTS.getPositionFromUnits(0.5, 0.5)
      await editor.canvas.clickAt(position.x, position.y)
      await waitHelpers.waitForDoubleAnimationFrame()

      await popup.expectVisible()

      // Click on overlay (not popup itself)
      await popup.close()
      await waitHelpers.waitForDoubleAnimationFrame()

      // Verify popup closes
      await popup.expectHidden()
    })
  })

  test.describe('MVP Tests - Edge Cases', () => {
    test('5.1 - should NOT show popup for single key (direct selection)', async () => {
      // Add single key
      await helper.addKey()
      await helper.setKeyLabel('center', 'Single Key')

      // Deselect
      await editor.canvas.deselectAll()
      await waitHelpers.waitForDoubleAnimationFrame()
      await editor.expectSelectedCount(0)

      // Click on key
      const position = CANVAS_CONSTANTS.getPositionFromUnits(0.5, 0.5)
      await editor.canvas.clickAt(position.x, position.y)
      await waitHelpers.waitForDoubleAnimationFrame()

      // Verify key selected immediately (no popup)
      await popup.expectHidden()
      await editor.expectSelectedCount(1)
    })

    test('5.2 - should NOT show popup when clicking empty space', async () => {
      // Add two keys at different positions to make the canvas larger
      await helper.addKey()
      await helper.setKeyLabel('center', 'Key at Origin')
      await helper.setKeyPosition(0, 0)

      await helper.addKey()
      await helper.setKeyLabel('center', 'Key at 3,0')
      await helper.setKeyPosition(3, 0)

      await editor.expectKeyCount(2)
      await editor.expectSelectedCount(1)

      // Click empty canvas area between keys (at 1.5u, 0.5u - no key there)
      const position = CANVAS_CONSTANTS.getPositionFromUnits(1.5, 0.5)
      await editor.canvas.clickAt(position.x, position.y, { force: true })
      await waitHelpers.waitForDoubleAnimationFrame()

      // Verify deselection occurs (no popup)
      await popup.expectHidden()
      await editor.expectSelectedCount(0)
    })

    test('5.3 - should show popup with 3+ overlapping keys', async () => {
      // Create stack of 3 keys at same position
      await helper.createKeyStack(3, 0, 0)

      // Verify all keys exist
      await editor.expectKeyCount(3)

      // Deselect all
      await editor.canvas.deselectAll()
      await waitHelpers.waitForDoubleAnimationFrame()

      // Click on overlapping position
      const position = CANVAS_CONSTANTS.getPositionFromUnits(0.5, 0.5)
      await editor.canvas.clickAt(position.x, position.y)
      await waitHelpers.waitForDoubleAnimationFrame()

      // Verify popup appears with 3 items
      await popup.expectVisible()
      await popup.expectItemCount(3)

      // Verify correct z-order (topmost first)
      await popup.expectItemLabel(0, 'Key 3')
      await popup.expectItemLabel(1, 'Key 2')
      await popup.expectItemLabel(2, 'Key 1')
    })
  })

  test.describe('Keyboard Navigation', () => {
    test('4.1 - should navigate with arrow keys', async () => {
      // Create 3 overlapping keys
      await helper.createKeyStack(3, 0, 0)

      // Deselect all
      await editor.canvas.deselectAll()
      await waitHelpers.waitForDoubleAnimationFrame()

      // Click to show popup (first item focused by default)
      const position = CANVAS_CONSTANTS.getPositionFromUnits(0.5, 0.5)
      await editor.canvas.clickAt(position.x, position.y)
      await waitHelpers.waitForDoubleAnimationFrame()

      await popup.expectVisible()

      // First item should be focused by default
      await popup.expectItemFocused(0)

      // Press ArrowDown - second item focused
      await popup.navigateDown()
      await popup.expectItemFocused(1)

      // Press ArrowDown again - third item focused
      await popup.navigateDown()
      await popup.expectItemFocused(2)

      // Press ArrowUp - back to second item
      await popup.navigateUp()
      await popup.expectItemFocused(1)
    })

    test('4.2 - should select with Enter key', async () => {
      // Create overlapping keys
      await helper.createOverlappingKeys(0, 0)

      // Deselect all
      await editor.canvas.deselectAll()
      await waitHelpers.waitForDoubleAnimationFrame()

      // Click to show popup
      const position = CANVAS_CONSTANTS.getPositionFromUnits(0.5, 0.5)
      await editor.canvas.clickAt(position.x, position.y)
      await waitHelpers.waitForDoubleAnimationFrame()

      await popup.expectVisible()

      // Press ArrowDown to focus second item
      await popup.navigateDown()
      await popup.expectItemFocused(1)

      // Press Enter to select
      await popup.selectWithEnter()
      await waitHelpers.waitForDoubleAnimationFrame()

      // Verify popup closes
      await popup.expectHidden()

      // Verify key is selected
      await editor.expectSelectedCount(1)
    })
  })

  test.describe('Key Information Display', () => {
    test('2.1 - should list keys in correct z-order (topmost first)', async () => {
      // Create stack of 3 keys with specific order
      await helper.createKeyStack(3, 0, 0)

      await editor.canvas.deselectAll()
      await waitHelpers.waitForDoubleAnimationFrame()

      const position = CANVAS_CONSTANTS.getPositionFromUnits(0.5, 0.5)
      await editor.canvas.clickAt(position.x, position.y)
      await waitHelpers.waitForDoubleAnimationFrame()

      await popup.expectVisible()

      // Verify order: Key 3 (top), Key 2 (middle), Key 1 (bottom)
      await popup.expectItemLabel(0, 'Key 3')
      await popup.expectItemLabel(1, 'Key 2')
      await popup.expectItemLabel(2, 'Key 1')
    })

    test('2.4 - should display [no label] for unlabeled keys', async () => {
      // Add two keys without setting labels
      await helper.addKey()
      // Clear label by setting empty string
      await helper.setKeyLabel('center', '')
      await helper.setKeyPosition(0, 0)

      // Add second unlabeled key
      await helper.addKey()
      await helper.setKeyLabel('center', '')
      await helper.setKeyPosition(0, 0)

      // Deselect and click
      await editor.canvas.deselectAll()
      await waitHelpers.waitForDoubleAnimationFrame()

      const position = CANVAS_CONSTANTS.getPositionFromUnits(0.5, 0.5)
      await editor.canvas.clickAt(position.x, position.y)
      await waitHelpers.waitForDoubleAnimationFrame()

      await popup.expectVisible()

      // Both should show "[no label]"
      await popup.expectItemLabel(0, '[no label]')
      await popup.expectItemLabel(1, '[no label]')
    })
  })

  test.describe('Ctrl+Click Extended Selection', () => {
    test('5.4 - should extend selection when Ctrl+clicking overlapping keys', async () => {
      // Add a key at (0, 0) and keep it selected
      await helper.addKey()
      await helper.setKeyLabel('center', 'First Key')
      await helper.setKeyPosition(0, 0)
      await editor.expectSelectedCount(1)

      // Add two overlapping keys at (2, 0)
      await helper.addKey()
      await helper.setKeyLabel('center', 'Overlap 1')
      await helper.setKeyPosition(2, 0)

      await helper.addKey()
      await helper.setKeyLabel('center', 'Overlap 2')
      await helper.setKeyPosition(2, 0)

      // Now select just the first key at (0, 0)
      await editor.canvas.deselectAll()
      await waitHelpers.waitForDoubleAnimationFrame()

      const firstKeyPos = CANVAS_CONSTANTS.getPositionFromUnits(0.5, 0.5)
      await editor.canvas.clickAt(firstKeyPos.x, firstKeyPos.y)
      await waitHelpers.waitForDoubleAnimationFrame()
      await editor.expectSelectedCount(1)

      // Ctrl+click on overlapping keys at (2, 0)
      const overlapPos = CANVAS_CONSTANTS.getPositionFromUnits(2.5, 0.5)
      await editor.canvas.clickAt(overlapPos.x, overlapPos.y, { modifiers: ['Control'] })
      await waitHelpers.waitForDoubleAnimationFrame()

      // Popup should appear for the overlapping keys
      await popup.expectVisible()

      // Select one from popup
      await popup.selectKeyByIndex(0)
      await waitHelpers.waitForDoubleAnimationFrame()

      // Should now have 2 keys selected (original + popup choice)
      await editor.expectSelectedCount(2)
    })
  })
})
