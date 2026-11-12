/** Data for a single label on a key */
export interface LabelData {
  text: string
  fontSize: number
  color: string
  align: 'left' | 'center' | 'right'
  baseline: 'hanging' | 'middle' | 'alphabetic'
  relX: number // px from key outer-rect left
  relY: number // px from key outer-rect top
  maxWidth: number // text area width in px
  maxHeight: number // text area height in px (for line-count clipping)
}

/** Per-key data needed by any layout renderer */
export interface KeyRenderData {
  left: number
  top: number
  width: number
  height: number
  labels: LabelData[] // 0–12 non-empty entries
  rotationAngle: number // degrees (0 = no rotation)
  rotationOriginX: number // board-space px
  rotationOriginY: number // board-space px
  darkColor: string // key.color (outer/bevel fill), e.g. '#cccccc'
  lightColor: string // lightenColor(darkColor), e.g. '#f0f0f0'
  // Special key rendering flags
  ghost?: boolean // whole key at opacity 0.3
  decal?: boolean // no key body, only labels
  nub?: boolean // homing nub bar at 90% down inner cap
  isRotaryEncoder?: boolean // render as circle (uses width for radius)
  stepped?: boolean // non-rectangular key whose second rect is the lower step: no light top on it
  // Non-rectangular second rectangle (pixel coords, same space as left/top/width/height)
  left2?: number
  top2?: number
  width2?: number
  height2?: number
}

/** Normalized input consumed by any layout renderer */
export interface LayoutRenderInput {
  layoutName: string
  author: string
  backColor: string
  radiiValue: string
  unit: number
  boardWidth: number
  boardHeight: number
  keys: KeyRenderData[]
}

/** Contract that all layout renderers must satisfy */
export interface LayoutRenderer {
  render(input: LayoutRenderInput): string
}
