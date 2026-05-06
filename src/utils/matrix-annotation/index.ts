export type {
  AnnotationAlgorithm,
  AnnotationResult,
  AnnotationWarning,
  AssignmentStatus,
  MatrixItem,
  RowColAssignment,
} from './types'

export { computeRowsAndCols, buildRowsColsFromResult } from './build-matrix'
export { clusterAnnotationAlgorithm } from './cluster'
export { clusterSymmetryAnnotationAlgorithm } from './cluster-symmetry'
