import { StateField, StateEffect, type Extension } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view'

/**
 * Represents a character range to highlight in the editor
 */
export interface HighlightRange {
  from: number
  to: number
}

/**
 * Effect to update highlighted ranges in the editor
 */
export const setHighlightedRanges = StateEffect.define<HighlightRange[]>()

/**
 * Decoration mark for highlighted keys
 */
const highlightMark = Decoration.mark({ class: 'cm-key-highlight' })

/**
 * StateField to track the current decoration set based on highlighted ranges
 */
const highlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(decorations, tr) {
    // Check for highlight range effects
    for (const effect of tr.effects) {
      if (effect.is(setHighlightedRanges)) {
        const ranges = effect.value
        if (ranges.length === 0) {
          return Decoration.none
        }

        // Sort ranges by position and filter valid ones
        const docLength = tr.state.doc.length
        const validRanges = ranges
          .filter((r) => r.from >= 0 && r.to <= docLength && r.from < r.to)
          .sort((a, b) => a.from - b.from)

        if (validRanges.length === 0) {
          return Decoration.none
        }

        // Create decorations from ranges
        const decorationRanges = validRanges.map((range) =>
          highlightMark.range(range.from, range.to),
        )

        return Decoration.set(decorationRanges)
      }
    }

    // Map decorations through document changes
    return decorations.map(tr.changes)
  },
  provide: (field) => EditorView.decorations.from(field),
})

/**
 * Theme for key highlighting
 */
const highlightTheme = EditorView.baseTheme({
  '.cm-key-highlight': {
    backgroundColor: 'rgba(255, 213, 79, 0.4)',
    borderRadius: '2px',
  },
})

/**
 * Creates the key highlighting extension for CodeMirror
 * @returns Extension array containing the highlight field and theme
 */
export function keyHighlightExtension(): Extension {
  return [highlightField, highlightTheme]
}
