#!/usr/bin/env node
/**
 * Benchmark runner for annotation algorithms.
 *
 * Usage:
 *   npm run bench
 *   npm run bench -- --layout planck,ergodox
 *   npm run bench -- --algorithm current
 *   npm run bench -- --output json > out.json
 *   npm run bench -- --output markdown
 *   npm run bench -- --svg ./bench-svg/
 */
import { parseArgs } from 'node:util'
import { algorithms } from '../src/utils/matrix-annotation'
import { loadCorpus } from './corpus'
import { scoreResult, computeAggregate } from './scoring'
import type { LayoutScore, BenchReport } from './scoring'
import { renderTable, renderMarkdownTable } from './reporters/table'
import { renderJson } from './reporters/json'
import { writeSvgs } from './reporters/svg'
import { writeHtml } from './reporters/html'

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    layout: { type: 'string' },
    algorithm: { type: 'string' },
    output: { type: 'string', default: 'table' },
    svg: { type: 'string' },
    html: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
  strict: false,
})

if (values.help) {
  console.log(`
npm run bench [options]

Options:
  --layout <names>      Comma-separated layout names to run (default: all)
  --algorithm <names>   Comma-separated algorithm names to run (default: all)
  --output <format>     Output format: table (default), markdown, json
  --svg <dir>           Also write per-(layout,algorithm) SVG files to <dir>
  --html <file>         Write a single-page HTML report with inline SVGs
  -h, --help            Show this help
`)
  process.exit(0)
}

const layoutFilter = values.layout ? (values.layout as string).split(',') : undefined
const algoFilter = values.algorithm ? (values.algorithm as string).split(',') : undefined
const outputFormat = (values.output as string) || 'table'
const svgDir = values.svg as string | undefined
const htmlFile = values.html as string | undefined

// ---------------------------------------------------------------------------
// Load corpus and filter algorithms
// ---------------------------------------------------------------------------

const corpus = loadCorpus(layoutFilter)
if (corpus.length === 0) {
  console.error('No layouts found in bench/fixtures/ (all may be placeholders). Add JSON files to bench/fixtures/ and re-run.')
  process.exit(0)
}

const selectedAlgos = algoFilter
  ? algorithms.filter((a) => algoFilter.includes(a.name))
  : algorithms

if (selectedAlgos.length === 0) {
  console.error(
    `No algorithms matched: ${algoFilter?.join(', ')}. Available: ${algorithms.map((a) => a.name).join(', ')}`,
  )
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const scores: LayoutScore[] = []
const svgRuns: Parameters<typeof writeSvgs>[1] = []
const htmlRuns: Parameters<typeof writeHtml>[2] = []

console.error(`Running ${selectedAlgos.length} algorithm(s) on ${corpus.length} layout(s)...\n`)

for (const { name: layoutName, keys } of corpus) {
  for (const algo of selectedAlgos) {
    process.stderr.write(`  ${layoutName} / ${algo.name} ... `)
    const t0 = performance.now()
    const result = algo.annotate(keys)
    const durationMs = performance.now() - t0

    const score = scoreResult(algo.name, layoutName, keys, result, durationMs)
    scores.push(score)

    if (svgDir) {
      svgRuns.push({ layoutName, algorithmName: algo.name, keys, result })
    }
    if (htmlFile) {
      htmlRuns.push({ layoutName, algorithmName: algo.name, keys, result })
    }

    const status = score.qualified
      ? `OK  ${score.numRows}×${score.numCols}  wire=${score.wireLength.toFixed(2)}`
      : `FAIL (${score.unassignedKeys} unassigned)`
    process.stderr.write(`${status}  (${durationMs.toFixed(1)}ms)\n`)
  }
  process.stderr.write('\n')
}

// ---------------------------------------------------------------------------
// Build report and output
// ---------------------------------------------------------------------------

const aggregate = computeAggregate(scores)
const report: BenchReport = { scores, aggregate }

// Sort scores by layout then algorithm for stable output
report.scores.sort((a, b) => a.layout.localeCompare(b.layout) || a.algorithm.localeCompare(b.algorithm))

if (svgDir) {
  console.error(`Writing SVGs to ${svgDir} ...`)
  writeSvgs(svgDir, svgRuns)
}
if (htmlFile) {
  console.error(`Writing HTML report ...`)
  writeHtml(htmlFile, report, htmlRuns)
}

switch (outputFormat) {
  case 'json':
    console.log(renderJson(report))
    break
  case 'markdown':
    console.log(renderMarkdownTable(report))
    console.log()
    console.log(renderTable(report).split('\n').slice(report.scores.length + 5).join('\n'))
    break
  default:
    console.log(renderTable(report))
}
