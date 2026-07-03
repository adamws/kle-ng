# Plate Generator

The Plate Generator converts a KLE keyboard layout into a mechanical keyboard mounting plate design,
producing switch and stabilizer cutouts positioned to match the layout.
It exports to SVG, DXF, STL, and JSCAD formats for use in manufacturing workflows (laser cutting, CNC machining, 3D printing, etc.).

## Architecture Overview

```
PlateGeneratorPanel.vue            ← Entry point, tabbed 2-column layout
├── PlateGeneratorSettings.vue     ← [Cutouts tab] Switch/stab type, fillet, kerf
├── PlateHolesSettings.vue         ← [Holes tab] Corner mounting holes
├── PlateOutlineSettings.vue       ← [Outline tab] Outline type, margins, fillet
├── Plate3DSettings.vue            ← [3D tab] Plate thickness, backside cut depth, backside features
├── PlateJsonView.vue              ← [JSON tab] CodeMirror JSON editor for direct settings editing
├── PlateGeneratorControls.vue     ← Generate button, auto-refresh toggle
├── PlateGeneratorResults.vue      ← 2D SVG / 3D / JSCAD sub-tab switcher
│   ├── Plate3DPreview.vue         ←   Interactive Three.js WebGL 3D viewer (solid/wireframe)
│   └── PlateJscadPreview.vue      ←   Read-only CodeMirror viewer for the generated JSCAD script
└── PlateDownloadButtons.vue       ← SVG / DXF / STL / JSCAD download

stores/plateGenerator.ts           ← State management (Pinia)
utils/plate/plate-worker.ts        ← Web Worker running buildPlate() off main thread
utils/plate/plate-builder.ts       ← Orchestrates geometry → export
utils/plate/cutout-generator.ts    ← Switch & stabilizer cutout shapes (maker.js)
utils/plate/plate-dimensions.ts    ← Shared stabilizer spacing & dimension constants
utils/plate/plate-settings-validator.ts ← JSON settings validation; returns PlateSettingsJson on success
utils/plate/plate-settings-serializer.ts ← Converts between PlateSettings and PlateSettingsJson (serialize/deserialize)
utils/plate/jscad-cutouts/         ← JSCAD Geom2 / Geom3 geometry modules
│   ├── geom-utils.ts              ←   Geom2 type alias, placeGeom2, extractGeom2Points, ScriptShapeRegistry, formatting helpers
│   ├── switch-cutouts.ts          ←   Switch cutout geometry (rectangle, openable)
│   ├── stabilizer-cutouts.ts      ←   Stabilizer cutout geometry (MX basic/spec, Alps)
│   ├── hole-cutouts.ts            ←   Circular hole geometry
│   ├── backside-features.ts       ←   3D back-face cuts (snap notches, stabilizer clearance pockets)
│   ├── encoder-cutouts.ts         ←   Rotary encoder (EC11) constants + 15×15 backside pocket
│   └── index.ts                   ←   Barrel export
utils/makerjs-loader.ts            ← Lazy-loads maker.js library
utils/three-loader.ts              ← Lazy-loads Three.js + STLLoader + OrbitControls
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
│  • Build backside cuts   │
│    (3D-only Geom3)       │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│  maker.js exports        │
│  → SVG preview (HTML)    │
│  → SVG download (mm)     │
│  → DXF content           │
│  → Merged exports (opt)  │
│  → JSCAD script (opt)    │
│  → STL content (opt)     │
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

| File                         | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PlateGeneratorPanel.vue`    | Root container. Tabbed two-column layout (controls left, preview right). Five tabs: Cutouts, Holes, Outline, 3D, JSON. Because five tabs exceed the fixed-width bar, the tab track is scrollable with prev/next chevron buttons; only three tabs are visible at a time (`VISIBLE_TABS = 3`) and the track scrolls via JS on tab selection. Preloads maker.js and Three.js on mount via `requestIdleCallback`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `PlateJsonView.vue`          | [JSON tab] CodeMirror-based JSON editor (lazy-loaded) showing the current plate settings as formatted JSON. Provides real-time validation as the user types, an **Apply** button (also triggered by Ctrl+Enter) that calls `plateStore.applySettings()`, a **Reset** button that reverts the editor to the canonical store state, a **Download** button that saves the current settings as `plate-settings.json`, and an **Upload** button that loads a JSON file and either applies it immediately (valid) or loads it into the editor dirty for correction (invalid). A drag handle below the editor allows resizing. A status bar shows `In sync`, `Modified`, or `Error` state. The editor rebuilds on theme change (light ↔ dark) via a `MutationObserver`. When the store settings change externally (e.g., a form field is updated), the editor syncs only if it has no uncommitted edits. |
| `PlateGeneratorSettings.vue` | [Cutouts tab] Form controls for cutout type, stabilizer type, the **Handwired rotary encoder mount** checkbox (`rotaryEncoderHandwired`, with a help button opening `RotaryEncoderHelpModal`, below the stabilizer dropdown), fillet radius, size adjustment, custom dimensions, and merge cutouts toggle. Validates inputs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `PlateHolesSettings.vue`     | [Holes tab] Corner mounting holes (require outline) and custom holes at arbitrary positions with configurable diameter and X/Y offsets in keyboard units.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `PlateOutlineSettings.vue`   | [Outline tab] Outline generation settings: outline type dropdown (None / Rectangular / Tight), per-mode margin controls, shared fillet radius, and merge-with-cutouts option. Plate thickness now lives on the 3D tab.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `Plate3DSettings.vue`        | [3D tab] Settings that affect only STL/JSCAD output: plate thickness, shared backside `Cut Depth`, and per-feature backside toggles (currently `Cherry MX Snap Notch`). All inputs are disabled when outline is `none`. The depth max is computed as `max(0, thickness − 1)` and `0` disables every backside cut while still allowing 2D export.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `PlateGeneratorControls.vue` | "Generate Plate" button with loading state, auto-refresh checkbox, error alerts, and empty-layout warnings.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `PlateGeneratorResults.vue`  | Segmented 2D / 3D / JSCAD sub-tab bar above the preview area. 2D renders the SVG preview (with dimmed previous result + spinner during regeneration). 3D hosts `Plate3DPreview`. JSCAD hosts `PlateJscadPreview` and is shown only when `result.jscadScript` is present. Shows idle instructions before first generation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `Plate3DPreview.vue`         | Interactive Three.js WebGL viewer for the generated STL. Lazy-loads Three.js on mount. Renders the plate as a `MeshPhongMaterial` solid; a Solid/Wireframe radio toggle (next to the reset-view button) switches between the solid mesh and an `EdgesGeometry`-based `LineSegments` overlay built with a 10° threshold so coplanar STL triangulation is hidden while structural edges (outline, cutout perimeters, fillet arcs) are preserved. Supports OrbitControls (click-to-activate, click-outside-to-deactivate). Reset view button restores the initial camera. Updates mesh, edge, and background colors when the website theme changes. Pauses the render loop when the 3D tab is hidden, and preserves the user's current camera position and target across regenerations (see [Scene Persistence](#scene-persistence) below).                                                          |
| `PlateJscadPreview.vue`      | Read-only CodeMirror editor displaying the generated JSCAD script. Lazy-loads CodeMirror, rebuilds the editor on theme change, exposes a clipboard-copy button with a 2-second "Copied!" confirmation, and an expand button that opens the script in `JsonExpandModal` (with `readOnly: true`) for full-screen reading. Updates incrementally via `cm.updateContent()` when `props.jscadScript` changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `PlateDownloadButtons.vue`   | SVG, DXF, STL, and JSCAD download buttons, visible only after successful generation. STL and JSCAD buttons appear only when outline is enabled (required for 3D export). Handles separate vs. merged SVG/DXF exports based on settings.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

