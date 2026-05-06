# Matrix / Layout Annotation

This document describes the matrix annotation feature in the keyboard layout
editor. It covers the automatic annotation algorithm, the rotation-aware
annotation path, duplicate detection, manual drawing, modal states, and how
coordinates are applied to keys.

**Relevant source files:**

| File                                              | Role                                                                                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/MatrixCoordinatesModal.vue`       | Modal UI, automatic annotation orchestration                                                                                     |
| `src/utils/matrix-annotation/types.ts`            | Interfaces: `AnnotationAlgorithm`, `AnnotationResult`, `AnnotationWarning`, `AssignmentStatus`, `MatrixItem`, `RowColAssignment` |
| `src/utils/matrix-annotation/cluster.ts`          | Base cluster algorithm — rounds centers, shifts collisions, selects world vs de-rotated variant                                  |
| `src/utils/matrix-annotation/cluster-symmetry.ts` | Symmetry-aware wrapper: detects mirror symmetry and enforces it on cluster output                                                |
| `src/utils/matrix-annotation/build-matrix.ts`     | `buildRowsColsFromResult()` — converts `AnnotationResult` to `MatrixItem[]` with live key references                             |
| `src/utils/matrix-annotation/index.ts`            | Barrel export                                                                                                                    |
| `src/utils/matrix-utils.ts`                       | Rotation grouping, de-rotation, label parsing                                                                                    |
| `src/utils/matrix-validation.ts`                  | Coordinate parsing, duplicate validation, option/choice                                                                          |
| `src/stores/matrix-drawing.ts`                    | Drawing store (sequences, completed wires, editing)                                                                              |
| `src/utils/keyboard-geometry.ts`                  | `getKeyCenter` -- rotation-aware center calculation                                                                              |
| `src/utils/line-intersection.ts`                  | `findKeysAlongLine` -- line sweep for manual drawing                                                                             |
| `src/components/MatrixAnnotationOverlay.vue`      | Canvas overlay that renders wires and handles input                                                                              |

---

## Table of Contents

1. [Background -- VIA Matrix Coordinates](#1-background----via-matrix-coordinates)
2. [Modal States and Flows](#2-modal-states-and-flows)
3. [Automatic Annotation Algorithm](#3-automatic-annotation-algorithm)
4. [Rotation-Aware Annotation](#4-rotation-aware-annotation)
5. [Duplicate Detection and Resolution](#5-duplicate-detection-and-resolution)
6. [Manual Drawing](#6-manual-drawing)
7. [Applying Coordinates to Keys](#7-applying-coordinates-to-keys)
8. [Canvas Overlay Rendering](#8-canvas-overlay-rendering)

---

## 1. Background -- VIA Matrix Coordinates

Mechanical keyboards use a switch matrix to read key presses. Each physical key
is connected to one row wire and one column wire. Pressing a key closes the
circuit between its row and column, allowing the controller to detect which key
was pressed.

The [VIA configurator](https://www.caniusevia.com/docs/layouts) expects every
key in a layout definition to carry a `"row,col"` annotation in label position
0 (top-left). The matrix annotation feature provides two ways to assign these
coordinates: an automatic algorithm based on key geometry, and a manual drawing
tool.

Label format examples:

```
"0,0"   -- row 0, column 0  (complete)
"2,5"   -- row 2, column 5  (complete)
"1,"    -- row 1, column not yet assigned (partial)
",3"    -- row not assigned, column 3 (partial)
```

Ghost keys (`key.ghost === true`) and decal keys (`key.decal === true`) are
excluded from annotation throughout the system. They represent cosmetic
elements that do not participate in the electrical matrix.

---

## 2. Modal States and Flows

The modal (`MatrixCoordinatesModal.vue`) uses a two-step state machine:

```
                         +---------+
       modal opens ----->| warning |
                         +---------+
                              |
          +-------------------+-------------------+
          |                   |                   |
    "OK (clear all)"    "Continue"           "Cancel"
          |            (partial only)             |
    clear labels,           |              close modal
    go to draw         go to draw
          |            with existing
          v            annotations
       +------+              |
       | draw |<-------------+
       +------+
