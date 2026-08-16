import { test, expect } from '@playwright/test'
import LZStringModule from 'lz-string'
const LZString = LZStringModule
import { KeyboardEditorPage } from './pages/KeyboardEditorPage'

/**
 * Short links — `?s=<id>` resolved against Supabase.
 *
 * CI runs e2e with no VITE_SUPABASE_* variables (they are injected only by the Vercel
 * preview workflow), so isAuthConfigured() is false there and the resolve fetch never
 * fires. The tests are therefore in two tiers: behaviour that must hold with accounts
 * off, and behaviour that needs a configured project.
 *
 * Do NOT inject dummy VITE_SUPABASE_* into the e2e CI job to unlock the second tier —
 * it would flip authStore.isConfigured on for every existing test and change how
 * AccountMenu renders.
 */

const VALID_ID = '7kQ2mBx9Lp'

/** The payload format a short link stores: lz-string compressed KLE. */
const payloadFor = (kle: unknown) => LZString.compressToEncodedURIComponent(JSON.stringify(kle))

test.describe('Short links', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Only run on Chromium')

  test('strips ?s= from the address bar even when accounts are unconfigured', async ({ page }) => {
    await page.goto(`/?s=${VALID_ID}`)
    await expect(page.locator('.canvas-toolbar')).toBeVisible()

    // Consumed synchronously at startup, so it never survives to a sign-in redirect
    await expect(page).toHaveURL((url) => !url.searchParams.has('s'))
  })

  test('offers no short-link caret to a signed-out visitor', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.canvas-toolbar')).toBeVisible()

    await expect(page.getByTestId('share-options')).toHaveCount(0)
    // …while the plain Share button is still there for everyone
    await expect(page.locator('.share-group > .btn')).toBeVisible()
  })

  test.describe('with accounts configured', () => {
    // Needs the variable exported into the test process, not merely present in
    // .env.local — Vite reads that file, Playwright's node process does not.
    test.skip(!process.env.VITE_SUPABASE_URL, 'requires VITE_SUPABASE_URL in the environment')

    test('loads a layout from ?s=', async ({ page }) => {
      await page.route('**/rest/v1/rpc/resolve_short_link', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(payloadFor([['A', 'B']])),
        }),
      )

      const editor = new KeyboardEditorPage(page)
      await page.goto(`/?s=${VALID_ID}`)

      await editor.expectKeyCount(2)
      await expect(page).toHaveURL((url) => !url.searchParams.has('s'))
    })

    test('shows an error toast for an unknown id', async ({ page }) => {
      // An unknown link is 200 with a null body, not a 404
      await page.route('**/rest/v1/rpc/resolve_short_link', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
      )

      await page.goto(`/?s=${VALID_ID}`)

      await expect(page.locator('.toast.show')).toHaveClass(/toast-error/)
    })
  })
})
