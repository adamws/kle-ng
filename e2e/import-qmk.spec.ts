import { test, expect, Page, Route } from '@playwright/test'
import { SELECTORS } from './constants/selectors'

// ============================================================
// Mock Data
// ============================================================

const MOCK_KEYBOARDS = [
  '40percentclub/gherkin',
  'ergodox_ez',
  'handwired/dactyl_manuform/4x5',
  'handwired/dactyl_manuform/4x6',
  'keebio/iris/rev6',
]

const ERGODOX_INFO = {
  keyboards: {
    ergodox_ez: {
      keyboard_name: 'ErgoDox EZ',
      manufacturer: 'ErgoDox EZ',
      layouts: {
        LAYOUT: {
          layout: [
            { matrix: [0, 0], x: 0, y: 0 },
            { matrix: [0, 1], x: 1, y: 0 },
            { matrix: [1, 0], x: 0, y: 1 },
            { matrix: [1, 1], x: 1, y: 1 },
          ],
        },
      },
    },
  },
}

// ============================================================
// Selectors
// ============================================================

const QMK_MODAL = '.modal:has(.modal-title:text("Import from QMK"))'
const QMK_ERROR = `${QMK_MODAL} .alert.alert-danger`
const QMK_IMPORT_BTN = `${QMK_MODAL} .modal-footer .btn-primary`
const QMK_CANCEL_BTN = `${QMK_MODAL} .modal-footer .btn-secondary`
const QMK_X_BTN = `${QMK_MODAL} .modal-header .btn-close`
const QMK_COUNT_HINT = `${QMK_MODAL} .form-text`
const URL_MODAL = '.modal:has(.modal-title:text("Import from URL"))'
const URL_IMPORT_BTN = `${URL_MODAL} .modal-footer .btn-primary`

// ============================================================
// Helpers
// ============================================================

async function mockKeyboardList(page: Page, keyboards = MOCK_KEYBOARDS) {
  await page.route('https://keyboards.qmk.fm/v1/keyboard_list.json', (route) =>
    route.fulfill({ json: { keyboards, last_updated: '2026-01-01T00:00:00+00:00' } }),
  )
}

async function openQmkModal(page: Page) {
  await page.click(SELECTORS.IMPORT_EXPORT.IMPORT_BUTTON)
  await page.click('.dropdown-item:has-text("From QMK")')
  await expect(page.locator('.modal-title:text("Import from QMK")')).toBeVisible()
}

async function waitForList(page: Page) {
  await expect(page.locator('.qmk-keyboard-list')).toBeVisible({ timeout: 10000 })
}

// ============================================================
// Test Suite
// ============================================================