```

### The Five Open Scenarios

When the modal opens, it inspects the current layout state and picks one of
five paths. The decision tree lives in the visibility watcher inside
`MatrixCoordinatesModal.vue`.

| #   | Condition                                          | Behavior                                                                                          |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | Fully annotated **with** invalid duplicates        | Show overlay preview, stay on `warning` step. User sees a yellow alert about duplicate positions. |
| 2   | Fully annotated, no invalid duplicates             | Show overlay preview, skip directly to `draw` step (editing existing annotations).                |
| 3   | No labels at all (blank layout)                    | Skip directly to `draw` step.                                                                     |
| 4   | Partially annotated (mix of VIA labels and blanks) | Stay on `warning` step, show "Continue" and "Start over" buttons.                                 |
| 5   | Non-matrix labels present                          | Stay on `warning` step with only "OK (clear all labels)" available.                               |

"Fully annotated" means `keyboardStore.isViaAnnotated` is `true` -- every
regular key has a label matching the pattern `/^\d+,\d+$/` in position 0.

"Invalid duplicates" means two or more keys share the same `row,col` position
without carrying `option,choice` values in label position 8 (bottom-right).
This check uses `validateMatrixDuplicates` from `matrix-validation.ts`.

### Warning Step Actions

- **OK (clear all labels)**: Calls `createEmptyLabels()` on every regular key,
  then transitions to `draw`.
- **Continue**: Calls `extractMatrixAssignmentsWithPartial` to parse the
  existing labels, loads them into both the modal state and the drawing store
  via `loadExistingAssignments`, then transitions to `draw`.
- **Start over**: Same as "OK" -- clears everything first.
- **Cancel**: Closes modal, no changes.

---

## 3. Automatic Annotation Algorithm

The "Annotate Automatically" button triggers `handleAutomaticAnnotation()`.
The implementation delegates entirely to `clusterSymmetryAnnotationAlgorithm`
from `src/utils/matrix-annotation/`, which is a two-pass pipeline: a cluster
pass (`cluster.ts`) followed by a symmetry-enforcement pass
(`cluster-symmetry.ts`).

### 3.1 Entry Point and `toRaw` Requirement

```ts
const handleAutomaticAnnotation = () => {
  const rawKeys = keyboardStore.keys.map((k) => toRaw(k))
  const result = clusterSymmetryAnnotationAlgorithm.annotate(rawKeys)
  const { rows: newRows, cols: newCols } = buildRowsColsFromResult(result, keyboardStore.keys)
  rows.value = newRows
  cols.value = newCols
  // ... load into drawing store ...
  applyCoordinatesToKeys()
  keyboardStore.saveState()
}
```

`toRaw(k)` strips the Vue reactive `Proxy` wrapper before passing keys to the
algorithm. This is required because `structuredClone` (used inside `cluster.ts`
to snapshot keys before mutation) cannot clone Proxy objects and throws
otherwise. `buildRowsColsFromResult` receives the original reactive
`keyboardStore.keys` array so the `MatrixItem.keySequence` arrays hold live
references for the drawing store. `keyboardStore.saveState()` is called
unconditionally after every automatic annotation.

### 3.2 Cluster Pass (`cluster.ts`)

The cluster algorithm is exposed as `clusterAnnotationAlgorithm` and called
internally by the symmetry wrapper.

**Center calculation.** For each regular key (non-ghost, non-decal),
`getKeyCenter` (in `keyboard-geometry.ts`) computes the key's center in layout
coordinate space. For an unrotated 1u key at `(x, y)` the center is
`(x + 0.5, y + 0.5)`. For rotated keys the function applies the full 2D
rotation transform around `(rotation_x, rotation_y)`:

```
centerX = key.x + key.width / 2
centerY = key.y + key.height / 2

relX = centerX - originX
relY = centerY - originY

rotatedX = relX * cos(angle) - relY * sin(angle)
rotatedY = relX * sin(angle) + relY * cos(angle)

