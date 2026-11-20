# Design

## Context

Motivation, scope and acceptance criteria are in `proposal.md`; requirements are in the delta specs. What the design has to respect:

- **The direct write today.** `OrgUnitCopyService.copyIntoOrgUnit` (`apps/chat-api/src/publish/org-unit-copy.service.ts`) resolves the caller's own entity and issues one Core `copyResource` with `overwrite: false` into `public/{folder}/{leaf}`. The Save panel reaches it through the adapters' `saveIntoOrgUnit` (`libs/chat-hooks/src/catalog/resource-save-adapters.ts`) after the save step of `runResourceSave` (`libs/chat-hooks/src/catalog/resource-save.ts`); a failure after the save resolves with the `SavedButOrgUnitWriteFailed` outcome, and the host shows Core's or the BFF's message as the reason (`useResourceSaveNotification`).
- **The publish preparation.** `ApplicationPublishPreparationService.prepare` (`apps/chat-api/src/publish/application-publish-preparation.service.ts`) resolves first-level dependencies from the application's schema, filters them (`selectPublishableDependencies`: own bucket, no `file`), computes `{type}/public/{folder}/.{app}.deps/{bucket}/{path}` for each, skips the ones whose target exists, and makes the temporary rewritten copy through `ApplicationPublishCopyService`. `PublishService` adds the icon as a separate `ADD` and lets Core rewrite `iconUrl`.
- **What Core does on a plain copy into `public/`** (read in Core's `development`, `ApplicationService.copyApplication` and `ResourceOperationService.copyResource`): schema files and catalog-property files are relinked and copied; references to prompts, skills, toolsets and applications are copied verbatim; `iconUrl` is not touched (it is rewritten only by `PublicationService` through a consumer hook the copy endpoint does not pass); a non-administrator's copy drops declared-dependency consent. The controller requires `read` on the source and `write` on the destination, resolved per resource type, so an org unit's `write` is decided per namespace (`OrgUnitGrants`: the namespace is the resource type's group, `files` included).
- **Rights data in chat-api.** `OrgUnitsService.listOrgUnits` (`apps/chat-api/src/org-units/org-units.service.ts`) returns the caller's units with their permissions and `hasAdminAccess`, cached per user for 60 s. chat-api does **not** import `@epam/ai-dial-chat-shared`: the module-boundary rules let a `type:backend` project depend only on `type:backend` libs (`eslint.config.mjs`), and the backend instead mirrors the few rules it shares with the frontend in its own code, with a comment naming the frontend counterpart (for example `apps/chat-api/src/common/validators/resource-version.pattern.ts`; `scripts/validate-lib-duplicates.mjs` skips `apps/chat-api` for exactly this reason). The pure rights functions live in `libs/chat-shared/src/utils/org-unit.ts` (e.g. `canWriteIntoOrgUnitAt`), and the client evaluates them through `useOrgUnits` and `buildFolderGuards`.
- **The Save panel and its dependency list.** `useResourceSavePanel` (`libs/chat-hooks/src/catalog/useResourceSavePanel/useResourceSavePanel.ts`) already reads the dependencies of the current form values for a schema-form application while the destination is under the Organization root (`loadDependencies`, from `POST /api/v1/catalog/application-values/publish-dependencies`), and `SaveToFolderPanel` renders them. The panel is modal, so the values cannot change while it is open. For an application with an embedded editor, such as a Quick App, the form state is inside the iframe; the host's handle exposes only `save` and `startPreview` (`apps/chat/src/models/application-editor.ts`).

## Goals / Non-Goals

**Goals:**
- One preparation plan with two executors, so that a change to how dependencies are located or named is made once.
- No state in which the shared copy references private resources and the call reported success.
- Rights failures are found before the first copy whenever the real dependencies are known.

**Non-Goals:**
- A rollback of copies already made when a later step fails.
- A generic copy-with-dependencies engine for other entity types.
- Making the panel's list correct for an embedded editor.

## Decisions

### D1. Split the preparation into a plan and a staging step

`prepare` is split into two steps that the publish path still calls back to back, with unchanged behaviour:

1. **plan**: resolve and filter the dependencies, compute their targets, check which targets exist. Returns the dependencies to copy, the target map and the reused count.
2. **stage**: given a plan and an optional icon rewrite, make the temporary copy with references (and `iconUrl`) rewritten.

