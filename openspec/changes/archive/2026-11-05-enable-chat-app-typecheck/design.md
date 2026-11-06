## Context

`@nx/js/typescript` infers a `typecheck` target that runs `tsc --build --emitDeclarationOnly` from a project's `tsconfig.json`. If any project reference sets `noEmit: true`, the plugin replaces the command with an echo, because `--build` with `noEmit` is unsupported for references. `apps/chat/tsconfig.json` references `tsconfig.app.json` and `tsconfig.spec.json`, and only the spec config sets `noEmit`.

The Nx project graph has 39 projects. 36 of them have a `typecheck` target, and `@epam/chat` is the only one disabled.

Every other project's spec tsconfig already has an `outDir` and no `noEmit`, for example `libs/chat-hooks/tsconfig.spec.json`. `apps/chat/tsconfig.spec.json` also already has `outDir: ./out-tsc/vitest`, and `out-tsc` is in `.gitignore`.

## Goals / Non-Goals

**Goals:**

- The application is type-checked by the same command as every other project, locally and in CI.
- The existing diagnostics are fixed without weakening checks.
- A guard keeps this from regressing silently.

**Non-Goals:**

- Changing compiler strictness.
- Fixing other projects.
- Changing build or test.

## Decisions

### D1 — Remove `noEmit`, keep the inferred target

This makes `apps/chat` identical to the libs. It inherits `targetDefaults.typecheck` cache inputs, outputs and `dependsOn` (`^typecheck`) automatically. No project-level target override is added.

### D2 — Measure the errors in CI, fix them type-only

Local measurement is unreliable in a worktree whose `node_modules` is a junction to the main checkout: libs resolve to the main checkout's sources and declarations. The first push of this change runs the CI `typecheck` job on a clean `npm ci` checkout, and its diagnostics list is the work list.

Each diagnostic is fixed in the narrowest way: correct a type, add a missing field to a test fixture, or narrow with a real guard. The suppressions forbidden by "Existing checks are not weakened to reach a green gate" are not used. A fix that would change runtime behavior is reported in the PR as a finding and decided separately.

### D3 — The guard reads the project graph, not tsconfig files

`tools/typecheck-targets.spec.mjs` builds the graph with `createProjectGraphAsync` from `@nx/devkit`, as `tools/module-boundaries.spec.mjs` does. For every node with a `typecheck` target, it asserts that the target's command does not contain the disabled-target text. It also asserts that the target runs `tsc`.

Checking the graph, not just grepping for `noEmit`, also catches any future reason Nx might disable an inferred target. The guard is a `node --test` file next to `tools/module-boundaries.spec.mjs`, and runs as a step of the existing CI `typecheck` job.

## Risks / Trade-offs

- **[Many pre-existing errors]** → If the CI list exceeds about 100 diagnostics, or any fix needs a behavior change, implementation stops and reports with the list, before fixing.
- **[Slower CI typecheck]** → `apps/chat` adds one more `tsc --build`. That is the cost of checking it at all.
- **[`out-tsc/vitest` declarations for spec files]** → They are gitignored and covered by the `{projectRoot}/out-tsc/**` outputs in `targetDefaults`, so they are cached and restored like the other projects' outputs.
