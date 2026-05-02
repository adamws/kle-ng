import { Key, Serial } from '@adamws/kle-serial'
import LZString from 'lz-string'
import { D } from './decimal-math'

const matrixLabelPattern = /^(\d+),(\d+)$/

function isMatrixLabel(label: unknown): label is string {
  return typeof label === 'string' && matrixLabelPattern.test(label.trim())
}

interface QmkKey {
  matrix: [number, number]
  x: number
  y: number
  w?: number
  h?: number
  r?: number
  rx?: number
  ry?: number
}

interface QmkLayout {
  layout: QmkKey[]
}

interface StoredQmkData {
  keyboard_name?: string
  manufacturer?: string
  layouts?: Record<string, Record<string, never>>
  [key: string]: unknown
}

/** Round to 6 decimal places to remove floating-point noise from kle-serial arithmetic. */
function rd(v: number): number {
  return parseFloat(v.toFixed(6))
}

function isQmkKey(val: unknown): val is QmkKey {
  return (
    typeof val === 'object' &&
    val !== null &&
    !Array.isArray(val) &&
    'matrix' in val &&
    'x' in val &&
    'y' in val
  )
}

function compactQmkKey(key: QmkKey): string {
  const parts: string[] = [`"matrix": [${key.matrix.join(', ')}]`]
  for (const [k, v] of Object.entries(key)) {
    if (k !== 'matrix') parts.push(`${JSON.stringify(k)}: ${JSON.stringify(v)}`)
  }
  return `{${parts.join(', ')}}`
}

function stringifyValue(val: unknown, depth: number): string {
  if (val === null || typeof val !== 'object') return JSON.stringify(val)
  if (Array.isArray(val)) {
    if (val.length === 0) return '[]'
    const pad = '  '.repeat(depth + 1)
    const close = '  '.repeat(depth)
    return `[\n${val.map((item) => `${pad}${stringifyValue(item, depth + 1)}`).join(',\n')}\n${close}]`
  }
  if (isQmkKey(val)) return compactQmkKey(val)
  const keys = Object.keys(val as object)
  if (keys.length === 0) return '{}'
  const pad = '  '.repeat(depth + 1)
  const close = '  '.repeat(depth)
  const entries = keys.map(
    (k) =>
      `${pad}${JSON.stringify(k)}: ${stringifyValue((val as Record<string, unknown>)[k], depth + 1)}`,
  )
  return `{\n${entries.join(',\n')}\n${close}}`
}

/**
 * Returns true if any annotated key carries a labels[9] QMK membership tag
 * (semicolon-separated layout indices, e.g. "0", "1;2").
 * These are written by convertQmkToKle and are distinct from VIA option/choice.
 */
function hasQmkMembership(keys: Key[]): boolean {
  return keys.some((k) => {
    const v = k.labels[9]
    return typeof v === 'string' && v !== '' && /^\d+(;\d+)*$/.test(v)
  })
}

/**
 * Parse a labels[9] QMK membership string into an array of layout indices.
 * Returns null for shared keys (empty/absent label), meaning "include in all layouts".
 */
function parseQmkMembership(label: string | null | undefined): number[] | null {
  if (!label || label.trim() === '') return null
  const parts = label.split(';').map((s) => parseInt(s.trim(), 10))
  return parts.some(isNaN) ? null : parts
}

/** Serialize QMK info.json with layout key entries compacted to one line each. */
export function formatQmkJson(data: unknown): string {
  return stringifyValue(data, 0)
}

function minXY(keys: Key[]): { x: number; y: number } | null {
  if (keys.length === 0) return null
  let min = { x: keys[0]!.x, y: keys[0]!.y }
  for (const key of keys) {
    if (key.x < min.x || (key.x === min.x && key.y < min.y)) min = { x: key.x, y: key.y }
  }
  return min
}

