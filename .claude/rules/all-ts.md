---
paths:
  - '**/*.ts'
  - '**/*.tsx'
---

# TypeScript conventions

- **Never** write ternary-in-ternary (nested conditional expressions). Use `if`/`else` blocks, early returns, or a `switch` statement instead.
- Prefer `async`/`await` with `try`/`catch`/`finally` over Promise chains with `.then()`/`.catch()`; use async dynamic imports for `React.lazy` wrappers too.
- Prefer arrow-function constants over `function` declarations for local helpers and exported functions.
- Use the `void` operator before Promise-returning calls only for intentional fire-and-forget work where errors are handled internally. Do not add it as a routine prefix for local async helpers.
- Utility/helper files must be named in kebab-case after the exported function (for example, `get-conversation-source.ts`) and must not use the `.utils` suffix.
- Prefer `value == null` over `value === null || value === undefined`, and `value != null` over `value !== null && value !== undefined`, unless you must distinguish `null` from `undefined` explicitly.

## Event handler naming

@.cursor/rules/react-event-handler-naming.mdc

## Boolean naming

Boolean variables, state, and props must begin with a semantically clear prefix: `is`, `has`, `can`, `should`, or `will`.

```ts
// ✅
isOpen, isLoading, hasError, canSend, shouldRedirect

// ❌
open, loading, error (as boolean), send, redirect
```
