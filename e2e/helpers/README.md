# Test Helpers

This directory contains helper classes and utilities for common test operations.

## Available Helpers

- **canvas-test-helpers.ts**: Canvas-specific test utilities (existing, being enhanced)
- **wait-helpers.ts**: Deterministic wait strategies
- **assertion-helpers.ts**: Custom assertion helpers
- **retry-helpers.ts**: Retry logic for flaky operations

## Usage

```typescript
import { WaitHelpers } from '../helpers/wait-helpers'

const waitHelpers = new WaitHelpers(page)
await waitHelpers.waitForCanvasReady(canvas)
```

## Best Practices

- Prefer deterministic waits over timeouts
- Add error messages to failed waits
- Document when to use each helper
- Keep helpers focused and single-purpose
