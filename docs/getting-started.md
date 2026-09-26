# Getting Started

The kle-ng runs entirely in your web browser — no installation required.
Visit [editor.keyboard-tools.xyz](https://editor.keyboard-tools.xyz/) and start creating or editing keyboard layouts immediately.

## Interface Overview

### Layout Editor

The main editing area where keys are displayed and manipulated. Click to select individual keys, drag to box-select multiple keys, and use side toolbar to launch editing tools.

<img src="/layout-editor-panel-light.png" class="docs-screenshot light-only" alt="Layout editor canvas with a keyboard layout" />
<img src="/layout-editor-panel-dark.png" class="docs-screenshot dark-only" alt="Layout editor canvas with a keyboard layout" />

### Key Properties

Controls position, size, labels, colors, and key options (ghost, stepped, homing nub, etc.). Changes apply immediately to the canvas.
Controls are activated when one or more keys are selected. Properties are applied to all selected keys.

<img src="/key-properties-panel-light.png" class="docs-screenshot light-only" alt="Key Properties panel" />
<img src="/key-properties-panel-dark.png" class="docs-screenshot dark-only" alt="Key Properties panel" />

### Keyboard Metadata

Layout-wide settings: name, author, background color, border radius, key spacing (mm/U), custom CSS, and VIA metadata.
The CSS field accepts standard CSS and is useful for applying custom fonts — see [Custom Fonts](./custom-fonts) for details.
The VIA metadata section stores matrix size and key assignments needed by VIA-compatible firmware — see [VIA & Vial Format](./via-and-metadata) for details.

<img src="/keyboard-metadata-panel-light.png" class="docs-screenshot light-only" alt="Keyboard Metadata panel" />
<img src="/keyboard-metadata-panel-dark.png" class="docs-screenshot dark-only" alt="Keyboard Metadata panel" />

### Summary

Shows layout statistics (key count, dimensions) and a table of key center positions. Includes a CSV export of all key data.

<img src="/summary-panel-light.png" class="docs-screenshot light-only" alt="Summary panel" />
<img src="/summary-panel-dark.png" class="docs-screenshot dark-only" alt="Summary panel" />

### JSON Editor

Lets you view and edit the raw KLE JSON directly. Syncing changes with canvas requires clicking **Apply Changes** button.

<img src="/json-editor-panel-light.png" class="docs-screenshot light-only" alt="JSON editor panel" />
<img src="/json-editor-panel-dark.png" class="docs-screenshot dark-only" alt="JSON editor panel" />

### Plate Generator

Generates switch and stabilizer cutout files for manufacturing keyboard plates. Supports Cherry MX, Alps, and Kailh Choc switch types, and exports to SVG, DXF, STL, and JSCAD.
See [Plate Generator](./plate-generator) for full details.

<img src="/plate-generator-panel-light.png" class="docs-screenshot light-only" alt="Plate generator panel" />
<img src="/plate-generator-panel-dark.png" class="docs-screenshot dark-only" alt="Plate generator panel" />

### PCB Generator

Generates a KiCad PCB project file from your layout, with switch footprints placed at the correct positions and a routed switch matrix. Requires matrix coordinates assigned to all keys beforehand.
See [PCB Generator](./pcb-generator) for full details.

<img src="/pcb-generator-panel-light.png" class="docs-screenshot light-only" alt="PCB generator panel" />
<img src="/pcb-generator-panel-dark.png" class="docs-screenshot dark-only" alt="PCB generator panel" />

## The Unit System

All key positions and sizes in kle-ng are expressed in **U** (keyboard units). One U is the width of a standard alphanumeric key (for example, `A`, `S`, `D`).

### Common Key Sizes

| Size  | Example keys                      |
| ----- | --------------------------------- |
| 1U    | Standard alphanumeric keys        |
| 1.25U | `Tab`, `\` on some layouts        |
| 1.5U  | `Tab` on standard ANSI layouts    |
| 2U    | Numpad `0`, some `Backspace` keys |
| 6.25U | Standard spacebar                 |

### Physical Spacing

The physical size of 1U is **19.05 mm** by default (Cherry MX standard). You can change the mm/U ratio in the **Keyboard Metadata** panel if your layout uses a different switch pitch (for example, Kailh Choc low-profile at 18mm). This is important when using kle-ng's plate or PCB generators.

## Quick Start

### Starting Out

1. **New layout** — The editor starts with a sample layout. Use the toolbar to import an existing layout, pick a ready-made board with **Import → From Preset** (see [Presets](./presets)), or start editing.
2. **Select keys** — Click a key on the canvas to select it. Click and drag to select multiple keys.
3. **Edit properties** — With a key selected, adjust its properties (size, color, labels) in the **Key Properties** panel.

### Saving Your Work

4. **Undo** — Press <kbd>Ctrl</kbd>+<kbd>Z</kbd> to undo. The editor maintains up to 50 undo steps.
5. **Export** — Click **Export** in the toolbar to download your layout in the desired format.

## Common Workflows

### Design a Layout from Scratch

1. The editor opens with a sample layout. To start fresh, select all keys with <kbd>Ctrl</kbd>+<kbd>A</kbd> and delete them with <kbd>Del</kbd>.
2. Press <kbd>A</kbd> to add a key. A 1U key appears at position (0, 0).
3. Adjust its position and size in the **Key Properties** panel, or use keyboard shortcuts to nudge and resize.
4. Continue adding keys and arranging them. Use dedicated tools from right side toolbar to apply rotations or to duplicate symmetric halves of split layouts.
5. Export as KLE JSON to save your work.

### Edit an Existing Layout

1. Click **Import** in the toolbar and choose **From File**, or drag a JSON file onto the canvas.
2. Select keys to modify their labels, colors, or dimensions.
3. Use **Extra Tools → Add Switch Matrix Coordinates** if you need VIA matrix assignments.
4. Export in the format you need.

### Generate a Plate for Manufacturing

1. Complete your layout design and verify key positions.
2. Open the **Plate Generator** panel and configure switch type and outline.
3. Download as SVG or DXF for laser cutting, or STL/JSCAD for 3D printing.

See [Plate Generator](./plate-generator) for full details.

### Generate a PCB

1. Assign matrix coordinates to all keys using **Extra Tools → Add Switch Matrix Coordinates**.
2. Open the **PCB Generator** panel and click **Generate PCB**.
3. Download the zip archive with `.kicad_sch` and `.kicad_pcb` files and open it in KiCad 9+.

See [PCB Generator](./pcb-generator) for full details.

## Next Steps

- [Layout Editor](./layout-editor) — Learn all the canvas tools, keyboard shortcuts, and mouse controls
- [Import & Export](./import-export) — Supported formats and import methods
- [Plate Generator](./plate-generator) — Create manufacturing-ready plate files
- [PCB Generator](./pcb-generator) — Generate KiCad PCB projects

## External References

- [KiCad plugin for automatic keyboard's key placement and routing](https://github.com/adamws/kicad-kbplacer)
- [Modifying ergogen layouts without learning ergogen](https://adamws.github.io/modifying-ergogen-layouts-without-learning-ergogen/)
