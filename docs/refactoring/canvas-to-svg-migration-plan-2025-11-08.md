# Canvas to SVG Migration - Refactoring Plan

**Date:** 2025-11-08
**Author:** Senior Software Architect
**Status:** Draft for Review
**Project:** kle-ng (Keyboard Layout Editor NG)

---

## Executive Summary

This document outlines a comprehensive plan for migrating kle-ng's rendering pipeline from HTML5 Canvas to SVG-based rendering. The analysis reveals a well-architected, modular canvas implementation on the `develop` branch with clear separation of concerns. However, the investigation concludes that **migration to SVG is not recommended** due to significant technical challenges, performance concerns, and limited benefits.

### Key Findings

**Current State:**
- Mature, well-architected canvas rendering pipeline with excellent modularity
- Specialized renderer classes (KeyRenderer, LabelRenderer, RotationRenderer)
- Sophisticated caching system (SVGCache, ImageCache, ParseCache)
- Support for complex features: rotation, non-rectangular keys, HTML labels, image labels
- Already uses SVG for overlay annotations (MatrixAnnotationOverlay.vue)

**Migration Assessment:**
- **Complexity:** HIGH - Would require complete rewrite of rendering logic
- **Risk:** HIGH - Text rendering, image handling, and coordinate transformations are problematic in SVG
- **Performance:** NEGATIVE - SVG would likely be slower for complex layouts with many keys
- **Benefits:** MINIMAL - No significant advantages for this use case

### Recommendation

**DO NOT MIGRATE** to SVG-based rendering. Instead, consider:

