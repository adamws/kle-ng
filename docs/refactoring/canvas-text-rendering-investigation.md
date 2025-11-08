# Canvas Text Rendering Investigation & Enhancement Plan

**Date:** 2025-11-08
**Status:** Investigation & Action Plan
**Related:** canvas-to-svg-migration-plan-2025-11-08.md

---

## Background

Based on stakeholder feedback, the primary concerns are:

1. ✅ **High DPI support may be implemented** - but uncertainty about optimal solution
2. ❌ **Text rendering quality** - concerns about crispness/blur
3. ❌ **Searchable labels** - users want to search/find keys by label text
4. ✅ **High-quality PNG export** - priority over vector export

**Key Insight:** SVG migration was being considered as a solution, but canvas can solve these issues more effectively with targeted improvements.

---

## Current Text Rendering Analysis

### What's Already Implemented (Good!)

From `src/components/KeyboardCanvas.vue` and `src/utils/renderers/LabelRenderer.ts`:

✅ **High DPI Support:**
```typescript
const devicePixelRatio = ref(window.devicePixelRatio || 1)
const scaledCanvasWidth = computed(() => Math.round(canvasWidth.value * devicePixelRatio.value))
const scaledCanvasHeight = computed(() => Math.round(canvasHeight.value * devicePixelRatio.value))

// In render:
ctx.scale(devicePixelRatio.value, devicePixelRatio.value)
```

✅ **DPI Change Detection:**
```typescript
dpiMediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
dpiMediaQuery.addEventListener('change', handleDpiChange)
```

✅ **Font Configuration:**
```typescript
const fontFamily = options.fontFamily || '"Helvetica Neue", Helvetica, Arial, sans-serif'
ctx.font = `${fontSize}px ${fontFamily}`
```

### Potential Issues with Current Implementation

#### Issue 1: Canvas Context Text Rendering Settings

The current code doesn't explicitly set text rendering quality hints. Canvas 2D context has properties that affect text quality:

**Missing optimizations:**
```typescript
// NOT currently set in code:
ctx.textRendering = 'optimizeLegibility'  // Better text quality
ctx.imageSmoothingEnabled = true          // Should be true for text
ctx.imageSmoothingQuality = 'high'        // High quality scaling
```

#### Issue 2: Subpixel Positioning

Text positioning might not be optimized for pixel grid alignment:

**Current approach:**
```typescript
ctx.fillText(text, x, y)  // x, y might be fractional
```

**Better approach for crisp text:**
```typescript
// Round coordinates to whole pixels at the scaled resolution
const scaledX = Math.round(x * devicePixelRatio) / devicePixelRatio
const scaledY = Math.round(y * devicePixelRatio) / devicePixelRatio
ctx.fillText(text, scaledX, scaledY)
```

#### Issue 3: Font Loading and Rendering

Custom fonts via CSS `@import` may not be fully loaded before rendering:

**Current approach:**
```typescript
// Font loaded via CSS in metadata
// Rendering happens immediately
```

**Better approach:**
```typescript
// Ensure font is loaded before rendering
await document.fonts.ready
// OR
await document.fonts.load(`12px ${fontFamily}`)
```

#### Issue 4: Canvas vs CSS Size Mismatch

While DPI scaling is implemented, the ratio between canvas internal resolution and CSS size must be perfect:

**Verification needed:**
```typescript
// Canvas element:
canvas.width = scaledCanvasWidth   // Internal resolution
canvas.height = scaledCanvasHeight
canvas.style.width = canvasWidth + 'px'   // CSS size
canvas.style.height = canvasHeight + 'px'

// Ratio must be exactly devicePixelRatio
```

---

## Text Quality Enhancement Plan

### Phase 1: Canvas Text Rendering Optimization (HIGH PRIORITY)

**Effort:** 20-30 hours
**Risk:** LOW
**Impact:** HIGH - Solves blur/quality issues

#### Task 1.1: Add Text Rendering Quality Hints

**File:** `src/utils/renderers/LabelRenderer.ts`

