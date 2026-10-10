import { test, expect, type Page } from '@playwright/test'
import { KeyboardEditorPage } from './pages/KeyboardEditorPage'

// Draw, select and edit the switch-diode track preset over the pads from the pad
// geometry JSON (pan/zoom canvas, DRC, undo/redo, stale-preset banner).

const EDITOR = {
  COLLAPSE_BTN: '[data-section-id="pcb"] .collapse-btn',
  CANVAS: '[data-testid="pcb-preview-canvas"]',
  ROUTING: '[data-testid="pcb-routing-select"]',
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

/** A preset routing mode opens the track editor. */
async function enterPresetMode(page: Page) {
  await page.locator(EDITOR.ROUTING).selectOption('Full (preset)')
  await expect(page.locator(EDITOR.PADS)).toBeVisible()
  // the select sits below the preview; mouse actions need the canvas on screen
  await page.locator(EDITOR.CANVAS).scrollIntoViewIfNeeded()
}

async function viewBoxWidth(page: Page): Promise<number> {
  const vb = await page.locator(`${EDITOR.CANVAS} svg.preview-svg`).getAttribute('viewBox')
  return Number(vb?.split(' ')[2])
}

test.describe('PCB Generator track editor', () => {
  test('shows pads from the pad JSON with a grid and cursor readout', async ({ page }) => {
    await openPreview(page)
    await expect(page.locator(EDITOR.PADS)).toHaveCount(0)

    await enterPresetMode(page)

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
    // in every routing mode, it shows which switch pad the diode connects to
    await expect(page.locator('[data-testid="pcb-ratsnest"][data-net="SW_D"]')).toHaveCount(1)
    await enterPresetMode(page)

    await expect(page.locator('[data-testid="pcb-ratsnest"][data-net="SW_D"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="pcb-drc-summary"]')).toHaveText('1 unrouted')
  })

  test('routes SW pad 2 to D pad 2 into the track preset', async ({ page }) => {
    await openPreview(page)
    await enterPresetMode(page)
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
      // what the tracks were drawn for
      basis: {
        switchFootprint: 'Switch_Keyboard_Cherry_MX:SW_Cherry_MX_PCB_{:.2f}u',
        diodeFootprint: 'Diode_SMD:D_SOD-123F',
        diodePositionX: 5.08,
        diodePositionY: 4,
        diodeRotation: 90,
        diodeSide: 'BACK',
      },
    })
  })

  test('offers to keep or clear tracks drawn for another diode placement', async ({ page }) => {
    await openPreview(page)
    await enterPresetMode(page)
    await page.locator('[data-testid="pcb-tool-route"]').click()
    const sw2 = await padCentre(page, 'SW', '2')
    const d2 = await padCentre(page, 'D', '2')
    await page.mouse.click(sw2.x, sw2.y)
    await page.mouse.move(d2.x, d2.y, { steps: 5 })
    await page.mouse.click(d2.x, d2.y)
    const tracks = page.locator('[data-testid="pcb-track-overlay-track"]')
    await expect(tracks).toHaveCount(2)

    const banner = page.locator('[data-testid="pcb-stale-preset"]')
    await expect(banner).toHaveCount(0)
    const diodeY = page.locator('#diodePositionY input')
    await diodeY.fill('5')
    await diodeY.press('Enter')
    await expect(banner).toHaveText(
      'Diode position changed since the tracks were drawn (5.08, 4 mm → 5.08, 5 mm) Keep Clear',
    )
    await page.locator('[data-testid="pcb-stale-keep"]').click()
    await expect(banner).toHaveCount(0)
    await expect(tracks).toHaveCount(2)

    await diodeY.fill('4')
    await diodeY.press('Enter')
    await expect(banner).toBeVisible()
    await page.locator('[data-testid="pcb-stale-clear"]').click()
    await expect(banner).toHaveCount(0)
    await expect(tracks).toHaveCount(0)
    await expect(page.locator('[data-testid="pcb-ratsnest"]')).toHaveCount(1)
  })

  test('drags a track sideways, Esc cancels a drag', async ({ page }) => {
    await openPreview(page)
    await enterPresetMode(page)
    const tracks = page.locator('[data-testid="pcb-track-overlay-track"]')
    await page.locator('[data-testid="pcb-tool-route"]').click()
    const sw2 = await padCentre(page, 'SW', '2')
    const d2 = await padCentre(page, 'D', '2')
    await page.mouse.click(sw2.x, sw2.y)
    await page.mouse.move(d2.x, d2.y, { steps: 5 })
    await page.mouse.click(d2.x, d2.y)
    await expect(tracks).toHaveCount(2)
    await page.locator('[data-testid="pcb-tool-select"]').click()

    // grab the vertical track halfway and pull it right: the pad end stays,
    // joined by a new 45° track, the corner slides along the diagonal
    const v = (await tracks.nth(0).boundingBox())!
    const grab = { x: v.x + v.width / 2, y: v.y + v.height / 2 }
    await page.mouse.move(grab.x, grab.y)
    await expect(page.locator(EDITOR.CANVAS)).toHaveClass(/drag-hover/)
    await page.mouse.down()
    await page.mouse.move(grab.x + 10, grab.y, { steps: 4 })
    await page.mouse.move(grab.x + 20, grab.y, { steps: 4 })
    await expect(tracks).toHaveCount(3)
    await page.mouse.up()
    await expect(tracks).toHaveCount(3)
    await expect(page.locator('[data-testid="pcb-drc-summary"]')).toHaveText('DRC clean')
    // a drag is not a click: nothing got selected
    await expect(page.locator('[data-testid="pcb-selection-bar"]')).toHaveCount(0)

    await page.keyboard.press('Control+Z')
    await expect(tracks).toHaveCount(2)

    // the drag follows into the side hole's clearance; released there, the
    // track goes back to the last legal position
    await page.mouse.move(grab.x, grab.y)
    await page.mouse.down()
    await page.mouse.move(grab.x + 10, grab.y, { steps: 4 })
    await page.mouse.move(grab.x + 40, grab.y, { steps: 6 })
    await expect(page.locator('[data-testid="pcb-drag-blocked"]')).toContainText('Hole clearance')
    await page.mouse.up()
    await expect(page.locator('[data-testid="pcb-drag-blocked"]')).toHaveCount(0)
    await expect(tracks).toHaveCount(3)
    await expect(page.locator('[data-testid="pcb-drc-summary"]')).toHaveText('DRC clean')
    await page.keyboard.press('Control+Z')
    await expect(tracks).toHaveCount(2)

    // Esc while dragging puts the track back
    await page.mouse.move(grab.x, grab.y)
    await page.mouse.down()
    await page.mouse.move(grab.x + 20, grab.y, { steps: 6 })
    await expect(tracks).toHaveCount(3)
    await page.keyboard.press('Escape')
    await expect(tracks).toHaveCount(2)
    await page.mouse.move(grab.x + 30, grab.y, { steps: 3 })
    await page.mouse.up()
    await expect(tracks).toHaveCount(2)
  })

  test('selects, deletes, undoes and redoes tracks', async ({ page }) => {
    await openPreview(page)
    await enterPresetMode(page)
    const tracks = page.locator('[data-testid="pcb-track-overlay-track"]')

    // draw the default preset
    await page.locator('[data-testid="pcb-tool-route"]').click()
    const sw2 = await padCentre(page, 'SW', '2')
    const d2 = await padCentre(page, 'D', '2')
    await page.mouse.move(sw2.x, sw2.y)
    await page.mouse.click(sw2.x, sw2.y)
    await page.mouse.move(d2.x, d2.y, { steps: 5 })
    await page.mouse.click(d2.x, d2.y)
    await expect(tracks).toHaveCount(2)

    // undo removes the whole route, redo brings it back
    await page.locator('[data-testid="pcb-undo"]').click()
    await expect(tracks).toHaveCount(0)
    await page.keyboard.press('Control+Shift+Z')
    await expect(tracks).toHaveCount(2)

    // click the vertical track to select it, U adds the connected one
    await page.locator('[data-testid="pcb-tool-select"]').click()
    const vertical = (await tracks.nth(0).boundingBox())!
    await page.mouse.click(vertical.x + vertical.width / 2, vertical.y + vertical.height / 2)
    await expect(page.locator('[data-testid="pcb-selection-count"]')).toHaveText('1 track selected')
    await page.keyboard.press('u')
    await expect(page.locator('[data-testid="pcb-selection-count"]')).toHaveText(
      '2 tracks selected',
    )

    // width of the selection
    const width = page.locator('[data-testid="pcb-selection-width"] input')
    await width.fill('0.4')
    await width.press('Enter')
    await expect(tracks.nth(0)).toHaveAttribute('stroke-width', '0.4')
    await expect(tracks.nth(1)).toHaveAttribute('stroke-width', '0.4')

    // delete, then undo the delete
    await page.locator('[data-testid="pcb-preview-canvas"]').focus()
    await page.keyboard.press('Delete')
    await expect(tracks).toHaveCount(0)
    await page.keyboard.press('Control+z')
    await expect(tracks).toHaveCount(2)
  })

  test('selects tracks with a box', async ({ page }) => {
    await openPreview(page)
    await enterPresetMode(page)
    await page.locator('[data-testid="pcb-tool-route"]').click()
    const sw2 = await padCentre(page, 'SW', '2')
    const d2 = await padCentre(page, 'D', '2')
    await page.mouse.move(sw2.x, sw2.y)
    await page.mouse.click(sw2.x, sw2.y)
    await page.mouse.move(d2.x, d2.y, { steps: 5 })
    await page.mouse.click(d2.x, d2.y)
    await page.locator('[data-testid="pcb-tool-select"]').click()

    // left to right around everything: both tracks
    const canvas = (await page.locator(EDITOR.CANVAS).boundingBox())!
    await page.mouse.move(canvas.x + 20, canvas.y + 60)
    await page.mouse.down()
    await page.mouse.move(canvas.x + canvas.width - 20, canvas.y + canvas.height - 20, {
      steps: 5,
    })
    await expect(page.locator('[data-testid="pcb-selection-box"]')).toBeVisible()
    await page.mouse.up()
    await expect(page.locator('[data-testid="pcb-selection-box"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="pcb-selection-count"]')).toHaveText(
      '2 tracks selected',
    )
  })

  test('refuses a click that breaks a rule and cancels with Esc', async ({ page }) => {
    await openPreview(page)
    await enterPresetMode(page)

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
    await enterPresetMode(page)
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
    await expect(page.locator(`${EDITOR.ROUTING} option[value="Full (preset)"]`)).toBeDisabled()
  })

  test('confirms before leaving a preset mode with drawn tracks', async ({ page }) => {
    await openPreview(page)
    await enterPresetMode(page)
    await page.locator('[data-testid="pcb-tool-route"]').click()
    const sw2 = await padCentre(page, 'SW', '2')
    const d2 = await padCentre(page, 'D', '2')
    await page.mouse.click(sw2.x, sw2.y)
    await page.mouse.move(d2.x, d2.y, { steps: 5 })
    await page.mouse.click(d2.x, d2.y)
    const tracks = page.locator('[data-testid="pcb-track-overlay-track"]')
    await expect(tracks).toHaveCount(2)

    // between preset modes the tracks stay
    const routing = page.locator(EDITOR.ROUTING)
    await routing.selectOption('Switch-Diode only (preset)')
    await expect(tracks).toHaveCount(2)

    const dialog = page.locator('[data-testid="pcb-routing-confirm"]')
    await routing.selectOption('Full')
    await expect(dialog).toContainText('2 drawn items')
    await page.locator('[data-testid="pcb-routing-confirm-cancel"]').click()
    await expect(dialog).toHaveCount(0)
    await expect(routing).toHaveValue('Switch-Diode only (preset)')
    await expect(tracks).toHaveCount(2)

    await routing.selectOption('Full')
    await page.locator('[data-testid="pcb-routing-confirm-ok"]').click()
    await expect(routing).toHaveValue('Full')
    await expect(page.locator(EDITOR.PADS)).toHaveCount(0)
    await expect(tracks).toHaveCount(0)
    await expect(page.locator('[data-testid="pcb-ratsnest"]')).toHaveCount(1)
  })
})
