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
  - [BoundsCalculator](#boundscalculator)
  - [HitTester](#hittester)
  - [LinkTracker](#linktracker)
  - [Layout Change Event System](#layout-change-event-system)
  - [RenderScheduler](#renderscheduler)
  - [Key Selection Disambiguation](#key-selection-disambiguation)
  - [Canvas Search](#canvas-search)
- [Parsers](#parsers)
  - [LabelParser](#labelparser)
  - [LabelAST](#labelast)
  - [SVGProcessor](#svgprocessor)
- [Performance Optimization](#performance-optimization)
- [Implementation Details](#implementation-details)
- [Troubleshooting](#troubleshooting)
- [Alternative Layouts Preview](#alternative-layouts-preview)
  - [Overview](#alt-layouts-overview)
  - [Architecture](#alt-layouts-architecture)
  - [layout-options.ts](#layout-optionsts)
  - [Store State](#store-state)
  - [LayoutOptionToolbar.vue](#layoutoptiontoolbarvue)
  - [Canvas Wiring](#canvas-wiring)
  - [Read-Only Gating](#read-only-gating)
- [Recent Improvements](#recent-improvements)

---

## Overview

The kle-ng canvas rendering pipeline is a modular, high-performance system for rendering keyboard layouts on HTML5 Canvas. It supports advanced features like:

- **Key rendering** with multiple shapes (rectangular, non-rectangular, circular)
- **Rich label formatting** with HTML tags, images, inline SVG, clickable links, and lists
- **Rotation support** with interactive rotation origin controls
- **High DPI rendering** with proper pixel alignment
- **Performance optimization** through multi-level caching
- **Asynchronous image loading** with progressive rendering
- **Overlapping key disambiguation** with interactive popup selection
- **Canvas text search** with amber highlight overlays and prev/next navigation
- **Alternative layouts preview** for VIA-annotated keyboards with `option,choice` keys

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
       │  - LinkTracker (link hit testing)        │
       │  - RotationRenderer (rotation UI)        │
       │  - useKeySearch (search state)           │
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
       │  - LabelParser (HTML → AST)              │
       │  - LabelAST (AST type definitions)       │
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
User Action (e.g., layout change, key drag)
    │
    ▼
Store updates (keyboard.ts)
    │
    ├─► saveState() → dispatches 'keys-modified' event
    ├─► undo() → dispatches 'keys-modified' event
    └─► redo() → dispatches 'keys-modified' event
    │
    ▼
KeyboardCanvas.vue receives 'keys-modified' event
    │
    ├─► updateCanvasSize() (resize canvas if bounds changed)
    └─► RenderScheduler.schedule(renderKeyboard)
    │
    ▼
RenderScheduler batches callbacks
    │ (deduplicates identical callbacks)
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
    ├─► For each key (four-pass render order):
    │   │
    │   ├─► Pass 1: Regular non-selected, non-match keys
    │   │   ├─► KeyRenderer.drawKey() — black border
    │   │   └─► LabelRenderer.drawKeyLabels()
    │   │
    │   ├─► Pass 2: Search match keys (non-selected)
    │   │   ├─► KeyRenderer.drawKey() — amber border (#f59e0b)
    │   │   └─► LabelRenderer.drawKeyLabels()
    │   │
    │   ├─► Pass 3: Selected keys
    │   │   ├─► KeyRenderer.drawKey() — red border (#dc3545)
    │   │   └─► LabelRenderer.drawKeyLabels()
    │   │
    │   └─► Pass 4: Popup-hovered key (disambiguation)
    │       └─► KeyRenderer.drawKey() — red border (isHovered)
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
   - Non-selected keys further partitioned into regular and search-match groups in a single pass
   - Ensures proper Z-ordering: regular → search matches → selected → popup-hovered

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
  render(
    keys,
    selectedKeys,
    metadata,
    clearCanvas?,
    showRotationPoints?,
    hoveredRotationPointId?,
    selectedRotationOrigin?,
    popupHoveredKey?,
    hoveredLinkHref?,
    searchMatchKeys?,
  )

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
  getAllKeysAtPosition(x: number, y: number, keys: Key[]) // For overlapping key disambiguation
  getRotationPointAtPosition(x: number, y: number)
  getLinkAtPosition(x: number, y: number) // For clickable link detection
}
```

**Render Options**:

```typescript
interface RenderOptions {
  unit: number // Pixel size of 1U (typically 54px)
  background: string // Background color (e.g., "#f0f0f0")
  showGrid?: boolean // Reserved for future grid feature
  scale?: number // DPI scaling factor
  fontFamily?: string // Custom font family for labels
}
```

**Important Methods**:

- **`render()`**: Main rendering entry point
  - Clears linkTracker at start (for fresh link hit testing)
  - Clears canvas (optional)
  - Draws background with border radius
  - Partitions keys into four layers (regular → search matches → selected → popup-hovered)
  - Delegates key/label rendering (passing `hoveredLinkHref` for underline styling)
  - Draws popup-hovered key on top with highlight (for overlapping key disambiguation)
  - Draws rotation UI overlays

- **`getLinkAtPosition()`**: Returns clickable link at canvas coordinates
  - Delegates to LinkTracker singleton
  - Used for hover detection and click handling

- **`updateOptions()`**: Updates render options and propagates to child components

---

### KeyRenderer

**Location**: `src/utils/renderers/KeyRenderer.ts`

**Purpose**: Renders keyboard key shapes (borders, fills, special shapes).

**Key Features**:

- **Multiple key shapes**: Rectangular, non-rectangular (ISO Enter, Big-Ass Enter), circular (rotary encoders)
- **Vector union**: Seamless non-rectangular key rendering using polygon-clipping
- **Pixel alignment**: Ensures crisp 1px borders on all screens
- **Axis-aligned rotation optimization**: Special handling for 90°/180°/270° rotations for perfect pixel alignment
- **Rotation support**: Proper transformation handling for arbitrary angles
- **Color calculation**: Lab color space lightening for realistic appearance (with caching)
- **Performance optimized**: Native Math operations, color lightening cache
- **Hover highlighting**: Visual feedback for overlapping key disambiguation popup

**Rendering Algorithm**:

```typescript
// 1. Calculate render parameters
const params = getRenderParams(key, options)
// → Returns: outer cap, inner cap, text area dimensions

// 2. Check if axis-aligned rotation (0°, 90°, 180°, 270°)
const axisAlignedAngle = getAxisAlignedRotation(key.rotation_angle)

// 3a. For axis-aligned rotations: rotate coordinates FIRST
if (axisAlignedAngle !== null && axisAlignedAngle !== 0) {
  // Rotate all rectangles mathematically (no canvas transformation)
  params.outer = rotateRect(params.outer, origin, axisAlignedAngle)
  params.inner = rotateRect(params.inner, origin, axisAlignedAngle)
  params.text = rotateRect(params.text, origin, axisAlignedAngle)
  // For non-rectangular: also rotate secondary rectangles
}

// 3b. Apply pixel alignment (works perfectly on axis-aligned rotated rectangles)
const shouldAlign = !key.rotation_angle || axisAlignedAngle !== null
if (shouldAlign) {
  params = alignRectToPixels(params)
  // → Crisp edges for non-rotated and axis-aligned rotated keys
}

// 3c. For non-axis-aligned rotations: use canvas transformation
if (key.rotation_angle && axisAlignedAngle === null) {
  ctx.translate(origin_x, origin_y)
  ctx.rotate(angle)
  ctx.translate(-origin_x, -origin_y)
  // → Smooth antialiased rendering for arbitrary angles
}

// 4. Draw key shape
if (isCircular) {
  drawCircularKey() // For rotary encoders
} else if (nonRectangular) {
  drawKeyRectangleLayers() // Vector union for ISO Enter
} else {
  drawRoundedRect() // Standard rectangular key
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
  outercapx
  outercapy
  outercapwidth
  outercapheight
  outercapx2?
  outercapy2?
  outercapwidth2?
  outercapheight2? // For non-rectangular

  // Inner surface (top of key)
  innercapx
  innercapy
  innercapwidth
  innercapheight
  innercapx2?
  innercapy2?
  innercapwidth2?
  innercapheight2? // For non-rectangular

  // Text rendering area
  textcapx
  textcapy
  textcapwidth
  textcapheight

  // Colors
  darkColor: string // Outer border color
  lightColor: string // Inner surface color (calculated via Lab color space)

  // Rotation
  origin_x
  origin_y // Rotation origin in pixels

  // Flags
  nonRectangular: boolean
}
```

**Constants**:

```typescript
// Visual constants
SELECTION_COLOR = '#dc3545' // Red for selected keys
HOVER_COLOR = '#dc3545' // Same color for hovered keys (popup disambiguation)
SEARCH_MATCH_COLOR = '#f59e0b' // Amber color for search match keys
GHOST_OPACITY = 0.3 // Opacity for ghost keys
PIXEL_ALIGNMENT_OFFSET = 0.5 // For crisp 1px strokes

// Homing nub (F/J keys)
HOMING_NUB_WIDTH = 10
HOMING_NUB_HEIGHT = 2
HOMING_NUB_POSITION_RATIO = 0.9 // 90% down the key
HOMING_NUB_OPACITY = 0.3

// Default sizes
keySpacing = 0 // Gap between keys
bevelMargin = 6 // Border width
bevelOffsetTop = 3 // 3D bevel offset
bevelOffsetBottom = 3
padding = 3 // Text padding
roundOuter = 5 // Outer corner radius
roundInner = 3 // Inner corner radius
```

---

### LabelRenderer

**Location**: `src/utils/renderers/LabelRenderer.ts`

**Purpose**: Renders text labels, images, and SVG graphics on keys.

**Key Features**:

- **12 label positions**: 3x3 grid on top + 3 front legends
- **Rich formatting**: Bold, italic, nested styles
- **Clickable links**: `<a>` tag support with hover underline and URL preview
- **Lists**: Ordered (`<ol>`) and unordered (`<ul>`) lists with proper bullet/number markers
- **Mixed content**: Text + images + SVG + links
- **Auto-wrapping**: Word wrapping with overflow handling
- **Multi-line support**: `<br>` tag support
- **Asynchronous images**: Progressive rendering as images load
- **Link hit testing**: Registers link bounding boxes with LinkTracker

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
    // 4. Parse HTML into AST nodes
    const nodes = labelParser.parse(label) // Cached! Returns LabelNode[]

    // 5. Build rotation context for link tracking (if key is rotated)
    const rotationContext = key.rotation_angle ? { angle, originX, originY } : undefined

    // 6. Render with wrapping (handles text, links, images, SVGs)
    drawWrappedNodes(nodes, x, y, availableWidth, availableHeight, rotationContext, hoveredLinkHref)
  }
}
```

**HTML Label Parsing**:

Supported tags:

- `<b>...</b>` or `<strong>...</strong>` - Bold text
- `<i>...</i>` or `<em>...</em>` - Italic text
- `<b><i>...</i></b>` - Bold + italic (nested)
- `<a href="url">...</a>` - Clickable link (opens in new tab)
- `<br>` or `<br/>` - Line break
- `<img src="url" width="32" height="32">` - External image
- `<svg width="32" height="32">...</svg>` - Inline SVG
- `<ul><li>...</li></ul>` - Unordered list (bullet points)
- `<ol><li>...</li></ol>` - Ordered list (numbered)

Example:

```html
<b>Shift</b> → Bold "Shift" <i>Ctrl</i> → Italic "Ctrl" <strong>Alt</strong> → Bold "Alt" (same as
<b
  >) <em>Meta</em> → Italic "Meta" (same as
  <i
    >) <b><i>Alt</i></b> → Bold italic "Alt" Hello<br />World → "Hello" on line 1, "World" on line 2
    <a href="https://example.com">Link</a> → Blue clickable link with underline on hover
    <img src="icon.png" width="16" height="16" /> → 16x16 image
    <ul>
      <li>Item 1</li>
      <li>Item 2</li>
    </ul>
    → Bulleted list
    <ol>
      <li>First</li>
      <li>Second</li>
    </ol>
    → Numbered list</i
  ></b
>
```

**Link Rendering**:

Links (`<a>` tags) are rendered with special styling and interactivity:

- **Color**: Links render in blue (#0066cc)
- **Hover underline**: When `hoveredLinkHref` matches the link's href, an underline is drawn
- **Hit testing**: Link bounding boxes are registered with LinkTracker for click detection
- **Security**: Only `http://` and `https://` URLs are opened (validated in KeyboardCanvas.vue)
- **Rotation support**: Links work correctly on rotated keys via inverse rotation transformation

**List Rendering**:

Lists (`<ul>` and `<ol>` tags) are rendered as block elements with proper formatting:

- **Unordered lists**: Rendered with bullet markers (`•`)
- **Ordered lists**: Rendered with numbered markers (`1.`, `2.`, etc.)
- **Nested lists**: Supported with proper indentation (12px per level)
- **Alignment**: Lists respect label alignment (left/center/right)
- **Word wrapping**: Long list items wrap with proper indentation
- **Text-only content**: Lists support text, links, and nested lists (images/SVGs filtered out)
- **Item spacing**: 2px extra vertical spacing between items

List Rendering Constants:

```typescript
LIST_BULLET = '•' // Bullet character for unordered lists
LIST_INDENT = 12 // Pixels to indent nested list content
LIST_ITEM_SPACING = 2 // Extra vertical spacing between items
```

Example rendering:

```
Unordered list:           Ordered list:
• Item 1                  1. First
• Item 2                  2. Second
  • Nested item           3. Third
• Item 3
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
const dataUrl = svgCache.toDataUrl(svg) // Only encodes once
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

**Why needed**: DOMParser-based parsing is expensive, labels rarely change

**Usage**:

```typescript
const nodes = parseCache.getParsed(label, (text) => {
  // Parser function only called on cache miss
  return labelParser.doParse(text)
})
```

**Cached type**:

```typescript
// Now caches LabelNode[] (AST nodes) instead of old ParsedSegment[]
type LabelNode = TextNode | LinkNode | ImageNode | SVGNode

// TextNode and LinkNode include TextStyle for bold/italic
interface TextStyle {
  bold?: boolean
  italic?: boolean
}
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
  { x: keyX, y: keyY }, // top-left
  { x: keyX + width, y: keyY }, // top-right
  { x: keyX, y: keyY + height }, // bottom-left
  { x: keyX + width, y: keyY + height }, // bottom-right
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
- Overlapping key detection (returns all keys at position)

**Public Methods**:

- **`getKeyAtPosition(x, y, keys)`**: Returns the topmost key at the given position, or `null` if no key is hit
- **`getAllKeysAtPosition(x, y, keys)`**: Returns all keys at the given position (for overlapping key disambiguation), ordered topmost first

**Algorithm**:

```typescript
// Internal helper for point-in-key testing
isPointInKey(x, y, key, params):
  let testX = x, testY = y

  // Apply inverse rotation if needed
  if (key.rotation_angle):
    testX, testY = inverseRotate(x, y, params.origin_x, params.origin_y, -angle)

  // Test main rectangle
  if (testX >= outercapx && testX <= outercapx + outercapwidth &&
      testY >= outercapy && testY <= outercapy + outercapheight):
    return true

  // Test second rectangle (non-rectangular keys)
  if (params.nonRectangular && ...):
    return true

  return false

getKeyAtPosition(x, y, keys):
  // Iterate in reverse for proper z-order (topmost first)
  for (let i = keys.length - 1; i >= 0; i--):
    const key = keys[i]
    const params = getRenderParams(key)

    if (isPointInKey(x, y, key, params)):
      return key

  return null

getAllKeysAtPosition(x, y, keys):
  const result = []

  // Iterate in reverse for proper z-order (topmost first in result)
  for (let i = keys.length - 1; i >= 0; i--):
    const key = keys[i]
    const params = getRenderParams(key)

    if (isPointInKey(x, y, key, params)):
      result.push(key)

  return result
```

### LinkTracker

**Location**: `src/utils/renderers/LinkTracker.ts`

**Purpose**: Track clickable link bounding boxes during label rendering for hit testing

Since HTML Canvas has no native link support, the LinkTracker provides a mechanism to:

1. Register link bounding boxes during rendering
2. Provide hit testing with rotation support for click/hover detection

**Key Features**:

- **Bounding box registration**: During rendering, links register their position and dimensions
- **Hit testing with rotation**: `getLinkAtPosition(x, y)` returns the link at canvas coordinates
- **Rotation support**: Applies inverse rotation transformation for accurate hit testing on rotated keys
- **Singleton pattern**: Global `linkTracker` instance shared across the application

**Interface**:

```typescript
interface LinkBoundingBox {
  id: string // Unique identifier
  href: string // URL to open when clicked
  displayText: string // Link text (for debugging)
  localX: number // X position in key's coordinate space
  localY: number // Y position (top of bounding box)
  localWidth: number // Width of bounding box
  localHeight: number // Height of bounding box
  rotationAngle: number // Key's rotation angle in degrees
  rotationOriginX: number // Rotation origin X in canvas coordinates
  rotationOriginY: number // Rotation origin Y in canvas coordinates
}
```

**Public Methods**:

- **`clear()`**: Clear all tracked links. Called at the start of each render.
- **`registerLink(...)`**: Register a link during rendering with position, size, and rotation info.
- **`getLinkAtPosition(x, y)`**: Get the link at canvas coordinates (handles rotation).
- **`getLinks()`**: Get all registered links (for debugging).
- **`count`**: Get the number of registered links.

**Hit Testing Algorithm**:

```typescript
getLinkAtPosition(canvasX, canvasY):
  // Check links in reverse order (last registered is on top)
  for (let i = links.length - 1; i >= 0; i--):
    const link = links[i]
    let testX = canvasX, testY = canvasY

    // Apply inverse rotation if link's key is rotated
    if (link.rotationAngle):
      const angle = -link.rotationAngle * PI / 180
      testX, testY = inverseRotate(canvasX, canvasY, origin, angle)

    // Test if point is inside link bounding box
    if (testX >= link.localX && testX <= link.localX + link.localWidth &&
        testY >= link.localY && testY <= link.localY + link.localHeight):
      return link

  return null
```

**Usage in Rendering Pipeline**:

1. `CanvasRenderer.render()` calls `linkTracker.clear()` at start of each render
2. `LabelRenderer.renderLinkNode()` calls `linkTracker.registerLink()` for each link
3. `CanvasRenderer.getLinkAtPosition()` delegates to `linkTracker.getLinkAtPosition()`
4. `KeyboardCanvas.vue` uses `getLinkAtPosition()` for hover detection and click handling

### Layout Change Event System

**Location**: `src/stores/keyboard.ts` (event dispatch) and `src/components/KeyboardCanvas.vue` (event handling)

**Purpose**: Notify the canvas component when the keyboard layout has been modified, requiring canvas update and re-render

**Architecture**: Event-driven communication between store and canvas component

**What triggers the event**:

- Key position changes (drag, arrow keys, rotation)
- Key property changes (color, label, size, shape)
- Layout modifications (add/delete keys, undo/redo)
- Any operation that calls `saveState()`, `undo()`, or `redo()`

**How it works**:

The keyboard store dispatches a custom `keys-modified` event whenever any layout modification occurs:

```typescript
// In keyboard store (keyboard.ts)
function saveState() {
  // ... save state logic ...

  // Notify canvas of layout changes
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('keys-modified'))
  }
}

function undo() {
  // ... undo logic ...

  // Notify canvas of layout changes (undo doesn't call saveState)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('keys-modified'))
  }
}

function redo() {
  // ... redo logic ...

  // Notify canvas of layout changes (redo doesn't call saveState)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('keys-modified'))
  }
}
```

The canvas component listens for this event and responds by updating canvas size (if layout bounds changed) and scheduling a render:

```typescript
// In KeyboardCanvas.vue
onMounted(() => {
  window.addEventListener('keys-modified', handleKeysModified as EventListener)
})

const handleKeysModified = () => {
  updateCanvasSize()
  renderScheduler.schedule(renderKeyboard)
}

onBeforeUnmount(() => {
  window.removeEventListener('keys-modified', handleKeysModified as EventListener)
})
```

**Benefits over Vue watchers**:

- **Decoupled architecture**: Store doesn't need to know about canvas implementation
- **Explicit communication**: Clear event-based API for layout changes
- **Better performance**: Avoids expensive deep watchers on key position arrays
- **Simpler reactivity**: No need for computed refs or aggressive watchers
- **Clearer intent**: Event name explicitly describes what changed
- **Comprehensive coverage**: Handles all layout changes (position, color, labels, rotation, etc.), not just bound changes

**Special case - Drag operations**:
During key drag operations, the canvas also updates its size directly in the mouse handler to accommodate keys being dragged beyond current bounds:

```typescript
// In handleMouseMoveShared (KeyboardCanvas.vue)
if (keyboardStore.mouseDragMode === 'key-move') {
  keyboardStore.updateKeyDrag(pos)

  // Update canvas size to accommodate keys dragged beyond current bounds
  updateCanvasSize()

  // Schedule render (will be deduplicated with other renders in same frame)
  renderScheduler.schedule(renderKeyboard)
}
```

**Replaced architecture**:
Prior to this implementation, the system used an "aggressive watcher" that created new arrays on every reactivity check:

```typescript
// OLD APPROACH (removed):
watch(
  () =>
    keyboardStore.keys.map((key) => ({
      x: key.x,
      y: key.y,
      width: key.width,
      height: key.height,
      rotation_angle: key.rotation_angle || 0,
      rotation_x: key.rotation_x || 0,
      rotation_y: key.rotation_y || 0,
    })),
  async () => {
    await nextTick()
    updateCanvasSize()
    renderScheduler.schedule(renderKeyboard)
  },
  { deep: true },
)
```

This watcher was problematic because:

- Created new arrays on every Vue reactivity check
- Performed deep comparison on nested objects
- Fired redundantly with other watchers
- Contributed to performance issues during drag operations

### RenderScheduler

**Location**: `src/utils/utils/RenderScheduler.ts`

**Purpose**: Batch and deduplicate render operations using requestAnimationFrame

**Problem**: Multiple operations trigger re-renders (e.g., image loads, layout changes, drag operations)

**Solution**: Batch all callbacks in the same frame and deduplicate identical callback references

**How it works**:

```typescript
schedule(callback):
  callbacks.add(callback)  // Set automatically deduplicates

  if (!pendingRender):
    pendingRender = true
    requestAnimationFrame(() => {
      // Execute all unique callbacks together
      Array.from(callbacks).forEach(cb => cb())
      callbacks.clear()
      pendingRender = false
    })
```

**Key Feature - Callback Deduplication**:
The scheduler uses a `Set` instead of an array to store callbacks, which automatically deduplicates identical function references. This prevents redundant render operations:

```typescript
// During a drag operation:
renderScheduler.schedule(renderKeyboard) // From mouse handler
renderScheduler.schedule(renderKeyboard) // From keys watcher
renderScheduler.schedule(renderKeyboard) // From event listener
// → Set contains only 1 unique callback
// → renderKeyboard() executes only once per frame!
```

**Performance Impact**:
Without deduplication, the same render callback could execute 10-30+ times in a single animation frame during intensive operations like drag, causing severe performance degradation (60fps → ~10fps). Deduplication ensures optimal performance by executing each unique callback exactly once per frame.

**Benefits**:

- Prevents multiple renders per frame (60 FPS performance)
- Automatically deduplicates identical callbacks
- Reduces layout thrashing
- Ensures smooth animations and drag operations
- Eliminates redundant render operations

**Usage**:

```typescript
// Multiple image loads in same frame
imageCache.loadImage(url1, () => renderScheduler.schedule(rerender))
imageCache.loadImage(url2, () => renderScheduler.schedule(rerender))
imageCache.loadImage(url3, () => renderScheduler.schedule(rerender))
// → Only renders once, not three times!

// Drag operation with multiple watchers
handleMouseMove() {
  renderScheduler.schedule(renderKeyboard)  // From mouse handler
}
watch(keys, () => {
  renderScheduler.schedule(renderKeyboard)  // From watcher
})
// → Both schedule the same function reference
// → renderKeyboard() executes only once per frame
```

### Key Selection Disambiguation

**Location**: `src/components/KeySelectionPopup.vue`, `src/components/KeyboardCanvas.vue`, `src/stores/keyboard.ts`

**Purpose**: Allow users to select from overlapping keys when multiple keys occupy the same canvas position

**Problem**: When keys overlap (e.g., stacked layouts), clicking on the overlapping area would only select the topmost key, making it impossible to select keys underneath.

**Solution**: When a click detects multiple keys at the same position, display a popup menu listing all overlapping keys, allowing the user to choose which one to select.

**Architecture**:

```
Click on canvas
    │
    ▼
HitTester.getAllKeysAtPosition(x, y, keys)
    │
    ├─► 0 keys: Deselect all
    ├─► 1 key: Select directly (no popup)
    └─► 2+ keys: Show disambiguation popup
              │
              ▼
        KeySelectionPopup.vue
              │
              ├─► Display list of overlapping keys
              ├─► Show key color and label preview
              ├─► Highlight hovered key on canvas
              └─► User selects key → close popup
```

**Key Components**:

1. **HitTester.getAllKeysAtPosition()**: Returns all keys at a position (topmost first)
2. **KeySelectionPopup.vue**: Dropdown component for key selection
3. **KeyRenderer `isHovered` option**: Renders highlighted border for popup-hovered key
4. **CanvasRenderer `popupHoveredKey` parameter**: Draws hovered key on top with highlight

**Popup Features**:

- Displays key color swatch and label for identification
- Shows position info (x, y coordinates)
- Keyboard navigation (arrow keys, Enter, Escape)
- Mouse hover highlights the corresponding key on canvas
- Viewport-aware positioning (clamps to screen boundaries)
- Supports both single-select and extend-selection (Shift+click)

**Visual Feedback**:

When hovering over a key in the popup:

1. Store sets `popupHoveredKey` to the hovered key
2. Canvas re-renders with the hovered key drawn on top
3. KeyRenderer draws the key with `isHovered=true` (2px red border)

```typescript
// In CanvasRenderer.render()
if (popupHoveredKey) {
  this.drawKey(popupHoveredKey, false, true) // isHovered=true
}

// In KeyRenderer.drawKey()
const borderColor = options.isHovered
  ? KeyRenderer.HOVER_COLOR // Red highlight
  : options.isSelected
    ? KeyRenderer.SELECTION_COLOR // Red
    : options.isSearchMatch
      ? KeyRenderer.SEARCH_MATCH_COLOR // Amber
      : '#000000'
```

**State Management**:

```typescript
// In keyboard store
const keySelectionPopup = ref({
  visible: boolean
  position: { x: number, y: number }
  keys: Key[]
  extendSelection: boolean
})
const popupHoveredKey: Ref<Key | null> = ref(null)

// Actions
showKeySelectionPopup(x, y, overlappingKeys, extendSelection)
hideKeySelectionPopup()
selectKeyFromPopup(key)
setPopupHoveredKey(key | null)
```

---

### Canvas Search

**Locations**:

- `src/composables/useKeySearch.ts` — search state and logic
- `src/components/CanvasSearchBar.vue` — search UI component
- `src/components/KeyboardCanvas.vue` — integration (shortcut, wiring, render call)

**Purpose**: Allow users to find keys by label text on the canvas. Matching keys are highlighted with an amber outline. The current match is also selected (red border). Users navigate with Enter/Shift+Enter or the up/down buttons.

**Architecture**:

```
User presses '/' (canvas focused)
    │
    ▼
KeyboardCanvas.vue opens CanvasSearchBar (v-if mounts component)
    │
    ▼
CanvasSearchBar auto-focuses input (onMounted → setTimeout 0)
    │
    ▼
User types query
    │
    ▼
useKeySearch.matchingKeys recomputes
    │   (labelParser.getPlainText on all 12 labels, case-insensitive)
    │
    ├─► selectCurrentSearchMatch() → keyboardStore.selectKey(currentMatchKey)
    │
    └─► renderScheduler.schedule(renderKeyboard)
            │
            ▼
        renderer.render(..., searchMatchKeys)
            │
            ├─► regular non-selected keys (black border)
            ├─► search match keys (amber border, 2px stroke)
            ├─► selected key / current match (red border, 2px stroke)
            └─► popup-hovered key
```

**State Management** (`useKeySearch` composable):

```typescript
// State
isSearchOpen: Ref<boolean>
searchQuery: Ref<string>
currentMatchIndex: Ref<number>     // internal; not exposed in UseKeySearch interface
allKeys: Ref<Key[]>                // internal; synced via setKeys()

// Computed
matchingKeys: ComputedRef<Key[]>   // pure; trims query before matching
currentMatchKey: ComputedRef<Key | null>
matchCount: ComputedRef<number>
matchCountDisplay: ComputedRef<string>  // e.g. "3 / 12" | "No matches" | ""

// Actions
setKeys(keys: Key[]): void         // called by KeyboardCanvas watcher
openSearch(): void
closeSearch(): void                // resets query and index; does NOT clear allKeys
nextMatch(): void                  // wraps around
previousMatch(): void              // wraps around
```

**Key implementation notes**:

- `matchingKeys` is a pure computed with no side effects. Index clamping (when matches shrink) is handled by a separate `watch(matchingKeys)` to avoid circular reactive dependency.
- `searchQuery` change resets `currentMatchIndex` to 0 via an internal `watch(searchQuery, ..., { flush: 'sync' })` — no public `onQueryChange()` method is needed.
- `closeSearch()` does not clear `allKeys` because the watcher `watch(keyboardStore.keys, setKeys)` only fires on key list changes, not on search open/close. Clearing `allKeys` on close would leave the composable without key data on reopen until the next key edit.
- `useKeySearch()` creates **non-shared local state** per call. It must be called once per canvas instance, not shared across components.

**Focus and event handling**:

- `CanvasSearchBar` uses `v-if` on the component element in `KeyboardCanvas.vue` (not on an internal div), so `onMounted` fires at mount time and `setTimeout(0)` reliably focuses the input.
- The search bar wrapper has `@mousedown.stop @click.stop` to prevent the canvas container's `handleContainerMouseDown` / `handleContainerClick` from stealing focus.
- `onKeyDown` in `CanvasSearchBar` stops propagation for all keys **except Tab** (WCAG 2.1 SC 2.1.2 compliance), preventing canvas shortcuts from firing while the search bar is active.
- Ctrl+F toggles: if search is already open, it closes it.
- Escape while search is open calls `closeCanvasSearch()` instead of `unselectAll()`.

**Matching logic** (`keyMatchesQuery`):

```typescript
function keyMatchesQuery(key: Key, query: string): boolean {
  const q = query.toLowerCase()
  for (const label of key.labels) {
    if (!label) continue
    const nodes = labelParser.parse(label) // uses ParseCache
    const text = labelParser.getPlainText(nodes) // strips HTML formatting
    if (text.toLowerCase().includes(q)) return true
  }
  return false
}
```

HTML-formatted labels (e.g. `<b>Shift</b>`) are matched correctly because `getPlainText` strips the tags before comparison. The query is trimmed before matching; a whitespace-only query returns no matches.

**Rendering integration**:

The `render()` call in `KeyboardCanvas.vue` passes the current match list as the 10th argument:

```typescript
const searchMatchKeys = keySearch.isSearchOpen.value ? keySearch.matchingKeys.value : []
renderer.value.render(
  keyboardStore.keys,
  keysToHighlight,
  keyboardStore.metadata,
  false,
  showRotation,
  hoveredRotationPointId.value || undefined,
  keyboardStore.rotationOrigin,
  keyboardStore.popupHoveredKey,
  hoveredLinkHref.value,
  searchMatchKeys, // ← 10th arg; empty array when search is closed
)
```

Inside `CanvasRenderer.render()`, a `Set` is built from `searchMatchKeys` for O(1) lookup, then the non-selected keys are partitioned in a single pass:

```typescript
const searchMatchSet = new Set(searchMatchKeys)

const regularKeys: Key[] = []
const matchKeys: Key[] = []
for (const key of sortedNonSelectedKeys) {
  if (searchMatchSet.has(key)) matchKeys.push(key)
  else regularKeys.push(key)
}

regularKeys.forEach((key) => this.drawKey(key, false, false, hoveredLinkHref, false))
matchKeys.forEach((key) => this.drawKey(key, false, false, hoveredLinkHref, true))
```

The two-layer draw order ensures the amber border of a search match is never painted over by the black border of an adjacent regular key.

**Decal key support**:

Decal keys (`key.decal = true`) normally render with no fill and no border. The search match condition is explicitly included in the decal border guard so that matching decal keys receive the amber outline:

```typescript
// KeyRenderer.ts
if (key.decal && (options.isSelected || options.isHovered || options.isSearchMatch)) {
  const decalBorderColor = options.isHovered
    ? KeyRenderer.HOVER_COLOR
    : options.isSelected
      ? KeyRenderer.SELECTION_COLOR
      : KeyRenderer.SEARCH_MATCH_COLOR
  // ... draw outline
}
```

---

## Parsers

### LabelParser

**Location**: `src/utils/parsers/LabelParser.ts`

**Purpose**: Parse HTML-formatted labels into an Abstract Syntax Tree (AST) of renderable nodes

The LabelParser uses DOMParser for robust HTML parsing instead of regex, providing better handling of nested elements and malformed HTML.

**Supported HTML**:

```html
<b>Bold text</b>
<strong>Also bold</strong>
<i>Italic text</i>
<em>Also italic</em>
<b><i>Bold and italic</i></b>
<a href="https://example.com">Clickable link</a>
Text<br />with<br />breaks
<img src="icon.png" width="16" height="16" />
<svg width="24" height="24">...</svg>
<ul>
  <li>Unordered item</li>
</ul>
<ol>
  <li>Ordered item</li>
</ol>
```

**Parsing Architecture**:

```typescript
class LabelParser {
  // Main entry point - uses ParseCache for performance
  public parse(text: string): LabelNode[] {
    return parseCache.getParsed(text, (t) => this.doParse(t))
  }

  // Internal parser using DOMParser (called only on cache miss)
  private doParse(text: string): LabelNode[] {
    const parser = new DOMParser()
    const doc = parser.parseFromString(`<div>${text}</div>`, 'text/html')
    return this.parseChildNodes(doc.body.firstChild, {})
  }

  // Recursively parse DOM nodes into LabelNode[]
  private parseNode(node: Node, style: TextStyle): LabelNode[] {
    if (node is text):
      return [{ type: 'text', text: node.textContent, style }]

    if (node is element):
      switch (tag):
        case 'br':
          return [{ type: 'text', text: '\n', style }]
        case 'b', 'strong':
          return parseChildNodes(node, { ...style, bold: true })
        case 'i', 'em':
          return parseChildNodes(node, { ...style, italic: true })
        case 'a':
          return [{ type: 'link', href, text, style }]
        case 'img':
          return [{ type: 'image', src, width, height }]
        case 'svg':
          return [{ type: 'svg', content, width, height }]
        case 'ul', 'ol':
          return parseList(node, style, tag === 'ol')
        default:
          return parseChildNodes(node, style)  // Handle div, span, etc.
  }

  // Parse list elements
  private parseList(element, style, ordered): LabelNode[] {
    const items = []
    for (child of element.children):
      if (child.tagName === 'li'):
        items.push(parseListItem(child, style))
    return [{ type: 'list', ordered, items }]
  }

  // Parse list item - filters out images/SVGs (text-only content)
  private parseListItem(element, style): ListItemNode {
    const children = parseChildNodes(element, style)
    // Filter out images/SVGs - lists are text-only
    const filtered = children.filter(c => c.type !== 'image' && c.type !== 'svg')
    return { type: 'list-item', children: filtered }
  }
}
```

**Key Methods**:

- **`parse(text)`**: Main entry point. Uses ParseCache for performance.
- **`hasHtmlFormatting(text)`**: Check if text contains HTML elements.
- **`measureHtmlText(text, ctx, ...)`**: Measure width of formatted text.
- **`getPlainText(nodes)`**: Extract plain text from parsed nodes.

### LabelAST

**Location**: `src/utils/parsers/LabelAST.ts`

**Purpose**: Define the AST type structure for parsed HTML labels

The LabelAST module provides TypeScript type definitions and type guards for the AST nodes produced by LabelParser.

**Node Types**:

```typescript
/**
 * Text styling options
 */
interface TextStyle {
  bold?: boolean
  italic?: boolean
}

/**
 * Plain text node with optional styling
 */
interface TextNode {
  type: 'text'
  text: string
  style: TextStyle
}

/**
 * Hyperlink node
 */
interface LinkNode {
  type: 'link'
  href: string
  text: string
  style: TextStyle
}

/**
 * External image node
 */
interface ImageNode {
  type: 'image'
  src: string
  width?: number
  height?: number
}

/**
 * Inline SVG node
 */
interface SVGNode {
  type: 'svg'
  content: string
  width?: number
  height?: number
}

/**
 * List item node - contains text content and optional nested lists
 * NOTE: Images/SVGs are NOT supported in list items (text-only content)
 */
interface ListItemNode {
  type: 'list-item'
  children: LabelNode[] // Text content only: text, links, nested lists
}

/**
 * List node - ordered or unordered list container
 */
interface ListNode {
  type: 'list'
  ordered: boolean // true = <ol>, false = <ul>
  items: ListItemNode[]
}

/**
 * Union type of all possible label nodes
 */
type LabelNode = TextNode | LinkNode | ImageNode | SVGNode | ListNode | ListItemNode
```

**Type Guards**:

```typescript
isTextNode(node: LabelNode): node is TextNode
isLinkNode(node: LabelNode): node is LinkNode
isImageNode(node: LabelNode): node is ImageNode
isSVGNode(node: LabelNode): node is SVGNode
isListNode(node: LabelNode): node is ListNode
isInlineNode(node: LabelNode): node is TextNode | LinkNode  // Lists are NOT inline
```

**Helper Functions**:

```typescript
emptyStyle(): TextStyle           // Returns {}
mergeStyles(base, override): TextStyle  // Merges two styles
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

### 2. Render Batching and Deduplication

**RenderScheduler** prevents multiple renders per frame and deduplicates identical callbacks:

```
Frame 1 - During drag operation:
  Mouse move event → schedule(renderKeyboard)
  Keys watcher fires → schedule(renderKeyboard)
  Event listener fires → schedule(renderKeyboard)
  Image loads → schedule(loadCallback)

  RenderScheduler Set state:
    → {renderKeyboard, loadCallback}  // Only 2 unique callbacks!

  requestAnimationFrame:
    → Execute renderKeyboard() once
    → Execute loadCallback() once
    → Total: 2 renders instead of 4

Frame 2:
  (no more work)
```

**Critical Performance Fix**:
Prior to implementing Set-based deduplication, the scheduler accumulated all callbacks without checking for duplicates. During drag operations, this caused severe performance degradation:

```
WITHOUT deduplication:
  10 mousemove events in 16ms
  → 10x schedule(renderKeyboard)
  → Array: [renderKeyboard, renderKeyboard, ..., renderKeyboard]
  → Executes renderKeyboard() 10 times sequentially

WITH deduplication (current):
  10 mousemove events in 16ms
  → 10x schedule(renderKeyboard)
  → Set: {renderKeyboard}  // Only 1 unique callback
  → Executes renderKeyboard() once
```

This fix resolved critical drag lag issues where redundant renders caused performance degradation during mouse operations.

### 3. Pixel Alignment and Rotation Handling

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

**Axis-Aligned Rotation Optimization**:

For rotations at exactly 90°, 180°, or 270°, the system uses a special rendering approach to maintain perfect pixel alignment:

1. **Detect axis-aligned rotations**: Check if rotation angle is within 0.01° of 0°, 90°, 180°, or 270°
2. **Rotate coordinates first**: Apply mathematical rotation to all rectangle coordinates (outer, inner, text)
3. **Then apply pixel alignment**: Align the already-rotated rectangles to pixel boundaries
4. **Skip canvas rotation**: Don't use `ctx.rotate()` for the key shapes (only for labels)

This ensures crisp edges for the most common rotation angles while avoiding the misalignment that would occur if alignment
was applied before rotation (see [#30](https://github.com/adamws/kle-ng/issues/30)).

For non-axis-aligned rotations (45°, 89°, 91°, etc.):

- Skip pixel alignment entirely
- Apply ctx.rotate() transformation
- Result: Smooth antialiased rendering,
  - small visual 'jump' when transitioning angles 89°→90°→91° due to change of render approach,
    user must really pay attention to notice

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
0.1 + 0.2 === 0.30000000000000004 // NOT 0.3!

// For key positions:
key.x = 0.25 // 0.25U position
key.y = 1.5 // 1.5U position
// Accumulated errors can cause misalignment
```

**Solution for Layout**: Use `decimal-math` library in keyboard store

```typescript
import { D } from './decimal-math'

// Precise arithmetic for layout:
D.add(0.1, 0.2) === 0.3 // ✓

// Key position calculation:
const x = D.mul(key.x, unit) // Precise for layout
const y = D.mul(key.y, unit)
```

**Optimization for Rendering**: Use native Math in renderers

```typescript
// In KeyRenderer, LabelRenderer, RotationRenderer:
// Native Math operations (post Phase 1 optimization)
const angle = (key.rotation_angle * Math.PI) / 180 // Fast!
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
const keyX = D.mul(key.x, unit) // Exact arithmetic

// Rendering: Native Math performance
const angle = (key.rotation_angle * Math.PI) / 180 // Fast conversion
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
   - canvas.width = layoutWidth _ unit _ scale
   - canvas.height = layoutHeight _ unit _ scale

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
ctx.translate(originX, originY) // 1. Move origin to rotation point
ctx.rotate(angleRadians) // 2. Rotate around origin
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

const angle = -key.rotation_angle // Negate for inverse
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

Lab is **perceptually uniform**: Equal changes in L\* produce equal perceived lightness changes.

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
canvas.width = layoutWidth * unit // No scaling!
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

**5. Slow rendering or drag lag**

**Cause**: Too many re-renders, large layouts, or render scheduler issues

**Solution**:

- Verify `RenderScheduler` is using Set-based deduplication (not array)
- Check that identical callbacks are being deduplicated
- Monitor render frequency (should be ≤ 60 FPS)
- Profile with Chrome DevTools Performance tab

```typescript
// Monitor render calls and check for deduplication:
let renderCount = 0
const original = canvasRenderer.render
canvasRenderer.render = function (...args) {
  renderCount++
  console.log(`Render #${renderCount}`)
  return original.apply(this, args)
}

// Check scheduler deduplication:
const callback = () => console.log('render')
renderScheduler.schedule(callback)
renderScheduler.schedule(callback)
renderScheduler.schedule(callback)
console.log('Pending count:', renderScheduler.getPendingCount())
// Should show: 1 (if deduplication works correctly)
```

**Known Issue (Fixed)**:
Prior to commit `595127f`, the RenderScheduler used an array to store callbacks, causing severe performance issues during drag operations. The same render callback would execute 10-30+ times per frame, causing drag lag. This has been fixed by switching to Set-based storage for automatic deduplication.

---

---

## Alternative Layouts Preview

<a name="alt-layouts-overview"></a>

### Overview

VIA-annotated keyboards often contain alternative-layout keys — keys that exist in multiple physical variants for the same logical position (for example, a split spacebar, or ISO vs ANSI Enter). The VIA spec encodes this via `labels[8]`, which is set to the string `"option,choice"` for every key that belongs to an option group.

The Alternative Layouts Preview feature lets users select a specific combination of layout variants and see immediately how the assembled keyboard looks. The canvas switches to a read-only preview that renders only the keys relevant to the chosen choices; all editing interactions are suppressed until the user returns to "all" mode.

---

<a name="alt-layouts-architecture"></a>

### Architecture

The data flow is:

```
LayoutOptionToolbar.vue
    │  calls keyboardStore.setDisplayLayoutChoices(map)
    ▼
keyboard.ts store
    │  displayLayoutChoices ref updated
    │  setDisplayLayoutChoices() clears selection, resets canvasMode
    ▼
KeyboardCanvas.vue
    │  keysForRender computed: collapseToLayoutChoices(keys, choices)
    │  dedicated watch on displayLayoutChoices → schedules re-render
    ▼
CanvasRenderer.render(keysForRender, ...)
    (renderer signature unchanged)
```

Two key design decisions shape the implementation:

1. **Toolbar placement inside the canvas container element, not in `App.vue`**. `LayoutOptionToolbar` is mounted as a sibling of the `<canvas>` element inside `KeyboardCanvas.vue`'s container div. It receives `@mousedown.stop @click.stop` to prevent the canvas focus-management handlers (`handleContainerMouseDown`, `handleContainerClick`) from firing, which keeps it accessible without disturbing canvas focus.

2. **No changes to the `CanvasRenderer.render()` signature**. The filtering of keys for the preview is done entirely at the call site in `KeyboardCanvas.vue` via the `keysForRender` computed. The renderer always receives a plain key array and knows nothing about layout preview mode.

---

<a name="layout-optionsts"></a>

### `layout-options.ts`

**Location**: `src/utils/layout-options.ts`

**Purpose**: Pure utilities for discovering and collapsing alternative layout groups from a key array.

#### `LayoutOptionGroup` interface

```typescript
interface LayoutOptionGroup {
  option: number // VIA option index (the second number in "option,choice")
  choices: number[] // All choice indices present in the key array, always includes 0
  groupLabel?: string // From VIA layouts.labels — human-readable group name
  choiceLabels?: string[] // From VIA layouts.labels — per-choice human-readable names
}
```

#### `getLayoutOptionGroups(keys, viaLabels?)`

Scans the key array for keys whose `labels[8]` matches the `"option,choice"` format (delegating to `parseOptionChoice` from `matrix-validation.ts`). Groups the results by option index and sorts them. Ghost and decal keys are skipped.

The optional `viaLabels` argument is the raw `layouts.labels` value from a VIA definition. It is typed as `unknown` and parsed defensively — malformed or absent input silently degrades to groups without label metadata.

VIA `layouts.labels` supports two entry shapes:

- A plain string `"Name"` → `groupLabel` only
- An array `["Name", "Choice A", "Choice B"]` → `groupLabel` + `choiceLabels`

v1 constraint: only `labels[8]` is used as the option/choice discriminator. Keys that store option/choice at other label indices are not detected.

#### `collapseToLayoutChoices(keys, choices: Map<number, number>)`

Returns a new key array representing the keyboard as it looks with the given choice selected for each option group. The function:

1. Deep-clones the input via `JSON.parse(JSON.stringify(keys))` — the source array is never mutated.
2. Collects all keys that have no `option,choice` annotation (always included).
3. For each option group in `choices`: selects the target choice (falls back to choice 0 if the requested index is absent).
4. For non-zero choices, translates the chosen keys to overlay the choice-0 anchor:
   - `anchor` = `minXY` of choice-0 keys
   - `groupAnchor` = `minXY` of chosen-choice keys
   - applies `(anchor − groupAnchor)` as a `(dx, dy)` offset to each chosen key
5. Deduplicates the result by `(labels[0], rotated-center-x, rotated-center-y, decal)`.

The `Map<number, number>` approach allows all option groups to be resolved in a single call, matching the multi-group selection the toolbar exposes.

Ghost and decal keys are excluded from the alternative-variant set, matching the behaviour of kbplacer's `MatrixAnnotatedKeyboard.collapse()` from which this algorithm is ported.

---

<a name="store-state"></a>

### Store State

Three additions to `src/stores/keyboard.ts`:

```typescript
// Non-null while previewing; null = "all" / normal edit mode
const displayLayoutChoices = ref<Map<number, number> | null>(null)

// Convenience computed used as the preview-mode guard
const isLayoutPreviewMode = computed(() => displayLayoutChoices.value !== null)

// Setter — entering preview clears selection and resets canvasMode
const setDisplayLayoutChoices = (choices: Map<number, number> | null) => {
  displayLayoutChoices.value = choices
  if (choices !== null) {
    selectedKeys.value = []
    tempSelectedKeys.value = []
    canvasMode.value = 'select'
  }
}
```

**Invalidation watcher**: A `watch(keys, { deep: true })` runs whenever the key list changes while preview is active. It re-evaluates each chosen `(option, choice)` pair against the current groups:

- If the chosen choice index no longer exists in a group, that group falls back to choice 0.
- If an option group disappears entirely, it is dropped from the map.
- If the resulting map is empty, `displayLayoutChoices` resets to `null` (exits preview).
- The map is only written back if something actually changed, avoiding unnecessary re-renders.

All three (`displayLayoutChoices`, `isLayoutPreviewMode`, `setDisplayLayoutChoices`) are exported from the store.

---

<a name="layoutoptiontoolbarvue"></a>

### `LayoutOptionToolbar.vue`

**Location**: `src/components/LayoutOptionToolbar.vue`

**Visibility gate**: The toolbar element renders only when `groups.length > 0`. It is not gated on `isViaAnnotated`; a VIA-annotated layout with no `option,choice` keys correctly shows nothing.

**UI structure**:

- One **"all" bubble button** — always visible when the toolbar is shown; active (filled) when `displayLayoutChoices === null`. Clicking it calls `setDisplayLayoutChoices(null)` to exit preview.
- Per group: one circular bubble button per choice index (including 0), labelled as a diagonal fraction `choice ⁄ option` (e.g. `0⁄0`, `1⁄0`). The `:title` tooltip uses `resolveChoiceTitle`.
- When in preview mode: an inline `preview-hint` span reads "Layout preview mode (readonly) — switch to **all** to edit".

**`resolveChoiceTitle(group, choice)` priority**:

1. `group.choiceLabels[choice]` if present
2. Otherwise: `"${group.groupLabel ?? 'Option N'} · Choice M"`

**Click behaviour**:

- If not currently in preview (`displayLayoutChoices === null`): initialises all groups to choice 0, sets the clicked choice, then calls `setDisplayLayoutChoices`.
- If already in preview: copies the current map, updates the clicked group's choice, calls `setDisplayLayoutChoices` with the updated map.

VIA labels are accessed by decompressing `_kleng_via_data` from keyboard metadata using LZString directly in the component's `viaLabels` computed — no shared `extractViaMetadata` helper is called.

---

<a name="canvas-wiring"></a>

### Canvas Wiring

**`keysForRender` computed** (`src/components/KeyboardCanvas.vue`):

```typescript
const keysForRender = computed(() =>
  keyboardStore.displayLayoutChoices
    ? collapseToLayoutChoices(keyboardStore.keys, keyboardStore.displayLayoutChoices)
    : keyboardStore.keys,
)
```

This computed is passed as the first argument to `renderer.value.render(...)` in place of `keyboardStore.keys`.

**Dedicated re-render watch**:

```typescript
watch(
  () => keyboardStore.displayLayoutChoices,
  () => {
    renderScheduler.schedule(renderKeyboard)
  },
)
```

This watch triggers a re-render whenever the preview mode changes or the choice map is updated. It is separate from the `keys-modified` event listener so that entering/exiting preview always produces a fresh frame even when no key data changed.

**Interaction guards**: Every mutating handler returns early when `isLayoutPreviewMode` is true:

- `handleContainerClick`, `handleContainerMouseDown` — canvas focus management still runs (pan/zoom continue to work); key selection is blocked.
- `handleCanvasClick`, `handleMouseDown`, `handleMouseUpShared`, `handleMouseMoveShared` (mutation branches) — drag, selection, and key-move are all suppressed.
- `handleKeyDown` mutation paths — keyboard shortcuts that modify the layout (delete, duplicate, arrow-move, etc.) are suppressed.
- `handleDrop` — file/section drops are ignored.

**What remains enabled in preview mode**:

- Pan and zoom (trackpad/scroll wheel, grab-drag).
- Canvas text search (`/` shortcut). The search composable's `setKeys` watcher receives `keysForRender` so searches operate against the collapsed key set.
- Link hover and click in key labels.
- `MatrixAnnotationOverlay` remains visible; its draw gestures are gated separately.

---

<a name="read-only-gating"></a>

### Read-Only Gating

The following components check `isLayoutPreviewMode` and disable themselves accordingly:

- **`KeyPropertiesPanel.vue`**: The `isDisabled` computed includes `|| keyboardStore.isLayoutPreviewMode`. All form fields and the wrapping `<fieldset>` are disabled, giving the standard browser dimming treatment.
- **`KeyboardToolbar.vue`**: The Presets and Import buttons receive `:disabled="keyboardStore.isLayoutPreviewMode"` directly.
- **`CanvasToolbar.vue`**: Extra tool buttons and add-key / add-special-key actions are gated with the same flag.
- **`MatrixAnnotationOverlay.vue`**: Draw gestures (mousedown, mousemove handlers that modify annotation state) return early when preview is active; the overlay itself stays rendered.

---

## Recent Improvements

### Canvas Text Search (Commit 8512b55)

Added key-label search with amber highlighting, prev/next navigation, and a magnifier trigger button.

**New files**:

- `src/composables/useKeySearch.ts` — composable owning all transient search state
- `src/components/CanvasSearchBar.vue` — self-contained search UI (input, count, nav buttons, close)

**Modified files**:

- `src/utils/renderers/KeyRenderer.ts` — added `isSearchMatch` to `KeyRenderOptions`, `SEARCH_MATCH_COLOR` constant (`#f59e0b`), decal border fix
- `src/utils/canvas-renderer.ts` — added `searchMatchKeys` 10th parameter to `render()`, single-pass partition for four-layer draw order
- `src/components/KeyboardCanvas.vue` — shortcut handler, magnifier button, `useKeySearch` wiring

**Key design decisions**:

1. **Four-pass render order** — regular non-selected → search matches → selected → popup-hovered. This ensures amber borders are never occluded by neighbouring regular-key borders.

2. **Composable (not store)** — search state is transient UI state with no persistence requirement. `useKeySearch()` creates local, non-shared state per canvas instance.

3. **Pure computed for `matchingKeys`** — index clamping is a side effect moved to `watch(matchingKeys)` to avoid a Vue 3 circular reactive dependency bug.

4. **`v-if` on the component element** — `CanvasSearchBar` is mounted/unmounted (not hidden) so `onMounted` fires at the right time for auto-focus. `setTimeout(0)` (macrotask) is required because `nextTick` fires too early during the keyboard event path.

5. **`@mousedown.stop @click.stop` on search bar** — prevents the canvas container's focus-management handlers from stealing focus back to the canvas while the search bar is active.

6. **`labelParser.getPlainText()`** — search strips HTML formatting from labels so queries like "shift" match `<b>Shift</b>`.

---

### Link Support and Label Parser Refactoring (Commit ca665d9)

**1. Major LabelParser Refactoring**

**Problem**: The original LabelParser used regex-based parsing which was fragile with nested tags and couldn't easily support new element types like links.

**Solution**: Complete rewrite using DOMParser for proper HTML parsing:

```typescript
// Before (regex-based):
const regex = /<\s*(\/?)([bi])\s*>|<img\s+([^>]+)>|<svg[^>]*>[\s\S]*?<\/svg>|([^<]+)/gi
// Fragile, hard to extend, limited nesting support

// After (DOMParser-based):
const parser = new DOMParser()
const doc = parser.parseFromString(`<div>${text}</div>`, 'text/html')
// Robust, extensible, proper HTML handling
```

**Benefits**:

- More robust handling of malformed HTML
- Proper support for nested tags
- Easy to add new element types
- Standard DOM traversal instead of regex

**2. New LabelAST Module**

Created `src/utils/parsers/LabelAST.ts` to define the AST structure:

- `TextNode` - Plain text with optional bold/italic styling
- `LinkNode` - Clickable links with href and styling
- `ImageNode` - External images with optional dimensions
- `SVGNode` - Inline SVG content with dimensions
- Type guards for type-safe node handling

**3. Clickable Link Support**

Added full support for `<a href="...">` tags in key labels:

- **Visual styling**: Links render in blue (#0066cc)
- **Hover underline**: Underline appears when hovering over link
- **URL preview**: Shows URL at bottom of canvas when hovering
- **Click handling**: Opens link in new tab with security validation
- **Rotation support**: Links work correctly on rotated keys

**4. New LinkTracker Component**

Created `src/utils/renderers/LinkTracker.ts` for link hit testing:

- Registers link bounding boxes during rendering
- Provides `getLinkAtPosition(x, y)` for hover/click detection
- Handles rotated keys via inverse rotation transformation
- Singleton pattern for global access

**5. Updated Components**

- **LabelRenderer**: New `renderLinkNode()` method, `hoveredLinkHref` parameter
- **CanvasRenderer**: New `getLinkAtPosition()` method, clears linkTracker per render
- **ParseCache**: Now stores `LabelNode[]` instead of old `ParsedSegment[]`
- **KeyboardCanvas.vue**: Link hover detection, click handling, URL preview

**New Supported Tags**:

- `<strong>` - Bold text (alias for `<b>`)
- `<em>` - Italic text (alias for `<i>`)
- `<a href="...">` - Clickable links

### Performance Optimizations (Commits 595127f, ffab9a0)

**1. RenderScheduler Deduplication (Commit 595127f)**

**Problem**: The original RenderScheduler implementation used an array to store callbacks, allowing duplicate callbacks to accumulate. During drag operations with multiple event sources (mouse handlers, Vue watchers, event listeners), the same `renderKeyboard()` function would be scheduled 10-30+ times per frame, causing severe lag (60fps → ~10fps).

**Solution**: Changed storage from array to Set:

```typescript
// Before:
private callbacks: (() => void)[] = []
this.callbacks.push(callback)  // Allows duplicates

// After:
private callbacks = new Set<() => void>()
this.callbacks.add(callback)  // Automatic deduplication
```

**Impact**: Eliminated 300-600% performance degradation during drag operations. The same callback now executes exactly once per animation frame regardless of how many times it's scheduled.

**Testing**: Added comprehensive test suite in `RenderScheduler.spec.ts` to verify deduplication behavior in real-world drag scenarios.

**2. Layout Change Event System (Commit ffab9a0)**

**Problem**: The system used an "aggressive watcher" that created new arrays on every Vue reactivity check to monitor key positions for layout changes. This watcher performed deep comparisons and fired redundantly with other watchers, contributing to performance issues.

**Solution**: Replaced Vue watcher with event-driven architecture:

- Keyboard store dispatches `keys-modified` custom event whenever the layout is modified (position, color, labels, rotation, etc.)
- Canvas component listens for event and responds by updating canvas size and scheduling render
- Direct `updateCanvasSize()` call during drag operations for immediate feedback when keys are dragged beyond bounds

**Benefits**:

- Decoupled store and canvas component
- Eliminated expensive deep watcher on key position arrays
- Clearer communication intent through explicit events
- Better performance during all layout modifications
- Comprehensive coverage of all layout changes (position, color, labels, rotation, etc.)

**Removed Code** (aggressive watcher):

```typescript
// This 21-line watcher was removed:
watch(
  () => keyboardStore.keys.map((key) => ({/* position data */})),
  async () => {
    await nextTick()
    updateCanvasSize()
    renderScheduler.schedule(renderKeyboard)
  },
  { deep: true },
)
```

**Added Code** (event-based system):

```typescript
// Store dispatches event (3 locations: saveState, undo, redo):
window.dispatchEvent(new CustomEvent('keys-modified'))

// Canvas listens for event:
const handleKeysModified = () => {
  updateCanvasSize()
  renderScheduler.schedule(renderKeyboard)
}
window.addEventListener('keys-modified', handleKeysModified)
```

### Bug Analysis Documentation (Commit 273494b)

Added comprehensive code review documentation analyzing the RenderScheduler bug that caused drag lag. The analysis provided:

- Root cause identification (lack of deduplication)
- Performance impact measurements (300-600% degradation)
- Evidence from code showing multiple render sources
- Two recommended fix options (single slot vs Set)
- Testing checklist

This documentation guided the implementation of the deduplication fix in commit 595127f.

**Location**: `/dev/active/renderer-drag-lag-investigation/renderer-drag-lag-investigation-code-review.md`

---

### Alternative Layouts Preview (Commits 8ab28f2, 62e4d6d)

Added a read-only layout preview mode for VIA-annotated keyboards that contain `option,choice` keys (`labels[8]`), along with end-to-end tests.

**New files**:

- `src/utils/layout-options.ts` — `getLayoutOptionGroups` and `collapseToLayoutChoices` pure utilities; TypeScript port of kbplacer's `MatrixAnnotatedKeyboard.collapse()`
- `src/components/LayoutOptionToolbar.vue` — bubble-button toolbar that appears below the canvas when alt-layout groups are detected; mounted inside `KeyboardCanvas.vue`'s container with `@mousedown.stop @click.stop`

**Modified files**:

- `src/stores/keyboard.ts` — `displayLayoutChoices` ref, `isLayoutPreviewMode` computed, `setDisplayLayoutChoices` action, invalidation watcher
- `src/components/KeyboardCanvas.vue` — `keysForRender` computed, dedicated `watch(displayLayoutChoices)` for re-render, `isLayoutPreviewMode` early-return guards in all mutating handlers
- `src/components/KeyPropertiesPanel.vue` — `isDisabled` extended to include `isLayoutPreviewMode`
- `src/components/KeyboardToolbar.vue`, `src/components/CanvasToolbar.vue` — Presets, Import, and add-key actions disabled in preview mode
- `src/components/MatrixAnnotationOverlay.vue` — draw gestures gated; overlay remains visible

**Key design decisions**:

1. **Renderer signature unchanged** — key filtering for preview is done entirely in the `keysForRender` computed in `KeyboardCanvas.vue`. `CanvasRenderer.render()` receives a plain key array and has no awareness of preview mode.

2. **Focus trap compatibility** — `LayoutOptionToolbar` mounts inside the canvas container and uses `@mousedown.stop @click.stop` to opt out of the container's focus-management handlers, mirroring the pattern used by `CanvasSearchBar`.

3. **Multi-group `Map` approach** — `collapseToLayoutChoices` accepts `Map<number, number>` so all option groups are resolved in one call, and clicking any bubble in the toolbar updates only the affected group while preserving other groups' choices.

4. **Invalidation watcher in the store** — when the key array changes while preview is active, invalid choices fall back to 0 and gone option groups are dropped. If nothing remains, the store exits preview automatically, preventing stale display state after edits.

---

### Dependencies

- **@adamws/kle-serial**: Keyboard layout data structures
- **polygon-clipping**: Vector union for non-rectangular keys
- **decimal-math**: Precise arithmetic for coordinates
