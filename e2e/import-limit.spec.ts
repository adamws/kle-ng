import { test, expect } from '@playwright/test'
import LZStringModule from 'lz-string'
const LZString = LZStringModule
import { ImportExportHelper } from './helpers/import-export-helpers'
import { WaitHelpers } from './helpers/wait-helpers'

/**
 * Build an encoded #share= payload for a raw KLE array of the given key count.
 * Mirrors the app's encodeLayoutToUrl logic but operates on the raw KLE array
 * directly so the test does not depend on the kle-serial library.
 */
function encodeOversizedShareHash(keyCount: number): string {
  const rows: string[][] = []
  let remaining = keyCount
  while (remaining > 0) {
    const rowSize = Math.min(25, remaining)
    rows.push(Array(rowSize).fill('A'))
    remaining -= rowSize
  }
  return LZString.compressToEncodedURIComponent(JSON.stringify(rows))
}

const MAX_KEYS = 1000
const OVERSIZED_COUNT = MAX_KEYS + 1

test.describe('Import key-count limit', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Only run on Chromium')

  let helper: ImportExportHelper
  let waitHelpers: WaitHelpers

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.canvas-toolbar')).toBeVisible()
    waitHelpers = new WaitHelpers(page)
    helper = new ImportExportHelper(page, waitHelpers)
  })

  test.describe('file upload', () => {
    test('rejects oversized layout and shows error toast', async ({ page }) => {
      await expect(page.getByTestId('counter-keys')).toContainText('Keys: 0')

      await helper.importFromFile('e2e/fixtures/oversized-layout.json')

      await expect(page.locator('.toast.show')).toBeVisible()
      await expect(page.locator('.toast.show')).toHaveClass(/toast-error/)
      await expect(page.locator('.toast.show .toast-body')).toContainText(`${OVERSIZED_COUNT} keys`)
      await expect(page.getByTestId('counter-keys')).toContainText('Keys: 0')
    })

    test('accepts layout exactly at the limit', async ({ page }) => {
      // MAX_KEYS spread across 40 rows of 25
      const rows: string[][] = Array.from({ length: MAX_KEYS / 25 }, () => Array(25).fill('A'))
      const json = JSON.stringify(rows)

      const fileChooserPromise = page.waitForEvent('filechooser')
      await page.getByTestId('button-import').click()
      await expect(page.getByTestId('import-from-file')).toBeVisible()
      await page.getByTestId('import-from-file').click()
      const fc = await fileChooserPromise
      await fc.setFiles({
        name: 'limit-layout.json',
        mimeType: 'application/json',
        buffer: Buffer.from(json),
      })

      await expect(page.getByTestId('counter-keys')).toContainText(`Keys: ${MAX_KEYS}`, {
        timeout: 10000,
      })
      await expect(page.locator('.toast.show')).not.toHaveClass(/toast-error/)
    })
  })

  test.describe('share URL navigation', () => {
    test('rejects oversized shared layout and shows error toast', async ({ page }) => {
      // Navigate via about:blank first to ensure a full page load (not a same-page hash change)
      const encoded = encodeOversizedShareHash(OVERSIZED_COUNT)
      await page.goto('about:blank')
      await page.goto(`/#share=${encoded}`)
      await expect(page.locator('.canvas-toolbar')).toBeVisible()

      await expect(page.locator('.toast.show')).toBeVisible({ timeout: 10000 })
      await expect(page.locator('.toast.show')).toHaveClass(/toast-error/)
      await expect(page.locator('.toast.show .toast-body')).toContainText(`${OVERSIZED_COUNT} keys`)
      await expect(page.getByTestId('counter-keys')).toContainText('Keys: 0')
    })
  })

  test.describe('URL import modal', () => {
    test('rejects oversized share link pasted into the URL modal', async ({ page }) => {
      const encoded = encodeOversizedShareHash(OVERSIZED_COUNT)
      const shareUrl = `http://localhost:5173/#share=${encoded}`

      await page.getByTestId('button-import').click()
      await expect(page.locator('a', { hasText: 'From URL' })).toBeVisible()
      await page.locator('a', { hasText: 'From URL' }).click()

      const modal = page.locator('.modal-content')
      await expect(modal).toBeVisible()
      await page.locator('#urlInput').fill(shareUrl)
      await modal.locator('button', { hasText: 'Import' }).click()

      await expect(page.locator('.toast.show')).toBeVisible({ timeout: 10000 })
      await expect(page.locator('.toast.show')).toHaveClass(/toast-error/)
      await expect(page.locator('.toast.show .toast-body')).toContainText(`${OVERSIZED_COUNT} keys`)
      await expect(page.getByTestId('counter-keys')).toContainText('Keys: 0')
    })
  })
})
