# Playwright E2E Testing Instructions for kle-ng

## Project Structure

```
e2e/
├── *.spec.ts                 # Test files (root level)
├── pages/                    # Page Object Model classes
│   ├── BasePage.ts           # Abstract base class for all pages
│   ├── KeyboardEditorPage.ts # Main application page
│   └── components/           # Reusable UI component classes
│       ├── CanvasComponent.ts
│       ├── ToolbarComponent.ts
│       ├── RotationToolComponent.ts
│       ├── MatrixModalComponent.ts
│       ├── PropertiesPanelComponent.ts
│       └── ThemeComponent.ts
├── helpers/                  # Test helper utilities
│   ├── canvas-test-helpers.ts
│   ├── wait-helpers.ts
│   ├── custom-matchers.ts
│   └── *-helpers.ts         # Feature-specific helpers
├── constants/               # Centralized constants
│   ├── selectors.ts         # All UI selectors (data-testid)
│   └── canvas-dimensions.ts # Canvas sizing/positioning
├── fixtures/                # Test data and fixture factories
│   ├── *.json               # JSON layout fixtures
│   └── layout-factory.ts    # Programmatic fixture generation
└── snapshots/               # Visual regression baselines
    └── *.spec.ts-snapshots/
```

## Core Principles

### 1. Page Object Model (POM) Architecture
- **ALL tests MUST use page objects** - never use raw selectors in test files
- Page objects encapsulate UI interactions and selectors
- Component classes represent reusable UI elements
- Methods represent user actions, not implementation details

### 2. Selector Strategy
- **ALWAYS use data-testid attributes** via `SELECTORS` constant
- Import selectors from `e2e/constants/selectors.ts`
- Update `selectors.ts` when adding new UI elements
- Use semantic selector names: `TOOLBAR.ADD_KEY`, `COUNTERS.KEYS`

### 3. Wait Strategy - CRITICAL
- **NEVER use `page.waitForTimeout()` with arbitrary delays**
- **ALWAYS use deterministic waits** via `WaitHelpers`
- Use `waitForRender()` after canvas operations
- Use `waitForDoubleAnimationFrame()` for simple renders
- Use `waitForQuadAnimationFrame()` for complex operations
- Use `expect.poll()` for state changes

### 4. Visual Regression Testing
- Screenshot tests run **ONLY on Chromium** (use `test.skip()` for other browsers)
- Always call `waitForRender()` before screenshots
- Always `deselectAllKeys()` before layout screenshots
- Use descriptive snapshot names: `feature-state-description.png`
- Set tolerance: `maxDiffPixelRatio: 0.05`, `threshold: 0.2`

## Mandatory Patterns

### Test File Structure

```typescript
import { test, expect } from '@playwright/test'
import { KeyboardEditorPage } from './pages/KeyboardEditorPage'
import { CanvasTestHelper } from './helpers/canvas-test-helpers'

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Setup code
  })

  test('should do specific action', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)
    // Test implementation
  })
})
```

### Using Page Objects

```typescript
// CORRECT
const editor = new KeyboardEditorPage(page)
await editor.goto()
await editor.toolbar.addKey()
await editor.canvas.waitForRender()
await editor.expectKeyCount(1)

// WRONG - Never use raw selectors in tests
await page.click('[data-testid="toolbar-add-key"]')
await page.waitForTimeout(1000)
```

### Canvas Operations

```typescript
// CORRECT - Using CanvasTestHelper
const helper = new CanvasTestHelper(page)
await helper.addKey()
await helper.setKeySize(6.25)
await helper.waitForRender()
await helper.expectCanvasScreenshot('spacebar-6.25u')

// Use CanvasComponent for simpler operations
await editor.canvas.clickKey(0, 1)
await editor.canvas.waitForRender()
await editor.canvas.selectAll()
```

### Wait Patterns

```typescript
import { WaitHelpers } from './helpers/wait-helpers'

const waitHelpers = new WaitHelpers(page)

// Canvas rendering
await waitHelpers.waitForCanvasReady(canvas)
await waitHelpers.waitForDoubleAnimationFrame()

// State changes
await waitHelpers.waitForStateChange(
  async () => await editor.getKeyCount(),
  5,
  { timeout: 5000, message: 'Key count did not reach 5' }
)

// Modal interactions
await waitHelpers.waitForModalReady(modal, content)

// Text changes
await waitHelpers.waitForTextChange(counter, 'Keys: 10')
```

### Visual Regression Tests

```typescript
test.describe('Canvas Rendering', () => {
  // Skip non-Chromium browsers for visual tests
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Canvas rendering tests only run on Chromium'
  )

  let helper: CanvasTestHelper

  test.beforeEach(async ({ page }) => {
    helper = new CanvasTestHelper(page)
    await page.goto('/')
    await helper.clearLayout()
  })

  test('should render layout', async () => {
    await helper.addMultipleKeys(5)
    await helper.deselectAllKeys()
    await helper.waitForRender()
    await expect(helper.getCanvas()).toHaveScreenshot('layout-5-keys.png')
  })
})
```

