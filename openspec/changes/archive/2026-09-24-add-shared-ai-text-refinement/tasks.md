## 1. First vertical slice: skill Description from backend to editor

Strategy: vertical. Establish the shared endpoint/lifecycle while delivering skill Description end to end, then widen the same path to Instructions and scheduled tasks. Tasks within a slice follow their numbered dependencies; run `verify:changed` once at the slice boundary. New test paths below are files to create, not claims that they already exist. Use `npm run test:file -- <path>` for each listed file; this repository helper routes verification through Nx. Resolve full project names/targets through `npm exec nx show project <name> --json` before project-wide tasks.

- [x] 1.1 Add `apps/chat-api/src/text-refinement/dto/refine-text.dto.ts`, the purpose string enum, controller/service/module, and skill Description prompt. Register in `apps/chat-api/src/app/app.module.ts`; implement `refineText`, bounded input/output, typed errors, `no-store`, caller credentials through `DialClientService`, 30-second timeout/disconnect cleanup, and no body logging. Declare all four purposes in the contract; remaining purpose prompts are delivered in slices 2/3 before feature release. Follow `apps/chat-api/AGENTS.md` rather than the removed `AppService` reference.

  **Verification:** `npm run test:file -- apps/chat-api/src/text-refinement/tests/text-refinement.service.spec.ts` and `npm run test:file -- apps/chat-api/src/text-refinement/tests/text-refinement.controller.spec.ts` (tests from 1.3/1.4).

- [x] 1.2 Reuse existing optional `UTILITY_MODEL` with unchanged string validation in `apps/chat-api/src/config/environment.config.ts`; expose optional boolean `config.aiTextRefinementAvailable` through `app-config/dto/client-config-response.dto.ts` and `app-config.service.ts`. Use existing auth/CSRF and purpose-aware scheduled-task feature evaluation; add no new feature/role system. Keep `.env` untouched; an unset/blank utility model disables the capability.

  **Verification:** `npm run test:file -- apps/chat-api/src/config/tests/text-refinement-environment.spec.ts`, `npm run test:file -- apps/chat-api/src/app-config/tests/app-config.service.spec.ts`, and `npm run test:file -- apps/chat-api/src/text-refinement/tests/text-refinement.controller.spec.ts`.

- [x] 1.3 Add dedicated service/prompt/config unit tests for valid results, exact input preservation, model absence/invalid configuration, permission/quota/upstream/network errors, empty/malformed/truncated/oversized responses, timeout/abort cleanup, and absence of sensitive content in logs. Mock the SDK; do not invoke live models.

  **Verification:** `npm run test:file -- apps/chat-api/src/text-refinement/tests/text-refinement.service.spec.ts` and `npm run test:file -- apps/chat-api/src/config/tests/text-refinement-environment.spec.ts`.

- [x] 1.4 Add Supertest integration tests using production-like versioning, ValidationPipe, guards, and HTTP handling: 200 response, 400 unknown/missing/blank/non-string/oversized input, auth/CSRF and scheduled-purpose denial, global body-size rejection, 429, 502, and 503. Assert rejections do not invoke the model. Cover Unicode boundary lengths and attempt to inject model/systemPrompt/context.

  **Verification:** `npm run test:file -- apps/chat-api/src/text-refinement/tests/text-refinement.controller.spec.ts`.

- [x] 1.5 Complete Swagger operation/DTO/response/error annotations, run `npm run openapi` and `npm run openapi:check`, then `npm exec nx build chat-api-client` and `npm exec nx lint chat-api-client`. Verify typed `TextRefinementApi.refineText` and the optional config field; never hand-edit `libs/chat-api-client` generated files.

  **Verification:** `npm run test:file -- apps/chat-api/src/text-refinement/tests/text-refinement.controller.spec.ts`, plus the generation/build/lint commands above and `npm run validate:docs` if metadata/public API documentation changes.

- [x] 1.6 Add the configured `textRefinementApi` singleton in `apps/chat/src/server-api/api-client.ts` and normal generated-method wrapper in `server-api/text-refinement.api.ts`, with signal forwarding and purpose selection at the app edge. Introduce stable optional host callbacks using the existing AppConfig context and missing-availability=false compatibility.

  **Verification:** `npm run test:file -- apps/chat/src/server-api/tests/text-refinement.api.spec.ts` covers DTO mapping, returned text, signal propagation, and failure propagation.

