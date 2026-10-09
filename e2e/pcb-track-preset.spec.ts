import { test, expect, type Page } from '@playwright/test'
import { KeyboardEditorPage } from './pages/KeyboardEditorPage'

// Switch-diode track preset pasted into the PCB generator's JSON settings.
// The preset is the kle-ng default one: SW pad 2 to D pad 2 (A), on B.Cu.
const TRACKS = {
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
}

const PCB = {
  COLLAPSE_BTN: '[data-section-id="pcb"] .collapse-btn',
  JSON_TAB: '[data-testid="pcb-tab-json"]',
  JSON_EDITOR: '.pcb-json-view .cm-content',
  APPLY_BTN: '.pcb-json-view button:has-text("Apply")',
  OVERLAY: '[data-testid="pcb-track-overlay"]',
  OVERLAY_TRACK: '[data-testid="pcb-track-overlay-track"]',
  BACK_SWITCH_ERROR: '[data-testid="pcb-track-preset-back-switch"]',
  IGNORED_NOTICE: '[data-testid="pcb-track-preset-ignored"]',
  DRC_BADGE: '[data-testid="pcb-drc-badge"]',
  DRC_MARKER: '[data-testid="pcb-drc-marker"]',
  RATSNEST: '[data-testid="pcb-ratsnest"]',
}

async function openPcbJsonTab(page: Page) {
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

  const editor = new KeyboardEditorPage(page)
  await editor.goto()

  const collapseBtn = page.locator(PCB.COLLAPSE_BTN)
  if ((await collapseBtn.getAttribute('aria-expanded')) === 'false') {
    await collapseBtn.click()
  }
  await page.locator(PCB.JSON_TAB).click()
  await expect(page.locator(PCB.JSON_EDITOR)).toBeVisible()
}

async function applySettings(page: Page, settings: object) {
  const content = JSON.stringify(settings, null, 2)
  // Replace the CodeMirror document through its view, like loadJsonLayout does
  const replaced = await page.evaluate((text) => {
    const el = document.querySelector('.pcb-json-view .cm-content') as Element & {
      cmTile?: {
        root?: { view?: { state: { doc: { length: number } }; dispatch: (tr: unknown) => void } }
      }
    }
    const view = el?.cmTile?.root?.view
    if (!view) return false
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } })
    return true
  }, content)
  expect(replaced).toBe(true)
  await page.locator(PCB.APPLY_BTN).click()
}

test.describe('PCB Generator track preset', () => {
  test('draws a pasted track preset over the footprint preview', async ({ page }) => {
    await openPcbJsonTab(page)
    await expect(page.locator(PCB.OVERLAY)).toHaveCount(0)

    await applySettings(page, { routing: 'Full', tracks: TRACKS })

    await expect(page.locator(PCB.OVERLAY)).toBeVisible()
    const tracks = page.locator(PCB.OVERLAY_TRACK)
    await expect(tracks).toHaveCount(2)
    // switch-local mm, B.Cu
    await expect(tracks.first()).toHaveAttribute('x1', '2.54')
    await expect(tracks.first()).toHaveAttribute('y1', '-5.08')
    await expect(tracks.first()).toHaveAttribute('stroke-width', '0.25')
    await expect(tracks.first()).toHaveClass(/track-back/)
    await expect(page.locator(PCB.IGNORED_NOTICE)).toHaveCount(0)
    await expect(page.locator(PCB.BACK_SWITCH_ERROR)).toHaveCount(0)
  })

  test('checks the pasted preset against the pads', async ({ page }) => {
    await openPcbJsonTab(page)

    await applySettings(page, { routing: 'Full', tracks: TRACKS })
    await expect(page.locator(PCB.DRC_BADGE)).toHaveText('DRC clean')
    await expect(page.locator(PCB.DRC_MARKER)).toHaveCount(0)
    await expect(page.locator(PCB.RATSNEST)).toHaveCount(0)

    // straight from SW pad 2 down onto the diode cathode (ROW): a short
    const shorted = {
      version: 1,
      items: [
        {
          type: 'track',
          start: { x_nm: 2540000, y_nm: -5080000 },
          end: { x_nm: 5080000, y_nm: 5400000 },
          width_nm: 250000,
          layer: 'B.Cu',
        },
      ],
    }
    await applySettings(page, { routing: 'Full', tracks: shorted })
    await expect(page.locator(PCB.DRC_BADGE)).toContainText('DRC error')
    await expect(page.locator(`${PCB.DRC_MARKER}[data-kind="short"]`)).toHaveCount(1)
  })

  test('rejects a preset with back-side switches', async ({ page }) => {
    await openPcbJsonTab(page)

    await applySettings(page, { switch: { side: 'BACK' }, tracks: TRACKS })

    await expect(page.locator(PCB.BACK_SWITCH_ERROR)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Generate PCB' })).toBeDisabled()
    // presets are drawn for front-side switches only
    await expect(page.locator(PCB.OVERLAY)).toHaveCount(0)
  })

  test('notes that the preset is ignored when routing is disabled', async ({ page }) => {
    await openPcbJsonTab(page)

    await applySettings(page, { routing: 'Disabled', tracks: TRACKS })

    await expect(page.locator(PCB.IGNORED_NOTICE)).toBeVisible()
  })
})
