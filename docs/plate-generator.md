# Plate Generator

The Plate Generator converts a KLE keyboard layout into a mechanical keyboard mounting plate design,
producing switch and stabilizer cutouts positioned to match the layout.
It exports to SVG and DXF formats for use in manufacturing workflows (laser cutting, CNC machining, etc.).

## Architecture Overview

```
PlateGeneratorPanel.vue            ← Entry point, tabbed 2-column layout
├── PlateGeneratorSettings.vue     ← [Cutouts tab] Switch/stab type, fillet, kerf
├── PlateHolesSettings.vue         ← [Holes tab] Corner mounting holes
├── PlateOutlineSettings.vue       ← [Outline tab] Outline margins and fillets
├── PlateGeneratorControls.vue     ← Generate button, auto-refresh toggle
├── PlateGeneratorResults.vue      ← SVG preview display
└── PlateDownloadButtons.vue       ← SVG / DXF download

stores/plateGenerator.ts           ← State management (Pinia)
utils/plate/plate-worker.ts        ← Web Worker running buildPlate() off main thread
utils/plate/plate-builder.ts       ← Orchestrates geometry → export
utils/plate/cutout-generator.ts    ← Switch & stabilizer cutout shapes
utils/makerjs-loader.ts            ← Lazy-loads maker.js library
utils/keyboard-geometry.ts         ← Key center position math
utils/decimal-math.ts              ← Precision decimal arithmetic
types/plate.ts                     ← Type definitions
```

## Data Flow

```
┌──────────────────────────┐
│  User changes settings   │
│  or clicks "Generate"    │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│  plateGeneratorStore     │
│  .generatePlate()        │
│  1. Check cache (hit?) ───────► Instant result, skip worker
│  2. Check in-flight?   ───────► Set pendingRegeneration, return
│  Status: generating      │
└────────────┬─────────────┘
             │ postMessage (keys, options)
             ▼
┌──────────────────────────┐    ┌───────────────────────────┐
│  plate-worker.ts         │◄───│  keyboardStore            │
│  (Web Worker thread)     │    │  (keys, spacing metadata) │
│  calls buildPlate()      │    └───────────────────────────┘
│  plate-builder.ts        │
└────────────┬─────────────┘
             │ (worker thread)
             ▼
┌──────────────────────────┐
│  For each valid key:     │
│  1. Compute position     │
│  2. Create switch cutout │
│  3. Create stab cutout   │
│  4. Apply transforms     │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│  Optional features:      │
│  • Merge cutouts         │
│  • Generate outline      │
│  • Add mounting holes    │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│  maker.js exports        │
│  → SVG preview (HTML)    │
│  → SVG download (mm)     │
│  → DXF content           │
│  → Merged exports (opt)  │
└────────────┬─────────────┘
             │ postMessage (result)
             ▼
┌────────────────────────────┐
│  Store onmessage handler   │
│  1. Check generationId     │
│     (stale? discard)       │
│  2. Cache result           │
│  3. Status: success        │
│  4. If pendingRegeneration │
│     → re-enter generate    │
└────────────────────────────┘
```

### Auto-Refresh

When auto-refresh is enabled, the keyboard store calls `plateGeneratorStore.requestRegenerate()` whenever the layout
changes (key edits, undo, redo). This is debounced at 500ms and only fires when settings pass validation.

**Settings watcher:** A separate settings watcher (debounced at 300ms) calls `generatePlate()` whenever plate
settings change, provided the current status is `'success'` or `'generating'`. When called during `'generating'`
status, `generatePlate()` handles deferral internally via the `pendingRegeneration` flag rather than queueing
redundant work.

**Layout change handling:** `requestRegenerate()` clears the settings cache immediately (because cached results
are for the old layout). If generation is currently in-flight, it increments `generationId` to mark the in-flight
result as stale and sets `pendingRegeneration` so regeneration proceeds after the worker finishes. The debounced
500ms regeneration still fires as a backup path.

