# Design

## Context

See `proposal.md` for the problem. The constraints that shape the approach, all verified on
`development`:

- Resource identity in DIAL Core is the path, and the path is fixed at creation. Rename only
  rewrites `displayName` (`ApplicationsService.updateApplication` merges `displayName` into
  the stored body; `ToolsetsMutationService.updateToolset` writes to the resolved existing
  path). Skills and prompts avoid the gap because their name *is* the path; applications and
  toolsets cannot, so uniqueness has to be judged on displayed values.
- `DeploymentsListingService.listDeployments` returns applications (and models) with
  `displayName`, `displayVersion`, `interfaces`, `isMy` and, for applications,
  `applicationFolder`, and accepts `refresh = true` to bypass its 30 s cache. It drops
  toolset entries on purpose. `ToolsetsListingService.listToolsets` returns toolset
  resources (also with `displayName`/`displayVersion` and ownership flags) with its own
  30 s cache and no refresh option.
- The stored application body has no `interfaces`: DIAL Core derives them (`mcp` from the
  type schema, `chat` from the endpoint, `custom_ui` from `viewer_url`). They exist for an
  already-written application only in its deployments list entry.
- `displayName` is a `LocalizedText` (a string or a locale-to-text map). A map carries no
  marker of the primary locale; only the write path knows it (`composeLocalizedFields`
  seeds `primaryLocale`, default `en`).
- `isMy` is derived from the owner-bucket segment of the resource id
  (`computeItemOwnershipFlags` in `apps/chat-api/src/common/utils/resource-ownership.ts`),
  so own-bucket filtering needs no extra call.
- `apps/chat-api` does not import `libs/*`. The tab classification that decides which
  applications are "toolsets" is implemented in `libs/chat-hooks`
  (`resolveDeploymentCatalogTabs`, which also honours an `isToolsetTabEnabled` option the
  backend cannot see); the backend needs its own equivalent.
- `getApiErrorDetails` (`libs/chat-hooks/src/api-error/api-error.ts`) already surfaces a
  response body `code`. The Save panel (`libs/chat-hooks/src/catalog/useResourceSavePanel`)
  renders a thrown `ResourceSaveError` message, but for any other failure of a new-version
  write answered with `409` it shows its generic version-exists text, so a custom message
  needs a `ResourceSaveError`. `ApplicationFormEditor` handles `409` only when not in edit
  mode.
- Module graph today: `ToolsetsModule` and `ApplicationsModule` both import
  `DeploymentsModule`; `DeploymentsModule` imports neither. `ToolsetsModule` exports only
  `ToolsetsService`.

## Goals / Non-Goals

**Goals:**

- One definition of "duplicate" used by every write path, easy to unit test without Nest.
- Toolsets and applications behave the same where they share a problem: the same duplicate
  rule and the same next-free-path handling of a renamed entity's path.
- No behavioural change for requests that are not duplicates.
- Reuse the existing 409 plumbing in the editors and the Save panel.

**Non-Goals:**

- Making the check atomic (DIAL Core offers no cross-resource transaction), or fixing
  duplicates that already exist.
- A new endpoint, DTO or operation id.
- Anything inside `libs/*` or DIAL Core.

## Decisions

### D1. Backend check, pure core plus thin gatherers

A pure function in `apps/chat-api/src/common/utils/` takes the candidate identity
(`folder`, `displayName`, `displayVersion`, `tabs`, optional `selfId`) and a flat list of
own entities (`id`, `kind`, `displayName`, `displayVersion`, `interfaces`) and returns the
first conflicting entity or `undefined`. Services gather the lists and call it:

- `ToolsetsMutationService`: reads own toolsets and deployments, compares with the
  Toolsets tab. It injects `DeploymentsService` (the facade `DeploymentsModule` exports).
- `ApplicationsService`: reads deployments, and toolsets only when the application's
  deployments entry places it in the Toolsets tab, and compares with the tabs from that
  entry.

