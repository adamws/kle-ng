import { test, expect, Page } from '@playwright/test'
import { SELECTORS } from './constants/selectors'
import { WaitHelpers } from './helpers/wait-helpers'
import { PresetComponent } from './pages/components/PresetComponent'

// ============================================================
// Expectations about the catalogue
// ============================================================

/** The shortlist in the Import menu, in the order it is curated. */
const TOP_PRESETS = [
  'Blank Layout',
  'ANSI 104',
  'Default 60%',
  'ISO 60%',
  'Ortho 4x12 (QMK)',
  'Multilayout 60% (VIA)',
]

/** Every preset the library modal offers. */
const CATALOGUE_SIZE = 15

// ============================================================
// Helpers
// ============================================================

const presets = (page: Page) => new PresetComponent(page, new WaitHelpers(page))

async function expectKeyCount(page: Page, expected: number) {
  await expect
    .poll(
      async () => {
        const text = await page.locator(SELECTORS.COUNTERS.KEYS).textContent()
        const match = text?.match(/Keys: (\d+)/)
        return match ? Number(match[1]) : null
      },
      { timeout: 10000 },
    )
    .toBe(expected)
}

async function currentKeyCount(page: Page): Promise<number | null> {
  const text = await page.locator(SELECTORS.COUNTERS.KEYS).textContent()
  const match = text?.match(/Keys: (\d+)/)
  return match ? Number(match[1]) : null
}

// ============================================================
// Test Suite
// ============================================================

