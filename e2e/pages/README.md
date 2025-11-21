# Page Objects

This directory contains Page Object Model (POM) classes that encapsulate page interactions and selectors.

## Structure

- **Base Classes**: `BasePage.ts` - Common functionality shared across all pages
- **Main Pages**: Page-level classes (e.g., `KeyboardEditorPage.ts`)
- **Components**: Reusable UI component classes in `components/` directory

## Usage

```typescript
import { KeyboardEditorPage } from './pages/KeyboardEditorPage'

test('example', async ({ page }) => {
  const editor = new KeyboardEditorPage(page)
  await editor.goto()
  await editor.toolbar.addKey()
  await editor.expectKeyCount(1)
})
```

## Best Practices

- Each page/component should have a single responsibility
- Methods should represent user actions (not implementation details)
- Use descriptive method names that reflect user intent
- Handle waits internally (tests shouldn't need explicit waits)
- Return page objects to enable method chaining when appropriate
