## Why

`nx run @epam/chat:typecheck` does not type-check anything. Nx infers the target from `apps/chat/tsconfig.json`, but it disables it when a referenced tsconfig sets `noEmit`. `apps/chat/tsconfig.spec.json` is the only tsconfig in the workspace with `"noEmit": true`. The target therefore only echoes "The 'typecheck' target is disabled because one or more project references set 'noEmit: true'" and exits `0`.

As a result, the application is never type-checked:

- The CI `typecheck` job (`.github/workflows/pr.yml`, `nx run-many -t typecheck --all`) reports `@epam/chat` as green without running the compiler.
- `npm run typecheck:full:quiet` and `verify:full` do the same.

Type errors in `apps/chat` have been merging unnoticed. A direct `tsc -p apps/chat/tsconfig.app.json --noEmit` on `development` reports errors in untouched app files. During the F3 refactor, a real type error passed a green "typecheck".

This contradicts the existing `workspace-typecheck-verification` capability: "the run reports a result for every project that declares a `typecheck` target, with no project silently skipped". Of the 36 projects with a `typecheck` target, `@epam/chat` is the only one disabled this way.

## What Changes

- **Enable the target.** Remove `"noEmit": true` from `apps/chat/tsconfig.spec.json`. Its `outDir` (`./out-tsc/vitest`) is already set and `out-tsc` is gitignored. Nx then infers the same `tsc --build --emitDeclarationOnly` target that every other project runs, covering production and test sources.
- **Fix every diagnostic it reports in `apps/chat`.** This follows the existing "Existing checks are not weakened" requirement:
  - no `any`, double casts, `@ts-expect-error` or new `exclude` entries;
  - no compiler option relaxed;
  - test files stay included.

  The set of errors is taken from the CI `typecheck` job on this change's PR. A local junctioned worktree cannot measure it reliably, because libs there resolve through the main checkout. If the count is large, or a fix needs a behavior change rather than a typing fix, implementation pauses and reports first.
- **Guard against silent disabling.** A new `tools/typecheck-targets.spec.mjs` (`node --test`, script `typecheck:targets:test`) builds the Nx project graph. It fails when any project's `typecheck` target is the disabled echo, and names the project. The CI `typecheck` job runs it before `nx run-many -t typecheck --all`.
- **Docs.** `docs/architecture.md` "Typechecking and verification" says "32 as of this writing, out of 33 projects total", but the workspace has 39 projects, 36 of them with a `typecheck` target. Update the count, and add one line on the guard and why `noEmit` must not be set in a project tsconfig.

No runtime behavior changes. Type fixes change types only. If a fix reveals a real bug, it is listed separately in the PR and not silently folded in.

### Non-goals

- Changing `tsconfig.base.json` strictness or any other project's configuration.
- Fixing type errors outside `apps/chat`.
- Changing how `apps/chat` is built or tested.

### Acceptance criteria

- `nx run @epam/chat:typecheck` runs `tsc --build` and exits `0` on a clean checkout. Its output contains no "is disabled" echo.
- `nx run-many -t typecheck --all` in CI passes, with `@epam/chat` actually compiled.
- `npm run typecheck:targets:test` passes. If `"noEmit": true` is re-added to `apps/chat/tsconfig.spec.json`, it fails and names `@epam/chat`.
- No compiler option is relaxed, and no suppression comment, `any` or double cast is added. `git diff` shows only `noEmit` removed from tsconfig files.

### Alternatives considered

1. **Keep `noEmit` and add an explicit `typecheck` target running `tsc --noEmit -p` for app and spec.** It diverges from the 35 other projects' inferred target and from the cache inputs and outputs that `targetDefaults.typecheck` defines. Rejected.
2. **Remove `noEmit` and fix the errors** (chosen). It is the workspace's own pattern, and a one-line config change plus fixes.
3. **Only add the guard and leave fixing the errors for later.** CI would turn red immediately, so the fixes must land in the same change.

### Rollback

Re-adding `noEmit` restores the old silent behavior, which the new guard would then flag. The type fixes are independent and can stay.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workspace-typecheck-verification`: adds a requirement that no project's `typecheck` target may be disabled by configuration, with a repository guard that fails when one is.

## Impact

- **Config:** `apps/chat/tsconfig.spec.json`.
- **Code:** type-only fixes in `apps/chat/src/**`. Their scope is known after the first CI run.
- **Tooling:** new `tools/typecheck-targets.spec.mjs`, a `package.json` script, and one step in the `typecheck` job of `.github/workflows/pr.yml`.
- **Docs:** `docs/architecture.md` "Typechecking and verification".
- **Unaffected:**
  - runtime behavior;
  - libs and `apps/chat-api`;
  - i18n, RTL and a11y.
