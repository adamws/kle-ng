import type { BenchReport } from '../scoring'

export function renderJson(report: BenchReport): string {
  return JSON.stringify(report, null, 2)
}