test.describe('Import from QMK', () => {
  // --------------------------------------------------------
  // Group 1: Modal Open and Initial State
  // --------------------------------------------------------
  test.describe('Modal Open and Initial State', () => {
    test('TC-QMK-001 — opens via toolbar Import → From QMK dropdown', async ({ page }) => {
      await mockKeyboardList(page)
      await page.goto('/')

      await page.click(SELECTORS.IMPORT_EXPORT.IMPORT_BUTTON)
      await page.click('.dropdown-item:has-text("From QMK")')

      await expect(page.locator('.modal-title:text("Import from QMK")')).toBeVisible()
      await expect(page.locator('#qmkSearchInput')).toBeVisible()
      await expect(page.locator(QMK_IMPORT_BTN)).toBeDisabled()
      await expect(page.locator(QMK_CANCEL_BTN)).toBeVisible()
    })

    test('TC-QMK-002 — search input receives autofocus when modal opens', async ({ page }) => {
      await mockKeyboardList(page)
      await page.goto('/')
      await openQmkModal(page)

      const activeId = await page.evaluate(() => document.activeElement?.id)
      expect(activeId).toBe('qmkSearchInput')
    })

    test('TC-QMK-003 — loading state shown while list is fetching', async ({ page }) => {
      let capturedRoute: Route | null = null

      await page.route('https://keyboards.qmk.fm/v1/keyboard_list.json', (route) => {
        capturedRoute = route
        // Don't fulfill yet — hold the request to observe loading state
      })

      await page.goto('/')
      await page.click(SELECTORS.IMPORT_EXPORT.IMPORT_BUTTON)
      await page.click('.dropdown-item:has-text("From QMK")')
      await expect(page.locator('.modal-title:text("Import from QMK")')).toBeVisible()

      // Wait until the browser has sent the request and it's been intercepted
      await expect.poll(() => capturedRoute !== null, { timeout: 3000 }).toBeTruthy()

      // While request is in-flight: loading text visible, list not yet rendered
      await expect(page.locator(QMK_MODAL)).toContainText('Loading keyboard list')
      await expect(page.locator('.qmk-keyboard-list')).not.toBeVisible()

      // Fulfill the request and verify the list appears
      await capturedRoute!.fulfill({
        json: { keyboards: MOCK_KEYBOARDS, last_updated: '2026-01-01' },
      })
      await waitForList(page)
      await expect(page.locator(QMK_MODAL)).not.toContainText('Loading keyboard list')
    })

    test('TC-QMK-004 — list renders all items after successful load', async ({ page }) => {
      await mockKeyboardList(page)
      await page.goto('/')
      await openQmkModal(page)
      await waitForList(page)

      await expect(page.locator('.qmk-keyboard-item')).toHaveCount(5)
    })

    test('TC-QMK-005 — count hint shows "N keyboards available" with no search query', async ({
      page,
    }) => {
      await mockKeyboardList(page)
      await page.goto('/')
      await openQmkModal(page)
      await waitForList(page)

      await expect(page.locator(QMK_COUNT_HINT)).toContainText('5 keyboards available')
    })
  })

  // --------------------------------------------------------
  // Group 2: Search / Filtering
  // --------------------------------------------------------
  test.describe('Search / Filtering', () => {
    test.beforeEach(async ({ page }) => {
      await mockKeyboardList(page)
      await page.goto('/')
      await openQmkModal(page)
      await waitForList(page)
    })

    test('TC-QMK-010 — substring search filters the list', async ({ page }) => {
      await page.fill('#qmkSearchInput', 'iris')

      await expect(page.locator('.qmk-keyboard-item')).toHaveCount(1)
      await expect(page.locator('.qmk-keyboard-item')).toContainText('keebio/iris/rev6')
      await expect(page.locator(QMK_COUNT_HINT)).toContainText('1 result(s)')
    })

    test('TC-QMK-011 — fuzzy search surfaces the most relevant result', async ({ page }) => {
      await page.fill('#qmkSearchInput', 'dactyl 4x5')

      await expect(
        page.locator('.qmk-keyboard-item:has-text("handwired/dactyl_manuform/4x5")'),
      ).toBeVisible()
      const count = await page.locator('.qmk-keyboard-item').count()
      expect(count).toBeGreaterThanOrEqual(1)
    })

    test('TC-QMK-012 — search is case-insensitive', async ({ page }) => {
      await page.fill('#qmkSearchInput', 'ERGODOX')

      await expect(page.locator('.qmk-keyboard-item:has-text("ergodox_ez")')).toBeVisible()
    })

    test('TC-QMK-013 — no-match state shows empty message and zero results', async ({ page }) => {
      await page.fill('#qmkSearchInput', 'zzznomatch')

      await expect(page.locator('.qmk-keyboard-item')).toHaveCount(0)
      await expect(page.locator('.qmk-keyboard-list p.text-muted')).toBeVisible()
      await expect(page.locator(QMK_COUNT_HINT)).toContainText('0 result(s)')
    })

    test('TC-QMK-014 — clearing the search query restores the full list', async ({ page }) => {
      await page.fill('#qmkSearchInput', 'iris')
      await expect(page.locator('.qmk-keyboard-item')).toHaveCount(1)

      await page.fill('#qmkSearchInput', '')

      await expect(page.locator('.qmk-keyboard-item')).toHaveCount(5)
      await expect(page.locator(QMK_COUNT_HINT)).toContainText('5 keyboards available')
    })

    test('TC-QMK-015 — changing the search query deselects the current selection', async ({
      page,
    }) => {
      await page.click('.qmk-keyboard-item:has-text("ergodox_ez")')
      await expect(page.locator('.qmk-keyboard-item.selected')).toBeVisible()
      await expect(page.locator(QMK_IMPORT_BTN)).toBeEnabled()

      await page.fill('#qmkSearchInput', 'e')

      await expect(page.locator('.qmk-keyboard-item.selected')).toHaveCount(0)
      await expect(page.locator(QMK_IMPORT_BTN)).toBeDisabled()
    })
  })

  // --------------------------------------------------------
  // Group 3: Selection Behavior
  // --------------------------------------------------------
  test.describe('Selection Behavior', () => {
    test.beforeEach(async ({ page }) => {
      await mockKeyboardList(page)
      await page.goto('/')
      await openQmkModal(page)
      await waitForList(page)
    })

    test('TC-QMK-020 — clicking a row marks it selected and leaves others unselected', async ({
      page,
    }) => {
      await page.click('.qmk-keyboard-item:has-text("ergodox_ez")')

      await expect(page.locator('.qmk-keyboard-item:has-text("ergodox_ez")')).toHaveClass(
        /selected/,
      )

      const others = page.locator('.qmk-keyboard-item:not(:has-text("ergodox_ez"))')
      const count = await others.count()
      for (let i = 0; i < count; i++) {
        await expect(others.nth(i)).not.toHaveClass(/selected/)
      }
    })

    test('TC-QMK-021 — Import button enables after a keyboard is selected', async ({ page }) => {
      await expect(page.locator(QMK_IMPORT_BTN)).toBeDisabled()

      await page.click('.qmk-keyboard-item:has-text("ergodox_ez")')

      await expect(page.locator(QMK_IMPORT_BTN)).toBeEnabled()
    })

    test('TC-QMK-022 — clicking a different row moves the selection', async ({ page }) => {
      await page.click('.qmk-keyboard-item:has-text("ergodox_ez")')
      await page.click('.qmk-keyboard-item:has-text("keebio/iris/rev6")')

      await expect(page.locator('.qmk-keyboard-item:has-text("keebio/iris/rev6")')).toHaveClass(
        /selected/,
      )
      await expect(page.locator('.qmk-keyboard-item:has-text("ergodox_ez")')).not.toHaveClass(
        /selected/,
      )
    })
  })

  // --------------------------------------------------------
  // Group 4: Import Happy Path
  // --------------------------------------------------------
  test.describe('Import Happy Path', () => {
    test('TC-QMK-030 — Import button fetches info.json and loads the layout', async ({ page }) => {
      await mockKeyboardList(page)
      await page.route('https://keyboards.qmk.fm/v1/keyboards/ergodox_ez/info.json', (route) =>
        route.fulfill({ json: ERGODOX_INFO }),
      )
      await page.goto('/')
      await openQmkModal(page)
      await waitForList(page)

      await page.click('.qmk-keyboard-item:has-text("ergodox_ez")')
      await page.click(QMK_IMPORT_BTN)

      await expect(page.locator('.modal-title:text("Import from QMK")')).not.toBeVisible()
      await expect(page.locator(SELECTORS.TOAST.NOTIFICATION)).toBeVisible()
      await expect(page.locator(SELECTORS.TOAST.TITLE)).toContainText('Import Successful')
    })

    test('TC-QMK-031 — double-clicking a row imports immediately without the button', async ({
      page,
    }) => {
      await mockKeyboardList(page)
      await page.route('https://keyboards.qmk.fm/v1/keyboards/ergodox_ez/info.json', (route) =>
        route.fulfill({ json: ERGODOX_INFO }),
      )
      await page.goto('/')
      await openQmkModal(page)
      await waitForList(page)

      await page.dblclick('.qmk-keyboard-item:has-text("ergodox_ez")')

      await expect(page.locator('.modal-title:text("Import from QMK")')).not.toBeVisible()
      await expect(page.locator(SELECTORS.TOAST.NOTIFICATION)).toBeVisible()
      await expect(page.locator(SELECTORS.TOAST.TITLE)).toContainText('Import Successful')
    })

    test('TC-QMK-033 — keyboard list is fetched only once across multiple modal opens', async ({
      page,
    }) => {
      let callCount = 0
      await page.route('https://keyboards.qmk.fm/v1/keyboard_list.json', (route) => {
        callCount++
        route.fulfill({ json: { keyboards: MOCK_KEYBOARDS, last_updated: '2026-01-01' } })
      })
      await page.goto('/')

      // First open: list loads from network
      await openQmkModal(page)
      await waitForList(page)
      await page.click(QMK_CANCEL_BTN)
      await expect(page.locator('.modal-title:text("Import from QMK")')).not.toBeVisible()

      // Second open: list served from cache, no new request
      await openQmkModal(page)
      await waitForList(page)

      expect(callCount).toBe(1)
    })
  })

  // --------------------------------------------------------
  // Group 5: Modal Dismissal
  // --------------------------------------------------------
  test.describe('Modal Dismissal', () => {
    test.beforeEach(async ({ page }) => {
      await mockKeyboardList(page)
      await page.goto('/')
      await openQmkModal(page)
    })

    test('TC-QMK-040 — Escape key closes the modal', async ({ page }) => {
      await page.keyboard.press('Escape')

      await expect(page.locator('.modal-title:text("Import from QMK")')).not.toBeVisible()
    })

    test('TC-QMK-041 — X button in the modal header closes the modal', async ({ page }) => {
      await page.click(QMK_X_BTN)

      await expect(page.locator('.modal-title:text("Import from QMK")')).not.toBeVisible()
    })

    test('TC-QMK-042 — Cancel button closes the modal', async ({ page }) => {
      await page.click(QMK_CANCEL_BTN)

      await expect(page.locator('.modal-title:text("Import from QMK")')).not.toBeVisible()
    })

    test('TC-QMK-043 — clicking the backdrop closes the modal', async ({ page }) => {
      // Click the top-left corner of the viewport — outside the centered modal dialog
      await page.mouse.click(5, 5)

      await expect(page.locator('.modal-title:text("Import from QMK")')).not.toBeVisible()
    })

    test('TC-QMK-044 — dismissing and reopening resets search and selection', async ({ page }) => {
      await waitForList(page)

      await page.fill('#qmkSearchInput', 'iris')
      await page.click('.qmk-keyboard-item:has-text("keebio/iris/rev6")')
      await expect(page.locator('.qmk-keyboard-item.selected')).toBeVisible()
      await page.click(QMK_CANCEL_BTN)

      // Reopen
      await openQmkModal(page)
      await waitForList(page)

      await expect(page.locator('#qmkSearchInput')).toHaveValue('')
      await expect(page.locator('.qmk-keyboard-item.selected')).toHaveCount(0)
      await expect(page.locator('.qmk-keyboard-item')).toHaveCount(5)
    })
  })

  // --------------------------------------------------------
  // Group 6: Error States
  // --------------------------------------------------------
  test.describe('Error States', () => {
    test('TC-QMK-050 — error alert shown when keyboard list fetch returns HTTP 500', async ({
      page,
    }) => {
      await page.route('https://keyboards.qmk.fm/v1/keyboard_list.json', (route) =>
        route.fulfill({ status: 500, body: 'Internal Server Error' }),
      )
      await page.goto('/')
      await openQmkModal(page)

      await expect(page.locator(QMK_ERROR)).toBeVisible({ timeout: 5000 })
      await expect(page.locator('.qmk-keyboard-list')).not.toBeVisible()
      await expect(page.locator(QMK_IMPORT_BTN)).toBeDisabled()
    })

    test('TC-QMK-051 — error alert shown when keyboard list request is aborted', async ({
      page,
    }) => {
      await page.route('https://keyboards.qmk.fm/v1/keyboard_list.json', (route) => route.abort())
      await page.goto('/')
      await openQmkModal(page)

      await expect(page.locator(QMK_ERROR)).toBeVisible({ timeout: 5000 })
    })

    test('TC-QMK-052 — error toast shown when info.json returns 404', async ({ page }) => {
      await mockKeyboardList(page)
      await page.route('https://keyboards.qmk.fm/v1/keyboards/ergodox_ez/info.json', (route) =>
        route.fulfill({ status: 404, body: 'Not Found' }),
      )
      await page.goto('/')
      await openQmkModal(page)
      await waitForList(page)

      await page.click('.qmk-keyboard-item:has-text("ergodox_ez")')
      await page.click(QMK_IMPORT_BTN)

      await expect(page.locator('.modal-title:text("Import from QMK")')).not.toBeVisible()
      await expect(page.locator(SELECTORS.TOAST.NOTIFICATION)).toBeVisible()
    })

    test('TC-QMK-053 — error toast shown when info.json is missing the keyboard key', async ({
      page,
    }) => {
      await mockKeyboardList(page)
      await page.route('https://keyboards.qmk.fm/v1/keyboards/ergodox_ez/info.json', (route) =>
        route.fulfill({ json: { keyboards: {} } }),
      )
      await page.goto('/')
      await openQmkModal(page)
      await waitForList(page)

      await page.click('.qmk-keyboard-item:has-text("ergodox_ez")')
      await page.click(QMK_IMPORT_BTN)

      await expect(page.locator('.modal-title:text("Import from QMK")')).not.toBeVisible()
      await expect(page.locator(SELECTORS.TOAST.NOTIFICATION)).toBeVisible()
    })
  })

  // --------------------------------------------------------
  // Group 7: Regression — From URL modal
  // --------------------------------------------------------
  test.describe('Regression — From URL modal', () => {
    test('TC-QMK-060 — From URL modal still opens, autofocuses, and closes with Escape', async ({
      page,
    }) => {
      await page.goto('/')

      await page.click(SELECTORS.IMPORT_EXPORT.IMPORT_BUTTON)
      await page.click('.dropdown-item:has-text("From URL")')

      await expect(page.locator(URL_MODAL)).toBeVisible()
      expect(await page.evaluate(() => document.activeElement?.id)).toBe('urlInput')
      await expect(page.locator(URL_IMPORT_BTN)).toBeDisabled()

      await page.fill('#urlInput', 'https://example.com/layout.json')
      await expect(page.locator(URL_IMPORT_BTN)).toBeEnabled()

      await page.keyboard.press('Escape')
      await expect(page.locator(URL_MODAL)).not.toBeVisible()
    })

    test('TC-QMK-061 — Escape closes each modal independently without interference', async ({
      page,
    }) => {
      await mockKeyboardList(page)
      await page.goto('/')

      // URL modal
      await page.click(SELECTORS.IMPORT_EXPORT.IMPORT_BUTTON)
      await page.click('.dropdown-item:has-text("From URL")')
      await expect(page.locator(URL_MODAL)).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.locator(URL_MODAL)).not.toBeVisible()

      // QMK modal
      await openQmkModal(page)
      await page.keyboard.press('Escape')
      await expect(page.locator('.modal-title:text("Import from QMK")')).not.toBeVisible()
    })

    test('TC-QMK-062 — only one modal is open at a time', async ({ page }) => {
      await mockKeyboardList(page)
      await page.goto('/')

      await page.click(SELECTORS.IMPORT_EXPORT.IMPORT_BUTTON)
      await page.click('.dropdown-item:has-text("From URL")')
      await expect(page.locator(URL_MODAL)).toBeVisible()
      await page.keyboard.press('Escape')

      await openQmkModal(page)

      await expect(page.locator('.modal-title:text("Import from QMK")')).toBeVisible()
      await expect(page.locator(URL_MODAL)).not.toBeVisible()
    })
  })

  // --------------------------------------------------------
  // Group 8: Edge Cases
  // --------------------------------------------------------
  test.describe('Edge Cases', () => {
    test.beforeEach(async ({ page }) => {
      await mockKeyboardList(page)
      await page.goto('/')
      await openQmkModal(page)
      await waitForList(page)
    })

    test('TC-QMK-070 — whitespace-only search query is treated as empty', async ({ page }) => {
      await page.fill('#qmkSearchInput', '   ')

      await expect(page.locator('.qmk-keyboard-item')).toHaveCount(5)
      await expect(page.locator(QMK_COUNT_HINT)).toContainText('5 keyboards available')
    })

    test('TC-QMK-071 — fuzzy search returns dactyl results for "dactyl 5x6"', async ({ page }) => {
      // "5x6" is not an exact substring, but "dactyl" is a strong match —
      // fuzzy search surfaces the dactyl boards regardless
      await page.fill('#qmkSearchInput', 'dactyl 5x6')

      await expect(page.locator('.qmk-keyboard-item:has-text("dactyl")').first()).toBeVisible()
    })
  })

  // --------------------------------------------------------
  // Group 8: Hover Preview
  // --------------------------------------------------------
  test.describe('Hover Preview', () => {
    const PREVIEW = SELECTORS.LAYOUT_PREVIEW

    /** Serves ergodox_ez info.json, counting hits and optionally stalling. */
    async function mockInfoJson(page: Page, options: { hold?: boolean } = {}) {
      const state = { calls: 0, release: null as null | (() => void) }
      await page.route(
        'https://keyboards.qmk.fm/v1/keyboards/ergodox_ez/info.json',
        async (route) => {
          state.calls++
          if (options.hold) {
            await new Promise<void>((resolve) => {
              state.release = resolve
            })
          }
          await route.fulfill({ json: ERGODOX_INFO })
        },
      )
      return state
    }

    test('TC-QMK-080 — preview pane shows an idle hint before anything is hovered', async ({
      page,
    }) => {
      await mockKeyboardList(page)
      await page.goto('/')
      await openQmkModal(page)
      await waitForList(page)

      await expect(page.locator(PREVIEW.PANE)).toBeVisible()
      await expect(page.locator(PREVIEW.IDLE)).toBeVisible()
    })

    test('TC-QMK-081 — hovering a result shows the loading bar, then the rendered preview', async ({
      page,
    }) => {
      await mockKeyboardList(page)
      const info = await mockInfoJson(page, { hold: true })
      await page.goto('/')
      await openQmkModal(page)
      await waitForList(page)

      await page.hover('.qmk-keyboard-item:has-text("ergodox_ez")')

      await expect(page.locator(PREVIEW.PROGRESS)).toBeVisible()
      await expect.poll(() => info.calls, { timeout: 5000 }).toBe(1)

      info.release!()

      await expect(page.locator(`${PREVIEW.PANE} canvas`)).toBeVisible()
      await expect(page.locator(PREVIEW.LOADING)).not.toBeVisible()
      await expect(page.locator(PREVIEW.PANE)).toContainText('ergodox_ez')
    })

    test('TC-QMK-082 — a failed preview reports inline without blocking the list', async ({
      page,
    }) => {
      await mockKeyboardList(page)
      await page.route('https://keyboards.qmk.fm/v1/keyboards/ergodox_ez/info.json', (route) =>
        route.fulfill({ status: 404, body: 'not found' }),
      )
      await page.goto('/')
      await openQmkModal(page)
      await waitForList(page)

      await page.hover('.qmk-keyboard-item:has-text("ergodox_ez")')

      await expect(page.locator(PREVIEW.ERROR)).toBeVisible()
      // The list is still usable and no toast was raised for a mere hover
      await expect(page.locator('.qmk-keyboard-list')).toBeVisible()
      await expect(page.locator(SELECTORS.TOAST.NOTIFICATION)).not.toBeVisible()
    })

    test('TC-QMK-083 — importing a previewed keyboard does not download it again', async ({
      page,
    }) => {
      await mockKeyboardList(page)
      const info = await mockInfoJson(page)
      await page.goto('/')
      await openQmkModal(page)
      await waitForList(page)

      await page.hover('.qmk-keyboard-item:has-text("ergodox_ez")')
      await expect(page.locator(`${PREVIEW.PANE} canvas`)).toBeVisible()
      expect(info.calls).toBe(1)

      await page.click('.qmk-keyboard-item:has-text("ergodox_ez")')
      await page.click(QMK_IMPORT_BTN)

      await expect(page.locator(SELECTORS.TOAST.TITLE)).toContainText('Import Successful')
      expect(info.calls).toBe(1)
    })

    test('TC-QMK-084 — moving to another result abandons the pending download', async ({
      page,
    }) => {
      await mockKeyboardList(page)
      const first = await mockInfoJson(page, { hold: true })

      // The envelope must be keyed by the requested name, as the real API is
      let secondCalls = 0
      const gherkinInfo = {
        keyboards: {
          '40percentclub/gherkin': {
            keyboard_name: 'Gherkin',
            layouts: ERGODOX_INFO.keyboards.ergodox_ez.layouts,
          },
        },
      }
      await page.route(
        'https://keyboards.qmk.fm/v1/keyboards/40percentclub/gherkin/info.json',
        (route) => {
          secondCalls++
          route.fulfill({ json: gherkinInfo })
        },
      )

      await page.goto('/')
      await openQmkModal(page)
      await waitForList(page)

      await page.hover('.qmk-keyboard-item:has-text("ergodox_ez")')
      await expect.poll(() => first.calls, { timeout: 5000 }).toBe(1)

      // Switch before the first request completes
      await page.hover('.qmk-keyboard-item:has-text("gherkin")')
      await expect.poll(() => secondCalls, { timeout: 5000 }).toBe(1)

      first.release!()

      // The pane settles on the second board, not the late first response
      await expect(page.locator(`${PREVIEW.PANE} canvas`)).toBeVisible()
      await expect(page.locator(PREVIEW.PANE)).toContainText('gherkin')
    })

    test('TC-QMK-085 — multi-layout keyboards expose a variant switcher', async ({ page }) => {
      await mockKeyboardList(page)
      await page.route('https://keyboards.qmk.fm/v1/keyboards/ergodox_ez/info.json', (route) =>
        route.fulfill({
          json: {
            keyboards: {
              ergodox_ez: {
                keyboard_name: 'ErgoDox EZ',
                layouts: {
                  LAYOUT_ansi: {
                    layout: [
                      { matrix: [0, 0], x: 0, y: 0 },
                      { matrix: [0, 1], x: 1, y: 0 },
                    ],
                  },
                  LAYOUT_iso: {
                    layout: [
                      { matrix: [0, 0], x: 0, y: 0 },
                      { matrix: [0, 2], x: 2, y: 0 },
                    ],
                  },
                },
              },
            },
          },
        }),
      )
      await page.goto('/')
      await openQmkModal(page)
      await waitForList(page)

      await page.hover('.qmk-keyboard-item:has-text("ergodox_ez")')
      await expect(page.locator(`${PREVIEW.PANE} canvas`)).toBeVisible()

      await expect(page.locator(PREVIEW.PANE)).toContainText('LAYOUT_ansi (1/2)')
      await page.click(PREVIEW.VARIANT_NEXT)
      await expect(page.locator(PREVIEW.PANE)).toContainText('LAYOUT_iso (2/2)')
      await page.click(PREVIEW.VARIANT_PREV)
      await expect(page.locator(PREVIEW.PANE)).toContainText('LAYOUT_ansi (1/2)')
    })

    test('TC-QMK-087 — selecting a result pins the preview against further hovering', async ({
      page,
    }) => {
      await mockKeyboardList(page)
      const ergodox = await mockInfoJson(page)

      let gherkinCalls = 0
      await page.route(
        'https://keyboards.qmk.fm/v1/keyboards/40percentclub/gherkin/info.json',
        (route) => {
          gherkinCalls++
          route.fulfill({
            json: { keyboards: { '40percentclub/gherkin': { keyboard_name: 'Gherkin' } } },
          })
        },
      )

      await page.goto('/')
      await openQmkModal(page)
      await waitForList(page)

      await page.click('.qmk-keyboard-item:has-text("ergodox_ez")')
      await expect(page.locator(`${PREVIEW.PANE} canvas`)).toBeVisible()
      await expect(page.locator(PREVIEW.PINNED)).toBeVisible()
      await expect(page.locator(PREVIEW.PANE)).toContainText('ergodox_ez')
      expect(ergodox.calls).toBe(1)

      // Sweeping over other results must neither swap the preview nor fetch
      await page.hover('.qmk-keyboard-item:has-text("gherkin")')
      await page.hover('.qmk-keyboard-item:has-text("iris")')
      await expect(page.locator(PREVIEW.PANE)).toContainText('ergodox_ez')
      expect(gherkinCalls).toBe(0)
    })

    test('TC-QMK-088 — clicking the selected result again deselects and unpins it', async ({
      page,
    }) => {
      await mockKeyboardList(page)
      await mockInfoJson(page)
      await page.route(
        'https://keyboards.qmk.fm/v1/keyboards/40percentclub/gherkin/info.json',
        (route) =>
          route.fulfill({
            json: {
              keyboards: {
                '40percentclub/gherkin': {
                  keyboard_name: 'Gherkin',
                  layouts: ERGODOX_INFO.keyboards.ergodox_ez.layouts,
                },
              },
            },
          }),
      )
      await page.goto('/')
      await openQmkModal(page)
      await waitForList(page)

      const row = page.locator('.qmk-keyboard-item:has-text("ergodox_ez")')

      await row.click()
      await expect(row).toHaveClass(/selected/)
      await expect(page.locator(QMK_IMPORT_BTN)).toBeEnabled()
      await expect(page.locator(PREVIEW.PINNED)).toBeVisible()

      await row.click()
      await expect(row).not.toHaveClass(/selected/)
      await expect(page.locator(QMK_IMPORT_BTN)).toBeDisabled()
      await expect(page.locator(PREVIEW.PINNED)).not.toBeVisible()

      // Hover previews resume once nothing is selected
      await page.hover('.qmk-keyboard-item:has-text("gherkin")')
      await expect(page.locator(PREVIEW.PANE)).toContainText('gherkin')
    })

    test('TC-QMK-086 — an empty query does not trigger speculative downloads', async ({ page }) => {
      const bigList = Array.from({ length: 200 }, (_, i) => `vendor/board_${i}`)
      await page.route('https://keyboards.qmk.fm/v1/keyboard_list.json', (route) =>
        route.fulfill({ json: { keyboards: bigList, last_updated: '2026-01-01' } }),
      )

      let infoCalls = 0
      await page.route('**/v1/keyboards/vendor/**/info.json', (route) => {
        infoCalls++
        route.fulfill({ json: ERGODOX_INFO })
      })

      await page.goto('/')
      await openQmkModal(page)
      await waitForList(page)
      await expect(page.locator(PREVIEW.IDLE)).toBeVisible()

      expect(infoCalls).toBe(0)
    })

    test('TC-QMK-089 — a tall layout is scaled to fit and never grows the modal', async ({
      page,
    }) => {
      // A deliberately tall board: 30 rows, far taller than the preview pane.
      // The canvas must be scaled down into the stage — the stage must not grow
      // to accommodate the canvas and drag the row and modal along with it.
      await mockKeyboardList(page)
      await page.route('https://keyboards.qmk.fm/v1/keyboards/ergodox_ez/info.json', (route) =>
        route.fulfill({
          json: {
            keyboards: {
              ergodox_ez: {
                keyboard_name: 'Tall',
                layouts: {
                  LAYOUT: {
                    layout: Array.from({ length: 30 }, (_, y) => ({ matrix: [y, 0], x: 0, y })),
                  },
                },
              },
            },
          },
        }),
      )

      await page.goto('/')
      await openQmkModal(page)
      await waitForList(page)

      const modal = page.locator(`${QMK_MODAL} .modal-content`)
      const stage = page.locator(`${PREVIEW.PANE} .preview-stage`)
      const before = (await modal.boundingBox())!.height

      await page.hover('.qmk-keyboard-item:has-text("ergodox_ez")')
      await expect(page.locator(`${PREVIEW.PANE} canvas`)).toBeVisible()

      // The modal is the same height it was before anything was previewed
      expect((await modal.boundingBox())!.height).toBeCloseTo(before, 0)

      // …and the canvas sits inside the stage's content box rather than
      // overflowing it (the stage is padded, so allow for that).
      const canvasBox = (await page.locator(`${PREVIEW.PANE} canvas`).boundingBox())!
      const stageBox = (await stage.boundingBox())!
      expect(canvasBox.height).toBeLessThanOrEqual(stageBox.height)
      expect(canvasBox.width).toBeLessThanOrEqual(stageBox.width)

      // The list keeps its fixed height — the row never stretched
      const listBox = (await page.locator('.qmk-keyboard-list').boundingBox())!
      expect(listBox.height).toBeCloseTo(360, 0)
    })
  })

  test.describe('Large list', () => {
    test('TC-QMK-072 — large keyboard list is constrained and scrollable', async ({ page }) => {
      const bigList = Array.from({ length: 500 }, (_, i) => `vendor/board_${i}`)
      await page.route('https://keyboards.qmk.fm/v1/keyboard_list.json', (route) =>
        route.fulfill({ json: { keyboards: bigList, last_updated: '2026-01-01' } }),
      )
      await page.goto('/')
      await openQmkModal(page)
      await waitForList(page)

      const overflowY = await page
        .locator('.qmk-keyboard-list')
        .evaluate((el) => getComputedStyle(el).overflowY)
      expect(['auto', 'scroll']).toContain(overflowY)

      const box = await page.locator('.qmk-keyboard-list').boundingBox()
      expect(box!.height).toBeLessThanOrEqual(380)

      await expect(page.locator(QMK_COUNT_HINT)).toContainText('500 keyboards available')
    })
  })
})
