import { test, expect } from '@playwright/test'
import { KeyboardEditorPage } from './pages/KeyboardEditorPage'
import { CanvasTestHelper } from './helpers/canvas-test-helpers'
import { PlateGeneratorHelper } from './helpers/plate-generator-helpers'
import { SELECTORS } from './constants/selectors'

const PG = SELECTORS.PLATE_GENERATOR

test.describe('Plate Generator', () => {
  test('shows idle state when section is expanded', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)
    await editor.goto()

    const helper = new PlateGeneratorHelper(page)
    await helper.expandSection()

    // Idle message should be shown before any generation
    await expect(page.locator(PG.IDLE_MESSAGE)).toBeVisible()
    // Generate button should be present (disabled because layout is empty)
    await expect(page.locator(PG.GENERATE_BTN)).toBeVisible()
  })

  test('generates plate from simple layout and shows SVG preview', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)
    await editor.goto()

    // Load a minimal 3-key layout
    const canvas = new CanvasTestHelper(page)
    await canvas.loadJsonLayout(JSON.stringify([['A', 'B', 'C']]))

    const helper = new PlateGeneratorHelper(page)
    await helper.expandSection()
    await helper.generateAndWait()

    // SVG preview must be present
    await expect(page.locator(PG.SVG_PREVIEW)).toBeVisible()

    // Download buttons must appear after successful generation
    await expect(page.locator(PG.DOWNLOAD_SVG)).toBeVisible()
    await expect(page.locator(PG.DOWNLOAD_DXF)).toBeVisible()
  })

  test('generates 3D preview when outline is enabled', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)
    await editor.goto()

    const canvas = new CanvasTestHelper(page)
    await canvas.loadJsonLayout(JSON.stringify([['A', 'B', 'C']]))

    const helper = new PlateGeneratorHelper(page)
    await helper.expandSection()
    await helper.enableOutline('rectangular')
    await helper.generateAndWait()

    // Switch to 3D tab in the results panel
    await page.locator(PG.RESULTS_TAB_3D).click()

    // Three.js canvas must be visible (shown once STL data is ready and threeReady=true)
    await expect(page.locator(PG.THREE_CANVAS)).toBeVisible({ timeout: 15000 })
  })

  test('loads the defaults from the JSON tab, and Apply resets the settings', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)
    await editor.goto()

    const helper = new PlateGeneratorHelper(page)
    await helper.expandSection()
    await helper.enableOutline('tight')

    await page.locator(PG.TAB_JSON).click()
    const status = page.locator(PG.JSON_STATUS)
    await page.locator(PG.JSON_DEFAULTS_BTN).click()
    await expect(status).toHaveText('Defaults loaded — press Apply to use them')

    // Nothing changes until Apply
    await page.locator(PG.TAB_OUTLINE).click()
    await expect(page.locator(PG.OUTLINE_TYPE_SELECT)).toHaveValue('tight')
    await page.locator(PG.TAB_JSON).click()
    await expect(status).toHaveText('Defaults loaded — press Apply to use them')

    await page.locator(PG.JSON_APPLY_BTN).click()
    await expect(status).toHaveText('In sync')
    await page.locator(PG.JSON_DEFAULTS_BTN).click()
    await expect(status).toHaveText('In sync — settings already use the defaults')

    // Wait for the debounced save, then check the defaults survive a reload
    await expect
      .poll(() =>
        page.evaluate(() => JSON.parse(localStorage.getItem('kle-ng-plate-settings') ?? '{}')),
      )
      .toMatchObject({ outline: { outlineType: 'none' } })
    await page.reload()
    await helper.expandSection()
    await page.locator(PG.TAB_OUTLINE).click()
    await expect(page.locator(PG.OUTLINE_TYPE_SELECT)).toHaveValue('none')
  })
})
