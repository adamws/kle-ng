import { test, expect } from '@playwright/test'
import { promises as fs } from 'fs'
import { KeyboardEditorPage } from './pages/KeyboardEditorPage'
import { LayoutOptionToolbarComponent } from './pages/components/LayoutOptionToolbarComponent'
import { PresetComponent } from './pages/components/PresetComponent'
import { ExtraToolsComponent } from './pages/components/ExtraToolsComponent'
import { ZoomComponent } from './pages/components/ZoomComponent'
import { WaitHelpers } from './helpers/wait-helpers'
import { ImportExportHelper } from './helpers/import-export-helpers'
import { SELECTORS } from './constants'

const MULTILAYOUT_PRESET = 'Multilayout 60% (VIA)'
const MULTILAYOUT_KEY_COUNT = 83

test.describe('Alternative Layouts Preview', () => {
  let waitHelpers: WaitHelpers
  let editor: KeyboardEditorPage
  let layoutOptions: LayoutOptionToolbarComponent
  let presets: PresetComponent
  let extraTools: ExtraToolsComponent

  test.beforeEach(async ({ page }) => {
    waitHelpers = new WaitHelpers(page)
    editor = new KeyboardEditorPage(page)
    layoutOptions = editor.layoutOptions
    presets = new PresetComponent(page, waitHelpers)
    extraTools = new ExtraToolsComponent(page, waitHelpers)
    await page.goto('/')
    await waitHelpers.waitForDoubleAnimationFrame()
  })

  /**
   * Load the canonical multi-layout VIA preset and wait for all 83 keys.
   */
  async function loadMultilayoutPreset() {
    await presets.selectPreset(MULTILAYOUT_PRESET)
    await expect
      .poll(async () => editor.getKeyCount(), { timeout: 10000 })
      .toBe(MULTILAYOUT_KEY_COUNT)
    await waitHelpers.waitForDoubleAnimationFrame()
  }

  // =========================================================================
  // A — Visibility gating
  // =========================================================================

  test.describe('Visibility gating', () => {
    test('should hide toolbar on a fresh empty layout', async () => {
      await layoutOptions.expectHidden()
    })

    test('should hide toolbar for a non-VIA preset (ANSI 104)', async () => {
      await presets.selectPreset('ANSI 104')
      await editor.expectKeyCount(104)
      await layoutOptions.expectHidden()
    })

    test('should hide toolbar for VIA layout without alt-layout keys', async ({ page }) => {
      const importHelper = new ImportExportHelper(page, waitHelpers)
      // via-matrix-only.json has matrix-coord labels (VIA-annotated) but no labels[8] alt-layout groups
      await importHelper.importFromFile('e2e/fixtures/via-matrix-only.json')
      await waitHelpers.waitForDoubleAnimationFrame()
      await layoutOptions.expectHidden()
    })

    test('should show toolbar with All and multiple option groups for Multilayout preset', async () => {
      await loadMultilayoutPreset()
      await layoutOptions.expectVisible()
      await expect(layoutOptions.getAllButton()).toBeVisible()
      // Multilayout 60% VIA has option groups 0-3 (split backspace, enter, left shift, etc.)
      const groupCount = await layoutOptions.getOptionGroupCount()
      expect(groupCount).toBeGreaterThanOrEqual(4)
      // Each group has at least 2 choices (0 and 1)
      const choicesInGroup0 = await layoutOptions.getChoiceCount(0)
      expect(choicesInGroup0).toBeGreaterThanOrEqual(2)
    })
  })

  // =========================================================================
  // B — Initial state
  // =========================================================================

  test.describe('Initial state', () => {
    test('should default to All-active with no preview hint', async () => {
      await loadMultilayoutPreset()
      await layoutOptions.expectAllActive()
      await layoutOptions.expectPreviewHintHidden()
      await layoutOptions.expectChoiceInactive(0, 1)
    })
  })

  // =========================================================================
  // C — State transitions
  // =========================================================================

  test.describe('State transitions', () => {
    test.beforeEach(async () => {
      await loadMultilayoutPreset()
    })

    test('should activate a choice button and show preview hint', async () => {
      await layoutOptions.clickChoice(0, 1)
      await layoutOptions.expectChoiceActive(0, 1)
      await expect(layoutOptions.getAllButton()).not.toHaveClass(/active/)
      await layoutOptions.expectPreviewHintVisible()
      await expect(layoutOptions.getPreviewHint()).toContainText('preview mode')
      await expect(layoutOptions.getPreviewHint()).toContainText('readonly')
    })

    test('should restore All-active state when clicking All', async () => {
      await layoutOptions.clickChoice(0, 1)
      await layoutOptions.clickAll()
      await layoutOptions.expectAllActive()
      await layoutOptions.expectChoiceInactive(0, 1)
      await layoutOptions.expectPreviewHintHidden()
    })

    test('should switch within a group exclusively — choice 0 stays in preview', async () => {
      await layoutOptions.clickChoice(0, 1)
      // Switching to choice 0 within the same group — still in preview (Map is non-null)
      await layoutOptions.clickChoice(0, 0)
      await layoutOptions.expectChoiceActive(0, 0)
      await layoutOptions.expectChoiceInactive(0, 1)
      // All is NOT active — we are still in preview mode even when choice 0 is selected
      await expect(layoutOptions.getAllButton()).not.toHaveClass(/active/)
      // Preview hint still visible since displayLayoutChoices is a non-null Map
      await layoutOptions.expectPreviewHintVisible()
    })

    test('should compose choices across multiple groups independently', async () => {
      // Activate choice 1 in group 0
      await layoutOptions.clickChoice(0, 1)
      await layoutOptions.expectChoiceActive(0, 1)
      // Now activate choice 1 in group 1 — both should remain active
      await layoutOptions.clickChoice(1, 1)
      await layoutOptions.expectChoiceActive(0, 1)
      await layoutOptions.expectChoiceActive(1, 1)
      // All is not active — in preview with multi-group map
      await expect(layoutOptions.getAllButton()).not.toHaveClass(/active/)
    })
  })

  // =========================================================================
  // D — Read-only enforcement
  // =========================================================================

  test.describe('Read-only enforcement', () => {
    test.beforeEach(async () => {
      await loadMultilayoutPreset()
      await layoutOptions.clickChoice(0, 1)
    })

    test('should disable Key Properties panel in preview mode', async ({ page }) => {
      // Entering preview clears selection, making isDisabled=true for both reasons.
      // Playwright's toBeDisabled() does not recognise <fieldset disabled>, so check the attribute.
      const fieldset = page.locator('[data-testid="panel-properties"] fieldset')
      await expect(fieldset).toBeAttached()
      await expect(fieldset).toHaveAttribute('disabled', '')
    })

    test('should not select keys via Ctrl+A in preview mode', async ({ page }) => {
      // All canvas keyboard shortcuts early-return in preview — Ctrl+A is blocked too.
      const canvas = page.getByTestId('canvas-main')
      await canvas.click()
      await page.keyboard.press('Control+a')
      await waitHelpers.waitForDoubleAnimationFrame()
      await editor.expectSelectedCount(0)
    })

    test('should disable the Preset dropdown button in preview mode', async () => {
      await expect(presets.getDropdownButton()).toBeDisabled()
    })

    test('should disable the Import dropdown button in preview mode', async ({ page }) => {
      await expect(page.locator(SELECTORS.IMPORT_EXPORT.IMPORT_BUTTON)).toBeDisabled()
    })

    test('should not add keys when Add Key is clicked in preview mode', async ({ page }) => {
      // Add Key handler early-returns in preview — button has no :disabled binding
      const addKeyBtn = page.locator(SELECTORS.TOOLBAR.ADD_KEY)
      await addKeyBtn.click()
      await waitHelpers.waitForDoubleAnimationFrame()
      // Key count must remain unchanged
      await editor.expectKeyCount(MULTILAYOUT_KEY_COUNT)
    })

    test('should disable all four Extra Tools menu items in preview mode', async () => {
      await extraTools.openDropdown()
      await extraTools.expectToolDisabled('Legend Tools')
      await extraTools.expectToolDisabled('Add Switch Matrix Coordinates')
      await extraTools.expectToolDisabled('Move Rotation Origins')
      await extraTools.expectToolDisabled('Theme Tools')
    })

    test('should not delete keys when Delete is pressed in preview mode', async ({ page }) => {
      const canvas = page.getByTestId('canvas-main')
      await canvas.click()
      await page.keyboard.press('Delete')
      await waitHelpers.waitForDoubleAnimationFrame()
      await editor.expectKeyCount(MULTILAYOUT_KEY_COUNT)
    })

    test('should not mutate layout via cut/paste keyboard shortcuts in preview mode', async ({
      page,
    }) => {
      const canvas = page.getByTestId('canvas-main')
      await canvas.click()
      await page.keyboard.press('Control+x')
      await waitHelpers.waitForDoubleAnimationFrame()
      await page.keyboard.press('Control+v')
      await waitHelpers.waitForDoubleAnimationFrame()
      await editor.expectKeyCount(MULTILAYOUT_KEY_COUNT)
    })
  })

  // =========================================================================
  // E — Selection and mode side-effects
  // =========================================================================

  test.describe('Selection and mode side-effects', () => {
    test('should clear existing key selection when entering preview mode', async ({ page }) => {
      await loadMultilayoutPreset()
      // Select all keys in All mode via Ctrl+A
      const canvas = page.getByTestId('canvas-main')
      await canvas.click()
      await page.keyboard.press('Control+a')
      await waitHelpers.waitForDoubleAnimationFrame()
      // All 83 keys should be selected
      await editor.expectSelectedCount(MULTILAYOUT_KEY_COUNT)
      // Entering preview clears selectedKeys
      await layoutOptions.clickChoice(0, 1)
      await editor.expectSelectedCount(0)
    })

    test('should restore selection capability after exiting preview mode', async ({ page }) => {
      await loadMultilayoutPreset()
      await layoutOptions.clickChoice(0, 1)
      await layoutOptions.clickAll()
      // Selection should work again — Ctrl+A selects all keys
      const canvas = page.getByTestId('canvas-main')
      await canvas.click()
      await page.keyboard.press('Control+a')
      await waitHelpers.waitForDoubleAnimationFrame()
      await editor.expectSelectedCount(MULTILAYOUT_KEY_COUNT)
    })
  })

  // =========================================================================
  // F — Round-trip non-mutation invariant
  // =========================================================================

  test.describe('Round-trip non-mutation invariant', () => {
    test('should not mutate the underlying layout when toggling preview choices', async ({
      page,
    }) => {
      await loadMultilayoutPreset()
      const importExport = new ImportExportHelper(page, waitHelpers)
      const ts = Date.now()

      // Export before any preview — exportToJSON returns the resolved file path
      const beforePath = await importExport.exportToJSON(`preview-before-${ts}.json`)

      // Cycle through several preview states
      await layoutOptions.clickChoice(0, 1)
      await layoutOptions.clickChoice(1, 1)
      await layoutOptions.clickChoice(0, 0)
      await layoutOptions.clickAll()

      // Export after preview round-trip
      const afterPath = await importExport.exportToJSON(`preview-after-${ts}.json`)

      // Compare — must be deeply equal (JSON serialization may reorder keys, so use deep-equal)
      const beforeContent = await fs.readFile(beforePath, 'utf-8')
      const afterContent = await fs.readFile(afterPath, 'utf-8')
      expect(JSON.parse(beforeContent)).toEqual(JSON.parse(afterContent))

      // Cleanup
      await fs.unlink(beforePath).catch(() => undefined)
      await fs.unlink(afterPath).catch(() => undefined)
    })
  })

  // =========================================================================
  // G — Pan / zoom remain enabled in preview mode
  // =========================================================================

  test.describe('Zoom controls remain enabled in preview mode', () => {
    test('should allow zoom level changes while in preview mode', async ({ page }) => {
      await loadMultilayoutPreset()
      const zoom = new ZoomComponent(page, waitHelpers)
      // Ensure baseline zoom
      await zoom.resetZoom()
      const initialZoom = await zoom.getZoomLevel()

      await layoutOptions.clickChoice(0, 1)

      // Zoom in — should succeed in preview mode
      await zoom.zoomIn(20)
      await zoom.expectZoomLevel(initialZoom + 20)

      // Zoom back out
      await zoom.zoomOut(20)
      await zoom.expectZoomLevel(initialZoom)
    })
  })

  // =========================================================================
  // H — Invalidation: loading a different preset hides the toolbar
  // =========================================================================

  test.describe('Toolbar invalidation on layout change', () => {
    test('should hide toolbar after switching to a preset without alt-layouts', async () => {
      await loadMultilayoutPreset()
      await layoutOptions.expectVisible()
      // Preset dropdown is NOT disabled (not in preview) — switch directly
      await presets.selectPreset('ANSI 104')
      await editor.expectKeyCount(104)
      await waitHelpers.waitForDoubleAnimationFrame()
      await layoutOptions.expectHidden()
    })

    test('should show toolbar in All-active state after re-loading VIA preset', async () => {
      await loadMultilayoutPreset()
      // Switch away and back to confirm state resets cleanly
      await presets.selectPreset('Default 60%')
      await waitHelpers.waitForDoubleAnimationFrame()
      await loadMultilayoutPreset()
      // Toolbar should appear with All active (no stale preview state)
      await layoutOptions.expectVisible()
      await layoutOptions.expectAllActive()
      await layoutOptions.expectPreviewHintHidden()
    })
  })

  // =========================================================================
  // I — Visual regression (Chromium-only)
  // =========================================================================

  test.describe('Visual regression', () => {
    test.skip(
      ({ browserName }) => browserName !== 'chromium',
      'Visual regression tests only run on Chromium',
    )

    test.beforeEach(async () => {
      await loadMultilayoutPreset()
    })

    test('should match snapshot in All mode (default state)', async ({ page }) => {
      const container = page.locator('.keyboard-canvas-container')
      await waitHelpers.waitForDoubleAnimationFrame()
      await expect(container).toHaveScreenshot('multilayout-60-all-mode.png')
    })

    test('should match snapshot with choice (0, 1) active', async ({ page }) => {
      await layoutOptions.clickChoice(0, 1)
      const container = page.locator('.keyboard-canvas-container')
      await waitHelpers.waitForDoubleAnimationFrame()
      await expect(container).toHaveScreenshot('multilayout-60-preview-choice-0-1.png')
    })

    test('should match snapshot with choices (0, 1) and (1, 1) active', async ({ page }) => {
      await layoutOptions.clickChoice(0, 1)
      await layoutOptions.clickChoice(1, 1)
      const container = page.locator('.keyboard-canvas-container')
      await waitHelpers.waitForDoubleAnimationFrame()
      await expect(container).toHaveScreenshot('multilayout-60-preview-multi-group.png')
    })

    test('should match baseline snapshot after restoring All from preview', async ({ page }) => {
      await layoutOptions.clickChoice(0, 1)
      await layoutOptions.clickAll()
      const container = page.locator('.keyboard-canvas-container')
      await waitHelpers.waitForDoubleAnimationFrame()
      await expect(container).toHaveScreenshot('multilayout-60-after-restore-all.png')
    })
  })
})