finalX = originX + rotatedX
finalY = originY + rotatedY
```

**Rounding and per-row collision shifting.** `Math.round(center.y)` gives the
tentative row, `Math.round(center.x)` the tentative column. Keys in the same
tentative row are sorted by their tentative column (ties broken by world X).
Each key is assigned its tentative column if it is free; if the slot is already
taken, the key is shifted to the next free column (`while (used.has(c)) c++`).
No key is ever dropped. The algorithm records the number of shifts as
`collisions` and emits a warning when nonzero.

After shifting, `denseReindex` re-maps both row and column values to
`0, 1, 2, ...` based on sorted order, so sparse integer ranges (e.g., rows
0, 1, 3) become contiguous (0, 1, 2).

**World vs de-rotated variant selection.** The cluster pass evaluates two
variants:

- **Variant A** (world): operates on key centers as-is.
- **Variant B** (de-rotated): only considered when at least one rotation group
  has `|angle| > 1e-6` and `≥ 2 keys`. The keys are `structuredClone`d, then
  `deRotateLayoutGroups` zeroes out `rotation_angle` on each group. The clone
  is annotated with world centers now computed in the "de-rotated" space.

Each variant is scored by the tuple `(matrixMax, matrixSum, wireLength)` where
`matrixMax = max(numRows, numCols)`, `matrixSum = numRows + numCols`, and
`wireLength` is the sum of consecutive Euclidean gaps within each row (sorted
by world X) and each column (sorted by world Y). Lower is better at every
level; `matrixMax` dominates, `matrixSum` breaks ties, `wireLength` breaks
remaining ties. The better variant's assignments are written into the
`AnnotationResult`.

**Staggered layout example:**

```
Physical layout (1u keys):       Center positions:     Rounded:

+---+---+---+---+                (0.5,0.5) (1.5,0.5)  row=1,col=1  row=1,col=2 ...
| Q | W | E | R |
+---+---+---+---+
  +---+---+---+---+              (0.75,1.5) (1.75,1.5)  row=2,col=1  row=2,col=2 ...
  | A | S | D | F |
  +---+---+---+---+

(Stagger shifts x by 0.25u but rounding absorbs it; no collisions)
```

### 3.3 Symmetry Pass (`cluster-symmetry.ts`)

`clusterSymmetryAnnotationAlgorithm` wraps the cluster pass with a
left-right mirror-symmetry detection and enforcement step.

**Symmetry detection** (`detectSymmetry`). The bounding-box midline of all
regular-key centers is used as the candidate symmetry axis. For every regular
key the algorithm attempts to find a mirror twin:

- A key is "on the axis" (self-paired) if `|2*axis - cx - cx| < 0.05u`. A
  self-paired key must have `|rotation_angle| ≤ 0.5°`, otherwise the layout
  is rejected as asymmetric.
- Otherwise the expected mirror position is `(2*axis - cx, cy)`. A twin is
  accepted if `|twin.x - mirrorX| ≤ 0.05u`, `|twin.y - cy| ≤ 0.05u`, and
  the rotations satisfy `|rj + ri| ≤ 0.5°` (mirror keys should have equal
  and opposite angles).

If any regular key has no valid twin, `detectSymmetry` returns `null` and the
layout is not considered symmetric. Partial symmetry is not accepted.

**Symmetry enforcement** (`enforceSymmetry`). When symmetry is detected, every
right-side key in each pair is overwritten:

```
rows[rightIdx] = rows[leftIdx]
cols[rightIdx] = totalCols - 1 - cols[leftIdx]
```

After rewriting, `densify` re-maps row and column values to `0, 1, 2, ...`
because the overwrite may introduce gaps. Center keys (those on the axis) are
validated first: their column must already satisfy `col == totalCols - 1 - col`
(i.e., `totalCols` is odd and the key sits on the middle column). If a center
key fails this check, enforcement returns `null` and the algorithm falls back
to the cluster output.

**Fallback conditions.** The symmetry pass falls back to returning the cluster
output unchanged when:

| `meta.symmetryFallbackReason` | Cause                                                                  |
| ----------------------------- | ---------------------------------------------------------------------- |
| `'base-not-success'`          | Cluster pass did not return `status: 'success'`                        |
| `'no-regular-keys'`           | No regular keys with assigned row/col in cluster result                |
| `'unpaired-key'`              | `detectSymmetry` returned `null` (at least one key has no mirror twin) |
| `'center-conflict'`           | `enforceSymmetry` returned `null` (center key not on symmetry column)  |

When fallback occurs, `meta.symmetry` is set to `'fallback'`. When enforcement
succeeds, `meta.symmetry` is `'enforced'` and `meta.symmetryAxis`,
`meta.symmetryPairs`, and `meta.symmetryCenterKeys` are populated.

### 3.4 Result Structure and Drawing Store Bridge

`AnnotationResult` is defined in `types.ts`:

```ts
interface AnnotationResult {
  assignments: (RowColAssignment | null)[] // index-aligned with input keys
  status: AssignmentStatus // 'success' | 'partial' | 'disqualified'
  warnings: AnnotationWarning[]
  meta?: Record<string, unknown>
}

