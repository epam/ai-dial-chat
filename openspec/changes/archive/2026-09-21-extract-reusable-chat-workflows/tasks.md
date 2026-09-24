## 1. Skill import vertical slice

Strategy: vertical slices. Complete 1 before 2, 2 before 3, then 4. No new backend, global context or package. Every TypeScript edit uses extensionless relative code imports and retains bundler module resolution. Each library task must satisfy the architecture guard in section 4; it is not permission to add host integration inside a library.

- [x] 1.1 Add the public headless import contract and controller in `libs/chat-hooks/src/skill/useSkillArchiveImport/useSkillArchiveImport.ts`, with status/error types and exports in `src/index.ts` and `src/entry-points/skill-editor.ts`. Implement the existing filename precheck, status mapping, in-flight exclusion and injected completion/error callbacks; keep request setup, translations and notifications in the app.

  **Verification:** After 1.2, run `npm run test:file -- libs/chat-hooks/src/skill/useSkillArchiveImport/tests/useSkillArchiveImport.spec.ts`. Confirm no app/i18n/configured-client imports.

- [x] 1.2 Add controller behavior tests in `libs/chat-hooks/src/skill/useSkillArchiveImport/tests/useSkillArchiveImport.spec.ts`: ZIP/exact SKILL.md, wrong-case Markdown/drop rejection, empty selection, duplicate pending submission, same-file retry, mapped/generic errors, refresh rejection without repeated import, and late completion after unmount. Follow existing cases in `apps/chat/src/hooks/skills/tests/useSkillArchiveImport.spec.ts`.

  **Verification:** Run `npm run test:file -- libs/chat-hooks/src/skill/useSkillArchiveImport/tests/useSkillArchiveImport.spec.ts`; assert observable state and callback outcomes.

- [x] 1.3 Extract `libs/skills/src/components/SkillArchiveUploadDialog/SkillArchiveUploadDialog.tsx` and named public props/labels; export from `libs/skills/src/index.ts`. Migrate `apps/chat/src/components/SkillArchiveUploadDialog/SkillArchiveUploadDialog.tsx` and `apps/chat/src/hooks/skills/useSkillArchiveImport.ts` to real host adapters. Reuse existing translation keys and success/refetch/trace-ID behavior.

  **Verification:** Run `npm run test:file -- libs/skills/src/components/SkillArchiveUploadDialog/tests/SkillArchiveUploadDialog.spec.tsx`, `npm run test:file -- apps/chat/src/components/SkillArchiveUploadDialog/tests/SkillArchiveUploadDialog.spec.tsx`, and `npm run test:file -- apps/chat/src/hooks/skills/tests/useSkillArchiveImport.spec.ts`. Keep or relocate tests according to final adapter ownership; remove only obsolete tests of copied internals.

- [x] 1.4 Add automated dialog keyboard/focus, accessible error/live-status and RTL checks in the dialog tests; preserve mobile behavior and owning-package CSS/class contracts. Document the import API in `libs/chat-hooks/README.md` and `libs/skills/README.md`.

  **Verification:** Run the dialog test files from 1.3, `npm run validate:docs`, and one `npm run verify:changed` for this completed slice.

## 2. File attachment picker vertical slice

Depends on completed slice 1 for delivery order; it does not depend on skill-import runtime code.

- [x] 2.1 Add `libs/chat-hooks/src/files/useFileAttachmentPicker/useFileAttachmentPicker.ts` and its named public types/exports in `src/index.ts` and `src/entry-points/file-manager.ts`. Compose existing file-manager/tab hooks; move selection/tab/eligibility behavior from `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`. Reuse canonical hidden/MIME helpers; do not copy the final attach handler or change existing controller/result shapes.

  **Verification:** After 2.2, run `npm run test:file -- libs/chat-hooks/src/files/useFileAttachmentPicker/tests/useFileAttachmentPicker.spec.ts`; typecheck the returned fields against existing shared-modal props without casts or raw AG Grid types.

- [x] 2.2 Add behavioral tests in `libs/chat-hooks/src/files/useFileAttachmentPicker/tests/useFileAttachmentPicker.spec.ts` for defensive Set copying, tab resets, allowed tabs, hidden paths, MIME wildcards, absent metadata, exact/over size limits and folder policy. Retain the existing shared modal tests as the authority for final filtering, folder overlap/count and loading/busy behavior.

  **Verification:** Run `npm run test:file -- libs/chat-hooks/src/files/useFileAttachmentPicker/tests/useFileAttachmentPicker.spec.ts` and `npm run test:file -- libs/chat-shared/src/file-manager/FileManagerAttachModal/tests/FileManagerAttachModal.spec.tsx`.