### Store

**`stores/plateGenerator.ts`** — Pinia store managing all plate generator state.

**State:**

- `settings: PlateSettings` — Current configuration including cutouts, outline, mounting holes, plate thickness, and backside-feature settings (`backsideFeatures: BacksideFeature[]` and shared `backsideDepth: number`).
- `autoRefresh: boolean` — Whether to regenerate on layout changes.
- `generationState: GenerationState` — Status (`idle` | `generating` | `success` | `error`), result, and error message.

The default `backsideFeatures` array contains a single disabled `cherry-mx-snap-notch` entry. `backsideDepth` defaults to `0`, which disables every backside cut (snap notches and stabilizer clearance pockets alike) regardless of feature enable flags.

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
- `downloadStl()` — Downloads the ASCII STL file (`keyboard-plate.stl`). Only available when outline is enabled.
- `downloadJscad()` — Downloads the JSCAD script (`keyboard-plate.jscad`). Only available when outline is enabled.
- `requestRegenerate()` — Clears the cache, marks any in-flight generation as stale (`++generationId`), sets `pendingRegeneration` if generating, then triggers debounced (500ms) regeneration when auto-refresh is on.
- `resetGeneration()` — Returns `generationState` to idle.
- `applySettings(json: PlateSettingsJson)` — Calls `deserializePlateSettings(json, defaultSettings)` and assigns the result to `settings`. Used by `PlateJsonView` after the user applies edited JSON.

**Persistence:**
Settings are saved to `localStorage` under key `kle-ng-plate-settings`, debounced at 500ms on change, using `serializePlateSettings` to write the `PlateSettingsJson` format. On load, the stored value is validated with `validatePlateSettingsJson` and then deserialized with `deserializePlateSettings`; invalid or unrecognized stored JSON is cleared and defaults are used instead.
`autoRefresh` is intentionally not saved. Some settings, such as certain cutout shapes or size adjustments (kerf), can cause slow plate generation; therefore, `autoRefresh` could unexpectedly
cause CPU usage spikes when the website is opened via a shared link.

### Utilities

#### `plate/plate-worker.ts`

Web Worker entry point. Receives `{ keys, options }` messages from the store, calls `buildPlate()`, and posts
back a `PlateWorkerResponse` (either `{ type: 'success', result }` or `{ type: 'error', message }`). Catches
`PlateBuilderError` for user-facing messages and handles maker.js timeout errors separately.

#### `plate/plate-builder.ts`

Main orchestration module. `buildPlate(keys, options)` is the entry point. Called by the Web Worker, not directly by the store.

1. **Filter keys** — Two separate filter functions are applied depending on context. `filterCutoutKeys()` excludes both decal and ghost keys and is used when creating switch and stabilizer cutouts. `filterOutlineKeys()` excludes only decal keys, so ghost keys are retained and contribute to tight outline hull computation without producing any cutouts. Ghost keys have no effect on the rectangular outline (which is derived from cutout bounding-box bounds, not outline positions). The coordinate origin is anchored to the first non-ghost key, so ghost keys do not shift the coordinate system.
2. **Transform coordinates** — Converts KLE layout coordinates to maker.js coordinates (see Coordinate System below).
3. **Create cutouts** — For each key, creates a switch cutout model and optionally a stabilizer model. Per-key `switchRotation` and `stabRotation` are applied on top of the layout rotation.
4. **Merge cutouts** (optional) — When `mergeCutouts` is enabled, combines overlapping cutouts into simplified paths.
5. **Create outline** (optional) — When `outline.enabled` is true, generates a rectangular outline with configurable margins and rounded corners.
6. **Add mounting holes** (optional) — When `mountingHoles.enabled` is true (and outline is enabled), adds circular holes at the four corners.
7. **Build backside cuts** (3D only) — When outline is enabled and `backsideDepth > 0`, builds 3D `Geom3` solids for the back face: stabilizer clearance pockets (always emitted whenever a stab cutout is created) and any enabled `backsideFeatures` (currently the Cherry MX snap notch). These never appear in 2D output.
8. **Build 3D model** (optional) — When outline is enabled, the outline maker.js model is cloned, layer tags stripped, and converted to a JSCAD `Geom2` via `outlineToGeom2()`. Cutouts are paired with their `Geom2` geometry as `JscadNamedGeom` entries — the same objects feed both STL booleans and the script emitter.
9. **Export** — Uses maker.js to produce SVG (preview and download variants) and DXF, and uses `@jscad/modeling` to produce the JSCAD script and ASCII STL.

