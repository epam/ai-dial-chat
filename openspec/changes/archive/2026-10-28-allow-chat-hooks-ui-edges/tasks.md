Slicing: risk-first. Slice 1 adds the lint guards and proves the workspace stays green with them. A real import that matches a guard is the only risk; the inventory found none. Slice 2 adds the regression tests, slice 3 the docs. design.md is skipped: the mechanism (`no-restricted-imports` blocks carrying `relativeImportExtensionPattern`) is the one `enforce-nx-module-boundaries` D7 already established.

## 1. Guards

- [x] 1.1 In `eslint.config.mjs`, after the general `**/*.ts` block, add a block for `libs/chat-hooks/src/**/*.{ts,tsx}`. It ignores `**/*.spec.*` and `**/tests/**` and sets `no-restricted-imports` with two patterns:
  - `relativeImportExtensionPattern`;
  - one `{ group: [<every type:ui package and its /* subpaths>], importNamePattern: '^use[A-Z]', message }`.

  Build the group list from the 25 `type:ui` package names in `libs/*/package.json`, as a const named for what it holds.
- [x] 1.2 Add a second block for `libs/*/src/**/*.{ts,tsx}`. It ignores `libs/chat-hooks/**` and `libs/toolset-editor/**`, and sets `no-restricted-imports` with `relativeImportExtensionPattern` plus a pattern for `@epam/ai-dial-chat-hooks` and `@epam/ai-dial-chat-hooks/*`.
- [x] 1.3 `npm exec nx run-many -t lint --skip-nx-cache` passes. If a guard fires on existing code, **stop and report it**; do not narrow the guard.

## 2. Tests

- [x] 2.1 In `tools/module-boundaries.spec.mjs`, add cases mirroring the new scenarios:
  - `chat-hooks` importing `useFavColumns` from `@epam/ai-dial-catalog`: fails;
  - `chat-hooks` importing `CatalogLimitStatus` from it: passes;
  - `catalog` importing `@epam/ai-dial-chat-hooks`: fails;
  - `toolset-editor` importing `getApiErrorDetails`: passes.

  Reuse `boundaryErrors` with `ruleId = 'no-restricted-imports'`.
- [x] 2.2 Add a test that walks `libs/chat-hooks/src` and asserts no `.tsx` exists outside `*.spec.*` files and `tests/` folders.
- [x] 2.3 Prove the new cases can fail. Remove the two blocks temporarily and confirm the two negative lint cases fail; then restore.

Verification: `npm run lint:boundaries:test`

## 3. Docs

- [x] 3.1 `AGENTS.md`: replace the "Known debt against that exception" paragraph with the two allowed edges, their limits and the guards. Add the ownership rule: `chat-hooks` holds hooks, functions, types and enums, never a component.
- [x] 3.2 `docs/architecture.md`:
  - "Module boundary rules": turn the ⚠️ markers into "allowed, guarded" with the limits;
  - add the ownership rule;
  - Decision Log row 17: drop "known debt".
- [x] 3.3 `.claude/rules/libs.md`: one sentence on the ownership rule under "Nx `type:*` tag".
- [ ] 3.4 Run `npm run validate:docs`, `npm run validate:agent-docs` and `npm run validate:specs`, then `npm run verify:full` once.
