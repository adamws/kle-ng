/**
 * VIA rotary encoder detection for PCB generation.
 *
 * VIA annotates rotary encoder switches by placing an encoder label (`e0`,
 * `e1`, ...) at the center label position. In the serialized kle-internal
 * format the `labels` array is always the 12-element positional layout, so the
 * center label is at index 4 regardless of the key's alignment (`a`).
 *
 * kbplacer expects encoder switches to be marked with the kle-ng switch-mount
 * property `sm="rot_ec11"` instead. This mirrors kbplacer's
 * `apply_via_encoder_switch_mount` so the backend can place encoder footprints
 * for VIA-imported layouts.
 */

/** Center label position in the 12-element positional `labels` array. */
const VIA_ENCODER_LABEL_INDEX = 4

/** VIA encoder labels are `e` followed by a numeric index, e.g. `e0`, `e1`. */
const VIA_ENCODER_LABEL_PATTERN = /^e\d+$/

/** Switch-mount value kbplacer uses to place a rotary encoder footprint. */
const ROTARY_ENCODER_SWITCH_MOUNT = 'rot_ec11'

/** Minimal shape of a key in the kle-internal export format. */
interface KleInternalKey {
  labels?: (string | null)[]
  sm?: string
  [key: string]: unknown
}

/** Minimal shape of the kle-internal export ({ meta, keys: [...] }). */
interface KleInternalLayout {
  keys?: KleInternalKey[]
  [key: string]: unknown
}

function isViaEncoderKey(key: KleInternalKey): boolean {
  const label = key.labels?.[VIA_ENCODER_LABEL_INDEX]
  return typeof label === 'string' && VIA_ENCODER_LABEL_PATTERN.test(label)
}

/**
 * Return a copy of a kle-internal layout with `sm="rot_ec11"` set on every key
 * carrying a VIA encoder label, leaving the input untouched.
 *
 * When the layout has no VIA encoders (the common case) the input is returned
 * unchanged, so no allocation happens on the hot path. The center encoder label
 * is intentionally preserved (kbplacer clears it on its side); only the value
 * sent to the backend is augmented.
 */
export function applyViaEncoderSwitchMount<T>(layout: T): T {
  const typed = layout as KleInternalLayout | null
  if (!typed || !Array.isArray(typed.keys) || !typed.keys.some(isViaEncoderKey)) {
    return layout
  }

  return {
    ...typed,
    keys: typed.keys.map((key) =>
      isViaEncoderKey(key) ? { ...key, sm: ROTARY_ENCODER_SWITCH_MOUNT } : key,
    ),
  } as T
}