The direct write needs the plan alone to check rights, and needs the icon decision before the staging copy is written, so the two steps cannot stay fused. The plan also covers an application with no dependencies but an icon (the publish path keeps returning "nothing to prepare" for that case, because Core relinks the icon there).

Alternatives: calling `prepare` twice (two dependency reads, and the staging copy exists before rights are known) was rejected; a second preparation service for the direct write was rejected because the namespace, reuse rule and rewrite would then live in two places.

### D2. Executor order: rights, icon, staging, dependencies, application, cleanup

`OrgUnitCopyService` runs, for an application: resolve the own application; **plan**; **rights check** (D3); **icon copy** (D4); **stage**; copy each dependency that is not already there; copy the staging copy to the application's target; delete the staging copy in a `finally`. All copies use Core `copyResource` with `overwrite: false` through the existing transfer helper, with `files` added to its resource types.

Dependencies go before the application so a failure leaves only the dot-folder `.{app}.deps` behind, never an application that points at nothing. A target that exists already is reused (as in publishing), which makes a retry complete the job. After each copy the same per-type cache invalidation that the single copy already does runs for applications and toolsets.

**Accepted: a strict read can stop a save with no dependencies.** The direct write reads the application's dependencies strictly (`PublishDependenciesService.getDependenciesStrict`, through `plan(..., isStrict)`), so a transient failure to read the application or its schema fails the write with the mapped error even for an application that has no private dependencies and used to be one plain copy. This is intended: a list that could not be read must never be read as "none", and publishing keeps its own best-effort read. Nothing is copied when it fails.

**Before the first write** the executor checks that the application's own target does not exist (`resourceExists`) whenever it is about to copy more than the application itself, and answers `409` without copying an icon or a dependency; Core's `409` on the final copy still covers a target that appears in between. The application is named by the full id built from the resolved source, so a bare `entityId` still reaches the dependency resolver.

The staging copy's own source is the caller's bucket, so Core's `read`/`write` checks on it pass as they do for publishing; the application's destination is the same path the plain copy would have written, so the endpoint's response (`{ id }`) and its `409` for an existing target are unchanged.

### D3. Rights are checked on the server before the first copy

