# Proposal

Source of truth: GitHub issue epam/ai-dial-chat#9844, "[Publishing] Version history in the save and publish flow for applications and toolsets", plus the code. The issue author agreed that the history follows the mockups (a section inside the Save and Publish panels). That departs from the issue text in a few places; every departure is listed under "Departures from the issue" and is reported to the issue as a comment, not by editing it.

## Why

Applications and toolsets are versioned (`<folder>/<name>__<version>`, with `display_version` in DIAL Core), and the Save panel already offers Keep version / Save as new version. Users still cannot see which versions of a resource exist or which of them are published. Version strings are also validated by seven different patterns across the UI and the API (the issue lists four; `update-application.dto.ts`, the fork-version DTO and the `builder-form` default `VERSION_PATTERN` are additions), so the UI can accept a version the API rejects (or the reverse).

## What Changes

- One shared version rule replaces the seven patterns. It is the issue's proposal `^(?!\.+$)[\w.+-]{1,64}$` plus three exclusions: `^(?!.*\.$)(?!.*__)(?!_)[\w.+-]{1,64}$`. A trailing dot is rejected because DIAL Core answers 400 for a path whose last segment ends with `.` and the version ends that segment. `__` and a leading `_` are rejected because `__` is the separator between the name and the version in the stored path (the issue and `RESOURCE_VERSION_SEPARATOR` define it) and the path is split at its last `__`, so such a version would split the versions of one resource into different groups.
- `GET /api/v1/deployments` and `GET /api/v1/toolsets` items gain an optional, additive `versionGroupId` (folder + base name without the `__<version>` suffix). The response shape is otherwise unchanged.
- New `GET /api/v1/catalog/:entityType/:entityId/version-statuses` returns `{ id, version, status, publishedFolders[], publishedBy? }` per version of the entity's version group. It resolves the group from the deployments or toolsets listing, reads the caller's bucket publication list once per request, and reports `Not published`, `In review`, `Published` (`unknown` for resources the caller does not own).
- A **Versions history** section at the bottom of the Save panel and of the Publish panel, as in the mockups. Each row shows the version, a **Current** marker, the publication status, the folder, the last modified date and the author. Rows are the saved versions of the resource in its folder, newest first by last modified date. The section has loading, empty, error and retry states.
- The Save panel's Keep/New version section stays as it is in the code today (`Keep version {version}`, `Version` input, empty at start). The Publish panel keeps publishing the saved version, with no version input. The Dependencies list in the Publish panel is unchanged; the Save panel gets none.

Alternatives considered for the history data:
- Statuses inside the listing responses: rejected, N Core requests on every catalog render.
- A new "list versions" endpoint: rejected, the listings already return one item per version with `id`, `displayVersion`, `updatedAt`, `owner` and `isMy`, and the BFF already reads them (`apps/chat-api/src/resource-identity/resource-identity.service.ts`).
- Chosen: group the already-loaded listing by `versionGroupId`, and load statuses from a separate endpoint when a panel opens.

## Departures from the issue

To be posted as a comment on the issue (the author edits it if he agrees):

