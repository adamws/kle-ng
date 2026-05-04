# Annotation Algorithm Researcher — Task Prompt

## Your job

You are improving the automatic matrix-coordinate annotation algorithm in the `kle-ng` keyboard layout editor. The algorithm assigns `(row, col)` integers to each key so firmware like QMK knows the switch matrix wiring. A benchmarking harness already exists. Your loop is:

1. Study the current algorithm's failures
2. Design and implement a candidate algorithm
3. Run the harness — compare scores against the `current` baseline
4. Iterate until the candidate beats `current` on the failure layouts without regressing on the passing ones

---

## The problem

The current algorithm assigns coordinates by rounding each key's visual center to the nearest integer:

```
row = Math.round(center.y)
col = Math.round(center.x)
```

This works well for rectangular and mildly staggered layouts. It fails for **column-splay / heavy-rotation ergonomic layouts** because two keys whose rounded centers collide to the same `(row, col)` point get deduplicated — one key is silently dropped and left unassigned.

### Known failing layouts (current algorithm leaves keys unassigned)

Add the corresponding KLE JSON files to `bench/fixtures/` and these will automatically appear in bench runs:

| Fixture name | Unassigned keys | Notes |
|---|---|---|
| `ortho-4-12-qmk` | 1 | likely an off-by-half collision |
| `kinesis-advantage` | 4 | thumb cluster, curved key well |
| `absolem` | 4 | heavy column splay |
| `moergo` | 2 | column splay + per-column offsets |

Any candidate algorithm must pass all failing layouts without regressing on the passing ones.

---

## Repository layout (relevant paths only)

```
src/
  stores/keyboard.ts                  — Key type definition
  utils/
    keyboard-geometry.ts              — getKeyCenter(key), getKeyDistance(key1, key2)
    matrix-utils.ts                   — splitLayoutByRotation, deRotateLayoutGroups, restoreOriginalRotation
    matrix-validation.ts              — parseOptionChoice, validateMatrixDuplicates
    matrix-annotation/
      types.ts                        — AnnotationAlgorithm, AnnotationResult, RowColAssignment
      current.ts                      — current production algorithm (pure, side-effect-free)
      identity.ts                     — stub algorithm (col=0 always; shows harness multi-algo path)
      index.ts                        — algorithm registry (algorithms[] array)
      build-matrix.ts                 — computeRowsAndCols, buildRowsColsFromResult

bench/
  run.ts                              — CLI entry point (npm run bench)
  run.mjs                             — jiti wrapper (do not edit)
  corpus.ts                           — layout fixture loader (scans bench/fixtures/*.json)
  scoring.ts                          — scoreResult, calculateWireLength, computeAggregate
  reporters/
    html.ts                           — single-page HTML report with inline SVGs
    svg.ts                            — per-(layout, algorithm) SVG visualization
    table.ts                          — terminal table
    json.ts                           — JSON dump
  fixtures/                           — DROP KLE-FORMAT JSON FILES HERE
    issue-51-splay.json               — (placeholder — replace with real layout)
    issue-65-dropped-keys.json        — (placeholder — replace with real layout)
    <any-name>.json                   — automatically picked up on next bench run
```

---

## The `AnnotationAlgorithm` interface

Every candidate algorithm implements this interface from `src/utils/matrix-annotation/types.ts`:

```ts
export interface AnnotationAlgorithm {
  name: string          // short identifier, used in bench output and filenames
  description: string   // one-sentence summary
  annotate(keys: ReadonlyArray<Key>): AnnotationResult
}

export interface AnnotationResult {
  /** Index-aligned with input keys. null = ghost or decal (excluded from matrix). */
  assignments: (RowColAssignment | null)[]
  status: 'success' | 'partial' | 'disqualified'
  warnings: AnnotationWarning[]
  meta?: Record<string, unknown>
}

export interface RowColAssignment {
  row: number | null   // null means this key was not assigned
  col: number | null
}
```

**Contracts you must honour:**

- `assignments.length === keys.length` always — index-aligned with the input array
- Ghost keys (`key.ghost === true`) and decal keys (`key.decal === true`) must get `null`, never a row/col pair
- Never mutate input keys — clone with `structuredClone(keys as Key[])` at the top of `annotate()` if you need to modify positions
- Row and column indices must be **0-based and dense**: re-index them so they form a contiguous range `0, 1, 2, …, N-1`. Gaps are counted as waste in scoring.
- `status: 'success'` means every regular (non-ghost, non-decal) key has a non-null `(row, col)`. `status: 'partial'` means at least one regular key is unassigned.

