/**
 * v-tooltip: the Bootstrap tooltip the layout editor's canvas buttons use (search, copy
 * image, settings): hover only, mounted on body so no overflow clips it, in place of the
 * browser's native title. The argument is the placement (`v-tooltip:left="text"`,
 * default top); the text stays live, read at show time and updated in place while shown,
 * and an empty one shows nothing.
 *
 * A disabled .btn takes no pointer events, so its tooltip never shows; give such buttons
 * `pointer-events: auto` (browsers still don't click them) when their tooltip says why.
 */
import type { Directive } from 'vue'
import Tooltip from 'bootstrap/js/dist/tooltip'

type Placement = 'top' | 'bottom' | 'left' | 'right'

const texts = new WeakMap<HTMLElement, string>()

export const vTooltip: Directive<HTMLElement, string> = {
  mounted(el, { value, arg }) {
    texts.set(el, value ?? '')
    new Tooltip(el, {
      title: () => texts.get(el) ?? '',
      placement: (arg as Placement | undefined) ?? 'top',
      trigger: 'hover',
      container: 'body',
    })
  },
  updated(el, { value, oldValue }) {
    if (value === oldValue) return
    texts.set(el, value ?? '')
    Tooltip.getInstance(el)?.setContent({ '.tooltip-inner': value ?? '' })
  },
  beforeUnmount(el) {
    Tooltip.getInstance(el)?.dispose()
    texts.delete(el)
  },
}
