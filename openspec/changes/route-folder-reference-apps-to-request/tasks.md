# Tasks

Backend first (the backstop), then the helpers, then the two panels. Applications only. Each group lands its tests and docs. Extensionless TS imports, JSDoc on new functions, UI strings through `t()` with an enum key, lib strings through props.

## 1. Server refusal

- [x] 1.1 Make the dependency planner in `apps/chat-api/src/publish/application-publish-preparation.service.ts` report the folder references of an application (a `file` reference whose url ends with `/`), taken from the references before `file` dependencies are filtered out: add a `hasFolderReference` field to the plan, true for a `file` reference whose normalized id ends with `/` in the caller's or another user's bucket (the plan is built even when no non-file dependency exists). Verification: a planner unit test returns the folder for an application with one and none for plain file references; `npm exec nx test chat-api` passes the spec.
- [x] 1.2 In `apps/chat-api/src/publish/org-unit-copy.service.ts`, refuse an application with a folder reference for a caller who is not a DIAL admin with `422` and the code `folderReferenceNeedsRequest`, before any copy and before the namespace rights check; skip it when rights cannot be read or org units are off. Add the `@ApiResponse` on the controller, run `npm run openapi` and `npm run openapi:check`, rebuild `chat-api-client`. Verification: unit tests for refusal, DIAL admin allowed, no folder reference allowed, rights unreadable skipped, nothing copied on refusal, the single-copy shortcut not reached, and the `422` passing unchanged through the service's error handling; `npm exec nx test chat-api`, `npm exec nx lint chat-api` and the openapi check pass.
- [x] 1.3 Document the new `422` code in `docs/architecture.md` or `apps/chat-api/README.md` if either describes the copy errors. Verification: `npm run validate:docs` passes.

## 2. Client decision

- [x] 2.0 Expose `hasAdminAccess` from `useOrgUnits` (`libs/chat-hooks/src/org-units/useOrgUnits/useOrgUnits.ts`) and so from `OrgUnitsContext`; it is in state already. Verification: hook test that the flag follows the loaded access and is `false` while not ready.
- [x] 2.1 Extend `getPublishDirectAvailability` and `getCatalogPublishDirectAvailability` in `libs/chat-hooks/src/org-units/org-unit-guards.ts` with a folder-reference flag (a listed dependency with `isFolder`, not a DIAL admin); change the signature so the dependencies, not only their types, reach the helper, and update `CatalogView` and the helper's tests and expose it for the host note. Update the `libs/chat-hooks/README.md` entry if the signature is documented. Verification: unit tests for admin, regular user with and without a folder, and both reasons at once; the chat-hooks tests pass.
- [x] 2.2 Pass the admin flag and the folder dependencies to `isDirectDestination` in `libs/chat-hooks/src/catalog/useResourceSavePanel/useResourceSavePanel.ts` so a folder-reference application by a regular user takes the publish rows, and expose the note for the destination slot. Verification: hook tests for the schema-form case, the admin case and an application without a folder.

## 3. Panels and orchestration

- [x] 3.1 Publish panel: in `apps/chat/src/components/CatalogView/CatalogView.tsx` return the new note from `getPublishDirectUnavailableNote` (folder note wins over the dependency-types note), add `catalog.publish.directUnavailableFolder` to `apps/chat/src/constants/i18n-keys/catalog.ts` and `apps/chat/src/i18n/locales/en.json`. The panel has no fallback on the typed refusal: it shows as an error. Verification: component tests for the note, the request submit, the admin direct write, and the typed refusal shown as an error.
- [x] 3.2 Save panel: add `resourceSavePanel.directUnavailableFolder` (key enum plus `en.json`), show it in the destination note slot, and in `libs/chat-hooks/src/catalog/resource-save.ts` continue with `publish` when the direct write fails with `folderReferenceNeedsRequest` (read through `getApiErrorDetails` and the generated enum, never a literal), reporting "publish requested". Verification: orchestration tests for the typed code (publish called, no failure outcome), for another error (still `SavedButOrgUnitWriteFailed`), and a component test for the note.
- [x] 3.3 Run the translation and UI checks. Verification: `npm exec nx lint chat`, `npm exec nx test chat`, `npm exec nx lint chat-hooks`, `npm exec nx test chat-hooks` and the i18n key check pass.

## 4. Specs and verification

- [x] 4.1 Reconcile the wording of `openspec/specs/org-units-folder-permissions/spec.md` (Save and Publish direct-write rules) through a MODIFIED delta. Verification: `openspec validate route-folder-reference-apps-to-request --strict` and `npm run validate:specs` pass.
- [ ] 4.2 Reproduce on dev with a regular user with `write` on applications in a unit and a DIAL Loop application: Save panel gives a publication request with no "Forbidden"; Publish panel shows the note and files a request; the request can be approved and the folder arrives in the unit. With a DIAL admin the direct write still works. Verification: results recorded in `verification.md` of the change.
