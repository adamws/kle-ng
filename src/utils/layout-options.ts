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
 * A key together with the position it occupies in a collapsed layout.
 *
 * Collapsing translates alternative-layout keys onto their true location, which
 * means the position in the result is not the position stored on the key. A
 * placement carries the adjusted coordinates *beside* the original `Key` rather
 * than in a clone of it, so callers that need to point back at the layout — to
 * select the offending keys on canvas, say — still hold the real object.
 */
export interface KeyPlacement {
  key: Key
  x: number
  y: number
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
  // Shallow-clone so callers can't mutate the store's objects through the result.
  // Shallow is sufficient: collapsing only adjusts x/y (scalar properties).
  return collapseToLayoutChoicePlacements(keys, choices).map((placement) => ({
    ...placement.key,
    x: placement.x,
    y: placement.y,
  }))
}

/**
 * The placement-level form of {@link collapseToLayoutChoices}: same selection,
 * same translation, same de-duplication, but each entry points back at the
 * original `Key` instead of a clone.
 *
 * Use this when the caller needs to identify the keys it got back — reporting
 * them, selecting them on canvas. Use `collapseToLayoutChoices` when it just
 * needs a detached layout to render.
 *
 * The input array is NOT mutated.
 *
 * @param keys - Source key array (not mutated)
 * @param choices - Map of option → chosen choice index
 * @returns Placements for the relevant keys, positions adjusted
 */
export function collapseToLayoutChoicePlacements(
  keys: Key[],
  choices: Map<number, number>,
): KeyPlacement[] {
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
  const active: KeyPlacement[] = []
  for (const key of keys) {
    if (!key.ghost && !key.decal && parseOptionChoice(key) === null) {
      active.push({ key, x: key.x, y: key.y })
    }
  }

  // For each option group pick the right choice and translate non-zero choices.
  for (const [option, choiceMap] of optionGroups) {
    const targetChoice = choices.get(option) ?? 0
    const choiceKeys = choiceMap.get(targetChoice) ?? choiceMap.get(0) ?? []

    let dx = 0
    let dy = 0
    if (targetChoice !== 0) {
      const anchor = minXY(choiceMap.get(0) ?? [])
      const groupAnchor = minXY(choiceKeys)
      if (anchor && groupAnchor) {
        dx = anchor.x - groupAnchor.x
        dy = anchor.y - groupAnchor.y
      }
    }

    active.push(...choiceKeys.map((key) => ({ key, x: key.x + dx, y: key.y + dy })))
  }

  // Dedupe by (labels[0], rotated center x, rotated center y, decal flag)
  const seen = new Set<string>()
  const result: KeyPlacement[] = []
  for (const placement of active) {
    const center = placementCenter(placement)
    const cx = Math.round(center.x * 10000) / 10000
    const cy = Math.round(center.y * 10000) / 10000
    const dedupeKey = `${placement.key.labels[0]}|${cx}|${cy}|${placement.key.decal}`
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey)
      result.push(placement)
    }
  }

  return result
}

/**
 * Collapse a VIA-annotated key array into a SUPERSET physical layout: the default
 * (choice-0 / no-option) keys PLUS every de-duplicated alternative-layout key,
 * repositioned to overlay its true matrix location.
 *
 * This is the superset counterpart to collapseToLayoutChoices (which keeps only a
 * single chosen variant). The repositioning mirrors kbplacer's
 * MatrixAnnotatedKeyboard.collapse() (kicad-kbplacer/kbplacer/kle_serial.py,
 * lines ~456-510) so that a generated plate physically supports every layout
 * option — matching the PCB backend. De-duplication differs: kbplacer keys on the
 * matrix label (right for switch footprints), while a plate keys on cutout
 * geometry, so alternatives differing only in size/stabilizer are kept.
 *
 * Unlike collapseToLayoutChoices, ghost and decal keys are preserved as-is (the plate
 * outline path relies on ghost keys). The input array is NOT mutated.
 *
 * See docs/development/via-layout-collapsing.md.
 *
 * @param keys - Source key array (not mutated)
 * @returns New key array: default keys + repositioned, de-duplicated alternatives
 */
export function collapseViaLayout(keys: Key[]): Key[] {
  // De-duplication signature: everything that shapes a plate cutout — rotated
  // center, key size (incl. secondary rectangle, which drives stabilizers),
  // rotations and switch mount. The matrix label is deliberately NOT part of it:
  // the same label at the same center can still need a different stabilizer
  // (e.g. 1.75U vs 2.25U alternatives, issue #79).
  const signature = (key: Key): string => {
    const center = getKeyCenter(key)
    const cx = Math.round(center.x * 10000) / 10000
    const cy = Math.round(center.y * 10000) / 10000
    return [
      cx,
      cy,
      key.width,
      key.height,
      key.width2,
      key.height2,
      key.x2,
      key.y2,
      key.rotation_angle || 0,
      key.stabRotation || 0,
      key.switchRotation || 0,
      key.decal,
      key.sm,
    ].join('|')
  }

  // Group keys carrying an option/choice by option → choice (choice 0 kept as anchor).
  const optionGroups = new Map<number, Map<number, Key[]>>()
  for (const key of keys) {
    const oc = parseOptionChoice(key)
    if (!oc) continue
    if (!optionGroups.has(oc.option)) optionGroups.set(oc.option, new Map())
    const choiceMap = optionGroups.get(oc.option)!
    if (!choiceMap.has(oc.choice)) choiceMap.set(oc.choice, [])
    choiceMap.get(oc.choice)!.push(key)
  }

  // Pass-through = the default layout: keys with no option/choice OR choice === 0.
  // Ghost/decal keys are preserved here (plate outline relies on ghosts).
  const passThrough: Key[] = []
  for (const key of keys) {
    const oc = parseOptionChoice(key)
    if (!oc || oc.choice === 0) passThrough.push({ ...key })
  }

  // Seed the dedup set with every non-decal default key.
  const seen = new Set<string>()
  for (const key of passThrough) {
    if (!key.decal) seen.add(signature(key))
  }

  // For each option group, reposition non-zero choices onto the choice-0 anchor
  // and keep only keys not already present (de-duplicating coincident alternatives).
  const alternatives: Key[] = []
  for (const choiceMap of optionGroups.values()) {
    const anchor = minXY(choiceMap.get(0) ?? [])
    for (const [choice, choiceKeys] of choiceMap) {
      if (choice === 0) continue
      const groupAnchor = minXY(choiceKeys)
      const dx = anchor && groupAnchor ? anchor.x - groupAnchor.x : 0
      const dy = anchor && groupAnchor ? anchor.y - groupAnchor.y : 0
      for (const key of choiceKeys) {
        if (key.decal) continue // decals are never emitted as alternatives
        const moved = { ...key, x: key.x + dx, y: key.y + dy }
        const sig = signature(moved)
        if (!seen.has(sig)) {
          seen.add(sig)
          alternatives.push(moved)
        }
      }
    }
  }

  return [...passThrough, ...alternatives]
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

/**
 * Rotation-aware centre of a key at its placed position, which is not
 * necessarily the position stored on the key.
 */
function placementCenter(placement: KeyPlacement): { x: number; y: number } {
  const { key, x, y } = placement
  if (x === key.x && y === key.y) return getKeyCenter(key)
  return getKeyCenter({ ...key, x, y })
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
