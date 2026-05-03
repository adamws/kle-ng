import { describe, it, expect } from 'vitest'
import { escapeHtml, highlightMatches } from '../fuse-highlight'

describe('escapeHtml', () => {
  it('leaves plain ASCII strings unchanged', () => {
    expect(escapeHtml('ergodox_ez')).toBe('ergodox_ez')
    expect(escapeHtml('keebio/iris/rev6')).toBe('keebio/iris/rev6')
  })

  it('escapes ampersand', () => {
    expect(escapeHtml('foo&bar')).toBe('foo&amp;bar')
  })

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
  })

  it('escapes double quotes', () => {
    expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;')
  })
})

describe('highlightMatches', () => {
  it('returns plain escaped text when indices is empty', () => {
    expect(highlightMatches('ergodox_ez', [])).toBe('ergodox_ez')
  })

  it('wraps a single range in <mark>', () => {
    // "iris" in "keebio/iris/rev6" is at indices [7, 10]
    expect(highlightMatches('keebio/iris/rev6', [[7, 10]])).toBe('keebio/<mark>iris</mark>/rev6')
  })

  it('wraps multiple non-adjacent ranges', () => {
    // "dactyl" at [10,15] and "4x5" at [26,28] in "handwired/dactyl_manuform/4x5"
    expect(
      highlightMatches('handwired/dactyl_manuform/4x5', [
        [10, 15],
        [26, 28],
      ]),
    ).toBe('handwired/<mark>dactyl</mark>_manuform/<mark>4x5</mark>')
  })

  it('handles a match at position 0', () => {
    expect(highlightMatches('ergodox_ez', [[0, 6]])).toBe('<mark>ergodox</mark>_ez')
  })

  it('handles a match at the end', () => {
    expect(highlightMatches('ergodox_ez', [[8, 9]])).toBe('ergodox_<mark>ez</mark>')
  })

  it('escapes HTML in non-matched portions', () => {
    expect(highlightMatches('foo&<bar>', [[0, 2]])).toBe('<mark>foo</mark>&amp;&lt;bar&gt;')
  })

  it('handles unsorted indices by sorting them', () => {
    expect(
      highlightMatches('abcdef', [
        [3, 4],
        [0, 1],
      ]),
    ).toBe('<mark>ab</mark>c<mark>de</mark>f')
  })
})
