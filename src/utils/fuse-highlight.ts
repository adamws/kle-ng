export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Wraps Fuse.js match ranges in <mark> tags.
 * @param text    - original string (e.g. "keebio/iris/rev6")
 * @param indices - array of [start, end] inclusive pairs from Fuse.RangeTuple[]
 */
export function highlightMatches(text: string, indices: readonly [number, number][]): string {
  if (!indices.length) return escapeHtml(text)

  const sorted = [...indices].sort((a, b) => a[0] - b[0])
  let result = ''
  let cursor = 0

  for (const [start, end] of sorted) {
    result += escapeHtml(text.slice(cursor, start))
    result += `<mark>${escapeHtml(text.slice(start, end + 1))}</mark>`
    cursor = end + 1
  }
  result += escapeHtml(text.slice(cursor))
  return result
}