1. History is an inline section of the Save and Publish panels (mockups), not a separate view behind a "View version history" link; there is no **Open** action (the mockups have none, and opening another version from the Save panel could discard the unsaved edits it was opened with).
2. The Save panel keeps the current labels (`Keep version {version}`, `Version`), which match mockups 2 and 3; the issue asks for "Keep current version" with the version at the row end and a "New version" label (mockup 1).
3. Rows also show the folder and the author, as in the mockups; the issue lists version, date, Current and status only. The author is the publisher for a published version (so the endpoint also returns `publishedBy`) and otherwise the listing's `owner`, which is Core's original author of the resource, not necessarily who saved that version. The folder is the same on every row, because a version group is scoped to one folder.
4. The shared rule also rejects a trailing dot (Core limitation; discussed with the issue author), `__` inside a version and a leading `_` (they break the split of `{name}__{version}` at its last `__`, so one resource's versions would fall into different groups); the issue's pattern allows all three.
5. The shared pattern is two mirrored constants (`apps/chat-api` and `libs/chat-shared`) with one test corpus on both sides, not one file: `type:backend` projects may only depend on `type:backend` libraries.
6. The statuses cache holds the caller's resolved publications per bucket (the group join is done on every call), not "per user and entity"; publish and unpublish clear it. A decision made by an admin (Pending to Approved or Rejected) does not pass through them, so a status can lag by up to the 60 s TTL.
7. The Publish panel for applications and toolsets is hosted by the catalog Details panel (`libs/catalog`), so `libs/catalog` gains props for the section. The issue's "the catalog is not changed" referred to the history view, which no longer exists.

## Capabilities

### New Capabilities
- `resource-version-pattern`: one version rule for the UI and every API write path for applications, toolsets and publish targets.
- `catalog-version-statuses-api`: the `version-statuses` endpoint, its status mapping, group resolution, caching and invalidation.
- `resource-version-history`: the Versions history section, the hook that groups the listing and loads statuses, and the app wiring.

### Modified Capabilities
- `resource-save-panel`: the main view gains the Versions history section; validation uses the shared rule.
- `deployments-api`: `DeploymentItemDto.versionGroupId`.
- `toolset-listing`: `versionGroupId` on the toolset list item.
- `publish-panel-library`: the history section component, rendered by `SaveToFolderPanel` and `PublishPanel`.
- `catalog-publish-flow`: the catalog Details publish panel passes the history section through.
- `catalog-publish-api`: publish and unpublish also clear the statuses publications cache.
- `builder-form`, `application-editor-registry`, `toolset-authoring`, `toolset-editor-library`, `custom-app-editor`, `application-create-api`: they cited the old patterns; their deltas re-point them to the shared rule. `libs/builder-form` stops exporting `SEMVER_VERSION_PATTERN`, its default `VERSION_PATTERN` becomes the shared rule re-exported from `@epam/ai-dial-chat-shared` (`RESOURCE_VERSION_PATTERN`), and the three application editor definitions pass `validateVersionPattern: true`.

## Impact

- `apps/chat-api`: `applications/dto/{create-application,update-application,application-version}.dto.ts`, `toolsets/dto/toolset-body.dto.ts`, `publish/publish-target.util.ts`, `deployments/dto/deployment-item.dto.ts`, `openapi/openapi-response.dto.ts` (`DialToolsetDto`), `publish/` (statuses service and controller route), OpenAPI artifacts and `libs/chat-api-client` regeneration. `splitEntityNameAndVersion` in `publish/publish.service.ts` and the private separator constants in `publish-target.util.ts` and `publish-dependency.util.ts` move to the shared `RESOURCE_VERSION_SEPARATOR` in `common/utils/next-free-path.ts`.
- `apps/chat-api/src/publish/publication.util.ts` and `publish.service.ts`: detail resolution is split from per-source narrowing so one publication read serves every version; `publish-history` output stays identical (`isDetailCandidate` itself is unchanged).
- `libs/chat-shared` (mirrored rule), `libs/builder-form`, `libs/toolset-editor`, `libs/publish-panel`, `libs/catalog` (Details publish panel props), `libs/chat-hooks`, `apps/chat`: see `design.md` for the library-isolation constraints.
- READMEs: `libs/publish-panel`, `libs/builder-form`, `libs/chat-hooks`, `libs/chat-shared`, `libs/toolset-editor`, `libs/catalog`.
- i18n: new strings for the section heading, Current, the three statuses, the author lines and the loading/empty/error/retry copy; lib strings come from `*Labels` props with English defaults, the app fills them with `t()`.
- Docs: `libs/publish-panel/README.md`, `libs/builder-form/README.md`, `libs/chat-hooks/README.md`; `npm run validate:docs` and `npm run validate:specs` must pass.
- Scope creep flags: touches six shared libs (including `libs/catalog`) and the shared publication util, and leaves `isDetailCandidate` unchanged on purpose.
- Breaking for consumers of the published `@epam/ai-dial-builder-form` package: it no longer exports `SEMVER_VERSION_PATTERN`, and its default `VERSION_PATTERN` is now the shared rule (README updated). Nothing in this repository still uses the removed export.
- Behavior change on input validation: applications gain a 64-character cap and accept `+`; applications and toolsets reject a trailing dot, dots-only versions, `__` inside a version and a leading `_`. Existing stored versions longer than 64 characters or ending with a dot would be rejected only when a request supplies them again.

## Rollback and compatibility

The field and the endpoint are additive and can be reverted independently. The version rule is the only behavior change; reverting restores the previous per-surface patterns. The API must change before or with the UI, so the UI never accepts a version the API rejects.

## Non-goals

Aliases (Production, Staging), the Move aliases block, dependency impact summary, a Dependencies block in the Save panel, a version input in the Publish panel, grouping versions in the catalog, a version switcher in the catalog or chat, restore/delete/compare/open from the history, and unpublishing several versions at once.

## Acceptance criteria

- The Save and Publish panels show a Versions history section for applications and toolsets, on desktop and mobile; prompts and skills show none.
- Invalid, unchanged and existing versions show inline errors; UI and API accept exactly the same set of versions (shared corpus test on both sides).
- The deployments and toolsets listings keep their shape; the only change is the additive `versionGroupId`.
- The section lists the versions of the resource with date, Current marker, status, folder and author, newest first.
- A version saved with Save as new version appears in the section without waiting for the cache to expire.
- A private resource that was never published lists its versions as Not published, with no error.
- Loading the statuses reads the bucket's publication list once, not once per version.
- Publishing uses the saved version; publishing an already-published version is still blocked.
- Unit tests for `versionGroupId`, the statuses endpoint (happy path, Pending/Approved/Rejected mapping, 404, validation), the hook and the lib components; OpenAPI and the generated client are current; `npm run validate:docs` and `npm run validate:specs` pass.