**Changes:**
```typescript
export class LabelRenderer {
  /**
   * Configure canvas context for optimal text rendering
   */
  private configureTextQuality(ctx: CanvasRenderingContext2D): void {
    // Enable high-quality text rendering
    // Note: textRendering is non-standard but supported in some browsers
    if ('textRendering' in ctx) {
      (ctx as any).textRendering = 'optimizeLegibility'
    }

    // Ensure image smoothing is enabled for text (helps with scaling)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
  }

  public drawKeyLabels(...) {
    this.configureTextQuality(ctx)
    // ... rest of implementation
  }
}
```

#### Task 1.2: Implement Pixel-Perfect Text Positioning

**File:** `src/utils/renderers/LabelRenderer.ts`

**Changes:**
```typescript
export class LabelRenderer {
  /**
   * Align text position to pixel boundaries for crisp rendering
   * Accounts for device pixel ratio
   */
  private alignTextPosition(
    x: number,
    y: number,
    devicePixelRatio: number = 1
  ): { x: number; y: number } {
    // Round to nearest pixel at actual device resolution
    const scaledX = Math.round(x * devicePixelRatio) / devicePixelRatio
    const scaledY = Math.round(y * devicePixelRatio) / devicePixelRatio

    return { x: scaledX, y: scaledY }
  }

  public drawKeyLabels(
    ctx: CanvasRenderingContext2D,
    key: Key,
    params: KeyRenderParams,
    options: LabelRenderOptions,
    devicePixelRatio: number = 1,  // NEW parameter
    // ... other params
  ): void {
    key.labels.forEach((label, index) => {
      // ... calculate x, y

      // NEW: Align to pixel grid
      const aligned = this.alignTextPosition(x, y, devicePixelRatio)

      // Use aligned coordinates
      this.drawWrappedText(ctx, processedLabel, aligned.x, aligned.y, ...)
    })
  }
}
```

**File:** `src/utils/canvas-renderer.ts`

**Changes:**
```typescript
public render(...) {
  // ... existing code

  // Pass devicePixelRatio to label renderer
  const dpr = this.getDevicePixelRatio()

  if (isRotaryEncoder) {
    labelRenderer.drawRotaryEncoderLabels(
      this.ctx,
      key,
      params,
      labelOptions,
      dpr,  // NEW
      getImageFn,
      loadImageFn,
      this.onImageLoadCallback,
    )
  } else {
    labelRenderer.drawKeyLabels(
      this.ctx,
      key,
      params,
      labelOptions,
      dpr,  // NEW
      getImageFn,
      loadImageFn,
      this.onImageLoadCallback,
    )
  }
}

private getDevicePixelRatio(): number {
  return window.devicePixelRatio || 1
}
```

#### Task 1.3: Font Loading Verification

**File:** `src/utils/canvas-renderer.ts`

**Changes:**
```typescript
export class CanvasRenderer {
  private fontLoadPromise: Promise<void> | null = null

  /**
   * Ensure font is loaded before rendering
   */
  private async ensureFontLoaded(fontFamily: string): Promise<void> {
    if (!document.fonts) {
      // Font Loading API not supported, proceed anyway
      return
    }

    try {
      // Wait for specific font to load
      await document.fonts.load(`12px ${fontFamily}`)
      await document.fonts.ready
    } catch (error) {
      console.warn('Font loading check failed:', error)
      // Proceed anyway, font might be system font
    }
  }

  public async render(...) {
    // Ensure font is loaded before first render
    if (this.options.fontFamily && !this.fontLoadPromise) {
      this.fontLoadPromise = this.ensureFontLoaded(this.options.fontFamily)
    }

    if (this.fontLoadPromise) {
      await this.fontLoadPromise
    }

    // ... rest of render logic
  }
}
```

**File:** `src/components/KeyboardCanvas.vue`

**Changes:**
```typescript
const renderKeyboard = async () => {  // Make async
  if (renderer.value) {
    try {
      // ... existing clear and background code

      await renderer.value.render(  // Await render
        keyboardStore.keys,
        keysToHighlight,
        keyboardStore.metadata,
        // ... rest of params
      )

      // ... rest of render code
    } catch (error) {
      console.error('Error rendering keyboard:', error)
    }
  }
}

// Update all renderScheduler.schedule calls:
// Before: renderScheduler.schedule(renderKeyboard)
// After:  renderScheduler.schedule(() => renderKeyboard())
```

#### Task 1.4: Add Explicit Text Anti-aliasing Control

