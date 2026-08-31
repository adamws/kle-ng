import { test, expect, type Page } from '@playwright/test'
import { CanvasTestHelper } from './helpers/canvas-test-helpers'
import { SELECTORS } from './constants/selectors'

const EXTRA_TOOLS_BUTTON = '.extra-tools-group .dropdown-toggle'

/**
 * Read the live layout out of the JSON editor.
 *
 * Goes through CodeMirror's document state rather than the DOM: the editor only renders the
 * visible portion, so `textContent` would silently truncate a longer layout.
 */
async function readLayoutJson(page: Page): Promise<unknown[]> {
  const text = await page.evaluate(() => {
    const element = document.querySelector(
      '[data-section-id="json"] .cm-editor-container .cm-content',
    ) as
      | (Element & { cmTile?: { root?: { view?: { state: { doc: { toString(): string } } } } } })
      | null
    return element?.cmTile?.root?.view?.state.doc.toString() ?? ''
  })
  if (!text) throw new Error('could not read the JSON editor document')
  return JSON.parse(text)
}

async function openCurveLayout(page: Page) {
  await page.locator(EXTRA_TOOLS_BUTTON).click()
  await page.locator('.dropdown-item', { hasText: 'Curve Layout' }).click()
  await expect(page.locator(SELECTORS.CURVE_LAYOUT.PANEL)).toBeVisible()
}

/** Press a curve handle and move it by a pixel delta, without releasing. */
async function dragHandleTo(page: Page, index: number, dx: number, dy: number) {
  const handle = page.locator(SELECTORS.CURVE_LAYOUT.HANDLE(index))
  const box = await handle.boundingBox()
  if (!box) throw new Error(`handle ${index} has no bounding box`)

  const startX = box.x + box.width / 2
  const startY = box.y + box.height / 2

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  // Move in steps so the rAF-coalesced preview runs more than once during the drag.
  await page.mouse.move(startX + dx / 2, startY + dy / 2, { steps: 5 })
  await page.mouse.move(startX + dx, startY + dy, { steps: 5 })
}

/** Drag a curve handle by a pixel delta and release it. */
async function dragHandle(page: Page, index: number, dx: number, dy: number) {
  await dragHandleTo(page, index, dx, dy)
  await page.mouse.up()
}

/**
 * A rough ANSI 60% as KLE JSON: staggered rows, wide modifiers, 6.25u spacebar.
 *
 * Wide keys are long rigid bars, so once the rows around them curve away they foul them at any
 * usable bend. This is the layout shape the Allow overlaps flag exists for.
 */
const ANSI_60 = JSON.stringify(
  [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
    [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5],
    [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25],
    [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75],
    [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25],
  ].map((widths) => widths.flatMap((w) => (w === 1 ? [''] : [{ w }, '']))),
)

