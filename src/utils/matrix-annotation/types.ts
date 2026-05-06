import type { Key } from '@/stores/keyboard'

export type AssignmentStatus = 'success' | 'partial' | 'disqualified'

export interface RowColAssignment {
  row: number | null
  col: number | null
}

export interface AnnotationWarning {
  kind: 'duplicate' | 'fallback' | 'algorithm-specific'
  message: string
  keyIndices?: number[]
}

export interface AnnotationResult {
  /** Index-aligned with input keys; null for ghost/decal entries. */
  assignments: (RowColAssignment | null)[]
  status: AssignmentStatus
  warnings: AnnotationWarning[]
  meta?: Record<string, unknown>
}

export interface AnnotationAlgorithm {
  name: string
  description: string
  annotate(keys: ReadonlyArray<Key>): AnnotationResult
}

export interface MatrixItem {
  id: string
  index: number
  keySequence: Key[]
}
