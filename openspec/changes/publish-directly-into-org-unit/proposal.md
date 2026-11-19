# Proposal

## Why

A publish panel always files a publication request, even for a user who holds the very rights needed to approve it: a unit role with `read` and `write` on `publications` can approve any request into its unit, its own included (DIAL Core `OrgUnitApprovals.mayDecide`, `PublicationService.approvePublication`). For such a user the request is a detour: file it, then approve it. The Save panel already writes straight into a unit folder, with first-level dependencies and the icon, once the user may write there (`save-application-with-dependencies-to-org-unit`). The catalog Publish panel for an application, toolset, prompt or skill should take the same direct path when the user could approve the request themself.

## Problem

- `usePublishFlow` submits through one `onPublish`, which the catalog host maps to `POST /api/v1/catalog/:entityType/:entityId/publish` (`createPublication`). There is no direct branch (`libs/publish-panel/src/utils/use-publish-flow.ts:233`, `apps/chat/src/hooks/useCatalogPublishing/useCatalogPublishing.ts:248`).
- Nothing in the code checks `publications` rights. `OrgUnitNamespace.Publications` exists only as an enum member (`libs/chat-shared/src/models/org-unit.ts`); `canRequestPublicationAt` asks for `read` on the entity's own namespace (`libs/chat-shared/src/utils/org-unit.ts:165`) and the spec `org-units-folder-permissions` states "Publications are unchanged everywhere".
- A direct copy is not a publication. Read from DIAL Core `origin/development`: a plain copy keeps the source's author (`author = null`), copies a toolset with no credentials, drops the admin consent of declared `resource_dependencies` for a non-admin (`ApprovalPolicy.DROP`), and takes no rules and no display author; the approval of a publication sets `displayAuthor`, can copy a toolset's global credentials, and carries the consent (`CARRY`). Inside a unit Core drops publication rules anyway (`validatePublicationRequest`: `rulesDropped`) and stores none on approval.
- The target name differs. A publication names the copy `{name}__{version}` from the panel's version (`resolvePublishTarget`, `apps/chat-api/src/publish/publish-target.util.ts:359`); the direct copy keeps the stored leaf of the id (`apps/chat-api/src/publish/org-unit-copy.service.ts:220`).

## Solution

When the committed destination is a folder inside an org unit and the user may write there **and** may approve publications there, the catalog Publish panel writes the entity directly, reusing `copy-to-org-unit`, instead of filing a request.

