---
# Testing Patterns

**Project**: ai-dial-chat
**Unit Framework**: Vitest 4 + @testing-library/react
**E2E Framework**: Playwright (Allure reporting)
**Test Locations**: `apps/chat/src/**/__tests__/` (unit), `apps/chat-e2e/src/` (e2e)

---

## Test Organization

```
apps/chat/src/
└── [feature]/__tests__/         Unit tests co-located with source
    └── *.test.ts / *.test.tsx

apps/chat-e2e/src/
├── tests/                       Playwright E2E tests
├── core/                        Fixtures (baseFixtures.ts, dialFixtures.ts)
├── ui/                          Page objects + UI element wrappers
├── testData/                    Builders and test data factories
├── assertions/                  Custom assertion helpers
└── utils/                       Test utilities
```

### Naming Conventions

| Element | Pattern | Example |
|---------|---------|---------|
| Unit test files | `*.test.ts` or `*.test.tsx` | `ErrorMessageDiv.test.tsx` |
| Unit test functions | `it('should ...')` | `it('should render error message')` |
| E2E test files | `*.test.ts` | `chatBarConversation.test.ts` |
| E2E test blocks | `test('...')` | `test('User can create conversation')` |

---

## Running Tests

| Action | Command |
|--------|---------|
| All unit tests | `npm run test` |
| Unit for one project | `npm run nx test chat` |
| Watch mode | `npm run nx test:watch chat` |
| With coverage | `npm run nx test:coverage chat` |
| All E2E | `npm run nx e2e chat-e2e` |
| Chat E2E only | `npm run nx e2e:chat chat-e2e` |
| Overlay E2E only | `npm run nx e2e:overlay chat-e2e` |

---

## Unit Test Pattern

```typescript
// Source: apps/chat/src/components/Chat/__tests__/ErrorMessageDiv.test.tsx:1
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorMessageDiv } from '@/src/components/Chat/ErrorMessageDiv';

describe('ErrorMessageDiv', () => {
  const error = { title: 'Error title', messageLines: ['Line 1'], code: '123' };

  it('should render the correct error message', () => {
    // Arrange
    render(<ErrorMessageDiv error={error} />);
    // Act
    const errorTitle = screen.getByText(error.title);
    // Assert
    expect(errorTitle).toBeInTheDocument();
  });
});
```

### Structure

All unit tests follow **Arrange / Act / Assert** pattern with comments:

```typescript
it('should [expected behavior]', () => {
  // Arrange - setup test data
  // Act - call function or render component
  // Assert - verify result with expect()
});
```

---

## Mocking

### vi.mock + vi.hoisted Pattern

```typescript
// Source: apps/chat/src/utils/app/__tests__/id.test.ts:46
const splitEntityIdMock = vi.hoisted(() =>
  vi.fn((id: string) => {
    const parts = id.split('/').filter(Boolean);
    return { apiKey: parts[0], bucket: parts[1], name: parts.at(-1) };
  }),
);

vi.mock('@/src/utils/app/shared-utils', async (importOriginal) => {
  const actual = (await importOriginal()) as object;
  return { ...actual, splitEntityId: splitEntityIdMock };
});
```

**Rule**: Use `vi.hoisted()` for mock factories that need to be hoisted before module evaluation.

### What to Mock

| Layer | Mock In Unit Tests | Notes |
|-------|-------------------|-------|
| External modules | ✅ `vi.mock('module')` | Hoist with `vi.hoisted` |
| Service classes | ✅ `vi.spyOn(Service, 'method')` | Or mock module |
| Redux store | ✅ Use real store or `vi.mock` | Depends on test scope |
| Browser APIs | ✅ `vi.stubGlobal('fetch', vi.fn())` | jsdom provides most |

---

## E2E Fixture Pattern

Playwright fixtures extend the base `test` object:

```typescript
// Source: apps/chat-e2e/src/core/baseFixtures.ts:35
import { test as base } from '@playwright/test';

const test = base.extend<{
  loginPage: LoginPage;
  localStorageManager: LocalStorageManager;
  providerLogin: ProviderLogin<any>;
}>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
});
```

**E2E test structure:**
```typescript
import { dialTest as test } from '@/src/core/dialFixtures';
import { expect } from '@playwright/test';

test('User can send a message', async ({ dialHomePage, chatMessages }) => {
  await dialHomePage.openHomePage();
  await chatMessages.sendMessage('Hello');
  await expect(chatMessages.getLastMessage()).toBeVisible();
});
```

---

## Test Setup

**Unit test setup file:** `apps/chat/tests/setupTests.ts`
**Vitest config:** `apps/chat/vite.config.ts`

```typescript
// vite.config.ts test section
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: ['./tests/setupTests.ts'],
  include: ['src/**/*.{test,spec}.{ts,tsx}'],
}
```

**E2E environment variables:** Configured via `apps/chat/.env.local`

---

## Coverage

| Setting | Value |
|---------|-------|
| Output dir | `coverage/chat/` |
| Reporters | `text`, `json`, `html` |
| Provider | `v8` |
| Command | `npm run nx test:coverage chat` |

---

## Writing New Tests

### Unit Test Checklist

1. Create: `apps/chat/src/[feature]/__tests__/[Name].test.tsx`
2. Import: `import { describe, expect, it, vi } from 'vitest'`
3. Mock dependencies with `vi.mock()` and `vi.hoisted()`
4. Follow Arrange/Act/Assert structure
5. Run: `npm run nx test chat`

### E2E Test Checklist

1. Create: `apps/chat-e2e/src/tests/[feature].test.ts`
2. Import fixture: `import { dialTest as test } from '@/src/core/dialFixtures'`
3. Use page objects from `ui/` directory
4. Add `test.setTestIds(...)` for traceability
5. Run: `npm run nx e2e:chat chat-e2e`

---

## Common Patterns

| Pattern | When to Use | Example |
|---------|-------------|---------|
| `beforeAll` / `beforeEach` | Setup mocks or test state | `apps/chat/src/utils/app/__tests__/id.test.ts:46` |
| `vi.spyOn` | Track calls on real objects | Spy on service methods |
| `screen.getByText` | Assert visible text | `screen.getByText('Error title')` |
| `screen.queryByText` | Assert element absence | Returns `null` if not found |
| `userEvent` | Simulate user interactions | Click, type in inputs |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Mock not working | Ensure `vi.hoisted()` wraps factories; check import path matches exactly |
| jsdom missing APIs | Add polyfill in `tests/setupTests.ts` |
| E2E auth failing | Check `.env.local` credentials; run `npm run nx e2e chat-e2e -- --headed` |
| Vitest can't resolve `@/` | Check `vite.config.ts` alias: `'@': path.resolve(__dirname, './')` |

---

## Quick Reference

| Need | Location |
|------|----------|
| Vitest config | `apps/chat/vite.config.ts` |
| Unit test setup | `apps/chat/tests/setupTests.ts` |
| E2E base fixtures | `apps/chat-e2e/src/core/baseFixtures.ts` |
| E2E dial fixtures | `apps/chat-e2e/src/core/dialFixtures.ts` |
| E2E page objects | `apps/chat-e2e/src/ui/` |
| E2E test data builders | `apps/chat-e2e/src/testData/` |
| Playwright config | `apps/chat-e2e/playwright.config.ts` |

---
