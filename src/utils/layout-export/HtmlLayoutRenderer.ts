import type {
  LayoutRenderer,
  LayoutRenderInput,
  KeyRenderData,
  LabelData,
} from './LayoutRendererTypes'
import { escapeHtml } from './layout-render-utils'
import {
  INNER_LEFT,
  INNER_TOP,
  INNER_SIZE_REDUCTION,
  ROUND_OUTER,
  ROUND_INNER,
  NUB_WIDTH,
  NUB_HEIGHT,
} from './layout-render-constants'
import { computeNubPosition } from './layout-render-geometry'

export class HtmlLayoutRenderer implements LayoutRenderer {
  render(input: LayoutRenderInput): string {
    const { layoutName, author, backColor, radiiValue, unit, boardWidth, boardHeight, keys } = input

    const keysHtml = keys.map((key) => this.renderKey(key)).join('\n')

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(layoutName)}</title>
  <style>
    :root {
      --unit: ${unit}px;
      --board-width: ${boardWidth}px;
      --board-height: ${boardHeight}px;
      --text: #111827;
      --board-shadow: inset 0 0 0 1px #e5e7eb;
    }
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f5f5;
      display: flex;
      justify-content: center;
    }
    .keyboard-container {
      background: #fff;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 6px 18px rgba(2,6,23,0.08);
    }
    .keyboard-title {
      margin: 0 0 15px 0;
      font-size: 24px;
      font-weight: 600;
      color: #333;
    }
    .keyboard-author {
      margin: 0 0 20px 0;
      font-size: 14px;
      color: #666;
    }
    .board {
      position: relative;
      width: var(--board-width);
      height: var(--board-height);
      background: ${backColor};
      border-radius: ${radiiValue};
      overflow: visible;
      box-shadow: var(--board-shadow);
    }
    .key {
      position: absolute;
      border-radius: 5px;
      /* inset box-shadow instead of border: the shadow stays inside the element
         bounds so the 1px it occupies does not reduce the content box.  Each key
         div is rendered 1px wider and 1px taller than its nominal grid cell
         (width+1 / height+1 in the inline style), making adjacent keys overlap
         by 1px.  Both inset shadows then cover the same pixel — producing a
         single 1px border instead of a double edge, matching canvas behaviour. */
      box-shadow: inset 0 0 0 1px #000000;
      overflow: hidden;
    }
    .key-inner {
      position: absolute;
      left: 6px;    /* INNER_LEFT */
      top: 3px;     /* INNER_TOP */
      right: 7px;   /* HTML_INNER_RIGHT = BEVEL_MARGIN + 1 (key element is width+1px for border overlap) */
      bottom: 10px; /* HTML_INNER_BOTTOM = BEVEL_MARGIN + BEVEL_OFFSET_BOTTOM + 1 */
      border-radius: 3px; /* ROUND_INNER */
      overflow: hidden;
    }
    .key-label {
      position: absolute;
      overflow: hidden;
      overflow-wrap: break-word;
      word-break: break-word;
      line-height: 1.2;
      pointer-events: none;
    }
    .keyboard-footer {
      margin-top: 15px;
      font-size: 12px;
      color: #999;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="keyboard-container">
    ${layoutName ? `<h1 class="keyboard-title">${escapeHtml(layoutName)}</h1>` : ''}
    ${author ? `<p class="keyboard-author">by ${escapeHtml(author)}</p>` : ''}
    <div class="board">
      ${keysHtml}
    </div>
    <p class="keyboard-footer">Created with <a href="https://editor.keyboard-tools.xyz/" target="_blank" rel="noopener">Keyboard Layout Editor NG</a></p>
  </div>
</body>
</html>`
  }

  private renderLabel(label: LabelData): string {
    const { text, fontSize, color, align, baseline, relX, relY, maxWidth } = label
    const lineHeight = fontSize * 1.2

    const cssLeft =
      align === 'left' ? relX : align === 'right' ? relX - maxWidth : relX - maxWidth / 2

    // Position the span so its baseline type aligns with relY.
    // CSS lacks explicit baseline-aware positioning for absolute elements; we approximate
    // using the typical baseline fraction within a line-height-1.2 box:
    //   hanging    → span top at relY  (hanging baseline ≈ top of em box)
    //   middle     → span center at relY  (span top = relY − lineHeight/2)
    //   alphabetic → alphabetic baseline ≈ 75% down the span  (span top = relY − 0.75·lineHeight)
    const cssTop =
      baseline === 'hanging'
        ? relY
        : baseline === 'middle'
          ? relY - lineHeight / 2
          : relY - lineHeight * 0.75

    return `<span class="key-label" style="left:${cssLeft}px;top:${cssTop}px;width:${maxWidth}px;font-size:${fontSize}px;color:${color};text-align:${align};">${text}</span>`
  }

  private renderHomingNub(keyWidth: number, keyHeight: number): string {
    // Passes (0, 0, …) — nub position is relative to the key element, not board coords
    const nub = computeNubPosition(0, 0, keyWidth, keyHeight)
    return `<div style="position:absolute;left:${nub.x}px;top:${nub.y}px;width:${NUB_WIDTH}px;height:${NUB_HEIGHT}px;background:rgba(0,0,0,0.3);pointer-events:none;"></div>`
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

    const rotateCss =
      rotationAngle !== 0
        ? `transform:rotate(${rotationAngle}deg);transform-origin:${rotationOriginX - left}px ${rotationOriginY - top}px;`
        : ''
    const ghostCss = ghost ? 'opacity:0.3;' : ''
    const labelsHtml = labels.map((l) => this.renderLabel(l)).join('')

    if (decal) {
      return `<div style="position:absolute;left:${left}px;top:${top}px;width:${width}px;height:${height}px;${rotateCss}${ghostCss}">${labelsHtml}</div>`
    }

    // Non-rectangular: use flat DOM structure matching the reference KLE technique.
    // A 0×0 container at the primary rect's origin handles rotation and ghost opacity
    // so all children share one stacking context.  Layer order:
    //   outer1 (border) → outer2 (border) → outer1-filler (no border, covers the
    //   junction seam) → inner1 (light) → inner2 (light) → labels
    // A stepped key skips inner2: its second rect is the lower step, which shows
    // only the dark outer fill (as in KLE).
    if (left2 !== undefined && width2 !== undefined) {
      // Container at outer1's board position; all children use container-relative coords.
      const containerRotateCss = rotateCss // same origin relative to container pos
      const rel2L = left2 - left
      const rel2T = top2! - top

      // 1. outer1 — uses .key class (gets box-shadow border + border-radius:5px)
      const outer1 = `<div class="key" style="left:0px;top:0px;width:${width + 1}px;height:${height + 1}px;background:${darkColor};"></div>`

      // 2. outer2 — same .key class
      const outer2 = `<div class="key" style="left:${rel2L}px;top:${rel2T}px;width:${width2 + 1}px;height:${height2! + 1}px;background:${darkColor};"></div>`

      // 3. outer1-filler — NO .key class (no box-shadow), inset by 1px (= shadow width).
      //    Drawn after outer2 so it covers outer2's bottom-edge shadow at the junction.
      const filler = `<div style="position:absolute;left:1px;top:1px;width:${width - 1}px;height:${height - 1}px;background:${darkColor};border-radius:${ROUND_OUTER}px;pointer-events:none;"></div>`

      // 4. inner1 — positioned in container coords (no .key-inner class to avoid CSS conflicts)
      const in1 = `<div style="position:absolute;left:${INNER_LEFT}px;top:${INNER_TOP}px;width:${width - INNER_SIZE_REDUCTION}px;height:${height - INNER_SIZE_REDUCTION}px;background:${lightColor};border-radius:${ROUND_INNER}px;overflow:hidden;pointer-events:none;"></div>`

      // 5. inner2 — same, but at outer2's container-relative position
      const in2L = rel2L + INNER_LEFT
      const in2T = rel2T + INNER_TOP
      const in2 = `<div style="position:absolute;left:${in2L}px;top:${in2T}px;width:${width2 - INNER_SIZE_REDUCTION}px;height:${height2! - INNER_SIZE_REDUCTION}px;background:${lightColor};border-radius:${ROUND_INNER}px;overflow:hidden;pointer-events:none;"></div>`

      // 6. Labels — transparent wrapper at container origin so label's relX/relY work
      const labelsWrapper = labelsHtml
        ? `<div style="position:absolute;left:0px;top:0px;width:${width}px;height:${height}px;pointer-events:none;">${labelsHtml}</div>`
        : ''

      const inner = [outer1, outer2, filler, in1, stepped ? '' : in2, labelsWrapper]
        .filter(Boolean)
        .join('\n')
      return `<div style="position:absolute;left:${left}px;top:${top}px;width:0;height:0;overflow:visible;${containerRotateCss}${ghostCss}">${inner}</div>`
    }

    const keyBorderRadius = isRotaryEncoder ? 'border-radius:50%;' : ''
    const innerBorderRadius = isRotaryEncoder
      ? 'border-radius:50%;left:6px;top:6px;right:6px;bottom:6px;'
      : ''
    const nubHtml = nub ? this.renderHomingNub(width, height) : ''

    return `<div class="key" style="left:${left}px;top:${top}px;width:${width + 1}px;height:${height + 1}px;background:${darkColor};${rotateCss}${ghostCss}${keyBorderRadius}">
          <div class="key-inner" style="background:${lightColor};${innerBorderRadius}"></div>${nubHtml}${labelsHtml}
        </div>`
  }
}

export const htmlLayoutRenderer = new HtmlLayoutRenderer()
