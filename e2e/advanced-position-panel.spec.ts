import { test } from '@playwright/test'
import { AdvancedPositionPanelHelper } from './helpers/advanced-position-panel-helpers'
import { WaitHelpers } from './helpers/wait-helpers'

test.describe('Advanced Position & Rotation Panel', () => {
  let helper: AdvancedPositionPanelHelper
  let waitHelpers: WaitHelpers

  test.beforeEach(async ({ page }) => {
    waitHelpers = new WaitHelpers(page)
    helper = new AdvancedPositionPanelHelper(page, waitHelpers)

    await page.goto('/')

    // Add a key to work with
    await helper.addStandardKey()
  })

  test('should toggle between basic and advanced modes', async () => {
    // Should start in basic mode
    await helper.expectBasicMode()

    // Toggle to advanced mode
    await helper.toggleMode()
    await helper.expectAdvancedMode()

    // Toggle back to basic mode
    await helper.toggleMode()
    await helper.expectBasicMode()
  })

  test('should show additional controls in advanced mode', async () => {
    // In basic mode, secondary controls should not be visible
    await helper.expectSecondaryControlsHidden()

    // Switch to advanced mode
    await helper.switchToAdvancedMode()

    // Secondary controls should now be visible
    await helper.expectSecondaryControlsVisible()
  })

  test('should persist mode preference on page reload', async ({ page }) => {
    // Switch to advanced mode
    await helper.switchToAdvancedMode()
    await helper.expectAdvancedMode()

    // Reload the page
    await page.reload()

    // Add a key again (since reload clears the layout)
    await helper.addStandardKey()

    // Should still be in advanced mode
    await helper.expectAdvancedMode()
  })

  test('should allow editing secondary properties in advanced mode', async () => {
    // Switch to advanced mode
    await helper.switchToAdvancedMode()

    // Fill in secondary property values
    await helper.setSecondaryProperties({
      x: '0.5',
      y: '0.25',
      width: '1.5',
      height: '0.75',
    })

    // Verify the values are set
    await helper.expectSecondaryProperties({
      x: '0.5',
      y: '0.25',
      width: '1.5',
      height: '0.75',
    })
  })

  test('should maintain consistent panel height between modes', async () => {
    // Get initial height in basic mode
    const basicHeight = await helper.getPanelHeight()

    // Switch to advanced mode
    await helper.switchToAdvancedMode()

    // Verify panel height is similar (allowing for small differences due to content)
    await helper.expectPanelHeightSimilar(basicHeight, 50)
  })

  test('should work with special keys like ISO Enter', async ({ page }) => {
    // Clear existing layout first
    await page.goto('/')

    // Add ISO Enter using the special keys dropdown
    await helper.addSpecialKey('ISO Enter')

    // Now switch to advanced mode
    await helper.switchToAdvancedMode()

    // Verify we're in advanced mode
    await helper.expectAdvancedMode()

    // Verify the key properties panel is visible
    await helper.expectKeyPropertiesPanelVisible()

    // Set primary dimensions
    await helper.setPrimaryWidth('1.25')
    await helper.setPrimaryHeight('2')

    // Set secondary dimensions
    await helper.setSecondaryProperties({
      width: '1.5',
      height: '1',
      x: '0.25',
      y: '0',
    })

    // Secondary controls should be available and visible
    await helper.expectSecondaryControlsVisible()

    // ISO Enter should have non-zero secondary dimensions
    await helper.expectSecondaryDimensionsGreaterThanZero()
  })
})
