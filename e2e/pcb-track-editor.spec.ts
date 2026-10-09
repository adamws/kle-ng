import { test, expect, type Page } from '@playwright/test'
import { KeyboardEditorPage } from './pages/KeyboardEditorPage'

// PCB generator track editor.
// B2: pan/zoom canvas with pads from the pad geometry JSON; no drawing yet.

const EDITOR = {
  COLLAPSE_BTN: '[data-section-id="pcb"] .collapse-btn',
  CANVAS: '[data-testid="pcb-preview-canvas"]',
  TOGGLE: '[data-testid="pcb-track-edit-toggle"]',
  PADS: '[data-testid="pcb-pad-layer"]',
  GRID: '[data-testid="pcb-grid-layer"]',
  STATUS: '[data-testid="pcb-editor-status"]',
  FIT: '[data-testid="pcb-zoom-fit"]',
}

async function padCentre(page: Page, owner: 'SW' | 'D', number: string) {
  const box = (await page
    .locator(`[data-layer="B.Cu"] [data-pad-key^="${owner}:"][data-pad-number="${number}"]`)
    .first()
    .boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function openPreview(page: Page) {
  // never reach a real backend
  await page.route('**/api/workers', (route) =>
    route.fulfill({
      json: {
        worker_processes: 1,
        total_capacity: 1,
        active_tasks: 0,
        idle_capacity: 1,
        workers: [],
      },
    }),
  )
  await page.route('**/api/pcb**', (route) => route.abort())

  await new KeyboardEditorPage(page).goto()
  const collapseBtn = page.locator(EDITOR.COLLAPSE_BTN)
  if ((await collapseBtn.getAttribute('aria-expanded')) === 'false') {
    await collapseBtn.click()
  }
  await expect(page.locator(EDITOR.CANVAS)).toBeVisible()
  // footprints loaded: the view doesn't move under the pointer any more
  await expect(page.locator('.footprint-preview .preview-overlay')).toHaveCount(0)
  await expect(page.locator(`${EDITOR.CANVAS} .footprint-svg circle`).first()).toBeAttached()
}

async function viewBoxWidth(page: Page): Promise<number> {
  const vb = await page.locator(`${EDITOR.CANVAS} svg.preview-svg`).getAttribute('viewBox')
  return Number(vb?.split(' ')[2])
}

test.describe('PCB Generator track editor', () => {
  test('shows pads from the pad JSON with a grid and cursor readout', async ({ page }) => {
    await openPreview(page)
    await expect(page.locator(EDITOR.PADS)).toHaveCount(0)

    await page.locator(EDITOR.TOGGLE).click()

    const pads = page.locator(EDITOR.PADS)
    await expect(pads).toBeVisible()
    await expect(page.locator(EDITOR.GRID)).toBeVisible()
    // default MX switch (2 pads, 3 holes) and SOD-123F diode on B.Cu
    await expect(pads.locator('[data-layer="B.Cu"] [data-pad-key^="SW:"]')).toHaveCount(2)
    await expect(pads.locator('[data-layer="F.Cu"] [data-pad-key^="D:"]')).toHaveCount(0)
    await expect(pads.locator('[data-layer="B.Cu"] [data-pad-key^="D:"]')).toHaveCount(2)
    await expect(pads.locator('.pad-holes .npth')).toHaveCount(3)

    // hovering SW pad 2 names it and reads out its centre in switch-local mm
    await pads.locator('[data-layer="B.Cu"] [data-pad-key^="SW:"][data-pad-number="2"]').hover()
    const status = page.locator(EDITOR.STATUS)
    await expect(status).toContainText('SW pad 2')
    await expect(status).toContainText('X 2.540 Y -5.080 mm')
  })

  test('shows the unrouted switch-diode connection', async ({ page }) => {
    await openPreview(page)
    await page.locator(EDITOR.TOGGLE).click()

    await expect(page.locator('[data-testid="pcb-ratsnest"][data-net="SW_D"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="pcb-drc-summary"]')).toHaveText('1 unrouted')
  })

  test('routes SW pad 2 to D pad 2 into the track preset', async ({ page }) => {
    await openPreview(page)
    await page.locator(EDITOR.TOGGLE).click()
    await page.locator('[data-testid="pcb-tool-route"]').click()

    const sw2 = await padCentre(page, 'SW', '2')
    const d2 = await padCentre(page, 'D', '2')
    await page.mouse.move(sw2.x, sw2.y)
    await page.mouse.click(sw2.x, sw2.y)
    await expect(page.locator('[data-testid="pcb-route-status"]')).toContainText('Routing SW_D')
    await page.mouse.move(d2.x, d2.y, { steps: 5 })
    await expect(page.locator('[data-testid="pcb-route-preview"]')).toHaveCount(2)
    await page.mouse.click(d2.x, d2.y)

    // finished on the pad: the default preset, DRC clean, nothing unrouted
    const tracks = page.locator('[data-testid="pcb-track-overlay-track"]')
    await expect(tracks).toHaveCount(2)
    await expect(page.locator('[data-testid="pcb-route-preview"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="pcb-ratsnest"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="pcb-drc-summary"]')).toHaveText('DRC clean')

    // the settings (persisted in the backend's wire format, nm) hold the drawn preset
    const saved = () =>
      page.evaluate(() => {
        const raw = localStorage.getItem('kle-ng-pcb-settings')
        return raw ? (JSON.parse(raw).tracks ?? null) : null
      })
    await expect.poll(saved).not.toBeNull()
    expect(await saved()).toEqual({
      version: 1,
      items: [
        {
          type: 'track',
          start: { x_nm: 2540000, y_nm: -5080000 },
          end: { x_nm: 2540000, y_nm: 60000 },
          width_nm: 250000,
          layer: 'B.Cu',
        },
        {
          type: 'track',
          start: { x_nm: 2540000, y_nm: 60000 },
          end: { x_nm: 5080000, y_nm: 2600000 },
          width_nm: 250000,
          layer: 'B.Cu',
        },
      ],
    })
  })

  test('refuses a click that breaks a rule and cancels with Esc', async ({ page }) => {
    await openPreview(page)
    await page.locator(EDITOR.TOGGLE).click()

    // X starts a route at the pad under the cursor
    const sw2 = await padCentre(page, 'SW', '2')
    await page.mouse.move(sw2.x, sw2.y)
    await page.keyboard.press('x')
    // onto the diode cathode (ROW): a short, the click is refused
    const d1 = await padCentre(page, 'D', '1')
    await page.mouse.move(d1.x, d1.y, { steps: 5 })
    await expect(page.locator('[data-testid="pcb-route-blocked"]')).toContainText('Short')
    await page.mouse.click(d1.x, d1.y)
    await expect(page.locator('[data-testid="pcb-route-committed"]')).toHaveCount(0)

    await page.keyboard.press('Escape')
    await expect(page.locator('[data-testid="pcb-route-status"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="pcb-track-overlay-track"]')).toHaveCount(0)
  })

  test('zooms at the cursor, pans and fits', async ({ page }) => {
    await openPreview(page)
    await page.locator(EDITOR.TOGGLE).click()
    const fitted = await viewBoxWidth(page)

    const box = (await page.locator(EDITOR.CANVAS).boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.wheel(0, -300)
    await expect.poll(() => viewBoxWidth(page)).toBeLessThan(fitted / 1.5)

    const svg = page.locator(`${EDITOR.CANVAS} svg.preview-svg`)
    const before = await svg.getAttribute('viewBox')
    await page.mouse.down({ button: 'middle' })
    await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2 - 40, { steps: 4 })
    await page.mouse.up({ button: 'middle' })
    const after = await svg.getAttribute('viewBox')
    expect(after).not.toBe(before)
    // panning keeps the zoom
    expect(Number(after!.split(' ')[2])).toBeCloseTo(Number(before!.split(' ')[2]), 6)

    await page.locator(EDITOR.FIT).click()
    await expect.poll(() => viewBoxWidth(page)).toBeCloseTo(fitted, 6)
  })

  test('is unavailable for a back-side switch', async ({ page }) => {
    await openPreview(page)
    await page.evaluate(() => {
      const pinia = (
        document.querySelector('#app') as Element & {
          __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, unknown> } } } }
        }
      ).__vue_app__.config.globalProperties.$pinia
      const store = pinia._s.get('pcbGenerator') as { settings: { switchSide: string } }
      store.settings.switchSide = 'BACK'
    })
    await expect(page.locator(EDITOR.TOGGLE)).toBeDisabled()
  })
})
