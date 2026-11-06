Branch: `chore/enable-chat-typecheck`. Diagnostics are measured in CI (design D2).

## 1. Guard first

- [ ] 1.1 Add `tools/typecheck-targets.spec.mjs` (design D3) and the `typecheck:targets:test` script. Run it on the current tree and confirm that it fails and names `@epam/chat`.

## 2. Enable

- [ ] 2.1 Remove `"noEmit": true` from `apps/chat/tsconfig.spec.json`. `npm run typecheck:targets:test` passes, and `nx show project @epam/chat --json` shows a `tsc --build` typecheck command.
- [ ] 2.2 Add `npm run typecheck:targets:test` as a step before "Typecheck all projects" in the `typecheck` job of `.github/workflows/pr.yml`.
- [ ] 2.3 Push as a draft PR and collect the `@epam/chat` diagnostics from the CI `typecheck` job. If there are more than about 100, or any fix needs a behavior change, stop and report the list.

## 3. Fix

- [ ] 3.1 Fix each `apps/chat` diagnostic, type-only, without suppression (design D2). Group commits by area.
- [ ] 3.2 Re-run CI until the `typecheck` job passes.

## 4. Close

- [ ] 4.1 Update `docs/architecture.md` "Typechecking and verification": the project counts (39 projects, 36 with `typecheck`) and one line on the guard and `noEmit`. Run `npm run validate:docs`.
- [ ] 4.2 `npm run validate:specs` passes, and `nx run-many -t test lint -p @epam/chat` passes.
