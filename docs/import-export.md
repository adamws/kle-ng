# Import & Export

kle-ng supports importing and exporting keyboard layouts in multiple formats.

## Supported Formats

### KLE JSON {#kle-format}

The standard [Keyboard Layout Editor JSON format](https://github.com/ijprest/kle-serial).

- Import and export layouts compatible with keyboard-layout-editor.com
- Supports both raw array format and internal format with metadata

### PNG {#png-format}

- **Export**: Layouts are exported as PNG images with embedded layout data. Zoom in on the canvas before exporting to increase output resolution — the export captures the canvas at the current zoom level.
- **Import**: PNG files with embedded layout data can be re-imported to recover the editable layout — useful for sharing and archiving

::: tip
Zoom in on the canvas before exporting to PNG to increase the output image resolution.
:::

### HTML and SVG {#html-svg-format}

- **HTML export**: Produces a self-contained document (embedded CSS, no external dependencies) that renders the keyboard in any browser
- **SVG export**: Produces a vector graphics file suitable for embedding in documents or editing in vector tools
- Both formats are visually consistent with the editor, including support for rotated keys, ISO/non-rectangular shapes, homing nubs, rotary encoders, ghost and decal keys
- Import is **not** supported for HTML or SVG

### VIA/Vial Format {#via-format}

[VIA](https://www.caniusevia.com/) and [Vial](https://get.vial.today/) are keyboard configuration tools that use a special JSON format. VIA format wraps KLE layout data with additional metadata (keyboard name, vendor/product IDs, matrix configuration).

**On import**, kle-ng converts VIA format to KLE format and preserves VIA-specific metadata in a `_kleng_via_data` field, maintaining full compatibility.

**On export**, layouts containing `_kleng_via_data` metadata can be exported back to VIA JSON format using **Export → Download VIA JSON**.

<table class="example-table">
<thead><tr>
<th>Imported file</th>
<th>Import result</th>
</tr></thead>
<tbody><tr>
<td>

```json
{
  "name": "Test VIA Layout",
  "vendorId": "0x1234",
  "productId": "0x5678",
  "matrix": { "rows": 2, "cols": 4 },
  "layouts": {
    "keymap": [
      ["0,0", "0,1", "0,2", "0,3"],
      ["1,0", "1,1", "1,2", "1,3"]
    ]
  }
}
```

</td>
<td>
<img src="/layout-with-via-metadata.png" alt="VIA layout import result">

[Open in editor →](https://editor.keyboard-tools.xyz/#share=NobwRA+g1gNgpgOwOYQG4EsCGEAmmAumYAXGAHIAsAkkjkgBZL5IAO6AQgMZUCCAjgFkAIgHkeADR7seZAIoApKgFEAYgJ4AtAMI8AKgHcAEgGd24nEp4BxejyGcAmvr2ck8gIwAPBwCUePBx4ABR4qZwBbHgFnAHURdH8RAHZOdAAGAHt2ACscFU8KHQAnO0Ck-woWAFUtEQQHdgAZADMkGHYATx4kviRdIQA2dAAOJHZ8ACNhzlkVAE4B3WMYcQBlVCQkgFcAVn8AXjAAXwAaYDA0k7SwE4uT9xu7gCZHy4BmMABdM7B3K8e-g9bn8XsCTh9Pp8gA)

</td>
</tr></tbody>
</table>

See [VIA & Vial Format](./via-and-metadata) for detailed information.

### QMK Format {#qmk-format}

[QMK](https://qmk.fm/) `info.json` files can be imported directly. kle-ng converts key positions, dimensions, and matrix coordinates into KLE format.

#### Single-Layout Import

Imported keys receive:

- Positions from `x`, `y` values
- Dimensions from `w`, `h` (default: 1×1)
- Rotation from `r`, `rx`, `ry`
- Matrix coordinates in the top-left label as `row,col`

<table class="example-table">
<thead><tr>
<th>Imported file</th>
<th>Import result</th>
</tr></thead>
<tbody><tr>
<td>

```json
{
  "keyboard_name": "Example",
  "manufacturer": "Example",
  "layouts": {
    "LAYOUT_default": {
      "layout": [
        { "matrix": [3, 3], "x": 4, "y": 4.25 },
        { "matrix": [3, 4], "x": 4, "y": 4.25, "r": 15, "rx": 4.5, "ry": 9.1 },
        { "matrix": [3, 5], "x": 4, "y": 4.25, "h": 1.5, "r": 30, "rx": 5.4, "ry": 9.3 }
      ]
    }
  }
}
```

</td>
<td>
<img src="/qmk-example-layout.png" alt="QMK layout import result">

[Open in editor →](https://editor.keyboard-tools.xyz/#share=NobwRAhgrgLgFgewE5gFxgKIA8IFsAOANgKZgA0YAdnqetnkaQL5mhhZoAsFAnlwHQAmAKwswAZjLiwAXVbgUqAIzCKSDqk79VYJH1QBOfkooaAtAAZtvNGa0AOURUmdZ83WnEW1G4f266+kaS7LZK-haRUdHRAfpmfhbCMSkWJmBwaOFOEmTCsjJAA")

</td>
</tr></tbody>
</table>

#### Why QMK and VIA represent layout alternatives differently

VIA and QMK use fundamentally different models for keyboards that support multiple physical configurations — and automatic conversion between them is not possible.

**VIA** defines layout alternatives as _options_ and _choices_. Each option is an independent physical variable (e.g., "Backspace style"), and each choice is one variant of that variable (choice 0 = regular 2u, choice 1 = split 1u+1u). Options are independent: the user picks one choice per option, and VIA handles all combinations implicitly.

**QMK** defines complete, named layout configurations. Each layout — `LAYOUT_ansi`, `LAYOUT_iso`, etc. — is a standalone list of physical key positions. The firmware author decides which specific combinations to ship; there is no structural information linking layouts back to option/choice groups.

**Example.** A keyboard supports two independent options: backspace style (regular or split) and enter style (ANSI or ISO). That gives up to four combinations. Its QMK `info.json` might define only three:

```json
"layouts": {
  "LAYOUT_ansi":       { "layout": [ ...2u backspace + ANSI enter... ] },
  "LAYOUT_iso":        { "layout": [ ...2u backspace + ISO enter...  ] },
  "LAYOUT_split_ansi": { "layout": [ ...split backspace + ANSI enter... ] }
}
```

Reading those three layouts there is no structural information that says "the backspace difference is one independent option and the enter difference is another." The VIA option/choice tree cannot be recovered from a QMK file — and conversely, a QMK file may define only a subset of all possible combinations, so the VIA tree cannot be automatically flattened to QMK either.

#### The `labels[9]` membership tag (kle-ng internal)

Because automatic conversion between QMK layouts and VIA option/choice is impossible, kle-ng uses a dedicated mechanism for QMK round-trips: a **layout membership tag** stored in `labels[9]` (the bottom-left legend position).

When kle-ng imports a QMK file with multiple layouts it tags each key with the set of QMK layout indices that contain it, using a semicolon-separated list:

| `labels[9]` value | Meaning                          |
| ----------------- | -------------------------------- |
| `""` or absent    | Shared — appears in every layout |
| `"0"`             | Belongs to QMK layout 0 only     |
| `"1;2"`           | Belongs to QMK layouts 1 and 2   |

This tag has no equivalent in either QMK or VIA — it is a kle-ng invention used solely to make QMK import → edit → export round-trips accurate. It is deliberately different from the VIA `option,choice` scheme (which uses a comma-separated `N,M` pair and is read from `labels[8]` by default), so QMK-imported keyboards are never treated as VIA keyboards.

#### Multi-Layout Import

When a QMK file declares multiple layouts, kle-ng imports **all physically distinct key configurations from all layouts into a single flat view**. This preserves the complete superset of physical switch positions:

- **Shared keys** — Keys that are physically identical across every layout (same matrix position, x, y, width, height, rotation) are imported once with no tag. These keys will appear in every layout when exported.
- **Layout-specific keys** — Keys that appear in only some layouts, or keys at the same matrix position with different dimensions in different layouts, receive a small label indicator showing which layout indices they belong to. This tag appears in the `labels[9]` position (the bottom-left area of the key label).
  - Format: `"0"` for layout 0, `"1;2"` for layouts 1 and 2, `"0;1;2"` for all three, etc.
  - Users see this as a small number or fraction on the key cap (e.g., a key tagged `"1;2"` shows as appearing in layouts 1 and 2 only).

::: tip
When a QMK file has multiple layouts, kle-ng imports all physical switch positions into a single flat view — equivalent to a `LAYOUT_all` superset. A QMK layout preview toolbar appears below the canvas, letting you preview individual layouts. Layout-specific keys are tagged with their layout indices so the export can reconstruct the original named layouts accurately.
:::

#### QMK Layout Preview Toolbar

When a multi-layout QMK file is loaded, a **QMK Layout Preview toolbar** appears below the canvas:

- An **"all" button** — shows all imported keys in the flat editable view
- **Numbered buttons** — one per QMK layout (0, 1, 2 …). Hover over a button to see the full layout name (e.g., `LAYOUT_iso`)

Click a numbered button to enter **preview mode** for that layout. In preview mode only keys belonging to that layout are shown, the canvas is read-only, and a hint reads _"QMK layout preview (readonly) — switch to all to edit"_. Click **"all"** to return to the normal editable view.

The toolbar is hidden for single-layout keyboards and for keyboards without QMK membership tags.

After importing a QMK layout, you can use the [PCB Generator](./pcb-generator) immediately since matrix coordinates are already assigned.

**On export**, layouts with matrix-annotated keys can be exported back to QMK `info.json` format using **Export → Download QMK JSON**. The reconstructed layout includes all original QMK metadata (keyboard_name, manufacturer, processor, USB config, etc.) merged with your updated key positions and dimensions.

See [QMK Export](#qmk-export) below for detailed information.

### Ergogen Format {#ergogen-format}

[Ergogen](https://ergogen.xyz/) is a keyboard layout generator that uses YAML configuration. kle-ng can import:

- Ergogen YAML files directly
- Ergogen share URLs (e.g., `https://ergogen.xyz/#N4Igxg9gdg...`)

kle-ng decodes the URL, processes it with the Ergogen library, and converts the result to KLE format for editing.

<table class="example-table">
<thead><tr>
<th>Imported file</th>
<th>Import result</th>
</tr></thead>
<tbody><tr>
<td>

```yaml
meta:
  engine: 4.1.0
points:
  zones:
    matrix:
      anchor:
        rotate: 5
  # [...cut for readability...]
  rotate: -20
  mirror:
    ref: matrix_pinky_home
    distance: 223.7529778
```

</td>
<td>
<img src="/ergogen-import-result.png" alt="Ergogen layout import result">

[Open in editor →](https://editor.keyboard-tools.xyz/#share=NobwRAzgDghgxgSwHYHMD6APMAuAjATgBpJZFU0BPHAgX0NDACdqBWYxrbABgDo2mq2AEw8AbC1wAOACwBmYpwC0vfoOV86YALYwALowQY0UZAGsKaAEYB7XbutawAXXrgOOXgHYWkyQXaCuGKSLPhSCjjqqpEqmjr6hsZmFgAWDgCmzq5MnEFcuJ6ispIBHjyeBPj4QhHYUcRqscTxBkYmSOZo9lBZDMzCXOy5YviiXELyAjgisp74xfxKKg0xGs16rWgG5DZ2Dr1unCJcxVxypXg8cqPztfVgjWvaG4nb6GlamS59RzynXKJpBdlmAlnwVnUms8EkY3l1rD1vodpuUhCxPEJcBcRNJPNJcOFQatopCni1EloEAATKkAG3SVls9kcSJyOFkPABnjxWKmlxYsmk0jRdxBjxYcReRkpNPpaA+X2y7mwHOkXHwhV5jEEKnwuNkkzBJKikphaBldIZ3QObJVfHRas8Fw5BKEvkNxIhJvWZuQVPSRl2zJtyo53Ld3gu0j+om8J1F4IexM0uhSAFctJYAGYwJBoJDpGCMLrpzMhzgcyRVYUlPkiAqyfxE0nGqHkox+gPyjLlnDRoT4oW17XUHgTQX4WtGr1tqVoTtGa2s5XR6SiXDq4eCDksAV+KeepMt02bZAF4tB-bLzjRyQnAlblHr-FCUQJ1tkudn9LFhW97AsDwuDSBIxQXEEsZCga74zp+vpIOe8KIkqfbDjePAyOIsg1HygG4K+aK8tOR7emAqYZtmubdp8JYUSGOCFEMOCAdIvhVm+fKiGOngGrMMEkVC5GZjmeY5sWQmWPRdSMbangYVwLCYosh7inECCMIw1jiaWlGiUWtFlsukSsUx2CSFcuLoo+AFAQREj8apzTqZp2kUSJ1FWjpUmKEIgy2uZwFVhi4FiHicgei2sESk5GlaeaX4IT+SH-uZ0j4Oqtx1mIwH4RxxGOdozlxe286Jb+PbXjg5mSAa+STCOdq7sUhL5cmMUufF8GIZeLJKpw+CcopohFCF45pQekUCWSRXFiVC7JZV2ADbIeqiDV2JATxTatce7XFQl-pGH+i0DYp+GyPwDXRrIsYsPGzb3AVlKxa5wlUQW+kSf+A08bG90NS6+Hug5bWFS9nWnkgh2MnsvU-DgA2+HIaXAnweo8RFj2g89HUlRacpLn11C8EIr43UQfJBAKQoig9YrYzNEMUtSloef+G58GtxQUw1OI8i1KkM+DeMs3KPXs7wYRqriqPKZNT2MyVcKE-DeBBGiYyxiF1yiJlO2kTj+1mnCx1E2raN3pITpZbM8whCDu1g7jc5wuLRl1Lgl25CIQiFPqqMVFU1QOwbitzu0nQq8ieAiAKinB5TwShAL8tC87ZoR6kFVm-h5R6gSWqCCI4hSOcdOJgrwvh8kMPBk4ThAA")

</td>
</tr></tbody>
</table>

::: info
kle-ng does **not** support export to Ergogen format.
:::

::: warning
kle-ng aims to preserve exact key positions when importing Ergogen layouts, but always double-check alignment when mixing outputs from different tools (e.g., Ergogen for PCB + ai03 Plate Generator for plate).
:::

## Importing {#importing}

kle-ng supports multiple import methods:

### Import Button

Click the **Import** button in the toolbar and select:

**From File** — Browse for a file on your computer. Supported formats: JSON (KLE, VIA/Vial, QMK), PNG (with embedded layout data), Ergogen YAML

**From URL** — Enter any of the supported URL formats:

- Direct JSON URL (any publicly accessible JSON file)
- GitHub Gist URL
- Ergogen share link (`https://ergogen.xyz/#...`)
- Existing kle-ng share link

### Drag and Drop

Drag layout files directly onto the canvas area.

Supported file formats: **JSON** (KLE, VIA/Vial, QMK), **PNG** (with embedded layout data), **Ergogen YAML**

![Drag and drop import](/file-drag-and-drop.gif)

### Share Links

Open layouts shared via URL directly in the browser:

- **kle-ng share link**: `https://editor.keyboard-tools.xyz/#share=NrDeC...`
- **Direct Gist ID**: `https://editor.keyboard-tools.xyz/#gist=<gist-id>`
- **Universal URL format**: `https://editor.keyboard-tools.xyz/#url=<url>`
  - Supports GitHub Gist URLs and Ergogen URLs as the `url=` parameter

### GitHub Gist File Priority

When importing from a GitHub Gist, kle-ng searches for layout files in this priority order:

1. `layout.json`
2. `keyboard.json`
3. `kle.json`
4. Any file containing "layout" or "keyboard" in the name
5. Any `.json` file

The JSON file may be in any recognizable layout format.

::: info
GitHub API has rate limits for unauthenticated requests. If you encounter rate limit errors, wait a few minutes before trying again.
:::

## Exporting {#exporting}

Click the **Export** button in the toolbar to access all export options:

### Available Export Formats

| Option            | Format        | Notes                                            |
| ----------------- | ------------- | ------------------------------------------------ |
| Download JSON     | KLE JSON      | Standard KLE format                              |
| Download PNG      | PNG           | Canvas-quality image with embedded layout data   |
| Download HTML     | HTML          | Self-contained keyboard render                   |
| Download SVG      | SVG           | Vector graphics                                  |
| Download QMK JSON | QMK info.json | Only available when keys have matrix coordinates |
| Download VIA JSON | VIA/Vial JSON | Only available when VIA metadata is present      |
| Copy share link   | URL           | Generates a shareable `#share=` URL              |

## QMK Export {#qmk-export}

Layouts with matrix-annotated keys can be exported to QMK `info.json` format.

### Requirements

- Keys must have **matrix coordinates** in the top-left label (format: `row,col`)
- Keyboard must have a **name** set in the Keyboard Metadata panel

If these are missing, **Download QMK JSON** will be unavailable in the Export menu.

### Export Process

When you export to QMK format:

1. Current keyboard name and author (from Keyboard Metadata) are used as `keyboard_name` and `manufacturer`
2. All matrix-annotated keys are reconstructed with their current positions, dimensions, and rotations
3. Original QMK metadata (processor, USB config, url, etc.) is preserved from the imported `_kleng_qmk_data` if available
4. Key positions are rounded to 6 decimal places to remove floating-point noise

### Multi-Layout Export

**QMK-imported keyboards** automatically use the layout membership mechanism:

When you import a QMK file with multiple layouts, keys are tagged with layout membership in the `labels[9]` position (bottom-left legend area). On export, kle-ng uses these tags to reconstruct the original named layouts:

- **Shared keys** — Keys with empty `labels[9]` appear in every reconstructed layout
- **Layout-specific keys** — Keys with `labels[9]` containing semicolon-separated layout indices (e.g., `"0"`, `"1;2"`, `"0;1;2"`) appear only in the layouts listed
- **Layout names** — Preserved from the original QMK `info.json` import

::: info
The layout membership tags in `labels[9]` are set automatically during QMK import. You can manually edit or add these tags if you need to reorganize layouts after import. Simply edit the key's label (position 9) with the layout indices you want it to belong to, using semicolon-separated values (e.g., `"0;1"` for layouts 0 and 1).
:::

**VIA/Vial keyboards** use a different, independent mechanism:

VIA and Vial layouts encode layout alternatives as `option,choice` labels (e.g., `0,0`, `0,1`) at one of the key label positions. kle-ng detects this scheme automatically and generates one QMK layout per distinct choice. The option number groups related choices; the choice number selects the variant. This is the native VIA format — it is not related to the QMK membership path above; both are fully supported.

### Example

Suppose you imported a QMK file with two layouts: `LAYOUT_iso` (index 0) and `LAYOUT_ansi` (index 1). In the flat view:

- Keys at matrix [0,0] through [4,11] have `labels[9] = ""` (empty) → shared, appear in both layouts
- Keys at matrix [3,12] through [4,14] have `labels[9] = "0"` → ISO variant only
- Keys at matrix [3,12] through [4,14] have `labels[9] = "1"` → ANSI variant only

When exported, the QMK `info.json` contains two separate layout definitions:

- `LAYOUT_iso`: all shared keys + keys tagged with layout 0
- `LAYOUT_ansi`: all shared keys + keys tagged with layout 1

## Troubleshooting Import/Export Issues

### JSON Parse Errors

**Import fails with a parse error** — Verify the file is valid JSON. Common causes: trailing commas, single quotes instead of double quotes, or a file saved with non-JSON content. Try opening the file in a text editor to inspect it.

### GitHub Gist Issues

**GitHub Gist import fails** — GitHub API rate limits unauthenticated requests to 60 per hour per IP. If you hit the limit, wait about an hour before trying again. Alternatively, download the raw JSON and import **From File**.

### Ergogen Compatibility

**Ergogen import produces unexpected positions** — Ergogen's coordinate origin and key rotation conventions differ from KLE. kle-ng aims to preserve positions faithfully, but always cross-check the result against Ergogen's own preview before using the output for manufacturing.

### VIA Export Unavailable

**"Download VIA JSON" is greyed out** — VIA export is only available after importing a VIA file or manually adding VIA metadata in the **Keyboard Metadata** panel. See [VIA & Vial Format](./via-and-metadata) for details.
