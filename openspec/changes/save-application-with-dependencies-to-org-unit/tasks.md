# Tasks

Slicing strategy: **risk-first, then vertical.** The backend executor is the part that rests on Core behaviour and on the open publish change, so it is proven first (groups 1-4); the panel work (groups 5-7) follows on a contract that no longer moves. The Save panel's dependency list for schema-form applications (issue 9790) is already in this branch and is only aligned in group 5. Run `npm run verify:changed` once after each completed group and close the change with exactly one `npm run verify:full`. Read `apps/chat-api/AGENTS.md` before groups 1-4 and `.claude/rules/libs.md` before groups 5-6.

## 1. Split the publish preparation into a plan and a staging step

- [ ] 1.1 In `apps/chat-api/src/publish/application-publish-preparation.service.ts`, split `prepare` into a plan step (resolve and filter the dependencies, compute targets, check which exist) and a staging step (make the temporary copy with references, and optionally `iconUrl`, rewritten); `prepare` calls both and keeps returning what `PublishService` expects. Verification: `npm run test:file -- apps/chat-api/src/publish/tests/publish.service.spec.ts` passes unchanged, and a new `apps/chat-api/src/publish/tests/application-publish-preparation.service.spec.ts` (the service has no spec of its own today) shows plan and stage called separately produce the same result as `prepare`.
- [ ] 1.2 Move the "which `iconUrl` is an own uploaded file" read out of `PublishService` into a shared helper next to `getPublishableIconUrl` in `apps/chat-api/src/publish/publish-target.util.ts`, used by both paths. Verification: `npm run test:file -- apps/chat-api/src/publish/tests/publish-target.util.spec.ts apps/chat-api/src/publish/tests/publish.service.spec.ts` passes; the publish request is byte-identical in the existing icon cases.
- [ ] 1.3 Add `files` to `DialResourceType` in `apps/chat-api/src/common/utils/dial-resource-transfer.ts` and confirm `transferDialResource` copies a file without overwriting and maps a `400` onto an existing target to `409`. Verification: `npm run test:file -- apps/chat-api/src/common/utils/tests/dial-resource-transfer.spec.ts`.

## 2. Rights check before the first copy

- [ ] 2.1 Add a server-side check that takes the folder, the application's namespace and the namespaces of the dependencies to copy, reads the caller's rights through `OrgUnitsService.listOrgUnits`, evaluates them with the shared pure function from `@epam/ai-dial-chat-shared`, and returns the missing namespaces; it reports "unknown" (skip) when org units are off or rights cannot be read. Verification: `npm run test:file -- apps/chat-api/src/org-units/tests/org-units.service.spec.ts apps/chat-api/src/publish/tests/org-unit-copy.service.spec.ts` covers admin, writer, reader, missing namespace, rights off and rights unreadable.

## 3. The executor in the org-unit copy

- [ ] 3.1 In `apps/chat-api/src/publish/org-unit-copy.service.ts`, for `application`: plan, rights check (403 naming the namespaces, nothing written), icon copy under the rule of `org-unit-application-dependencies`, stage, copy each missing dependency, copy the staging copy to the target, delete the staging copy in `finally`; a plan with no dependencies and no icon takes today's single copy. Verification: `npm run test:file -- apps/chat-api/src/publish/tests/org-unit-copy.service.spec.ts` covers dependencies and icon copied, reuse of an existing dependency, other-bucket dependency left alone, no write on `files` (icon dropped, write continues), missing dependency namespace (403, nothing copied), a failing dependency copy (error, earlier copies stay, staging deleted), retry completing, `409` on an existing application, an application without dependencies or icon producing exactly one copy, and toolset, prompt and skill unchanged.
- [ ] 3.2 Clear the per-type caches for every copied dependency of type application or toolset, as the single copy does for the application; a failure of the clearing does not fail the response. Verification: same spec file, a case asserting the clearing calls and one with a failing clear.
- [ ] 3.3 Controller-level coverage of the endpoint for an application with dependencies: `200` with `{ id }`, `403` naming a namespace, `409`, flag off. Verification: `npm run test:file -- apps/chat-api/src/publish/tests/org-unit-copy.controller.spec.ts`.
- [ ] 3.4 Update the Swagger `description` and the `403` response of `copyToOrgUnit` in `apps/chat-api/src/publish/publish.controller.ts` for the dependency case, then run `npm run openapi` and `npm run openapi:check`, and build and lint `chat-api-client`. Verification: `npm run openapi:check` passes and `git diff libs/chat-api-client` shows only description changes.

## 4. Backend integration check

- [ ] 4.1 Add a contract-style test with fixtures for the Core calls the executor makes (copy of a file, of a dependency, of the staging copy), in the style of `apps/chat-api/src/publish/tests/dependencies/core-publication-contract.spec.ts`. Verification: `npm run test:file -- apps/chat-api/src/publish/tests/dependencies/org-unit-copy-contract.spec.ts`.

## 5. Align the Save panel's list with the new behaviour

