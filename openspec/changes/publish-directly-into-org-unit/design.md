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

### D1. The right is one pure function plus one hook answer, mirrored on the server

`canApprovePublicationsAt(access, publicPath)` joins `canWriteIntoOrgUnitAt` in `libs/chat-shared/src/utils/org-unit.ts`: admin, or `read` and `write` on `publications` at the owning unit. `useOrgUnits` adds `canPublishDirectlyAt(path, namespace)` = owning unit exists AND `canWriteIntoOrgUnitAt` AND `canApprovePublicationsAt`, `false` until `Ready`. `buildFolderGuards` exposes `canPublishDirectlyTo` for the Publish purpose; `getMissingDirectWriteNamespaces` already names missing dependency types and is reused as is. `apps/chat-api/src/org-units/org-unit-rights.util.ts` gains the mirror of `canApprovePublicationsAt` with a comment naming its frontend counterpart, and tests that copy the frontend's cases (as D3 of the archived save-with-dependencies change does).

Alternative: one `canPublishDirectlyAt` that bakes the `write` half in without exposing `canApprovePublicationsAt` (rejected: the server mirror and the tests want the two halves apart).

### D2. The flow decides the branch; the host supplies two callbacks

`usePublishFlow` gets `canPublishDirectlyTo` and `onPublishDirectly` and returns `isDirectWrite`. `handleSubmit` calls `onPublishDirectly` when `isDirectWrite`, with the same try/catch, `onPublishSuccess`, `onPublishError`, `isTargetTakenError` handling. The lib sees a predicate and a promise-returning callback only; the host closes over `useOrgUnitsContext`, the namespace and `copyCatalogEntityToOrgUnit`. This follows how `runResourceSave` picks the direct branch from `choice.isDirectWrite` and how `onCheckTargetExists` is an optional host input.

Alternative: one `onPublish` with a sixth positional argument `isDirectWrite`, as `publishCredentials` was added (rejected as the primary shape: the panel's own shape must change with the mode, so the lib has to know the mode; the host would also have to recompute the predicate). `PublishFlowItem`-level flags were rejected for the same reason.

### D3. The panel hides publication-only controls and names the mode

`PublishPanel` takes `isDirectWrite` and `directWriteNote`, hides the rules section, the author field and the credentials checkbox, shows the note where the credentials checkbox would be (only for a toolset that would offer one), and takes `labels.directSubmit`. `usePublishFlow`'s existing-rules effect must not fetch for a direct folder: it keys on `isDirectWrite`. `DetailsPanel` and `useDetailsPublish` thread the flow's `isDirectWrite` and `derivePublishState` keeps the footer states (`isTargetTaken`, `isTargetChecking`, `hasWriteAccess`). The host passes the direct label, the note and the typed disabled reasons as translated strings.

### D4. The copy endpoint takes `asPublication`, names by version and checks `publications`

`CopyCatalogEntityToOrgUnitDto` gains optional `asPublication` (boolean) and `version`. Without `asPublication` nothing changes (the Save panel). With it, chat-api:

1. derives the target leaf with `resolvePublishTarget` (versioned name for an application or a toolset when `version` is valid, else the stored leaf), and uses that leaf for the application and for its `.{app}.deps` namespace, so every path matches a publication's;
2. adds `publications` to the rights check before the first copy: the caller must be a DIAL admin or hold `read` and `write` on `publications` in the folder's unit (mirror of D1), otherwise `403` naming `publications`.

The `publications` check is a policy for this panel's mode, not a security boundary: Core already allows any `write` on the entity's namespace. It is on the server so the panel and the server decide alike and a stale panel is refused before any copy. `asPublication` is an explicit flag, not inferred from `version`: prompts and skills have no version.

A `409` for a taken target carries the same machine-readable code as the publish endpoint's (`PublishConflictCode.TargetExists`), so the host recognises it with the guard it already has.

Alternatives: infer from `version` (rejected: unversioned types); a separate endpoint (rejected: same executor, same DTO, a second route to document and generate); put the check only in the client (rejected: stale panel, partial copies).

### D5. The host wraps the direct callback with the taken-target guard

`useCatalogPublishing` adds `publishDirectly` calling the generated client's `copyCatalogEntityToOrgUnit` through `apps/chat/src/server-api/publish.api.ts` with `{ folderPath, version, asPublication: true }`, converted by the same guard that wraps `publishItem`, so `isTargetTakenError` recognises its `409`. `CatalogView` supplies `canPublishDirectlyTo` from `buildFolderGuards` (Publish purpose, entity namespace), refreshes rights when the panel opens (`refreshUnits`, as the Save panel does) and passes the typed disabled reasons for missing dependency namespaces. `checkTargetExists` is unchanged.

### D6. Success and notification

A direct success is reported through the existing operation notifications as a save into the folder: the same wording family as `isWrittenToOrgUnit` in `apps/chat/src/hooks/resource-save/useResourceSaveNotification.ts`, with new Publish keys where the wording differs. The host remembers the folder (`rememberPublishFolder`) and, like every other publish path, does not refetch the catalog: the new copy shows on the next catalog load. The item's publish history is not refreshed: a direct write creates no publication.

### D7. Dependencies and the Save panel are untouched

The list stays `getPublishDependencies` (Core-backed, best-effort for display); the server's read stays strict. A panel list that is empty because the read failed can therefore enable a folder the server then refuses; the refusal is shown as a failure with its reason. No embedded-editor sentence: the entity is already saved.

## Risks / Trade-offs

- **A direct write is not an approved publication** → documented in the spec's known differences; hiding rules, author and credentials makes the panel say what it does. Reconsider the "file and approve in one call" alternative of the proposal if consent loss or the author prove unacceptable.
- **The copy keeps the source application's `reference`** (a publication's approval generates a new one; a toolset copy always does) → kept as is, the same as the Save panel's direct write; nothing here changes it.
- **A concurrent submit** → the second call gets `409` `PublishInProgress` from the shared staging copy and shows its message; it is never read as a taken target (task 4.1).
- **Stale rights (60 s cache)** → refresh on open; server check; Core stays the authority.
- **The MODIFIED blocks copy the current main specs** (which already carry the save-with-dependencies change) → if the pull request that holds them is rebased or its spec text changes before this change merges, re-copy the blocks and run `openspec validate`.
- **`libs/publish-panel` API grows** → options and props are optional and default to today's behaviour; README and spec updated in the same change.
- **No history record for a direct write** → the "Unpublish" entry for the source item does not list the unit folder; removal of the copy goes through the copy's own page, as for a Save-panel write.

## Migration Plan

No data migration. Deploy backend first or together (the new DTO fields `asPublication` and `version` are optional; the panel changes are additive and inactive until the host passes the callbacks). Rollback: revert the change; copies already written stay valid. Run `npm run openapi` and `npm run openapi:check`, `npm run validate:docs` and `npm run validate:specs`.