The preview SVG includes an origin crosshair (red line) and 1mm padding. Outline is rendered in blue (#0066cc). The download SVG uses black strokes and mm units. DXF output uses POLYLINE entities.

**`JscadNamedGeom` interface:**

An internal interface in `plate-builder.ts` that binds three things together: the JSCAD variable name used in the generated script (e.g. `'switch_0'`), the actual `Geom2` object used for boolean operations, and optional script lines to emit for that shape. When `scriptLines` is absent, the script falls back to extracting polygon points from the `Geom2` directly. Using the same `Geom2` for both script and STL output is what guarantees they are always identical.

**`BacksideCut3D` interface:**

A parallel structure used for 3D-only back-face cuts. Like `JscadNamedGeom` it carries a `varName` and `scriptLines`, but the geometry is a `Geom3` (placed cuboid) rather than a `Geom2`. Backside cuts never enter the 2D path: they are subtracted from the extruded plate inside `buildStl()` and emitted under a `// --- Backside features ---` comment block in `buildJscadScript()`.

**Shared shape registry (`ScriptShapeRegistry`):**

Exported from `jscad-cutouts/geom-utils.ts`. When the same primitive expression would otherwise be inlined many times in the generated script (e.g. one `cuboid({ size: [7, 17, 1] })` per Cherry MX key, or identical stabilizer clearance pockets), the cutout builders pass a registry instance and call `getOrCreate(key, hint, expression)`. The registry deduplicates by `key`, returns the variable name (`snap_notch_shape`, `stab_backside_shape`, …) suffixing on collision, and accumulates the `const ... = ...` definitions for `getDefinitionLines()`. `buildJscadScript()` emits these under a `// --- Shared shapes ---` comment, then references them via `translate(...)` / `rotateZ(...)` per instance, producing significantly smaller scripts for large layouts.

**3D Export (JSCAD / STL):**

When outline is enabled, `buildPlate()` produces two additional outputs using `@jscad/modeling` v2 booleans. All cutout geometry is pre-built as `Geom2` objects from the `jscad-cutouts/` modules and wrapped in `JscadNamedGeom` entries, so both outputs are derived from the **same geometry objects**, guaranteeing they are always identical. The plate outline itself is converted from the maker.js tight-outline chain using `outlineToGeom2()`, which calls `makerjs.chain.toKeyPoints` with 0.5mm arc facet precision — this is the one remaining maker.js usage in the JSCAD geometry path.

- **JSCAD script** (`buildJscadScript()`) — Emits an OpenJSCAD v2 script using parametric primitives (`rectangle`, `roundedRectangle`, `circle`, `polygon`, plus `cuboid` + `translate` / `rotateZ` for backside cuts) and boolean operations (`union`, `subtract`, `extrudeLinear`). The import list at the top of the script is built dynamically by scanning the assembled lines so unused primitives and transforms are not pulled in. Can be opened directly in [OpenJSCAD](https://openjscad.xyz/).
- **STL** (`buildStl()`) — Performs `subtract(outline, union(cutouts))` to get the 2D plate, extrudes with `extrudeLinear({ height: thickness })`, and then if any backside `Geom3` cuts are present subtracts them from the extruded solid before serializing to ASCII STL via `@jscad/stl-serializer`. STL generation is wrapped in a try/catch; if it fails, a warning is logged and `stlData` is omitted from the result rather than failing the entire generation.

Both outputs are `undefined` when outline is disabled. The `thickness` option defaults to 1.5mm and is set via the **3D tab** in the UI; `backsideDepth` defaults to `0` (disabled).

**Merge Cutouts:**

The `mergeOverlappingCutouts()` helper function uses the maker.js `combineUnion` API to merge overlapping cutout geometry:

1. Clones the first cutout model as the merge base.
2. Iteratively combines each subsequent model using `makerjs.model.combineUnion()`.
3. After each union operation, collects the resulting paths from both models.
4. Returns a single merged model containing the simplified union of all cutouts.

This is particularly useful when stabilizer cutouts overlap with switch cutouts, as merging produces cleaner paths for manufacturing. Without merging, overlapping shapes may contain internal edges that can cause issues with some CAD/CAM software or laser cutting workflows.

**Outline Generation:**

The `createOutlineModel()` function dispatches to one of two generators based on `outlineType`:

- **Rectangular** (`'rectangular'`): Creates a rectangle encompassing all cutouts plus the four configured directional margins. When `filletRadius > 0`, uses maker.js `RoundRectangle` for rounded corners; when `filletRadius = 0`, uses a standard `Rectangle` for sharp corners.
- **Tight** (`'tight'`): Calls `createTightOutlineModel(makerjs, cutoutPositions, outline.tightMargin)`, which computes an expanded hull around the key cluster. The hull is built by unioning expanded per-key shapes, then a fillet is applied to the result using `makerjs.chain.fillet(chain, outline.filletRadius)` on the chains found via `makerjs.model.findChains(outlineModel)`. Unlike the rectangular path, the fillet clips existing paths in-place and inserts new arc paths into the outline. The minimum allowed `tightMargin` is 0.5mm.

**Corner Mounting Holes:**

The `createCornerMountingHoles()` function adds mounting holes:

- Creates 4 circular holes using maker.js `Ellipse` models.
- Holes are positioned at `edgeDistance` from each corner of the outline.
- Requires outline to be enabled (holes need outline bounds for positioning).

#### `plate/cutout-generator.ts`

Generates individual cutout shapes and handles validation.

**Switch cutout dimensions:**

| Type               | Width (mm)        | Height (mm)  |
| ------------------ | ----------------- | ------------ |
| Cherry MX Basic    | 14.0              | 14.0         |
| Cherry MX Openable | 14.0 + (2 \* 0.8) | 14.0         |
| Alps SKCM/L        | 15.5              | 12.8         |
| Alps SKCP          | 16.0              | 16.0         |
| Kailh Choc CPG1350 | 14.0              | 14.0         |
| Kailh Choc CPG1232 | 13.7              | 12.7         |
| Custom Rectangle   | User-defined      | User-defined |

**Cherry MX Openable:**

The Openable cutout is a 14x14mm base with 4 symmetrical notches on the left and right edges. These notches allow the switch top housing to be opened for maintenance (e.g., spring/stem swap, lubing) without desoldering.

- Notch width: 0.8mm (extends outward from each side edge)
- Notch height: 3.1mm
- Notch center offset: 4.45mm from cutout center (8.9mm between top and bottom notch centers)
- Max fillet radius: 0.4mm (limited by notch width)

**Rotary encoders (`sm === 'rot_ec11'`):**

Keys flagged as rotary encoders (via the **Rotary Encoder** checkbox in `KeyPropertiesPanel`, which sets the per-key `sm` switch-mount property to `'rot_ec11'`) use a fixed, non-configurable EC11 footprint that **overrides** the selected Switch Cutout Type. Regardless of mount style, encoder keys receive **no** stabilizer cutout and **no** Cherry MX snap notch (an EC11 has no MX switch housing to clip or stabilize). Detection uses the same `key.sm === 'rot_ec11'` discriminator as the canvas/PCB renderers.

The cutout **shape** depends on how the encoder is physically mounted, controlled by the single boolean setting `rotaryEncoderHandwired` (exposed as the **Handwired rotary encoder mount** checkbox in the **Cutouts** tab, below the stabilizer dropdown, default `false`):

| Mount style                  | Setting                          | Plate cutout                                                                                               | Backside pocket                                                                    | Why                                                                                                                                                                                                                                                   |
| ---------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PCB build** (default)      | `rotaryEncoderHandwired = false` | Standard **14×14mm** rectangular cutout, cut through the full plate thickness                              | None                                                                               | The EC11 is soldered to the PCB and sits in a normal MX switch position. The plate only needs a standard switch opening; the encoder body lives in the gap between plate and PCB, so no backside clearance is cut.                                    |
| **Handwired build** (no PCB) | `rotaryEncoderHandwired = true`  | Circular **screw-in** cutout, radius `ENCODER_CUTOUT_RADIUS` (kerf-compensated as `radius − sizeAdjust/2`) | **15×15mm** square pocket on the back face (3D/STL only), when `backsideDepth > 0` | The EC11 is fixed to the plate by its threaded bushing and nut. The circular hole passes the bushing; the backside pocket clears the encoder body. This does **not** fit between a plate and a PCB, so it is opt-in for handwired builds with no PCB. |

Why the split matters: when a plate is combined with a PCB, a screw-mounted (circular) encoder does not physically fit — the encoder body would collide with the PCB. PCB builds therefore get a plain 14×14 through-cutout, while the circular screw-in mount is reserved for handwired keyboards that have no PCB.

Implementation notes:

- Both shapes are built inline in `plate-builder.ts`'s per-key loop, branching on `key.sm === 'rot_ec11'` and then on `rotaryEncoderHandwired`.
- **PCB mode** reuses the standard 14×14 `cherry-mx-basic` generator via `positionCutout(..., 'cherry-mx-basic', ...)` (SVG/DXF) and `createRectangleSwitchGeom` / `buildRectangleSwitchScript` with `ENCODER_PCB_CUTOUT_SIZE` (STL/JSCAD). The global Switch Cutout Type is intentionally ignored so the EC11 always gets its MX-compatible 14×14 opening.
- **Handwired mode** uses a maker.js `Ellipse(r, r)` (SVG/DXF) plus the shared `createCircleHoleGeom` / `buildCircleHoleScript` primitives (STL/JSCAD), and `createRotaryEncoderBacksideCut` for the backside pocket.

**Stabilizer types:**

- **MX Basic** — Simple 7mm x 15mm rectangular cutout pair. Unidirectional, matching stabilizer orientation required. Max fillet radius: 3.5mm.
- **MX Bidirectional** — Simple 7mm x 18mm rectangular cutout pair. Supports both stabilizer orientations.
- **MX Tight** — Simple 6.75mm x 14mm rectangular cutout pair, may not fit with third party stabilizers. Max fillet radius: 3.375mm.
- **MX Spec** — Spec-accurate Cherry MX stabilizer with side notches and wire channel geometry. Max fillet radius: 0.4mm.
- **MX Spec Narrow** — Same as MX Spec but with a narrower wire channel, provides more stable switch placement.
- **None** — No stabilizer cutouts.

**Stabilizer spacing by key size:**

| Key Size | Cherry MX Spacing (mm) | Alps Spacing (mm) |
| -------- | ---------------------- | ----------------- |
| 1.75U    | -                      | 12                |
| 2U       | 11.938                 | 14                |
| 2.75     | 11.938                 | 14 (AT101: 20.5)  |
| 3U       | 19.05                  | -                 |
| 6U       | 47.625                 | -                 |
| 6.25U    | 50.0                   | 41.86             |
| 6.5U     | 52.375                 | 45.3              |
| 7U       | 57.15                  | -                 |
| 8U       | 66.675                 | -                 |

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
| -------------- | ------- | ----------------------------------------------------- |
| `mergeCutouts` | `false` | Combine overlapping cutouts into simplified outlines. |

**When to use merge cutouts:**

- Exporting to CAD/CAM software that handles overlapping paths poorly
- Producing cleaner DXF files for CNC machining

**Trade-offs:**

- Merging adds processing time, especially for large layouts
- The merged output loses the distinction between individual cutout types
- Some minor path simplification may occur at intersection points

#### `plate/plate-dimensions.ts`

Single source of truth for stabilizer spacing and pad dimension constants. Previously these values were inlined in `cutout-generator.ts`; they are now exported here and imported by both `cutout-generator.ts` and the `jscad-cutouts/` modules.

- `getCherryMxStabilizerSpacing(keySize)` — Returns the Cherry MX center-to-center stabilizer spacing in mm for the given key size, or `null` if no stabilizer is needed (key size < 2U).
- `getAlpsStabilizerSpacing(keySize, isAt101)` — Returns the Alps stabilizer spacing in mm. The AT101 variant has an additional threshold at 2.75U (20.5mm).
- `getMxBasicStabDimensions(type)` — Returns width, height, and Y-offset for the simple MX pad types (`mx-basic`, `mx-tight`, `mx-bidirectional`).
- `getMxSpecLeftPadVertices(k, spacing, keySize, narrowChannel)` — Returns the 16-point clockwise polygon defining the left MX Spec stabilizer pad, with kerf compensation applied. The right pad is derived by negating X and reversing winding order.
- Exported dimension constants: `MX_BASIC_STAB`, `MX_BIDIRECTIONAL_STAB`, `MX_TIGHT_STAB`, `ALPS_STAB`.

#### `plate/plate-settings-validator.ts`

Consolidates JSON settings validation logic used when importing plate settings from an external JSON file.

- `validatePlateSettingsJson(text)` — Parses the JSON string and validates the structure against the `PlateSettingsJson` shape. Returns a `ValidationResult` that is either `{ valid: true, json: PlateSettingsJson, warnings: string[] }` (with non-fatal unknown-field warnings) or `{ valid: false, error }` for structural errors. Validates known `CutoutType` and `StabilizerType` enum values, required fields (e.g. `outline.outlineType`), numeric field types, and warns on unrecognized keys at all nesting levels. On success, the caller chains to `deserializePlateSettings` to obtain a full `PlateSettings` object.

#### `plate/plate-settings-serializer.ts`

Handles conversion between the internal `PlateSettings` type and the `PlateSettingsJson` format used in the JSON editor and for localStorage persistence.

**`PlateSettingsJson` format** (all top-level sections optional):

- `cutout` — `switchType`, `stabilizerType`, `switchFilletRadius`, `stabilizerFilletRadius` (omitted when stab type is `none`), `kerf`, `merge`, `rotaryEncoderHandwired` (omitted when `false`; `true` selects the circular screw-in EC11 mount), `width`/`height` (only for `custom-rectangle`).
- `holes` — `mounting` key (presence implies `mountingHoles.enabled = true`), `custom` array (presence implies `customHoles.enabled = true`; each entry has `diameter`, `offsetX`, `offsetY` — no internal `id` field). The entire `holes` section is omitted when both mounting and custom holes are disabled.
- `outline` — discriminated union on `outlineType`: `'none'` | `'rectangular'` (with margin/fillet fields) | `'tight'` (with `tightMargin`/fillet).
- `thickness` — top-level number.
- `threed` — always emitted. Contains `backsideDepth: number` (always written so the value is preserved even when no feature is enabled, since stab clearance pockets depend on it), and an optional `backsideFeatures: { type }[]` array listing only the **enabled** features. Mere presence of a feature entry implies `enabled: true`; defaults that are not enabled are omitted.

**`serializePlateSettings(s: PlateSettings): PlateSettingsJson`** — Converts store settings to the JSON format. Omits `stabilizerFilletRadius` when stab type is `none`. Omits the `holes` section entirely when both mounting holes and custom holes are disabled. Custom hole entries strip the internal `id` field. Always emits a `threed` section with the current `backsideDepth`.

**`deserializePlateSettings(json: PlateSettingsJson, defaults: PlateSettings): PlateSettings`** — Applies JSON fields on top of `defaults`. Restores `enabled = true` for the `mountingHoles` and `customHoles` sub-settings when the corresponding key is present in the JSON. Assigns stable index-based IDs (`hole_0`, `hole_1`, …) to deserialized custom holes. For `threed.backsideFeatures`, merges JSON entries over `defaults.backsideFeatures`: any feature present in JSON is enabled; any default feature missing from JSON keeps its default `enabled` value; any new JSON feature type not in defaults is appended (forward compatibility). A legacy migration path also reads a per-feature `depth` from the first feature entry as a fallback when `threed.backsideDepth` is absent.

#### `plate/jscad-cutouts/`

Modules providing `Geom2` geometry objects and corresponding JSCAD script builders for all cutout types. Both the STL and JSCAD script outputs in `plate-builder.ts` consume the same `Geom2` objects from these modules.

- **`geom-utils.ts`** — `Geom2` type alias (re-exported from `@jscad/modeling`), `placeGeom2(geom, x, y, angle)` for positioning geometry, `extractGeom2Points(geom)` for polygon point extraction, formatting helpers (`fmt`, `fmtVec2`, `formatPoints`) used when emitting JSCAD script literals, and the `ScriptShapeRegistry` class for deduplicating shared primitive expressions in the script output.
- **`switch-cutouts.ts`** — `createRectangleSwitchGeom` / `buildRectangleSwitchScript` (handles all rectangle-based switch types including Cherry MX basic, Alps, Choc, and custom), `createCherryMxOpenableGeom` / `buildCherryMxOpenableScript`, and `isRectangleSwitchType` predicate.
- **`stabilizer-cutouts.ts`** — `createStabGeoms` / `buildStabScript` (dispatcher), `createMxBasicStabGeoms` / `buildMxBasicStabScript`, `createMxSpecStabGeoms` / `buildMxSpecStabScript`, `createAlpsStabGeoms` / `buildAlpsStabScript`.
- **`hole-cutouts.ts`** — `createCircleHoleGeom` / `buildCircleHoleScript` for circular mounting and custom holes.
- **`backside-features.ts`** — 3D `Geom3` cuts subtracted from the extruded plate during STL/JSCAD export only. Exposes `createCherryMxSnapNotchCuts` (rectangular snap notch sized `7 × (14 + 2 × 1.5) mm` centered on each switch), `createStabBacksideCut` (stabilizer clearance pocket whose dimensions are derived from the actual stab geometry's measured bounding box plus per-type overhang), the `STAB_BACKSIDE_OVERHANGS` lookup table, and the `BacksideCut3D` / `Geom3` types. Both builders accept an optional `ScriptShapeRegistry` so repeated shapes are emitted once.
- **`encoder-cutouts.ts`** — Rotary encoder (EC11) geometry constants and the handwired backside pocket. Exports `ENCODER_CUTOUT_RADIUS` (handwired circular cutout), `ENCODER_BACKSIDE_SIZE` (15mm handwired pocket), `ENCODER_PCB_CUTOUT_SIZE` (14mm PCB rectangle), plus `createRotaryEncoderBacksideCut` — a 15×15mm centered square backside `Geom3` pocket (same construction as `createCherryMxSnapNotchCuts`, no rotation since it is square). The 2D circular cutout reuses `createCircleHoleGeom` / `buildCircleHoleScript` from `hole-cutouts.ts`; the PCB rectangle reuses the standard switch-cutout primitives.
- **`index.ts`** — Barrel export for all of the above.

#### `makerjs-loader.ts`

Lazy-loads the [maker.js](https://maker.js.org/) library to keep the initial bundle small.

- `preloadMakerJsModule()` — Triggers a background import during browser idle time (`requestIdleCallback`, falls back to `setTimeout(100ms)`). Called on `PlateGeneratorPanel` mount.
- `getMakerJs()` — Returns a cached promise for the module. First call triggers the import with a 30-second timeout.
- `isMakerJsLoaded()` — Synchronous check for whether the module is already cached.

#### `three-loader.ts`

Lazy-loads Three.js and its add-ons to keep the initial bundle small. Follows the same pattern as `makerjs-loader.ts`: singleton module cache, shared in-flight promise, and a 30-second timeout. Clearing the in-flight promise on failure allows the import to be retried.

Exports a `ThreeModules` interface containing `THREE`, `STLLoader`, and `OrbitControls`.

- `preloadThreeModule()` — Triggers a background import during browser idle time (`requestIdleCallback`, falls back to `setTimeout(100ms)`). Called on `PlateGeneratorPanel` mount alongside `preloadMakerJsModule()`.
- `getThree()` — Returns a cached promise for `{ THREE, STLLoader, OrbitControls }`. First call triggers the parallel import of `three`, `three/examples/jsm/loaders/STLLoader.js`, and `three/examples/jsm/controls/OrbitControls.js`.
- `isThreeLoaded()` — Synchronous check for whether the modules are already cached.

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
settings object (cutout type, stabilizer type, fillet radii, size adjust, outline, holes, thickness, backside
features and depth, spacing) -- it does **not** include the layout keys. This means the cache is only valid for
the current layout.

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

The plate outline feature generates a border around all cutouts, useful for defining the plate's outer boundary. Three outline types are available, selected via `OutlineSettings.outlineType`.

### Outline Types

**`none`** — No outline is generated. The plate contains only cutouts. 3D export (STL/JSCAD) is unavailable when no outline is selected.

**`rectangular`** — Generates an axis-aligned bounding box around all cutouts, expanded by four independent directional margins. This is the classic rectangular plate outline.

**`tight`** — Generates an expanded hull that follows the shape of the key cluster rather than a simple bounding box. The hull is computed from key positions (using `filterOutlineKeys()`) and expanded outward by a single uniform `tightMargin`. This produces a closer-fitting outline for non-rectangular layouts (e.g., split or ergonomic boards). Corner rounding via `filletRadius` is applied after the hull union is fully computed. Ghost keys are included in the hull computation, which makes them useful for intentionally extending or reshaping the tight outline — place a ghost key at an edge of the layout to expand the hull in that direction without adding a switch hole.

### Settings

| Setting            | Applies to             | Default         | Description                                                                               |
| ------------------ | ---------------------- | --------------- | ----------------------------------------------------------------------------------------- |
| `enabled`          | all                    | `false`         | Enable outline generation.                                                                |
| `outlineType`      | all                    | `'rectangular'` | Outline shape: `'none'`, `'rectangular'`, or `'tight'`.                                   |
| `marginTop`        | `rectangular`          | `5`             | Distance from topmost cutout to top edge (mm).                                            |
| `marginBottom`     | `rectangular`          | `5`             | Distance from bottommost cutout to bottom edge (mm).                                      |
| `marginLeft`       | `rectangular`          | `5`             | Distance from leftmost cutout to left edge (mm).                                          |
| `marginRight`      | `rectangular`          | `5`             | Distance from rightmost cutout to right edge (mm).                                        |
| `tightMargin`      | `tight`                | `5`             | Uniform margin around the key cluster hull (mm). Minimum: 0.5mm.                          |
| `filletRadius`     | `rectangular`, `tight` | `1`             | Corner radius for rounded outline corners (mm). 0 = sharp. Shared by both non-none modes. |
| `mergeWithCutouts` | all                    | `true`          | When downloading, combine outline and cutouts into one file.                              |

The `thickness` setting lives on the top-level `PlateSettings` (not inside `OutlineSettings`) and, as of `v0.36.0`, is exposed in the **3D tab** alongside the backside-feature controls (it used to live under Outline):

| Setting     | Default | Description                                             |
| ----------- | ------- | ------------------------------------------------------- |
| `thickness` | `1.5`   | Plate thickness in mm used when extruding the 3D model. |

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

| Setting        | Default | Description                                       |
| -------------- | ------- | ------------------------------------------------- |
| `enabled`      | `false` | Enable corner mounting holes.                     |
| `diameter`     | `3`     | Hole diameter (mm). Minimum: 0.5mm.               |
| `edgeDistance` | `3`     | Distance from outline corner to hole center (mm). |

### Dependencies

Mounting holes require the outline to be enabled. The holes are positioned relative to the outline corners, so without an outline there's no reference for hole placement. When outline is disabled, the mounting holes controls are automatically disabled in the UI.

## Custom Holes

The custom holes feature allows placing circular holes at arbitrary positions on the plate.

### Settings

| Setting   | Default | Description                |
| --------- | ------- | -------------------------- |
| `enabled` | `false` | Enable custom holes.       |
| `holes`   | `[]`    | Array of hole definitions. |

Each hole definition has the following properties:

| Property   | Default | Description                                 |
| ---------- | ------- | ------------------------------------------- |
| `diameter` | `3`     | Hole diameter (mm). Minimum: 0.5mm.         |
| `offsetX`  | `0`     | X offset from origin in keyboard units (U). |
| `offsetY`  | `0`     | Y offset from origin in keyboard units (U). |

### Usage

In the Holes tab, use the **Add** button to create new holes. Each hole appears in a scrollable list where you can configure its diameter and position. Use the **Remove All** button to clear all custom holes, or the × button on each row to remove individual holes.

### Coordinate System

Custom hole positions use keyboard units (U) relative to the origin (the center of the first key). Positive X moves right, positive Y moves down (matching KLE coordinates). The position is converted to millimeters using the keyboard's spacing settings (default: 19.05mm per unit).

## Plate Backside Features (3D only)

Backside features are 3D solids subtracted from the back face of the extruded plate during STL/JSCAD generation. They never appear in the 2D SVG/DXF outputs and never affect the cutout / outline / mounting hole geometry. All backside cuts share a single `backsideDepth` value (in mm, measured from the back face upward) so that thin plates can disable the entire feature category at once by setting depth to `0`.

### Settings

| Setting            | Default                                              | Description                                                                                                                                                                                          |
| ------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backsideDepth`    | `0`                                                  | Cut depth in mm from the back face. Applies to **all** backside features and stabilizer clearance pockets. Maximum allowed value in the UI is `max(0, thickness − 1)`. Setting to `0` disables them. |
| `backsideFeatures` | `[{ type: 'cherry-mx-snap-notch', enabled: false }]` | List of feature toggles. Currently only `cherry-mx-snap-notch` exists.                                                                                                                               |

The 3D tab disables both inputs when `outline.outlineType === 'none'`, since backside cuts only make sense in conjunction with STL/JSCAD output.

### Cherry MX Snap Notch

Configured in `jscad-cutouts/backside-features.ts`. A rectangle centered on each switch cutout, dimensioned as:

| Constant              | Value (mm)        | Notes                                          |
| --------------------- | ----------------- | ---------------------------------------------- |
| `SNAP_NOTCH_WIDTH`    | `7`               | Notch width.                                   |
| `MX_CUTOUT_HEIGHT`    | `14`              | Cherry MX switch cutout height.                |
| `SNAP_NOTCH_OVERHANG` | `1.5`             | Overhang past the top/bottom of the cutout.    |
| `SNAP_NOTCH_HEIGHT`   | `MX + 2×overhang` | Computed = `17`. Total span across the switch. |

The notch follows the per-key rotation (layout `rotation_angle`), rather than `switchRotation`, since it tracks the switch body geometry inserted from below. It is only emitted for keys that pass `filterCutoutKeys`.

### Stabilizer Clearance Pockets

When `backsideDepth > 0` and a key has a stabilizer cutout, `createStabBacksideCut()` is called with the **measured bounding box** of the actual stab `Geom2` (`jscadModeling.measurements.measureBoundingBox` of the unioned left + right pads) and a per-type overhang from `STAB_BACKSIDE_OVERHANGS`:

| Stabilizer type    | Left | Right | Top  | Bottom |
| ------------------ | ---- | ----- | ---- | ------ |
| `mx-basic`         | 0    | 0     | 3.5  | 1.75   |
| `mx-tight`         | 0    | 0     | 3.5  | 1.75   |
| `mx-bidirectional` | 0    | 0     | 1.75 | 1.75   |
| `mx-spec`          | 0    | 0     | 1.31 | 3      |
| `mx-spec-narrow`   | 0    | 0     | 1.31 | 3      |
| `alps-aek`         | 0    | 0     | 0    | 0      |
| `alps-at101`       | 0    | 0     | 0    | 0      |

Driving the rectangle off the measured bbox keeps the pocket synchronized with the visible stab cutout when stab geometry is tweaked. Stabilizer clearances are emitted **unconditionally** whenever a stab cutout exists and `backsideDepth > 0` — there is no separate user toggle.

### JSCAD Script Output

In the generated script the cuts appear after the cutout sections under a dedicated comment block, and are subtracted in a final boolean step:

```js
// --- Backside features ---
const snap_notch_shape = translate([0, 0, …], cuboid({ size: [7, 17, …] }))
const stab_backside_shape = translate([…], cuboid({ … }))
const snap_notch_0 = translate([cx0, cy0, 0], snap_notch_shape)
…
// --- Assembly ---
const allCutouts = union(…)
const plate2d = subtract(outline, allCutouts)
const plate3d = extrudeLinear({ height: THICKNESS }, plate2d)
const allBacksideCuts = union(snap_notch_0, …, stab_backside_0, …)
const finalPlate = subtract(plate3d, allBacksideCuts)
```

The `_shape` constants come from `ScriptShapeRegistry` and are emitted once per unique parametric form.

## Coordinate System

The plate builder transforms between two coordinate systems:

| Property | KLE (input)        | Maker.js (output)          |
| -------- | ------------------ | -------------------------- |
| Origin   | Top-left           | First key center           |
| Y axis   | +Y down            | +Y up                      |
| Rotation | Clockwise positive | Counter-clockwise positive |

**Transformation for each key:**

1. Compute center in KLE layout units using `getKeyCenter()`.
2. Use the first non-ghost key's center as the origin reference (ghost keys are skipped here so they do not shift the coordinate system).
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
- **STL** — ASCII STL format. A solid 3D model of the plate (outline extruded by `thickness`, with cutouts subtracted). For use in 3D printing slicers or CAD tools. Only generated when outline is enabled.
- **JSCAD** — OpenJSCAD v2 script that produces the same 3D solid as the STL. Can be opened in [OpenJSCAD](https://openjscad.xyz/) for further editing or customization. Only generated when outline is enabled.

### Export Options

| Export Type | Filename               | Contents                                    |
| ----------- | ---------------------- | ------------------------------------------- |
| Cutouts SVG | `keyboard-plate.svg`   | Switch and stabilizer cutouts only          |
| Cutouts DXF | `keyboard-plate.dxf`   | Switch and stabilizer cutouts only          |
| Outline SVG | `keyboard-outline.svg` | Outline only (when not merged)              |
| Outline DXF | `keyboard-outline.dxf` | Outline only (when not merged)              |
| Merged SVG  | `keyboard-plate.svg`   | Combined cutouts + outline                  |
| Merged DXF  | `keyboard-plate.dxf`   | Combined cutouts + outline                  |
| STL         | `keyboard-plate.stl`   | 3D solid plate (requires outline enabled)   |
| JSCAD       | `keyboard-plate.jscad` | OpenJSCAD script (requires outline enabled) |

Files are created as in-memory blobs and downloaded via a temporary anchor element.

## 3D Preview

When a plate has been generated with outline enabled, a **3D sub-tab** appears in the results pane alongside the existing **2D** sub-tab (and a **JSCAD** sub-tab when `result.jscadScript` is present). The 3D sub-tab hosts the `Plate3DPreview` component, which renders the plate STL in an interactive WebGL viewport using Three.js.

### Scene Setup

- **Renderer:** `THREE.WebGLRenderer` with antialiasing. Created lazily once the container has non-zero dimensions (tracked via `ResizeObserver`). Disposed and recreated whenever the scene has to be rebuilt (see [Scene Persistence](#scene-persistence)).
- **Camera:** `PerspectiveCamera` (45° FOV). Auto-positioned to fit the bounding box of the loaded geometry at `maxDim * 1.5` distance along the Z axis on first load.
- **Lights:** Ambient (0.6 intensity) + directional key light (1.2, position [1, 2, 3]) + fill light (0.3, position [-2, -1, -1]).
- **Mesh:** Plate geometry parsed from ASCII STL with `STLLoader`. Material is `MeshPhongMaterial` colored by the active Bootstrap theme's `--bs-primary` CSS variable, with a specular highlight at 35% brightness.
- **Edges (wireframe view):** A `THREE.LineSegments` built from `new EdgesGeometry(mesh.geometry, 10)` and `LineBasicMaterial`. The 10° threshold angle skips coplanar STL triangulation but keeps real structural edges (plate outline, switch cutout perimeters, fillet arc segments). Created lazily on first switch to wireframe view and toggled via `mesh.visible` / `edgeLines.visible` afterwards.
- **Background:** Set to the container element's resolved `background-color` (read from computed styles, not a CSS variable, to get the actual RGB value).

### View Mode (Solid / Wireframe)

A segmented Solid / Wireframe radio toggle sits in the bottom-right `canvas-controls` group, next to the reset-view button. Selecting **Wireframe** hides the solid mesh and shows the cached `EdgesGeometry` line overlay; selecting **Solid** restores the mesh. The previous implementation used `MeshPhongMaterial.wireframe = true` which exposed every internal STL triangulation edge — `EdgesGeometry` with the 10° threshold was introduced in commit `f3582b4c` to give a clean, structural wireframe.

`applyThemeColors()` updates the line material color alongside the mesh color so wireframe view follows light / dark theme changes too.

### Controls

`OrbitControls` are disabled by default to avoid hijacking page scroll. A "Click to navigate" hint overlay is shown until the user clicks the canvas. Clicking outside the preview container deactivates controls, restoring normal page scroll. The reset view button restores the camera to its initial auto-fitted position and target. View mode and reset all live in the same `.canvas-controls` button group.

### Scene Persistence

`setupScene()` snapshots `camera.position`, `controls.target`, and `controlsActive` **before** disposing the existing scene, then restores them after the new scene has been built. This keeps the user's current navigation when a regeneration produces a new STL — settings tweaks no longer reset the camera back to the auto-fit view, which made it awkward to compare iterations.

The scene is disposed (rather than reused in place) because the underlying STL geometry changes and Three.js does not allow swapping a `BufferGeometry` while the mesh is still attached. The `visible` prop separately gates the render loop:

- **Visible → Visible:** RAF runs, scene rebuilt only when STL data actually changed.
- **Hidden → Visible (scene present):** just resume RAF.
- **Hidden → Visible (no scene because STL changed while hidden):** trigger a full rebuild via `waitForNonZeroSize()`. To keep this branch reliable, the `stlData` watcher proactively calls `disposeScene()` when STL data changes while the tab is hidden — otherwise the next show would resume RAF on a stale scene.

### Theme Adaptation

A `MutationObserver` watches the `data-bs-theme` attribute on `<html>`. When the website theme changes (light ↔ dark), `applyThemeColors()` re-reads the resolved CSS colors on the next animation frame and updates the renderer clear color, mesh `MeshPhongMaterial` (color + specular), and the wireframe edge `LineBasicMaterial`.

### Lifecycle

Three.js modules are preloaded via `preloadThreeModule()` on `PlateGeneratorPanel` mount. The render loop (`requestAnimationFrame`) is paused when the 3D tab is not active (driven by the `visible` prop from `PlateGeneratorResults`) and resumed when it becomes visible again. All Three.js objects (renderer, geometry, material, edge LineSegments, controls, observers) are fully disposed on component unmount via `disposeScene()` → `disposeMesh()`.

## JSCAD Script Preview

`PlateJscadPreview.vue` renders the generated `result.jscadScript` in a read-only CodeMirror editor inside the **JSCAD** sub-tab. CodeMirror is lazy-loaded through `getCodeMirror()` and rebuilt on theme change via a `MutationObserver` on `data-bs-theme`. Subsequent script updates after the editor is ready use `cm.updateContent()` rather than recreating the editor.

The toolbar exposes a copy-to-clipboard button (with a 2-second "Copied!" confirmation) and an expand button. Clicking expand opens the script in `JsonExpandModal` with `readOnly: true` — the same modal used by the JSON settings editor — for full-screen reading. The expand button is positioned absolutely over the bottom-right of the editor with a hover-driven opacity transition so it does not overlap the code while still being discoverable.
