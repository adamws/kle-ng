import type { Key } from '@adamws/kle-serial'
import { D } from '../../decimal-math'
import type { FixableSanitizeRule } from '../types'

/**
 * A stepped key follows the KLE convention: the primary rect (Width/Height) is the
 * raised part and the second rect (X2/Y2/Width2/Height2) the whole cap. The lower
 * step is whatever of the second rect lies outside the primary one. When nothing
 * does — the key is rectangular, or the second rect is the smaller of the two, as
 * in `{"w":1.25,"w2":1,"l":true}` — there is no step to draw, and the flag has no
 * effect on the canvas, the exports or the plate.
 *
 * The second rect is then dead weight too: it sits entirely under the primary one,
 * so dropping it leaves the same outline and turns the key back into a plain
 * rectangle the properties panel can resize directly.
 */
function hasIneffectiveStep(key: Key): boolean {
  if (!key.stepped) return false
  const x2 = key.x2 || 0
  const y2 = key.y2 || 0
  const width2 = key.width2 || key.width
  const height2 = key.height2 || key.height
  return x2 >= 0 && y2 >= 0 && D.add(x2, width2) <= key.width && D.add(y2, height2) <= key.height
}

export const ineffectiveStepRule: FixableSanitizeRule = {
  id: 'ineffective-step',
  kind: 'redundancy',
  name: 'Ineffective steps',
  description: 'Stepped keys with no lower step',

  scan(keys) {
    return { count: keys.filter(hasIneffectiveStep).length }
  },

  fix(keys) {
    for (const key of keys) {
      if (!hasIneffectiveStep(key)) continue
      // Matches what kle-serial gives a plain rectangular key.
      key.stepped = false
      key.x2 = 0
      key.y2 = 0
      key.width2 = key.width
      key.height2 = key.height
    }
  },
}
