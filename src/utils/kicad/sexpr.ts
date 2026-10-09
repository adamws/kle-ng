/**
 * Minimal s-expression parser for KiCad files (.kicad_mod, .kicad_pcb).
 *
 * Handles both the quoted (KiCad 6+) and unquoted (KiCad 5 `module`) syntax.
 * Atoms stay strings: KiCad mixes symbols, numbers and strings freely, and
 * only the caller knows which is which (`(pad "1" ...)` vs `(pad 1 ...)`).
 *
 * Runs in the browser and in Node (scripts/generate-footprint-pads.mjs), so it
 * has no dependencies and uses only erasable TypeScript syntax.
 */

export type SExpr = string | SExpr[]

export class SExprError extends Error {}

/** Parses one s-expression, ignoring anything after it. */
export function parseSExpr(text: string): SExpr {
  let i = 0
  const n = text.length

  const skipSpace = () => {
    while (i < n && /\s/.test(text[i]!)) i++
  }

  const parseString = (): string => {
    i++ // opening quote
    let out = ''
    while (i < n) {
      const c = text[i]!
      if (c === '"') {
        i++
        return out
      }
      if (c === '\\' && i + 1 < n) {
        const e = text[i + 1]!
        out += e === 'n' ? '\n' : e === 't' ? '\t' : e
        i += 2
        continue
      }
      out += c
      i++
    }
    throw new SExprError('Unterminated string')
  }

  const parseAtom = (): string => {
    const start = i
    while (i < n && !/[\s()"]/.test(text[i]!)) i++
    return text.slice(start, i)
  }

  const parseNode = (): SExpr => {
    skipSpace()
    if (i >= n) throw new SExprError('Unexpected end of input')
    const c = text[i]!
    if (c === '(') {
      i++
      const list: SExpr[] = []
      for (;;) {
        skipSpace()
        if (i >= n) throw new SExprError('Unterminated list')
        if (text[i] === ')') {
          i++
          return list
        }
        list.push(parseNode())
      }
    }
    if (c === ')') throw new SExprError(`Unexpected ')' at ${i}`)
    if (c === '"') return parseString()
    return parseAtom()
  }

  return parseNode()
}

/** The head symbol of a list, or undefined for an atom or empty list. */
export function head(node: SExpr): string | undefined {
  return Array.isArray(node) && typeof node[0] === 'string' ? node[0] : undefined
}

/** Child lists of `node` whose head is `name`. */
export function children(node: SExpr, name: string): SExpr[][] {
  if (!Array.isArray(node)) return []
  return node.filter((c): c is SExpr[] => head(c) === name)
}

/** The first child list of `node` whose head is `name`. */
export function child(node: SExpr, name: string): SExpr[] | undefined {
  return children(node, name)[0]
}

/** The atom at `index` of a list, if it is an atom. */
export function atom(node: SExpr[] | undefined, index: number): string | undefined {
  const v = node?.[index]
  return typeof v === 'string' ? v : undefined
}

/** The number at `index` of a list; throws when it is missing or not a number. */
export function num(node: SExpr[] | undefined, index: number): number {
  const v = atom(node, index)
  const parsed = v === undefined ? NaN : Number(v)
  if (!Number.isFinite(parsed)) {
    throw new SExprError(`Expected a number at ${index} in (${head(node ?? []) ?? '?'} ...)`)
  }
  return parsed
}
