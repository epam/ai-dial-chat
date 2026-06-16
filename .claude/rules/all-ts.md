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

## Component folder structure

Component folders under `src/components/` must use PascalCase and match the component name (e.g., `RequireAuth/RequireAuth.tsx`). Tests go in a `tests/` subfolder inside the component folder.

Don't write utility functions in the same file as a component. If a helper function is needed, place it in the utils folder of corresponding lib or app. Don't create a narrow util files, instead, place the helper in a more general utils file if possible (e.g., `apps/chat/src/utils/formatting.ts` rather than `apps/chat/src/utils/format-conversation-timestamp.ts`), and export it from there.

Prefer using enums over union types for sets of related string or numeric constants, especially when they are used in multiple places or have associated logic. Enums provide better readability, maintainability, and type safety compared to unions of literal types. Place enums in a 'types' directory. Follow rules from AGENTS.md for naming enums and their members.

Prefer using `interface` over `type` for defining object shapes, and `type` for unions, intersections, and other complex types. Don't place interfaces in a component file expect for Props and State interfaces that are tightly coupled to that component. Instead, place shared interfaces in a 'models' directory.

## Event handler naming

@.cursor/rules/react-event-handler-naming.mdc

## Boolean naming

Boolean variables, state, and props must begin with a semantically clear prefix: `is`, `has`, `can`, `should`, or `will`.

```text
// Correct
isOpen, isLoading, hasError, canSend, shouldRedirect

// Wrong
open, loading, error as boolean, send, redirect
```
