# Layout Editor

The canvas editor is the main working area of kle-ng. It provides a full set of tools for creating and editing keyboard layouts.

<img src="/layout-editor-panel-light.png" class="docs-screenshot light-only" alt="Layout editor canvas with a keyboard layout" />
<img src="/layout-editor-panel-dark.png" class="docs-screenshot dark-only" alt="Layout editor canvas with a keyboard layout" />

## Canvas Tools

The toolbar on the left side of the canvas contains the main editing tools:

|                                                                           Icon                                                                           | Tool                                                | Description                                                                                                                                                                                                                                   |
| :------------------------------------------------------------------------------------------------------------------------------------------------------: | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|        <img src="/selection-tool-icon-light.png" class="light-only" alt="" /><img src="/selection-tool-icon-dark.png" class="dark-only" alt="" />        | [**Selection Tool**](#selection-tool)               | Select, move, resize keys                                                                                                                                                                                                                     |
|     <img src="/move-exactly-tool-icon-light.png" class="light-only" alt="" /><img src="/move-exactly-tool-icon-dark.png" class="dark-only" alt="" />     | [**Move Exactly Tool**](#move-exactly-tool)         | Move keys by a precise amount                                                                                                                                                                                                                 |
| <img src="/rotate-selection-tool-icon-light.png" class="light-only" alt="" /><img src="/rotate-selection-tool-icon-dark.png" class="dark-only" alt="" /> | [**Rotate Selection Tool**](#rotate-selection-tool) | Rotate selected keys around anchor points                                                                                                                                                                                                     |
|           <img src="/mirror-tool-icon-light.png" class="light-only" alt="" /><img src="/mirror-tool-icon-dark.png" class="dark-only" alt="" />           | [**Mirror Tool**](#mirror-tool)                     | Create mirrored copies of selected keys                                                                                                                                                                                                       |
|           <img src="/extra-tools-icon-light.png" class="light-only" alt="" /><img src="/extra-tools-icon-dark.png" class="dark-only" alt="" />           | [**Extra Tools**](#extra-tools)                     | [Legend Tools](#legend-tools), [Matrix Coordinates](#add-switch-matrix-coordinates), [Move Rotation Origins](#move-rotation-origins), [Theme Tools](#theme-tools), [Sanitize Layout](#sanitize-layout), [Character Picker](#character-picker) |

## Mouse Controls {#mouse-controls}

| Action                  | Result                        |
| ----------------------- | ----------------------------- |
| **Left Click**          | Select a key                  |
| **Left Click + Drag**   | Create a rectangle selection  |
| **Ctrl + Left Click**   | Add/remove key from selection |
| **Middle Click + Drag** | Move selected keys            |

## Keyboard Shortcuts {#keyboard-shortcuts}

| Shortcut                                  | Action                                               |
| ----------------------------------------- | ---------------------------------------------------- |
| <kbd>Ctrl</kbd>+<kbd>C</kbd>              | Copy selected keys                                   |
| <kbd>Ctrl</kbd>+<kbd>V</kbd>              | Paste keys from clipboard                            |
| <kbd>Ctrl</kbd>+<kbd>X</kbd>              | Cut selected keys                                    |
| <kbd>Ctrl</kbd>+<kbd>A</kbd>              | Select all keys                                      |
| <kbd>Del</kbd> / <kbd>Backspace</kbd>     | Delete selected keys                                 |
| <kbd>Ctrl</kbd>+<kbd>Z</kbd>              | Undo last action                                     |
| <kbd>Ctrl</kbd>+<kbd>]</kbd>              | Select next key                                      |
| <kbd>Ctrl</kbd>+<kbd>[</kbd>              | Select previous key                                  |
| <kbd>Arrow keys</kbd>                     | Nudge selected keys                                  |
| <kbd>Shift</kbd>+<kbd>←</kbd><kbd>→</kbd> | Adjust key width                                     |
| <kbd>Shift</kbd>+<kbd>↑</kbd><kbd>↓</kbd> | Adjust key height                                    |
| <kbd>A</kbd>                              | Add new key                                          |
| <kbd>/</kbd>                              | Toggle label search bar                              |
| <kbd>Shift</kbd>+<kbd>M</kbd>             | Open [Move Exactly Tool](#move-exactly-tool)         |
| <kbd>Shift</kbd>+<kbd>R</kbd>             | Open [Rotate Selection Tool](#rotate-selection-tool) |

## Selection Tool {#selection-tool}

The Selection Tool is the default tool for working with keys.

### Selecting Keys

<div style="display:flex;gap:1.5rem;align-items:flex-start">
<ul>
<li>Click a key to select it</li>
<li>Click and drag on empty canvas area to draw a rectangle selection</li>
<li>Hold <kbd>Ctrl</kbd> while clicking to add or remove keys from the current selection</li>
<li>Use <kbd>Ctrl</kbd>+<kbd>[</kbd> and <kbd>Ctrl</kbd>+<kbd>]</kbd> to cycle through keys in layout order</li>
</ul>
<img src="/key-selection.gif" alt="Key selection animation" style="flex-shrink:0;max-width:220px" />
</div>

### Moving Keys

<div style="display:flex;gap:1.5rem;align-items:flex-start">
<div>

- **Middle mouse button**: Click and drag to move the selection
- **Arrow keys**: Nudge selected keys by the configured step size

Movement snaps to a configurable step size (defined in U, where 1U = width of a standard key). The step size can be set in the canvas footer.

<img src="/canvas-footer-left.png" alt="Canvas footer controls" class="docs-screenshot" />
</div>
<img src="/mouse-move.gif" alt="Mouse movement animation" style="flex-shrink:0;max-width:220px" />
</div>

### Lock Rotations

The **Lock rotations** option determines how rotated keys move:

|                           Lock Disabled                            |                                  Lock Enabled                                   |
| :----------------------------------------------------------------: | :-----------------------------------------------------------------------------: |
|        ![Lock disabled](/lock-rotation-disabled-small.gif)         |                ![Lock enabled](/lock-rotation-enabled-small.gif)                |
| Rotation origin stays fixed; keys move in rotated coordinate space | Rotation origin moves with the keys; movement occurs in normal coordinate space |

## Move Exactly Tool

For precise movement use the **Move Exactly** tool (<kbd>Shift</kbd>+<kbd>M</kbd>).

The tool allows movement to any position, not limited to the step size. It also supports movement in **millimeters** by specifying the spacing (mm per U). The default spacing is **19.05 mm/U** for both X and Y axes, which is standard for Cherry MX style switches.

### Using the Tool

<div style="display:flex;gap:1.5rem;align-items:flex-start">
<img src="/move-with-tool.gif" alt="Move exactly tool animation" style="flex:2;min-width:0;max-width:66%" />
<img src="/move-exactly-mm-light.png" alt="Move exactly mm panel" class="docs-screenshot light-only" style="flex:1;min-width:0;max-width:34%" />
<img src="/move-exactly-mm-dark.png" alt="Move exactly mm panel" class="docs-screenshot dark-only" style="flex:1;min-width:0;max-width:34%" />
</div>

## Rotate Selection Tool

Rotate selected keys around anchor points (key corners and centers) using the **Rotate Selection** tool (<kbd>Shift</kbd>+<kbd>R</kbd>).

### Using the Tool

![Rotate tool animation](/rotate-tool.gif)

## Mirror Tool

Create mirrored copies of selected keys with the **Mirror Tool**. Choose a mirror axis position — the axis snaps to multiples of the step size. Supports both vertical (default) and horizontal mirroring from the tool dropdown.

### Using the Tool

![Mirror tool animation](/mirror-tool.gif)

## Extra Tools {#extra-tools}

Extra tools are grouped under a single button in the left toolbar. There are six:

1. **Legend Tools** — bulk legend editing
2. **Add Switch Matrix Coordinates** — assign VIA-style row/column labels
3. **Move Rotation Origins** — recalculate key positions with a new rotation reference point
4. **Theme Tools** — apply color themes to the layout
5. **Sanitize Layout** — find and clean up redundant JSON properties and layout offsets
6. **Character Picker** — search and insert special characters into labels

### Legend Tools

Legend tools provide quick canvas-oriented label editing in four modes:

| Mode       | Description                                                                      |
| ---------- | -------------------------------------------------------------------------------- |
| **Edit**   | Direct label assignment with auto-advancement to next key after <kbd>Enter</kbd> |
| **Remove** | Remove all labels at the selected label position                                 |
| **Align**  | Change label alignment                                                           |
| **Move**   | Move labels from one position to another                                         |

|                  Edit Mode                   |                  Move Mode                   |
| :------------------------------------------: | :------------------------------------------: |
| ![Legend tools edit](/legend-tools-edit.gif) | ![Legend tools move](/legend-tools-move.gif) |

::: tip
Legend Tools are designed for easier bulk label editing compared to modifying labels one at a time in the Key Properties panel.
:::

### Add Switch Matrix Coordinates

This tool assigns VIA-style `row,column` labels (e.g., `0,0`) to each key, enabling compatibility with [VIA](https://www.caniusevia.com/) and [Vial](https://get.vial.today/) configurators and the [PCB Generator](./pcb-generator).

<img src="/add-switch-matrix-coordinates-modal-light.png" alt="Switch Matrix Coordinates Window" class="light-only" style="flex-shrink:0;width:50%" />
<img src="/add-switch-matrix-coordinates-modal-dark.png" alt="Switch Matrix Coordinates Window" class="dark-only" style="flex-shrink:0;width:50%" />

The tool provides an **Annotate Automatically** option that assigns coordinates intelligently based on key positions. You can also draw rows and columns manually:

::: warning
Automatic annotations may not produce correct results for certain keyboard layouts. **Ergonomic layouts with significant column splay** (angled columns) are particularly affected and may require manual correction of row/column assignments. Standard rectangular layouts typically produce good results. See [issue #51](https://github.com/adamws/kle-ng/issues/51) for details.
:::

|                   Draw Rows                   |                     Draw Columns                     |                      Remove                       |
| :-------------------------------------------: | :--------------------------------------------------: | :-----------------------------------------------: |
| ![Draw rows](/manual-annotation-draw-row.gif) | ![Draw columns](/manual-annotation-draw-columns.gif) | ![Remove](/manual-annotation-remove-elements.gif) |

- Left-click to start and complete wire segments
- Hold <kbd>Shift</kbd> while making the second click to connect two keys directly, skipping any keys the line passes over
- Right-click or <kbd>Escape</kbd> to cancel
- Click an existing wire to append to it
- Hold <kbd>Ctrl</kbd> while clicking a wire to remove the entire row/column

To renumber a row or column: hover over it in any editing mode and type the new number.

::: tip
To export a PNG with the matrix wire overlay visible, open the **Add Switch Matrix Coordinates** tool first, then use **Export → Download PNG**.
:::

### Move Rotation Origins

The **Move Rotation Origins** tool reassigns the rotation origin point for keys without changing their visual position on the canvas. This is useful when you want to reference a different pivot point for subsequent rotations — for example, after repositioning a key cluster, you may want the rotation origin to be the new key center rather than the original one.

The tool operates on selected keys, or on all keys if nothing is selected. Two modes are available:

- **Use key centers** — Calculates and sets the rotation origin to the geometric center of each key individually.
- **Manual position** — Sets the rotation origin to a fixed X/Y coordinate (in U) for all affected keys.

### Theme Tools

The **Theme Tools** panel applies color themes to the entire layout in bulk. Open it from **Extra Tools → Theme Tools**.

<img src="/theme-tools-modal-light.png" class="light-only" alt="Theme tools modal" />
<img src="/theme-tools-modal-dark.png" class="dark-only" alt="Theme tools modal" />

Choose from several built-in themes in the dropdown:

| Theme          | Description                                                               |
| -------------- | ------------------------------------------------------------------------- |
| Classic        | Light gray keys on a gray background — the classic KLE look               |
| Dark           | Dark gray keys on a near-black background                                 |
| VIA            | Light gray alphas with darker modifiers, similar to VIA's default display |
| Gruvbox (dark) | Gruvbox color palette with dark background                                |

Themes are defined as JSON objects with named rules and matcher expressions that target specific keys. You can edit the current theme directly in the JSON editor within the panel, or load and save theme files using **Load JSON** and **Save JSON**.

The panel also includes a **Color Calculator** for converting between stored KLE keycap colors and the rendered key-top colors.

See [Color Themes](./color-themes) for the full theme format, matcher syntax reference, and examples.

### Sanitize Layout

The **Sanitize Layout** tool scans the layout for redundant data and non-normalized values, and lets you clean them up in bulk. Open it from **Extra Tools → Sanitize Layout**.

Scanning happens automatically when the panel opens, and issues are grouped into two categories:

| Category           | Description                                                                                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Redundant data** | Properties left over on keys that no longer need them — for example, a font size or text color set on a label that is now blank, or a rotation origin still stored on a key that isn't rotated |
| **Normalization**  | Values that are valid but not in their canonical form — for example, a layout that doesn't start at (0,0), or rotation angles outside the -180..180 range                                      |

Each rule shows a count of how many keys or properties it would affect. Rules with a count of zero are disabled — there's nothing to fix. Uncheck any rule you want to skip, then click **Apply Fixes** to clean up only the checked rules. Use **Rescan** to re-scan the layout after making changes without closing the panel.

::: tip
Applying fixes creates a single undo step, so <kbd>Ctrl</kbd>+<kbd>Z</kbd> reverts everything the tool changed at once.
:::

### Character Picker

The **Character Picker** lets you search and insert symbols and special characters — accented letters, arrows, Greek and Cyrillic letters, math symbols, and more — directly into a key's labels without leaving the editor. Open it from **Extra Tools → Character Picker**.

<img src="/character-picker-panel-light.png" class="docs-screenshot light-only" alt="Character Picker panel" />
<img src="/character-picker-panel-dark.png" class="docs-screenshot dark-only" alt="Character Picker panel" />

Select a key, then click into the label position you want to fill. Type in the search box to find a character by name (e.g. "heart", "alpha", "copy"), or browse by category using the tabs above the grid. Click a character tile to insert it at the cursor position in the active label — the panel stays open so you can insert several characters in a row. With multiple keys selected, the character is inserted into the same label position on all of them.

Recently used characters appear in their own row above the grid for quick reuse.

::: tip
Hover a character tile to see its name and Unicode code point.
:::

## Label Search {#label-search}

Press <kbd>/</kbd> to open the label search bar. Type to find keys by their label text. Matches are highlighted on the canvas. Use <kbd>Enter</kbd> or the up/down arrows to cycle through matches. Press <kbd>Escape</kbd> or <kbd>/</kbd> again to close.

::: tip
To export a PNG with search match highlighting visible, keep the search bar open before using **Export → Download PNG**.
:::

## Canvas Settings {#canvas-settings}

A settings panel is accessible from the toolbar (gear icon). Current settings:

| Setting             | Description                                                         |
| ------------------- | ------------------------------------------------------------------- |
| **Show grid**       | Toggles a dot grid on the canvas aligned to the current step size   |
| **Highlight Color** | Color used to indicate selected keys. Click the swatch to change it |
