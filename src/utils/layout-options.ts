/**
 * Layout option utilities for VIA-annotated keyboards.
 *
 * Implements getLayoutOptionGroups and collapseToLayoutChoice.
 * collapseToLayoutChoice is a TypeScript port of kbplacer's
 * MatrixAnnotatedKeyboard.collapse() method.
 * Ported from kbplacer @ https://github.com/adamws/kicad-kbplacer
 *   file: kbplacer/kle_serial.py, class: MatrixAnnotatedKeyboard
 *
 * v1 constraint: only labels[8] is used as the option/choice discriminator.
 * Hand-authored KLE files storing option/choice at other indices (e.g., labels[3])
 * are not supported. See qmk-export.ts for the dynamic discriminator approach.
 *
 * Always import parseOptionChoice from matrix-validation.ts (the Key-taking variant),
 * NOT from qmk-export.ts (which takes a string and is scoped to that module).
 */

import type { Key } from '@/stores/keyboard'
import { parseOptionChoice } from '@/utils/matrix-validation'
import { getKeyCenter } from '@/utils/keyboard-geometry'

export interface LayoutOptionGroup {
  option: number
  choices: number[]
  groupLabel?: string
  choiceLabels?: string[]
}

/**
 * Enumerate layout option groups from a key array, optionally enriched with
 * VIA layouts.labels metadata.
 *
 * @param keys - Array of keys to scan
 * @param viaLabels - VIA layouts.labels (typed as unknown; malformed input degrades gracefully)
 * @returns Sorted array of LayoutOptionGroup (by option index)
 */
export function getLayoutOptionGroups(keys: Key[], viaLabels?: unknown): LayoutOptionGroup[] {
  const groupMap = new Map<number, Set<number>>()

  for (const key of keys) {
    if (key.ghost || key.decal) continue
    const oc = parseOptionChoice(key)
    if (!oc) continue
    if (!groupMap.has(oc.option)) {
      groupMap.set(oc.option, new Set([0]))
    }
    groupMap.get(oc.option)!.add(oc.choice)
  }

  if (groupMap.size === 0) return []

  const parsedLabels = parseViaLabels(viaLabels)

  return Array.from(groupMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([option, choiceSet]) => {
      const choices = Array.from(choiceSet).sort((a, b) => a - b)
      const entry: LayoutOptionGroup = { option, choices }
      const labelInfo = parsedLabels[option]
      if (labelInfo) {
        if (labelInfo.groupLabel !== undefined) entry.groupLabel = labelInfo.groupLabel
        if (labelInfo.choiceLabels !== undefined) entry.choiceLabels = labelInfo.choiceLabels
      }
      return entry
    })
}

/**
 * Collapse a key array to show the keys matching a per-option choice map.
 * Keys in option groups not present in the map fall back to choice 0.
 * Positions of non-zero-choice keys are translated to overlay the choice-0 anchor.
 *
 * The input array is NOT mutated — a deep clone is always made first.
 *
 * @param keys - Source key array (not mutated)
 * @param choices - Map of option → chosen choice index
 * @returns New key array with only the relevant keys, positions adjusted
 */
export function collapseToLayoutChoices(keys: Key[], choices: Map<number, number>): Key[] {
  // Build option→choice→keys map against originals (no upfront clone needed)
  const optionGroups = new Map<number, Map<number, Key[]>>()
  for (const key of keys) {
    const oc = parseOptionChoice(key)
    if (!oc) continue
    if (!optionGroups.has(oc.option)) optionGroups.set(oc.option, new Map())
    const choiceMap = optionGroups.get(oc.option)!
    if (!choiceMap.has(oc.choice)) choiceMap.set(oc.choice, [])
    choiceMap.get(oc.choice)!.push(key)
  }

  // Always include keys with no option,choice.
  // Shallow-clone each key so callers can't mutate the store's objects through the result.
  const activeKeys: Key[] = []
  for (const key of keys) {
    if (!key.ghost && !key.decal && parseOptionChoice(key) === null) {
      activeKeys.push({ ...key })
    }
  }

  // For each option group pick the right choice and translate non-zero choices.
  // Shallow-copy is sufficient: this function only modifies x/y (scalar properties).
  for (const [option, choiceMap] of optionGroups) {
    const targetChoice = choices.get(option) ?? 0
    const choiceKeys = choiceMap.get(targetChoice) ?? choiceMap.get(0) ?? []

    if (targetChoice !== 0) {
      const choice0Keys = choiceMap.get(0) ?? []
      const anchor = minXY(choice0Keys)
      const groupAnchor = minXY(choiceKeys)
      if (anchor && groupAnchor) {
        const dx = anchor.x - groupAnchor.x
        const dy = anchor.y - groupAnchor.y
        activeKeys.push(...choiceKeys.map((key) => ({ ...key, x: key.x + dx, y: key.y + dy })))
      } else {
        activeKeys.push(...choiceKeys.map((key) => ({ ...key })))
      }
    } else {
      activeKeys.push(...choiceKeys.map((key) => ({ ...key })))
    }
  }

  // Dedupe by (labels[0], rotated center x, rotated center y, decal flag)
  const seen = new Set<string>()
  const result: Key[] = []
  for (const key of activeKeys) {
    const center = getKeyCenter(key)
    const cx = Math.round(center.x * 10000) / 10000
    const cy = Math.round(center.y * 10000) / 10000
    const dedupeKey = `${key.labels[0]}|${cx}|${cy}|${key.decal}`
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey)
      result.push(key)
    }
  }

  return result
}

// --- internal helpers ---

interface LabelInfo {
  groupLabel?: string
  choiceLabels?: string[]
}

function parseViaLabels(viaLabels: unknown): LabelInfo[] {
  if (!Array.isArray(viaLabels)) return []

  return (viaLabels as unknown[]).map((entry): LabelInfo => {
    if (typeof entry === 'string') {
      return { groupLabel: entry }
    }
    if (Array.isArray(entry) && entry.every((e) => typeof e === 'string')) {
      const [groupLabel, ...rest] = entry as string[]
      return {
        groupLabel,
        choiceLabels: rest.length > 0 ? rest : undefined,
      }
    }
    return {}
  })
}

function minXY(keys: Key[]): { x: number; y: number } | null {
  if (keys.length === 0) return null
  let min = { x: keys[0]!.x, y: keys[0]!.y }
  for (const key of keys) {
    if (key.x < min.x || (key.x === min.x && key.y < min.y)) {
      min = { x: key.x, y: key.y }
    }
  }
  return min
}
