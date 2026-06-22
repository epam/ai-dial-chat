---
name: dial-testing
description: Reference for testing ai-dial-chat - Vitest + @testing-library/react unit tests (Arrange/Act/Assert, vi.mock + vi.hoisted), Playwright e2e with dial fixtures and page objects, test locations, and run commands. Use when writing or fixing unit or e2e tests, setting up mocks, or running the test suites.
metadata:
  author: ai-dial-chat
  version: "1.0"
---

The full testing guide lives at `.claude/guides/testing-patterns.md`. Read it for the complete reference, then apply the patterns below.

## When this applies

- Writing or fixing unit tests (Vitest) or e2e tests (Playwright)
- Setting up mocks, fixtures, or page objects
- Running the test suites

## Unit tests (Vitest)

- Co-locate in `apps/chat/src/[feature]/__tests__/*.test.ts(x)`.
- Follow **Arrange / Act / Assert** with comments.
- Name tests `it('should ...')`.
- Mock with `vi.mock()`; wrap mock factories in `vi.hoisted()` so they hoist before module evaluation.

```typescript
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('ErrorMessageDiv', () => {
  it('should render the error message', () => {
    // Arrange
    render(<ErrorMessageDiv error={error} />);
    // Act
    const title = screen.getByText(error.title);
    // Assert
    expect(title).toBeInTheDocument();
  });
});
```

## E2E tests (Playwright)

- Place in `apps/chat-e2e/src/tests/[feature].test.ts`.
- Import the fixture: `import { dialTest as test } from '@/src/core/dialFixtures'`.
- Use page objects from `apps/chat-e2e/src/ui/` and builders from `testData/`.

## Commands

| Action | Command |
|--------|---------|
| All unit tests | `npm run test` |
| Unit (chat only) | `npm run nx test chat` |
| Watch | `npm run nx test:watch chat` |
| Coverage | `npm run nx test:coverage chat` |
| All e2e | `npm run nx e2e chat-e2e` |
| Chat e2e | `npm run nx e2e:chat chat-e2e` |

See `.claude/guides/testing-patterns.md` for mocking tables, fixtures, setup, and troubleshooting.