- [x] 1.7 Add `libs/chat-shared/src/hooks/useTextRefinement.ts`, its minimal exported types/string state enum, and root export. Implement baseline retention across repeated refinements, no-change handling, silent abort, live-revision checks, controlled-value acknowledgement, reset, and late-response suppression. No app integration belongs in the hook.

  **Verification:** `npm run test:file -- libs/chat-shared/src/hooks/tests/useTextRefinement.spec.ts` (dedicated tests in 1.8). Architecture guard: no routes/generated clients/server-api imports, auth/cookies/env/flags, app contexts, telemetry, SDK setup, persistence, or deployment details in hand-authored library code. Keep TypeScript relative code imports extensionless and existing bundler resolution unchanged.

- [x] 1.8 Add dedicated hook tests with deferred promises covering success + Undo, repeated refinement, manual edits, independent instances, callback identity changes/removal, whitespace results, retry, external replacement, reset with equal text, unmount, and callbacks that ignore abort. Exercise result updates through a controlled consumer so the hook does not invalidate its own successful change.

  **Verification:** `npm run test:file -- libs/chat-shared/src/hooks/tests/useTextRefinement.spec.ts`.

- [x] 1.9 Use UI Kit MCP `searchEntity`/`getEntityDetails` to confirm current 2.0 text-button, spinner, Textarea label contracts. Add the optional callback/label/style props in `libs/skill-editor/src/models/skill-editor-props.ts` and implement Description action/feedback in `components/SkillEditor/SkillEditor.tsx` and its SCSS. Wire `apps/chat/src/pages/SkillEditor/SkillEditor.tsx` for both create and edit. Preserve `onValuesChange`, latest sibling values, dirty tracking, reseeding, and Cancel/Back; coordinate pending/Save locally.

  **Verification:** `npm run test:file -- libs/skill-editor/src/components/SkillEditor/tests/SkillEditorRefinement.spec.tsx` and `npm run test:file -- apps/chat/src/pages/SkillEditor/tests/SkillEditorRefinement.spec.tsx` cover callback opt-in, empty/pending, replace/undo/error, signals, and create/edit host mapping.

- [x] 1.10 Add `textRefinement.action`, `.undo`, `.error`, `.pending`, `.success`, `.restored`, and `.unchanged` to `apps/chat/src/i18n/locales/en.json` and all existing locale dictionaries (this checkout currently contains only `en.json`); cover caller-supplied Arabic labels in RTL tests. Pass translated optional labels from the host with English library defaults; do not add i18n imports to libs.

  **Verification:** `npm run test:file -- libs/skill-editor/src/components/SkillEditor/tests/SkillEditorRefinement.spec.tsx` and `npm run test:file -- apps/chat/src/pages/SkillEditor/tests/SkillEditorRefinement.spec.tsx` check defaults and supplied translated labels.

- [x] 1.11 Update `libs/chat-shared/README.md`, `libs/skill-editor/README.md`, `apps/chat-api/README.md`, `.env.template` under `apps/chat-api`, and `docs/architecture.md` domain/API map and any affected architecture diagram in the same slice. Document exact callable props/hooks, availability, limits, Undo lifetime, endpoint and model variable; examples must match exports. Run the slice gate.

  **Verification:** `npm run test:file -- libs/chat-shared/src/hooks/tests/useTextRefinement.spec.ts`; `npm run validate:docs`; `npm run verify:changed`; `npm run build:quiet` because public exports and the new backend module affect bundling. No manual testing task is required.

## 2. Second vertical slice: skill Instructions

Depends on slice 1. Reuse the endpoint, host wrapper, and shared lifecycle without a second transport or prompt DTO.

- [x] 2.1 Add the skill Instructions server prompt in `apps/chat-api/src/text-refinement/prompts/`; enforce Markdown/language/code/placeholder preservation and output completion/limits. Add fixture-based prompt/service coverage and extend the endpoint happy path for `skill-instructions`.

  **Verification:** `npm run test:file -- apps/chat-api/src/text-refinement/tests/text-refinement.service.spec.ts` and `npm run test:file -- apps/chat-api/src/text-refinement/tests/text-refinement.controller.spec.ts`.

- [x] 2.2 Confirm MarkdownEditor naming and toolbar behavior with UI Kit MCP; implement Instructions label-row action and pending/Undo/error presentation in `libs/skill-editor/src/components/SkillEditor/SkillEditor.tsx`. Wire `onRefineInstructions` in the skill page; ensure both Refine actions and Save share the form busy guard, while the other field remains editable. Keep code blocks and current editor naming/preview behavior intact.

  **Verification:** `npm run test:file -- libs/skill-editor/src/components/SkillEditor/tests/SkillEditorRefinement.spec.tsx`, `npm run test:file -- apps/chat/src/pages/SkillEditor/tests/SkillEditorRefinement.spec.tsx`, and `npm run test:file -- apps/chat/src/pages/SkillEditor/tests/SkillEditorPreview.spec.tsx`.