## File Reference

### Components

| File                         | Purpose                                                                                                                                                             |
|------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `PlateGeneratorPanel.vue`    | Root container. Tabbed two-column layout (controls left, preview right). Three tabs: Cutouts, Holes, Outline. Preloads maker.js on mount via `requestIdleCallback`. |
| `PlateGeneratorSettings.vue` | [Cutouts tab] Form controls for cutout type, stabilizer type, fillet radius, size adjustment, custom dimensions, and merge cutouts toggle. Validates inputs.        |
| `PlateHolesSettings.vue`     | [Holes tab] Corner mounting holes (require outline) and custom holes at arbitrary positions with configurable diameter and X/Y offsets in keyboard units.           |
| `PlateOutlineSettings.vue`   | [Outline tab] Outline mode selector (None/Rectangle/Custom), rectangle margins and fillet, custom outline segment editor, and merge-with-cutouts option.            |
| `PlateGeneratorControls.vue` | "Generate Plate" button with loading state, auto-refresh checkbox, error alerts, and empty-layout warnings.                                                         |
| `PlateGeneratorResults.vue`  | Renders the SVG preview on success, or idle instructions before first generation. During regeneration, shows the previous result dimmed with a spinner overlay. Shows both cutouts and outline layers. |
| `PlateDownloadButtons.vue`   | SVG and DXF download buttons, visible only after successful generation. Handles separate vs. merged exports based on settings.                                      |

### Store

**`stores/plateGenerator.ts`** — Pinia store managing all plate generator state.

**State:**
- `settings: PlateSettings` — Current configuration including cutouts, outline, and mounting holes settings.
- `autoRefresh: boolean` — Whether to regenerate on layout changes.
- `generationState: GenerationState` — Status (`idle` | `generating` | `success` | `error`), result, and error message.

Note: the `GenerationStatus` type definition still includes `'loading'` for backward compatibility, but the store never sets it. Components that check for `'loading'` do so defensively.

**Internal state (not exposed):**
- `worker: Worker | null` — Persistent Web Worker instance, created lazily on first `generatePlate()` call.
- `generationId: number` — Counter used to detect and discard stale worker responses. Incremented on cache hits and layout changes.
- `cache: Map<string, PlateGenerationResult>` — Cache of generated results keyed by JSON-stringified settings (not layout). Cleared on layout change.
- `pendingRegeneration: boolean` — Flag indicating that `generatePlate()` was called while a generation was already in-flight. Checked on worker completion to trigger a follow-up generation.

**Actions:**
- `generatePlate()` — Serializes current keys and settings, checks the cache, and dispatches work to a Web Worker. On cache hit, returns the cached result instantly and increments `generationId` to invalidate any in-flight worker response. On cache miss during an in-flight generation, sets `pendingRegeneration` and returns without queueing redundant work. On worker completion, caches the result and checks `pendingRegeneration` to re-enter if needed.
- `downloadSvg()` / `downloadDxf()` — Download cutouts only (`keyboard-plate.svg` / `keyboard-plate.dxf`).
- `downloadAllSvg()` — Downloads all SVG files. When `outline.mergeWithCutouts` is enabled, downloads a single merged file; otherwise downloads separate cutouts and outline files.
- `downloadAllDxf()` — Downloads all DXF files. Same merge logic as `downloadAllSvg()`.
- `requestRegenerate()` — Clears the cache, marks any in-flight generation as stale (`++generationId`), sets `pendingRegeneration` if generating, then triggers debounced (500ms) regeneration when auto-refresh is on.
- `resetGeneration()` — Returns `generationState` to idle.

**Persistence:**
Settings are saved to `localStorage` under key `kle-ng-plate-settings`, debounced at 500ms on change. The store performs deep merging when loading settings and handles migration from older data structures.
`autoRefresh` is intentionally not saved. Some settings, such as certain cutout shapes or size adjustments (kerf), can cause slow plate generation; therefore, `autoRefresh` could unexpectedly
cause CPU usage spikes when the website is opened via a shared link.