interface RowColAssignment {
  row: number | null
  col: number | null
}
```

`assignments` has the same length as the input key array. Ghost and decal
keys receive `null`; regular keys receive a `RowColAssignment` object.

`buildRowsColsFromResult` (in `build-matrix.ts`) converts `AnnotationResult`
into the `MatrixItem[]` arrays expected by the modal and drawing store. It
iterates `result.assignments`, groups the original reactive key references
(passed separately) into `rowMap` and `colMap` by row/column number, sorts
each group (rows by `key.x`, columns by `key.y`), and builds `MatrixItem`
objects with stable `id` strings and sequential `index` values:

```ts
const { rows, cols } = buildRowsColsFromResult(result, keyboardStore.keys)
```

The live key references are necessary because the drawing store's
`completedRows` and `completedColumns` maps hold `Key[]` arrays that the
overlay canvas renders and that `applyCoordinatesToKeys` reads back.

---

## 4. Rotation-Aware Annotation

Many keyboard layouts include rotated key clusters (e.g., thumb clusters on
ergonomic boards). When keys are rotated, their world-coordinate centers shift
in ways that can cause `Math.round(center.y)` to map different keys to the same
row even though they are on different logical rows within the cluster.

Rotation awareness is handled entirely inside `cluster.ts`. There is no
temporary mutation of `keyboardStore.keys` and no two-step if/else in the
modal.

### 4.1 Detection

Before evaluating variant B, the cluster algorithm calls
`shouldUseRotationAware(regularClones)` on the clone set. This function calls
`splitLayoutByRotation` and returns `true` when any resulting group has
`|rotationAngle| > 1e-6` **and** at least two keys. If no such group exists,
only variant A is evaluated and the de-rotation code path is skipped entirely.

### 4.2 De-Rotation for Variant B

When rotation awareness is triggered, a second `structuredClone` of the key
array is created (separate from the variant-A clone). `splitLayoutByRotation`
groups the clone's regular keys, and `deRotateLayoutGroups` zeroes out
`rotation_angle` on each group with a non-zero angle. The clone is never
written back to the store; it exists only for the duration of the scoring
comparison.

With rotation zeroed, `getKeyCenter` computes centers in the key's "local"
coordinate frame, putting keys within the same cluster onto aligned Y values
that round to the same row index. This typically produces a more compact
`(matrixMax, matrixSum)` score than world centers when a cluster is rotated
relative to the main key field.

### 4.3 Variant Selection and Score

Both variants go through `annotateVariant`, which performs the same rounding,
collision-shifting, and dense-reindexing steps. The score tuple
`(matrixMax, matrixSum, wireLength)` is compared lexicographically; variant B
replaces variant A only if it is strictly better. In practice, layouts without
rotation always produce identical variants, so variant A is chosen by default
and the result carries `meta.variant = 'world'` vs `meta.variant = 'de-rotated'`.

---

## 5. Duplicate Detection and Resolution

### 5.1 What the Cluster Algorithm Does with Collisions

In the cluster pass, two keys produce a tentative collision when
`Math.round(center.y)` and `Math.round(center.x)` yield the same values for
both. Common causes include:

- Keys very close together (e.g., ISO Enter spanning ~2 positions).
- Rotated clusters where world-coordinate Y values round identically.
- Unusual stagger values that align centers to the same integer.

Unlike the previous implementation, **no key is dropped**. The
`annotateVariant` function sorts keys in the same row by their tentative column
(ties broken by world X), then shifts any colliding key rightward to the next
free column slot. The shift count is recorded as `variant.collisions`. When
`collisions > 0`, the algorithm emits an `AnnotationWarning` of kind
`'algorithm-specific'` describing how many collisions were resolved.

### 5.2 Duplicate Warning Path

The old `checkForDuplicates` + `showDuplicateWarning` flow that inspected the
`matrixMap` no longer applies to regular key geometry. The duplicate warning
path now flows through `result.meta?.displayDuplicates`:

```ts
const displayDuplicates = result.meta?.displayDuplicates as
  | { position: string; keys: Key[] }[]
  | undefined