- [x] 2.3 Migrate `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx` to the new composition, retaining `useDialFileManagerHostOptions`, labels, notifications, normalized folder-path resolver and existing `FileManagerAttachModal`. Update its integration tests for selection/upload constraints, permissions, busy states and close/reopen behavior; keep auto-selection filtered by the existing shared modal.

  **Verification:** Run `npm run test:file -- apps/chat/src/components/DialFileManagerModal/tests/DialFileManagerModal.spec.tsx` and the shared-modal test from 2.2. Check there is no app-local duplicate picker state machine. Update `libs/chat-hooks/README.md`, run `npm run validate:docs` and one `npm run verify:changed` for this slice.

## 3. Prompt selector vertical slice

Depends on completed slice 2 for delivery order; no runtime dependency on either previous new workflow.

- [x] 3.1 Add `libs/prompts/src/hooks/usePromptSelectorOverlay/usePromptSelectorOverlay.tsx`, structural input/labels/options/result models under `libs/prompts/src/models/`, and owning exports in `libs/prompts/src/index.ts`. Compose existing favorites/parameter UI and canonical variable helpers; inject enablement, favorites callbacks, text insertion and the host catalog renderer.

  **Verification:** After 3.2, run `npm run test:file -- libs/prompts/src/hooks/usePromptSelectorOverlay/tests/usePromptSelectorOverlay.spec.tsx`. Confirm no API DTO, parent context, router, i18n or catalog-implementation imports.

- [x] 3.2 Add workflow tests in `libs/prompts/src/hooks/usePromptSelectorOverlay/tests/usePromptSelectorOverlay.spec.tsx`: favorite removal, immediate insertion, browse/direct parameters, Back, cancel, submit-once, popover unmount survival, disabled mode and injected catalog. Add explicit keyboard/RTL/focus tests; retain existing parameter grammar and validation tests.

  **Verification:** Run the new workflow test plus `npm run test:file -- libs/prompts/src/components/PromptParametersPopup/tests/PromptParametersPopup.spec.tsx` and `npm run test:file -- libs/prompts/src/components/FavoritePromptsPanel/tests/FavoritePromptsPanel.spec.tsx`. Use role/label/text queries.

- [x] 3.3 Migrate `apps/chat/src/components/PromptSelector/usePromptSelectorOverlay.tsx` to a host adapter supplying existing contexts, translated labels and `useUiFeature(OverlayFeature.Prompts)`. Retain the lazy `PromptCatalogModal.tsx` as host rendering. Remove or reduce `PromptSelectorOverlay.tsx` and `PromptParametersPopupOverlay.tsx` only where their actual rendering responsibilities now belong to the library. Add adapter tests under `components/PromptSelector/tests/` for disabled parent mode and direct Catalog entry.

  **Verification:** Run `npm run test:file -- apps/chat/src/components/PromptSelector/tests/usePromptSelectorOverlay.spec.tsx` and the workflow test from 3.2. Confirm the adapter has no independent browse/pending/origin state. Update `libs/prompts/README.md`, run `npm run validate:docs` and one `npm run verify:changed` for this slice.

## 4. Independent consumer, adoption documentation and final verification

Depends on all three migrated parent flows.

- [x] 4.1 Narrowed from the original combined-runtime-fixture plan (see design.md Decision 5): no new runtime-test phase, no Vitest/jsdom/Testing Library installed inside an isolated consumer, no combined synthetic host application. Instead: (a) re-run the existing `libs/chat-hooks/e2e-fixtures` `skill-editor` and `file-manager` subpath fixtures to confirm they still pass now that they reach `useSkillArchiveImport`/`useFileAttachmentPicker` — no new chat-hooks fixture code needed, since those two exports are already inside the existing subpath entries; (b) add a new `tools/reusable-workflows-consumer-fixture`. Revised after review: its first version modeled `tools/attachment-canvas-consumer-fixture`'s pack/install pattern verbatim, which left every peer (`react`, `@epam/ai-dial-chat-shared`, `@epam/ai-dial-ui-kit`) resolving by ancestor `node_modules` lookup up to the workspace root and could not prove an external consumer's install would actually succeed; it also typechecked the packed artifacts against a hand-written bridge file compensating for a declaration-path bug this change itself introduced (a misplaced Vitest `resolve.alias` in `libs/skills`/`libs/prompts`' `vite.config.mts`, corrupting `vite-plugin-dts`'s emitted `@epam/ai-dial-chat-shared` import path). The fixture now reuses `libs/chat-hooks/e2e-fixtures/harness.mjs`'s `createFixtureDependencyResolver`/`createFixtureDir`/`typecheckFixture`/`bundleFixture` to materialize outside the repo checkout and resolve+install the full explicit dependency/peer closure (no `--legacy-peer-deps`, no compensating bridge — the alias bug is fixed at the source), and its bundle check additionally asserts `usePromptSelectorOverlay`'s AG-Grid lazy-loading boundary holds against the packed artifact (main chunk excludes `ag-grid-community`; a separate emitted chunk includes it, proving the split is real).

  **Verification:** Run `npm exec nx run @epam/ai-dial-chat-hooks:test-packed-smoke` and `npm exec nx run @epam/ai-dial-chat-hooks:test-packed --only=skill-editor,file-manager`. Run the new fixture's `verify` target and confirm both CSS assets reach its isolated build. Re-run the focused workflow Vitest files from 1.2, 2.2 and 3.2 only if fixture integration reveals an implementation defect (it must not require adding runtime behavior tests here — those already exist).

