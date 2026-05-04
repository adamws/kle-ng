import type { BenchReport, LayoutScore } from '../scoring'

const COL_WIDTHS = {
  layout: 30,
  algorithm: 12,
  qualified: 10,
  matrix: 10,
  wire: 10,
  ms: 7,
}

function pad(s: string, w: number): string {
  return s.slice(0, w).padEnd(w)
}

function fmt(n: number, decimals = 2): string {
  if (!isFinite(n)) return 'FAIL'
  return n.toFixed(decimals)
}

function header(): string {
  return [
    pad('Layout', COL_WIDTHS.layout),
    pad('Algorithm', COL_WIDTHS.algorithm),
    pad('Qualified', COL_WIDTHS.qualified),
    pad('Max(R,C)', COL_WIDTHS.matrix),
    pad('Wire', COL_WIDTHS.wire),
    pad('ms', COL_WIDTHS.ms),
  ].join(' | ')
}

function divider(): string {
  return Object.values(COL_WIDTHS)
    .map((w) => '-'.repeat(w))
    .join('-+-')
}

function row(s: LayoutScore): string {
  return [
    pad(s.layout, COL_WIDTHS.layout),
    pad(s.algorithm, COL_WIDTHS.algorithm),
    pad(s.qualified ? 'yes' : 'NO', COL_WIDTHS.qualified),
    pad(s.qualified ? `${s.numRows}x${s.numCols}` : '-', COL_WIDTHS.matrix),
    pad(s.qualified ? fmt(s.wireLength) : '-', COL_WIDTHS.wire),
    pad(fmt(s.durationMs, 1), COL_WIDTHS.ms),
  ].join(' | ')
}

export function renderTable(report: BenchReport): string {
  const lines: string[] = []

  lines.push('## Per-Layout Results')
  lines.push('')
  lines.push(header())
  lines.push(divider())

  let lastLayout = ''
  for (const s of report.scores) {
    if (s.layout !== lastLayout && lastLayout !== '') lines.push('')
    lastLayout = s.layout
    lines.push(row(s))
  }

  lines.push('')
  lines.push('## Aggregate Rankings')
  lines.push('')

  const { pareto, borda, weighted } = report.aggregate
  const algos = Object.keys(pareto).sort()

  lines.push('### Pareto wins (qualified layouts / compactness wins / wire-length wins)')
  for (const a of algos) {
    const p = pareto[a]!
    lines.push(`  ${a.padEnd(16)} qualified=${p.qualified}  compact=${p.compactnessWins}  wire=${p.wireLengthWins}`)
  }

  lines.push('')
  lines.push('### Borda count (higher is better)')
  const bordaSorted = algos.sort((a, b) => (borda[b] ?? 0) - (borda[a] ?? 0))
  bordaSorted.forEach((a, i) => lines.push(`  ${i + 1}. ${a.padEnd(16)} ${borda[a] ?? 0}`))

  lines.push('')
  lines.push('### Normalized weighted score (lower is better)')
  const weightedSorted = algos.sort((a, b) => (weighted[a] ?? 0) - (weighted[b] ?? 0))
  weightedSorted.forEach((a, i) =>
    lines.push(`  ${i + 1}. ${a.padEnd(16)} ${fmt(weighted[a] ?? 0, 4)}`),
  )

  return lines.join('\n')
}

export function renderMarkdownTable(report: BenchReport): string {
  const lines: string[] = []

  lines.push('| Layout | Algorithm | Qualified | Matrix | Wire length | ms |')
  lines.push('|--------|-----------|-----------|--------|-------------|-----|')

  for (const s of report.scores) {
    const q = s.qualified ? '✓' : '✗'
    const matrix = s.qualified ? `${s.numRows}×${s.numCols}` : '—'
    const wire = s.qualified ? fmt(s.wireLength) : '—'
    lines.push(
      `| ${s.layout} | ${s.algorithm} | ${q} | ${matrix} | ${wire} | ${fmt(s.durationMs, 1)} |`,
    )
  }

  return lines.join('\n')
}
