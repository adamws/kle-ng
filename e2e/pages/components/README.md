# UI Components

This directory contains Page Object classes for reusable UI components.

## Available Components

- **ToolbarComponent**: Canvas toolbar buttons and actions
- **CanvasComponent**: Canvas interactions and rendering
- **PropertiesPanelComponent**: Key properties editing
- **ColorPickerComponent**: Color selection modal
- **MatrixModalComponent**: Matrix coordinate annotation tool
- **ImportExportComponent**: Import/export dialogs

## Usage

Components are typically accessed through page objects:

```typescript
const editor = new KeyboardEditorPage(page)
await editor.toolbar.addKey()
await editor.canvas.clickAt(100, 100)
```

## Creating New Components

1. Extend from a base class if needed
2. Encapsulate all selectors as private members
3. Expose public methods for user actions
4. Handle waits and assertions internally
5. Add JSDoc comments for all public methods
