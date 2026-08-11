import { Serial, type Key, type Keyboard } from '@adamws/kle-serial'
import { convertQmkToKle } from '../qmk-import'
import { convertViaToKle } from '../via-import'
import { getQmkLayouts, collapseToQmkLayout } from '../qmk-layout-options'
import { getLayoutOptionGroups, collapseToLayoutChoices } from '../layout-options'

/**
 * Describes where previewable keyboard layouts come from and how to turn a raw
 * download into something the preview renderer can draw.
 *
 * Both sources reuse the exact converters the real import path uses
 * (`convertQmkToKle` / `convertViaToKle`), so a preview cannot drift from what
 * pressing Import actually produces.
 */

/** Maximum keys the keyboard store will accept — see loadKeyboard() in stores/keyboard.ts */
export const MAX_PREVIEW_KEYS = 1000

/** One drawable variant of a layout (a QMK `LAYOUT_*`, or a VIA option choice) */
export interface LayoutVariant {
  label: string
  keys: Key[]
}

export interface PreviewLayout {
  name: string
  /**
   * The parsed response exactly as downloaded. Kept so that pressing Import
   * after a preview can run the normal import path without a second request.
   */
  raw: unknown
  /** The full layout, exactly as Import would load it */
  keyboard: Keyboard
  /** Always contains at least one entry; `variants[0]` is the default view */
  variants: LayoutVariant[]
  keyCount: number
  /** True when the layout exceeds the store's key limit and cannot be imported */
  tooLarge: boolean
}

export interface LayoutSource {
  id: 'qmk' | 'via'
  /** Index of every available keyboard name */
  listUrl: string
  /** Where a single keyboard's definition lives */
  layoutUrl(name: string): string
  /** Convert a parsed JSON response into a previewable layout */
  toPreviewLayout(raw: unknown, name: string): PreviewLayout
}

function buildPreviewLayout(
  name: string,
  raw: unknown,
  keyboard: Keyboard,
  variants: LayoutVariant[],
): PreviewLayout {
  const keyCount = keyboard.keys.length
  return {
    name,
    raw,
    keyboard,
    variants: variants.length > 0 ? variants : [{ label: 'Layout', keys: keyboard.keys }],
    keyCount,
    tooLarge: keyCount > MAX_PREVIEW_KEYS,
  }
}

/* -------------------------------------------------------------------------- */
/* QMK                                                                        */
/* -------------------------------------------------------------------------- */

export const qmkLayoutSource: LayoutSource = {
  id: 'qmk',

  listUrl: 'https://keyboards.qmk.fm/v1/keyboard_list.json',

  layoutUrl(name: string) {
    return `https://keyboards.qmk.fm/v1/keyboards/${name}/info.json`
  },

  toPreviewLayout(raw: unknown, name: string): PreviewLayout {
    const envelope = raw as { keyboards?: Record<string, unknown> } | null
    const keyboardData = envelope?.keyboards?.[name]
    if (!keyboardData) {
      throw new Error(`Keyboard data not found for "${name}"`)
    }

    const keyboard = convertQmkToKle(keyboardData)

    // A QMK info.json usually declares several LAYOUT_* macros. convertQmkToKle
    // flattens all of them into one overlapping superset, so split them back
    // out for preview using the labels[9] membership tags it wrote.
    const layouts = getQmkLayouts(
      keyboard.keys,
      keyboard.meta as unknown as Record<string, unknown>,
    )
    const variants: LayoutVariant[] = layouts
      ? layouts.map(({ index, name: layoutName }) => ({
          label: layoutName,
          keys: collapseToQmkLayout(keyboard.keys, index),
        }))
      : [{ label: 'Layout', keys: keyboard.keys }]

    return buildPreviewLayout(name, raw, keyboard, variants)
  },
}

/* -------------------------------------------------------------------------- */
/* VIA                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Build the choice map that selects `choice` for `option` and choice 0 for
 * every other option group.
 */
function choiceMap(
  groups: ReturnType<typeof getLayoutOptionGroups>,
  option: number,
  choice: number,
): Map<number, number> {
  const map = new Map<number, number>()
  for (const group of groups) {
    map.set(group.option, group.option === option ? choice : 0)
  }
  return map
}

export const viaLayoutSource: LayoutSource = {
  id: 'via',

  listUrl: 'https://adamws.github.io/keyboard-pcbs/keyboard_list.json',

  layoutUrl(name: string) {
    return `https://raw.githubusercontent.com/the-via/keyboards/master/v3/${name}.json`
  },

  toPreviewLayout(raw: unknown, name: string): PreviewLayout {
    const keyboard = Serial.deserialize(convertViaToKle(raw) as Array<unknown>)

    const viaLabels = (raw as { layouts?: { labels?: unknown } } | null)?.layouts?.labels
    const groups = getLayoutOptionGroups(keyboard.keys, viaLabels)

    const variants: LayoutVariant[] = []

    // Default view: every option group at choice 0.
    const defaults = new Map<number, number>(groups.map((g) => [g.option, 0]))
    variants.push({
      label: groups.length > 0 ? 'Default' : 'Layout',
      keys: groups.length > 0 ? collapseToLayoutChoices(keyboard.keys, defaults) : keyboard.keys,
    })

    // One variant per non-zero choice, with every other group left at 0. This
    // stays linear in the number of choices — a full cross product of option
    // groups would explode on boards with several of them.
    for (const group of groups) {
      for (const choice of group.choices) {
        if (choice === 0) continue
        const groupName = group.groupLabel || `Option ${group.option}`
        const choiceName = group.choiceLabels?.[choice] || `Choice ${choice}`
        variants.push({
          label: `${groupName}: ${choiceName}`,
          keys: collapseToLayoutChoices(keyboard.keys, choiceMap(groups, group.option, choice)),
        })
      }
    }

    return buildPreviewLayout(name, raw, keyboard, variants)
  },
}