1. **Hybrid Approach** (Recommended): Keep canvas for primary rendering, expand SVG usage for specific features
2. **Canvas Optimization**: Further optimize the existing canvas implementation
3. **Export Enhancement**: Add SVG export capability while keeping canvas rendering

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Identified Issues and Opportunities](#identified-issues-and-opportunities)
3. [SVG Migration Analysis](#svg-migration-analysis)
4. [Alternative Approaches](#alternative-approaches)
5. [Proposed Action Plan](#proposed-action-plan)
6. [Risk Assessment](#risk-assessment)
7. [Appendix: Technical Details](#appendix-technical-details)

---

## Current State Analysis

### Architecture Overview

The current rendering pipeline is exceptionally well-designed with clear separation of concerns:

```
App.vue
  └── KeyboardCanvas.vue (Container + Event Handling)
      ├── <canvas> (Canvas rendering via CanvasRenderer)
      ├── MatrixAnnotationOverlay.vue (SVG overlay - already SVG!)
      └── DebugOverlay.vue (Development only)
```

### Core Components

#### 1. CanvasRenderer (`src/utils/canvas-renderer.ts`)
**Lines of Code:** ~400
**Responsibilities:**
- Orchestrates all rendering operations
- Manages render options (unit size, background color, font family)
- Coordinates specialized renderers
- Handles caching system integration
- Provides bounds calculation and hit testing

**Key Methods:**
- `render()` - Main rendering orchestrator
- `calculateBounds()` - Layout bounds calculation
- `getKeyAtPosition()` - Hit testing for mouse interactions
- `updateOptions()` - Runtime configuration updates

**Strengths:**
- Clean dependency injection pattern (context passed as parameter)
- Well-defined interface for options and parameters
- Excellent separation from Vue component layer

#### 2. KeyRenderer (`src/utils/renderers/KeyRenderer.ts`)
**Lines of Code:** ~940
**Responsibilities:**
- Renders all key shapes (rectangular, non-rectangular, circular)
- Handles rotation transformations
- Manages selection highlighting
- Draws homing nubs (F/J keys)
- Pixel-perfect alignment for crisp edges

**Key Features:**
- **Vector Union Algorithm**: Uses `polygon-clipping` library to create perfect non-rectangular keys (ISO Enter, BAE)
- **Pixel Alignment**: Custom logic for crisp 1px strokes
- **Lab Color Space**: Perceptual color lightening for keycap bevels
- **Circular Keys**: Special rendering for rotary encoders

**Strengths:**
- Sophisticated geometry handling with vector operations
- Excellent code organization with clear methods
- Comprehensive support for all key types

#### 3. LabelRenderer (`src/utils/renderers/LabelRenderer.ts`)
**Responsibilities:**
- Renders text labels with HTML formatting (bold, italic, mixed)
- Handles 12 label positions (3×3 grid + 3 front legends)
- Manages image and SVG labels
- Text wrapping and overflow handling
- Multi-line text with line breaks
- Font size calculation

**Key Features:**
- HTML parsing with bold/italic support via `<b>` and `<i>` tags
- Image loading via `<img>` tags (PNG, SVG)
- Inline SVG support via `<svg>` tags
- Smart positioning with fixed margins
- Integration with caching system

**Strengths:**
- Rich text rendering capabilities
- Clean separation of parsing and rendering
- Excellent alignment logic

#### 4. Caching System

**SVGCache** (`src/utils/caches/SVGCache.ts`):
- Caches SVG → data URL conversions
- LRU eviction (max 1000 entries)
- Prevents redundant `encodeURIComponent()` calls

**ImageCache** (`src/utils/caches/ImageCache.ts`):
- Manages image loading states (loading/loaded/error)
- Caches loaded `HTMLImageElement` objects
- Handles CORS with `crossOrigin: 'anonymous'`
- Async loading with callbacks
- LRU eviction (max 1000 entries)

**ParseCache** (referenced):
- Caches HTML label parsing results
- Avoids redundant regex operations

**Strengths:**
- Comprehensive caching strategy
- Performance-oriented design
- Clean separation of concerns

#### 5. Utility Classes

**BoundsCalculator** (`src/utils/utils/BoundsCalculator.ts`):
- Calculates bounding boxes for layout sizing
- Rotation support via transformation matrices
- Handles non-rectangular keys
- Stroke width accounting

**HitTester** (`src/utils/utils/HitTester.ts`):
- Determines which key is clicked
- Rotation support via inverse transformation
- Z-order handling (last key on top)
- Non-rectangular key support

**RenderScheduler** (`src/utils/utils/RenderScheduler.ts`):
- Batches render operations using `requestAnimationFrame`
- Prevents multiple renders per frame
- Error handling for callbacks
- Performance optimization

**Strengths:**
- Single Responsibility Principle applied consistently
- Testable, reusable utilities
- Clear API boundaries

### Rendering Flow

```
1. User Action / State Change
   ↓
2. Vue Watcher Triggered
   ↓
3. renderScheduler.schedule(renderKeyboard)
   ↓
4. Next Animation Frame:
   ↓
5. renderKeyboard() in KeyboardCanvas.vue:
   a. Clear canvas
   b. Draw background (with border radius)
   c. Apply transformations (DPI, zoom, coordinate offset)
   d. Render non-selected keys (bottom layer)
   e. Render selected keys (top layer with red border)
   f. Draw rotation origin indicators
   g. Draw rotation control points (if rotate mode)
   h. Draw selection rectangle (if selecting)
   i. Draw mirror axis (if mirror mode)
```

### Performance Characteristics

**Current Canvas Performance:**
- ✅ Excellent for complex layouts (50-100+ keys)
- ✅ Hardware-accelerated rendering
- ✅ Efficient batched rendering via `requestAnimationFrame`
- ✅ Minimal reflow/repaint in browser
- ✅ Caching reduces redundant operations
- ✅ Pixel-perfect rendering at any DPI

**Measured Optimizations:**
- Render scheduling prevents excessive redraws
- Image/SVG caching eliminates network/parsing overhead
- Label parsing cache reduces regex operations
- Single-pass rendering minimizes context operations

---

## Identified Issues and Opportunities

### Strengths of Current Implementation

1. ✅ **Excellent Architecture**
   - Modular design with clear separation of concerns
   - Singleton pattern for renderers
   - Dependency injection for context
   - No tight coupling to Vue components

2. ✅ **Feature Complete**
   - Comprehensive key rendering (rectangular, non-rectangular, circular)
   - Rich text formatting with HTML tags
   - Image and inline SVG support
   - Rotation with proper transformations
   - Selection, ghosting, decal keys
   - Homing nubs

3. ✅ **Performance Optimized**
   - Multi-layer caching system
   - Render batching via `requestAnimationFrame`
   - Pixel alignment for crisp rendering
   - Efficient bounds calculation

4. ✅ **High DPI Support**
   - Automatic device pixel ratio detection
   - DPI change listeners
   - Proper scaling for retina displays

5. ✅ **Well Documented**
   - Comprehensive canvas rendering pipeline documentation (`docs/canvas-rendering-pipeline.md`)
   - Clear JSDoc comments
   - Examples and usage patterns

### Limitations of Current Implementation

1. ⚠️ **Canvas-Specific Limitations**
   - No native DOM events on individual keys (using manual hit testing)
   - Cannot inspect rendered elements via browser DevTools
   - Text selection not possible on rendered labels
   - No accessibility tree for screen readers
   - Cannot copy rendered text

2. ⚠️ **Export Limitations**
   - PNG export only (no vector format)
   - Cannot generate SVG for external use
   - No print-friendly output

3. ⚠️ **Styling Constraints**
   - CSS cannot be applied to canvas rendering
   - Limited to programmatic styling only
   - No browser font rendering features (hinting, kerning as good as SVG)

### Issues That Would NOT Be Solved by SVG

1. ❌ **Accessibility**
   - While SVG has better accessibility potential, keyboard layout rendering doesn't benefit much
   - Keys are visual representations, not interactive UI elements
   - Screen reader users need keyboard navigation, not key visualization

2. ❌ **Text Selection**
   - Unlikely to be useful in keyboard layout context
   - Labels are identifiers, not prose content

3. ❌ **DevTools Inspection**
   - Not valuable for production use
   - Development overlay already exists (DebugOverlay.vue)

### Issues That SVG Would Create

1. ❌ **Performance Degradation**
   - SVG DOM manipulation slower than canvas for many elements
   - Layout recalculation overhead on every change
   - Memory overhead from DOM nodes (50+ keys = 50+ complex SVG groups)
   - Rotation transformations less performant

2. ❌ **Text Rendering Complexity**
   - HTML formatted text (bold, italic) difficult in SVG
   - Text wrapping not native in SVG (requires manual calculation)
   - Multi-line text positioning complex
   - Font loading and fallback more complex
   - Baseline alignment differs from canvas

3. ❌ **Image Handling Complexity**
   - `<image>` tags require data URLs or external URLs
   - Inline SVG within SVG requires namespace handling
   - CORS issues similar to canvas
   - No native caching mechanism

4. ❌ **Transformation Complexity**
   - Nested transformations (rotation + zoom + pan) harder to manage
   - Coordinate space conversions more complex
   - Hit testing on transformed elements less straightforward

5. ❌ **Browser Compatibility**
   - SVG text rendering inconsistencies across browsers
   - Subtle differences in path rendering
   - Transform origin differences

---

## SVG Migration Analysis

### What Would Need to Change

#### Phase 1: Core Rendering Engine

**Affected Files:**
- `src/utils/canvas-renderer.ts` → `src/utils/svg-renderer.ts` (complete rewrite)
- `src/utils/renderers/KeyRenderer.ts` → `src/utils/renderers/SVGKeyRenderer.ts` (complete rewrite)
- `src/utils/renderers/LabelRenderer.ts` → `src/utils/renderers/SVGLabelRenderer.ts` (complete rewrite)
- `src/components/KeyboardCanvas.vue` → `src/components/KeyboardSVG.vue` (major refactor)

**Estimated Effort:** 120-160 hours

**Key Changes:**
1. Replace `CanvasRenderingContext2D` operations with SVG element creation
2. Convert all drawing commands to SVG paths, rects, circles
3. Rewrite text rendering using `<text>` and `<tspan>` elements
4. Implement SVG group nesting for transformations
5. Handle image embedding with `<image>` elements
6. Implement inline SVG handling with proper namespaces

**Example Transformation:**

**Current (Canvas):**
```typescript
ctx.beginPath()
ctx.moveTo(x + radius, y)
ctx.lineTo(x + width - radius, y)
ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
// ... more path commands
ctx.fill()
ctx.stroke()
```

**SVG Equivalent:**
```typescript
const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
path.setAttribute('d', `
  M ${x + radius} ${y}
  L ${x + width - radius} ${y}
  Q ${x + width} ${y} ${x + width} ${y + radius}
  ...
`)
path.setAttribute('fill', fillColor)
path.setAttribute('stroke', strokeColor)
svgGroup.appendChild(path)
```

**Complexity:** HIGH - Complete paradigm shift from imperative drawing to declarative DOM manipulation

#### Phase 2: Text Rendering

**Major Challenge:** HTML formatted text (bold, italic, mixed) in SVG

**Current Implementation:**
- Canvas supports setting font style per `fillText()` call
- Easy to switch between regular, bold, italic
- Text wrapping implemented with manual line breaking

**SVG Requirements:**
- Use `<text>` elements with nested `<tspan>` for formatted text
- Manual positioning for each span
- Complex baseline calculations
- No native text wrapping (need manual word breaking)

**Example Complexity:**

**Current (Canvas):**
```typescript
ctx.font = 'bold 12px Arial'
ctx.fillText('Bold', x, y)
ctx.font = 'italic 12px Arial'
ctx.fillText('Italic', x + offset, y)
```

**SVG Equivalent:**
```typescript
const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
text.setAttribute('x', x)
text.setAttribute('y', y)
text.setAttribute('font-family', 'Arial')
text.setAttribute('font-size', '12')

const boldSpan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan')
boldSpan.setAttribute('font-weight', 'bold')
boldSpan.textContent = 'Bold'

const italicSpan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan')
italicSpan.setAttribute('dx', offset)
italicSpan.setAttribute('font-style', 'italic')
italicSpan.textContent = 'Italic'

text.appendChild(boldSpan)
text.appendChild(italicSpan)
svgGroup.appendChild(text)
```

**Issues:**
- Baseline alignment differs between browsers
- Font metrics harder to measure (need `getBBox()` which causes reflow)
- Text wrapping requires complex calculations
- Multi-line text needs manual `y` offset calculation

**Estimated Effort:** 40-60 hours

#### Phase 3: Image Handling

**Current Implementation:**
- `ImageCache` loads `HTMLImageElement` objects
- `SVGCache` converts inline SVG to data URLs
- Canvas `drawImage()` for rendering

**SVG Requirements:**
- `<image>` elements with `href` attribute
- Data URLs or external URLs
- Inline SVG requires `<svg>` nested in `<g>` with proper namespace
- CORS handling same as canvas

**Complexity:** MEDIUM - Similar challenges, different API

**Estimated Effort:** 20-30 hours

#### Phase 4: Transformations

**Current Implementation:**
- Canvas transformation matrix (translate, rotate, scale)
- Proper coordinate offset handling
- Zoom and DPI scaling
- Rotation per key with origin points

**SVG Requirements:**
- `transform` attribute on `<g>` elements
- Nested transform groups for hierarchy
- Manual transform composition
- ViewBox for zoom/pan instead of transforms

**Example:**

**Current (Canvas):**
```typescript
ctx.save()
ctx.translate(originX, originY)
ctx.rotate(angle)
ctx.translate(-originX, -originY)
// draw key
ctx.restore()
```

**SVG Equivalent:**
```typescript
const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
group.setAttribute('transform',
  `translate(${originX}, ${originY}) rotate(${angleDeg}) translate(${-originX}, ${-originY})`)
// append key elements to group
parentGroup.appendChild(group)
```

**Complexity:** MEDIUM - Different but manageable

**Estimated Effort:** 20-30 hours

#### Phase 5: Event Handling

**Current Implementation:**
- Manual hit testing with `getKeyAtPosition()`
- Inverse transformations for rotated keys
- Z-order handling

**SVG Potential:**
- Native DOM events on SVG elements (`click`, `mouseenter`, etc.)
- Browser handles hit testing automatically
- Event bubbling from nested elements

**Benefit:** Would simplify event handling code

**Estimated Effort:** 10-20 hours (implementation) + 10 hours (testing edge cases)

#### Phase 6: Caching System

**Current Implementation:**
- `SVGCache` for SVG → data URL conversion
- `ImageCache` for loaded images
- `ParseCache` for HTML label parsing

**SVG Changes:**
- `SVGCache` still needed for inline SVG processing
- `ImageCache` still needed for external images
- `ParseCache` still needed for HTML text parsing
- Potentially need additional "DOM node cache" for reuse

**Complexity:** LOW - Minimal changes needed

**Estimated Effort:** 5-10 hours

#### Phase 7: Integration

**Affected Files:**
- `src/components/KeyboardCanvas.vue` (rename to `KeyboardSVG.vue`, major refactor)
- All components that import/use the canvas renderer
- Export functionality
- Screenshot functionality

**Estimated Effort:** 30-40 hours

**Total Estimated Effort:** 245-350 hours (6-9 weeks for one developer)

### Performance Analysis

#### Canvas Performance Characteristics

**Strengths:**
- ✅ O(1) rendering cost (redraw entire frame regardless of complexity)
- ✅ No DOM manipulation overhead
- ✅ No layout recalculation
- ✅ Hardware accelerated compositing
- ✅ Efficient for animations and frequent updates
- ✅ Consistent performance across browsers

**Weaknesses:**
- ⚠️ Full redraw on any change (mitigated by render scheduling)
- ⚠️ No incremental updates

#### SVG Performance Characteristics

**Strengths:**
- ✅ Incremental updates possible (change only what's needed)
- ✅ Browser caches rendered elements
- ✅ Native event handling (no manual hit testing)

**Weaknesses:**
- ⚠️ O(n) DOM manipulation cost for complex layouts
- ⚠️ Layout recalculation on changes
- ⚠️ Memory overhead from DOM nodes
- ⚠️ Performance degrades with element count
- ⚠️ Transform calculations can be expensive
- ⚠️ Inconsistent performance across browsers

#### Benchmarking Considerations

**For kle-ng Use Case:**
- Typical layouts: 50-150 keys
- Each key: 3-10 SVG elements (outer cap, inner cap, borders, labels)
- Total DOM nodes: 150-1500 elements per layout
- Frequent operations: selection changes, key dragging, rotation
- Less frequent: full layout changes

**Expected Performance:**
- **Canvas:** Consistent 60fps for all operations (current state)
- **SVG:** Likely 30-60fps for dragging operations, possible jank on complex layouts

**Conclusion:** Canvas is likely more performant for this use case

### Browser Compatibility

#### Canvas
- ✅ Excellent cross-browser support
- ✅ Consistent rendering across all modern browsers
- ✅ Minimal edge cases

#### SVG
- ⚠️ Text rendering differences (font hinting, baseline)
- ⚠️ Transform origin handling differences
- ⚠️ Path rendering subtle differences
- ⚠️ Inline SVG namespace handling quirks
- ⚠️ More testing required across browsers

---

## Alternative Approaches

### Option 1: Hybrid Approach (Recommended)

**Keep canvas for primary rendering, use SVG strategically**

**Implementation:**
- Maintain current canvas rendering pipeline
- Expand SVG usage for specific features where it excels
- Already implemented: `MatrixAnnotationOverlay.vue` uses SVG

**Potential Enhancements:**

1. **Add SVG Export Functionality**
   - Generate SVG from current layout data (not from canvas)
   - Separate export renderer using SVG DOM APIs
   - Benefits: Vector output for documentation, print, external tools
   - Effort: 40-60 hours

2. **Use SVG for Additional Overlays**
   - Rotation indicators (currently canvas)
   - Selection rectangle (currently canvas)
   - Mirror axis (currently canvas)
   - Benefits: Easier to style, inspect, debug
   - Effort: 10-20 hours

3. **Interactive SVG Layer for Events**
   - Transparent SVG overlay with clickable areas
   - Benefits: Native DOM events, better debugging
   - Effort: 20-30 hours

**Advantages:**
- ✅ Keeps proven canvas rendering performance
- ✅ Adds vector export capability
- ✅ Improves developer experience for overlays
- ✅ Low risk, incremental improvements
- ✅ Estimated effort: 70-110 hours (2-3 weeks)

**Disadvantages:**
- ⚠️ Maintains two rendering systems
- ⚠️ Complexity of synchronization

**Risk Level:** LOW

### Option 2: Canvas Optimization (Alternative)

**Further optimize existing canvas implementation**

**Potential Improvements:**

1. **Partial Redraw Optimization**
   - Track dirty regions
   - Redraw only changed areas
   - Benefits: Faster selection changes
   - Effort: 20-30 hours

2. **OffscreenCanvas for Background**
   - Pre-render static background
   - Composite with key layer
   - Benefits: Faster redraws
   - Effort: 10-15 hours

3. **WebGL Acceleration**
   - Use WebGL for key rendering
   - GPU-accelerated transforms
   - Benefits: Better performance for large layouts
   - Effort: 80-120 hours (experimental)

4. **Enhanced Caching**
   - Cache rendered key bitmaps
   - Reuse for duplicate keys
   - Benefits: Faster rendering of repeated keys
   - Effort: 15-25 hours

**Advantages:**
- ✅ Improves existing proven architecture
- ✅ Performance gains without paradigm shift
- ✅ Low risk

**Disadvantages:**
- ⚠️ Still no vector export
- ⚠️ Diminishing returns on optimization

**Risk Level:** LOW-MEDIUM

### Option 3: Full SVG Migration (Not Recommended)

**Replace canvas entirely with SVG**

**Advantages:**
- ✅ Vector output by default
- ✅ Native DOM events
- ✅ Better accessibility potential
- ✅ DevTools inspection

**Disadvantages:**
- ❌ Massive development effort (245-350 hours)
- ❌ High risk of bugs and regressions
- ❌ Likely performance degradation
- ❌ Complex text rendering
- ❌ Browser compatibility challenges
- ❌ No significant user-facing benefits

**Risk Level:** HIGH

**Recommendation:** DO NOT PURSUE

---

## Proposed Action Plan

### Recommended Approach: Hybrid Enhancement

**Goal:** Add SVG export capability while maintaining canvas rendering excellence

#### Phase 1: Add SVG Export (Priority: HIGH)

**Duration:** 3-4 weeks
**Effort:** 40-60 hours

**Tasks:**
1. Create `SVGExporter` class in `src/utils/exporters/SVGExporter.ts`
2. Implement SVG generation from layout data
3. Reuse existing geometry calculations from KeyRenderer
4. Generate proper SVG structure with groups, transforms
5. Export labels as SVG text with proper formatting
6. Handle images and inline SVG
7. Add export UI in toolbar
8. Testing across browsers

**Deliverables:**
- SVG export functionality accessible via UI
- Generated SVG files are standards-compliant
- Support for all key types and features
- Documentation for SVG export format

**Success Criteria:**
- All layouts export to valid SVG
- SVG renders correctly in Inkscape, Adobe Illustrator, web browsers
- Text formatting preserved (bold, italic)
- Images and inline SVG embedded properly

#### Phase 2: SVG Overlays for UI Elements (Priority: MEDIUM)

**Duration:** 1-2 weeks
**Effort:** 10-20 hours

**Tasks:**
1. Move rotation indicators from canvas to SVG overlay
2. Move selection rectangle from canvas to SVG overlay
3. Move mirror axis from canvas to SVG overlay
4. Update `KeyboardCanvas.vue` to coordinate layers
5. Add CSS styling for SVG overlays

**Deliverables:**
- SVG-based UI overlays replace canvas-drawn equivalents
- Better visual quality (no pixel alignment issues)
- Easier to debug and inspect

**Success Criteria:**
- All overlay elements render correctly
- No performance degradation
- Easier to style and customize

#### Phase 3: Documentation Updates (Priority: HIGH)

**Duration:** 1 week
**Effort:** 10-15 hours

**Tasks:**
1. Update `docs/canvas-rendering-pipeline.md` with SVG export info
2. Document SVG export format and capabilities
3. Add examples of SVG export use cases
4. Update README with SVG export feature

#### Phase 4: Performance Benchmarking (Priority: LOW)

**Duration:** 1 week
**Effort:** 15-20 hours

**Tasks:**
1. Create performance test suite
2. Benchmark canvas rendering performance
3. Measure rendering time for various layout sizes
4. Establish performance baseline for future optimization

**Total Duration:** 6-8 weeks
**Total Effort:** 75-115 hours

### Alternative: Do Nothing (Recommended if resources are constrained)

**Rationale:**
- Current canvas implementation is excellent
- No user complaints about rendering
- No functional limitations preventing features
- Development resources better spent on new features

**Benefits:**
- Zero risk
- Zero effort
- Proven stability

---

## Risk Assessment

### Risks of SVG Migration (Full Migration - Not Recommended)

| Risk | Probability | Impact | Mitigation |
|------|-------------|---------|------------|
| **Performance Degradation** | HIGH | HIGH | Extensive benchmarking, phased rollout |
| **Text Rendering Issues** | HIGH | HIGH | Cross-browser testing, fallback rendering |
| **Feature Regressions** | MEDIUM | HIGH | Comprehensive test suite, QA testing |
| **Development Timeline Overrun** | HIGH | MEDIUM | Conservative estimates, incremental milestones |
| **Browser Compatibility** | MEDIUM | MEDIUM | Extensive browser testing, polyfills |
| **User Disruption** | LOW | HIGH | Feature flag, gradual rollout, rollback plan |

**Overall Risk Level:** VERY HIGH - NOT RECOMMENDED

### Risks of Hybrid Approach (Recommended)

| Risk | Probability | Impact | Mitigation |
|------|-------------|---------|------------|
| **Synchronization Issues** | LOW | MEDIUM | Clear layer boundaries, integration tests |
| **Increased Complexity** | MEDIUM | LOW | Good documentation, clear architecture |
| **Export Quality Issues** | MEDIUM | LOW | Extensive testing, user feedback |
| **Development Effort Underestimated** | MEDIUM | LOW | Buffer time in estimates, incremental approach |

**Overall Risk Level:** LOW - ACCEPTABLE

### Testing Strategy

#### For Hybrid Approach (Recommended)

**Unit Tests:**
- SVGExporter class methods
- Geometry calculations
- Text formatting conversion
- Image embedding logic

**Integration Tests:**
- Export all preset layouts to SVG
- Verify SVG validity with validators
- Test SVG rendering in browsers
- Test SVG import into design tools (Inkscape, Illustrator)

**Visual Regression Tests:**
- Compare canvas rendering with SVG export visually
- Ensure label positioning matches
- Verify colors, sizes, rotations

**Cross-Browser Tests:**
- Test SVG export in Chrome, Firefox, Safari, Edge
- Verify generated SVG renders consistently
- Test on Windows, macOS, Linux

**Performance Tests:**
- Measure export time for various layout sizes
- Ensure export doesn't block UI
- Memory usage during export

#### For Full SVG Migration (If Pursued - Not Recommended)

**Additional Tests Required:**
- Comprehensive rendering tests for all key types
- Event handling tests for interactions
- Transform testing for rotation, zoom, pan
- Performance benchmarking vs. canvas
- Accessibility testing
- Cross-browser compatibility suite
- Load testing with large layouts (100+ keys)

**Estimated QA Effort:** 80-120 hours (additional)

---

## Appendix: Technical Details

### A. Current Canvas API Usage

**Drawing Operations:**
- `beginPath()`, `moveTo()`, `lineTo()`, `quadraticCurveTo()`, `arc()`, `closePath()`
- `fill()`, `stroke()`
- `fillRect()`, `strokeRect()`, `clearRect()`
- `fillText()`, `strokeText()`
- `drawImage()`

**Transformations:**
- `save()`, `restore()`
- `translate()`, `rotate()`, `scale()`
- `setTransform()`

**Styling:**
- `fillStyle`, `strokeStyle`
- `lineWidth`, `lineCap`, `lineJoin`
- `globalAlpha`
- `font`, `textAlign`, `textBaseline`
- `setLineDash()`

**Measurements:**
- `measureText()`

### B. SVG Element Equivalents

| Canvas Operation | SVG Equivalent | Complexity |
|------------------|----------------|------------|
| `fillRect()` | `<rect>` | Simple |
| `strokeRect()` | `<rect>` with stroke | Simple |
| Path commands | `<path>` with `d` attribute | Medium |
| `arc()` | `<circle>` or `<path>` with arc | Medium |
| `fillText()` | `<text>` | Complex (formatting) |
| `drawImage()` | `<image>` | Medium |
| `translate()` | `transform="translate()"` | Simple |
| `rotate()` | `transform="rotate()"` | Simple |
| `scale()` | `transform="scale()"` or viewBox | Medium |
| `save()`/`restore()` | Nested `<g>` elements | Simple |
| `globalAlpha` | `opacity` attribute | Simple |
| `measureText()` | `getBBox()` | Complex (causes reflow) |

### C. Key Dependencies

**External Libraries:**
- `polygon-clipping` (v0.15.3) - Used by KeyRenderer for vector union operations
  - **Impact:** Would still be needed for SVG path generation
- `@adamws/kle-serial` - Layout serialization/deserialization
  - **Impact:** No change needed
- Vue 3 - Component framework
  - **Impact:** Component refactoring needed

**Browser APIs:**
- Canvas 2D Rendering Context
  - **Impact:** Would be replaced with SVG DOM APIs
- `requestAnimationFrame`
  - **Impact:** Still needed for animation timing
- `ResizeObserver`
  - **Impact:** Still needed for responsive sizing

### D. File Size and Complexity Metrics

**Current Canvas Implementation:**
- `canvas-renderer.ts`: ~400 LOC
- `KeyRenderer.ts`: ~940 LOC
- `LabelRenderer.ts`: ~700 LOC (estimated from partial view)
- `RotationRenderer.ts`: ~300 LOC (estimated)
- **Total Core:** ~2,340 LOC

**Estimated SVG Implementation:**
- Similar LOC count, but higher complexity per line
- Additional DOM manipulation overhead
- More error-prone (browser quirks, namespace issues)

### E. Browser Compatibility Matrix

| Feature | Canvas Support | SVG Support | Notes |
|---------|---------------|-------------|-------|
| Basic Rendering | ✅ Excellent | ✅ Excellent | Both well supported |
| Text Rendering | ✅ Consistent | ⚠️ Variable | SVG text baseline differs |
| Transformations | ✅ Consistent | ⚠️ Variable | Transform origin differences |
| Image Embedding | ✅ Consistent | ✅ Consistent | CORS issues in both |
| Performance | ✅ Excellent | ⚠️ Variable | SVG slower for many elements |
| Accessibility | ⚠️ Limited | ✅ Better | SVG has semantic structure |
| Print Quality | ⚠️ Rasterized | ✅ Vector | SVG advantage |

### F. Migration Complexity Assessment

**Complexity Factors:**

1. **Text Rendering:** 🔴 HIGH
   - HTML formatted text in canvas is straightforward
   - SVG requires complex `<tspan>` nesting and positioning
   - Baseline alignment differs across browsers

2. **Coordinate Transformations:** 🟡 MEDIUM
   - Different API but well-documented
   - Nested transforms in SVG are verbose but manageable

3. **Image Handling:** 🟡 MEDIUM
   - Similar challenges (CORS, loading)
   - Inline SVG more complex in SVG context

4. **Event Handling:** 🟢 LOW
   - SVG simplifies this aspect
   - Native DOM events better than hit testing

5. **Performance Optimization:** 🔴 HIGH
   - Need to learn different optimization strategies
   - DOM manipulation vs. drawing operations

6. **Testing and QA:** 🔴 HIGH
   - Significant cross-browser testing required
   - Visual regression testing essential

**Overall Complexity:** 🔴 VERY HIGH

### G. Resources and References

**Documentation:**
- [MDN Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [MDN SVG Tutorial](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial)
- [SVG 2 Specification](https://www.w3.org/TR/SVG2/)

**Similar Projects:**
- Keyboard Firmware Builder uses SVG rendering
- QMK Configurator uses Canvas rendering
- VIA uses SVG rendering

**Tools:**
- [svg-path-editor](https://yqnn.github.io/svg-path-editor/) - Path visualization
- [SVGOMG](https://jakearchibald.github.io/svgomg/) - SVG optimization
- [polygon-clipping](https://github.com/mfogel/polygon-clipping) - Vector operations (already used)

---

## Conclusion

After thorough analysis of the kle-ng codebase, the current canvas-based rendering implementation is **excellent** and **well-architected**. The modular design with specialized renderers (KeyRenderer, LabelRenderer, RotationRenderer) demonstrates solid software engineering principles and provides a maintainable, performant solution.

### Final Recommendation

**DO NOT migrate to full SVG rendering.**

Instead, adopt the **Hybrid Approach**:

1. **Keep canvas for primary rendering** (proven, performant, feature-complete)
2. **Add SVG export functionality** (provides vector output benefit without risk)
3. **Expand SVG usage for overlays** (improves developer experience)

This approach delivers user value (SVG export) while avoiding massive refactoring risk and likely performance degradation.

### Next Steps

1. **Review this plan with the development team**
2. **Validate priorities and timeline**
3. **Begin Phase 1: SVG Export implementation** (if approved)
4. **Establish success metrics and monitoring**

### Questions for Stakeholders

1. Is SVG export the primary motivation for considering SVG migration?
2. Are there specific user complaints about canvas rendering?
3. What is the priority of vector export vs. other features?
4. What is the available development capacity for this work?
5. Are there accessibility requirements driving SVG consideration?

---

**End of Document**