## Creating New Components

### Page Component Template

```typescript
import { Locator, Page, expect } from '@playwright/test'
import { SELECTORS } from '../../constants/selectors'

/**
 * ComponentName - Brief description
 *
 * Detailed description of what this component handles.
 *
 * @example
 * const component = new ComponentName(page)
 * await component.someAction()
 */
export class ComponentName {
  private readonly locator: Locator

  constructor(private readonly page: Page) {
    this.locator = page.locator(SELECTORS.COMPONENT.MAIN)
  }

  /**
   * User action method
   * @param param - Description
   */
  async performAction(param: string) {
    // Implementation
  }

  /**
   * Assertion method
   */
  async expectState() {
    await expect(this.locator).toBeVisible()
  }
}
```

### Helper Class Template

```typescript
import { Page } from '@playwright/test'

/**
 * FeatureHelpers - Brief description
 */
export class FeatureHelpers {
  constructor(private readonly page: Page) {}

  async performComplexOperation() {
    // Multi-step operation encapsulated
  }
}
```

## Adding New Selectors

Update `e2e/constants/selectors.ts`:

```typescript
export const SELECTORS = {
  FEATURE_NAME: {
    BUTTON: '[data-testid="feature-button"]',
    PANEL: '[data-testid="feature-panel"]',
  },
} as const
```

## Test Data Management

### Using Fixtures

```typescript
// Load JSON fixture
import simpleLayout from './fixtures/simple-layout.json'
await helper.loadJsonLayout(JSON.stringify(simpleLayout))

// Programmatic layout
const layout = JSON.stringify([
  [{ w: 1.5 }, 'Tab', 'Q', 'W'],
  [{ w: 1.75 }, 'Caps', 'A', 'S']
])
await helper.loadJsonLayout(layout)
```

## Common Operations

### Key Management

```typescript
// Add keys
await editor.toolbar.addKey()
await helper.addMultipleKeys(5)

// Select keys
await editor.canvas.clickKey(0, 1)
await editor.canvas.selectAll()
await editor.canvas.deselectAll()

// Delete keys
await editor.toolbar.deleteKeys()
```

### Property Editing

```typescript
// Via helper
await helper.setKeySize(6.25, 1)
await helper.setKeyColors('#ff0000', '#ffffff')
await helper.setKeyLabel('center', 'Space')
await helper.setKeyRotation(45, 1.5, 0.5)

// Via component
await editor.canvas.clickKey(0)
// Then interact with properties panel
```

### Undo/Redo

```typescript
await editor.toolbar.undo()
await editor.toolbar.redo()
await editor.toolbar.expectUndoEnabled()
await editor.toolbar.expectRedoEnabled()
```

### Import/Export

```typescript
import { ImportExportHelpers } from './helpers/import-export-helpers'

const importExport = new ImportExportHelpers(page)
await importExport.importFromFile('fixtures/layout.json')
await importExport.exportToJson()
```

## Playwright Best Practices

### Auto-Waiting

Playwright auto-waits for actionability. Trust it:

```typescript
// CORRECT
await button.click()

// WRONG - Unnecessary
await expect(button).toBeVisible()
await button.click()
```

### Assertions

```typescript
// Use web-first assertions
await expect(locator).toBeVisible()
await expect(locator).toHaveText('Expected')
await expect(locator).toContainText(/pattern/)

// Use soft assertions for multiple checks
await expect.soft(element1).toBeVisible()
await expect.soft(element2).toBeVisible()

// WRONG - Never use non-async assertions
const text = await locator.textContent()
expect(text).toBe('Expected')  // Not web-first
```

### Locators

```typescript
// Prefer data-testid
page.getByTestId('button-name')

// Use specific locators
page.getByRole('button', { name: 'Submit' })

// Filter for specificity
page.locator('.item').filter({ hasText: 'Specific' })

// WRONG - Fragile CSS selectors
page.locator('div > button.btn.btn-primary')
```

### Test Isolation

```typescript
//  Each test is independent
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await helper.clearLayout()
})

// WRONG - Tests depend on each other
let keyCount = 0
test('add key', () => { keyCount++ })
test('verify count', () => { /* depends on previous */ })
```

## Before Writing Tests - Checklist

- [ ] Identify if existing page objects/helpers can be used
- [ ] Add selectors to `constants/selectors.ts` first
- [ ] Create/update component classes if needed
- [ ] Write test using page objects only
- [ ] Use deterministic waits (WaitHelpers)
- [ ] Add screenshot test if visual validation needed
- [ ] Ensure test isolation (independent, clean state)
- [ ] Run test locally on all browsers before committing
- [ ] Verify test passes 3 consecutive times (stability check)