if (displayDuplicates) {
  showDuplicateWarning(displayDuplicates)
}
```

`displayDuplicates` is only populated in rare cases where the rotation-aware
fallback itself found genuine duplicates — primarily from VIA option/choice
imports that produce keys with identical positions before any option
differentiation is applied. For normal key geometry, the collision-shifting
guarantees `displayDuplicates` is absent and no warning is shown.

### 5.3 During Manual Drawing (`canAddKeyToSequence`)

The drawing store prevents duplicates proactively. Before a key is added to
the current sequence, `canAddKeyToSequence` checks:

1. If drawing a **row** and the candidate key already has a column assignment,
   it computes what the new row index would be (either the continuing row
   index or the next free row number) and checks whether any existing key
   already occupies `(newRow, existingCol)`.

2. If drawing a **column** and the candidate key already has a row assignment,
   the same check is done for `(existingRow, newCol)`.

3. It also checks against other keys in the **current sequence** (which will
   all receive the same row or column index when the sequence completes).

If any check fails, the key is rejected and the overlay shows it with a red
circle and X marker.

### 5.4 VIA Option/Choice (Valid Duplicates)

Per the VIA spec, keys **may** share a matrix position when they represent
layout variants (e.g., split Backspace vs. 2u Backspace). These keys must
carry `option,choice` values in label position 8 (bottom-right), parsed by
`parseOptionChoice` in `matrix-validation.ts`.

`validateMatrixDuplicates` distinguishes between:

- **Invalid duplicates**: Multiple keys at the same position where at least
  one lacks an `option,choice` label.
- **Valid layout options**: Multiple keys at the same position where all
  carry `option,choice` labels.

The overlay only renders wires for "default layout" keys (those with
`choice === 0` or no option/choice at all), filtering via `getKeyChoice`.

---

## 6. Manual Drawing

### 6.1 Drawing Store (`matrix-drawing.ts`)

The Pinia store manages all drawing state:

| State                   | Type                                    | Purpose                                          |
| ----------------------- | --------------------------------------- | ------------------------------------------------ |
| `drawingType`           | `'row' \| 'column' \| 'remove' \| null` | Current editing mode                             |
| `currentSequence`       | `Key[]`                                 | Keys being drawn in the active (incomplete) wire |
| `completedRows`         | `Map<number, Key[]>`                    | Finished row wires, keyed by row number          |
| `completedColumns`      | `Map<number, Key[]>`                    | Finished column wires, keyed by column number    |
| `continuingRowIndex`    | `number \| null`                        | When extending an existing row                   |
| `continuingColumnIndex` | `number \| null`                        | When extending an existing column                |
| `insertAfterIndex`      | `number \| null`                        | T-junction insertion point                       |

### 6.2 Drawing Flow

Manual drawing follows a two-click interaction model:

```
1. User left-clicks a key (first click)
   -> Key added to currentSequence
   -> If clicked on an existing wire segment/node, set up continuation state

