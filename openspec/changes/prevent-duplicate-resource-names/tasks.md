# Tasks

Slicing strategy: vertical, risk-first. Group 1 proves the core rule and shared pieces in
isolation, group 2 delivers the #9726 repro end to end, group 3 the #9381 behaviour, group 4
widens to rename, fork and move, group 5 publishes the contract, group 6 finishes the editor
and Save-panel messages. Read `apps/chat-api/AGENTS.md` before group 1. Imports are
extensionless.

## 1. Identity rule and shared pieces (pure core)

- [ ] 1.1 Add `apps/chat-api/src/common/utils/resource-identity.ts` with the tab-membership function (interfaces to Agents/Toolsets, per the table in `resource-name-uniqueness`, always as if the Toolsets tab is enabled), the folder-from-resource-id helper (decoded, bucket root is empty), the displayed-identity normaliser (trimmed name; string as is, locale map by `en` then first entry; stored version; default `1.0.0` when absent) and `findDuplicateIdentity` (candidate identity, tabs, optional `selfId`, own entities filtered by `isMy`). Verification: `npm run test:file -- apps/chat-api/src/common/utils/tests/resource-identity.spec.ts` covers every membership row, folder separation, folder names with spaces and reserved characters, locale maps with and without `en`, other-bucket exclusion, self-exclusion and the default version.
- [ ] 1.2 Add the error-code string enum (`name-taken-agent`, `name-taken-toolset`) and a helper that builds the 409 `ConflictException` with `{ message, code }`, following `apps/chat-api/src/projects/types/project-create-error-code.enum.ts`. Verification: `npm run test:file -- apps/chat-api/src/common/utils/tests/resource-identity.spec.ts` asserts the body shape and message per kind.
- [ ] 1.3 Add `apps/chat-api/src/common/utils/next-free-path.ts` holding the shared candidate limit (20) and the candidate-leaf builder (`name`, `-N` for N greater than 1, `__version`), and switch `apps/chat-api/src/applications/applications.service.ts` to use it without changing behaviour. Verification: `npm run test:file -- apps/chat-api/src/common/utils/tests/next-free-path.spec.ts` and `npm run test:file -- apps/chat-api/src/applications/tests/applications.service.spec.ts` pass unchanged.

## 2. Toolset create is guarded (#9726 repro)

