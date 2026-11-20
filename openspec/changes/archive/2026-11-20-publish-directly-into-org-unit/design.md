# Design

## Context

Motivation, scope and acceptance criteria are in `proposal.md`; requirements are in the delta specs. What the design has to respect:

- **The direct write exists.** `OrgUnitCopyService.copyIntoOrgUnit` (`apps/chat-api/src/publish/org-unit-copy.service.ts`) copies an own entity into `public/{folder}/{leaf}`; for an application it also copies first-level private dependencies under `.{app}.deps` and the icon, after a rights check on namespaces (the archived change `save-application-with-dependencies-to-org-unit`, D1-D4; capability `org-unit-application-dependencies`). The Save panel reaches it through `runResourceSave` (`libs/chat-hooks/src/catalog/resource-save.ts`).
- **The publish path is request-only.** `usePublishFlow` (`libs/publish-panel/src/utils/use-publish-flow.ts`) submits through one `onPublish`; the catalog host maps it to `publishCatalogEntity` (`apps/chat/src/hooks/useCatalogPublishing/useCatalogPublishing.ts`), wrapped by `usePublishTargetGuard` so a `409` becomes a taken-target error. `DetailsPanel` threads the flow through `libs/catalog/src/components/Details/hooks/useDetailsPublish.ts`.
- **The right to approve** (read from DIAL Core `origin/development`, `OrgUnitApprovals.mayDecide`): a DIAL admin, or a role holder with `read` and `write` on `publications` in every unit the request touches; the requester may approve their own request. All targets of one publication (application, dependencies, icon) sit in the same folder, hence the same unit.
- **A copy is not an approved publication** (`ResourceOperationService.copyResource`, `PublicationService.copyReviewToTargetResources`): the copy keeps the source author, copies a toolset with no credentials and drops declared-dependency consent for a non-admin; a publication sets `displayAuthor`, can copy global credentials and carries the consent. Inside a unit publication rules are dropped and not stored.
- **The target name.** A publication names the copy through `resolvePublishTarget` (`{name}__{version}`, `apps/chat-api/src/publish/publish-target.util.ts`); `checkPublishTarget` (`PublishService`) reads that same path with the caller's token and `usePublishFlow` already asks it through `onCheckTargetExists`.
- **Rights in the client and in chat-api.** `useOrgUnits` (`libs/chat-hooks/src/org-units/useOrgUnits/useOrgUnits.ts`) answers `canSaveAt`, `canSaveDirectlyAt` and `canPublishAt` from `canWriteIntoOrgUnitAt` and friends in `libs/chat-shared/src/utils/org-unit.ts`. chat-api does not import chat-shared and mirrors the rule in its own code (`apps/chat-api/src/org-units/org-unit-rights.util.ts`).

## Goals / Non-Goals

**Goals:**
- One executor for a direct write into a unit, shared by the Save and Publish panels.
- The panel knows the mode before submit, so every control and word matches what submit will do.
- The path the copy writes is the path the publication would use, so the existing taken-name check stays correct.

**Non-Goals:**
- Reproducing publication semantics DIAL Core does not offer on a copy (display author, credentials, consent carry, rules).
- A new publication-history record for a direct write.

## Decisions

### D1. The right is one pure function plus one hook answer, decided in the client

`canApprovePublicationsAt(access, publicPath)` joins `canWriteIntoOrgUnitAt` in `libs/chat-shared/src/utils/org-unit.ts`: admin, or `read` and `write` on `publications` at the owning unit. `useOrgUnits` adds `canPublishDirectlyAt(path, namespace)` = owning unit exists AND `canWriteIntoOrgUnitAt` AND `canApprovePublicationsAt`, `false` until `Ready`. The folder guards are unchanged (they expose no direct-publish check); a pure `getPublishDirectAvailability(folderPath, namespace, dependencyTypes, { canPublishDirectlyAt, canSaveDirectlyAt })` in `libs/chat-hooks` returns `{ isDirect, missingNamespaces }`, checking each dependency namespace with the strict write check.

