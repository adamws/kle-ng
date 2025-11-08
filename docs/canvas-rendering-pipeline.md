# Canvas Rendering Pipeline Documentation

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Rendering Flow](#rendering-flow)
- [Core Components](#core-components)
  - [CanvasRenderer](#canvasrenderer)
  - [KeyRenderer](#keyrenderer)
  - [LabelRenderer](#labelrenderer)
  - [RotationRenderer](#rotationrenderer)
- [Caching System](#caching-system)
- [Utility Components](#utility-components)
- [Parsers](#parsers)
- [Performance Optimization](#performance-optimization)
- [Implementation Details](#implementation-details)

---

## Overview

The kle-ng canvas rendering pipeline is a modular, high-performance system for rendering keyboard layouts on HTML5 Canvas. It supports advanced features like:

- **Key rendering** with multiple shapes (rectangular, non-rectangular, circular)
- **Rich label formatting** with HTML tags, images, and inline SVG
- **Rotation support** with interactive rotation origin controls
- **High DPI rendering** with proper pixel alignment
- **Performance optimization** through multi-level caching
- **Asynchronous image loading** with progressive rendering

The system is designed with **separation of concerns**, where each component has a single, well-defined responsibility.

---

## Architecture

The rendering pipeline follows a **layered architecture**:

```
┌─────────────────────────────────────────┐
│         CanvasRenderer (Main)           │
│   - Orchestrates rendering pipeline     │
│   - Manages canvas context              │
│   - Handles callbacks & events          │
└──────────────┬──────────────────────────┘
               │
               ├──────────────────────────┐
               │                          │
       ┌───────▼──────┐         ┌─────────▼───────┐
       │ KeyRenderer  │         │ LabelRenderer   │
       │ - Key shapes │         │ - Text labels   │
       │ - Borders    │         │ - Images/SVG    │
       │ - Colors     │         │ - Formatting    │
       └──────────────┘         └─────────────────┘
               │                          │
               │                          │
       ┌───────▼──────────────────────────▼───────┐
       │          Support Components              │
       │  - BoundsCalculator (geometry)           │
       │  - HitTester (mouse interaction)         │
       │  - RotationRenderer (rotation UI)        │
       └───────┬──────────────────────────────────┘
               │
       ┌───────▼──────────────────────────────────┐
       │            Caching Layer                 │
       │  - SVGCache (SVG → data URL)             │
       │  - ImageCache (image loading)            │
       │  - ParseCache (label parsing)            │
       │  - ColorCache (color lightening)         │
       └───────┬──────────────────────────────────┘
               │
       ┌───────▼──────────────────────────────────┐
       │             Parsers                      │
       │  - LabelParser (HTML labels)             │
       │  - SVGProcessor (SVG validation)         │
       └──────────────────────────────────────────┘
```

### Design Principles

1. **Modularity**: Each component is independent and testable
2. **Functional approach**: Components are stateless where possible
3. **Performance-first**: Multiple levels of caching, batched operations, native Math operations
4. **Precision**: Uses decimal-math for layout operations; rendering uses native Math for optimal performance
5. **Extensibility**: Easy to add new key shapes or label types

---

## Rendering Flow

### High-Level Flow

```
User Action (e.g., layout change)
    │
    ▼
RenderScheduler.schedule()
    │ (batches multiple requests)
    ▼
requestAnimationFrame()
    │
    ▼
CanvasRenderer.render(keys, selectedKeys, metadata)
    │
    ├─► Clear canvas & draw background
    │
    ├─► Sort keys (by rotation, position)
    │   ├─► Non-selected keys first
    │   └─► Selected keys last (on top)
    │
    ├─► For each key:
    │   │
    │   ├─► KeyRenderer.drawKey()
    │   │   ├─► Calculate render parameters
    │   │   ├─► Apply rotation transformation
    │   │   ├─► Draw key shape (rect/circle)
    │   │   └─► Draw selection border (if selected)
    │   │
    │   └─► LabelRenderer.drawKeyLabels()
    │       ├─► Parse labels (with ParseCache)
    │       ├─► Load images (with ImageCache)
    │       ├─► Convert SVG (with SVGCache)
    │       └─► Render text/images
    │
    └─► RotationRenderer.drawRotationPoints() (if in rotation mode)
```

### Detailed Rendering Sequence

1. **Initialization Phase**
   - Canvas context obtained
   - Background cleared (or filled with metadata color)
   - Border radius applied to canvas background

2. **Sorting Phase**
   - Keys split into selected/non-selected groups
   - Each group sorted by: rotation angle → rotation origin → y position → x position
   - Ensures proper Z-ordering (selected keys render on top)

3. **Key Rendering Phase** (for each key)
   - **Parameter Calculation**: `KeyRenderer.getRenderParams()`
     - Calculate outer cap dimensions (with spacing)
     - Calculate inner cap dimensions (with bevel)
     - Calculate text area dimensions (with padding)
     - Apply pixel alignment for crisp edges

   - **Transformation**: Apply rotation if needed
     - Translate to rotation origin
     - Rotate by angle
     - Translate back

   - **Shape Rendering**: `KeyRenderer.drawKey()`
     - For rectangular keys: Draw rounded rectangle
     - For non-rectangular keys: Use vector union for seamless joins
     - For circular keys (rotary encoders): Draw circles
     - Apply selection border if selected

   - **Label Rendering**: `LabelRenderer.drawKeyLabels()`
     - For each label position (0-11):
       - Parse HTML formatting (cached)
       - Load images asynchronously (cached)
       - Calculate text wrapping
       - Render with proper alignment

4. **Overlay Rendering Phase**
   - Rotation origin indicators (orange crosshair)
   - Rotation control points (blue circles)
   - Hover effects on control points

---

## Core Components

### CanvasRenderer

**Location**: `src/utils/canvas-renderer.ts`

**Purpose**: Main orchestrator that manages the entire rendering pipeline.

**Key Responsibilities**:
- Owns the Canvas 2D rendering context
- Manages render options (unit size, background, scale, font)
- Delegates to specialized renderers (Key, Label, Rotation)
- Provides public API for rendering and hit testing
- Manages cache lifecycles

**Public API**:

```typescript
class CanvasRenderer {
  // Rendering
  render(keys, selectedKeys, metadata, clearCanvas?, showRotationPoints?, ...)

  // Configuration
  updateOptions(options: RenderOptions)

  // Callbacks
  setImageLoadCallback(callback: () => void)
  setImageErrorCallback(callback: (url: string) => void)

  // Cache management
  clearSVGCache()
  clearImageCache()
  clearParseCache()
  clearColorCache()
  getSVGCacheStats()
  getImageCacheStats()
  getParseCacheStats()

  // Geometry utilities
  calculateBounds(keys: Key[])
  calculateRotatedKeyBounds(key: Key)

  // Hit testing
  getKeyAtPosition(x: number, y: number, keys: Key[])
  getRotationPointAtPosition(x: number, y: number)
}
```

**Render Options**:

```typescript
interface RenderOptions {
  unit: number          // Pixel size of 1U (typically 54px)
  background: string    // Background color (e.g., "#f0f0f0")
  showGrid?: boolean    // Reserved for future grid feature
  scale?: number        // DPI scaling factor
  fontFamily?: string   // Custom font family for labels
}
```

**Important Methods**:

- **`render()`**: Main rendering entry point
  - Clears canvas (optional)
  - Draws background with border radius
  - Sorts keys for proper z-ordering
  - Delegates key/label rendering
  - Draws rotation UI overlays

- **`updateOptions()`**: Updates render options and propagates to child components

---

### KeyRenderer

**Location**: `src/utils/renderers/KeyRenderer.ts`

**Purpose**: Renders keyboard key shapes (borders, fills, special shapes).

**Key Features**:
- **Multiple key shapes**: Rectangular, non-rectangular (ISO Enter, Big-Ass Enter), circular (rotary encoders)
- **Vector union**: Seamless non-rectangular key rendering using polygon-clipping
- **Pixel alignment**: Ensures crisp 1px borders on all screens
- **Rotation support**: Proper transformation handling
- **Color calculation**: Lab color space lightening for realistic appearance (with caching)
- **Performance optimized**: Native Math operations, color lightening cache

**Rendering Algorithm**:

```typescript
// 1. Calculate render parameters
const params = getRenderParams(key, options)
// → Returns: outer cap, inner cap, text area dimensions

// 2. Apply pixel alignment
const alignedParams = alignRectToPixels(params)
// → Ensures crisp edges on all screens

// 3. Apply rotation transformation (if needed)
ctx.translate(origin_x, origin_y)
ctx.rotate(angle)
ctx.translate(-origin_x, -origin_y)

// 4. Draw key shape
if (isCircular) {
  drawCircularKey()  // For rotary encoders
} else if (nonRectangular) {
  drawKeyRectangleLayers()  // Vector union for ISO Enter
} else {
  drawRoundedRect()  // Standard rectangular key
}

// 5. Draw selection border (if selected)
// 6. Draw homing nub (if key.nub)
```

**Key Shape Types**:

1. **Rectangular Keys** (most common)
   - Simple rounded rectangle
   - Outer border (dark color)
   - Inner surface (light color)
   - Pixel-aligned for crisp rendering

2. **Non-Rectangular Keys** (ISO Enter, Big-Ass Enter)
   - Two rectangles combined via vector union
   - Seamless joins (no gaps/overlaps)
   - Consistent border thickness
   - Algorithm: `polygon-clipping` library

3. **Circular Keys** (Rotary Encoders)
   - Detected via `key.sm === 'rot_ec11'`
   - Uses width only (height ignored)
   - Concentric circles for border and surface

**Render Parameters Structure**:

```typescript
interface KeyRenderParams {
  // Outer border (visible edge)
  outercapx, outercapy, outercapwidth, outercapheight
  outercapx2?, outercapy2?, outercapwidth2?, outercapheight2?  // For non-rectangular

  // Inner surface (top of key)
  innercapx, innercapy, innercapwidth, innercapheight
  innercapx2?, innercapy2?, innercapwidth2?, innercapheight2?  // For non-rectangular

  // Text rendering area
  textcapx, textcapy, textcapwidth, textcapheight

  // Colors
  darkColor: string   // Outer border color
  lightColor: string  // Inner surface color (calculated via Lab color space)

  // Rotation
  origin_x, origin_y  // Rotation origin in pixels

  // Flags
  nonRectangular: boolean
}
```

**Constants**:

```typescript
// Visual constants
SELECTION_COLOR = '#dc3545'  // Red for selected keys
GHOST_OPACITY = 0.3          // Opacity for ghost keys
PIXEL_ALIGNMENT_OFFSET = 0.5 // For crisp 1px strokes

// Homing nub (F/J keys)
HOMING_NUB_WIDTH = 10
HOMING_NUB_HEIGHT = 2
HOMING_NUB_POSITION_RATIO = 0.9  // 90% down the key
HOMING_NUB_OPACITY = 0.3

// Default sizes
keySpacing = 0        // Gap between keys
bevelMargin = 6       // Border width
bevelOffsetTop = 3    // 3D bevel offset
bevelOffsetBottom = 3
padding = 3           // Text padding
roundOuter = 5        // Outer corner radius
roundInner = 3        // Inner corner radius
```

---

### LabelRenderer

**Location**: `src/utils/renderers/LabelRenderer.ts`

**Purpose**: Renders text labels, images, and SVG graphics on keys.

**Key Features**:
- **12 label positions**: 3x3 grid on top + 3 front legends
- **Rich formatting**: Bold, italic, nested styles
- **Mixed content**: Text + images + SVG
- **Auto-wrapping**: Word wrapping with overflow handling
- **Multi-line support**: `<br>` tag support
- **Asynchronous images**: Progressive rendering as images load

**Label Position Grid**:

```
Top surface (positions 0-8):
┌────────────┐
│ 0   1   2  │  ← Top row (baseline: hanging)
│            │
│ 3   4   5  │  ← Middle row (baseline: middle)
│            │
│ 6   7   8  │  ← Bottom row (baseline: alphabetic)
└────────────┘

Front face (positions 9-11):
│ 9   10  11 │  ← Front legends
```

**Label Rendering Algorithm**:

```typescript
// For each label (0-11):
for (const [index, label] of key.labels.entries()) {
  // 1. Calculate position
  const pos = labelPositions[index]
  const x = calculateHorizontalPosition(pos.align, params)
  const y = calculateVerticalPosition(pos.baseline, index, params)

  // 2. Calculate available space
  const availableWidth = params.textcapwidth
  const availableHeight = params.textcapheight

  // 3. Determine label type
  if (isImageOnly(label)) {
    drawImageLabel(label, x, y)
  } else if (isSvgOnly(label)) {
    drawSvgLabel(label, x, y)
  } else {
    // 4. Process text
    const processed = processLabelText(label)  // Convert <br> to \n

    // 5. Parse HTML
    const segments = parseHtmlText(processed)  // Cached!

    // 6. Render with wrapping
    drawWrappedText(segments, x, y, availableWidth, availableHeight)
  }
}
```

**HTML Label Parsing**:

Supported tags:
- `<b>...</b>` - Bold text
- `<i>...</i>` - Italic text
- `<b><i>...</i></b>` - Bold + italic (nested)
- `<br>` or `<br/>` - Line break
- `<img src="url" width="32" height="32">` - External image
- `<svg width="32" height="32">...</svg>` - Inline SVG

Example:

```html
<b>Shift</b>          → Bold "Shift"
<i>Ctrl</i>           → Italic "Ctrl"
<b><i>Alt</i></b>     → Bold italic "Alt"
Hello<br>World        → "Hello" on line 1, "World" on line 2
<img src="icon.png" width="16" height="16">  → 16x16 image
```

**Image Label Positioning**:

Images align to the **inner keycap surface** (not outer border):

```
Horizontal alignment:
- left:   image's left edge = innercapx
- center: image's center = innercapx + innercapwidth/2
- right:  image's right edge = innercapx + innercapwidth

Vertical alignment (by row):
- Top (0-2):    image's top = innercapy
- Middle (3-5): image's center = innercapy + innercapheight/2
- Bottom (6-8): image's bottom = innercapy + innercapheight
```

**Text Wrapping**:

1. **Single-line fitting**: If text fits in `availableWidth`, render directly
2. **Word wrapping**: Split by spaces, wrap when line exceeds width
3. **Overflow handling**: Truncate with ellipsis (`…`) if word too long
4. **Multi-line**: Respect line breaks from `<br>` tags
5. **Max lines**: Calculate `Math.floor(availableHeight / lineHeight)`

---

### RotationRenderer

**Location**: `src/utils/renderers/RotationRenderer.ts`

**Purpose**: Renders rotation UI elements (origin indicators, control points).

**Key Features**:
- **Rotation origin indicator**: Orange crosshair at rotation point
- **Rotation control points**: 5 points per key (4 corners + 1 center)
- **Hover effects**: Visual feedback on mouse-over
- **Selection state**: Highlights currently selected rotation origin
- **Hit testing**: Determines which control point is clicked

**Rotation Calculation**:

Uses canvas transformation matrix for exact alignment:

```typescript
// Calculate rotated position of a point
function calculateRotatedPoint(x, y, originX, originY, angle) {
  ctx.save()
  ctx.translate(originX * unit, originY * unit)
  ctx.rotate(angle)
  ctx.translate(-originX * unit, -originY * unit)

  const transform = ctx.getTransform()
  const rotatedX = transform.a * x + transform.c * y + transform.e
  const rotatedY = transform.b * x + transform.d * y + transform.f

  ctx.restore()
  return { x: rotatedX / unit, y: rotatedY / unit }
}
```

---

## Caching System

The rendering pipeline uses a **four-level caching system** for optimal performance:

### 1. SVGCache

**Purpose**: Cache SVG → data URL conversions

**How it works**:
```typescript
// Without cache:
const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
// encodeURIComponent is expensive for large SVGs!

// With cache:
const dataUrl = svgCache.toDataUrl(svg)  // Only encodes once
```

**Implementation**: LRU cache with max 1000 entries

**Statistics**:
```typescript
const stats = svgCache.getStats()
// → { hits, misses, size, maxSize, evictions, hitRate }
```

### 2. ImageCache

**Purpose**: Manage asynchronous image loading and caching

**Key features**:
- Prevents duplicate loading of same URL
- Tracks loading states: `'loading'` | `'error'` | `HTMLImageElement`
- Batches callbacks via `RenderScheduler`
- Validates SVG dimensions (warns if missing width/height)

**Loading flow**:
```typescript
// First call: starts loading
imageCache.loadImage(url, onLoad)
// State: 'loading'

// Subsequent calls while loading: adds to callback queue
imageCache.loadImage(url, onLoad2)
// onLoad2 will execute when image loads

// After load: all callbacks execute in next animation frame
// State: HTMLImageElement

// Future calls: callbacks execute immediately (already loaded)
imageCache.loadImage(url, onLoad3)
// onLoad3 executes in next frame
```

**CORS handling**:
```typescript
img.crossOrigin = 'anonymous'
// Allows canvas.toBlob() and canvas.toDataURL()
// Requires server to send: Access-Control-Allow-Origin: *
```

**Implementation**: LRU cache with max 1000 entries

### 3. ParseCache

**Purpose**: Cache HTML label parsing results

**Why needed**: Regex parsing is expensive, labels rarely change

**Usage**:
```typescript
const segments = parseCache.getParsed(label, (text) => {
  // Parser function only called on cache miss
  return doParseHtmlText(text)
})
```

**Parsed segments structure**:
```typescript
type ParsedSegment =
  | { type: 'text', text: string, bold: boolean, italic: boolean }
  | { type: 'image', src: string, width?: number, height?: number }
  | { type: 'svg', svgContent: string, width?: number, height?: number }
```

**Implementation**: LRU cache with max 1000 entries

### 4. ColorCache

**Purpose**: Cache color lightening calculations for improved rendering performance

**Why needed**: Lab color space conversion is computationally expensive; keys often use the same colors

**How it works**:
```typescript
// In KeyRenderer:
private colorCache = new Map<string, string>()

lightenColor(hexColor: string, factor = 1.2): string {
  const cacheKey = `${hexColor}_${factor}`

  // Check cache first
  if (this.colorCache.has(cacheKey)) {
    return this.colorCache.get(cacheKey)!
  }

  // Expensive Lab color space calculation
  const lightened = lightenColorLab(hexColor, factor)

  // Cache the result
  this.colorCache.set(cacheKey, lightened)
  return lightened
}

clearColorCache(): void {
  this.colorCache.clear()
}
```

**Cache invalidation**:
- Called when render options change (via `CanvasRenderer.updateOptions()`)
- Ensures cache doesn't grow unbounded
- Clears stale entries when rendering parameters change

**Implementation**: Simple Map-based cache (no size limit needed due to periodic invalidation)

### LRUCache (Base Implementation)

**Location**: `src/utils/caches/LRUCache.ts`

**Algorithm**: Least Recently Used eviction

**How it works**:
```typescript
// Map maintains insertion order in ES6+
// Most recently used items are at the end

get(key):
  if found:
    delete(key)    // Remove from current position
    set(key, val)  // Re-insert at end (most recent)
    return val

set(key, val):
  if cache.size >= maxSize:
    evict first entry  // Least recently used
  insert at end
```

**Statistics tracking**:
- `hits`: Number of cache hits
- `misses`: Number of cache misses
- `evictions`: Number of evicted entries
- `hitRate`: hits / (hits + misses)

---

## Utility Components

### BoundsCalculator

**Location**: `src/utils/utils/BoundsCalculator.ts`

**Purpose**: Calculate bounding boxes for keys and layouts

**Key features**:
- Rotation support (rotates corners, finds min/max)
- Non-rectangular keys (includes both rectangles)
- Stroke width inclusion (adds 1px)
- Decimal-math precision

**Algorithm for rotated keys**:

```typescript
// 1. Get all corners (4 for rect, 8 for non-rect)
const corners = [
  { x: keyX, y: keyY },                      // top-left
  { x: keyX + width, y: keyY },              // top-right
  { x: keyX, y: keyY + height },             // bottom-left
  { x: keyX + width, y: keyY + height },     // bottom-right
  // + 4 more for non-rectangular keys
]

// 2. Apply rotation to each corner
for (const corner of corners) {
  // Translate to origin
  const dx = corner.x - originX
  const dy = corner.y - originY

  // Rotate
  const rotatedX = dx * cos(angle) - dy * sin(angle)
  const rotatedY = dx * sin(angle) + dy * cos(angle)

  // Translate back
  const finalX = rotatedX + originX
  const finalY = rotatedY + originY

  // Update min/max
  minX = min(minX, finalX)
  minY = min(minY, finalY)
  maxX = max(maxX, finalX)
  maxY = max(maxY, finalY)
}

// 3. Return axis-aligned bounding box
return { minX, minY, maxX: maxX + strokeWidth, maxY: maxY + strokeWidth }
```

### HitTester

**Location**: `src/utils/utils/HitTester.ts`

**Purpose**: Determine which key (if any) is at a canvas position

**Key features**:
- Reverse iteration (last key = topmost)
- Rotation support (inverse transformation)
- Non-rectangular keys (test both rectangles)

**Algorithm**:

```typescript
getKeyAtPosition(x, y, keys):
  // Iterate in reverse for proper z-order
  for (let i = keys.length - 1; i >= 0; i--):
    const key = keys[i]
    const params = getRenderParams(key)

    // Apply inverse rotation if needed
    let testX = x, testY = y
    if (key.rotation_angle):
      testX, testY = inverseRotate(x, y, params.origin_x, params.origin_y, -angle)

    // Test main rectangle
    if (testX >= outercapx && testX <= outercapx + outercapwidth &&
        testY >= outercapy && testY <= outercapy + outercapheight):
      return key

    // Test second rectangle (non-rectangular keys)
    if (params.nonRectangular && ...):
      return key

  return null
```

### RenderScheduler

**Location**: `src/utils/utils/RenderScheduler.ts`

**Purpose**: Batch render operations using requestAnimationFrame

**Problem**: Multiple operations trigger re-renders (e.g., image loads, layout changes)

**Solution**: Batch all callbacks in the same frame

**How it works**:
```typescript
schedule(callback):
  callbacks.push(callback)

  if (!pendingRender):
    pendingRender = true
    requestAnimationFrame(() => {
      // Execute all callbacks together
      callbacks.forEach(cb => cb())
      callbacks = []
      pendingRender = false
    })
```

**Benefits**:
- Prevents multiple renders per frame (60 FPS performance)
- Reduces layout thrashing
- Ensures smooth animations

**Usage**:
```typescript
// Multiple image loads in same frame
imageCache.loadImage(url1, () => renderScheduler.schedule(rerender))
imageCache.loadImage(url2, () => renderScheduler.schedule(rerender))
imageCache.loadImage(url3, () => renderScheduler.schedule(rerender))
// → Only renders once, not three times!
```

---

## Parsers

### LabelParser

**Location**: `src/utils/parsers/LabelParser.ts`

**Purpose**: Parse HTML-formatted labels into renderable segments

**Supported HTML**:

```html
<b>Bold text</b>
<i>Italic text</i>
<b><i>Bold and italic</i></b>
Text<br>with<br>breaks
<img src="icon.png" width="16" height="16">
<svg width="24" height="24">...</svg>
```

**Parsing algorithm**:

```typescript
// Regex matches:
// 1. Opening/closing <b> or <i> tags
// 2. <img> tags with attributes
// 3. <svg>...</svg> tags with content
// 4. Plain text segments

const regex = /<\s*(\/?)([bi])\s*>|<img\s+([^>]+)>|<svg[^>]*>([\s\S]*?)<\/svg>|([^<]+)/gi

// State tracking:
let currentBold = false
let currentItalic = false
let currentText = ''

// Process matches:
for (const match of regex.exec(text)):
  if (match is text):
    currentText += match
  else if (match is <b> or <i>):
    if (currentText):
      emit({ type: 'text', text: currentText, bold, italic })
      currentText = ''
    update bold/italic state
  else if (match is <img>):
    extract src, width, height
    emit({ type: 'image', src, width, height })
  else if (match is <svg>):
    extract dimensions
    emit({ type: 'svg', svgContent, width, height })
```

**Line break processing**:

```typescript
processLabelText(label):
  // Convert <br> and <BR> tags to newlines
  return label.replace(/<br[^>]*>/gi, '\n')
```

### SVGProcessor

**Location**: `src/utils/parsers/SVGProcessor.ts`

**Purpose**: Validate and sanitize SVG content for security

**Security features**:

1. **Remove dangerous elements**:
   - `<script>` tags
   - `<iframe>`, `<object>`, `<embed>`
   - `<link>` tags
   - `<style>` tags (can contain `javascript:` URLs)

2. **Remove event handlers**:
   - `onclick`, `onload`, `onerror`, etc.
   - All `on*` attributes

3. **Remove dangerous URLs**:
   - `javascript:` protocol
   - `data:text/html` URLs

**Dimension extraction**:

```typescript
extractDimensions(svgContent):
  // Extract from attributes
  width = svgContent.match(/width\s*=\s*["']?(\d+)["']?/)
  height = svgContent.match(/height\s*=\s*["']?(\d+)["']?/)

  // Fallback to viewBox
  if (!width || !height):
    viewBox = svgContent.match(/viewBox\s*=\s*["']([^"']+)["']/)
    // viewBox="minX minY width height"
    width = viewBox[2]
    height = viewBox[3]

  return { width, height }
```

**Validation**:

```typescript
isValidSVG(content):
  // Must contain <svg> opening tag
  if (not /<svg[\s>]/.test(content)):
    return false

  // Must have closing tag
  if (not /<\/svg>/.test(content)):
    return false

  // Opening must come before closing
  if (openIndex >= closeIndex):
    return false

  return true
```

---

## Performance Optimization

### 1. Caching Strategy

**Four-level cache** eliminates redundant work:

```
Request for label "Shift"
    │
    ▼
ParseCache: Check if "Shift" parsed before
    │ (cache hit)
    └─► Return cached segments

Request for key color lightening
    │
    ▼
ColorCache: Check if color already lightened
    │ (cache hit)
    └─► Return cached lightened color (skips expensive Lab conversion)

Request for label with image
    │
    ▼
ParseCache: Parse HTML
    │
    ▼
ImageCache: Check if image loaded
    │ (cache hit)
    └─► Return cached image element

Request for label with SVG
    │
    ▼
ParseCache: Parse HTML
    │
    ▼
SVGCache: Convert SVG to data URL
    │ (cache hit)
    └─► Return cached data URL
    │
    ▼
ImageCache: Load data URL as image
    │ (cache hit)
    └─► Return cached image element
```

### 2. Render Batching

**RenderScheduler** prevents multiple renders per frame:

```
Frame 1:
  Image 1 loads → schedule render
  Image 2 loads → schedule render (batched)
  Image 3 loads → schedule render (batched)
  User changes layout → schedule render (batched)

  requestAnimationFrame:
    → Execute all 4 callbacks
    → Render once

Frame 2:
  (no more work)
```

### 3. Pixel Alignment

**Problem**: Non-aligned strokes render blurry

```
Without alignment:
  x = 100.3, y = 50.7
  ctx.strokeRect(100.3, 50.7, 54, 54)
  → Blurry 1px stroke (antialiasing across pixels)

With alignment:
  x = Math.round(100.3) + 0.5 = 100.5
  y = Math.round(50.7) + 0.5 = 50.5
  ctx.strokeRect(100.5, 50.5, 54, 54)
  → Crisp 1px stroke (centered on pixel)
```

**Implementation**:
```typescript
alignRectToPixels(x, y, width, height):
  alignedX = Math.round(x) + 0.5
  alignedY = Math.round(y) + 0.5
  alignedWidth = Math.round(x + width) - Math.round(x)
  alignedHeight = Math.round(y + height) - Math.round(y)
  return { x: alignedX, y: alignedY, width: alignedWidth, height: alignedHeight }
```

### 4. Progressive Rendering

**Images load asynchronously** without blocking:

```
Initial render:
  Keys with text labels → Render immediately
  Keys with images → Render placeholder, trigger load

Image loads (async):
  Image 1 loads → schedule re-render
  (render includes newly loaded image)

  Image 2 loads → schedule re-render
  (render includes both images)

  ...
```

**User experience**: Layout appears instantly, images "pop in" as loaded

### 5. Decimal Math (Layout Operations Only)

**Architectural Boundary**: Decimal.js usage is strategically limited to maximize performance

**Layout Operations** (keyboard store, geometry calculations):
- Uses `decimal-math` library for exact arithmetic
- Prevents accumulated floating-point errors in key positions
- Critical for precise layout calculations

**Rendering Operations** (canvas drawing):
- Uses native JavaScript `Math` for optimal performance
- Pixel alignment discards sub-pixel precision anyway

**Problem**: JavaScript floating-point arithmetic is imprecise

```javascript
// JavaScript standard:
0.1 + 0.2 === 0.30000000000000004  // NOT 0.3!

// For key positions:
key.x = 0.25   // 0.25U position
key.y = 1.5    // 1.5U position
// Accumulated errors can cause misalignment
```

**Solution for Layout**: Use `decimal-math` library in keyboard store

```typescript
import { D } from './decimal-math'

// Precise arithmetic for layout:
D.add(0.1, 0.2) === 0.3  // ✓

// Key position calculation:
const x = D.mul(key.x, unit)  // Precise for layout
const y = D.mul(key.y, unit)
```

**Optimization for Rendering**: Use native Math in renderers

```typescript
// In KeyRenderer, LabelRenderer, RotationRenderer:
// Native Math operations (post Phase 1 optimization)
const angle = key.rotation_angle * Math.PI / 180  // Fast!
const cos = Math.cos(angle)
const sin = Math.sin(angle)
const rotatedX = dx * cos - dy * sin
const rotatedY = dx * sin + dy * cos
```

**Why this works**:
- Canvas pixels are integers after `alignRectToPixels()`
- Sub-pixel precision from Decimal.js is lost during pixel alignment
- Native Math maintains sufficient precision for visual rendering
- Layout calculations preserve exact positions for serialization

---

## Implementation Details

### Architecture Boundaries

**Layout vs Rendering Separation**: The system maintains a clear separation between layout calculations and rendering operations:

**Layout Layer** (Keyboard Store, BoundsCalculator):
- Uses `decimal-math` (Decimal.js) for all arithmetic operations
- Maintains exact precision for key positions and dimensions
- Critical for serialization, deserialization, and layout modifications
- Examples: Key positioning, bounds calculation, layout transformations

**Rendering Layer** (KeyRenderer, LabelRenderer, RotationRenderer):
- Uses native JavaScript `Math` for all arithmetic operations
- Optimized for performance (51% faster than using Decimal.js)
- Sub-pixel precision unnecessary due to pixel alignment
- Examples: Canvas transformations, rotation calculations, color operations

**Conversion Point**: The boundary occurs when layout data is passed to renderers:
```typescript
// Layout: Decimal.js precision
const keyX = D.mul(key.x, unit)  // Exact arithmetic

// Rendering: Native Math performance
const angle = key.rotation_angle * Math.PI / 180  // Fast conversion
const cos = Math.cos(angle)
const rotatedX = dx * cos - dy * sin
```

### Coordinate Systems

**Three coordinate systems** are used:

1. **Key Units** (logical)
   - 1U = width of standard key
   - Key positions: `key.x`, `key.y` (in U)
   - Key sizes: `key.width`, `key.height` (in U)

2. **Canvas Pixels** (rendering)
   - `unit` parameter converts U → pixels (typically 54px/U)
   - Canvas coordinates: `x * unit`, `y * unit`

3. **Screen Pixels** (display)
   - `scale` parameter handles high DPI screens
   - canvas.width = layoutWidth * unit * scale
   - canvas.height = layoutHeight * unit * scale

**Conversion**:
```typescript
// Key units → Canvas pixels
const canvasX = D.mul(key.x, unit)
const canvasY = D.mul(key.y, unit)

// Canvas pixels → Key units
const keyX = D.div(canvasX, unit)
const keyY = D.div(canvasY, unit)
```

### Rotation Transformation

**Canvas rotation** uses transformation matrix:

```typescript
// Save current state
ctx.save()

// Apply rotation:
ctx.translate(originX, originY)  // 1. Move origin to rotation point
ctx.rotate(angleRadians)         // 2. Rotate around origin
ctx.translate(-originX, -originY) // 3. Move origin back

// Draw rotated content
drawKey()
drawLabels()

// Restore state
ctx.restore()
```

**Inverse rotation** (for hit testing):

```typescript
// Given: canvas position (x, y)
// Find: position in key's local space

const angle = -key.rotation_angle  // Negate for inverse
const dx = x - originX
const dy = y - originY

const localX = dx * cos(angle) - dy * sin(angle) + originX
const localY = dx * sin(angle) + dy * cos(angle) + originY

// Test if localX, localY is inside key bounds
```

### Non-Rectangular Keys

**Vector union** creates seamless joins:

```
ISO Enter (two rectangles):
  ┌────┐
  │    │
┌─┤    │
│ │    │
│ └────┘
└──────┘

Naive approach:
  drawRect(rect1)
  drawRect(rect2)  ← Gap/overlap at join!

Vector union approach:
  polygon1 = roundedRectToPolygon(rect1)
  polygon2 = roundedRectToPolygon(rect2)
  union = polygonClipping.union(polygon1, polygon2)
  path = polygonToPath2D(union)
  ctx.fill(path)   ← Perfect join!
  ctx.stroke(path) ← Consistent border
```

**Algorithm**:

```typescript
createVectorUnionPath(rectangles, radius):
  if (rectangles.length === 1):
    return simpleRoundedRectPath(rectangles[0])

  // Convert each rectangle to polygon
  const polygons = rectangles.map(rect =>
    makeRoundedRectPolygon(rect.x, rect.y, rect.width, rect.height, radius)
  )

  // Compute union
  let result = [[polygons[0]]]  // MultiPolygon format
  for (let i = 1; i < polygons.length; i++):
    result = polygonClipping.union(result, [[polygons[i]]])

  // Convert to Path2D
  return polygonToPath2D(result)

makeRoundedRectPolygon(x, y, w, h, r):
  // Approximate rounded corners with arc segments
  const points = []
  const segmentsPerQuarter = Math.max(6, Math.ceil(r / 2))

  // Top-left arc (180° to 270°)
  points.push(...arcPoints(x + r, y + r, r, Math.PI, 1.5 * Math.PI))
  // Top edge
  points.push([x + w - r, y])
  // Top-right arc (270° to 360°)
  points.push(...arcPoints(x + w - r, y + r, r, 1.5 * Math.PI, 2 * Math.PI))
  // Right edge
  points.push([x + w, y + h - r])
  // Bottom-right arc (0° to 90°)
  points.push(...arcPoints(x + w - r, y + h - r, r, 0, 0.5 * Math.PI))
  // Bottom edge
  points.push([x + r, y + h])
  // Bottom-left arc (90° to 180°)
  points.push(...arcPoints(x + r, y + h - r, r, 0.5 * Math.PI, Math.PI))
  // Left edge
  points.push([x, y + r])

  return points
```

### Color Calculation

**Lab color space** provides perceptually uniform lightening:

```typescript
lightenColor(hexColor, factor = 1.2):
  // 1. Convert hex to RGB
  const { r, g, b } = hexToRGB(hexColor)

  // 2. Convert sRGB to linear RGB
  const rLinear = toLinear(r / 255)
  const gLinear = toLinear(g / 255)
  const bLinear = toLinear(b / 255)

  // 3. Convert to CIE XYZ (D65 illuminant)
  const x = rLinear * 0.4124564 + gLinear * 0.3575761 + bLinear * 0.1804375
  const y = rLinear * 0.2126729 + gLinear * 0.7151522 + bLinear * 0.072175
  const z = rLinear * 0.0193339 + gLinear * 0.119192  + bLinear * 0.9503041

  // 4. Convert to Lab
  const L = 116 * f(y / 1.0) - 16
  const a = 500 * (f(x / 0.95047) - f(y / 1.0))
  const b = 200 * (f(y / 1.0) - f(z / 1.08883))

  // 5. Lighten L* component
  const L_new = Math.min(100, L * factor)

  // 6. Convert back: Lab → XYZ → RGB → hex
  return rgbToHex(r_new, g_new, b_new)

// Helper: sRGB gamma correction
toLinear(c):
  return (c <= 0.03928) ? c / 12.92 : ((c + 0.055) / 1.055) ^ 2.4

fromLinear(c):
  return (c <= 0.0031308) ? c * 12.92 : 1.055 * c^(1/2.4) - 0.055
```

**Why Lab color space?**

- RGB/HSL lightening: `lighten(#4287f5)` → Shifts hue (looks wrong)
- Lab lightening: `lighten(#4287f5)` → Preserves hue (looks natural)

Lab is **perceptually uniform**: Equal changes in L* produce equal perceived lightness changes.

### Text Rendering

**Multi-line rendering**:

```typescript
drawMultiLineText(lines, x, y, lineHeight, baseline):
  let startY = y

  // Adjust for baseline
  if (baseline === 'middle'):
    totalHeight = (lines.length - 1) * lineHeight
    startY = y - totalHeight / 2
  else if (baseline === 'alphabetic'):
    totalHeight = (lines.length - 1) * lineHeight
    startY = y - totalHeight

  // Draw each line
  for (let i = 0; i < lines.length; i++):
    lineY = startY + i * lineHeight
    ctx.fillText(lines[i], x, lineY)
```

**Text wrapping**:

```typescript
wrapText(text, maxWidth):
  const words = text.split(' ')
  const lines = []
  let currentLine = ''

  for (const word of words):
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const testWidth = ctx.measureText(testLine).width

    if (testWidth <= maxWidth):
      currentLine = testLine
    else:
      if (currentLine):
        lines.push(currentLine)
        currentLine = word
      else:
        // Single word too long
        lines.push(word)  // Add anyway

  if (currentLine):
    lines.push(currentLine)

  return lines
```

---

## Troubleshooting

### Common Issues

**1. Blurry rendering**

**Cause**: Non-aligned coordinates or missing DPI scaling

**Solution**:
- Ensure `alignRectToPixels()` is used for all strokes
- Check `scale` parameter matches `devicePixelRatio`

```typescript
// Correct:
canvas.width = layoutWidth * unit * scale
canvas.height = layoutHeight * unit * scale
ctx.scale(scale, scale)

// Incorrect:
canvas.width = layoutWidth * unit  // No scaling!
```

**2. Images not loading**

**Cause**: CORS errors or missing dimensions

**Solution**:
- Serve images with `Access-Control-Allow-Origin: *` header
- Add explicit `width` and `height` to SVG elements
- Check browser console for errors

```typescript
// Check image loading status:
const stats = imageCache.getStats()
console.log(`Loaded: ${stats.loaded}, Errors: ${stats.errors}`)
```

**3. Non-rectangular keys have gaps**

**Cause**: Vector union failed or disabled

**Solution**:
- Check browser console for "Vector union calculation failed" warning
- Ensure `polygon-clipping` library is loaded
- Verify rectangles actually overlap or touch

**4. Text overflows key**

**Cause**: Font size too large or wrapping disabled

**Solution**:
- Reduce `textSize` property
- Check available space: `params.textcapwidth`, `params.textcapheight`
- Verify wrapping algorithm is enabled

**5. Slow rendering**

**Cause**: Too many re-renders or large layouts

**Solution**:
- Check `RenderScheduler` is batching correctly
- Monitor render frequency (should be ≤ 60 FPS)
- Profile with Chrome DevTools Performance tab

```typescript
// Monitor render calls:
let renderCount = 0
const original = canvasRenderer.render
canvasRenderer.render = function(...args) {
  renderCount++
  console.log(`Render #${renderCount}`)
  return original.apply(this, args)
}
```

---

### Dependencies

- **@adamws/kle-serial**: Keyboard layout data structures
- **polygon-clipping**: Vector union for non-rectangular keys
- **decimal-math**: Precise arithmetic for coordinates