- [ ] 2.1 Add an optional `refresh` argument to `listToolsets` in `apps/chat-api/src/toolsets/listing/toolsets-listing.service.ts` (default keeps today's caching) and export `ToolsetsListingService` from `apps/chat-api/src/toolsets/toolsets.module.ts`. Verification: `npm run test:file -- apps/chat-api/src/toolsets/listing/tests/toolsets-listing.service.spec.ts` covers both branches.
- [ ] 2.2 In `ToolsetsMutationService.createToolset` (`apps/chat-api/src/toolsets/mutation/toolsets-mutation.service.ts`) inject `DeploymentsService`, read own toolsets and deployments fresh (`listDeployments(..., refresh = true)`) in parallel, run `findDuplicateIdentity` against the Toolsets tab for the target `folderPath`, and throw the 409 before `saveToolSet`. Verification: `npm run test:file -- apps/chat-api/src/toolsets/mutation/tests/toolsets-mutation.service.spec.ts` covers an MCP-capable agent conflict, a chat-only agent that does not conflict, another toolset with a renamed path, a different folder accepted, and a failing list read that writes nothing.
- [ ] 2.3 Give `createToolset` the next-free-path fallback behind the identity check, using the shared util from 1.3: on 412 with `createOnly` retry `name-2__version` … up to the shared limit, keep the displayed name, return the id actually written, and only after exhaustion throw the existing `Toolset version already exists` 409. Verification: the same toolsets-mutation spec adds a renamed-toolset-name-reused case, a concurrent-create fallback case and an exhausted-candidates case.
- [ ] 2.4 Add supertest coverage for `POST /api/v1/toolsets` returning the 409 with `code`, the fallback id, and the unchanged exhausted-candidates 409. Verification: `npm run test:file -- apps/chat-api/src/toolsets/tests/toolsets.controller.spec.ts`.

## 3. Application create is guarded (#9381)

- [ ] 3.1 In `ApplicationsService.createApplication` (`apps/chat-api/src/applications/applications.service.ts`) run the check against the Agents tab for the target folder before the write loop, reading deployments with `refresh = true`; keep the next-free-path loop for the renamed-path case. Verification: `npm run test:file -- apps/chat-api/src/applications/tests/applications.service.spec.ts` covers a duplicate agent (409, no `-2`), a renamed-away name reused at the next free path, a different folder, a read failure, and the concurrent-create fallback scenario.
- [ ] 3.2 Add supertest coverage for `POST /api/v1/applications` duplicate and non-duplicate responses. Verification: `npm run test:file -- apps/chat-api/src/applications/tests/applications.controller.spec.ts`.

## 4. Rename, fork and move

- [ ] 4.1 Guard `ToolsetsMutationService.updateToolset` and `moveToolset`: read the stored name, version and folder from the fresh toolsets list entry whose id matches, default an omitted version to `1.0.0` before comparing, run the check only when name, version or folder changes, and exclude the toolset itself. Verification: `npm run test:file -- apps/chat-api/src/toolsets/mutation/tests/toolsets-mutation.service.spec.ts` covers a description-only update (no list read), an omitted version (no check), a rename into an existing identity, and a move into a folder holding the same identity.
- [ ] 4.2 Guard `ApplicationsService.updateApplication`, `forkApplicationVersion` and `moveApplication` with the same rule: take the stored identity and `interfaces` from the fresh deployments entry matching the id (absent entry means Agents only), read toolsets only for a dual-interface application, and check every tab it belongs to. Make `ApplicationsModule` import `ToolsetsModule` (no cycle; see design D10). `commitApplicationVersion` is untouched. Verification: `npm run test:file -- apps/chat-api/src/applications/tests/applications.service.spec.ts` covers rename conflict, dual-interface rename against a toolset, application missing from the list, fork to an existing version, move conflict and the unchanged-identity save.
- [ ] 4.3 Extend the supertest specs for update, fork and move in `apps/chat-api/src/toolsets/tests/toolsets.controller.spec.ts` and `apps/chat-api/src/applications/tests/applications.controller.spec.ts`. Verification: both files pass via `npm run test:file`.

## 5. OpenAPI and generated client

- [ ] 5.1 Update the `@ApiResponse` 409 annotations on the create, update, fork and move handlers in `apps/chat-api/src/toolsets/toolsets.controller.ts` and `apps/chat-api/src/applications/applications.controller.ts` so both conflict shapes are described, and reference the error-code enum from an error response DTO so the generated client exports it. Verification: `npm run openapi` then `npm run openapi:check` is clean and the enum appears in `libs/chat-api-client/openapi.json`.
- [ ] 5.2 Build and lint the generated client: `npm exec nx build chat-api-client` and `npm exec nx lint chat-api-client`; no hand edits under `libs/chat-api-client/src/generated`. Verification: both exit 0.

## 6. Editors and Save panel messages

- [ ] 6.1 Add the two translation keys to `apps/chat/src/i18n/locales/en.json` and matching enum members in `apps/chat/src/constants/translation-keys.ts` (`appsEditor.error.nameConflictAgent`, `appsEditor.error.nameConflictToolset`). Verification: `npm run test:file -- apps/chat/src/pages/ApplicationEditor/tests/toolsetDefinition.spec.tsx` still passes and `grep` shows each key defined once.
- [ ] 6.2 In `apps/chat` wrap the create and new-version save adapters used with the Save panel so a `409` whose `code` is one of the generated enum values (from `@epam/ai-dial-chat-api-client`, no string literals) becomes `ResourceSaveError` with the translated message; add the same mapping to the in-place save branch of `apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx` (including the edit-mode path, which today handles `409` only when creating) and to `apps/chat/src/pages/ApplicationEditor/toolset/ToolsetApplicationEditor.tsx` (which reads only `traceId` today). Unrecognised `409`s keep the current rendering. Verification: `npm run test:file -- apps/chat/src/pages/ApplicationEditor/tests/toolsetDefinition.spec.tsx`, `npm run test:file -- apps/chat/src/pages/ApplicationEditor/tests/quickAppDefinition.spec.tsx` and `npm run test:file -- apps/chat/src/components/ResourceSavePanelContainer/tests/ResourceSavePanelContainer.spec.tsx` assert the inline message, that the panel stays open, that the form keeps its values, and that the edit-mode rename shows the message on the Name field.
- [ ] 6.3 Architecture guard: confirm no hand-authored file under `libs/*` changed and none gained an `/api` path, generated-client import, i18n import or `code` literal; run `npm run validate:lib-duplicates` to confirm `apps/chat` declares no enum duplicating the generated one (the script skips `apps/chat-api` and `libs/chat-api-client`, so the risk is on the app side). Verification: `git diff --stat -- libs` shows only regenerated `libs/chat-api-client` output and the command exits 0.

## 7. Docs and specs

- [ ] 7.1 Update the API documentation that lists these 409 cases (`apps/chat-api/README.md` if it documents toolset and application writes) and run `npm run validate:docs`. Verification: the command exits 0.
- [ ] 7.2 Run `npm run validate:specs` and `npm run spec:impact` and review the changed specs plus the new `resource-name-uniqueness` spec once more against the implemented behaviour. Verification: `validate:specs` exits 0.

## 8. Final integration

- [ ] 8.1 Run `npm run verify:changed` once after group 6, then `npm run build:quiet` because chat-api bundling and the frontend are both touched. Verification: both exit 0.
- [ ] 8.2 Run exactly one `npm run verify:full` to close the change. Verification: exits 0.