- [x] 2.3 Extend dedicated regression coverage for cross-field edits, fast duplicate clicks, keyboard submit while pending, toolbar edit cancellation, independent Undo baselines, reseeding, and ignored late responses; document Instructions behavior in `libs/skill-editor/README.md` and run the slice gate.

  **Verification:** `npm run test:file -- libs/skill-editor/src/components/SkillEditor/tests/SkillEditorRefinement.spec.tsx`; `npm run test:file -- apps/chat/src/pages/SkillEditor/tests/SkillEditorRefinement.spec.tsx`; `npm run validate:docs`; `npm run verify:changed`.

## 3. Third vertical slice: scheduled-task Description and Instructions

Depends on slices 1/2. Use the same API and lifecycle with the two scheduled-task purposes and the controlled `prompt` field.

- [x] 3.1 Add scheduled-task purpose prompts and 500-character Description input/output validation under `apps/chat-api/src/text-refinement/`. Extend service and Supertest tests for both purposes and purpose-aware `features.scheduledTasksEnabled` authorization, including callers who can author skills but cannot create tasks.

  **Verification:** `npm run test:file -- apps/chat-api/src/text-refinement/tests/text-refinement.service.spec.ts` and `npm run test:file -- apps/chat-api/src/text-refinement/tests/text-refinement.controller.spec.ts`.

- [x] 3.2 Add optional callbacks, new optional labels with defaults, and color/typography hooks in `libs/scheduled-tasks/src/models/scheduled-task-create-form-props.ts`. Implement both actions in `components/ScheduledTaskCreateForm/ScheduledTaskCreateForm.tsx` and its SCSS using the shared lifecycle. Keep existing required labels, editor label association, validation, and `onFieldChange('description'/'prompt', text)` intact. Apply the same local request/Save coordination and reset rules as the skill editor.

  **Verification:** `npm run test:file -- libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/tests/ScheduledTaskRefinement.spec.tsx` and `npm run test:file -- libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/tests/ScheduledTaskCreateForm.spec.tsx`. Repeat the library-isolation guard from 1.7 for this lib and declare any actual package dependency changes according to `.claude/rules/libs.md`.

- [x] 3.3 Wire optional callbacks, translated labels, and draft-identity resets in `apps/chat/src/pages/ScheduledTaskCreatePage/ScheduledTaskCreatePage.tsx` and `pages/ScheduledTaskEditPage/ScheduledTaskEditPage.tsx`. Use existing capability/config access and the shared app adapter; do not change model selection, schedule values, task persistence, or offline-credential flow.

  **Verification:** `npm run test:file -- apps/chat/src/pages/ScheduledTaskCreatePage/tests/ScheduledTaskCreatePage.spec.tsx` and `npm run test:file -- apps/chat/src/pages/ScheduledTaskEditPage/tests/ScheduledTaskEditPage.spec.tsx` cover availability, both purpose mappings, save payloads after refine/Undo, and equal-text entity switches.

- [x] 3.4 Add the task form lifecycle suite with hidden/one-callback cases, whitespace disabled state, pending/edit-cancellation/Save guards, both success/Undo paths, repeated refine, inline errors preserving original text and validation, manual edit invalidation, cancellation/unmount, and late results. Update `libs/scheduled-tasks/README.md` callbacks/labels/styles/Undo documentation and run the slice gate.

  **Verification:** `npm run test:file -- libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/tests/ScheduledTaskRefinement.spec.tsx`; `npm run validate:docs`; `npm run verify:changed`; `npm run build:quiet` for the changed package/style surface.

## 4. Shared accessibility, RTL, and completion checks

Depends on all three slices. These checks complete cross-form acceptance rather than introduce new product scope.

- [x] 4.1 Add dedicated automated accessibility/RTL coverage to both refinement component suites: logical alignment, field association, keyboard activation, stable pending names, busy/live/error announcements, Undo focus, directional icon handling, optional styling overrides/public class hooks, and 7:1 fallback contrast. Keep mobile-first wrapping and 44x44 hit areas for 360/900/1280/1920 layouts; do not claim layout verification from jsdom alone. Use the repository's browser/component test facilities for rendered geometry if available; otherwise document that geometry remains unverified, without claiming the full acceptance gate passed.

  **Verification:** `npm run test:file -- libs/skill-editor/src/components/SkillEditor/tests/SkillEditorRefinement.spec.tsx` and `npm run test:file -- libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/tests/ScheduledTaskRefinement.spec.tsx`; rendered layout evidence must cover both directions and narrow translated labels.

