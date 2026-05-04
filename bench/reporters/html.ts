import { writeFileSync } from 'node:fs'
import type { BenchReport, LayoutScore } from '../scoring'
import type { Key } from '../../src/stores/keyboard'
import type { AnnotationResult } from '../../src/utils/matrix-annotation'
import { renderSvg } from './svg'

interface SvgRun {
  layoutName: string
  algorithmName: string
  keys: ReadonlyArray<Key>
  result: AnnotationResult
}

function badge(s: LayoutScore): string {
  if (!s.qualified) {
    return `<span class="badge fail">FAIL — ${s.unassignedKeys} unassigned</span>`
  }
  return [
    `<span class="badge ok">✓ qualified</span>`,
    `<span class="badge dim">${s.numRows}×${s.numCols}</span>`,
    `<span class="badge wire">wire ${s.wireLength.toFixed(1)}</span>`,
    `<span class="badge ms">${s.durationMs.toFixed(1)} ms</span>`,
  ].join(' ')
}

function layoutSection(layoutName: string, scores: LayoutScore[], runs: SvgRun[]): string {
  const cols = scores.map((s) => {
    const run = runs.find((r) => r.layoutName === layoutName && r.algorithmName === s.algorithm)
    const svg = run ? renderSvg(layoutName, s.algorithm, run.keys, run.result) : ''
    return `
      <div class="algo-col">
        <div class="algo-header">
          <strong>${s.algorithm}</strong>
          <div class="badges">${badge(s)}</div>
        </div>
        <div class="svg-wrap">${svg}</div>
      </div>`
  })

  return `
    <section class="layout-section">
      <h2 class="layout-title">${layoutName}</h2>
      <div class="algo-grid">${cols.join('')}</div>
    </section>`
}

function aggregateSection(report: BenchReport): string {
  const { pareto, borda, weighted } = report.aggregate
  const algos = Object.keys(pareto).sort()

  const paretoRows = algos
    .map(
      (a) =>
        `<tr><td>${a}</td><td>${pareto[a]!.qualified}</td><td>${pareto[a]!.compactnessWins}</td><td>${pareto[a]!.wireLengthWins}</td></tr>`,
    )
    .join('')

  const bordaSorted = [...algos].sort((a, b) => (borda[b] ?? 0) - (borda[a] ?? 0))
  const bordaRows = bordaSorted
    .map((a, i) => `<tr><td>${i + 1}</td><td>${a}</td><td>${borda[a] ?? 0}</td></tr>`)
    .join('')

  const weightedSorted = [...algos].sort((a, b) => (weighted[a] ?? 0) - (weighted[b] ?? 0))
  const weightedRows = weightedSorted
    .map((a, i) => `<tr><td>${i + 1}</td><td>${a}</td><td>${(weighted[a] ?? 0).toFixed(4)}</td></tr>`)
    .join('')

  return `
    <section class="aggregate">
      <h2>Aggregate Rankings</h2>
      <div class="agg-tables">
        <div>
          <h3>Pareto wins</h3>
          <table>
            <thead><tr><th>Algorithm</th><th>Qualified</th><th>Compact wins</th><th>Wire wins</th></tr></thead>
            <tbody>${paretoRows}</tbody>
          </table>
        </div>
        <div>
          <h3>Borda count <small>(higher = better)</small></h3>
          <table>
            <thead><tr><th>#</th><th>Algorithm</th><th>Score</th></tr></thead>
            <tbody>${bordaRows}</tbody>
          </table>
        </div>
        <div>
          <h3>Weighted score <small>(lower = better)</small></h3>
          <table>
            <thead><tr><th>#</th><th>Algorithm</th><th>Score</th></tr></thead>
            <tbody>${weightedRows}</tbody>
          </table>
        </div>
      </div>
    </section>`
}

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: system-ui, sans-serif; background: #f4f4f5; color: #18181b; padding: 24px }
  h1 { font-size: 1.5rem; margin-bottom: 4px }
  .meta { font-size: 0.8rem; color: #71717a; margin-bottom: 32px }
  h2.layout-title {
    font-size: 1.1rem; background: #18181b; color: #fff;
    padding: 8px 16px; border-radius: 6px 6px 0 0; margin: 0;
  }
  .layout-section { margin-bottom: 40px }
  .algo-grid { display: flex; flex-wrap: wrap; gap: 0; border: 1px solid #d4d4d8; border-top: none; border-radius: 0 0 6px 6px; overflow: hidden }
  .algo-col { flex: 1 1 400px; border-right: 1px solid #d4d4d8; background: #fff }
  .algo-col:last-child { border-right: none }
  .algo-header { padding: 10px 14px; border-bottom: 1px solid #e4e4e7; background: #fafafa }
  .algo-header strong { display: block; font-size: 0.95rem; margin-bottom: 6px }
  .badges { display: flex; flex-wrap: wrap; gap: 6px }
  .badge { font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px; font-family: monospace }
  .badge.ok   { background: #dcfce7; color: #15803d }
  .badge.fail { background: #fee2e2; color: #b91c1c }
  .badge.dim  { background: #dbeafe; color: #1d4ed8 }
  .badge.wire { background: #fef9c3; color: #854d0e }
  .badge.ms   { background: #f3f4f6; color: #4b5563 }
  .svg-wrap { padding: 12px; overflow-x: auto }
  .svg-wrap svg { max-width: 100%; height: auto; display: block }
  section.aggregate { margin-bottom: 48px }
  section.aggregate h2 { font-size: 1.15rem; margin-bottom: 16px }
  .agg-tables { display: flex; flex-wrap: wrap; gap: 24px }
  .agg-tables > div { background: #fff; border: 1px solid #d4d4d8; border-radius: 6px; padding: 16px }
  h3 { font-size: 0.9rem; margin-bottom: 10px }
  h3 small { font-weight: normal; color: #71717a }
  table { border-collapse: collapse; font-size: 0.82rem }
  th, td { padding: 5px 12px; border-bottom: 1px solid #e4e4e7; text-align: left }
  th { background: #f4f4f5; font-weight: 600 }
  tr:last-child td { border-bottom: none }
`

export function renderHtml(report: BenchReport, runs: SvgRun[], generatedAt: string): string {
  const layouts = [...new Set(report.scores.map((s) => s.layout))]

  const sections = layouts.map((layout) => {
    const layoutScores = report.scores.filter((s) => s.layout === layout)
    return layoutSection(layout, layoutScores, runs)
  })

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Bench Report — ${generatedAt}</title>
  <style>${CSS}</style>
</head>
<body>
  <h1>Annotation Algorithm Benchmark</h1>
  <p class="meta">Generated ${generatedAt} &nbsp;·&nbsp; ${layouts.length} layout(s) &nbsp;·&nbsp; ${[...new Set(report.scores.map((s) => s.algorithm))].join(', ')}</p>
  ${aggregateSection(report)}
  ${sections.join('\n')}
</body>
</html>`
}

export function writeHtml(
  outFile: string,
  report: BenchReport,
  runs: SvgRun[],
): void {
  const html = renderHtml(report, runs, new Date().toISOString())
  writeFileSync(outFile, html, 'utf8')
  console.error(`  HTML: ${outFile}`)
}