Some browsers support font smoothing hints:

**File:** `src/utils/renderers/LabelRenderer.ts`

**Changes:**
```typescript
private configureTextQuality(ctx: CanvasRenderingContext2D): void {
  // Existing code...

  // Try to enable font smoothing (WebKit/Blink)
  if ('webkitFontSmoothing' in ctx) {
    (ctx as any).webkitFontSmoothing = 'antialiased'
  }

  // Try to set font smoothing (Gecko)
  if ('mozFontSmoothing' in ctx) {
    (ctx as any).mozFontSmoothing = 'antialiased'
  }
}
```

#### Task 1.5: Verify Canvas/CSS Size Ratio

**File:** `src/components/KeyboardCanvas.vue`

**Add diagnostic logging (development only):**
```typescript
const updateCanvasSize = () => {
  // ... existing code

  if (import.meta.env.DEV && canvasRef.value) {
    // Diagnostic: verify DPI scaling is correct
    const expectedRatio = devicePixelRatio.value
    const actualRatio = canvasRef.value.width / canvasWidth.value

    if (Math.abs(actualRatio - expectedRatio) > 0.01) {
      console.warn('Canvas DPI scaling mismatch!', {
        expected: expectedRatio,
        actual: actualRatio,
        canvasWidth: canvasRef.value.width,
        cssWidth: canvasWidth.value
      })
    }
  }
}
```

---

### Phase 2: Searchable Labels Implementation (MEDIUM PRIORITY)

**Effort:** 30-40 hours
**Risk:** LOW
**Impact:** HIGH - Solves searchability

**Recommended Approach:** JSON-based search with canvas highlighting (as suggested by stakeholder)

#### Architecture

```
SearchPanel.vue (new component)
  ├── Search input field
  ├── Search results list
  └── Emits events: key-selected, search-cleared

KeyboardCanvas.vue (enhanced)
  ├── Listens to search events
  └── Highlights matching keys on canvas
```

#### Task 2.1: Create Search Service

**File:** `src/services/KeySearchService.ts` (new file)

```typescript
import type { Key } from '@adamws/kle-serial'

export interface SearchResult {
  key: Key
  matchedLabel: string
  matchedLabelIndex: number
  matchType: 'exact' | 'partial' | 'regex'
}

export interface SearchOptions {
  caseSensitive: boolean
  regex: boolean
  searchAllLabels: boolean  // Search all 12 positions or just visible ones
}

export class KeySearchService {
  /**
   * Search for keys matching the query
   */
  public search(
    keys: Key[],
    query: string,
    options: SearchOptions
  ): SearchResult[] {
    if (!query.trim()) return []

    const results: SearchResult[] = []
    const searchQuery = options.caseSensitive ? query : query.toLowerCase()

    keys.forEach(key => {
      key.labels.forEach((label, index) => {
        if (!label) return

        const searchLabel = options.caseSensitive ? label : label.toLowerCase()

        if (options.regex) {
          try {
            const regex = new RegExp(query, options.caseSensitive ? '' : 'i')
            if (regex.test(label)) {
              results.push({
                key,
                matchedLabel: label,
                matchedLabelIndex: index,
                matchType: 'regex'
              })
            }
          } catch (e) {
            // Invalid regex, skip
          }
        } else {
          // Exact match
          if (searchLabel === searchQuery) {
            results.push({
              key,
              matchedLabel: label,
              matchedLabelIndex: index,
              matchType: 'exact'
            })
          }
          // Partial match
          else if (searchLabel.includes(searchQuery)) {
            results.push({
              key,
              matchedLabel: label,
              matchedLabelIndex: index,
              matchType: 'partial'
            })
          }
        }
      })
    })

    return results
  }

  /**
   * Get display text for a key (for search results list)
   */
  public getKeyDisplayText(key: Key): string {
    // Return first non-empty label
    return key.labels.find(l => l) || 'Unlabeled Key'
  }
}

export const keySearchService = new KeySearchService()
```

#### Task 2.2: Create Search Panel Component

**File:** `src/components/SearchPanel.vue` (new file)