- [ ] 5.1 In `apps/chat/src/components/ResourceSavePanelContainer/ResourceSavePanelContainer.tsx`, fill the dependency section's copy with the `Published` variant of `getPublishDependenciesLabels` and the `publish.dependenciesPublished*` keys (`apps/chat/src/utils/publish.ts`). Verification: `npm run test:file -- apps/chat/src/components/ResourceSavePanelContainer/tests/ResourceSavePanelContainer.dependencies.spec.tsx` asserts the "published together" heading and caption instead of the warning.

## 6. Panel library and hook

- [ ] 6.1 Add the optional `dependenciesNote` to `libs/publish-panel/src/models/save-to-folder-panel.ts` and render it in `libs/publish-panel/src/components/SaveToFolderPanel/SaveToFolderPanel.tsx` per `publish-panel-library` (note without a list, list wins over the note, nothing when both are absent); logical CSS properties only. Verification: `npm run test:file -- libs/publish-panel/src/components/SaveToFolderPanel/tests/SaveToFolderPanel.spec.tsx` and the RTL case in the same folder; check the lib holds no endpoint path, client import, context or `t()`.
- [ ] 6.2 In `libs/chat-hooks/src/catalog/useResourceSavePanel/useResourceSavePanel.ts`, accept an optional rights input and a typed-reason callback, derive the namespaces of the loaded dependencies (`file` excluded), disable a unit folder on the direct path whose dependency namespaces are not writable through the existing `getDisabledReason`, and pass a host-supplied `dependenciesNote` through only while the destination is under the Organization root. Verification: `npm run test:file -- libs/chat-hooks/src/catalog/useResourceSavePanel/tests/useResourceSavePanel.spec.ts` covers all dependencies writable, one missing, `file` ignored, no dependencies known, Personal destination, and the note shown only under the Organization root.
- [ ] 6.3 Keep `libs/chat-hooks` host-agnostic: the rights and reasons arrive as props and callbacks; no endpoint, client instance or `t()`. Verification: `npm run lint:affected` and `npm run test:file -- libs/chat-hooks/src/org-units/tests/org-unit-guards.spec.ts`.
- [ ] 6.4 Update `libs/publish-panel/README.md` and `libs/chat-hooks/README.md` for the new prop and parameters with examples that compile against the API. Verification: `npm run validate:docs`.

## 7. Host wiring

- [ ] 7.1 Add a flag to `ApplicationSavePanelConfig` in `apps/chat/src/models/application-editor.ts` for kinds whose form state is inside an embedded editor, set it in the Quick App and DIAL Loop definitions, and have `ApplicationFormEditor` pass it to `ResourceSavePanelContainer`. Verification: `npm run test:file -- apps/chat/src/pages/ApplicationEditor/tests/saveDependencyValues.spec.ts` plus a new case per definition showing the flag.
- [ ] 7.2 In `ResourceSavePanelContainer`, supply the neutral sentence for a flagged kind, the icon notice when the destination is a unit folder lacking `files` `write` and the application has an uploaded icon (`ApplicationFormEditor` passes one boolean computed from `metadata.values.iconUrl` with `isDialFileId` and the user's own bucket, design D10), and the typed reasons for missing dependency namespaces. Verification: `npm run test:file -- apps/chat/src/components/ResourceSavePanelContainer/tests/ResourceSavePanelContainer.dependencies.spec.tsx apps/chat/src/components/ResourceSavePanelContainer/tests/ResourceSavePanelContainer.orgUnits.spec.tsx`.
- [ ] 7.3 Add the strings to `apps/chat/src/i18n/locales/en.json` and the matching enum members: `resourceSavePanel.dependenciesEmbeddedNote`, `resourceSavePanel.iconNotCopiedNotice` in `apps/chat/src/constants/i18n-keys/resource-save-panel.ts`, and `orgUnitAccess.noWriteAccessDependencies` (with `{{types}}`) in `apps/chat/src/constants/i18n-keys/org-unit-access.ts`, re-exported through `translation-keys.ts`. Verification: the container specs from 7.2 read the strings by key and `npm run validate:docs` passes.
- [ ] 7.4 RTL and accessibility pass for the note and the notice: logical properties only, plain text in reading order, no live region. Verification: `npm run test:file -- apps/chat/src/components/ResourceSavePanelContainer/tests/ResourceSavePanelContainer.rtl.spec.tsx` (new, role and text queries).

## 8. Docs and specs

- [ ] 8.1 Update `docs/architecture.md` where it describes the direct write and the publish preparation, and the description of the copy endpoint in the affected READMEs. Verification: `npm run validate:docs`.
- [ ] 8.2 Run `npm run validate:specs` and `npm run spec:impact` and fix any reference the new capability or deltas introduce. Verification: `npm run validate:specs` reports no error.

## 9. Close the change

- [ ] 9.1 Run `npm run verify:full` once and `npm run build:quiet` because the bundling of `chat-api` and `chat` is affected. Verification: both exit 0.
- [ ] 9.2 Out of scope, recorded as follow-ups and not done here: dependencies of dependencies, a rollback of copies made before a failure, the Publish panel writing directly into a unit, the real list for an embedded editor, icons of the dependencies themselves.
