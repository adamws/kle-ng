import { test, expect, type Page } from '@playwright/test'
import LZStringModule from 'lz-string'
const LZString = LZStringModule
import { KeyboardEditorPage } from './pages/KeyboardEditorPage'

/**
 * Short links — `?s=<id>` resolved against Supabase.
 *
 * CI builds the e2e bundle with **`VITE_SUPABASE_*` blanked** (see the "Build project for
 * e2e" step in ci.yml), so isAuthConfigured() is false there, resolveShortLinkPayload()
 * throws before it fetches, and the suite never talks to a database. Two tiers follow
 * from that: behaviour that holds with accounts off, and behaviour that needs a
 * configured build — which in practice means a dev server with a `.env.local`.
 *
 * That blanking is the point, and it is load-bearing. `.env.production` is committed
 * with the *live* project's URL and anon key, so a plain `vite build` — which is what CI
 * used to hand the e2e job — compiles production credentials into the bundle under test.
 * An unstubbed `?s=` load then really did hit the live project, and when that failed in a
 * retryable way restoreShortLinkOnFailure() put the id back in the address bar, which is
 * correct behaviour and looks exactly like a strip that never happened.
 *
 * So: stub `resolve_short_link` in every test that reaches it, and never assert anything
 * that depends on how a real server answers.
 */

const VALID_ID = '7kQ2mBx9Lp'

/** The payload format a short link stores: lz-string compressed KLE. */
const payloadFor = (kle: unknown) => LZString.compressToEncodedURIComponent(JSON.stringify(kle))

/**
 * Whether the bundle under test has accounts compiled in, probed from the page.
 *
 * The account section of the user menu renders only when `auth.isConfigured`, and its
 * markup is in the DOM whether or not the dropdown is open, so no click is needed.
 * Reading `process.env.VITE_SUPABASE_URL` instead would describe Playwright's own
 * process, which never sees the build's env.
 */
async function accountsConfigured(page: Page): Promise<boolean> {
  await page.goto('/')
  await expect(page.locator('.canvas-toolbar')).toBeVisible()
  return (await page.getByTestId('sign-in-github').count()) > 0
}

test.describe('Short links', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Only run on Chromium')

  test('takes ?s= out of the address bar before the resolve finishes', async ({ page }) => {
    // The resolve is held open so the assertion lands while it is still in flight. That
    // is the property that matters: the id is consumed synchronously at startup, so it
    // is already gone when signInWithOAuth() redirects to `origin + pathname` and drops
    // the query. Asserting on the state *after* a resolve would instead be asserting
    // which failure code came back.
    let release = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    await page.route('**/rest/v1/rpc/resolve_short_link', async (route) => {
      await held
      // The test may already be finishing by the time this runs; a fulfil against a
      // closed page must not surface as an unhandled rejection.
      await route
        .fulfill({ status: 200, contentType: 'application/json', body: 'null' })
        .catch(() => {})
    })

    await page.goto(`/?s=${VALID_ID}`)
    await expect(page.locator('.canvas-toolbar')).toBeVisible()

    await expect(page).toHaveURL((url) => !url.searchParams.has('s'))

    // An unknown id is permanent, so releasing the resolve must not put it back: only a
    // retryable failure restores the id, and this asserts we did not classify a plain
    // "no such link" as one.
    release()
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
    test.beforeEach(async ({ page }) => {
      test.skip(
        !(await accountsConfigured(page)),
        'this build has no VITE_SUPABASE_* compiled in, so a resolve never reaches the network',
      )
    })

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

    test('puts ?s= back when the resolve fails in a way a reload could fix', async ({ page }) => {
      await page.route('**/rest/v1/rpc/resolve_short_link', (route) => route.abort('failed'))

      await page.goto(`/?s=${VALID_ID}`)
      await expect(page.locator('.canvas-toolbar')).toBeVisible()

      // Reloading is exactly what a user does when told the service is unreachable, so
      // the id has to be there to reload.
      await expect(page).toHaveURL((url) => url.searchParams.get('s') === VALID_ID)
    })

    // Import -> From URL predates short links and used to fetch one as if it were a
    // JSON file. Covered as e2e as well as in UrlImportModal.spec.ts because the unit
    // test mounts the modal directly and so cannot catch the toolbar wiring.
    test('imports a short link pasted into Import -> From URL', async ({ page }) => {
      await page.route('**/rest/v1/rpc/resolve_short_link', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(payloadFor([['A', 'B', 'C']])),
        }),
      )

      const editor = new KeyboardEditorPage(page)
      await page.goto('/')
      await expect(page.locator('.canvas-toolbar')).toBeVisible()

      await page.locator('button', { hasText: 'Import' }).click()
      await page.locator('a', { hasText: 'From URL' }).click()
      await page.locator('#urlInput').fill(`${new URL(page.url()).origin}/?s=${VALID_ID}`)
      await page.locator('.modal-content button', { hasText: 'Import' }).click()

      await editor.expectKeyCount(3)
    })
  })
})
