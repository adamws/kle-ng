# Key Properties

The **Key Properties** panel is enabled whenever one or more keys are selected. When multiple keys are selected, editing a property applies it to all selected keys simultaneously.

<img src="/key-properties-panel-light.png" class="docs-screenshot light-only" alt="Key Properties panel" />
<img src="/key-properties-panel-dark.png" class="docs-screenshot dark-only" alt="Key Properties panel" />

## Position & Rotation

| Field                   | Description                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| **X, Y**                | Position of the key's top-left corner in U                        |
| **Width, Height**       | Key dimensions in U. Step size is 0.25U by default                |
| **Rotation**            | Rotation angle in degrees. Positive values rotate clockwise       |
| **Rotation Origin X/Y** | The point around which the key rotates, in absolute U coordinates |

### Rotation Origin Modes

**Absolute vs. Relative rotation origin:** Use the **A/R** toggle to switch between absolute (default) and relative rotation origin modes. In relative mode, the X/Y offsets are measured from the key's own top-left corner rather than from the canvas origin.

### Advanced Position Mode

Click the **Advanced** button to expose secondary position and size fields (X2, Y2, Width2, Height2). These define a second rectangular region combined with the primary one to produce non-rectangular key shapes such as ISO Enter and Big-Ass Enter. Most users do not need to use these directly.

## Labels

Each key has up to **12 label positions**: 9 positions on the **top face** of the keycap (the part you see when looking down) and 3 positions on the **front face** (the vertical edge facing you when typing).

The 9 top-label positions map to a 3×3 grid:

|             |               |              |
| :---------: | :-----------: | :----------: |
|  Top-Left   |  Top-Center   |  Top-Right   |
| Center-Left |  **Center**   | Center-Right |
| Bottom-Left | Bottom-Center | Bottom-Right |

Front labels appear on the front face of the key, useful for representing secondary or shine-through legends.

### Label Colors

Each label position has an independent **color picker** next to the input field. The color applies only to that label position. The global **Text Color** field sets a default color for all labels that don't have a per-label color override.

Use **Clear all** to remove all labels at once from either the top or front face.

::: tip
Need a symbol that's not on your keyboard? Use **Extra Tools → [Character Picker](./layout-editor#character-picker)** to search and insert special characters directly into a label.
:::

## Text Size

**Default Text Size** applies to all labels on the selected key(s) that don't have a per-label size set. Values range from 1 (smallest) to 9 (largest).

**Per-Label Text Size** lets you set individual sizes for each label position using the same 3×3 grid layout. Leave a position empty to inherit the default size.

## Key Options

| Option             | Description                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **Ghost**          | Renders the key as transparent/invisible. Used in plate generation to define outline shapes without producing switch cutouts |
| **Step** (Stepped) | Renders the key with a stepped profile (lower right portion). Used for stepped Caps Lock keycaps                             |
| **Home** (Nub)     | Indicates this key has a homing bar or bump (e.g., `F` and `J` on standard layouts)                                          |
| **Decal**          | Marks the key as a decorative element only — no switch cutout is generated in the plate                                      |
| **Rotary Encoder** | Marks the key as a rotary encoder. Height cannot be edited for encoders                                                      |

## Colors

- **Key Color** — Background color of the keycap
- **Text Color** — Default color for all labels on this key

Both fields accept hex color values and provide a color picker. Type directly in the text field or click the color swatch.

:::: info
The **Key Color** value represents the color of the **shaded part** (sides/border) of the keycap. The top face color is not configurable directly — it is derived automatically via a color transformation (brightening) applied to the Key Color. To convert between the stored key color and the rendered key-top color, use the **Color Calculator** available in the [Theme Tools panel](./color-themes#color-calculator).
::::

## Image and SVG Labels

Key labels support embedding images and SVG graphics. Images align to the inner keycap surface (the visible face of the key, excluding the border).

<table>
<thead><tr>
<th>Example</th>
<th>Layout JSON</th>
</tr></thead>
<tbody><tr>
<td>

**External Image URL**

<img src="/label-external-image.png" alt="External image label example" style="max-width:220px;">

[Open in editor →](https://editor.keyboard-tools.xyz/#share=NrDeCIENwLgdgL4BpwB4CWBbA5gAgM4BOAxgLwDkAFgC7UAO+MA9E4ZAO4B0261lArgCN++AKYkA9gDtqomZ2ITMTSABNImdviYBrADaiAtFOytRAM22VRa7Zkj5ZhJnSF70xJuuqQmH6dr6opx0JuS47OiqfKQAzABMuNbo2DRx8QB84AC62UA)

</td>
<td>

```json
[
  [
    { "a": 7 },
    "<img src='https://raw.githubusercontent.com/adamws/kle-ng/refs/heads/master/public/data/icons/kle.png' width=32 height=32>"
  ]
]
```

- The image server must support CORS
- Tested formats: PNG, SVG

</td>
</tr>
<tr>
<td>

**Inline SVG**

<img src="/label-inline-svg.png" alt="Inline SVG label example" style="max-width:220px;">

[Open in editor →](https://editor.keyboard-tools.xyz/#share=NrDeCIENwLgdgL4BpwB4DOA3A5gAgO4CWAJgC4AWAvADrgDMATLbuQKaHbmk31Pi6ZCrfACEA9gA8eABlyzGuRswkBbADYA7dDy6kADjAD0h-KYB0+OmbEAnbIYbSnhrNloA+VAGNCNr2tZcLylaAEYANmYvAE8eCOYbOL5cADNCNTUeAGIAMRyAVjgGPkNPFxx3cABdKqA")

</td>
<td>

```json
[
  [
    { "a": 7 },
    "<svg width=\"32\" height=\"32\" viewBox=\"0 0 32 32\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"16\" cy=\"16\" r=\"12\" fill=\"#FF5722\"/></svg>"
  ]
]
```

- SVG must include explicit `width` and `height` attributes

</td>
</tr></tbody>
</table>

## Manufacturing Properties {#switch-orientation}

Manufacturing properties control how switches and stabilizers are physically mounted. These settings are used by the [Plate Generator](./plate-generator) and [PCB Generator](./pcb-generator).

The **Switch orientation** and **Stabilizer orientation** properties allow you to define the mounting orientation of physical switches and their stabilizers.

- These rotations are applied by the Plate Generator independently, on top of layout rotations
- Values must be a multiple of 90°

Most plate stabilizer cutout types are unidirectional, which forces a specific mounting orientation on the plate or PCB. Always validate that the stabilizer cutout matches the intended mounting orientation.

### Cherry MX PCB Stabilizer Example {#stabilizer-orientation}

For a Cherry MX PCB-mounted stabilizer with the wire facing south, the correct orientation is shown below:

<div style="display:flex; flex-wrap:wrap; gap:1rem; margin-top:1rem;">
  <figure style="text-align:center; margin:0;">
    <img src="/cherry-mx-pcb-stabilizer-3d.png" alt="Cherry MX stabilizer 3D view" style="max-width:180px;">
    <figcaption>3D view</figcaption>
  </figure>
  <figure style="text-align:center; margin:0;">
    <img src="/cherry-mx-pcb-stabilizer-pcb.png" alt="Cherry MX stabilizer PCB footprint" style="max-width:180px;">
    <figcaption>PCB footprint</figcaption>
  </figure>
  <figure style="text-align:center; margin:0;">
    <img src="/cherry-mx-pcb-stabilizer-cutout.png" alt="Cherry MX plate cutout" style="max-width:180px;">
    <figcaption>Plate cutout</figcaption>
  </figure>
</div>
