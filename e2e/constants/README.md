# Test Constants

This directory contains constant values used across tests.

## Available Constants

- **selectors.ts**: Centralized UI selectors
- **canvas-dimensions.ts**: Canvas sizing and positioning constants
- **test-data.ts**: Common test data values

## Usage

```typescript
import { SELECTORS } from '../constants/selectors'
import { CANVAS_CONSTANTS } from '../constants/canvas-dimensions'

const button = page.locator(SELECTORS.TOOLBAR.ADD_KEY)
const offset = CANVAS_CONSTANTS.KEY_OFFSET
```

## Best Practices

- Use `as const` for type safety
- Group related constants together
- Add JSDoc explaining purpose and units
- Never use magic numbers in tests - define them here