```vue
<template>
  <div class="search-panel" :class="{ 'search-panel-open': visible }">
    <div class="search-header">
      <input
        ref="searchInput"
        v-model="searchQuery"
        type="text"
        class="form-control search-input"
        placeholder="Search keys by label..."
        @input="handleSearch"
        @keydown.enter="selectNextResult"
        @keydown.escape="handleClose"
      />
      <button class="btn btn-sm btn-outline-secondary" @click="toggleOptions">
        <i class="bi bi-gear"></i>
      </button>
      <button class="btn btn-sm btn-outline-secondary" @click="handleClose">
        <i class="bi bi-x"></i>
      </button>
    </div>

    <!-- Search Options -->
    <div v-if="showOptions" class="search-options">
      <div class="form-check">
        <input
          id="caseSensitive"
          v-model="options.caseSensitive"
          class="form-check-input"
          type="checkbox"
          @change="handleSearch"
        />
        <label class="form-check-label" for="caseSensitive">
          Case sensitive
        </label>
      </div>
      <div class="form-check">
        <input
          id="regexSearch"
          v-model="options.regex"
          class="form-check-input"
          type="checkbox"
          @change="handleSearch"
        />
        <label class="form-check-label" for="regexSearch">
          Regex
        </label>
      </div>
    </div>

    <!-- Search Results -->
    <div v-if="results.length > 0" class="search-results">
      <div class="search-results-header">
        {{ results.length }} result{{ results.length !== 1 ? 's' : '' }}
        <span v-if="selectedResultIndex >= 0">
          ({{ selectedResultIndex + 1 }}/{{ results.length }})
        </span>
      </div>
      <div class="search-results-list">
        <div
          v-for="(result, index) in results"
          :key="index"
          class="search-result-item"
          :class="{ 'active': index === selectedResultIndex }"
          @click="selectResult(index)"
        >
          <div class="result-label">{{ result.matchedLabel }}</div>
          <div class="result-meta">
            Position {{ result.matchedLabelIndex }}
            <span class="badge bg-secondary">{{ result.matchType }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="searchQuery" class="search-no-results">
      No matching keys found
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useKeyboardStore } from '@/stores/keyboard'
import { keySearchService, type SearchResult, type SearchOptions } from '@/services/KeySearchService'

const keyboardStore = useKeyboardStore()

const visible = defineModel<boolean>('visible', { default: false })

const searchQuery = ref('')
const results = ref<SearchResult[]>([])
const selectedResultIndex = ref(-1)
const showOptions = ref(false)
const searchInput = ref<HTMLInputElement>()

const options = ref<SearchOptions>({
  caseSensitive: false,
  regex: false,
  searchAllLabels: true,
})

const emit = defineEmits<{
  'key-highlighted': [key: Key]
  'search-cleared': []
}>()

const handleSearch = () => {
  results.value = keySearchService.search(
    keyboardStore.keys,
    searchQuery.value,
    options.value
  )
  selectedResultIndex.value = results.value.length > 0 ? 0 : -1

  if (results.value.length > 0) {
    emit('key-highlighted', results.value[0].key)
  } else {
    emit('search-cleared')
  }
}

const selectResult = (index: number) => {
  selectedResultIndex.value = index
  if (results.value[index]) {
    emit('key-highlighted', results.value[index].key)
  }
}

const selectNextResult = () => {
  if (results.value.length === 0) return

  selectedResultIndex.value = (selectedResultIndex.value + 1) % results.value.length
  selectResult(selectedResultIndex.value)
}

const toggleOptions = () => {
  showOptions.value = !showOptions.value
}

const handleClose = () => {
  searchQuery.value = ''
  results.value = []
  selectedResultIndex.value = -1
  visible.value = false
  emit('search-cleared')
}

// Focus input when panel opens
watch(visible, (isVisible) => {
  if (isVisible) {
    setTimeout(() => searchInput.value?.focus(), 100)
  } else {
    handleClose()
  }
})

// Expose methods for parent
defineExpose({
  focus: () => searchInput.value?.focus(),
})
</script>

<style scoped>
.search-panel {
  position: fixed;
  top: 60px;
  right: -400px;
  width: 350px;
  max-height: calc(100vh - 80px);
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: right 0.3s ease;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.search-panel-open {
  right: 20px;
}

.search-header {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid var(--bs-border-color);
}

.search-input {
  flex: 1;
}

.search-options {
  padding: 12px;
  border-bottom: 1px solid var(--bs-border-color);
  background: var(--bs-secondary-bg);
}

.search-results {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.search-results-header {
  padding: 8px 12px;
  background: var(--bs-secondary-bg);
  border-bottom: 1px solid var(--bs-border-color);
  font-size: 13px;
  font-weight: 600;
}

.search-results-list {
  flex: 1;
  overflow-y: auto;
}

.search-result-item {
  padding: 10px 12px;
  border-bottom: 1px solid var(--bs-border-color);
  cursor: pointer;
  transition: background 0.2s;
}

.search-result-item:hover {
  background: var(--bs-secondary-bg);
}

.search-result-item.active {
  background: var(--bs-primary);
  color: white;
}

.result-label {
  font-weight: 500;
  margin-bottom: 4px;
}

.result-meta {
  font-size: 12px;
  opacity: 0.8;
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-no-results {
  padding: 20px;
  text-align: center;
  color: var(--bs-secondary-color);
}
</style>
```

