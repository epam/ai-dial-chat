Slicing: one item per slice, and `chat-api` must be green after each. Paths are under `apps/chat-api/src/` unless stated otherwise. Relative imports are extensionless. This change lands on `refactor/split-conversation-controller` (PR #9713).

## 1. Share-route parity (B8)

- [x] 1.1 Add `share/tests/share-invitation-routes.spec.ts` (design D1). It reads `apps/chat/src/types/routes.ts`, asserts the file exists, extracts `SharedInvitation`, `ConversationSharedInvitation` and `ProjectSharedInvitation`, and compares each with `getInvitationRoutePath(<sample id>) + '/:invitationId'`. A missing or different member fails with the member's name.
- [x] 1.2 Replace the "MUST stay in sync" comment in `share/utils/share-resource.util.ts`, and the one-line note on `PROJECT_SHARE_INVITATION_ROUTE_PATH`, with a pointer to the new spec.
- [x] 1.3 Temporarily change one frontend value locally to confirm that the spec fails and names the member, then revert.

Verification: `npm run test:file -- apps/chat-api/src/share/tests/share-invitation-routes.spec.ts apps/chat-api/src/share/tests/share-invitation.service.spec.ts`

## 2. String enums (B9)

- [x] 2.1 Before converting, add a case to `files/tests/upload-file-content.dto.spec.ts`, or a new `files/tests/upload-file.dto.spec.ts`, that validates `UploadFileDto` with `uploadMode: 'bogus'` and pins the exact message. Run it against the current code.
- [x] 2.2 Add `files/types/upload-mode.enum.ts` (`UploadMode`). Update the following to use it (design D2):
  - `files/dto/upload-file.dto.ts`: `@IsIn(Object.values(UploadMode))` and `enum: Object.values(UploadMode)`;
  - `files/files.controller.ts`: the multipart `uploadMode` schema `enum`;
  - `files/files.service.ts` and `files/upload/files-upload.service.ts`: imports, and the comparison against `UploadMode.CreateOnly`.

  Remove the `UploadMode` union.
- [x] 2.3 Convert `SingleSignalExporter` and `MetricsExporter` in `telemetry/otel-config.ts` to string enums, with `isMetricsExporter` built on `Object.values`. Update the comparisons in `telemetry/otel-sdk.ts` and `telemetry/request-timing.ts`.

Verification: `npm run test:file -- apps/chat-api/src/files/tests apps/chat-api/src/telemetry/tests`, then `npm run openapi` with no diff in `libs/chat-api-client`.

## 3. Nested ternaries (B9)

- [x] 3.1 Rewrite the five sites (design D3):
  - `conversations/listing/conversation-listing.service.ts`;
  - `conversations/listing/conversation-titles.service.ts`;
  - `deployments/details/deployments-details.service.ts` (two sites);
  - `skills/utils/skill-metadata.util.ts`.

  Behavior must not change.
- [x] 3.2 Add `'no-nested-ternary': 'error'` for `apps/chat-api/src` in `apps/chat-api/eslint.config.mjs`. Put a single reasoned `eslint-disable-next-line no-nested-ternary` on the archive-entry result mapping in `files/upload/files-upload.service.ts`.

Verification: `npm run test:file -- apps/chat-api/src/conversations/listing apps/chat-api/src/deployments apps/chat-api/src/skills` and `npm exec nx lint chat-api`.

## 4. Service sub-folders (B9)

- [x] 4.1 `git mv` the two services:
  - `conversations/conversation-generation.service.ts` → `conversations/generation/conversation-generation.service.ts`, and `conversations/tests/conversation-generation.service.spec.ts` → `conversations/generation/conversation-generation.service.spec.ts`;
  - `conversations/conversation-naming.service.ts` → `conversations/naming/conversation-naming.service.ts`, and `conversations/tests/conversation-naming.service.spec.ts` → `conversations/naming/tests/conversation-naming.service.spec.ts`.

  Rewire every importer and keep the provider order in `conversation.module.ts`.
- [x] 4.2 Confirm that `conversations/` has no generation or naming service at its root and that no import still points at the old paths.

Verification: `npm run test:file -- apps/chat-api/src/conversations apps/chat-api/src/projects apps/chat-api/src/telemetry/tests/sse-subscription-metrics.spec.ts`

## 5. Close

- [x] 5.1 Sync this change's four path-only delta specs into `openspec/specs/**` in this PR (design D4). `npm run validate:specs` must pass.
- [x] 5.2 Update `refactoring-backend.md`, a local file that is not committed: mark B8 and B9 done, and record the two #9703 follow-ups (the `throwIfArchiveUploadAborted` rename and the deferred ternary).
- [x] 5.3 `npm exec nx run-many -- -t test lint build typecheck -p chat-api --excludeTaskDependencies --parallel=1` passes, and `npm run openapi` shows no diff. Verified the same way as in `split-conversation-controller` (worktree with a junctioned `node_modules`): Vitest 324 files / 6642 tests, ESLint from the project directory clean, `nx run chat-api:build` pinned with `NX_WORKSPACE_ROOT_PATH` passes, and the typecheck errors other than the TS6305 cascade equal the clean `origin/development` baseline (219 both).
- [ ] 5.4 Run `npm run verify:full` once.