2. User moves mouse
   -> Overlay computes preview: findKeysAlongLine from last key to cursor
   -> Legal keys shown as gray dashed preview
   -> Illegal keys shown as red dashed preview with X markers

3. User left-clicks another key (second click)
   -> findKeysAlongLine sweeps the line between the two clicked keys
   -> All legal intermediate keys are auto-collected
   -> Sequence is completed (completeSequence)
   -> Wire appears as solid blue (row) or green (column) line
```

**Cancel drawing**: Right-click or Escape clears the current sequence.

### 6.3 Line Sweep (`findKeysAlongLine`)

When the user draws a line between two keys, `findKeysAlongLine` (in
`line-intersection.ts`) determines which intermediate keys the line passes
through.

For each candidate key, `lineIntersectsKey` computes the perpendicular
distance from the key's center to the line segment:

```
               line
    A --------*----------- B
               \
                \  perpendicular distance
                 \
                  * key center

    If distance <= threshold, key is "along the line"
```

The threshold is derived from the key's dimensions and modulated by a
`sensitivity` parameter (0.0 = most permissive, 1.0 = strictest; default
0.3 in the store). For non-rotated keys the threshold considers the key
dimension perpendicular to the line direction. For rotated keys a conservative
diagonal-based radius is used.

Keys beyond the segment endpoints receive special treatment: the algorithm
checks whether the endpoint falls within the key's bounding box rather than
using the distance threshold, preventing wide keys past the ends from being
incorrectly collected.

Results are sorted by distance from the start point so they appear in
traversal order.

### 6.4 Row and Column Number Assignment

New wires receive the next free index. `findNextFreeRowNumber` /
`findNextFreeColumnNumber` search from 0 upward to find the first unused
number, filling gaps left by deletions.

### 6.5 Continuing and Extending Wires (T-Junctions)

Clicking on an existing wire's node or segment starts a "continuation":

- `continuingRowIndex` / `continuingColumnIndex` is set to the wire's index.
- `insertAfterIndex` and `insertionAnchorKey` record the clicked position.
- When the sequence completes, new keys are **merged** into the existing wire.

The merge uses `findOptimalInsertion`, which evaluates four candidate
orderings and picks the one with the lowest total path cost (sum of Euclidean
distances between consecutive keys):

```
Given existing wire:  [A] --- [B] --- [C]
Insert point: after B
New keys: [X, Y]

Candidates:
  1. forward-after:   [A, B, X, Y, C]
  2. forward-before:  [A, X, Y, B, C]
  3. reversed-after:  [A, B, Y, X, C]
  4. reversed-before: [A, Y, X, B, C]

Winner: minimum total Euclidean path cost
Tie-break: prefer forward-after > forward-before > reversed-after > reversed-before
```

### 6.6 Remove Mode

The drawing mode toggle includes a "Remove" option. In this mode:

| Action               | Ctrl held? | Result                                                      |
| -------------------- | ---------- | ----------------------------------------------------------- |
| Click node           | No         | Remove that single key from its row or column               |
| Click node (overlap) | No         | Remove key from both its row and column                     |
| Click segment        | No         | Split the wire at that segment boundary (creates two wires) |
| Click segment        | Yes        | Remove the entire wire                                      |

Segment splitting uses `splitRowAtSegment` / `splitColumnAtSegment` in the
drawing store. These functions:

1. Divide the key array at the segment boundary.
2. Keep the first portion under the original wire number.
3. Create a new wire with the next free number for the second portion.
4. Update key labels to reflect the new wire numbers.

### 6.7 Renumbering

Users can change a row or column number by hovering over its wire and typing
digits, then pressing Enter.

- `renumberRow(old, new)` and `renumberColumn(old, new)` handle the swap.
- If the target number is already in use, the two wires are **swapped**
  (neither is lost).
- Key labels are updated immediately via `updateKeyLabel`.

---

## 7. Applying Coordinates to Keys

`applyCoordinatesToKeys()` is called after any change to the row/column
assignments. It builds two lookup maps (`keyToRow`, `keyToCol`) from the
modal's `rows` and `cols` arrays, then iterates every regular key:

```
for each key (excluding ghost/decal):
    rowIndex = keyToRow.get(key)
    colIndex = keyToCol.get(key)

    if both defined:  key.labels[0] = "row,col"
    if row only:      key.labels[0] = "row,"
    if col only:      key.labels[0] = ",col"
    if neither:       key.labels[0] = ""