#### Task 2.3: Add Search Highlighting to Canvas

**File:** `src/components/KeyboardCanvas.vue`

**Changes:**
```typescript
// Add state for search highlighting
const searchHighlightedKey = ref<Key | null>(null)
const searchPanelVisible = ref(false)

// Add handler for search events
const handleKeyHighlighted = (key: Key) => {
  searchHighlightedKey.value = key
  // Optionally auto-select the key
  keyboardStore.selectKey(key, false)
  // Ensure key is visible (pan if needed)
  ensureKeyVisible(key)
  renderKeyboard()
}

const handleSearchCleared = () => {
  searchHighlightedKey.value = null
  renderKeyboard()
}

const ensureKeyVisible = (key: Key) => {
  // TODO: Implement auto-pan to ensure key is in viewport
  // For now, just render
}

// Modify renderKeyboard to draw search highlight
const renderKeyboard = () => {
  if (renderer.value) {
    try {
      // ... existing render code

      // After rendering all keys, draw search highlight
      if (searchHighlightedKey.value) {
        drawSearchHighlight(ctx, searchHighlightedKey.value)
      }

      // ... rest of render code
    }
  }
}

const drawSearchHighlight = (ctx: CanvasRenderingContext2D, key: Key) => {
  if (!renderer.value) return

  const params = keyRenderer.getRenderParams(key, { unit: renderOptions.value.unit })

  ctx.save()

  // Apply rotation if needed
  if (key.rotation_angle) {
    ctx.translate(params.origin_x, params.origin_y)
    ctx.rotate(D.degreesToRadians(key.rotation_angle))
    ctx.translate(-params.origin_x, -params.origin_y)
  }

  // Draw pulsing highlight around key
  const time = Date.now() / 1000
  const pulseAlpha = 0.3 + 0.2 * Math.sin(time * 3)

  ctx.strokeStyle = '#ffc107'  // Warning yellow
  ctx.lineWidth = 4
  ctx.globalAlpha = pulseAlpha
  ctx.setLineDash([8, 4])

  // Draw rectangle around outer cap
  ctx.strokeRect(
    params.outercapx - 4,
    params.outercapy - 4,
    params.outercapwidth + 8,
    params.outercapheight + 8
  )

  ctx.setLineDash([])
  ctx.restore()

  // Request next frame for animation
  requestAnimationFrame(() => renderKeyboard())
}

// Add keyboard shortcut for search
const handleKeyDown = async (event: KeyboardEvent) => {
  // Existing shortcuts...

  // Ctrl+F or Cmd+F for search
  if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
    event.preventDefault()
    searchPanelVisible.value = !searchPanelVisible.value
    return
  }

  // ... rest of shortcuts
}
```

**Template changes:**
```vue
<template>
  <div class="keyboard-canvas-container" ...>
    <canvas ... />

    <!-- Existing overlays -->
    <MatrixAnnotationOverlay ... />
    <DebugOverlay ... />

    <!-- NEW: Search Panel -->
    <SearchPanel
      v-model:visible="searchPanelVisible"
      @key-highlighted="handleKeyHighlighted"
      @search-cleared="handleSearchCleared"
    />

    <!-- Existing modals -->
    <RotationControlModal ... />
    <MoveExactlyModal ... />
  </div>
</template>
```

