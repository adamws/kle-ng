import polygonClippingLib from 'polygon-clipping'
import type { MultiPolygon } from 'polygon-clipping'
import type {
  LayoutRenderer,
  LayoutRenderInput,
  KeyRenderData,
  LabelData,
} from './LayoutRendererTypes'
import { escapeHtml } from './layout-render-utils'
import { BEVEL_MARGIN, ROUND_OUTER, ROUND_INNER } from './layout-render-constants'
import {
  computeInnerRect,
  computeNubPosition,
  computeMultiLineStartY,
} from './layout-render-geometry'
import { labelParser } from '../parsers/LabelParser'
import type { LabelNode } from '../parsers/LabelAST'
import { svgCache } from '../caches/SVGCache'
import { svgProcessor } from '../parsers/SVGProcessor'

export class SvgLayoutRenderer implements LayoutRenderer {
  private _measureCtx: CanvasRenderingContext2D | null | undefined = undefined

  private getMeasureCtx(): CanvasRenderingContext2D | null {
    if (this._measureCtx === undefined) {
      try {
        const canvas = document.createElement('canvas')
        this._measureCtx = canvas.getContext('2d')
      } catch {
        this._measureCtx = null
      }
    }
    return this._measureCtx
  }

  private wrapText(text: string, fontSize: number, maxWidth: number): string[] {
    const ctx = this.getMeasureCtx()
    if (!ctx || maxWidth <= 0) return [text]

    ctx.font = `${fontSize}px sans-serif`
    const words = text.split(' ')
    const lines: string[] = []
    let current = ''

    for (const word of words) {
      const test = current ? current + ' ' + word : word
      if (ctx.measureText(test).width <= maxWidth) {
        current = test
      } else {
        if (current) lines.push(current)
        current = word
      }
    }
    if (current) lines.push(current)

    return lines.length > 0 ? lines : [text]
  }

