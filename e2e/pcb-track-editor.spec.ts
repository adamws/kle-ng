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
  READOUT: '[data-testid="pcb-readout"]',
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
  await waitForView(page)
}

/**
 * Footprints and pads loaded and the view fitted to them: it doesn't move
 * under the pointer any more. Needed after every footprint change.
 */
async function waitForView(page: Page) {
  await expect(page.locator(`${EDITOR.CANVAS}[data-ready]`)).toBeAttached()
}

/** A preset routing mode opens the track editor. */
async function enterPresetMode(page: Page) {
  await page.locator(EDITOR.ROUTING).selectOption('Full (preset)')
  await expect(page.locator(EDITOR.PADS)).toBeVisible()
  // the select sits below the preview
  await centreCanvas(page)
}

/** Mouse actions need the whole canvas on screen. */
async function centreCanvas(page: Page) {
  await page
    .locator(EDITOR.CANVAS)
    .evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
}

/**
 * Picks a toolbar tool. Firefox scrolls the button towards the middle of the
 * viewport even when it's in view, which pushes the canvas's bottom off screen.
 */
async function useTool(page: Page, tool: 'select' | 'route' | 'via') {
  await page.locator(`[data-testid="pcb-tool-${tool}"]`).click()
  await centreCanvas(page)
}

/** Screen position of a point in the preview's board axes (the switch-local frame at 0°). */
async function svgToScreen(page: Page, x: number, y: number) {
  return page.locator(`${EDITOR.CANVAS} svg.preview-svg`).evaluate(
    (svg, p) => {
      const m = (svg as SVGSVGElement).getScreenCTM()!
      return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f }
    },
    { x, y },
  )
}

const diodeX = (page: Page) => page.locator('#diodePositionX input')
const diodeY = (page: Page) => page.locator('#diodePositionY input')
const diodeRotation = (page: Page) => page.locator('#diodeRotation')
const partReadout = (page: Page) => page.locator('[data-testid="pcb-part-readout"]')
const partSelection = (page: Page) => page.locator('[data-testid="pcb-part-selection"]')

async function viewBoxWidth(page: Page): Promise<number> {
  const vb = await page.locator(`${EDITOR.CANVAS} svg.preview-svg`).getAttribute('viewBox')
  return Number(vb?.split(' ')[2])
}