#### Task 2.4: Add Search Button to Toolbar

**File:** `src/components/Toolbar.vue` or wherever toolbar is defined

**Add search button:**
```vue
<button
  class="btn btn-outline-secondary"
  title="Search Keys (Ctrl+F)"
  @click="handleSearchClick"
>
  <i class="bi bi-search"></i>
</button>
```

---

### Phase 3: High-Quality PNG Export Enhancement (HIGH PRIORITY)

**Effort:** 15-25 hours
**Risk:** LOW
**Impact:** MEDIUM - Better export quality

#### Current PNG Export

The current export likely uses:
```typescript
canvas.toDataURL('image/png')
```

This exports at the current canvas resolution, which is already scaled for DPI.

#### Enhancement: Custom Resolution Export

**File:** `src/services/PNGExportService.ts` (new or enhance existing)

```typescript
export interface PNGExportOptions {
  /** Export resolution multiplier (1 = current DPI, 2 = 2x, etc.) */
  resolutionMultiplier: number

  /** Include matrix annotations overlay */
  includeMatrixAnnotations: boolean

  /** Background color (defaults to layout background) */
  backgroundColor?: string

  /** Add padding around layout (in pixels at export resolution) */
  padding?: number

  /** Image quality (0-1, only for JPEG) */
  quality?: number
}

export class PNGExportService {
  /**
   * Export layout to high-resolution PNG
   */
  public async exportToPNG(
    keys: Key[],
    metadata: KeyboardMetadata,
    options: PNGExportOptions
  ): Promise<Blob> {
    // Create offscreen canvas at higher resolution
    const canvas = document.createElement('canvas')
    const baseUnit = 54  // Base unit size
    const exportUnit = baseUnit * options.resolutionMultiplier

    // Calculate bounds
    const bounds = this.calculateBounds(keys, exportUnit)
    const padding = options.padding || 20

    canvas.width = bounds.width + padding * 2
    canvas.height = bounds.height + padding * 2

    // Create renderer with export settings
    const renderer = new CanvasRenderer(canvas, {
      unit: exportUnit,
      background: options.backgroundColor || metadata.backcolor || '#ffffff',
      fontFamily: metadata.css ? this.extractFontFamily(metadata.css) : undefined,
    })

    // Ensure fonts are loaded
    if (metadata.css) {
      await this.loadCustomFonts(metadata.css)
    }

    // Render at high resolution
    await renderer.render(keys, [], metadata, true)

    // Optionally overlay matrix annotations
    if (options.includeMatrixAnnotations) {
      await this.drawMatrixAnnotations(canvas, keys, metadata, exportUnit)
    }

    // Convert to blob
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Failed to create PNG blob'))
        },
        'image/png',
        1.0  // Max quality
      )
    })
  }

  private calculateBounds(keys: Key[], unit: number) {
    // Use existing BoundsCalculator logic
    // ...
  }

  private async loadCustomFonts(css: string) {
    // Parse CSS and load fonts
    // ...
  }

  private async drawMatrixAnnotations(
    canvas: HTMLCanvasElement,
    keys: Key[],
    metadata: KeyboardMetadata,
    unit: number
  ) {
    // Draw matrix lines if present
    // ...
  }

  private extractFontFamily(css: string): string | undefined {
    // Extract font from CSS @import
    // ...
  }
}
```

#### Task 3.2: Add Export Resolution UI

**File:** Export modal component

**Add resolution selector:**
```vue
<template>
  <div class="export-options">
    <div class="form-group">
      <label>Export Resolution</label>
      <select v-model="exportResolution" class="form-select">
        <option value="1">Standard (1x)</option>
        <option value="2">High (2x - Retina)</option>
        <option value="3">Very High (3x)</option>
        <option value="4">Ultra (4x)</option>
      </select>
      <small class="form-text text-muted">
        Higher resolution = larger file size but better quality
      </small>
    </div>

    <div class="form-check">
      <input
        id="includeMatrix"
        v-model="includeMatrixAnnotations"
        type="checkbox"
        class="form-check-input"
      />
      <label class="form-check-label" for="includeMatrix">
        Include matrix annotations
      </label>
    </div>
  </div>
</template>
```