### Utilities

#### `plate/plate-worker.ts`

Web Worker entry point. Receives `{ keys, options }` messages from the store, calls `buildPlate()`, and posts
back a `PlateWorkerResponse` (either `{ type: 'success', result }` or `{ type: 'error', message }`). Catches
`PlateBuilderError` for user-facing messages and handles maker.js timeout errors separately.

#### `plate/plate-builder.ts`

Main orchestration module. `buildPlate(keys, options)` is the entry point. Called by the Web Worker, not directly by the store.

1. **Filter keys** — Excludes decal and ghost keys, sorts by position.
2. **Transform coordinates** — Converts KLE layout coordinates to maker.js coordinates (see Coordinate System below).
3. **Create cutouts** — For each key, creates a switch cutout model and optionally a stabilizer model. Per-key `switchRotation` and `stabRotation` are applied on top of the layout rotation.
4. **Merge cutouts** (optional) — When `mergeCutouts` is enabled, combines overlapping cutouts into simplified paths.
5. **Create outline** (optional) — When `outline.type` is `'rectangle'`, generates a rectangular outline with configurable margins and rounded corners. When `'custom'`, builds a closed polygon from user-defined segments using `createCustomOutlineModel()`.
6. **Add mounting holes** (optional) — When `mountingHoles.enabled` is true (and outline is enabled), adds circular holes at the four corners.
7. **Export** — Uses maker.js to produce SVG (preview and download variants) and DXF output.

