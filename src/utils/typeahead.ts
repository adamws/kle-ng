/**
 * Type-ahead for option lists, after the WAI-ARIA APG menu pattern: typing jumps to
 * the next option whose label starts with what was typed.
 *
 * This module is the matching only. The caller owns the key buffer and its timeout,
 * because those belong to one open menu and have to be reset when it closes.
 */

/** Case- and diacritic-insensitive form, so `m`,`a` finds "Māori". */
export function foldForTypeahead(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()
}

/** True for a keypress that should feed the buffer rather than act as a command. */
export function isTypeaheadKey(event: KeyboardEvent, bufferEmpty: boolean): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false
  if ([...event.key].length !== 1) return false // 'ArrowDown', 'Enter', 'Dead', …
  // A leading Space activates the focused option; only mid-word ("british e…") is it text.
  return event.key !== ' ' || !bufferEmpty
}

export interface TypeaheadItem {
  /** What the user reads and types, e.g. "Polish". Matched first. */
  label: string
  /** Optional secondary key, e.g. "pl". Matched only when no label does. */
  alias?: string
}

/**
 * Index of the option `query` should move to, or -1 for no match.
 *
 * - A single character searches from the option AFTER `current`, so pressing the same
 *   letter again cycles through everything starting with it.
 * - So does a run of one repeated character ("sss"): it is the cycling gesture, not a
 *   search for a label starting with "sss".
 * - A longer query searches from `current` itself, so an option that still matches
 *   the extended prefix keeps focus ("p" → Persian, "pe" stays on Persian).
 *
 * Labels are searched first across the whole wrapped list; aliases only if no label
 * matches, so a code never beats a name.
 */
export function typeaheadIndex(items: readonly TypeaheadItem[], query: string, current: number) {
  const q = foldForTypeahead(query)
  if (!q || items.length === 0) return -1

  const chars = [...q]
  const cycling = chars.every((c) => c === chars[0])
  const needle = cycling ? chars[0]! : q
  const start = cycling ? current + 1 : Math.max(current, 0)

  const scan = (field: (item: TypeaheadItem) => string | undefined) => {
    for (let step = 0; step < items.length; step++) {
      const index = (((start + step) % items.length) + items.length) % items.length
      const value = field(items[index]!)
      if (value && foldForTypeahead(value).startsWith(needle)) return index
    }
    return -1
  }

  const byLabel = scan((item) => item.label)
  return byLabel !== -1 ? byLabel : scan((item) => item.alias)
}
