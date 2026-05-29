---
paths:
  - '**/*.ts'
  - '**/*.tsx'
---

# TypeScript conventions

- **Never** write ternary-in-ternary (nested conditional expressions). Use `if`/`else` blocks, early returns, or a `switch` statement instead.
- Prefer `async`/`await` with `try`/`catch`/`finally` over Promise chains with `.then()`/`.catch()`; use async dynamic imports for `React.lazy` wrappers too.
- Use the `void` operator before Promise-returning calls only for intentional fire-and-forget work where errors are handled internally. Do not add it as a routine prefix for local async helpers.

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