test.describe('PCB Generator track editor', () => {
  test('shows pads from the pad JSON with a grid and cursor readout', async ({ page }) => {
    await openPreview(page)
    // the preview draws the same pads; the editor only adds its tools
    await expect(page.locator(EDITOR.PADS)).toBeVisible()
    await expect(page.locator('[data-testid="pcb-tool-route"]')).toHaveCount(0)

    await enterPresetMode(page)
    await expect(page.locator('[data-testid="pcb-tool-route"]')).toBeVisible()

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
    const status = page.locator(EDITOR.READOUT)
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
    // the default back-side diode is clear of the switch's front courtyard
    await expect(page.locator('[data-testid="pcb-courtyard-warning"]')).toHaveCount(0)
  })

  test('routes SW pad 2 to D pad 2 into the track preset', async ({ page }) => {
    await openPreview(page)
    await enterPresetMode(page)
    await useTool(page, 'route')

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

    // the settings (persisted in the backend's wire format, nm) hold the drawn preset;
    // saving is debounced and entering the preset mode already saved an empty one
    const saved = () =>
      page.evaluate(() => {
        const raw = localStorage.getItem('kle-ng-pcb-settings')
        return raw ? (JSON.parse(raw).tracks ?? null) : null
      })
    await expect.poll(saved).toEqual({
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
    await useTool(page, 'route')
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

  test('puts the diode on the front side', async ({ page }) => {
    await openPreview(page)
    await enterPresetMode(page)
    await useTool(page, 'route')
    const sw2 = await padCentre(page, 'SW', '2')
    const d2 = await padCentre(page, 'D', '2')
    await page.mouse.click(sw2.x, sw2.y)
    await page.mouse.move(d2.x, d2.y, { steps: 5 })
    await page.mouse.click(d2.x, d2.y)
    await expect(page.locator('[data-testid="pcb-track-overlay-track"]')).toHaveCount(2)

    // the side sits next to the rotation; the preview loads the front SVG
    const frontSvg = page.waitForResponse((r) => r.url().endsWith('/front/D_SOD-123F.svg'))
    await page.locator('#diodeSide').selectOption('FRONT')
    await frontSvg
    await waitForView(page)
    // the SMD pads move to F.Cu, and the drawn B.Cu tracks no longer fit
    const pads = page.locator(EDITOR.PADS)
    await expect(pads.locator('[data-layer="F.Cu"] [data-pad-key^="D:"]')).toHaveCount(2)
    await expect(pads.locator('[data-layer="B.Cu"] [data-pad-key^="D:"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="pcb-stale-preset"]')).toContainText(
      'Diode side changed since the tracks were drawn',
    )
    // on the front it sits under the switch: both courtyards are outlined
    await expect(page.locator('[data-testid="pcb-courtyard-warning"]')).toContainText(
      'Switch and diode courtyards overlap (front)',
    )
    await expect(page.locator('[data-testid="pcb-courtyard-outline"]')).toHaveCount(2)

    // saved with the other settings (debounced), so a reload keeps it
    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = localStorage.getItem('kle-ng-pcb-settings')
          return raw ? JSON.parse(raw).diode?.side : null
        }),
      )
      .toBe('FRONT')
    await page.reload()
    await expect(page.locator('#diodeSide')).toHaveValue('FRONT')
  })

  test('routes to a through-hole diode, positioned by pin 1', async ({ page }) => {
    await openPreview(page)
    await page.locator('#diodeFootprint').selectOption('Diode_THT:D_DO-35_SOD27_P7.62mm_Horizontal')
    await waitForView(page)
    // at the SMD default its leads come through under the switch housing
    const warning = page.locator('[data-testid="pcb-courtyard-warning"]')
    await expect(warning).toContainText('Diode hole is inside the switch courtyard (front)')
    // beside the switch, turned 90°: pin 1 (K) at (8.89, 3.81), pin 2 (A) at (8.89, -3.81)
    for (const [id, value] of [
      ['diodePositionX', '8.89'],
      ['diodePositionY', '3.81'],
    ]) {
      await page.locator(`#${id} input`).fill(value!)
      await page.locator(`#${id} input`).press('Enter')
    }
    await expect(warning).toHaveCount(0)

    await enterPresetMode(page)
    // through-hole pads are on both copper layers
    const pads = page.locator(EDITOR.PADS)
    await expect(pads.locator('[data-layer="F.Cu"] [data-pad-key^="D:"]')).toHaveCount(2)
    await expect(pads.locator('[data-layer="B.Cu"] [data-pad-key^="D:"]')).toHaveCount(2)

    await useTool(page, 'route')
    const sw2 = await padCentre(page, 'SW', '2')
    const d2 = await padCentre(page, 'D', '2')
    await page.mouse.move(sw2.x, sw2.y)
    await page.mouse.click(sw2.x, sw2.y)
    await page.mouse.move(d2.x, d2.y, { steps: 5 })
    await page.mouse.click(d2.x, d2.y)
    await expect(page.locator('[data-testid="pcb-track-overlay-track"]')).toHaveCount(2)
    await expect(page.locator('[data-testid="pcb-drc-summary"]')).toHaveText('DRC clean')

    // the settings (what the JSON tab shows and Generate sends) name the KiCad 9 footprint
    await expect
      .poll(() =>
        page.evaluate(() => JSON.parse(localStorage.getItem('kle-ng-pcb-settings') ?? '{}').diode),
      )
      .toMatchObject({
        footprint: 'Diode_THT:D_DO-35_SOD27_P7.62mm_Horizontal',
        offsetX: 8.89,
        offsetY: 3.81,
        rotation: 90,
      })
  })

  test('zoom to fit centres a through-hole diode beside the switch', async ({ page }) => {
    await openPreview(page)
    // pin 1 is the footprint origin, so the SVG page is twice the body's length
    await page.locator('#diodeFootprint').selectOption('Diode_THT:D_DO-35_SOD27_P7.62mm_Horizontal')
    await waitForView(page)
    for (const [id, value] of [
      ['diodePositionX', '8.89'],
      ['diodePositionY', '3.81'],
    ]) {
      await page.locator(`#${id} input`).fill(value!)
      await page.locator(`#${id} input`).press('Enter')
    }
    await enterPresetMode(page)
    await page.locator(EDITOR.FIT).click()
    await centreCanvas(page)

    // the drawn footprints sit in the middle of the canvas
    const canvas = (await page.locator(`${EDITOR.CANVAS} svg.preview-svg`).boundingBox())!
    const drawn = await page.locator(`${EDITOR.CANVAS} .footprint-svg`).evaluateAll((groups) => {
      const rects = groups.map((g) => g.getBoundingClientRect())
      return {
        x0: Math.min(...rects.map((r) => r.left)),
        y0: Math.min(...rects.map((r) => r.top)),
        x1: Math.max(...rects.map((r) => r.right)),
        y1: Math.max(...rects.map((r) => r.bottom)),
      }
    })
    const tolerance = 0.02 * Math.min(canvas.width, canvas.height)
    expect(Math.abs((drawn.x0 + drawn.x1) / 2 - (canvas.x + canvas.width / 2))).toBeLessThan(
      tolerance,
    )
    expect(Math.abs((drawn.y0 + drawn.y1) / 2 - (canvas.y + canvas.height / 2))).toBeLessThan(
      tolerance,
    )
  })

  test('drags a track sideways, Esc cancels a drag', async ({ page }) => {
    await openPreview(page)
    await enterPresetMode(page)
    const tracks = page.locator('[data-testid="pcb-track-overlay-track"]')
    await useTool(page, 'route')
    const sw2 = await padCentre(page, 'SW', '2')
    const d2 = await padCentre(page, 'D', '2')
    await page.mouse.click(sw2.x, sw2.y)
    await page.mouse.move(d2.x, d2.y, { steps: 5 })
    await page.mouse.click(d2.x, d2.y)
    await expect(tracks).toHaveCount(2)
    await useTool(page, 'select')

    // screen px per mm: SW pad 2 (2.54, -5.08) to D pad 2 (5.08, 2.6) is 7.68 mm down
    const mm = (n: number) => (n * (d2.y - sw2.y)) / 7.68

    // grab the vertical track halfway and pull it right: the pad end stays,
    // joined by a new 45° track, the corner slides along the diagonal
    const v = (await tracks.nth(0).boundingBox())!
    const grab = { x: v.x + v.width / 2, y: v.y + v.height / 2 }
    await page.mouse.move(grab.x, grab.y)
    await expect(page.locator(EDITOR.CANVAS)).toHaveClass(/drag-hover/)
    await page.mouse.down()
    await page.mouse.move(grab.x + mm(0.4), grab.y, { steps: 4 })
    await page.mouse.move(grab.x + mm(0.8), grab.y, { steps: 4 })
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
    await page.mouse.move(grab.x + mm(0.4), grab.y, { steps: 4 })
    await page.mouse.move(grab.x + mm(1.6), grab.y, { steps: 6 })
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
    await page.mouse.move(grab.x + mm(0.8), grab.y, { steps: 6 })
    await expect(tracks).toHaveCount(3)
    await page.keyboard.press('Escape')
    await expect(tracks).toHaveCount(2)
    await page.mouse.move(grab.x + mm(1.2), grab.y, { steps: 3 })
    await page.mouse.up()
    await expect(tracks).toHaveCount(2)
  })

  test('selects, deletes, undoes and redoes tracks', async ({ page }) => {
    await openPreview(page)
    await enterPresetMode(page)
    const tracks = page.locator('[data-testid="pcb-track-overlay-track"]')

    // draw the default preset
    await useTool(page, 'route')
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
    await useTool(page, 'select')
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
    await useTool(page, 'route')
    const sw2 = await padCentre(page, 'SW', '2')
    const d2 = await padCentre(page, 'D', '2')
    await page.mouse.move(sw2.x, sw2.y)
    await page.mouse.click(sw2.x, sw2.y)
    await page.mouse.move(d2.x, d2.y, { steps: 5 })
    await page.mouse.click(d2.x, d2.y)
    await useTool(page, 'select')

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
    await useTool(page, 'route')
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
    await expect(page.locator('[data-testid="pcb-tool-route"]')).toHaveCount(0)
    await expect(tracks).toHaveCount(0)
    await expect(page.locator('[data-testid="pcb-ratsnest"]')).toHaveCount(1)
  })

  test('keeps the canvas and the drawing in place while editing', async ({ page }) => {
    // tall enough for the canvas to fill the card instead of the screen
    await page.setViewportSize({ width: 1280, height: 1100 })
    await openPreview(page)
    const canvas = page.locator(EDITOR.CANVAS)
    await canvas.scrollIntoViewIfNeeded()
    // relative to the PCB panel: selecting the routing option may scroll the page
    const panel = page.locator('.pcb-generator-panel')
    const top = async () =>
      Math.round((await canvas.boundingBox())!.y - (await panel.boundingBox())!.y)
    const before = await top()

    await enterPresetMode(page)
    expect(await top()).toBe(before)
    // the canvas fills the results card, down to its bottom edge
    const card = (await page.locator('.pcb-generator-panel .results-card').boundingBox())!
    const c = (await canvas.boundingBox())!
    expect(card.y + card.height - (c.y + c.height)).toBeLessThan(60)

    // the settings column changes height while editing (the "No tracks drawn"
    // warning goes away), the canvas follows it, the drawing stays put
    const sw2 = await padCentre(page, 'SW', '2')
    const d2 = await padCentre(page, 'D', '2')
    await useTool(page, 'route')
    await page.mouse.click(sw2.x, sw2.y)
    await expect(page.locator('[data-testid="pcb-route-status"]')).toBeVisible()
    await page.mouse.move(d2.x, d2.y, { steps: 5 })
    await page.mouse.click(d2.x, d2.y)
    await expect(page.locator('[data-testid="pcb-track-preset-empty"]')).toHaveCount(0)

    // a selection opens its panel over the canvas
    await useTool(page, 'select')
    const track = page.locator('[data-testid="pcb-track-overlay-track"]').first()
    const t = (await track.boundingBox())!
    await page.mouse.click(t.x + t.width / 2, t.y + t.height / 2)
    await expect(page.locator('[data-testid="pcb-selection-bar"]')).toBeVisible()

    expect(await top()).toBe(before)
    // relative to the canvas: a shorter page may scroll everything together
    const now = (await canvas.boundingBox())!
    const after = await padCentre(page, 'SW', '2')
    expect(Math.abs(after.x - now.x - (sw2.x - c.x))).toBeLessThan(0.5)
    expect(Math.abs(after.y - now.y - (sw2.y - c.y))).toBeLessThan(0.5)
  })

  test('selects connected tracks, hides layers and clears all', async ({ page }) => {
    await openPreview(page)
    await enterPresetMode(page)
    const tracks = page.locator('[data-testid="pcb-track-overlay-track"]')
    const count = page.locator('[data-testid="pcb-selection-count"]')
    await useTool(page, 'route')
    const sw2 = await padCentre(page, 'SW', '2')
    const d2 = await padCentre(page, 'D', '2')
    await page.mouse.click(sw2.x, sw2.y)
    await page.mouse.move(d2.x, d2.y, { steps: 5 })
    await page.mouse.click(d2.x, d2.y)
    await expect(tracks).toHaveCount(2)

    // the track a click would select is highlighted; double-click takes all connected
    await useTool(page, 'select')
    const vertical = (await tracks.nth(0).boundingBox())!
    const onVertical = { x: vertical.x + vertical.width / 2, y: vertical.y + vertical.height / 2 }
    await page.mouse.move(onVertical.x, onVertical.y)
    await expect(page.locator('[data-testid="pcb-track-hover"]')).toHaveCount(1)
    await page.mouse.dblclick(onVertical.x, onVertical.y)
    await expect(count).toHaveText('2 tracks selected')

    // hiding B.Cu hides its tracks and drops them from the selection
    await page.locator('[data-testid="pcb-layer-toggle-B.Cu"]').click()
    await expect(tracks).toHaveCount(0)
    await expect(count).toHaveCount(0)
    await page.locator(EDITOR.CANVAS).focus()
    await page.keyboard.press('Control+a')
    await expect(count).toHaveCount(0)
    await page.locator('[data-testid="pcb-layer-toggle-B.Cu"]').click()
    await expect(tracks).toHaveCount(2)
    await page.locator(EDITOR.CANVAS).focus()
    await page.keyboard.press('Control+a')
    await expect(count).toHaveText('2 tracks selected')

    // Clear removes everything as one undo step
    await page.locator('[data-testid="pcb-clear-tracks"]').click()
    await expect(tracks).toHaveCount(0)
    await expect(page.locator('[data-testid="pcb-clear-tracks"]')).toBeDisabled()
    await page.locator('[data-testid="pcb-undo"]').click()
    await expect(tracks).toHaveCount(2)
  })

  test('places a via with V and finishes on the other layer', async ({ page }) => {
    await openPreview(page)
    await enterPresetMode(page)
    await useTool(page, 'route')
    const sw2 = await padCentre(page, 'SW', '2')
    const d2 = await padCentre(page, 'D', '2')
    // screen px per mm: SW pad 2 (2.54, -5.08) to D pad 2 (5.08, 2.6) is 7.68 mm down
    const scale = (d2.y - sw2.y) / 7.68

    await page.mouse.click(d2.x, d2.y)
    await page.mouse.move(d2.x - 1.58 * scale, d2.y, { steps: 5 })
    // while routing the via tool is off: V places the via at the cursor
    await expect(page.locator('[data-testid="pcb-tool-via"]')).toBeDisabled()
    await page.keyboard.press('v')
    await expect(page.locator('[data-testid="pcb-route-via"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="pcb-route-status"]')).toContainText('on F.Cu')

    await page.mouse.move(sw2.x, sw2.y, { steps: 5 })
    await page.mouse.click(sw2.x, sw2.y)
    await expect(page.locator('[data-testid="pcb-route-status"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="pcb-track-overlay-via"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="pcb-drc-summary"]')).toHaveText('DRC clean')

    const savedTypes = () =>
      page.evaluate(() => {
        const raw = localStorage.getItem('kle-ng-pcb-settings')
        const items: { type: string; layer?: string }[] = raw ? JSON.parse(raw).tracks?.items : []
        return items.map((i) => i.layer ?? i.type)
      })
    await expect.poll(savedTypes).toContain('via')
    const types = await savedTypes()
    // chain order: B.Cu tracks from the diode, the via, F.Cu tracks to the switch
    expect(types.indexOf('via')).toBeGreaterThan(types.indexOf('B.Cu'))
    expect(types.lastIndexOf('B.Cu')).toBeLessThan(types.indexOf('via'))
    expect(types.indexOf('F.Cu')).toBeGreaterThan(types.indexOf('via'))
  })

  test('edits and drags a via with its tracks', async ({ page }) => {
    await openPreview(page)
    await enterPresetMode(page)
    await useTool(page, 'route')
    const sw2 = await padCentre(page, 'SW', '2')
    const d2 = await padCentre(page, 'D', '2')
    const scale = (d2.y - sw2.y) / 7.68 // screen px per mm
    await page.mouse.click(d2.x, d2.y)
    await page.mouse.move(d2.x - 1.58 * scale, d2.y, { steps: 5 })
    await page.keyboard.press('v')
    await page.mouse.move(sw2.x, sw2.y, { steps: 5 })
    await page.mouse.click(sw2.x, sw2.y)
    await useTool(page, 'select')

    const via = page.locator('[data-testid="pcb-track-overlay-via"]')
    const viaCircle = via.locator('circle.via')
    const centre = async () => {
      const b = (await viaCircle.boundingBox())!
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
    }

    // select it: size fields
    let c = await centre()
    await page.mouse.click(c.x, c.y)
    await expect(page.locator('[data-testid="pcb-selection-count"]')).toHaveText('1 via selected')
    const diameter = page.locator('[data-testid="pcb-selection-via-diameter"] input')
    await expect(diameter).toHaveValue('0.6')
    await diameter.fill('0.8')
    await diameter.press('Enter')
    await expect(viaCircle).toHaveAttribute('r', '0.4')
    // drag it up by 1 mm: the tracks on both layers follow
    c = await centre()
    await page.mouse.move(c.x, c.y)
    await page.mouse.down()
    await page.mouse.move(c.x, c.y - scale, { steps: 8 })
    await page.mouse.up()
    await expect(page.locator('[data-testid="pcb-drc-summary"]')).toHaveText('DRC clean')
    const moved = await centre()
    expect(moved.y).toBeLessThan(c.y - scale / 2)
    // the settings are saved after a short debounce
    const tracksAtVia = () =>
      page.evaluate(() => {
        const raw = localStorage.getItem('kle-ng-pcb-settings')
        type V = { x_nm: number; y_nm: number }
        const items: { type: string; start?: V; end?: V; position?: V }[] = raw
          ? (JSON.parse(raw).tracks?.items ?? [])
          : []
        const p = items.find((i) => i.type === 'via')?.position
        if (!p) return raw
        const at = (q?: V) => !!q && q.x_nm === p.x_nm && q.y_nm === p.y_nm
        return items.filter((i) => i.type === 'track' && (at(i.start) || at(i.end))).length
      })
    await expect.poll(tracksAtVia).toBe(2)

    await page.locator('[data-testid="pcb-undo"]').click()
    // screen positions only compare with the canvas back where it was
    await centreCanvas(page)
    const back = await centre()
    expect(Math.abs(back.y - c.y)).toBeLessThan(1)
  })

  test('shows the hovered pad the same way in every routing mode', async ({ page }) => {
    await openPreview(page)
    const canvas = page.locator(EDITOR.CANVAS)
    await canvas.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
    // board point (mm, switch at 0°) to screen
    const toScreen = (x: number, y: number) =>
      page.evaluate(
        ([x, y]) => {
          const svg = document.querySelector<SVGSVGElement>(
            '[data-testid="pcb-preview-canvas"] svg.preview-svg',
          )!
          const m = svg.getScreenCTM()!
          return { x: m.a * x! + m.c * y! + m.e, y: m.b * x! + m.d * y! + m.f }
        },
        [x, y],
      )
    const crosshair = page.locator('[data-testid="pcb-pad-crosshair"]')
    const expectPad2 = async (status: string) => {
      await expect(crosshair).toHaveCount(1)
      await expect(page.locator(`${status} [data-testid="pcb-hovered-pad"]`)).toHaveText('SW pad 2')
      await expect(page.locator(`${status} [data-testid="pcb-hovered-center"]`)).toHaveText(
        'center X 2.540 Y -5.080 mm',
      )
    }

    // automatic routing: off-centre on SW pad 2 snaps the readout to its centre
    let p = await toScreen(2.9, -4.8)
    await page.mouse.move(p.x, p.y)
    await expectPad2('[data-testid="pcb-readout"]')
    await page.mouse.move(p.x + 400, p.y)
    await expect(crosshair).toHaveCount(0)

    // preset routing, select tool: the same
    await enterPresetMode(page)
    p = await toScreen(2.9, -4.8)
    await page.mouse.move(p.x, p.y)
    await expectPad2('[data-testid="pcb-readout"]')

    // the route tool has its snap marker instead
    await useTool(page, 'route')
    await page.mouse.move(p.x + 1, p.y)
    await expect(crosshair).toHaveCount(0)
    await expect(page.locator('[data-testid="pcb-hovered-pad"]')).toHaveText('SW pad 2')
  })

  test('starts a track when an unrouted pad is clicked with the select tool', async ({ page }) => {
    await openPreview(page)
    await enterPresetMode(page)
    const selectTool = page.locator('[data-testid="pcb-tool-select"]')
    const routeTool = page.locator('[data-testid="pcb-tool-route"]')
    await expect(selectTool).toHaveAttribute('aria-pressed', 'true')

    const sw2 = await padCentre(page, 'SW', '2')
    const d2 = await padCentre(page, 'D', '2')
    await page.mouse.move(sw2.x + 3, sw2.y + 3)
    await page.mouse.click(sw2.x + 3, sw2.y + 3)
    await expect(routeTool).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-testid="pcb-route-status"]')).toContainText('Routing SW_D')
    await page.mouse.move(d2.x, d2.y, { steps: 5 })
    await page.mouse.click(d2.x, d2.y)
    await expect(page.locator('[data-testid="pcb-track-overlay-track"]')).toHaveCount(2)

    // a routed pad only highlights its net
    await useTool(page, 'select')
    await page.mouse.move(sw2.x + 3, sw2.y - 3)
    await page.mouse.click(sw2.x + 3, sw2.y - 3)
    await expect(selectTool).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-testid="pcb-route-status"]')).toHaveCount(0)
  })

  test('places free vias with the via tool', async ({ page }) => {
    await openPreview(page)
    await enterPresetMode(page)
    const sw2 = await padCentre(page, 'SW', '2')
    const d2 = await padCentre(page, 'D', '2')
    const scale = (d2.y - sw2.y) / 7.68 // screen px per mm
    const spot = { x: d2.x - 1.5 * scale, y: d2.y }

    await useTool(page, 'via')
    await page.mouse.move(spot.x, spot.y, { steps: 3 })
    await expect(page.locator('[data-testid="pcb-free-via"]')).toHaveCount(1)
    await page.mouse.click(spot.x, spot.y)
    const vias = page.locator('[data-testid="pcb-track-overlay-via"]')
    await expect(vias).toHaveCount(1)
    await expect(page.locator('[data-testid="pcb-tool-via"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    // X routes from the via to D pad 2
    await page.keyboard.press('x')
    await expect(page.locator('[data-testid="pcb-route-status"]')).toContainText('Routing')
    await page.mouse.move(d2.x, d2.y, { steps: 5 })
    await page.mouse.click(d2.x, d2.y)
    await expect(page.locator('[data-testid="pcb-route-status"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="pcb-track-overlay-track"]')).not.toHaveCount(0)

    // one undo step per action
    await page.locator('[data-testid="pcb-undo"]').click()
    await page.locator('[data-testid="pcb-undo"]').click()
    await expect(vias).toHaveCount(0)
  })

  test('drags and rotates the diode outside the track editor', async ({ page }) => {
    await openPreview(page)
    await centreCanvas(page)
    const svg = page.locator(`${EDITOR.CANVAS} svg.preview-svg`)
    const viewBox = await svg.getAttribute('viewBox')
    const from = await svgToScreen(page, 5.08, 4)
    const to = await svgToScreen(page, 7.08, 5)

    // the left button doesn't move it
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 5 })
    await page.mouse.up()
    await expect(diodeX(page)).toHaveValue('5.08')

    // the default diode at (5.08, 4) mm, 90°; middle-dragged 2 mm right and 1 mm down
    await page.mouse.move(from.x, from.y)
    await page.mouse.down({ button: 'middle' })
    await page.mouse.move(to.x, to.y, { steps: 5 })
    await expect(page.locator(EDITOR.CANVAS)).toHaveClass(/part-dragging/)
    await expect(partReadout(page)).toHaveText('Diode X 7.000 Y 5.000 mm · 90°')
    // the view holds still under the cursor while dragging
    await expect(svg).toHaveAttribute('viewBox', viewBox!)
    // Shift+R turns it a quarter turn clockwise, also while dragging
    await page.keyboard.press('Shift+R')
    await expect(partReadout(page)).toContainText('0°')
    await page.mouse.up({ button: 'middle' })

    // snapped to the View grid (0.25 mm), written to the diode settings
    await expect(diodeX(page)).toHaveValue('7')
    await expect(diodeY(page)).toHaveValue('5')
    await expect(diodeRotation(page)).toHaveValue('0')
    // the dragged diode stays selected: Shift+R turns it, no drag needed; 0° → 270°
    await expect(partSelection(page)).toHaveAttribute('data-part', 'D')
    await page.keyboard.press('Shift+R')
    await expect(diodeRotation(page)).toHaveValue('270')
  })

  test('Esc cancels a diode drag', async ({ page }) => {
    await openPreview(page)
    await centreCanvas(page)
    const from = await svgToScreen(page, 5.08, 4)
    const to = await svgToScreen(page, 2, 2)
    await page.mouse.move(from.x, from.y)
    await page.mouse.down({ button: 'middle' })
    await page.mouse.move(to.x, to.y, { steps: 5 })
    await page.keyboard.press('Shift+R')
    await expect(diodeX(page)).toHaveValue('2')
    await page.keyboard.press('Escape')
    await expect(diodeX(page)).toHaveValue('5.08')
    await expect(diodeY(page)).toHaveValue('4')
    await expect(diodeRotation(page)).toHaveValue('90')
    // moving on after Esc doesn't drag again
    await page.mouse.move(from.x, from.y, { steps: 3 })
    await page.mouse.up({ button: 'middle' })
    await expect(diodeX(page)).toHaveValue('5.08')
  })

  test('middle-drags the diode in the track editor, snapped to the grid', async ({ page }) => {
    await openPreview(page)
    await enterPresetMode(page)

    // the middle button on a diode pad drags the diode (grid 0.25 mm)
    const d2 = await padCentre(page, 'D', '2')
    const sw2 = await padCentre(page, 'SW', '2')
    const scale = (d2.y - sw2.y) / 7.68 // screen px per mm
    const vb = await page.locator(`${EDITOR.CANVAS} svg.preview-svg`).getAttribute('viewBox')
    await page.mouse.move(d2.x, d2.y)
    await page.mouse.down({ button: 'middle' })
    await page.mouse.move(d2.x - 1.08 * scale, d2.y + 1 * scale, { steps: 5 })
    await page.mouse.up({ button: 'middle' })
    await expect(diodeX(page)).toHaveValue('4')
    await expect(diodeY(page)).toHaveValue('5')
    // it didn't pan, and no track started
    await expect(page.locator(`${EDITOR.CANVAS} svg.preview-svg`)).toHaveAttribute('viewBox', vb!)
    await expect(page.locator('[data-testid="pcb-route-status"]')).toHaveCount(0)

    // D pad 2 follows the diode: 1.08 mm left and 1 mm down
    const moved = await padCentre(page, 'D', '2')
    expect(moved.x).toBeCloseTo(d2.x - 1.08 * scale, 0)
    expect(moved.y).toBeCloseTo(d2.y + 1 * scale, 0)

    // the middle button off the diode still pans
    await page.mouse.move(sw2.x - 3 * scale, sw2.y)
    await page.mouse.down({ button: 'middle' })
    await page.mouse.move(sw2.x - 3 * scale + 40, sw2.y, { steps: 5 })
    await page.mouse.up({ button: 'middle' })
    await expect(page.locator(`${EDITOR.CANVAS} svg.preview-svg`)).not.toHaveAttribute(
      'viewBox',
      vb!,
    )
    await expect(diodeX(page)).toHaveValue('4')

    await page.keyboard.press('Shift+R')
    await expect(diodeRotation(page)).toHaveValue('0')
  })

  test('selects a part with a click', async ({ page }) => {
    await openPreview(page)
    await centreCanvas(page)
    const diode = await svgToScreen(page, 5.08, 4)
    await expect(partSelection(page)).toHaveCount(0)

    await page.mouse.click(diode.x, diode.y)
    await expect(partSelection(page)).toHaveAttribute('data-part', 'D')
    await expect(partReadout(page)).toHaveText('Diode X 5.080 Y 4.000 mm · 90°')
    // Shift+R turns the selected part
    await page.keyboard.press('Shift+R')
    await expect(diodeRotation(page)).toHaveValue('0')
    await expect(partReadout(page)).toHaveText('Diode X 5.080 Y 4.000 mm · 0°')

    // a click off the parts (the switch isn't one) clears the selection
    const empty = await svgToScreen(page, -5, 0)
    await page.mouse.click(empty.x, empty.y)
    await expect(partSelection(page)).toHaveCount(0)
    await expect(partReadout(page)).toHaveCount(0)
    // Esc clears it too
    await page.mouse.click(diode.x, diode.y)
    await expect(partSelection(page)).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(partSelection(page)).toHaveCount(0)
  })

  test('moves and rotates the LED and its capacitor', async ({ page }) => {
    await openPreview(page)
    await page.locator('[data-testid="pcb-tab-leds"]').click()
    await page.locator('[data-testid="led-enable"]').check()
    await expect(page.locator('#ledPositionY input')).toBeEnabled()
    // the view refits around the LED parts once their pads load
    await waitForView(page)
    await centreCanvas(page)

    // the LED at (0, 5.25) mm, middle-dragged up to (0, 4) on the 0.25 mm grid
    const led = await svgToScreen(page, 0, 5.25)
    const up = await svgToScreen(page, 0, 4)
    await page.mouse.move(led.x, led.y)
    await page.mouse.down({ button: 'middle' })
    await page.mouse.move(up.x, up.y, { steps: 5 })
    await expect(partReadout(page)).toHaveText('LED X 0.000 Y 4.000 mm · 0°')
    await page.mouse.up({ button: 'middle' })
    await expect(page.locator('#ledPositionY input')).toHaveValue('4')
    await page.keyboard.press('Shift+R')
    await expect(page.locator('#ledRotation')).toHaveValue('270')

    // the capacitor at (5.5, 5.75) mm overlaps the diode's pad 1 by default: picked by its pad 2
    const cap = await svgToScreen(page, 6.3, 5.75)
    await page.mouse.click(cap.x, cap.y)
    await expect(partSelection(page)).toHaveAttribute('data-part', 'C')
    await page.keyboard.press('Shift+R')
    await expect(page.locator('#ledCapacitorRotation')).toHaveValue('270')
    // the collision warning now covers the bottom of the canvas, and the capacitor with it
    // in Firefox: pan it up, middle-dragging off the parts
    const empty = await svgToScreen(page, -5, 0)
    await page.mouse.move(empty.x, empty.y)
    await page.mouse.down({ button: 'middle' })
    await page.mouse.move(empty.x, empty.y - 150, { steps: 5 })
    await page.mouse.up({ button: 'middle' })
    // turned, its pad 2 is below its centre
    const pad2 = await svgToScreen(page, 5.5, 6.55)
    const right = await svgToScreen(page, 6.5, 6.55)
    await page.mouse.move(pad2.x, pad2.y)
    await page.mouse.down({ button: 'middle' })
    await page.mouse.move(right.x, right.y, { steps: 5 })
    await page.mouse.up({ button: 'middle' })
    await expect(page.locator('#ledCapacitorPositionX input')).toHaveValue('6.5')
    // the LED didn't move
    await expect(page.locator('#ledPositionY input')).toHaveValue('4')
  })

  test('selects the diode by its body in the track editor', async ({ page }) => {
    await openPreview(page)
    await enterPresetMode(page)
    // between the pads: not a pad that would start a track
    const body = await svgToScreen(page, 5.08, 4)
    await page.mouse.click(body.x, body.y)
    await expect(partSelection(page)).toHaveAttribute('data-part', 'D')
    await expect(page.locator('[data-testid="pcb-route-status"]')).toHaveCount(0)
    await page.keyboard.press('Shift+R')
    await expect(diodeRotation(page)).toHaveValue('0')
    // Esc drops it
    await page.keyboard.press('Escape')
    await expect(partSelection(page)).toHaveCount(0)
  })

  test('has the View controls outside the track editor', async ({ page }) => {
    await openPreview(page)
    await centreCanvas(page)
    // the same View controls in every routing mode
    await expect(page.locator(EDITOR.GRID)).toBeVisible()
    await expect(page.locator(EDITOR.FIT)).toBeVisible()
    const pads = page.locator(EDITOR.PADS)
    await expect(pads.locator('[data-layer="B.Cu"] [data-pad-key^="D:"]')).toHaveCount(2)
    await page.locator('[data-testid="pcb-layer-toggle-B.Cu"]').click()
    await centreCanvas(page)
    await expect(pads.locator('[data-layer="B.Cu"]')).toHaveCount(0)
    await page.locator('[data-testid="pcb-layer-toggle-B.Cu"]').click()
    await centreCanvas(page)
    await expect(pads.locator('[data-layer="B.Cu"] [data-pad-key^="D:"]')).toHaveCount(2)

    const width = await viewBoxWidth(page)
    await page.locator('[data-testid="pcb-zoom-in"]').click()
    await centreCanvas(page)
    await expect.poll(() => viewBoxWidth(page)).toBeLessThan(width)
    await page.locator(EDITOR.FIT).click()
    await centreCanvas(page)
    await expect.poll(() => viewBoxWidth(page)).toBeCloseTo(width, 3)

    // a drag snaps to the grid chosen in View
    await page.locator('[data-testid="pcb-grid-select"]').selectOption('1')
    await centreCanvas(page)
    const from = await svgToScreen(page, 5.08, 4)
    const to = await svgToScreen(page, 7.3, 5.2)
    await page.mouse.move(from.x, from.y)
    await page.mouse.down({ button: 'middle' })
    await page.mouse.move(to.x, to.y, { steps: 5 })
    await page.mouse.up({ button: 'middle' })
    await expect(diodeX(page)).toHaveValue('7')
    await expect(diodeY(page)).toHaveValue('5')

    // the position fields still take an exact value, off the grid
    await diodeX(page).fill('5.13')
    await diodeX(page).press('Enter')
    await expect(partReadout(page)).toHaveText('Diode X 5.130 Y 5.000 mm · 90°')
  })

  test('draws the next key a part collides with', async ({ page }) => {
    await openPreview(page)
    await expect(page.locator('[data-testid="pcb-neighbour-key"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="pcb-own-key"]')).toHaveCount(0)

    // a front diode past the key's bottom edge, in the next key's switch
    await page.locator('#diodeSide').selectOption('FRONT')
    await diodeY(page).fill('12')
    await diodeY(page).press('Enter')
    await expect(page.locator('[data-testid="pcb-courtyard-warning"]')).toContainText(
      "Diode courtyard overlaps the next key's switch (front)",
    )
    const next = page.locator('[data-testid="pcb-neighbour-key"]')
    await expect(next).toHaveCount(1)
    await expect(next).toHaveAttribute('transform', 'translate(0 19.05)')
    await expect(next).toContainText('next key')
    await expect(page.locator('[data-testid="pcb-own-key"]')).toHaveCount(1)

    // moved back into its key: nothing more to show
    await diodeY(page).fill('4')
    await diodeY(page).press('Enter')
    await page.locator('#diodeSide').selectOption('BACK')
    await expect(next).toHaveCount(0)
  })
})
