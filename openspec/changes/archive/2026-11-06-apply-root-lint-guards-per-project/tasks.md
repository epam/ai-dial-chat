Branch: `chore/enable-chat-app-typecheck`.

## 1. Activate the guards

- [x] 1.1 Set `basePath: workspaceRoot` on the four root-relative blocks in `eslint.config.mjs` (design D1). Confirm from `libs/sidebar` that `eslint --print-config` now includes the `role="status"` guard and the importer guard.
- [x] 1.2 Run `nx run-many -t lint --all` and list what the active guards report.

  Result: three `chat-hooks` imports of data-shape package hooks. Two more failures were environment noise:
  - five libs that failed in the parallel run passed when re-run;
  - `scheduled-tasks-consumer-fixture` reported a local `.npm-cache` temp file.

## 2. Narrow and prove

- [x] 2.1 Exempt the data-shape packages from the hooks guard (design D3). Update `AGENTS.md` and `docs/architecture.md`.
- [x] 2.2 Add the project-`cwd` cases and the data-shape exemption case to `tools/module-boundaries.spec.mjs` (design D2).

  Result: all 15 tests pass. With `basePath` removed, the two project-`cwd` cases fail.

## 3. Close

- [x] 3.1 `nx run @epam/ai-dial-chat-hooks:lint` passes, and `validate:docs` passes.
- [ ] 3.2 The CI workspace lint job passes on the PR.