---

## Implementation Priority

### Immediate (Week 1-2): Text Rendering Quality
1. ✅ Task 1.1: Add text rendering quality hints
2. ✅ Task 1.2: Pixel-perfect text positioning
3. ✅ Task 1.3: Font loading verification
4. ✅ Task 1.4: Text anti-aliasing control
5. ✅ Task 1.5: Canvas/CSS size verification

**Expected Result:** Crisp, clear text rendering on all displays

### Short-term (Week 3-4): Searchable Labels
1. ✅ Task 2.1: Create search service
2. ✅ Task 2.2: Create search panel component
3. ✅ Task 2.3: Add canvas highlighting
4. ✅ Task 2.4: Add toolbar integration

**Expected Result:** Users can search and find keys by label text with visual highlighting

### Medium-term (Week 5-6): PNG Export Enhancement
1. ✅ Task 3.1: Implement high-resolution export
2. ✅ Task 3.2: Add resolution UI controls

**Expected Result:** Export PNG at 2x, 3x, 4x resolution for print/documentation

---

## Testing Strategy

### Text Rendering Quality Tests

**Manual Testing:**
1. Test on different DPI displays (1x, 1.5x, 2x, 3x)
2. Test with different fonts (system fonts, Google Fonts)
3. Test at different zoom levels
4. Compare with reference images
5. Test text in all 12 label positions
6. Test bold, italic, mixed formatting

**Automated Testing:**
- Visual regression tests (capture and compare screenshots)
- Font loading verification
- Canvas size ratio validation

### Search Functionality Tests

**Unit Tests:**
```typescript
describe('KeySearchService', () => {
  it('should find exact matches', () => {
    const results = keySearchService.search(keys, 'Enter', {
      caseSensitive: false,
      regex: false,
      searchAllLabels: true,
    })
    expect(results).toHaveLength(1)
    expect(results[0].matchType).toBe('exact')
  })

  it('should find partial matches', () => {
    // ...
  })

  it('should support regex search', () => {
    // ...
  })

  it('should respect case sensitivity', () => {
    // ...
  })
})
```

**Integration Tests:**
- Search panel visibility toggling
- Search result selection
- Canvas highlighting
- Keyboard shortcuts (Ctrl+F)

### PNG Export Tests

**Manual Testing:**
1. Export at different resolutions
2. Verify file size increases proportionally
3. Check quality in image viewers
4. Print test (if possible)
5. Import into design tools (Photoshop, Figma)

**Automated Tests:**
- Verify exported image dimensions
- Verify background color
- Verify font rendering
- Compare with reference exports

---

## Success Metrics

### Text Rendering Quality
- ✅ Text appears sharp on all standard DPI displays (1x, 2x, 3x)
- ✅ No reported blur or quality issues
- ✅ Font rendering matches or exceeds native browser text
- ✅ Zero regression in rendering performance

### Searchable Labels
- ✅ Users can find any key by typing its label
- ✅ Search results appear within 100ms
- ✅ Search works with regex patterns
- ✅ Visual highlighting clearly indicates found keys
- ✅ Keyboard shortcuts work intuitively

### PNG Export
- ✅ 4x resolution export produces print-quality output
- ✅ Exported images load correctly in all major tools
- ✅ Matrix annotations can be included/excluded as needed
- ✅ Export completes within 2 seconds for typical layouts

---

## Conclusion

**Canvas rendering is the right choice** for this application. The issues raised can all be solved with targeted improvements to the existing canvas implementation:

1. **Text quality:** Enhanced with rendering hints, pixel alignment, and font loading
2. **Searchability:** Solved with JSON-based search + canvas highlighting (better UX than SVG text search)
3. **High-quality export:** Solved with multi-resolution canvas rendering

**Total Effort:** 65-95 hours (6-9 weeks)

**vs. SVG Migration:** 245-350 hours with uncertain benefits

This approach delivers all the requested benefits while maintaining the proven architecture and avoiding massive refactoring risk.

---

## Next Steps

1. **Review this plan** with development team
2. **Prioritize Phase 1** (text rendering) for immediate implementation
3. **Prototype search** (Phase 2) for user feedback
4. **Implement PNG export** (Phase 3) based on user needs

