# Presets

kle-ng ships a library of ready-made layouts — full-size ANSI and ISO, 60% variants, ortholinear, split and ergonomic boards, and a blank canvas.

<img src="/preset-library-light.png" class="docs-screenshot light-only" alt="Import from Preset dialog showing a grid of layout cards" />
<img src="/preset-library-dark.png" class="docs-screenshot dark-only" alt="Import from Preset dialog showing a grid of layout cards" />

The most popular presets are listed directly in the **Import** menu under **Top Presets**. **Import → From Preset** opens the whole library. Search by name or keyword (`ortho`, `split`, `60%`) and click a card to load it.

Loading a preset replaces the current layout and clears the undo history, so save your work first.

## Languages {#languages}

**ANSI 104**, **ISO 105**, **Default 60%** and **ISO 60%** come in about 90 languages. The legends follow the layouts shipped with X11, including AltGr characters.

<img src="/preset-language-menu-light.png" class="docs-screenshot light-only" alt="Language menu of the ANSI 104 card with Polish highlighted" style="max-width:320px" />
<img src="/preset-language-menu-dark.png" class="docs-screenshot dark-only" alt="Language menu of the ANSI 104 card with Polish highlighted" style="max-width:320px" />

To pick a language, click the globe button in the card's corner (`🌐 EN`) and choose one from the list, then click the card to load it. Clicking the card without opening the list loads the default language. You can type in the list to jump to a language by name or code, for example `pol` or `pl` for Polish.

The defaults are kept plain, with only the base and Shift legends: US English on the ANSI boards and British English on the ISO boards. For more legends, choose **English (US, International)** or **British English (Extended)**, which add the AltGr layer. For Japanese, **Japanese (Kana)** adds kana next to the romaji.

<img src="/preset-ansi-104-polish-light.png" class="docs-screenshot light-only" alt="ANSI 104 preset loaded in Polish" />
<img src="/preset-ansi-104-polish-dark.png" class="docs-screenshot dark-only" alt="ANSI 104 preset loaded in Polish" />

### Reading the legends

<img src="/preset-legend-corners-light.png" class="docs-screenshot light-only" alt="Polish 2 key with four legends: @, 2, ¿ and ²" style="max-width:120px; float:right; margin-left:16px" />
<img src="/preset-legend-corners-dark.png" class="docs-screenshot dark-only" alt="Polish 2 key with four legends: @, 2, ¿ and ²" style="max-width:120px; float:right; margin-left:16px" />

A key can show up to four characters, one in each corner. The Polish `2` key on the right shows all four:

| Corner       | How to type it                      | Example |
| ------------ | ----------------------------------- | ------- |
| Bottom left  | the key alone                       | `2`     |
| Top left     | <kbd>Shift</kbd>                    | `@`     |
| Bottom right | <kbd>AltGr</kbd>                    | `²`     |
| Top right    | <kbd>Shift</kbd> + <kbd>AltGr</kbd> | `¿`     |

Letter keys show only the capital letter, as printed keycaps do. The letter is typed in lower case, or in upper case with <kbd>Shift</kbd>. The same goes for a capital on the right: on the Polish `A` key, `Ą` means <kbd>AltGr</kbd> types `ą` and <kbd>Shift</kbd> + <kbd>AltGr</kbd> types `Ą`.

**Japanese (Kana)** is the exception: its right-hand corners show kana instead of AltGr characters.

<img src="/preset-dead-key-light.png" class="docs-screenshot light-only" alt="German ^ key: the circumflex dead key drawn on a dotted circle, with °, ″ and ′" style="max-width:120px; float:right; margin-left:16px" />
<img src="/preset-dead-key-dark.png" class="docs-screenshot dark-only" alt="German ^ key: the circumflex dead key drawn on a dotted circle, with °, ″ and ′" style="max-width:120px; float:right; margin-left:16px" />

Dead keys are drawn with their accent on a dotted circle (◌), so you can tell them apart from ordinary characters such as `^`. A dead key types nothing by itself; it adds its accent to the next letter you type. On the German `^` key on the right, the circumflex in the bottom-left corner is a dead key; the other three characters are not.

The language only affects the legends; the key positions are the same in every language. It is not saved in the layout, but it becomes part of the default file name (`ansi-104-pl`).