test.describe('Import from Preset', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  // --------------------------------------------------------
  // Group 1: the shortlist in the Import menu
  // --------------------------------------------------------
  test.describe('Top Presets shortcut', () => {
    test('TC-PRESET-001 — lists exactly the curated presets, in order', async ({ page }) => {
      await page.click(SELECTORS.PRESET.SELECT_BUTTON)

      await expect(page.locator(SELECTORS.PRESET.DROPDOWN)).toContainText('Top Presets')
      await expect(page.locator(SELECTORS.PRESET.DROPDOWN_ITEM)).toHaveText(TOP_PRESETS)
    })

    test('TC-PRESET-002 — loading one names the download after it', async ({ page }) => {
      await presets(page).selectPreset('ANSI 104')

      await expectKeyCount(page, 104)
    })

    test('TC-PRESET-003 — "From Preset" is not itself one of the shortlist items', async ({
      page,
    }) => {
      // The e2e selectors address the shortlist by this test id; the browse entry
      // sharing it would silently inflate every count that uses it.
      await page.click(SELECTORS.PRESET.SELECT_BUTTON)

      await expect(page.locator(SELECTORS.PRESET.BROWSE_ITEM)).toBeVisible()
      await expect(page.locator(SELECTORS.PRESET.DROPDOWN_ITEM)).toHaveCount(TOP_PRESETS.length)
    })
  })

  // --------------------------------------------------------
  // Group 2: the library modal
  // --------------------------------------------------------
  test.describe('Preset library modal', () => {
    test('TC-PRESET-010 — opens from Import → From Preset with the whole catalogue', async ({
      page,
    }) => {
      const modal = await presets(page).openPresetModal()

      await expect(modal.locator('.modal-title')).toHaveText('Import from Preset')
      await expect(modal.locator(SELECTORS.PRESET.CARD)).toHaveCount(CATALOGUE_SIZE)
      await expect(modal.locator(SELECTORS.PRESET.COUNT)).toHaveText(
        `${CATALOGUE_SIZE} presets available`,
      )
    })

    test('TC-PRESET-011 — search narrows the grid by name', async ({ page }) => {
      const modal = await presets(page).openPresetModal()

      await modal.locator(SELECTORS.PRESET.SEARCH).fill('iso')

      const cards = modal.locator(SELECTORS.PRESET.CARD)
      await expect(cards).toHaveCount(2)
      await expect(
        modal.locator(`${SELECTORS.PRESET.CARD}[data-preset-name="ISO 105"]`),
      ).toBeVisible()
      await expect(
        modal.locator(`${SELECTORS.PRESET.CARD}[data-preset-name="ISO 60%"]`),
      ).toBeVisible()
      await expect(modal.locator(SELECTORS.PRESET.COUNT)).toHaveText('2 result(s)')
    })

    test('TC-PRESET-012 — search matches keywords that are not in the name', async ({ page }) => {
      const modal = await presets(page).openPresetModal()

      await modal.locator(SELECTORS.PRESET.SEARCH).fill('split')

      const names = await modal
        .locator(SELECTORS.PRESET.CARD)
        .evaluateAll((cards) => cards.map((card) => (card as HTMLElement).dataset.presetName))
      expect(names).toEqual(
        expect.arrayContaining(['ErgoDox', 'Atreus', 'Kinesis Advantage', 'Absolem (ergogen)']),
      )
    })

    test('TC-PRESET-013 — says so when nothing matches', async ({ page }) => {
      const modal = await presets(page).openPresetModal()

      await modal.locator(SELECTORS.PRESET.SEARCH).fill('zzzznotathing')

      await expect(modal.locator(SELECTORS.PRESET.CARD)).toHaveCount(0)
      await expect(modal.locator(SELECTORS.PRESET.EMPTY_STATE)).toBeVisible()
    })

    test('TC-PRESET-013b — keeps the same size however far the search narrows', async ({
      page,
    }) => {
      // The search box is inside the modal, so a modal that resized as results came
      // and went would move itself out from under the pointer mid-query.
      const modal = await presets(page).openPresetModal()
      const content = modal.locator('.modal-content')

      const sizeNow = async () => {
        const box = await content.boundingBox()
        return { width: box?.width, height: box?.height }
      }

      const full = await sizeNow()

      await modal.locator(SELECTORS.PRESET.SEARCH).fill('iso')
      await expect(modal.locator(SELECTORS.PRESET.CARD)).toHaveCount(2)
      expect(await sizeNow()).toEqual(full)

      await modal.locator(SELECTORS.PRESET.SEARCH).fill('zzzznotathing')
      await expect(modal.locator(SELECTORS.PRESET.EMPTY_STATE)).toBeVisible()
      expect(await sizeNow()).toEqual(full)

      await modal.locator(SELECTORS.PRESET.SEARCH).fill('')
      await expect(modal.locator(SELECTORS.PRESET.CARD)).toHaveCount(CATALOGUE_SIZE)
      expect(await sizeNow()).toEqual(full)
    })

    test('TC-PRESET-014 — loads a preset that is not on the shortlist', async ({ page }) => {
      // ISO 105 is reachable only through the modal, which is the whole point of it.
      await presets(page).selectPreset('ISO 105')

      await expectKeyCount(page, 105)
      await expect(page.locator(SELECTORS.PRESET.MODAL)).toBeHidden()
    })

    test('TC-PRESET-015 — the blank preset is labelled rather than drawn', async ({ page }) => {
      const modal = await presets(page).openPresetModal()

      const blank = modal.locator(`${SELECTORS.PRESET.CARD}[data-preset-name="Blank Layout"]`)
      await expect(blank.locator('[data-testid="preset-card-empty"]')).toBeVisible()

      await blank.click()
      await expect(modal).toBeHidden()
      await expectKeyCount(page, 0)
    })

    test('TC-PRESET-016 — Close and Escape both dismiss without loading', async ({ page }) => {
      await presets(page).selectPreset('ANSI 104')
      await expectKeyCount(page, 104)

      const component = presets(page)

      const modal = await component.openPresetModal()
      await modal.locator('.modal-footer .btn-secondary').click()
      await expect(modal).toBeHidden()
      expect(await currentKeyCount(page)).toBe(104)

      await component.openPresetModal()
      await page.keyboard.press('Escape')
      await expect(page.locator(SELECTORS.PRESET.MODAL)).toBeHidden()
      expect(await currentKeyCount(page)).toBe(104)
    })

    test('TC-PRESET-017 — cards render live previews', async ({ page, browserName }) => {
      // Canvas rendering is only verified on Chromium, in line with the rest of the
      // suite. No screenshot: preset artwork is expected to churn.
      test.skip(browserName !== 'chromium', 'Canvas previews verified on Chromium')

      const modal = await presets(page).openPresetModal()

      await expect
        .poll(async () => modal.locator(`${SELECTORS.PRESET.CARD} canvas`).count(), {
          timeout: 10000,
        })
        .toBeGreaterThan(0)
    })
  })

  // --------------------------------------------------------
  // Group 3: presets that ship with more than one set of legends
  // --------------------------------------------------------
  test.describe('Multilingual presets', () => {
    const slot = (page: Page, name: string) =>
      page
        .locator('.preset-card-slot')
        .filter({ has: page.locator(`[data-preset-name="${name}"]`) })

    // ANSI 104 is the same physical board whether its keycaps are printed US-English
    // or Polish, so it is one card with an optional control — not two cards.
    test('TC-PRESET-020 — only a multilingual card carries the language control', async ({
      page,
    }) => {
      await presets(page).openPresetModal()

      const toggle = slot(page, 'ANSI 104').locator(SELECTORS.PRESET.LANGUAGE_TOGGLE)
      await expect(toggle).toBeVisible()
      await expect(toggle).toHaveAttribute('data-preset-languages', '2')
      // It names the language a plain click would load.
      await expect(toggle).toContainText('EN')

      await expect(slot(page, 'ISO 105').locator(SELECTORS.PRESET.LANGUAGE_TOGGLE)).toHaveCount(0)
    })

    // The reason the chooser is not a modal: the default case must stay one click.
    test('TC-PRESET-021 — clicking the card loads the default in one click', async ({ page }) => {
      await presets(page).selectPresetFromModal('ANSI 104')

      await expect(page.locator(SELECTORS.PRESET.LANGUAGE_MENU)).toBeHidden()
      await expect(page.locator(SELECTORS.PRESET.MODAL)).toBeHidden()
      await expectKeyCount(page, 104)
    })

    test('TC-PRESET-022 — the control opens a menu without loading anything', async ({ page }) => {
      const before = await currentKeyCount(page)

      const menu = await presets(page).openLanguageMenu('ANSI 104')

      await expect(menu.locator(SELECTORS.PRESET.LANGUAGE_OPTION)).toHaveText([/English/, /Polish/])
      // The library stays open behind the menu, and nothing has been imported.
      await expect(page.locator(SELECTORS.PRESET.MODAL)).toBeVisible()
      expect(await currentKeyCount(page)).toBe(before)
    })

    test('TC-PRESET-023 — Escape closes the menu first, then the library', async ({ page }) => {
      const menu = await presets(page).openLanguageMenu('ANSI 104')

      await page.keyboard.press('Escape')
      await expect(menu).toBeHidden()
      await expect(page.locator(SELECTORS.PRESET.MODAL)).toBeVisible()

      await page.keyboard.press('Escape')
      await expect(page.locator(SELECTORS.PRESET.MODAL)).toBeHidden()
    })

    test('TC-PRESET-024 — clicking away dismisses the menu and keeps the library open', async ({
      page,
    }) => {
      const menu = await presets(page).openLanguageMenu('ANSI 104')

      await page.locator(SELECTORS.PRESET.SEARCH).click()

      await expect(menu).toBeHidden()
      await expect(page.locator(SELECTORS.PRESET.MODAL)).toBeVisible()
    })

    // Picking stages a choice; it must not import on its own, or a language could
    // never be looked at and reconsidered.
    test('TC-PRESET-025 — picking a language stages it without importing', async ({ page }) => {
      const before = await currentKeyCount(page)
      const menu = await presets(page).openLanguageMenu('ANSI 104')

      await menu.locator(SELECTORS.PRESET.LANGUAGE_OPTION, { hasText: 'Polish' }).click()

      await expect(menu).toBeHidden()
      await expect(page.locator(SELECTORS.PRESET.MODAL)).toBeVisible()
      expect(await currentKeyCount(page)).toBe(before)
      // The card now advertises what a click would load.
      await expect(slot(page, 'ANSI 104').locator(SELECTORS.PRESET.LANGUAGE_TOGGLE)).toContainText(
        'PL',
      )
    })

    test('TC-PRESET-028 — clicking the card then imports the staged language', async ({ page }) => {
      await presets(page).selectPresetFromModal('ANSI 104', { language: 'Polish' })

      await expect(page.locator(SELECTORS.PRESET.MODAL)).toBeHidden()
      // Same board, different legends — the key count cannot change.
      await expectKeyCount(page, 104)
    })

    // The shortlist is a one-click shortcut; making it ask would cost every user a
    // click to answer a question most of them do not have.
    test('TC-PRESET-026 — the shortlist loads the default without asking', async ({ page }) => {
      await presets(page).selectPreset('ANSI 104')

      await expect(page.locator(SELECTORS.PRESET.LANGUAGE_MENU)).toBeHidden()
      await expectKeyCount(page, 104)
    })

    // The menu is positioned from a rect read once, so it must not survive a scroll
    // of the grid underneath it.
    test('TC-PRESET-027 — scrolling the grid dismisses the menu', async ({ page }) => {
      const menu = await presets(page).openLanguageMenu('ANSI 104')

      await page.locator('.preset-scroll-area').evaluate((el) => {
        el.scrollTop = 200
        el.dispatchEvent(new Event('scroll'))
      })

      await expect(menu).toBeHidden()
      await expect(page.locator(SELECTORS.PRESET.MODAL)).toBeVisible()
    })
  })
})