After the plan, chat-api reads the caller's rights (`listOrgUnits`) and checks `write` at the target folder for the application's namespace and for the namespace of every dependency it is about to copy (a reused dependency needs none). If any is missing it answers `403` with a message naming the missing namespaces and writes nothing. The check is a small backend-owned copy of the unit-ownership and `write` rule (longest-prefix owner of the folder, admin allowed, namespace in the owner's permissions), placed next to `OrgUnitsService` with a comment naming `libs/chat-shared/src/utils/org-unit.ts` as its frontend counterpart, and pinned by tests that mirror the frontend's cases so the BFF and the panel decide the same way. Importing the shared function was rejected: the boundary rules forbid a backend project from depending on a `type:shared` lib, and the rule is not widened to land an import.

The check is skipped, and Core decides, when org-unit rights cannot be read or are off. The 60-second cache can make the answer stale in either direction; a stale "allowed" is caught by Core's own `403` (surfaced as a failure after some copies), a stale "refused" is cleared by the panel's refresh on open and the next call.

Why on the server too: for an embedded editor the panel's list is the last saved state, so only after the save are the real dependencies known; checking before the first copy turns the mid-write `403` into a clean refusal.

Alternatives: relying on Core's `403` alone (rejected: partial copies), a Core permissions lookup per resource (rejected: more calls and no benefit over the same data the panel uses).

### D4. The icon is copied when allowed, otherwise dropped from the staging copy

`getPublishableIconUrl` (`apps/chat-api/src/publish/publish-target.util.ts`) already decides whether `iconUrl` is an uploaded file in the caller's bucket; today it is private to `PublishService`, so it moves to a shared reader used by both. For such an icon, with `write` on `files` at the folder, the icon is copied to `getPublishedIconTargetUrl(folder, targetResourceName, iconUrl)` and the staging copy's `iconUrl` is set to that target. Without the right, or when the icon copy fails, the `iconUrl` field(s) are removed from the staging copy only; the application's own icon is untouched and the write continues. A theme icon name or an absolute URL is left as it is.

The icon is deliberately not part of the rights refusal in D3: a broken icon is cosmetic, a missing dependency is functional.

### D5. The panel guard also considers the dependencies' namespaces

`buildFolderGuards` (`libs/chat-hooks/src/org-units/org-unit-guards.ts`) answers per namespace for a folder. `useResourceSavePanel` gains an optional rights input and a typed reason callback, and derives the namespaces from the dependency list it already loads (type to namespace, `file` excluded). A unit folder on the direct path whose dependencies need a namespace the user cannot write is disabled with a reason naming the types, through the existing `getDisabledReason` channel. The hint uses the list the panel has, so for an embedded editor it uses no dependencies and D3 is the real check.

The panel hint is deliberately conservative: it judges every dependency of the list, while the server (D3) judges only the dependencies still to be copied, so a folder where the user lacks `write` on a namespace whose dependency is already there is greyed out in the panel although the server would accept the write. The hint reads the list while an Organization folder is only being browsed, so a folder is disabled before it is committed; the list itself is shown only for a committed Organization destination.

`apps/chat` supplies the translated reasons (new `orgUnitAccess.*` keys), as it supplies the existing ones; the lib learns nothing about copies or endpoints.

### D6. The icon notice and the embedded-editor sentence are host-supplied text

`SaveToFolderPanel` gets one optional `dependenciesNote` (a string) rendered in the dependencies section when the list is empty, and a plain notice slot is not added for the icon: the icon hint is passed as the same kind of optional note under the destination, only when the destination is a unit folder lacking `files` `write` and the application has an uploaded icon. Both are controlled by the host; the lib decides nothing. The host knows the kind from `ApplicationSavePanelConfig` (a new flag for kinds whose form state is inside an embedded editor) and the icon from the resource it is saving.

The host controls both notes through two props of `ResourceSavePanelContainer`: `isFormStateEmbedded` (from `ApplicationSavePanelConfig.isFormStateEmbedded`, set by the Quick App definition) makes the container pass the neutral sentence, and `hasUploadedIcon` (computed in `ApplicationFormEditor` with `isOwnDialFileId` from `@epam/ai-dial-chat-hooks` and the user's own bucket) makes it pass the icon notice. The library carries the notice as `destinationNote` with `noteClassName` and `colors.noteText`, and `useResourceSavePanel` decides when it shows (`iconNote`, only for a direct write into a unit folder where `files` is not writable).

Alternative: rendering the sentence from the list's labels (rejected: the list component is built around rows; a one-line note is simpler and keeps the list untouched).

### D7. Wording: the Published variant for the Save panel

The dependency section in the Save panel uses the same `Published` appearance and `publish.dependenciesPublished*` keys as the application's Publish panel (`apps/chat/src/utils/publish.ts`, `getPublishDependenciesLabels` and its published variant). Both Save paths now carry the dependencies along: a publication request through publishing with dependencies, a direct write through this change.

### D8. No rollback

A failure after some copies leaves them in place under `.{app}.deps`. Deleting what this call copied was considered and rejected: deletions in the shared space need their own rights, other users may already reference a reused target, and a retry makes the copies useful rather than waste. The staging copy is always deleted.

### D9. Authorization

Unchanged: any authenticated session, gated by `features.orgUnitsEnabled`; Core's own checks are the authority. The new `403` of D3 refuses earlier, with the same status Core would have used.

## Risks / Trade-offs

- **Core behaviours rest on reading Core's code.** The plain copy not touching `iconUrl`, the per-type rights, and the namespace layout were read, not run → a contract test with the same fixtures style as the publish dependencies' (`apps/chat-api/src/publish/tests/dependencies/`) and a live check on a dev environment before merge are desirable.
- **Not atomic** → documented; retry completes; staging is always removed.
- **Stale rights (60 s cache)** → Core remains the authority; the panel refreshes on open.
- **Embedded editor** → the panel's hint is blind to new dependencies; D3 catches them after the save, and the user's edits are saved in their own bucket either way.
- **Splitting `prepare`** → touches the code the open publish change owns; the split keeps the publish path byte-for-byte, and any change to `prepare` from that review is merged into this branch.
- **Interceptors, functions, bucket copy** → same recorded limitations as publishing; here the failure is shown instead of silently falling back.
- **Dependencies in another user's bucket.** The panel's list (and so its rights hint) holds every private reference the form makes, while the server copies only those in the caller's own bucket, as in publishing. For an application that uses another user's private resource the panel can disable a folder for a namespace whose resource the server would not copy, and lists that resource as saved. Accepted: the same list is shown by the Publish panel, and filtering needs the caller's bucket in the panel's host.
- **The icon is read best-effort.** When the application's own read for the icon fails, the write takes the plain path and the copy keeps its `iconUrl`, which may point at the author's private file; the dependencies' read is strict, the icon's is not, as in publishing (a warning is logged).
- **Dot folders under a unit folder** show in listings that include them, as in publishing.

## Migration Plan

No data migration. Deploy backend and frontend together or backend first (the panel changes are additive). Rollback: revert the change; copies already written stay valid. Run `npm run openapi` and `npm run openapi:check` if the copy endpoint's documented responses change, `npm run validate:docs` and `npm run validate:specs`.

### D10. The host reads the icon from the editor's current metadata

The icon notice of D6 needs to know whether the application has an uploaded icon in the user's own bucket. `ApplicationFormEditor` already holds the raw DIAL value in `metadata.values.iconUrl` (filled from the deployment and updated when the user changes the icon, and the source of the `iconUrl` the container already receives for the summary). The host decides with `isDialFileId` from `@epam/ai-dial-chat-hooks` and a comparison of the file's bucket with the user's own bucket (`user.bucket`, as `ConversationsContext` does), and passes one boolean to `ResourceSavePanelContainer`. This reflects what will actually be saved, works for every kind (the icon belongs to the shared metadata form, not to an embedded editor), and matches the server's own rule in `getPublishableIconUrl`; the server stays the authority.

Alternatives: reading the loaded deployment's `iconUrl` (rejected: stale when the icon was changed before saving); no notice (rejected: the user would not learn that the icon was dropped); a flag in the endpoint's response (rejected: changes the contract and reports after the fact).

### D11. The Save panel asks the existing target check for a direct-write folder

Today a name already taken in the unit folder shows only after the save: the resource is saved in the user's own bucket, the copy answers `409`, and the panel has already closed ("saved, but could not be written to {folder}"). The Publish panels avoid this with `onCheckTargetExists` of `usePublishFlow` (`libs/publish-panel/src/utils/use-publish-flow.ts`), wired by `usePublishTargetGuard` and `PublishApiClient.checkPublishTarget` (`libs/chat-hooks/src/catalog/`): the backend reads the target's metadata with the caller's token (`dialResourceExists`) and answers `{ taken }`. The Save panel reuses it.

- **Where.** `useResourceSavePanel` gets the same effect as `usePublishFlow`: it runs when the committed destination is a direct-write folder, and again when a valid new version changes; an answer that arrives after the folder or version changed is discarded; a rejected check leaves the target untaken and never blocks Save. `publishClient` (already passed to the hook) gains `checkPublishTarget`. No new endpoint, DTO or generated-client change.
- **Which name is asked.** The direct write keeps the stored leaf, so "keep version" asks without a version (the backend then uses the stored name, as the copy does); "save as new version" asks with the typed version, which names `{name}__{version}` exactly as the fork does. The typed version is checked only when it matches the version pattern and differs from the current one, after 400 ms without typing.
- **Which destinations.** Only a direct-write unit folder, for every resource type that has a direct write. Not Personal, not a folder created in this session, and not a destination that sends a publication request (that path keeps its own refusal).
- **Result.** Save is disabled with the reason `resourceSavePanel.targetTaken`, through the same disabled-destination channel as the rights reasons (`aria-describedby` and the folder-view reason already exist). The refusal after the save (`SavedButAlreadyInOrgUnit`) stays for the race and for a copy the caller cannot read, which the check reports as free.
- **Cost.** One metadata read per change of destination to a direct-write folder, and one per settled valid version edit; none when the panel opens, none for Personal.

Alternatives: checking every folder of the tree when it is listed (rejected: many reads for a choice the user makes once); leaving the refusal after the save (rejected: the user ends up with a saved resource and no write, and learns it only after the panel closed).

## Open Questions

None that change the specs, the approach or the task breakdown.
