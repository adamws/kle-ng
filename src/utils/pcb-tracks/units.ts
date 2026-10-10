/**
 * Units and tolerances of the track editor. Coordinates are mm; the preset
 * format (and kbplacer, which matches track ends exactly) uses whole
 * nanometres, so editor geometry is rounded to 1 nm.
 */
import type { Vec } from './distance'

/** One nanometre, in mm. */
export const NM = 1e-6
/** Nanometres per mm. */
const NM_PER_MM = 1e6

/** Float noise: values this close are equal (well under 1 nm). */
export const FLOAT_EPS = 1e-9

/** Points this close are one point, mm (well under 1 nm, above float noise). */
export const POINT_EPS = 1e-7

/** A value rounded to whole nanometres (divided, not multiplied by NM, to stay exact). */
export const roundNmValue = (v: number): number => Math.round(v * NM_PER_MM) / NM_PER_MM

/** A point rounded to whole nanometres, like the wire format. */
export const roundNm = (p: Vec): Vec => ({ x: roundNmValue(p.x), y: roundNmValue(p.y) })

export const samePoint = (p: Vec, q: Vec) =>
  Math.abs(p.x - q.x) < POINT_EPS && Math.abs(p.y - q.y) < POINT_EPS