  private renderLabel(label: LabelData, keyLeft: number, keyTop: number): string {
    const { text, fontSize, color, align, baseline, relX, relY, maxWidth, maxHeight } = label
    const lineHeight = fontSize * 1.2
    const absX = keyLeft + relX
    const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle'
    const svgBaseline =
      baseline === 'hanging' ? 'hanging' : baseline === 'middle' ? 'middle' : 'auto'
    const commonAttrs = `font-size="${fontSize}" fill="${color}" font-family="sans-serif" text-anchor="${anchor}" dominant-baseline="${svgBaseline}"`

    // Branch 1: SVG-only label → embed as <image> with data URL
    if (/^<svg[^>]*>[\s\S]*?<\/svg>\s*$/.test(text)) {
      return this.renderSvgImageLabel(
        text,
        align,
        baseline,
        relX,
        relY,
        maxWidth,
        maxHeight,
        keyLeft,
        keyTop,
      )
    }

    // Parse HTML → AST nodes
    const nodes = labelParser.parse(text)
    const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight))

    // Branch 2: formatted text (bold/italic) → render segments with tspan style attributes
    const hasFormatting = nodes.some(
      (n) => (n.type === 'text' || n.type === 'link') && (n.style?.bold || n.style?.italic),
    )
    if (hasFormatting) {
      return this.renderFormattedLabel(
        nodes,
        maxLines,
        absX,
        keyTop + relY,
        baseline,
        lineHeight,
        commonAttrs,
      )
    }

    // Branch 3: plain text — use decoded plain text, existing wrap/render
    const plainText = labelParser.getPlainText(nodes)
    const lines = this.wrapText(plainText, fontSize, maxWidth).slice(0, maxLines)
    const n = lines.length

    // Mirror the canvas textBaseline exactly: relY is the anchor point for that
    // baseline type and maps 1-to-1 to the matching SVG dominant-baseline.
    //   hanging    → dominant-baseline="hanging",    Y = top of em box  → startY = relY
    //   middle     → dominant-baseline="middle",     Y = middle of em box → startY = relY
    //   alphabetic → dominant-baseline="auto",       Y = alphabetic base → startY = relY
    //
    // For multi-line blocks the first line's Y is shifted so the whole block is
    // anchored at relY (the same role each line plays on the canvas):
    //   hanging:    block flows down from relY → no shift
    //   middle:     center of block at relY → first line up by (n-1)*lineHeight/2
    //   alphabetic: last line's baseline at relY → first line up by (n-1)*lineHeight
    const startY = computeMultiLineStartY(baseline, keyTop + relY, n, lineHeight)
    const escapedLines = lines.map((l) => escapeHtml(l))

    if (lines.length === 1) {
      return `<text x="${absX}" y="${startY}" ${commonAttrs}>${escapedLines[0]}</text>`
    }
    const tspans = escapedLines
      .map((line, i) => `<tspan x="${absX}" dy="${i === 0 ? 0 : lineHeight}">${line}</tspan>`)
      .join('')
    return `<text x="${absX}" y="${startY}" ${commonAttrs}>${tspans}</text>`
  }

  private renderSvgImageLabel(
    text: string,
    align: string,
    baseline: 'hanging' | 'middle' | 'alphabetic',
    relX: number,
    relY: number,
    maxWidth: number,
    maxHeight: number,
    keyLeft: number,
    keyTop: number,
  ): string {
    const dataUrl = svgCache.toDataUrl(text)
    const { width: rawW, height: rawH } = svgProcessor.getDimensions(text)
    const w = Math.min(rawW ?? 32, maxWidth)
    const h = Math.min(rawH ?? 32, maxHeight)

    const imgX =
      align === 'left'
        ? keyLeft + relX
        : align === 'right'
          ? keyLeft + relX - w
          : keyLeft + relX - w / 2

    const imgY =
      baseline === 'hanging'
        ? keyTop + relY
        : baseline === 'middle'
          ? keyTop + relY - h / 2
          : keyTop + relY - h

    return `<image x="${imgX}" y="${imgY}" width="${w}" height="${h}" href="${dataUrl}"/>`
  }

  private renderFormattedLabel(
    nodes: LabelNode[],
    maxLines: number,
    absX: number,
    relYAbs: number,
    baseline: 'hanging' | 'middle' | 'alphabetic',
    lineHeight: number,
    commonAttrs: string,
  ): string {
    // Collect lines of segments
    const lines: Array<Array<{ text: string; bold: boolean; italic: boolean }>> = [[]]
    for (const node of nodes) {
      if (node.type !== 'text' && node.type !== 'link') continue
      const parts = node.text.split('\n')
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) lines.push([])
        const seg = parts[i] ?? ''
        if (seg) {
          lines[lines.length - 1]!.push({
            text: seg,
            bold: node.style?.bold ?? false,
            italic: node.style?.italic ?? false,
          })
        }
      }
    }

    const renderLines = lines.slice(0, maxLines)
    const n = renderLines.length
    const startY = computeMultiLineStartY(baseline, relYAbs, n, lineHeight)

    const tspanLines = renderLines
      .map((segs, li) => {
        const dy = li === 0 ? 0 : lineHeight
        const inner = segs
          .map((s) => {
            const fw = s.bold ? ' font-weight="bold"' : ''
            const fs = s.italic ? ' font-style="italic"' : ''
            return `<tspan${fw}${fs}>${escapeHtml(s.text)}</tspan>`
          })
          .join('')
        return `<tspan x="${absX}" dy="${dy}">${inner || ''}</tspan>`
      })
      .join('')

    return `<text x="${absX}" y="${startY}" ${commonAttrs}>${tspanLines}</text>`
  }

  render(input: LayoutRenderInput): string {
    const { layoutName, backColor, radiiValue, boardWidth, boardHeight, keys } = input

    const boardRx = parseInt(radiiValue, 10) || 0
    const keysXml = keys.map((k) => this.renderKey(k)).join('\n  ')

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 ${boardWidth} ${boardHeight}"
     width="${boardWidth}" height="${boardHeight}"
     overflow="visible">
  <title>${escapeHtml(layoutName)}</title>
  <rect width="${boardWidth}" height="${boardHeight}" fill="${backColor}" rx="${boardRx}"/>
  ${keysXml}
</svg>`
  }

  /** Polygon approximation of a rounded rectangle — same algorithm as KeyRenderer.ts */
  private makeRoundedRectPolygon(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    seg = 8,
  ): Array<[number, number]> {
    const pts: Array<[number, number]> = []
    const s = Math.max(2, Math.floor(seg))
    r = Math.min(r, w / 2, h / 2)

    const arc = (cx: number, cy: number, a0: number, a1: number) => {
      for (let i = 0; i <= s; i++) {
        const a = a0 + (i / s) * (a1 - a0)
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
      }
    }

    // Build clockwise polygon: top-left → top-right → bottom-right → bottom-left
    arc(x + r, y + r, Math.PI, 1.5 * Math.PI) // top-left corner
    pts.push([x + w - r, y]) // top edge
    arc(x + w - r, y + r, 1.5 * Math.PI, 2 * Math.PI) // top-right corner
    pts.push([x + w, y + h - r]) // right edge
    arc(x + w - r, y + h - r, 0, 0.5 * Math.PI) // bottom-right corner
    pts.push([x + r, y + h]) // bottom edge
    arc(x + r, y + h - r, 0.5 * Math.PI, Math.PI) // bottom-left corner
    pts.push([x, y + r]) // left edge

    return pts
  }

  /** Convert polygon-clipping MultiPolygon to SVG path d attribute */
  private polygonToSvgPath(multiPolygon: MultiPolygon, scale: number): string {
    const fmt = (n: number) => parseFloat((n / scale).toFixed(2))
    let d = ''
    for (const polygon of multiPolygon) {
      for (const ring of polygon) {
        if (!ring || ring.length < 2) continue
        d += `M ${fmt(ring[0]![0])} ${fmt(ring[0]![1])}`
        for (let i = 1; i < ring.length; i++) {
          d += ` L ${fmt(ring[i]![0])} ${fmt(ring[i]![1])}`
        }
        d += ' Z'
      }
    }
    return d
  }

  /**
   * Compute the vector union of two rectangles and return an SVG path d string.
   * Returns null if the union computation fails (caller should fall back to two rects).
   */
  private createUnionSvgPath(
    r1: { x: number; y: number; w: number; h: number },
    r2: { x: number; y: number; w: number; h: number },
    radius: number,
  ): string | null {
    const scale = 1000
    const p1 = this.makeRoundedRectPolygon(
      r1.x * scale,
      r1.y * scale,
      r1.w * scale,
      r1.h * scale,
      radius * scale,
    )
    const p2 = this.makeRoundedRectPolygon(
      r2.x * scale,
      r2.y * scale,
      r2.w * scale,
      r2.h * scale,
      radius * scale,
    )
    try {
      const result = polygonClippingLib.union([[p1]], [[p2]])
      return this.polygonToSvgPath(result, scale)
    } catch {
      return null
    }
  }

  private renderCircularKey(
    left: number,
    top: number,
    width: number,
    darkColor: string,
    lightColor: string,
  ): string {
    const cx = left + width / 2
    const cy = top + width / 2
    const outerR = width / 2
    const innerR = (width - BEVEL_MARGIN * 2) / 2 + 1
    return `<circle cx="${cx}" cy="${cy}" r="${outerR}" fill="${darkColor}" stroke="#000000" stroke-width="1"/>
    <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="${lightColor}"/>`
  }

  private renderHomingNub(left: number, top: number, width: number, height: number): string {
    const nub = computeNubPosition(left, top, width, height)
    return `\n    <rect x="${nub.x}" y="${nub.y}" width="10" height="2" fill="rgba(0,0,0,0.3)"/>`
  }

  private renderKey(key: KeyRenderData): string {
    const {
      left,
      top,
      width,
      height,
      labels,
      rotationAngle,
      rotationOriginX,
      rotationOriginY,
      darkColor,
      lightColor,
      ghost,
      decal,
      nub,
      isRotaryEncoder,
      stepped,
      left2,
      top2,
      width2,
      height2,
    } = key

    const labelsXml = labels.map((l) => this.renderLabel(l, left, top)).join('\n    ')
    const labelsTag = labelsXml ? `\n    ${labelsXml}` : ''
    const ghostAttr = ghost ? ` opacity="0.3"` : ''

    let content: string

    if (decal) {
      content = labelsTag.trimStart()
    } else if (isRotaryEncoder) {
      content = this.renderCircularKey(left, top, width, darkColor, lightColor) + labelsTag
    } else {
      // 0.5px offset aligns stroke center to pixel boundary for crisp 1px borders.
      // Width/height are NOT reduced: the stroke extends 0.5px beyond the nominal key
      // bounds, so adjacent keys' strokes overlap by 1px — matching canvas behaviour
      // where two side-by-side keys share a single border pixel rather than each
      // contributing their own border (which would produce a 2px double-edge).
      const outerX = left + 0.5
      const outerY = top + 0.5
      const inner = computeInnerRect(left, top, width, height)

      content = `<rect x="${outerX}" y="${outerY}" width="${width}" height="${height}" fill="${darkColor}" stroke="#000000" stroke-width="1" rx="${ROUND_OUTER}"/>
    <rect x="${inner.x}" y="${inner.y}" width="${inner.w}" height="${inner.h}" fill="${lightColor}" rx="${ROUND_INNER}"/>`

      if (left2 !== undefined && width2 !== undefined) {
        // Use polygon union for seamless rendering — eliminates the double-border
        // seam that two separate stroked <rect> elements produce at the junction.
        const inner2 = computeInnerRect(left2, top2!, width2, height2!)
        const outerD = this.createUnionSvgPath(
          { x: left, y: top, w: width, h: height },
          { x: left2, y: top2!, w: width2, h: height2! },
          ROUND_OUTER,
        )
        // A stepped key's second rect is the lower step: it keeps the dark outer
        // fill and gets no light top surface (as in KLE).
        const innerD = stepped ? null : this.createUnionSvgPath(inner, inner2, ROUND_INNER)
        const innerTag = stepped
          ? `<rect x="${inner.x}" y="${inner.y}" width="${inner.w}" height="${inner.h}" fill="${lightColor}" rx="${ROUND_INNER}"/>`
          : innerD && `<path d="${innerD}" fill="${lightColor}"/>`

        if (outerD && innerTag) {
          // Replace the content built above with the union paths
          content = `<path d="${outerD}" fill="${darkColor}" stroke="#000000" stroke-width="1"/>
    ${innerTag}`
        } else {
          // Fallback: correct layering order (outer1, outer2, inner1, inner2) so that
          // each successive fill covers the border seam of the previous element.
          const outerX2 = left2 + 0.5
          const outerY2 = top2! + 0.5
          content = `<rect x="${outerX}" y="${outerY}" width="${width}" height="${height}" fill="${darkColor}" stroke="#000000" stroke-width="1" rx="${ROUND_OUTER}"/>
    <rect x="${outerX2}" y="${outerY2}" width="${width2}" height="${height2}" fill="${darkColor}" stroke="#000000" stroke-width="1" rx="${ROUND_OUTER}"/>
    <rect x="${inner.x}" y="${inner.y}" width="${inner.w}" height="${inner.h}" fill="${lightColor}" rx="${ROUND_INNER}"/>`
          if (!stepped) {
            content += `
    <rect x="${inner2.x}" y="${inner2.y}" width="${inner2.w}" height="${inner2.h}" fill="${lightColor}" rx="${ROUND_INNER}"/>`
          }
        }
      }

      if (nub) content += this.renderHomingNub(left, top, width, height)
      content += labelsTag
    }

    if (rotationAngle !== 0) {
      return `<g transform="rotate(${rotationAngle}, ${rotationOriginX}, ${rotationOriginY})"${ghostAttr}>
    ${content}
  </g>`
    }
    return ghostAttr ? `<g${ghostAttr}>\n    ${content}\n  </g>` : `<g>\n    ${content}\n  </g>`
  }
}

export const svgLayoutRenderer = new SvgLayoutRenderer()