The folder of an entity is the part of its resource id between the bucket and the last
segment, decoded; the bucket root is the empty string. The candidate's `folderPath` is
decoded the same way before comparing.

Alternatives: a Nest service in a new module (rejected: the logic has no state, and a new
module would need `ToolsetsModule` and `ApplicationsModule` to import each other's data);
putting the rule into DIAL Core's write path (not available); a client-only check
(rejected in the proposal).

### D2. Tab membership is a backend equivalent pinned by a test

A small function maps `interfaces` to the tabs per the table in
`resource-name-uniqueness` (the same table `catalog-interface-classification` states for the
frontend). It is a deliberate duplicate of `resolveDeploymentCatalogTabs` because the
backend cannot import the lib. A unit test enumerates the table rows so a change to the
table shows up as a failing parity test. It pins the table only: the frontend's
`isToolsetTabEnabled` option cannot be observed by the backend, so the backend always
classifies as if the Toolsets tab is enabled (stricter, never looser; stated in the spec).
Alternative considered: extract the rule into `libs/chat-shared` and import it from
`chat-api`. That is a larger dependency change for the backend and out of scope; recorded
as a possible follow-up.

### D3. Keep the path-level protection and give toolsets the same fallback

`createOnly` still sends `If-None-Match: *`, and applications keep the next-free-path loop.
Toolsets get the same loop now. Reason: renaming never moves a path, so a renamed toolset
still holds its original path exactly like a renamed application does, and without the loop
a name nothing visible owns would be refused with a false "version already exists" (the
problem #9381 reported for applications). Applying the same remedy is nearly free because
the precedent exists, and keeping the two aligned means whoever later removes the loop
(because DIAL Core changes or a better scheme is found) does it once, in both places.

The loops stay in the two services, because the write call and the error mapping differ,
but the pieces they must agree on are shared in one util
(`apps/chat-api/src/common/utils/next-free-path.ts`): the candidate limit constant and the
leaf builder (`name`, `-N` suffix, `__version`). Moving the whole loop behind a callback
was considered and rejected as more indirection than two short loops justify; if that
turns out wrong during implementation, the util keeps the two in step and the spec text
states the shared limit.

After the identity check passes, a 412 therefore means either a path held by an entity
with a different displayed identity (a renamed entity) or a racing create.

### D4. Error contract

`409 { statusCode, message, code }` with `code` one of `name-taken-agent` or
`name-taken-toolset` (precedent: `ProjectCreateErrorCode.NameTaken` in
`apps/chat-api/src/projects/types/project-create-error-code.enum.ts`). The kind is part of
`code` rather than a second field because `getApiErrorDetails` already forwards `code` and
no change to the shared lib is needed. The codes are a string enum declared with the DTOs
and referenced from the error response schema so `npm run openapi` publishes it;
`apps/chat` compares against the generated enum, never a string literal (rule in
`.claude/rules/apps.md`).

### D5. Frontend mapping stays in the app

The app-level save adapters and editors read `code` from `getApiErrorDetails` and translate
it with two new keys (`appsEditor.error.nameConflictAgent`,
`appsEditor.error.nameConflictToolset`; enum members in `translation-keys.ts`):

- create and new-version writes (create-only, fork): the adapter wrapper in `apps/chat`
  turns the `409` into a `ResourceSaveError(translated message)`, which the Save panel
  already renders inline and keeps open; an unrecognised `409` keeps today's rendering;
- in-place saves in `ApplicationFormEditor.tsx` and `ToolsetApplicationEditor.tsx`: a
  `409` carrying one of the codes shows the same message on the Name field, including in
  edit mode, which the create-only branch of `ApplicationFormEditor` does not cover today.

Libs get no endpoint, code or i18n knowledge; `libs/chat-hooks` is untouched and receives
only a resolved string.

### D6. Freshness and cost

The check must see a duplicate created seconds ago, so it bypasses the 30 s caches:
`listDeployments(..., refresh = true)` already exists; `ToolsetsListingService.listToolsets`
gains an optional `refresh` argument with the same semantics. Called without an interface
filter, a refresh re-fills the base keys (`deployments:list:{userSub}`,
`toolsets:list:{userSub}`); filtered variants of the deployments key age out within their
30 s TTL, and no new keys or invalidation events are introduced. Existing invalidation on
successful writes stays.

A fresh read is not just one HTTP call: both list services also run ownership enrichment
(shared-resource lookup) and the deployments list reads the installed ids. The cost is
paid only on identity-changing writes (D8), and the two reads run in parallel; it is the
price of an authoritative answer and is accepted.

### D7. Failure mode

If either read fails the write fails with that read's mapped status (the existing
`mapDialHttpStatus` behaviour). Skipping the check on read failure was rejected: it would
silently reintroduce duplicates exactly when Core is degraded.

### D8. Check only when identity changes, from a known stored identity

Update and move run the check only when displayed name, displayed version or folder differ
from the stored values. The stored values come from the fresh list entry whose id matches
the entity being written (`updateToolset` does not read the toolset today, and the stored
application body lacks `interfaces`). An absent `version` in the update body is defaulted
exactly as the write defaults it (`1.0.0`) before comparing, so omitting it is not a
change. A description edit therefore never pays for the check and never fails because of a
pre-existing duplicate.

### D9. Localized names

The displayed name of a stored entity is resolved by one rule shared by both entity kinds:
a string as it is; a locale map by its `en` entry, otherwise its first entry. The
candidate is the submitted `name`, which is the primary-locale value for every body. This
makes the check deterministic without guessing which locale a stored map considers
primary. Not detected: a candidate whose primary locale is not `en` and whose name matches
only a non-`en` entry of an existing map; accepted as an edge case and stated in the spec
by the rule above.

### D10. Module wiring

`ToolsetsModule` exports `ToolsetsListingService` in addition to `ToolsetsService`, and
`ApplicationsModule` imports `ToolsetsModule`. This adds no cycle (`ToolsetsModule` does
not import `ApplicationsModule`, and `DeploymentsModule` imports neither). Alternative
considered: a new shared module that owns both reads; rejected as a larger surface for the
same wiring.

## Risks / Trade-offs

- [Race: two creates pass the check] → the path-level `If-None-Match` still prevents
  overwriting and the next-free-path fallback places the second entity; a duplicate is
  possible only for truly concurrent requests. Accepted.
- [Extra latency on identity-changing writes] → D6; reads run in parallel; accepted.
- [Dual-interface entities] → on update the application is checked against both tabs; a
  rename can be rejected because of a toolset-tab entity even though the user edits "an
  agent". The message names the conflicting kind to explain it.
- [Reverse case] → an application whose schema declares MCP is treated as an agent on
  create, so a same-name toolset is not detected. Documented non-goal.
- [#9726 reports "same name" without a version] → the key includes the version, so an
  MCP-capable agent at a different version from the new toolset does not block it, and an
  agent that is not in the caller's own bucket (for example a platform-provided one) is
  never compared. Chosen deliberately: versions are meant to coexist, and public or
  platform entities legitimately share names with personal copies. Recorded as a known
  limitation in `proposal.md`.
- [Parity drift of the tab rule between libs and backend] → D2 test plus the table in the
  spec.
- [Behaviour change for API clients that relied on `name-2` for identical names] → the
  fallback no longer produces identical displayed identities; this is the intended fix.
  Internal callers only (`apps/chat`).
- [Existing duplicates] → editing one of them without changing identity still works (D8);
  renaming it to the identity of its twin is rejected.

## Migration Plan

No data migration. Deploy backend and frontend together (the frontend change only adds
messages for new `code` values; an old frontend against a new backend shows the generic
conflict rendering). Rollback: revert the helper calls; created data is unaffected.

## Open Questions

None that change the specs or the task breakdown.
