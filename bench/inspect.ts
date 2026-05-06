/**
 * Inspection script: print (row, col) assignment + center coordinates for each
 * regular key. Useful for spotting non-human-like assignments in ergo layouts.
 *
 * Usage:
 *   node bench/inspect.mjs <layout-name> [algorithm-name]
 */
import { algorithms } from '../src/utils/matrix-annotation'
import { loadCorpus } from './corpus'
import { getKeyCenter } from '../src/utils/keyboard-geometry'

const layoutName = process.argv[2]
const algoName = process.argv[3] ?? 'cluster'

if (!layoutName) {
  console.error('Usage: node bench/inspect.mjs <layout-name> [algorithm-name]')
  process.exit(1)
}

const corpus = loadCorpus([layoutName])
if (corpus.length === 0) {
  console.error(`Layout not found: ${layoutName}`)
  process.exit(1)
}

const algo = algorithms.find((a) => a.name === algoName)
if (!algo) {
  console.error(`Algorithm not found: ${algoName}. Available: ${algorithms.map((a) => a.name).join(', ')}`)
  process.exit(1)
}

const { keys } = corpus[0]!
const result = algo.annotate(keys)

console.log(`# ${layoutName} / ${algoName}`)
console.log(`# status: ${result.status}`)

interface Row {
  i: number
  cx: string
  cy: string
  r: string
  c: string
  rotation: string
}

const rows: Row[] = []
keys.forEach((k, i) => {
  if (k.ghost || k.decal) return
  const c = getKeyCenter(k as never)
  const a = result.assignments[i]
  rows.push({
    i,
    cx: c.x.toFixed(3),
    cy: c.y.toFixed(3),
    r: a == null || a.row == null ? '-' : String(a.row),
    c: a == null || a.col == null ? '-' : String(a.col),
    rotation: k.rotation_angle ? k.rotation_angle.toFixed(1) : '0',
  })
})

console.log('idx | cx       | cy       | rot   | row | col')
console.log('----+----------+----------+-------+-----+----')
rows.forEach((r) => {
  console.log(
    `${String(r.i).padStart(3)} | ${r.cx.padStart(8)} | ${r.cy.padStart(8)} | ${r.rotation.padStart(5)} | ${r.r.padStart(3)} | ${r.c.padStart(3)}`,
  )
})

// Group by assigned row, sorted by col
const rowGroups = new Map<number, typeof rows>()
rows.forEach((r) => {
  const rNum = r.r === '-' ? -1 : Number(r.r)
  if (!rowGroups.has(rNum)) rowGroups.set(rNum, [])
  rowGroups.get(rNum)!.push(r)
})

console.log('\n# Per-row contents (sorted by col)')
const sortedRowNums = [...rowGroups.keys()].sort((a, b) => a - b)
sortedRowNums.forEach((rn) => {
  const list = rowGroups.get(rn)!.slice().sort((a, b) => Number(a.c) - Number(b.c))
  console.log(
    `row ${rn}: ${list
      .map((r) => `(${r.c} idx=${r.i} cx=${r.cx} cy=${r.cy})`)
      .join(' ')}`,
  )
})

// Group by assigned col, sorted by row
const colGroups = new Map<number, typeof rows>()
rows.forEach((r) => {
  const cNum = r.c === '-' ? -1 : Number(r.c)
  if (!colGroups.has(cNum)) colGroups.set(cNum, [])
  colGroups.get(cNum)!.push(r)
})

console.log('\n# Per-col contents (sorted by row)')
const sortedColNums = [...colGroups.keys()].sort((a, b) => a - b)
sortedColNums.forEach((cn) => {
  const list = colGroups.get(cn)!.slice().sort((a, b) => Number(a.r) - Number(b.r))
  console.log(
    `col ${cn}: ${list
      .map((r) => `(${r.r} idx=${r.i} cx=${r.cx} cy=${r.cy})`)
      .join(' ')}`,
  )
})