/** Parse a "N,M" option/choice label at a specific label position. */
function parseAt(key: Key, pos: number): { option: number; choice: number } | null {
  const label = key.labels[pos]
  if (typeof label !== 'string' || !label.trim()) return null
  const m = label.trim().match(matrixLabelPattern)
  if (!m) return null
  const option = parseInt(m[1]!, 10)
  const choice = parseInt(m[2]!, 10)
  return isNaN(option) || isNaN(choice) ? null : { option, choice }
}

/**
 * Find the label position (1–11, skipping 0=matrix and 9=QMK membership) where
 * VIA-style "option,choice" labels are stored. Returns null if none found.
 */
function findOptionPos(keys: Key[]): number | null {
  for (const key of keys) {
    for (let pos = 1; pos < 12; pos++) {
      if (pos === 9) continue
      if (parseAt(key, pos) !== null) return pos
    }
  }
  return null
}

/**
 * Collapse a key array to a specific set of VIA option choices.
 * For each option group, picks the target choice (falling back to 0).
 * Non-zero choices are translated so their min(x,y) aligns with choice 0's anchor,
 * correcting the display-offset coordinates that VIA KLE files use.
 * Shared keys (no option/choice at `pos`) are always included.
 *
 * The input MUST include decal keys so that decal blockers (e.g. a phantom key placed
 * where a switch exists in one choice but not another) are included in the min(x,y)
 * anchor calculation. Decal keys and keys without matrix labels are stripped from the
 * returned array since they have no matrix position to reconstruct.
 */
function collapseVia(keys: Key[], pos: number, targetChoices: Map<number, number>): Key[] {
  const optionGroups = new Map<number, Map<number, Key[]>>()
  for (const key of keys) {
    const oc = parseAt(key, pos)
    if (!oc) continue
    if (!optionGroups.has(oc.option)) optionGroups.set(oc.option, new Map())
    const choiceMap = optionGroups.get(oc.option)!
    if (!choiceMap.has(oc.choice)) choiceMap.set(oc.choice, [])
    choiceMap.get(oc.choice)!.push(key)
  }

  const result: Key[] = []
  for (const key of keys) {
    if (!key.ghost && !key.decal && parseAt(key, pos) === null) result.push({ ...key })
  }

  for (const [option, choiceMap] of optionGroups) {
    const targetChoice = targetChoices.get(option) ?? 0
    const choiceKeys = choiceMap.get(targetChoice) ?? choiceMap.get(0) ?? []
    if (targetChoice !== 0) {
      const anchor = minXY(choiceMap.get(0) ?? [])
      const groupAnchor = minXY(choiceKeys)
      if (anchor && groupAnchor) {
        const dx = anchor.x - groupAnchor.x
        const dy = anchor.y - groupAnchor.y
        result.push(...choiceKeys.map((key) => ({ ...key, x: key.x + dx, y: key.y + dy })))
      } else {
        result.push(...choiceKeys.map((key) => ({ ...key })))
      }
    } else {
      result.push(...choiceKeys.map((key) => ({ ...key })))
    }
  }

  // Strip decal keys and keys without a matrix label — they have no QMK representation.
  return result.filter((k) => !k.decal && isMatrixLabel(k.labels[0]))
}

/**
 * Translate all keys so the key at matrix [0,0] lands at coordinates (0, 0).
 * Rotation origins (rx, ry) are also translated for keys with a non-zero rotation angle
 * so that their visual appearance is preserved after the shift.
 * Returns new shallow copies; the input array is not mutated.
 */
function normalizeLayoutToOrigin(keys: Key[]): Key[] {
  const origin = keys.find((k) => k.labels[0]?.trim() === '0,0')
  if (!origin || (origin.x === 0 && origin.y === 0)) return keys
  const dx = D.sub(0, origin.x)
  const dy = D.sub(0, origin.y)
  return keys.map((key) => {
    const moved: Key = { ...key, x: D.add(key.x, dx), y: D.add(key.y, dy) }
    if (key.rotation_angle !== 0) {
      moved.rotation_x = D.add(key.rotation_x, dx)
      moved.rotation_y = D.add(key.rotation_y, dy)
    }
    return moved
  })
}