- [x] 4.2 Verify the final public contract and all four purposes: rerun `npm run openapi`, `npm run openapi:check`, `npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`, and `npm run validate:docs` after the final DTO/docs changes. Confirm one endpoint, normal generated methods, no hand-edited generated client, and no library integration leakage. Ensure architecture documents the new domain even if `ApiEndpoints` is unchanged.

  **Verification:** `npm run test:file -- apps/chat-api/src/text-refinement/tests/text-refinement.controller.spec.ts` and `npm run test:file -- apps/chat/src/server-api/tests/text-refinement.api.spec.ts`, plus the generation/build/lint/docs commands above.

- [ ] 4.3 Run the repository's five-axis quality review via `.claude/skills/code-review-and-quality/SKILL.md`, fix in-scope findings, then close implementation with exactly one `npm run verify:full`. Record deferred preview/context/quota work separately; do not expand this change into those features. Archive only on a subsequent explicit archive request.

  **Verification:** `npm run test:file -- libs/chat-shared/src/hooks/tests/useTextRefinement.spec.ts` for final lifecycle fixes, any affected component/controller files listed above for actual review fixes, and exactly one `npm run verify:full` after fixes.

## Implementation checkpoint (2026-09-24)

All feature slices are implemented: one authenticated endpoint with all four server-owned prompts, generated client, availability-gated host adapters, shared field lifecycle, and both skill/task form integrations. Read-only and toolbar blocking are deliberately deferred by the user's decision. Manual edits cancel pending refinement. No local .env was changed; availability remains off unless UTILITY_MODEL is configured.

Completed verification:

- Dedicated service/controller/environment/app-config suites; shared lifecycle suite; both form suites; host create/edit mapping and existing preview suites; generated-method adapter and capability tests. Final targeted run passed across all five projects.
- Real Chromium checks of both forms at 360/900/1280/1920px in LTR and Arabic RTL; keyboard activation, pending editability, 44px hit targets, wrapping/viewport bounds, Undo focus, and 7:1 standalone fallback contrast passed. Reproduce with npm exec -- nx run @epam/chat:test-refinement-browser; evidence is in tmp/text-refinement-browser/geometry.json.
- Final OpenAPI regeneration/check and generated-client build/lint passed. Documentation validation passed, including public classes and package metadata.
- App/backend/form-library lint passed when run without the blocked typecheck dependency. A direct TypeScript compiler check reports zero diagnostics in changed frontend files (including new tests).
- Five-axis self-review completed; see verification.md for scope and findings.

Task 4.3 remains unchecked because the overall verification gate is not green. Exactly one final npm run verify:full was executed. It stopped at unchanged FileTreeOptions['tabs'] references in libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx:86 and FileManagerAttachModal/FileManagerAttachModal.tsx:45. The failed library declaration emission also produces cascading TS6305/implicit-any diagnostics in the new hook test; the direct source check confirms no hook/test diagnostics independently. The slice verify:changed and build:quiet gates hit the same dependency blocker. Full lint/test stages therefore did not run through verify:full, although targeted feature tests and lint ran separately and passed. Logs: tmp/refinement-verify-full.log, tmp/refinement-final-tests.log, tmp/refinement-lint-final.log, tmp/refinement-libs-lint-final.log.

No archive was performed at the implementation checkpoint. Preview/diff acceptance, contextual refinement, persistence of Undo, custom model selection, and BFF quota management remain out of scope. Read-only behavior is deferred for a later decision.

Configuration follow-up (2026-09-24): per user request, refinement now reuses UTILITY_MODEL, preserving its existing optional-string validation. Availability and calls use its trimmed value; missing/blank disables refinement. Conversation naming retains its existing configuration and credential behavior.

Follow-up verification: all 198 tests in the five affected backend suites passed, including conversation naming regression coverage. Backend typecheck/lint and validate:docs passed. The public API schema is unchanged; OpenAPI regeneration is not required for this internal configuration change. The prior repository-wide file-manager blocker remains recorded; verify:full was not rerun.

## Archive record (2026-09-24)

Archived at the user's explicit request after the known verification blocker was reported. Task 4.3 remains unchecked; archive does not imply that verify:full passed. All 11 requirements and scenarios were synchronized to openspec/specs/ai-text-refinement/spec.md, whose strict validation passed.

The workspace-wide OpenSpec check reports 331 valid specs and four unrelated failures: applications-write-api, chat-hooks-conversation-stream, conversation-share, and file-manager-tabs contain requirements without SHALL/MUST keywords. Those specifications were not modified.
