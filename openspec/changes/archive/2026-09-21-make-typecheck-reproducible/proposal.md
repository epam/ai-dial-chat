## Why

Workspace typechecking is not a gate today. Measured on `13f09a8f8` (Node
v20.19.5, npm 11.16.0), a deliberate type error injected into a **test** source
of `chat-overlay-sandbox` exits `0` on a Nx cache hit, and the reusable PR
workflow `epam/ai-dial-ci/.github/workflows/node_pr.yml@4.11.0` runs **no
typecheck job at all**. Two projects are additionally red right now, so the
documented `npm run verify:full` cannot be run to green from a developer's
machine.

## What Changes

- **Fix the genuine type defect in `apps/chat-api/src/auth/tests/auth-metrics.spec.ts`.**
  `MetricData` is a union, so `metric.dataPoints` widens to a union of array
  types that `flatMap` cannot infer through (`TS2322` at 697:28, `TS18046` at
  698:41). The sensitive-data assertion — that `sid-1`, `user-1`,
  `access-token`, `refresh-token` never appear as metric attribute values —
  is preserved verbatim; only the traversal is given an explicit element type.
  No `any`, no double casts, no `@ts-expect-error`.
- **Stop TypeScript declaration output and Vite bundle output from sharing one
  directory.** `apps/chat-overlay-sandbox/tsconfig.app.json` emits declarations
  into `dist`, which is exactly what its Vite `build` target owns with
  `emptyOutDir: true` and what Nx restores wholesale from the build cache. When
  the declarations are removed but `dist/tsconfig.app.tsbuildinfo` survives,
  `tsc --build` reports the project "up to date" and never re-emits, so the
  referencing spec project reports 7 × `TS6305` indefinitely. 26 sibling
  libraries already use the safe convention (`../../dist/libs/<name>`); this
  change extends it to the four projects that still collide.
- **Make Vite-derived typecheck targets cache-sound.** 29 of 32 typecheck
  targets declare `inputs: ["production", "^production", …]` and **no
  `outputs`**. Test sources are therefore not cache inputs (a broken spec file
  is a cache hit), and the `.d.ts` files a dependent project references are
  never captured or restored (Nx reports "existing outputs match the cache"
  with `dist/` absent). Both gaps are closed.
- **Add a repository-owned `typecheck` PR job.** The reusable workflow's three
  jobs are `npm run format` (`prettier --write` — cannot fail), `npm run lint`
  (`--fix` — cannot fail on auto-fixables) and `npm run test` (Vitest/esbuild,
  which strips types without checking them). Nothing typechecks.
- **BREAKING for CI only:** PRs with type errors that merge today will be
  blocked. No runtime, published-package or API contract changes.

## Capabilities

### New Capabilities

- `workspace-typecheck-verification`: what a workspace typecheck must cover
  (production and test sources of every configured project), how its results
  must invalidate, what declaration artifacts it must produce and restore, and
  the observable PR check that enforces it.

### Modified Capabilities

None. No existing spec's required behavior changes; `chat-overlay-sandbox` and
`chat-hooks-package-distribution` keep their current requirements.

## Impact

- **Tooling config:** `nx.json` (`targetDefaults.typecheck`); the `outDir` /
  `tsBuildInfoFile` of every app's `tsconfig.app.json` under `apps/*` and every
  library's `tsconfig.lib.json` under `libs/*`, moved to a uniform
  `out-tsc/{app,lib}` convention so the single `targetDefaults.typecheck`
  `outputs` glob is correct everywhere — 4 apps and 27 of 28 libraries (see
  design.md D2 for why uniformity, not just the 4 originally-colliding
  projects, is required). **Exception:** `libs/chat-api-client/tsconfig.lib.json`
  keeps `outDir: "dist"` unchanged (its `dist` is the actual npm-publishable
  `tsc` build output, not an incidental typecheck artifact); it instead gets a
  narrow `typecheck.outputs` override in its own `package.json`.
- **No source or runtime code is touched by the tsconfig/package.json edits** —
  only TypeScript output-path settings and one Nx target-metadata field.
- **One test file:** `apps/chat-api/src/auth/tests/auth-metrics.spec.ts`
  (traversal typing only; assertions unchanged).
- **CI:** a new `typecheck` job in `.github/workflows/pr.yml`. Making it
  *required* is a branch-protection setting owned outside this repository and
  is therefore a follow-up request, not a deliverable of this change.
- **Docs:** `docs/architecture.md`, root `README.md`, `AGENTS.md` verification
  commands.
- **Not affected:** runtime behavior, published package contracts, bundler
  module resolution, generated `chat-api-client` sources, i18n. No new
  user-visible strings; no UI, RTL or accessibility surface is touched.

## Non-Goals

Recorded as follow-ups, explicitly out of scope: the NestJS migration,
dependency upgrades or dependency-ownership cleanup, Knip, Vitest-config
consolidation, frontend refactoring, and the production memory issue. Also out
of scope: weakening any check to go green — `strict`, `noUnusedLocals`,
`noUnusedParameters`, `skipLibCheck`, test inclusion, public-API validation and
module boundaries all stay as they are, and no new broad `exclude` entries or
error-suppression comments are introduced.

## Alternatives Considered

1. **Conservative: fix only the two red projects.** Cheapest, but leaves the
   cache unsound — the injected-test-error probe still exits `0` — so the gate
   would remain decorative. Rejected as not meeting the goal.
2. **Make `typecheck` depend on `build`.** Would guarantee declarations exist,
   but `build` already depends on `^build` and `^typecheck`, so this closes a
   `typecheck → build → ^typecheck` loop and forces full bundling of every
   project just to typecheck. Rejected on cycle and cost grounds.
3. **Selected: correct the target contracts.** Separate the declaration output
   directory from the Vite output directory, declare the real `inputs`
   (including test sources) and `outputs` (declarations + `tsbuildinfo`) on the
   typecheck targets, and let Nx's existing `^typecheck` edge plus
   `dependentTasksOutputFiles` supply references in order. No new task edges,
   no duplicate writers, no manual pre-build step.
4. **Replace `tsc --build` with per-project `tsc --noEmit`.** Removes the
   declaration-ordering problem entirely, but discards project references and
   incremental reuse, and `composite` in `tsconfig.base.json` forbids `noEmit`.
   Rejected as a larger, slower change.

## Acceptance Criteria

- From a disposable checkout with lockfile-installed dependencies and no
  pre-existing `dist`, `tsbuildinfo` or Nx cache, the documented full command
  passes for every configured typecheck project.
- A deliberate type error in a **production** source and, separately, in a
  **test** source each make the full, affected and CI commands exit nonzero
  even after a prior successful cached run; restoring the files returns green.
- Warm re-runs, `build` followed by `typecheck`, and `typecheck` followed by
  `build` all stay correct, and the checks leave tracked files unchanged.
- `auth-metrics` privacy assertions and `chat-overlay-sandbox` behavior tests
  still pass; `npm run validate:docs` passes.

## Rollback

Every edit is a configuration or test-typing change with no runtime effect.
Reverting the commit restores the previous behavior exactly; the only visible
consequence is that PR typechecking stops running. The new CI job can be
disabled on its own by deleting that job from `.github/workflows/pr.yml`,
without touching the tsconfig or `nx.json` changes.