function reconstructQmkKey(key: Key): QmkKey {
  const label = key.labels[0] ?? ''
  const parts = label.split(',').map(Number)
  const row = parts[0] ?? 0
  const col = parts[1] ?? 0

  const x = rd(key.x)
  const y = rd(key.y)
  const w = rd(key.width)
  const h = rd(key.height)
  const r = rd(key.rotation_angle)
  const rx = rd(key.rotation_x)
  const ry = rd(key.rotation_y)

  const qmkKey: QmkKey = { matrix: [row, col], x, y }

  if (w !== 1) qmkKey.w = w
  if (h !== 1) qmkKey.h = h
  if (r !== 0) qmkKey.r = r
  if (rx !== 0) qmkKey.rx = rx
  if (ry !== 0) qmkKey.ry = ry

  return qmkKey
}

function sortByMatrix(a: QmkKey, b: QmkKey): number {
  if (a.matrix[0] !== b.matrix[0]) return a.matrix[0] - b.matrix[0]
  return a.matrix[1] - b.matrix[1]
}

/**
 * Convert KLE keyboard data to QMK info.json format.
 *
 * Returns null if no regular keys have valid matrix coordinates in labels[0].
 *
 * Three export paths, tried in order:
 *
 * 1. QMK membership (labels[9]): keys imported from a multi-layout QMK file carry
 *    semicolon-separated layout indices in labels[9]. Reconstructs each named layout
 *    from the stored _kleng_qmk_data. Shared keys (empty/absent label[9]) appear in all.
 *
 * 2. VIA option/choice: keys carry "N,M" labels at some position 1–11 (position 0 is
 *    matrix, position 9 is QMK membership). The position is auto-detected. Generates one
 *    QMK layout per distinct choice configuration: LAYOUT (all options at choice 0) plus
 *    LAYOUT_option{N}_{C} for every non-default choice C of option N. Non-zero choices
 *    are translated to align with the choice-0 physical anchor before collapsing, fixing
 *    the display-offset coordinates that VIA KLE files use.
 *
 * 3. Plain layout: no option/choice labels. Deduplicate by physical identity
 *    (matrix + x + y + w + h + r + rx + ry) and export as a single LAYOUT_all (or the
 *    single stored layout name when _kleng_qmk_data carries exactly one layout).
 *
 * Floating-point noise from kle-serial's rotation-origin arithmetic is removed by
 * rounding all coordinates to 6 decimal places.
 */
