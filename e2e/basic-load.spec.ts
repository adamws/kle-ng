import { test, expect } from '@playwright/test'

test('application loads correctly', async ({ page }) => {
  await page.goto('/')

  // Check if the page loads without JavaScript errors
  await expect(page.locator('h1')).toContainText('Keyboard Layout Editor NG')

  // Check if main components are rendered
  await expect(page.locator('.toolbar-container')).toBeVisible()
  await expect(page.locator('.keyboard-canvas')).toBeVisible()
  await expect(page.locator('.key-properties-panel')).toBeVisible()
})