---

## How to add a candidate algorithm

**Step 1** — create `src/utils/matrix-annotation/my-algo.ts`:

```ts
import type { Key } from '@/stores/keyboard'
import type { AnnotationAlgorithm, AnnotationResult } from './types'

export const myAlgo: AnnotationAlgorithm = {
  name: 'my-algo',
  description: '...',
  annotate(keys: ReadonlyArray<Key>): AnnotationResult {
    // ... your implementation ...
  },
}
```

**Step 2** — register it in `src/utils/matrix-annotation/index.ts`:

```ts
import { myAlgo } from './my-algo'

export const algorithms: AnnotationAlgorithm[] = [
  currentAnnotationAlgorithm,
  myAlgo,                       // ← add here
  identityAnnotationAlgorithm,
]
```

That is the only file you need to touch to plug in. The harness discovers all registered algorithms automatically.

---

## Useful utilities already available

```ts
// keyboard-geometry.ts
getKeyCenter(key: Key): { x: number; y: number }
// Returns the visual center in keyboard units, correctly accounting for
// rotation_angle / rotation_x / rotation_y.

getKeyDistance(key1: Key, key2: Key): number
// Euclidean distance between centers of two keys, in keyboard units.

// matrix-utils.ts
splitLayoutByRotation(keys: Key[]): RotationGroup[]
// Groups keys by (rotation_angle, rotation_x, rotation_y).
// Each group has: rotationAngle, rotationX, rotationY, keys: Key[]

deRotateLayoutGroups(groups: RotationGroup[]): Key[]
// Rotates each group's keys back to 0° around their shared origin,
// MUTATING the key objects (use on clones only). Returns the flat list.

restoreOriginalRotation(keys: Key[]): void
// Reverses deRotateLayoutGroups — reads the stored angle from key.labels[6]
// and re-applies it.

// matrix-validation.ts
parseOptionChoice(key: Key): { option: number; choice: number } | null
// Parses key.labels[8] as "option,choice". Returns null if not set.
// Keys with choice !== 0 are non-default layout variants — typically excluded.
```

---

## Running the benchmark

```bash
# All algorithms, all layouts, terminal table output (stdout) + progress (stderr)
npm run bench

# Generate the HTML report for visual inspection in a browser
npm run bench -- --html bench-report.html

# Focus on just the failing layouts
npm run bench -- --layout ortho-4-12-qmk,kinesis-advantage,absolem,moergo --html report.html

# Run only your candidate vs. current (skip identity stub)
npm run bench -- --algorithm current,my-algo --html report.html

# All options
npm run bench -- --help
```

The HTML report shows every layout with each algorithm side-by-side. Each key is drawn as a rectangle with its assigned `(row, col)` label. Row wires are colored by row index; column wires by column index. A FAIL badge means the algorithm left at least one regular key unassigned.

---

## Scoring criteria and what "winning" means

### (a) Connectivity gate — hard requirement

A result is **disqualified** if any regular key (not ghost, not decal, not a non-default layout variant) has `row === null` or `col === null`. Disqualified results receive `Infinity` on all numeric metrics and are excluded from the win tallies.

**Your algorithm must produce 0 unassigned keys on all layouts to be competitive.**

### (b) Matrix compactness — primary metric

After assignment, count unique row indices (`numRows`) and unique column indices (`numCols`).

- **`matrixMax = max(numRows, numCols)`** — primary. Lower is better. A 6×6 (max=6) beats a 12×1 (max=12).
- **`matrixSum = numRows + numCols`** — tiebreaker.

Physically: a compact matrix means shorter row/column traces on the PCB and fewer microcontroller pins.

### (c) Wire length — secondary metric

Sum of Euclidean distances between consecutive keys within each row (sorted by center X) and within each column (sorted by center Y). Lower is better.

### Aggregate rankings

The bench reports three views:

- **Pareto wins**: per layout, which algorithm wins each criterion. Count wins across all layouts.
- **Borda count**: per layout rank algorithms 1..K on combined `(matrixMax, matrixSum, wireLength)`; sum ranks. Higher is better.
- **Weighted score**: normalize metrics per layout, `0.5 × matrixMax_norm + 0.5 × wireLength_norm`. Lower is better.

