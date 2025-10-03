# kle-ng

The kle-ng is a reimplementation of the popular [Keyboard Layout Editor](http://www.keyboard-layout-editor.com)
designed to provide a better user experience while maintaining compatibility
with existing layouts.

The original [keyboard-layout-editor](https://github.com/ijprest/keyboard-layout-editor)
has remained largely unchanged since 2018 and shows its age in daily use.

## Why kle-ng?

Keyboard Layout Editor has been an essential tool for the mechanical keyboard DIY community,
enabling countless custom keyboard projects. However, as the community has grown and evolved,
the tool could benefit from improvements to better serve modern needs.

What's wrong with the original Keyboard Layout Editor?

- **Clunky interface**: Selection and editing tools feel outdated and imprecise
  - Limited mouse support
- **No updates**: Hasn't received meaningful improvements since 2018
  - Not responding to community feedback, not addressing bugs
- **Limited editing features**: Missing tools that would speed up layout creation

What kle-ng tries to do better:

- **Smoother Editing Experience**
  - Fast, responsive canvas-based rendering that handles large layouts effortlessly
  - Precise key selection and positioning with visual feedback
  - Intuitive drag-and-drop for moving keys around
- **Better Workflow**
  - Improved keyboard shortcuts for faster editing, better mouse support
  - Cleaner, more organized interface that gets out of your way
  - Extra tools for creating split layouts
  - Minor tweaks improving key rotation handling
- **Modern Features**
  - Better color picker with multiple format support
  - Improved visual feedback when editing keys
  - Dark theme

Watch this short demo to see it in action:

[kle-ng-corne-demo.webm](https://github.com/user-attachments/assets/11bee053-c40e-4803-a07c-5e7ea1a0aa73)

Future plans:

- **Import Ergogen layouts**: Direct integration with [ergogen](https://github.com/ergogen/ergogen) keyboard layouts
- **Advanced layout templates**: Add more pre-built templates for common keyboard layouts
- **Add more editing tools**

## Compatibility

The kle-ng maintains compatibility with standard KLE JSON format for layouts.
However, **100% compatibility is not a goal**.
The following features are intentionally not supported:

- Different key profiles (appearance of keycaps). There is single default keycap rendering style.
- Full HTML content in key labels
  - Supports small subset of HTML tags: `<b>`, `<i>`, and `<img>` (for icons loaded from URLs)
- Background textures
- Legacy rendering quirks and edge cases

## Getting Started

The kle-ng runs in your web browser - no installation required.
Simply visit the application and start creating or editing your keyboard layouts.

For existing KLE users: Your saved layouts will work in kle-ng.
Just import your JSON files and continue where you left off.

## Development

```bash
npm install
npm run dev
```