1. **The right.** Direct publish is offered when all hold: the folder lies inside a listed unit; the unit (or the user's admin access) grants `write` on the entity's namespace and, for an application, on the namespace of each dependency to copy; and the user is a DIAL admin or the unit grants both `read` and `write` on `publications`. A new pure function next to `canWriteIntoOrgUnitAt` decides the `publications` half and `useOrgUnits` exposes the combined answer.
2. **The flow.** `usePublishFlow` gets two optional inputs: `canPublishDirectlyTo(folderPath)` and `onPublishDirectly`. When the selected folder qualifies, submit calls `onPublishDirectly` instead of `onPublish`. The host passes two callbacks; the lib learns nothing about endpoints.
3. **The panel.** For a direct destination the panel hides the rules editor and the author field (Core takes neither), hides the credentials checkbox with one neutral line that credentials are not shared by a direct save, and reports the success as "saved to the folder"; the submit button keeps its label. Dependencies keep their current list, loaded from Core as today; the folder is disabled with a typed reason when the user cannot write a dependency's namespace (`getMissingDirectWriteNamespaces`).
4. **The backend.** `copy-to-org-unit` gets an optional `version`; with it the copy lands at the path a publication would use (`resolvePublishTarget`), so the existing `checkPublishTarget` the panel already calls checks exactly the path that will be written. The `409` for a taken target carries the taken-target code and shows the existing callout. Everything else (dependencies, icon, rights before the first copy, staging, no rollback) is unchanged.
5. **Everything else is as before.** A folder outside every unit, a unit where the user lacks any of the rights, conversations and projects, and the Save panel keep their current behaviour.

## What Changes

- chat-shared: a `publications` approval right and the combined direct-publish right (pure functions).
- chat-hooks: `useOrgUnits` exposes the combined check; the guards builder gets a publish-direct variant; the catalog publish hook wiring.
- publish-panel: `usePublishFlow` options and result (`isDirectWrite`), panel sections hidden for a direct destination, one label for the credentials line.
- apps/chat: `useCatalogPublishing` adds the direct callback over the generated client; `CatalogView` passes the right check and refreshes rights when the panel opens; new translated strings and notification variant.
- chat-api: optional `version` on `CopyCatalogEntityToOrgUnitDto`; target naming through `resolvePublishTarget`; the taken-target code on the `409` where the target is confirmed. The `publications` right is not checked on the server (Core does not enforce it on a copy; it only selects the panel's mode).
- generated client: `npm run openapi`, `npm run openapi:check`.
- **No BREAKING change.** `version` is optional and the new panel inputs are optional.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `org-units-folder-permissions`: the sentence "Publications are unchanged everywhere" gives way to the rule that a publish panel writes directly when the user holds `write` on the namespaces and `read` and `write` on `publications`; the known-risk text names the differences from an approved publication.
- `org-units-client-state`: the hook answers the combined direct-publish right per path.
- `org-units-api`: `copy-to-org-unit` takes an optional `version`, names the copy like a publication when it is given, and marks a confirmed taken target with the publish endpoint's code.
- `catalog-publish-flow`: the catalog Publish panel's direct branch, hidden sections, wording and notifications.
- `publish-panel-library`: `usePublishFlow` options and result, panel behaviour for a direct destination, labels.

## Impact

- Code: `libs/chat-shared/src/utils/org-unit.ts`, `libs/chat-hooks/src/org-units/`, `libs/publish-panel/src/` (`use-publish-flow.ts`, `PublishPanel`), `libs/catalog/src/components/Details/hooks/useDetailsPublish.ts` (threading), `apps/chat/src/hooks/useCatalogPublishing/`, `apps/chat/src/components/CatalogView/CatalogView.tsx`, `apps/chat-api/src/publish/` (copy service, DTO, target util), `libs/chat-api-client` (regenerated).
- i18n: new strings for the direct-save wording, the credentials line, the typed reasons, and the success and error notifications, in `en.json` with enum members in their own module.
- Docs: READMEs of `libs/publish-panel` and `libs/chat-hooks`, `docs/architecture.md` if its publish section names the request-only flow, `npm run validate:docs`, `npm run validate:specs`.
- Library boundary: `libs/publish-panel` receives a predicate and a callback and a translated sentence; endpoints, rights data and the `publications` namespace stay in `libs/chat-shared`, `libs/chat-hooks` and the app adapters.

## Non-goals

- Conversations and projects (own containers, no direct write).
- Showing or changing who may approve; the unit's role data is read as it is.
- Copying toolset credentials, setting a display author, or storing access rules through a direct write (DIAL Core offers none of them on a copy; they remain publication-only).
- Restoring the admin consent Core drops on a non-admin's copy, regenerating an application's `reference` (kept as the source has it), refetching the catalog after a direct write (no publish path does), any change to DIAL Core.
- Dependencies of dependencies; a rollback of copies already made.
- When the Publish panel is shown for an item; only what happens inside it.

## Acceptance criteria

- With `write` on the namespaces and `read` and `write` on `publications` in the folder's unit, choosing that folder and pressing the submit button creates the entity (and, for an application, its missing dependencies and icon) in the folder and files no publication request; the panel closes and reports a save into the folder.
- A DIAL admin on a folder inside a unit takes the same path; a folder outside every unit still files a request.
- Without `read` or without `write` on `publications`, the panel behaves exactly as today for that folder (request).
- The copy lands at `{name}__{version}` of the panel's version, and a taken name is shown before submit by the existing target check and after a racing submit by the same callout.
- For a direct destination the rules editor, the author field and the credentials checkbox are not shown; the credentials line is.
- A missing namespace for a dependency disables the folder with a typed reason; the server answers `403` naming the missing namespaces before the first copy.
- A failure in the middle keeps the panel open with the error; submitting again completes the copy.
- Conversations, projects and the Save panel behave exactly as before.

## Alternatives considered

| Option | Verdict |
| --- | --- |
| Keep filing a request for everyone | Rejected. The user holds the rights to approve their own request; the request only adds a step. |
| Let the BFF choose request or direct inside `/publish` and return a discriminator | Rejected. One endpoint with two outcomes; the panel must know the mode before submit anyway to hide fields and change wording. |
| File the request and approve it in the same call | Rejected. It keeps Core's full publication semantics (author, credentials, consent) but needs the approval endpoint and leaves a publication record; adds a call and a failure mode (request filed, approval fails). Worth revisiting if the differences below prove unacceptable. |
| **Reuse `copy-to-org-unit` with an optional `version`, branch in the flow** | **Chosen.** One executor already shipped for the Save panel; the path and the taken-name check match the publication. |
| Branch in the host's single `onPublish` through an extra positional argument | Rejected as the primary shape: the lib would not know when the panel changes shape. |

## Known limitations (documented, not guarded)

- A direct write is not an approved publication: the shared copy keeps the source's author, carries no toolset credentials, and a non-admin's copy drops declared-dependency consent; an admin grants it afterwards. These are the recorded Core rules of a plain copy.
- The copy keeps the source application's `reference`, as the Save panel's direct write does (a publication's approval generates a new one); this change leaves it as it is.
- No publication record exists for a direct write, so the item's publish history does not list the folder.
- Rights come from a 60-second cache; the panel refreshes them on open, the server checks again, and Core stays the authority.

## Closest existing models

`runResourceSave` and its direct branch (`libs/chat-hooks/src/catalog/resource-save.ts:123`) for choosing direct over request; `OrgUnitCopyService.copyIntoOrgUnit` (`apps/chat-api/src/publish/org-unit-copy.service.ts:220`) for the executor; `buildFolderGuards` and `getMissingDirectWriteNamespaces` (`libs/chat-hooks/src/org-units/org-unit-guards.ts:78`, `:176`) for the guards; `usePublishFlow`'s `onCheckTargetExists` (`libs/publish-panel/src/utils/use-publish-flow.ts:151`) for an optional host input of the same kind.

## Scope flags

- Stands on the branch of the save-with-dependencies work (change `save-application-with-dependencies-to-org-unit`, archived into the main specs, open as a pull request into `development`); this change modifies requirements that work added to `org-units-api`, `org-units-folder-permissions`, `catalog-publish-flow` and `publish-panel-library`, so the base moves with that pull request and the MODIFIED blocks are re-checked then.
- Touches `libs/publish-panel`, `libs/chat-hooks` and `libs/chat-shared`; all stay host-agnostic.
- Depends on Core behaviour read from `origin/development` (the rights rule, the differences between a publication and a copy); nothing was run against a live Core.