export function convertKleToQmk(kleData: unknown): unknown | null {
  // Deserialize to Keyboard object
  let keyboard
  try {
    if (Array.isArray(kleData)) {
      keyboard = Serial.deserialize(kleData)
    } else if (
      typeof kleData === 'object' &&
      kleData !== null &&
      'keys' in kleData &&
      'meta' in kleData
    ) {
      keyboard = kleData as { keys: Key[]; meta: Record<string, unknown> }
    } else {
      return null
    }
  } catch {
    return null
  }

  const allKeys: Key[] = keyboard.keys as Key[]
  const meta = keyboard.meta as Record<string, unknown>

  // Filter to matrix-annotated regular keys
  const annotatedKeys = allKeys.filter(
    (key) => !key.decal && !key.ghost && isMatrixLabel(key.labels[0]),
  )

  if (annotatedKeys.length === 0) return null

  // Parse stored QMK metadata
  let storedQmk: StoredQmkData | null = null
  const storedRaw = meta._kleng_qmk_data
  if (typeof storedRaw === 'string') {
    try {
      const decompressed = LZString.decompressFromBase64(storedRaw)
      if (decompressed) {
        storedQmk = JSON.parse(decompressed) as StoredQmkData
      }
    } catch {
      // ignore corrupt data
    }
  }

  let layouts: Record<string, QmkLayout>

  if (hasQmkMembership(annotatedKeys) && storedQmk?.layouts) {
    // QMK membership path — used for keyboards imported via convertQmkToKle.
    // labels[9] carries semicolon-separated layout indices; absent/empty means shared.
    const storedLayoutNames = Object.keys(storedQmk.layouts)
    layouts = {}
    for (let i = 0; i < storedLayoutNames.length; i++) {
      const layoutKeys = annotatedKeys.filter((key) => {
        const membership = parseQmkMembership(key.labels[9])
        if (membership === null) return true // shared: include in every layout
        return membership.includes(i)
      })
      layouts[storedLayoutNames[i]!] = {
        layout: normalizeLayoutToOrigin(layoutKeys).map(reconstructQmkKey).sort(sortByMatrix),
      }
    }
  } else {
    // Use all non-ghost keys (including decal) so that decal blockers are included in the
    // min(x,y) anchor calculation inside collapseVia. Without them, choices that start with
    // a decal spacer produce wrong groupAnchor values and shift real keys by the wrong amount.
    const allNonGhost = allKeys.filter((k) => !k.ghost)
    const optPos = findOptionPos(allNonGhost)

    if (optPos !== null) {
      // VIA option/choice keyboard: generate one QMK layout per distinct choice configuration.
      // The default layout uses choice 0 for every option. Each non-default choice for each
      // option produces an additional layout with that one option overridden (all others stay 0).
      // Non-zero choices are translated to align with their choice-0 anchor so that the
      // display-offset coordinates used in VIA KLE files become physical coordinates.
      const optionGroups = new Map<number, Set<number>>()
      for (const key of allNonGhost) {
        const oc = parseAt(key, optPos)
        if (!oc) continue
        if (!optionGroups.has(oc.option)) optionGroups.set(oc.option, new Set([0]))
        optionGroups.get(oc.option)!.add(oc.choice)
      }

      layouts = {}
      const defaultKeys = collapseVia(allNonGhost, optPos, new Map())
      layouts['LAYOUT'] = {
        layout: normalizeLayoutToOrigin(defaultKeys).map(reconstructQmkKey).sort(sortByMatrix),
      }

      for (const [option, choiceSet] of [...optionGroups.entries()].sort(([a], [b]) => a - b)) {
        for (const choice of [...choiceSet].sort((a, b) => a - b)) {
          if (choice === 0) continue
          const choiceKeys = collapseVia(allNonGhost, optPos, new Map([[option, choice]]))
          layouts[`LAYOUT_option${option}_${choice}`] = {
            layout: normalizeLayoutToOrigin(choiceKeys).map(reconstructQmkKey).sort(sortByMatrix),
          }
        }
      }
    } else {
      // No VIA options: deduplicate by physical identity and export as a single layout.
      const seen = new Set<string>()
      const uniqueKeys: Key[] = []
      for (const key of annotatedKeys) {
        const id = JSON.stringify({
          matrix: key.labels[0],
          x: rd(key.x),
          y: rd(key.y),
          w: rd(key.width),
          h: rd(key.height),
          r: rd(key.rotation_angle),
          rx: rd(key.rotation_x),
          ry: rd(key.rotation_y),
        })
        if (!seen.has(id)) {
          seen.add(id)
          uniqueKeys.push(key)
        }
      }
      const storedNames = storedQmk?.layouts ? Object.keys(storedQmk.layouts) : []
      const layoutName = storedNames.length === 1 ? storedNames[0]! : 'LAYOUT_all'
      layouts = {
        [layoutName]: {
          layout: normalizeLayoutToOrigin(uniqueKeys).map(reconstructQmkKey).sort(sortByMatrix),
        },
      }
    }
  }

  // Build output
  const keyboardName = (meta.name as string) || undefined
  const manufacturer = (meta.author as string) || undefined

  if (storedQmk) {
    const { layouts: _storedLayouts, ...storedWithoutLayouts } = storedQmk
    void _storedLayouts
    return {
      ...storedWithoutLayouts,
      ...(keyboardName !== undefined ? { keyboard_name: keyboardName } : {}),
      ...(manufacturer !== undefined ? { manufacturer } : {}),
      layouts,
    }
  }

  return {
    ...(keyboardName !== undefined ? { keyboard_name: keyboardName } : {}),
    ...(manufacturer !== undefined ? { manufacturer } : {}),
    layouts,
  }
}