```

This is called:

- Immediately after automatic annotation completes.
- On every drawing store change (via watcher, unless `skipNextSync` is set).
- When the annotation is detected as complete.

### Sync Watcher

A Vue `watch` on the drawing store's completed rows/columns triggers
`syncDrawingsToModal` followed by `applyCoordinatesToKeys`:

```
watch([completedRows.size, completedColumns.size, totalKeysInRows, totalKeysInColumns])
  -> syncDrawingsToModal()      // convert store Maps to modal's MatrixItem[]
  -> applyCoordinatesToKeys()   // write labels to keys
```

The `skipNextSync` flag prevents re-application after context menu removals,
where the removal handler has already updated labels directly.

---

## 8. Canvas Overlay Rendering

`MatrixAnnotationOverlay.vue` renders a `<canvas>` element layered on top of
the keyboard canvas. It draws:

| Element                 | Color                   | Style                                     |
| ----------------------- | ----------------------- | ----------------------------------------- |
| Completed row wires     | Blue (#007bff)          | Solid line, filled circles at nodes       |
| Completed column wires  | Green (#28a745)         | Solid line, filled circles at nodes       |
| Active drawing sequence | Orange/yellow (#ffc107) | Thicker solid line                        |
| Preview (legal keys)    | Gray (50% opacity)      | Dashed line, semi-transparent circles     |
| Preview (illegal keys)  | Red (80% opacity)       | Dashed line, circles with X marks         |
| Hovered wire            | Blue or Green           | Thicker line (4px vs 2px), larger circles |
| Hovered node            | Yellow (#ffc107)        | Semi-transparent highlight circle         |

All rendering uses the same coordinate transform as the main keyboard canvas
(zoom + pan offset), so wires align exactly with keys.

Only "default layout" keys (no `option,choice` or `choice === 0`) have their
wires rendered. Alternative layout option keys are stored in the wire arrays
but filtered out during rendering.

---

## Architecture Diagram

```
+---------------------------+
| MatrixCoordinatesModal    |  (orchestration, UI, auto-annotation)
+-------------+-------------+
              |
              | calls annotate(), buildRowsColsFromResult()
              v
+---------------------------+
| matrix-annotation/        |
|   cluster-symmetry.ts     |  clusterSymmetryAnnotationAlgorithm
|   cluster.ts              |  clusterAnnotationAlgorithm
|   build-matrix.ts         |  buildRowsColsFromResult
|   types.ts                |  AnnotationResult, MatrixItem, ...
+-------------+-------------+
              |
              | uses
              v
+---------------------------+     +---------------------------+
| keyboard-geometry.ts      |     | matrix-utils.ts           |
| - getKeyCenter            |     | - splitLayoutByRotation   |
+---------------------------+     | - deRotateLayoutGroups    |
                                  +---------------------------+
              |
              | reads/writes
              v
+---------------------------+
| matrix-drawing store      |  (Pinia: sequences, completed wires, editing)
+-------------+-------------+
              |
              | observed by
              v
+---------------------------+
| MatrixAnnotationOverlay   |  (canvas rendering, mouse/keyboard input)
+---------------------------+
              |
              | uses
              v
+---------------------------+     +---------------------------+
| keyboard-geometry.ts      |     | line-intersection.ts      |
| - getKeyCenter            |     | - findKeysAlongLine       |
| - getKeyDistance          |     | - lineIntersectsKey       |
+---------------------------+     +---------------------------+

+---------------------------+
| matrix-validation.ts      |  (coordinate parsing, duplicate validation,
|                           |   option/choice support)
+---------------------------+
              |
              v
+---------------------------+
| keyboard store            |  (isViaAnnotated, hasInvalidMatrixDuplicates,
| (Pinia)                   |   key data, labels)
+---------------------------+
```
