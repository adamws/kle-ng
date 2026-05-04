# Benchmark fixtures

Place KLE-format JSON layout files here. Every `*.json` file in this directory is
automatically discovered and included in bench runs — no registration required.

## Adding a fixture

1. Obtain the KLE-format JSON for the layout (e.g. export from the editor, copy from
   a GitHub issue, or save directly from keyboard-layout-editor.com).
2. Drop it here as `<descriptive-name>.json`.
3. Run `npm run bench` — it will appear automatically.

Empty or `{}` files are treated as placeholders and skipped with a warning.

## Current placeholders

Replace these with the real layout JSONs from the linked issues:

- **`issue-51-splay.json`** — Layout from [issue #51](https://github.com/adamws/kle-ng/issues/51): poor annotation on column-splay ergonomic layouts.
- **`issue-65-dropped-keys.json`** — Layout from [issue #65](https://github.com/adamws/kle-ng/issues/65): automatic annotation silently drops keys.
