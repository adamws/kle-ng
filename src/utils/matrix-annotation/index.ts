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
export { clusterSymmetryAnnotationAlgorithm } from './cluster-symmetry'
export { graphAnnotationAlgorithm } from './graph'
export { pathAnnotationAlgorithm } from './path'

import { currentAnnotationAlgorithm } from './current'
import { identityAnnotationAlgorithm } from './identity'
import { clusterAnnotationAlgorithm } from './cluster'
import { clusterSymmetryAnnotationAlgorithm } from './cluster-symmetry'
import { graphAnnotationAlgorithm } from './graph'
import { pathAnnotationAlgorithm } from './path'
import type { AnnotationAlgorithm } from './types'

/** All registered algorithms in evaluation order. */
export const algorithms: AnnotationAlgorithm[] = [
  clusterAnnotationAlgorithm,
  clusterSymmetryAnnotationAlgorithm,
  graphAnnotationAlgorithm,
  pathAnnotationAlgorithm,
  currentAnnotationAlgorithm,
  identityAnnotationAlgorithm,
]
