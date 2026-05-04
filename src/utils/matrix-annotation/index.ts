export type {
  AnnotationAlgorithm,
  AnnotationResult,
  AnnotationWarning,
  AssignmentStatus,
  MatrixItem,
  RowColAssignment,
} from './types'

export { computeRowsAndCols, buildRowsColsFromResult } from './build-matrix'
export { currentAnnotationAlgorithm } from './current'
export { identityAnnotationAlgorithm } from './identity'

import { currentAnnotationAlgorithm } from './current'
import { identityAnnotationAlgorithm } from './identity'
import type { AnnotationAlgorithm } from './types'

/** All registered algorithms in evaluation order. */
export const algorithms: AnnotationAlgorithm[] = [
  currentAnnotationAlgorithm,
  identityAnnotationAlgorithm,
]
