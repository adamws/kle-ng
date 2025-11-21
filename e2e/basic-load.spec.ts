import { test, expect } from '@playwright/test'
import { KeyboardEditorPage } from './pages/KeyboardEditorPage'
import { SELECTORS } from './constants/selectors'

test('application loads correctly', async ({ page }) => {
  const editor = new KeyboardEditorPage(page)
  await editor.goto()

  // Check if the page loads without JavaScript errors
  await expect(page.locator('h1')).toContainText('Keyboard Layout Editor NG')

  // Check if main components are rendered using centralized selectors
  await expect(page.locator(SELECTORS.PANELS.TOOLBAR_CONTAINER)).toBeVisible()
  await editor.canvas.expectVisible()
  await expect(page.locator(SELECTORS.PANELS.PROPERTIES)).toBeVisible()

  // Verify counters are visible
  await editor.expectCountersVisible()
})
