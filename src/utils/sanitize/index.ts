import type { Key } from '@adamws/kle-serial'
import type { SanitizeRule, SanitizeRuleKind, SanitizeScanResult } from './types'
import { coordinateOffsetRule } from './rules/coordinate-offset.rule'
import { rotationAngleRule } from './rules/rotation-angle.rule'
import { whitespaceLabelRule } from './rules/whitespace-label.rule'
import { blankLabelTextSizeRule } from './rules/blank-label-text-size.rule'
import { blankLabelTextColorRule } from './rules/blank-label-text-color.rule'
import { staleRotationOriginRule } from './rules/stale-rotation-origin.rule'
import { staleStabilizerRotationRule } from './rules/stale-stabilizer-rotation.rule'
import { ineffectiveStepRule } from './rules/ineffective-step.rule'
import { keyCollisionsRule } from './rules/key-collisions.rule'

export type {
  SanitizeRule,
  FixableSanitizeRule,
  SanitizeRuleKind,
  SanitizeScanResult,
} from './types'
export { isLabelBlank } from './label-utils'

/**
 * The rule registry.
 *
 * Registry order must not be load-bearing. `applySanitizeFixes` iterates in array
 * order, which makes it tempting to let one rule clean up after another — don't.
 * Rules are individually selectable in the UI, so any rule that only produces
 * correct output when a later rule also runs is broken for every user who unchecks
 * that later rule. Each `fix()` must leave the layout in a state where every rule's
 * `scan()` is accurate, its own and every other rule's alike.
 *
 * To add a rule: drop a new `*.rule.ts` in `./rules` implementing `SanitizeRule`
 * (including its `kind`) and add it here. The panel UI, its grouping, scan
 * orchestration, Apply logic, and the result tally all pick it up automatically.
 * A rule that reports without fixing simply omits `fix`.
 */
export const SANITIZE_RULES: SanitizeRule[] = [
  coordinateOffsetRule,
  rotationAngleRule,
  whitespaceLabelRule,
  blankLabelTextSizeRule,
  blankLabelTextColorRule,
  staleRotationOriginRule,
  staleStabilizerRotationRule,
  ineffectiveStepRule,
  keyCollisionsRule,
]

export interface SanitizeCategorySummary extends SanitizeScanResult {
  ruleId: string
  kind: SanitizeRuleKind
  name: string
  description: string
  /** Whether the rule has a `fix`. Warning-only rules report but never act. */
  fixable: boolean
}

export function scanLayout(keys: Key[]): SanitizeCategorySummary[] {
  return SANITIZE_RULES.map((rule) => ({
    ruleId: rule.id,
    kind: rule.kind,
    name: rule.name,
    description: rule.description,
    fixable: typeof rule.fix === 'function',
    ...rule.scan(keys),
  }))
}

/**
 * Applies the named rules to `keys` in place. Rules not named are left alone,
 * including any issues they would have reported. Naming a rule that has no
 * `fix` is a no-op rather than an error — the caller may be passing through a
 * selection it did not curate.
 */
export function applySanitizeFixes(keys: Key[], ruleIds: readonly string[]): void {
  const idSet = new Set(ruleIds)
  for (const rule of SANITIZE_RULES) {
    if (idSet.has(rule.id)) rule.fix?.(keys)
  }
}
