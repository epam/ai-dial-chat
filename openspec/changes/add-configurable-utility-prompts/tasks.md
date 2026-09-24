## 1. Refinement configuration slice

Strategy: vertical slices; naming and transcription depend on the shared fallback rule in slice 1. No shared libraries or API contracts change. Use extensionless relative TypeScript imports.

- [x] 1.1 Add optional prompt settings in `apps/chat-api/src/config/environment.config.ts`, a blank-fallback helper in `apps/chat-api/src/common/utils/resolve-prompt.ts`, and four independent overrides in `apps/chat-api/src/text-refinement/text-refinement.service.ts`.
  - Verification: `npm run test:file -- apps/chat-api/src/text-refinement/tests/text-refinement.service.spec.ts`.
- [x] 1.2 Add helper and refinement regression tests for defaults, blanks, exact multiline content, and purpose isolation.
  - Verification: `npm run test:file -- apps/chat-api/src/common/utils/tests/resolve-prompt.spec.ts`; `npm run test:file -- apps/chat-api/src/text-refinement/tests/text-refinement.service.spec.ts`; then `npm run verify:changed` once for this slice.

## 2. Naming and transcription slice

- [x] 2.1 Apply overrides to the shared naming completion in `apps/chat-api/src/conversations/conversation-naming.service.ts` and transcription instruction in `apps/chat-api/src/transcription/transcription.service.ts`; retain the extracted transcription default in its domain's `prompts/` directory.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/tests/conversation-naming.service.spec.ts`; `npm run test:file -- apps/chat-api/src/transcription/tests/transcription.service.spec.ts`.
- [x] 2.2 Extend those service tests to cover both naming flows, transcription attachments and credentials, exact overrides, and default fallback.
  - Verification: rerun the two exact service test files after test changes.

## 3. Configuration documentation and final validation

- [x] 3.1 Test optional settings and actual quoted multiline `.env` parsing in `apps/chat-api/src/config/tests/prompt-overrides.spec.ts`.
  - Verification: `npm run test:file -- apps/chat-api/src/config/tests/prompt-overrides.spec.ts`.
- [x] 3.2 Document all six settings, fallback, replacement, multiline syntax, and restart behavior in `apps/chat-api/.env.template` and `apps/chat-api/README.md`.
  - Verification: `npm run validate:docs`; documentation examples agree with the config parsing test.
- [x] 3.3 Run targeted backend checks, strict OpenSpec validation, and exactly one final `npm run verify:full`; record unrelated blockers without expanding scope.
  - Verification: the four service/helper files and configuration test above; `openspec validate add-configurable-utility-prompts --strict`; `npm run verify:full`.

## Verification results

- Seven targeted backend test files passed: 219 tests, including controller regressions and environment validation. Refinement tests were rerun after tightening model configuration mocks and passed again.
- `npm run validate:docs`, strict validation of this OpenSpec change, and `git diff --check` passed.
- The first `verify:changed` found a test-only access to a private ConfigService property. Replaced it with a controlled configuration mock; subsequent backend and full workspace typechecks passed (33 projects in the full run).
- Initial backend lint identified import ordering issues in three touched files; corrected them before completion of the final lint phase.
- `verify:full` was invoked exactly once: workspace typecheck passed, then lint stopped on a formatting error in the updated refinement test. After formatting that file, the failed backend lint target and the remaining workspace format-check stage passed independently. The other 35 lint targets passed in the original invocation.
- Self-review covered correctness, readability, architecture, security, performance, and documentation accuracy. No frontend/library boundary, HTTP contract, or UI changes; no new prompt logging or client exposure.
- The remaining `npm run test:full:quiet` stage completed with failures in two existing test files described below. Backend: 206 files / 3899 tests passed, one test failed. Frontend: 176 files / 2393 tests passed, 54 failed and one skipped. All tests added or changed here passed in this full run. The repository-wide verification is not fully green.

## Out-of-scope follow-up

Fix the existing `apps/chat/src/pages/SkillEditor/tests/SkillEditor.spec.tsx` test harness to supply AppConfigProvider (or mock the refinement adapter). The full frontend test run reports 54 failures with `useAppConfig must be used within AppConfigProvider` through `useTextRefinementCallback`; the other 176 frontend test files pass. The page, hook, and test file are unchanged by this backend configuration change.

Isolate environment configuration in `apps/chat-api/src/app-config/tests/app-config.service.spec.ts`: the existing undefined-model case falls through to process environment lookup and reports refinement available during the full suite. The entire file passes when run independently with `npm run test:file -- apps/chat-api/src/app-config/tests/app-config.service.spec.ts`. This file and AppConfigService are unchanged; the new environment-loading test only assigns and restores the six prompt variables.
