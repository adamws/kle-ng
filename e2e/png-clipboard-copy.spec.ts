import { test, expect } from '@playwright/test'
import { promises as fs } from 'fs'
import path from 'path'
import { ImportExportHelper } from './helpers/import-export-helpers'
import { WaitHelpers } from './helpers/wait-helpers'

/**
 * E2E coverage for "Copy layout image to clipboard".
 *
 * The button renders the layout to a PNG (identical to Download PNG, via the
 * shared generateLayoutPngBlob) and writes it to the system clipboard. The
 * layout is embedded twice: as PNG tEXt chunks AND in the alpha-channel LSBs of
 * the pixels. Browsers strip the tEXt chunks when re-encoding clipboard images,
 * so the pixel copy is what makes a copied-and-pasted image round-trip back
 * into the editor.
 *
 * Notes on approach:
 * - The button write path is asserted directly (success toast fires only after
 *   navigator.clipboard.write resolves).
 * - Reading an image back from the clipboard is unreliable in headless
 *   Chromium, so the pixel-LSB round-trip is exercised via the Download PNG
 *   export (byte-identical embedding) with its tEXt chunks stripped to force
 *   the fallback path.
 *
 * These tests only run on Chromium (consistent with the other canvas suites).
 */
test.describe('Copy layout image to clipboard', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Clipboard/canvas behaviour is only exercised on Chromium',
  )

  let helper: ImportExportHelper
  let waitHelpers: WaitHelpers

  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/')
    await expect(page.locator('.canvas-toolbar')).toBeVisible()
    waitHelpers = new WaitHelpers(page)
    helper = new ImportExportHelper(page, waitHelpers)
  })

  // Remove all text chunks (tEXt/zTXt/iTXt) from a PNG, mimicking the browser's
  // clipboard re-encode which keeps pixels but discards ancillary metadata.
  function stripTextChunks(png: Buffer): Buffer {
    const TEXT_TYPES = new Set(['tEXt', 'zTXt', 'iTXt'])
    const out: Buffer[] = [png.subarray(0, 8)] // PNG signature
    let offset = 8
    while (offset + 8 <= png.length) {
      const length = png.readUInt32BE(offset)
      const type = png.toString('ascii', offset + 4, offset + 8)
      const chunkEnd = offset + 12 + length // length + type + data + crc
      if (!TEXT_TYPES.has(type)) {
        out.push(png.subarray(offset, chunkEnd))
      }
      offset = chunkEnd
      if (type === 'IEND') break
    }
    return Buffer.concat(out)
  }

  test('button copies the layout image to the clipboard and flashes "Copied"', async ({ page }) => {
    await helper.importFromFile('e2e/fixtures/complex-layout.json', 6)

    const copyButton = page.getByTestId('canvas-copy-image')
    await expect(copyButton).toBeVisible()
    await copyButton.click()

    // On success (after navigator.clipboard.write resolves) a Bootstrap tooltip
    // anchored to the left of the button briefly flashes "Copied".
    const tooltipInner = page.locator('.tooltip .tooltip-inner')
    await expect(tooltipInner).toHaveText('Copied')

    // It must have an opaque background so the text stays readable over the
    // canvas (the tooltip component CSS must be loaded).
    const bg = await tooltipInner.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(bg).not.toBe('transparent')
    expect(bg).not.toBe('rgba(0, 0, 0, 0)')

    // ...and it is a transient flash that clears itself.
    await expect(page.locator('.tooltip')).toHaveCount(0, { timeout: 3000 })
  })

  test('search and settings buttons use the same left-placed Bootstrap tooltip', async ({
    page,
  }) => {
    // Move the mouse to a neutral corner so any prior tooltip fades out.
    const clearTooltip = async () => {
      await page.mouse.move(1, 1)
      await expect(page.locator('.tooltip')).toHaveCount(0)
    }

    // Search trigger: left-placed Bootstrap tooltip (not the native title).
    await page.locator('.canvas-search-trigger').hover()
    await expect(page.locator('.tooltip .tooltip-inner')).toHaveText('Search key labels (/)')
    await expect(page.locator('.tooltip')).toHaveAttribute('data-popper-placement', 'left')
    await clearTooltip()

    // Settings trigger: label reflects state and updates when toggled.
    const settings = page.locator('.canvas-settings-trigger')
    await settings.hover()
    await expect(page.locator('.tooltip .tooltip-inner')).toHaveText('Open Layout Editor settings')

    await settings.click()
    await clearTooltip()
    await settings.hover()
    await expect(page.locator('.tooltip .tooltip-inner')).toHaveText('Close Layout Editor settings')
  })

  test('exported layout image round-trips back into the editor after tEXt metadata is stripped', async ({
    page,
  }) => {
    // Import a known layout (6 keys). Download PNG shares the exact embedding
    // (tEXt + alpha-channel LSB) used by the clipboard button.
    await helper.importFromFile('e2e/fixtures/complex-layout.json', 6)

    const pngPath = await helper.exportToPNG('clipboard-lsb-roundtrip.png')
    const original = await fs.readFile(pngPath)

    // Strip the tEXt chunks to force the pixel-LSB fallback (what a real
    // clipboard re-encode does to the copied image).
    const stripped = stripTextChunks(original)
    expect(original.includes('KLE-Layout')).toBe(true)
    expect(stripped.includes('KLE-Layout')).toBe(false)
    // Still a valid PNG after stripping.
    expect(Array.from(stripped.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])

    const strippedPath = path.resolve('e2e/test-output', 'clipboard-lsb-stripped.png')
    await fs.writeFile(strippedPath, stripped)

    // Reset the editor to a clean slate so the assertion is meaningful.
    await page.reload()
    await expect(page.locator('.canvas-toolbar')).toBeVisible()
    await expect(page.getByTestId('counter-keys')).toContainText('Keys: 0')

    // Importing the stripped PNG must still restore all 6 keys via pixel data.
    await helper.importFromFile(strippedPath, 6)
    await expect(page.locator('.toast.show')).toHaveClass(/toast-success/)
  })
})
