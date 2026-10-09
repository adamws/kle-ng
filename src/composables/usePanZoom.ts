/**
 * Pan and zoom for an SVG canvas, by driving its viewBox.
 *
 * - wheel zooms at the cursor,
 * - middle-button drag, or Space + left-button drag, pans,
 * - `fit(viewBox)` resets the view.
 *
 * Coordinates: `screenToSvg` maps client (screen) pixels to SVG user units via
 * `getScreenCTM().inverse()`, so it stays right for any preserveAspectRatio
 * letterboxing. The math is in plain exported functions for unit tests.
 */
import { computed, ref, type Ref } from 'vue'
import type { ViewBox } from '@/types/footprint'

export interface Point {
  x: number
  y: number
}

/** Zoom limits, as viewBox width in SVG units (mm). */
export const MIN_VIEW_WIDTH = 1
export const MAX_VIEW_WIDTH = 400
/** Zoom factor for one wheel notch (100 px of deltaY). */
export const WHEEL_ZOOM_STEP = 1.2

/**
 * Zooms a viewBox by `factor` (> 1 zooms in) keeping `at` fixed on screen.
 * The factor is clamped so the width stays within the zoom limits.
 */
export function zoomViewBoxAt(vb: ViewBox, at: Point, factor: number): ViewBox {
  const width = Math.min(MAX_VIEW_WIDTH, Math.max(MIN_VIEW_WIDTH, vb.width / factor))
  const f = vb.width / width
  return {
    x: at.x - (at.x - vb.x) / f,
    y: at.y - (at.y - vb.y) / f,
    width,
    height: vb.height / f,
  }
}

/** Moves a viewBox so the content moves by `delta` SVG units. */
export function panViewBox(vb: ViewBox, delta: Point): ViewBox {
  return { ...vb, x: vb.x - delta.x, y: vb.y - delta.y }
}

/** Zoom factor for a wheel event's deltaY, normalised to pixels. */
export function wheelZoomFactor(deltaY: number, deltaMode: number): number {
  // deltaMode 1 = lines, 2 = pages
  const px = deltaMode === 1 ? deltaY * 33 : deltaMode === 2 ? deltaY * 800 : deltaY
  return Math.pow(WHEEL_ZOOM_STEP, -px / 100)
}

export function formatViewBox(vb: ViewBox): string {
  return `${vb.x} ${vb.y} ${vb.width} ${vb.height}`
}

/** The affine part of a DOMMatrix (what getScreenCTM returns). */
export type Affine = Pick<DOMMatrix, 'a' | 'b' | 'c' | 'd' | 'e' | 'f'>

/** Maps a client point to SVG user units with a given screen CTM (inverted here). */
export function clientToSvg(ctm: Affine, clientX: number, clientY: number): Point {
  const { a, b, c, d, e, f } = ctm
  const det = a * d - b * c
  const x = clientX - e
  const y = clientY - f
  return { x: (d * x - c * y) / det, y: (a * y - b * x) / det }
}

export function usePanZoom(svgRef: Ref<SVGSVGElement | null>, initial: ViewBox) {
  const viewBox = ref<ViewBox>({ ...initial })
  const isPanning = ref(false)
  const spaceHeld = ref(false)

  let panStart: { ctm: DOMMatrix; client: Point; viewBox: ViewBox; pointerId: number } | null = null

  const viewBoxString = computed(() => formatViewBox(viewBox.value))

  function screenToSvg(clientX: number, clientY: number): Point | null {
    const ctm = svgRef.value?.getScreenCTM()
    return ctm ? clientToSvg(ctm, clientX, clientY) : null
  }

  function fit(vb: ViewBox) {
    viewBox.value = { ...vb }
  }

  function zoomAt(at: Point, factor: number) {
    viewBox.value = zoomViewBoxAt(viewBox.value, at, factor)
  }

  /** Zooms around the centre of the view (toolbar buttons). */
  function zoomBy(factor: number) {
    const vb = viewBox.value
    zoomAt({ x: vb.x + vb.width / 2, y: vb.y + vb.height / 2 }, factor)
  }

  function onWheel(event: WheelEvent) {
    const at = screenToSvg(event.clientX, event.clientY)
    if (!at) return
    event.preventDefault()
    zoomAt(at, wheelZoomFactor(event.deltaY, event.deltaMode))
  }

  /** Starts a pan on middle button, or left button with Space held. Returns true if it did. */
  function onPointerDown(event: PointerEvent): boolean {
    const wantsPan = event.button === 1 || (event.button === 0 && spaceHeld.value)
    const ctm = svgRef.value?.getScreenCTM()
    if (!wantsPan || !ctm) return false
    event.preventDefault()
    panStart = {
      ctm,
      client: { x: event.clientX, y: event.clientY },
      viewBox: { ...viewBox.value },
      pointerId: event.pointerId,
    }
    isPanning.value = true
    ;(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId)
    return true
  }

  function onPointerMove(event: PointerEvent): boolean {
    if (!panStart || event.pointerId !== panStart.pointerId) return false
    // measure with the CTM from the start, the viewBox changes while panning
    const a = clientToSvg(panStart.ctm, panStart.client.x, panStart.client.y)
    const b = clientToSvg(panStart.ctm, event.clientX, event.clientY)
    viewBox.value = panViewBox(panStart.viewBox, { x: b.x - a.x, y: b.y - a.y })
    return true
  }

  function onPointerUp(event: PointerEvent): boolean {
    if (!panStart || event.pointerId !== panStart.pointerId) return false
    ;(event.currentTarget as Element | null)?.releasePointerCapture?.(event.pointerId)
    panStart = null
    isPanning.value = false
    return true
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.code === 'Space') {
      event.preventDefault()
      spaceHeld.value = true
    }
  }

  function onKeyUp(event: KeyboardEvent) {
    if (event.code === 'Space') spaceHeld.value = false
  }

  function onBlur() {
    spaceHeld.value = false
  }

  return {
    viewBox,
    viewBoxString,
    isPanning,
    spaceHeld,
    screenToSvg,
    fit,
    zoomAt,
    zoomBy,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onKeyDown,
    onKeyUp,
    onBlur,
  }
}