The preview SVG includes an origin crosshair (red line) and 1mm padding. Outline is rendered in blue (#0066cc). The download SVG uses black strokes and mm units. DXF output uses POLYLINE entities.

**Merge Cutouts:**

The `mergeOverlappingCutouts()` helper function uses the maker.js `combineUnion` API to merge overlapping cutout geometry:

1. Clones the first cutout model as the merge base.
2. Iteratively combines each subsequent model using `makerjs.model.combineUnion()`.
3. After each union operation, collects the resulting paths from both models.
4. Returns a single merged model containing the simplified union of all cutouts.

This is particularly useful when stabilizer cutouts overlap with switch cutouts, as merging produces cleaner paths for manufacturing. Without merging, overlapping shapes may contain internal edges that can cause issues with some CAD/CAM software or laser cutting workflows.

**Outline Generation:**

The `createOutlineModel()` function generates the plate outline:

- Creates a rectangle encompassing all cutouts plus configured margins.
- When `filletRadius > 0`, uses maker.js `RoundRectangle` for rounded corners.
- When `filletRadius = 0`, uses a standard `Rectangle` for sharp corners.

**Corner Mounting Holes:**

The `createCornerMountingHoles()` function adds mounting holes:

- Creates 4 circular holes using maker.js `Ellipse` models.
- Holes are positioned at `edgeDistance` from each corner of the outline.
- Requires outline to be enabled (holes need outline bounds for positioning).

#### `plate/cutout-generator.ts`

Generates individual cutout shapes and handles validation.

**Switch cutout dimensions:**

| Type               | Width (mm)       | Height (mm)  |
|--------------------|------------------|--------------|
| Cherry MX Basic    | 14.0             | 14.0         |
| Cherry MX Openable | 14.0 + (2 * 0.8) | 14.0         |
| Alps SKCM/L        | 15.5             | 12.8         |
| Alps SKCP          | 16.0             | 16.0         |
| Kailh Choc CPG1350 | 14.0             | 14.0         |
| Kailh Choc CPG1232 | 13.7             | 12.7         |
| Custom Rectangle   | User-defined     | User-defined |

**Cherry MX Openable:**

The Openable cutout is a 14x14mm base with 4 symmetrical notches on the left and right edges. These notches allow the switch top housing to be opened for maintenance (e.g., spring/stem swap, lubing) without desoldering.

- Notch width: 0.8mm (extends outward from each side edge)
- Notch height: 3.1mm
- Notch center offset: 4.45mm from cutout center (8.9mm between top and bottom notch centers)
- Max fillet radius: 0.4mm (limited by notch width)

**Stabilizer types:**

- **MX Basic** — Simple 7mm x 15mm rectangular cutout pair. Unidirectional, matching stabilizer orientation required. Max fillet radius: 3.5mm.
- **MX Bidirectional** — Simple 7mm x 18mm rectangular cutout pair. Supports both stabilizer orientations.
- **MX Tight** — Simple 6.75mm x 14mm rectangular cutout pair, may not fit with third party stabilizers. Max fillet radius: 3.375mm.
- **MX Spec** — Spec-accurate Cherry MX stabilizer with side notches and wire channel geometry. Max fillet radius: 0.4mm.
- **MX Spec Narrow** — Same as MX Spec but with a narrower wire channel, provides more stable switch placement.
- **None** — No stabilizer cutouts.

**Stabilizer spacing by key size:**

| Key Size | Cherry MX Spacing (mm) | Alps Spacing (mm)    |
|----------|------------------------|----------------------|
| 1.75U    | -                      | 12                   |
| 2U       | 11.938                 | 14                   |
| 2.75     | 11.938                 | 14 (AT101: 20.5)     |
| 3U       | 19.05                  | -                    |
| 6U       | 47.625                 | -                    |
| 6.25U    | 50.0                   | 41.86                |
| 6.5U     | 52.375                 | 45.3                 |
| 7U       | 57.15                  | -                    |
| 8U       | 66.675                 | -                    |

For vertical keys (height > width), the stabilizer pair is rotated -90 degrees.

**Per-key rotation overrides (`switchRotation` / `stabRotation`):**

Each key can carry optional `switchRotation` and `stabRotation` properties (set in the Manufacturing section of
`KeyPropertiesPanel`). These rotate the switch cutout or stabilizer cutout independently around the key center,
on top of the layout rotation (`rotation_angle`). Values use KLE convention (clockwise positive, in 90° increments)
and are negated internally for maker.js (counter-clockwise positive).

- **`switchRotation`** — Applied inside `positionCutout()`. Combined with the layout rotation into a single rotation
  before the cutout is moved to its final position: `totalRotation = -(rotation_angle) - switchRotation`.
- **`stabRotation`** — Applied in `buildPlate()` when positioning the stabilizer model. Combined the same way:
  `totalStabRotation = -(rotation_angle) - stabRotation`.

**Validation functions:**
- `validateFilletRadius()` — Ensures radius does not exceed `min(width, height) / 2`.
- `validateStabilizerFilletRadius()` — Checks against the per-type maximum.
- `validateCustomCutoutDimension()` — Validates custom width/height are between 0 and 50mm.

**Size adjustment (kerf compensation):**
The `sizeAdjust` value represents the total kerf width — the full width of material removed by the cutting tool.
Each side of the cutout shrinks by half the kerf: `effectiveSize = originalSize - sizeAdjust`.
For example, a 14mm cutout with `sizeAdjust = 0.5` is drawn at 13.5mm (0.25mm removed per side);
the cutting tool then removes 0.25mm on each side, producing a 14mm hole.
Positive values shrink cutouts (compensating for kerf in laser cutting), negative values expand them.

**Merge Cutouts setting:**
When `mergeCutouts` is enabled in `PlateSettings`, overlapping cutout shapes are combined into unified paths using boolean union operations.

| Setting        | Default | Description                                           |
|----------------|---------|-------------------------------------------------------|
| `mergeCutouts` | `false` | Combine overlapping cutouts into simplified outlines. |

**When to use merge cutouts:**
- Exporting to CAD/CAM software that handles overlapping paths poorly
- Producing cleaner DXF files for CNC machining

**Trade-offs:**
- Merging adds processing time, especially for large layouts
- The merged output loses the distinction between individual cutout types
- Some minor path simplification may occur at intersection points

#### `makerjs-loader.ts`

Lazy-loads the [maker.js](https://maker.js.org/) library to keep the initial bundle small.

- `preloadMakerJsModule()` — Triggers a background import during browser idle time (`requestIdleCallback`, falls back to `setTimeout(100ms)`). Called on `PlateGeneratorPanel` mount.
- `getMakerJs()` — Returns a cached promise for the module. First call triggers the import with a 30-second timeout.
- `isMakerJsLoaded()` — Synchronous check for whether the module is already cached.

#### `keyboard-geometry.ts`

- `getKeyCenter(key)` — Computes the center point of a key in layout units, accounting for rotation origin (`rotation_x`, `rotation_y`).
- `getKeyDistance(key1, key2)` — Euclidean distance between two key centers.

#### `decimal-math.ts`

Exported as `D`. Wraps arithmetic operations in a `Decimal` library to avoid floating-point errors in position and dimension calculations. Provides `add`, `sub`, `mul`, `div`, `rotatePoint`, `mirrorPoint`, trigonometric functions, and formatting.

## Worker, Cache & Deferred Regeneration

### Web Worker

Plate generation runs off the main thread in a Web Worker (`utils/plate/plate-worker.ts`). The worker calls
`buildPlate()` with the provided keys and options, then posts back either a success response containing the
`PlateGenerationResult` or an error response with a message string.

- **Lazy creation:** The worker is instantiated on the first call to `generatePlate()`, not on store creation or panel mount.
- **Reused across generations:** The same worker instance handles all subsequent generations. It is never terminated between runs.
- **Serialization:** Keys and options are serialized via `JSON.parse(JSON.stringify(...))` before `postMessage` to strip Vue Proxy wrappers that `structuredClone` (used internally by `postMessage`) cannot handle.

The worker imports `buildPlate` and `PlateBuilderError` from `plate-builder.ts`. It catches `PlateBuilderError` for user-facing messages and surfaces timeout errors from the maker.js loader separately.

### Cache

A `Map<string, PlateGenerationResult>` caches previously generated results. The cache key is the JSON-stringified
settings object (cutout type, stabilizer type, fillet radii, size adjust, outline, holes, spacing) -- it does **not**
include the layout keys. This means the cache is only valid for the current layout.

- **Cache hit:** Returns instantly. Increments `generationId` to invalidate any in-flight worker response, since the
  result is already available.
- **Cache miss:** Proceeds to dispatch work to the Web Worker.
- **Invalidation:** The entire cache is cleared by `requestRegenerate()` whenever the layout changes. Since the cache
  key does not include layout data, all entries become stale on layout change.

### Deferred Regeneration

When `generatePlate()` is called while a generation is already in-flight (status is `'generating'` and the call
is a cache miss), it sets the `pendingRegeneration` flag and returns immediately instead of posting a second
message to the worker. Multiple mid-flight calls collapse into a single deferred generation.

On worker completion (`onmessage` or `onerror`), the store checks `pendingRegeneration`. If set, it clears the
flag and calls `generatePlate()` again, which will pick up the latest reactive settings and keys.

This also applies to stale responses: when a worker response arrives with an outdated `generationId` (because a
cache hit or layout change incremented the counter), the response is not cached or displayed, but
`pendingRegeneration` is still checked. This ensures that a deferred layout-change regeneration can proceed even
when the in-flight result was marked stale.

### Stale Response Filtering

The `generationId` counter prevents stale worker responses from overwriting current state.

- **Incremented** in two places:
  - In `generatePlate()` when a cache hit occurs (the cached result is already applied, so any in-flight worker response for the same settings is redundant).
  - In `requestRegenerate()` when the layout changes during an in-flight generation (the in-flight result is for the old layout).
- **Checked** in the `onmessage` and `onerror` handlers: if `currentId !== generationId`, the response is discarded (not cached, not displayed). The handler still checks `pendingRegeneration` to allow deferred regeneration to proceed.

### Previous Result Preservation

When a new generation starts (cache miss, no in-flight work), the store preserves the previous `generationState.result`
while setting the status to `'generating'`. The `PlateGeneratorResults` component uses this to show the previous SVG
preview while the new result is being computed.

## Plate Outline

The plate outline feature generates a border around all cutouts, useful for defining the plate's outer boundary.
Three modes are available: **None** (no outline), **Rectangle** (axis-aligned rectangle with margins and fillet),
and **Custom** (arbitrary closed polygon defined by segments).

### Settings

| Setting             | Default  | Description                                                           |
|---------------------|----------|-----------------------------------------------------------------------|
| `type`              | `'none'` | Outline mode: `'none'`, `'rectangle'`, or `'custom'`.                 |
| `marginTop`         | `5`      | Distance from topmost cutout to top edge (mm). Rectangle mode only.   |
| `marginBottom`      | `5`      | Distance from bottommost cutout to bottom edge (mm). Rectangle only.  |
| `marginLeft`        | `5`      | Distance from leftmost cutout to left edge (mm). Rectangle mode only. |
| `marginRight`       | `5`      | Distance from rightmost cutout to right edge (mm). Rectangle only.    |
| `filletRadius`      | `1`      | Corner radius for rounded outline corners (mm). Rectangle mode only.  |
| `mergeWithCutouts`  | `true`   | When downloading, combine outline and cutouts into one file.          |
| `custom`            | —        | Custom outline definition (see below). Custom mode only.              |

**Persistence / Migration:** Settings are loaded from `localStorage`. When loading older saved settings that
have `outline.enabled: boolean` (without `type`), the store automatically migrates: `enabled: true` → `type: 'rectangle'`,
`enabled: false` → `type: 'none'`. The legacy `enabled` property is then deleted.

### Custom Outline

The `custom` field contains:

| Field      | Default | Description                                         |
|------------|---------|-----------------------------------------------------|
| `segments` | `[]`    | Ordered list of corner points defining the polygon. |

Each corner (`OutlineSegment`) has:

| Property | Description                                              |
|----------|----------------------------------------------------------|
| `id`     | Unique identifier (used for Vue reactivity).             |
| `x`      | X position in keyboard units (U). +X right.             |
| `y`      | Y position in keyboard units (U). +Y down (KLE convention). |

**Coordinate system:**
- Origin: center of the first key.
- Positions in keyboard units (U), converted to mm via `spacingX` / `spacingY`.
- +X right, +Y down (KLE convention).

**Auto-close:** The last corner connects back to the first automatically (maker.js `ConnectTheDots`).

**Validation:** Custom mode requires at least 2 corners. Checked by `hasSettingsErrors()` in the store
(prevents auto-refresh errors) and `validateCustomOutline()` in the plate builder
(throws a user-facing `PlateBuilderError`).

**Mounting holes with custom outline:** Corner mounting holes are positioned at each corner of the
custom outline's bounding box, offset inward by `edgeDistance`.

### Merge With Cutouts

When `mergeWithCutouts` is enabled:
- `downloadAllSvg()` and `downloadAllDxf()` produce a single file containing both the outline and cutouts.
- The merged export simplifies the workflow for manufacturing.

When disabled:
- Downloads produce separate files for cutouts and outline.
- Useful when outline and cutouts need different processing (e.g., different cutting speeds).

## Corner Mounting Holes

The mounting holes feature adds circular holes at the four corners of the plate for screw mounting.

### Settings

| Setting        | Default | Description                                         |
|----------------|---------|-----------------------------------------------------|
| `enabled`      | `false` | Enable corner mounting holes.                       |
| `diameter`     | `3`     | Hole diameter (mm). Minimum: 0.5mm.                 |
| `edgeDistance` | `3`     | Distance from outline corner to hole center (mm).   |

### Dependencies

Mounting holes require the outline to be set to Rectangle or Custom mode. The holes are positioned relative to the outline corners, so without an outline there's no reference for hole placement. When outline mode is None, the mounting holes controls are automatically disabled in the UI.

## Custom Holes

The custom holes feature allows placing circular holes at arbitrary positions on the plate.

### Settings

| Setting    | Default | Description                                              |
|------------|---------|----------------------------------------------------------|
| `enabled`  | `false` | Enable custom holes.                                     |
| `holes`    | `[]`    | Array of hole definitions.                               |

Each hole definition has the following properties:

| Property   | Default | Description                                              |
|------------|---------|----------------------------------------------------------|
| `diameter` | `3`     | Hole diameter (mm). Minimum: 0.5mm.                      |
| `offsetX`  | `0`     | X offset from origin in keyboard units (U).              |
| `offsetY`  | `0`     | Y offset from origin in keyboard units (U).              |

### Usage

In the Holes tab, use the **Add** button to create new holes. Each hole appears in a scrollable list where you can configure its diameter and position. Use the **Remove All** button to clear all custom holes, or the × button on each row to remove individual holes.

### Coordinate System

Custom hole positions use keyboard units (U) relative to the origin (the center of the first key). Positive X moves right, positive Y moves down (matching KLE coordinates). The position is converted to millimeters using the keyboard's spacing settings (default: 19.05mm per unit).

## Coordinate System

The plate builder transforms between two coordinate systems:

| Property | KLE (input)        | Maker.js (output)          |
|----------|--------------------|----------------------------|
| Origin   | Top-left           | First key center           |
| Y axis   | +Y down            | +Y up                      |
| Rotation | Clockwise positive | Counter-clockwise positive |

**Transformation for each key:**
1. Compute center in KLE layout units using `getKeyCenter()`.
2. Use the first valid key's center as the origin reference.
3. X position: `(key.centerX - origin.centerX) * spacingX`
4. Y position: `(origin.centerY - key.centerY) * spacingY` (inverted)
5. Rotation angle: negated from KLE value. Per-key `switchRotation` and `stabRotation` are also negated and added to the layout rotation.

Default spacing is 19.05mm on both axes, overridden by keyboard metadata (`spacing_x`, `spacing_y`) when present.

## Integration with Keyboard Store

The plate generator depends on `stores/keyboard.ts` for:

- **Keys array** — The set of keys in the current layout, used as input to `buildPlate()`.
- **Metadata** — `spacing_x` and `spacing_y` values for unit-to-mm conversion.
- **Change notifications** — The keyboard store calls `plateGeneratorStore.requestRegenerate()` after `saveState()`, `undo()`, and `redo()` to trigger auto-refresh.

The `PlateGeneratorControls` component also checks `keyboardStore.keys.length` to warn about empty layouts and disable the generate button.

## Exports

### Export Formats

- **SVG** — Vector format with millimeter units. Suitable for direct use in laser cutting software or vector editors.
- **DXF** — CAD exchange format using POLYLINE entities. Compatible with most CAD/CAM software.

### Export Options

| Export Type        | Filename                    | Contents                           |
|--------------------|-----------------------------|------------------------------------|
| Cutouts SVG        | `keyboard-plate.svg`        | Switch and stabilizer cutouts only |
| Cutouts DXF        | `keyboard-plate.dxf`        | Switch and stabilizer cutouts only |
| Outline SVG        | `keyboard-outline.svg`      | Outline only (when not merged)     |
| Outline DXF        | `keyboard-outline.dxf`      | Outline only (when not merged)     |
| Merged SVG         | `keyboard-plate.svg`        | Combined cutouts + outline         |
| Merged DXF         | `keyboard-plate.dxf`        | Combined cutouts + outline         |

Files are created as in-memory blobs and downloaded via a temporary anchor element.