A candidate beats `current` if it has more Pareto wins on both compactness and wire-length, a better Borda count, and a lower weighted score — while being disqualified on 0 layouts (vs. `current`'s 4 failures).

---

## Understanding the current algorithm's failure mode

Read `src/utils/matrix-annotation/current.ts` in full. The core issue:

```ts
const row = Math.round(center.y)
const col = Math.round(center.x)
```

For a column-splay layout, multiple keys that are visually in different matrix columns may have centers that round to the same integer pair. The algorithm detects these collisions, warns about duplicates, and keeps only the first key at each position — the others are left unassigned.

The rotation-aware path (de-rotating each rotation group before rounding) helps for layouts like the Atreus (mild splay), but fails when:
1. Keys within the same rotation group are still too close after de-rotation
2. Keys from different rotation groups collide in the de-rotated space

The fundamental limitation is that `Math.round` is a lossy quantization step that discards sub-unit spatial information.

---

## Research directions to consider

These are starting points, not prescriptions. Pick the one that seems most promising after inspecting the failing layouts in the HTML report.

**1. Clustering-based row/column detection**

Instead of rounding to nearest integer, cluster key centers along each axis using a 1D algorithm (e.g., k-means, gap detection, or hierarchical single-linkage). Cluster centers define rows; cluster membership defines the assignment. Works well when rows have clear spatial separation but don't land on integer boundaries.

**2. Per-rotation-group independent assignment**

Run the assignment separately inside each rotation group (after de-rotating), then merge results using a shared global row/column namespace. Two groups that share actual PCB rows need to be re-unified after per-group assignment. The key insight: keys in different rotation groups that belong to the same physical row will, after de-rotation, have similar Y coordinates in their respective group-local frames — use that as the clustering signal.

**3. Graph / topology approach**

Build a proximity graph: connect each key to its nearest neighbours (spatially). Cluster the graph into rows by finding connected components along the X axis, then assign column indices by rank within each row. Robust to irregular spacing but more complex to implement.

**4. Sweep-line with tolerance bands**

Sort all keys by center Y. Walk the sorted list; start a new row whenever the Y gap exceeds a threshold (e.g., 0.4u). Within each row, sort by X and assign column indices by rank. The threshold is the key parameter — it may need to adapt to the layout's key pitch.

**5. Hybrid: clustering for rows, rank for columns**

Use clustering to identify rows (more robust than rounding), then within each detected row sort keys left-to-right and assign `col = 0, 1, 2, …`. This avoids column collisions by construction — every key gets a unique column within its row — but may produce a larger column count than the current algorithm for layouts where multiple columns truly share a physical matrix column.

---

## Regression safety

The unit tests in `src/utils/matrix-annotation/__tests__/regression-snapshot.spec.ts` capture a snapshot of the **current** algorithm's output on all 14 preset layouts. They are specifically for the `current` algorithm — they will not fail if your new algorithm produces different output, because your algorithm is a separate export.

Run the full test suite after adding your algorithm to make sure you haven't accidentally broken anything:

```bash
npm run test:unit
npm run type-check
```

Both must pass before considering a candidate ready.

---

## Definition of done

A candidate algorithm is ready for promotion to the production code path when:

1. `npm run test:unit` passes with 0 failures
2. `npm run type-check` passes with 0 errors
3. `npm run bench` shows the candidate algorithm:
   - Qualified (0 unassigned keys) on **all 15 corpus layouts** (4 more than `current`)
   - `matrixMax` no worse than `current` on layouts where `current` is already qualified
   - Wire length no worse than 10% above `current` on any layout where both qualify
4. The HTML report (`--html`) shows visually plausible wire routing on the formerly-failing layouts — rows are spatially coherent horizontal bands, columns are vertical bands, no obvious misassignments visible in the SVG
5. A manual smoke-test in the running app (`npm run dev`, open a preset, trigger automatic annotation from the Matrix Coordinates modal) produces correct-looking results

When these are met, update `src/utils/matrix-annotation/index.ts` to place the new algorithm **before** `currentAnnotationAlgorithm` in the `algorithms` array, then update `MatrixCoordinatesModal.vue` to import and use the new algorithm instead of `currentAnnotationAlgorithm`.
