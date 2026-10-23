/**
 * Ghost key filtering for PCB generation.
 *
 * Ghost keys are not part of the switch matrix (matrix annotation and
 * validation skip them), so they may carry arbitrary labels such as `OLED`.
 * kbplacer releases before the ghost-key fix validate those labels as matrix
 * coordinates and fail with "Matrix coordinates label missing or invalid".
 *
 * TODO: temporary workaround, remove once the PCB worker runs a kbplacer
 * release which ignores ghost keys itself.
 */

/** Minimal shape of a key in the kle-internal export format. */
interface KleInternalKey {
  ghost?: boolean
  [key: string]: unknown
}

/** Minimal shape of the kle-internal export ({ meta, keys: [...] }). */
interface KleInternalLayout {
  keys?: KleInternalKey[]
  [key: string]: unknown
}

/**
 * Return a copy of a kle-internal layout without ghost keys, leaving the input
 * untouched. When the layout has no ghost keys the input is returned unchanged.
 */
export function stripGhostKeys<T>(layout: T): T {
  const typed = layout as KleInternalLayout | null
  if (!typed || !Array.isArray(typed.keys) || !typed.keys.some((key) => key.ghost)) {
    return layout
  }

  return {
    ...typed,
    keys: typed.keys.filter((key) => !key.ghost),
  } as T
}
