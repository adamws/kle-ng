export type { Geom2, Geom3 } from './geom-utils'
export {
  placeGeom2,
  extractGeom2Points,
  fmt,
  fmtVec2,
  formatPoints,
  ScriptShapeRegistry,
} from './geom-utils'
export {
  createRectangleSwitchGeom,
  buildRectangleSwitchScript,
  createCherryMxOpenableGeom,
  buildCherryMxOpenableScript,
  createCherryMxAlpsHybridGeom,
  buildCherryMxAlpsHybridScript,
  isRectangleSwitchType,
  type SwitchCutoutOptions,
} from './switch-cutouts'
export {
  createStabGeoms,
  buildStabScript,
  createMxBasicStabGeoms,
  buildMxBasicStabScript,
  createMxSpecStabGeoms,
  buildMxSpecStabScript,
  createAlpsStabGeoms,
  buildAlpsStabScript,
  type StabCutoutOptions,
  type StabType,
  stabVerticalTurnDeg,
} from './stabilizer-cutouts'
export { createCircleHoleGeom, buildCircleHoleScript } from './hole-cutouts'
export {
  createCherryMxSnapNotchCuts,
  createStabBacksideCut,
  STAB_BACKSIDE_OVERHANGS,
  type StabBacksideOverhang,
  type BacksideCut3D,
} from './backside-features'
export {
  createRotaryEncoderBacksideCut,
  ENCODER_CUTOUT_RADIUS,
  ENCODER_BACKSIDE_SIZE,
  ENCODER_PCB_CUTOUT_SIZE,
} from './encoder-cutouts'