The right selects the panel's mode and nothing more: DIAL Core does not enforce `publications` on a copy, and any caller with `write` on the namespace can already write through the same endpoint (the Save panel does), so a server mirror would protect nothing and prevent no partial copy. This is the Save panel's pattern: the client decides the mode and highlights folders, the server checks namespaces only where a refusal in the middle would leave partial copies (an application's dependencies), and DIAL Core is the authority.

DIAL Core decides an approval in every unit the request touches; all targets of one publication (application, dependencies, icon) lie in the one folder, so checking the folder's owning unit is the same check. Its further condition, that the caller is not an application acting for a user (`OrgUnitSubjects.isRoleHolder`), always holds for a chat session.

Alternative: one `canPublishDirectlyAt` that bakes the `write` half in without exposing `canApprovePublicationsAt` (rejected: the two halves are tested apart).

### D2. The flow decides the branch; the host supplies two callbacks

`usePublishFlow` gets `canPublishDirectlyTo(folderPath)` and `onPublishDirectly(item, folderPath)` and returns `isDirectWrite`; its `onPublishSuccess` receives `isDirectWrite` as an additive third argument, so the host words a direct save differently from a filed request. `handleSubmit` calls `onPublishDirectly` when `isDirectWrite`, with the same try/catch, `onPublishSuccess`, `onPublishError`, `isTargetTakenError` handling. The lib sees a predicate and a promise-returning callback only; the host closes over `useOrgUnitsContext`, the namespace and `copyCatalogEntityToOrgUnit`. This follows how `runResourceSave` picks the direct branch from `choice.isDirectWrite` and how `onCheckTargetExists` is an optional host input.

Alternative: one `onPublish` with a sixth positional argument `isDirectWrite`, as `publishCredentials` was added (rejected as the primary shape: the panel's own shape must change with the mode, so the lib has to know the mode; the host would also have to recompute the predicate). `PublishFlowItem`-level flags were rejected for the same reason.

### D3. The panel hides publication-only controls and names the mode

`PublishPanel` takes `isDirectWrite`, hides the rules section, the author field and the credentials checkbox, and shows `labels.directWriteNote` where the credentials checkbox would be (the host supplies it only for a toolset that would offer one). The submit button keeps its label, as the Save panel's does between a direct write and a request. `usePublishFlow`'s existing-rules effect must not fetch for a direct folder: it keys on `isDirectWrite`. `DetailsPanel` and `useDetailsPublish` thread the flow's `isDirectWrite` and `derivePublishState` keeps the footer states (`isTargetTaken`, `isTargetChecking`, `hasWriteAccess`). `DetailsPanel` takes the host's `canPublishDirectlyTo(item, folderPath, dependencies)`, `onPublishDirectly(item, folderPath)` and `getPublishDirectUnavailableNote(item, folderPath, dependencies)`; `useDetailsPublish` adapts the first to the flow's predicate and renders the note through `directUnavailableNote`. The host passes the credentials note (`publishLabels.directWriteNote`, which the catalog forwards only for an item that would offer the credentials opt-in) and the dependency note as translated strings. When the user would otherwise write directly but lacks `write` on a listed dependency's namespace, the host's predicate answers `false` (a request is filed) and the panel shows the dependency note naming the missing types (an information callout, not a warning: the request carries the dependencies, so the application works after approval). The direct path is offered only once the dependency list has settled: the panel shows the request layout while it loads and switches at most once, to direct, after it settles. A failed read leaves an empty list, so direct is offered and the server's namespace check is the backstop. For a direct folder the flow ignores the history marker `hasExistingPublicationInFolder`, does not send `rules` or `publishCredentials`, and clears the credentials choice on entering a direct folder; moving back to a request folder loads that folder's rules again through the existing effect.

### D4. The copy endpoint takes `version` and names the copy like a publication

`CopyCatalogEntityToOrgUnitDto` gains an optional `version`. Without it nothing changes (the Save panel sends none). With it, chat-api rebuilds the entity's full plain id from the resolved source (the endpoint accepts a bare name too), calls `resolvePublishTarget` and takes its `targetResourceName` (versioned for an application or a toolset when `version` is valid and the stored name has a `__` suffix, else the stored name), and uses that name for the application, its `.{app}.deps` folder, the icon target and the staging copy, so every path matches a publication's. An unversioned type or a name without a suffix is not renamed.

A `409` gets the publish endpoint's `PublishConflictCode.TargetExists` only where the target is confirmed: the BFF's own check before the first copy, or a `409` from DIAL Core followed by a read that finds the target (the publish precedent, `isTargetTakenRejection`). Other Core `409`s, such as a skill named like a unit folder, keep no code, so the host's guard does not show a wrong callout. The code is added for every caller (status and message unchanged), so the Save panel is unaffected.

Alternatives: a mode flag plus a server `publications` check (rejected, see D1: it protects nothing); a separate endpoint (rejected: same executor, same DTO, a second route to document and generate).

### D5. The host wraps the direct callback with the taken-target guard

`useCatalogPublishing` adds `publishDirectly` calling the generated client's `copyCatalogEntityToOrgUnit` through `apps/chat/src/server-api/publish.api.ts` with `{ folderPath, version }`, converted by the same guard that wraps `publishItem`, so `isTargetTakenError` recognises its `409`. `CatalogView` supplies `canPublishDirectlyTo(item, folderPath, dependencies)` and `getPublishDirectUnavailableNote(item, folderPath, dependencies)` from `useOrgUnitsContext` and the entity's namespace through `getPublishDirectAvailability` (from `libs/chat-hooks`), relies on the guards hook (still used for the folder rows), which already loads and refreshes rights when the panel becomes active; `useDetailsPublish` supplies the loaded list. `useCatalogPublishing`'s `handlePublishSuccess` takes the third argument and reports a direct write with the Save panel's text. `checkTargetExists` is unchanged.

### D6. Success and notification

A direct success is reported with the Save panel's own text (`ResourceSavePanelI18nKeys.SavedToFolder`, as `isWrittenToOrgUnit` does in `apps/chat/src/hooks/resource-save/useResourceSaveNotification.ts`) through `showSuccessNotification`; a failure goes through the existing `showPublishError`, which already words a taken target, a publish in progress and Core's reason. The host remembers the folder (`rememberPublishFolder`) and, like every other publish path, does not refetch the catalog: the new copy shows on the next catalog load. The item's publish history is not refreshed: a direct write creates no publication.

### D7. Dependencies and the Save panel are untouched

The list stays `getPublishDependencies` (Core-backed, best-effort for display); the server's read stays strict. A panel list that is empty because the read failed can therefore enable a folder the server then refuses; the refusal is shown as a failure with its reason. No embedded-editor sentence: the entity is already saved.

## Risks / Trade-offs

- **A direct write is not an approved publication** → documented in the spec's known differences; hiding rules, author and credentials makes the panel say what it does. Reconsider the "file and approve in one call" alternative of the proposal if consent loss or the author prove unacceptable.
- **The copy keeps the source application's `reference`** (a publication's approval generates a new one; a toolset copy always does) → kept as is, the same as the Save panel's direct write; nothing here changes it.
- **A concurrent submit** → the second call gets `409` `PublishInProgress` from the shared staging copy and shows its message; it is never read as a taken target (task 4.1).
- **Stale rights (60 s cache)** → the guards hook refreshes on open; server check; Core stays the authority.
- **The MODIFIED blocks copy the current main specs** (which already carry the save-with-dependencies change) → if the pull request that holds them is rebased or its spec text changes before this change merges, re-copy the blocks and run `openspec validate`.
- **`libs/publish-panel` API grows** → options and props are optional and default to today's behaviour; README and spec updated in the same change.
- **No history record for a direct write** → the "Unpublish" entry for the source item does not list the unit folder; removal of the copy goes through the copy's own page, as for a Save-panel write.

## Migration Plan

No data migration. Deploy backend first or together (the new DTO field `version` is optional; the panel changes are additive and inactive until the host passes the callbacks). Rollback: revert the change; copies already written stay valid. Run `npm run openapi` and `npm run openapi:check`, `npm run validate:docs` and `npm run validate:specs`.
