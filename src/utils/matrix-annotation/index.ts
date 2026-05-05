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
export { clusterAnnotationAlgorithm } from './cluster'
export { graphAnnotationAlgorithm } from './graph'

import { currentAnnotationAlgorithm } from './current'
import { identityAnnotationAlgorithm } from './identity'
import { clusterAnnotationAlgorithm } from './cluster'
import { graphAnnotationAlgorithm } from './graph'
import type { AnnotationAlgorithm } from './types'

/** All registered algorithms in evaluation order. */
export const algorithms: AnnotationAlgorithm[] = [
  clusterAnnotationAlgorithm,
  graphAnnotationAlgorithm,
  currentAnnotationAlgorithm,
  identityAnnotationAlgorithm,
]