- [x] 4.2 Add package contract assertions for new exports and declaration reachability, and assert prompt-only bundling introduces no eager file-manager/editor/canvas engines. Audit the touched manifests/entry points against the isolation rules: no app/server-api/context/auth/env/storage/routing/feature-flag/telemetry imports or client setup; no generated DTO imports in UI packages; no JSX in chat-hooks; no reverse edge from chat-shared; no cross-package proxy exports. Keep runtime dependencies declared according to `.claude/rules/libs.md`.

  **Verification:** Add `libs/chat-hooks/src/entry-points/tests/reusable-workflow-exports.spec.ts` and run `npm run test:file -- libs/chat-hooks/src/entry-points/tests/reusable-workflow-exports.spec.ts`. Also re-run both fixtures from 4.1, because source-export tests cannot prove published resolution or loading boundaries.

- [x] 4.3 Write `docs/reusable-chat-workflows.md` with the concrete client application adoption map, minimal compiling public-API examples, retained labels/callbacks, owning-package CSS and tested artifact set. Update `docs/architecture.md`, the three library READMEs and `libs/chat-hooks/e2e-fixtures/README.md`; add the new guide to the documentation index in `.claude/skills/dial-docs/SKILL.md`. State that actual client application edits and publication are separate follow-ups. Do not include unrelated audit candidates.

  **Verification:** Run `npm run validate:docs`; typecheck the examples through the fixtures from 4.1. Cross-check the adoption map against current client application source without editing it.

- [x] 4.4 Run final non-mutating verification, record results and reconcile the implemented public contracts with these specs. Build is required because exports, declarations, CSS and bundle boundaries change. Leave all out-of-scope findings as follow-up notes, not extra refactors.

  **Verification:** Run `npm run build:quiet`, both fixtures from 4.1, `npm run validate:docs`, then exactly one `npm run verify:full` for the completed change. Run `openspec validate extract-reusable-chat-workflows --strict`. Record failures and do not mark the change implemented until required checks pass.

- [x] 4.5 Preserve the existing `PromptParametersPopup` root export through the shared lazy wrapper, cover its public props/callbacks, and await lazy rendering in the parent adapter test. Confirm packed exports and the lazy bundle boundary remain valid.

### Final review verification (2026-09-21)

- Restored the existing root `PromptParametersPopup` API through a shared lazy wrapper; the workflow uses the same wrapper. Added a public-root interaction test and an explicit packed-export assertion.
- The existing client application's dynamic-import expression typechecks against the built declarations. No previous named root exports were removed.
- Targeted prompt workflow, popup, public-root compatibility, host adapter and metrics tests passed. The full test run also passed the parent frontend/backend and all three workflow libraries.
- `npm run verify:full` initially stopped at an existing metrics-test type inference error. After the test-only correction, the failed backend typecheck passed; all other projects had passed the full typecheck stage.
- Continued the remaining full gates separately: `npm run lint:check:quiet` passed (including repository-wide formatting). `npm run test:full:quiet` exposed package-artifact failures during overlapping Nx runs and one catalog async-test failure. Recovery was sequential: rebuild attachment-canvas without cache; all three failed package-boundary suites passed (25 tests); the catalog suite passed independently (65 tests); both consumer fixtures passed. No failing check remains unresolved.
- `npm run build:quiet` passed on the sequential retry. The reusable-workflows consumer verified installation, declarations, the restored root export, CSS and the AG Grid lazy boundary; the attachment-canvas consumer also passed.
- `npm run validate:docs`, `npm run validate:agent-docs`, strict OpenSpec validation and `git diff --check` passed.
- The metrics test correction and backend README formatting address existing full-gate failures; neither changes backend behavior. No packages were published and no commit or push was made.
