---
paths:
  - '**/*.spec.tsx'
  - '**/*.spec.ts'
  - '**/*.test.tsx'
  - '**/*.test.ts'
globs: '**/*.spec.tsx,**/*.spec.ts,**/*.test.tsx,**/*.test.ts'
applyTo: '**/*.spec.tsx,**/*.spec.ts,**/*.test.tsx,**/*.test.ts'
alwaysApply: false
---

# Test file conventions

## File naming and placement

- Test files use the `.spec.tsx` / `.spec.ts` suffix. Never use `.test.tsx` / `.test.ts` for new files.
- Tests live in a `tests/` subfolder inside the component folder (e.g. `Button/tests/Button.spec.tsx`).

## Test framework

Use **Vitest** — never Jest. Import test utilities only from `vitest`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
```

## Selector priority

Query elements with semantic ARIA selectors. Follow this preference order:

1. `getByRole` with `name` option — preferred for interactive elements
2. `getByLabelText` — for form controls and icon buttons with `aria-label`
3. `getByText` — for visible text content
4. `queryBy*` variants — for asserting absence

**Never** use `data-testid`. **Avoid** `container.querySelector` unless testing CSS-level behavior (class names, CSS variables, `style` attributes) where no semantic query applies.

## Interaction style

Prefer `userEvent` from `@testing-library/user-event` for interactions that simulate real user behavior (clicks, typing). Use `fireEvent` only for low-level synthetic events (paste, keyDown with custom shiftKey, change on native inputs) where `userEvent` does not provide a matching API.

```ts
// Preferred for user clicks
await userEvent.click(screen.getByRole('button', { name: 'Send' }));

// Acceptable for synthetic events without a userEvent equivalent
fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
```

## Mocking

- Mock with `vi.mock()` at module level; keep mocked surfaces minimal — expose only the props/methods the test actually exercises.
- For partial mocks of real modules use `vi.mock('module', async (importOriginal) => { const actual = await importOriginal(); return { ...actual, ... }; })`.
- Prefer `vi.mocked(fn)` for typed access to mocked imports.
- Call `vi.clearAllMocks()` in `beforeEach` whenever shared mock state could leak between tests.

## Describe / it naming

- One top-level `describe` per component or unit, named after the exported symbol (e.g. `describe('Header', ...)`).
- Additional `describe` blocks for distinct behaviors or props groups (e.g. `describe('Header — mobile', ...)`).
- `it` descriptions are complete sentences in third-person present tense that state the expected outcome:
  ```
  it('renders the page title')
  it('calls onCreateClick when Create is clicked')
  it('hides the send button when textarea is empty')
  ```

## Render helpers

Extract repeated render calls into an arrow-function helper at the top of the describe block:

```ts
const renderHeader = (props?: Partial<Props>) =>
  render(<Header onMenuToggle={vi.fn()} {...props} />);
```

## Assertions

- Use `expect(element).toBeTruthy()` / `.toBeNull()` for element presence; avoid redundant `.not.toBeNull()` when `.toBeTruthy()` reads more clearly.
- Use `toHaveBeenCalledOnce()` instead of `toHaveBeenCalledTimes(1)`.
- Use `toHaveBeenCalledWith(...)` to assert call arguments rather than inspecting `.mock.calls` directly.