test.describe('Curve Layout tool', () => {
  let canvasHelper: CanvasTestHelper

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    canvasHelper = new CanvasTestHelper(page)
    await canvasHelper.addMultipleKeys(10)
    await canvasHelper.selectAllKeys()
  })

  test('opens with nothing selected and targets the whole layout', async ({ page }) => {
    // Same rule as the other Extra Tools: no selection means the whole layout.
    await canvasHelper.deselectAllKeys()
    await page.locator(EXTRA_TOOLS_BUTTON).click()

    const item = page.locator('.dropdown-item', { hasText: 'Curve Layout' })
    await expect(item).toBeEnabled()
    await item.click()

    const panel = page.locator(SELECTORS.CURVE_LAYOUT.PANEL)
    await expect(panel).toBeVisible()
    await expect(panel).toContainText('all 10 keys')

    // And it really does bend every key, not an empty set.
    const before = await readLayoutJson(page)
    await dragHandle(page, 1, 0, -110)
    await canvasHelper.waitForCanvasStability()
    expect(await readLayoutJson(page)).not.toEqual(before)
    await expect(page.locator(SELECTORS.CURVE_LAYOUT.APPLY)).toBeEnabled()
  })

  test('reports the selected subset when there is a selection', async ({ page }) => {
    await canvasHelper.deselectAllKeys()
    await page.locator(SELECTORS.CANVAS.MAIN).click({ position: { x: 30, y: 30 } })
    await expect(page.locator(SELECTORS.COUNTERS.SELECTED)).toContainText('1')

    await openCurveLayout(page)
    await expect(page.locator(SELECTORS.CURVE_LAYOUT.PANEL)).toContainText('1 selected key')
  })

  test('opens with the overlay and panel, and changes nothing until the curve is bent', async ({
    page,
  }) => {
    const before = await readLayoutJson(page)

    await openCurveLayout(page)
    await expect(page.locator(SELECTORS.CURVE_LAYOUT.OVERLAY)).toBeVisible()
    for (const index of [0, 1, 2, 3]) {
      await expect(page.locator(SELECTORS.CURVE_LAYOUT.HANDLE(index))).toBeVisible()
    }

    // A straight default spine is an identity transform: opening the tool must not move keys.
    expect(await readLayoutJson(page)).toEqual(before)
  })

  // Every handle, because the failure was specific to which one moved: releasing an inner
  // handle used to re-derive a bend percentage and rewrite both inner handles from it, throwing
  // the drag away, while the endpoint handles looked fine.
  for (const handle of [0, 1, 2, 3]) {
    test(`dragging handle ${handle} survives releasing the mouse`, async ({ page }) => {
      const before = await readLayoutJson(page)
      await openCurveLayout(page)

      await dragHandleTo(page, handle, 0, -110)
      await canvasHelper.waitForCanvasStability()
      const whileDragging = await readLayoutJson(page)
      expect(whileDragging).not.toEqual(before)

      await page.mouse.up()
      await canvasHelper.waitForCanvasStability()
      await expect.poll(async () => readLayoutJson(page)).toEqual(whileDragging)
    })
  }

  test('bending the curve moves the keys and Apply keeps the result', async ({ page }) => {
    const before = await readLayoutJson(page)
    await openCurveLayout(page)

    await dragHandle(page, 1, 0, -120)
    await canvasHelper.waitForCanvasStability()

    const bent = await readLayoutJson(page)
    expect(bent).not.toEqual(before)

    await expect(page.locator(SELECTORS.CURVE_LAYOUT.APPLY)).toBeEnabled()
    await page.locator(SELECTORS.CURVE_LAYOUT.APPLY).click()
    await expect(page.locator(SELECTORS.CURVE_LAYOUT.PANEL)).toBeHidden()

    // The bent layout survives closing the tool.
    expect(await readLayoutJson(page)).toEqual(bent)
    await expect(page.locator(SELECTORS.COUNTERS.KEYS)).toContainText('10')
  })

  test('Cancel restores the original layout exactly', async ({ page }) => {
    const before = await readLayoutJson(page)
    await openCurveLayout(page)

    await dragHandle(page, 2, 0, 130)
    await canvasHelper.waitForCanvasStability()
    expect(await readLayoutJson(page)).not.toEqual(before)

    await page.locator(SELECTORS.CURVE_LAYOUT.CANCEL).click()
    await expect(page.locator(SELECTORS.CURVE_LAYOUT.PANEL)).toBeHidden()

    expect(await readLayoutJson(page)).toEqual(before)
  })

  test('Escape cancels the edit', async ({ page }) => {
    const before = await readLayoutJson(page)
    await openCurveLayout(page)

    await dragHandle(page, 1, 0, -100)
    await canvasHelper.waitForCanvasStability()

    await page.keyboard.press('Escape')
    await expect(page.locator(SELECTORS.CURVE_LAYOUT.PANEL)).toBeHidden()
    expect(await readLayoutJson(page)).toEqual(before)
  })

  test('undo reverts an applied curve in a single step', async ({ page }) => {
    const before = await readLayoutJson(page)

    await openCurveLayout(page)
    await dragHandle(page, 1, 0, -120)
    await canvasHelper.waitForCanvasStability()
    await page.locator(SELECTORS.CURVE_LAYOUT.APPLY).click()
    await expect(page.locator(SELECTORS.CURVE_LAYOUT.PANEL)).toBeHidden()

    await page.locator(SELECTORS.TOOLBAR.UNDO).click()
    await canvasHelper.waitForCanvasStability()

    expect(await readLayoutJson(page)).toEqual(before)
  })

  test('the bend slider shapes the curve without touching a handle', async ({ page }) => {
    const before = await readLayoutJson(page)
    await openCurveLayout(page)

    const slider = page.locator(SELECTORS.CURVE_LAYOUT.BEND)
    await slider.fill('40')
    await slider.dispatchEvent('input')
    await canvasHelper.waitForCanvasStability()

    expect(await readLayoutJson(page)).not.toEqual(before)
    await expect(page.locator(SELECTORS.CURVE_LAYOUT.PANEL)).toContainText('no overlaps')

    // Reset puts the spine back to straight, which is the identity transform again.
    await page.locator(SELECTORS.CURVE_LAYOUT.RESET).click()
    await canvasHelper.waitForCanvasStability()
    expect(await readLayoutJson(page)).toEqual(before)
  })

  test('reports a collision-free result while the curve is being shaped', async ({ page }) => {
    await openCurveLayout(page)

    await dragHandle(page, 1, -60, -160)
    await canvasHelper.waitForCanvasStability()

    // The whole point of the tool: however the curve is shaped, keys never overlap.
    await expect(page.locator(SELECTORS.CURVE_LAYOUT.PANEL)).toContainText('no overlaps')
    await expect(page.locator(SELECTORS.CURVE_LAYOUT.APPLY)).toBeEnabled()
  })

  test.describe('Allow overlaps', () => {
    test('a layout with wide keys is blocked, then applies once overlaps are allowed', async ({
      page,
    }) => {
      await canvasHelper.loadJsonLayout(ANSI_60)
      await canvasHelper.deselectAllKeys()
      await openCurveLayout(page)

      const slider = page.locator(SELECTORS.CURVE_LAYOUT.BEND)
      await slider.fill('15')
      await slider.dispatchEvent('input')
      await canvasHelper.waitForCanvasStability()

      const panel = page.locator(SELECTORS.CURVE_LAYOUT.PANEL)
      const apply = page.locator(SELECTORS.CURVE_LAYOUT.APPLY)

      // Blocked, and the message points at the way out.
      await expect(panel).toContainText('No overlap-free layout exists')
      await expect(panel).toContainText('Allow overlaps')
      await expect(apply).toBeDisabled()

      await page.locator(SELECTORS.CURVE_LAYOUT.ALLOW_OVERLAPS).check()
      await canvasHelper.waitForCanvasStability()

      await expect(panel).toContainText('overlapping pair(s) — allowed')
      await expect(apply).toBeEnabled()

      const bent = await readLayoutJson(page)
      await apply.click()
      await expect(panel).toBeHidden()
      expect(await readLayoutJson(page)).toEqual(bent)
    })

    test('does not loosen a layout that already bends cleanly', async ({ page }) => {
      await openCurveLayout(page)

      const slider = page.locator(SELECTORS.CURVE_LAYOUT.BEND)
      await slider.fill('25')
      await slider.dispatchEvent('input')
      await canvasHelper.waitForCanvasStability()

      const panel = page.locator(SELECTORS.CURVE_LAYOUT.PANEL)
      await expect(panel).toContainText('no overlaps')
      const guarded = await readLayoutJson(page)

      await page.locator(SELECTORS.CURVE_LAYOUT.ALLOW_OVERLAPS).check()
      await canvasHelper.waitForCanvasStability()

      await expect(panel).toContainText('no overlaps')
      expect(await readLayoutJson(page)).toEqual(guarded)
    })
  })
})
