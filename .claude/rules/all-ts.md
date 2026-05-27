---
paths:
  - '**/*.ts'
  - '**/*.tsx'
---

# TypeScript conventions

- **Never** write ternary-in-ternary (nested conditional expressions). Use `if`/`else` blocks, early returns, or a `switch` statement instead.
- Prefer `async`/`await` with `try`/`catch`/`finally` over Promise chains with `.then()`/`.catch()`; use async dynamic imports for `React.lazy` wrappers too.
- Use the `void` operator before Promise-returning calls only for intentional fire-and-forget work where errors are handled internally. Do not add it as a routine prefix for local async helpers.
