## Context

DIAL Core's sharing model is **invitation-link based**, not a live user/group picker. Confirmed directly from the installed `@epam/ai-dial-typescript-sdk` schema (`node_modules/@epam/ai-dial-typescript-sdk/dist/index.d.ts`):

- `shareResource` (`POST /v1/ops/resource/share/create`) takes `ShareResourcesRequest { invitationType?: 'LINK'|'EMAIL', maxAcceptedUsers?: number, resources?: SharedResource[] }` where `SharedResource { url, permissions?: ResourceAccessType[] /* 'READ'|'WRITE'|'SHARE' */, author?, shareCredentials?, sharedBy? }`, and returns `InvitationLink { invitationLink?: string }`.
- `revokeSharedResources` (`POST /v1/ops/resource/share/revoke`) takes `RevokeResourcesRequest { resources?: SharedResource[] }` (same per-resource shape as share; no response body).
- `discardSharedResources` (`POST /v1/ops/resource/share/discard`) takes `ResourceLinkCollection { resources?: ResourceLink[] }` (URL-only, no permissions; no response body) — a deliberately smaller shape than revoke, because discarding is a recipient-side action that never needs a permission list.
- `getSharedResources` (`POST /v1/ops/resource/share/list`) takes `ListSharedResourcesRequest { includeUserInfo?, order?, resourceTypes?: ResourceTypes[], with?: string }`. `FilesService.listSharedFiles` (current code, `apps/chat-api/src/files/files.service.ts`) already calls this with `{ resourceTypes: ['FILE'], with: 'me', includeUserInfo: true }` for the shared-with-me listing. The SDK also exposes `ListPermissionRequestShareWith: 'ME' | 'OTHERS'`, the enum backing `with` — so the owner-side counterpart is `with: 'others'`.

This matches the legacy (`origin/development`) implementation exactly: `ShareService.share()` posted to `/api/share/create` and returned a `ShareByLinkResponseModel` (an invitation link) — confirmed by reading `apps/chat/src/utils/app/data/share-service.ts` on `origin/development`. Legacy `sharedByMePaths` was computed client-side in `apps/chat/src/utils/app/file-manager-adapter.ts::buildFileTree` as `files.filter(f => f.isShared && !f.sharedWithMe)` — those `isShared`/`sharedWithMe` booleans came from the legacy Redux file model, not from `ListFilesItemDto` (today's BFF DTO has no such fields, confirmed absent). Legacy's `Unshare`/`RemoveAccess` UI actions dispatched to two distinct Redux thunks (`discardSharedWithMe` / `revokeAccess`, `apps/chat/src/utils/app/file-manager-unshare-dispatch.ts`), grouping items by file vs. folder before calling Core — confirming the revoke/discard split is not a UI simplification, it is how DIAL Core itself models the two operations.

The installed `@epam/ai-dial-ui-kit` (`node_modules/@epam/ai-dial-ui-kit/dist/src/types/file-manager.d.ts`, confirmed via MCP `getEntityDetails`) defines `DialFileManagerActions.{ManagePermissions, Unshare, RemoveAccess}` with different availability per surface:

| Action | Grid (`GridOptions.actionLabels`) | Tree (`FileTreeOptions.actionLabels`) | Bulk (`BulkActionsToolbarOptions.actionLabels`) | Callback |
|---|:---:|:---:|:---:|---|
| `ManagePermissions` (Share) | ✓ | ✓ | ✗ | `onManagePermissions(path?: string)` |
| `Unshare` | ✓ | ✓ | ✓ | `onUnshareFiles(files: DialFile[])` |
| `RemoveAccess` | ✓ | ✓ | ✓ | `onRemoveFilesAccess(files: DialFile[])` |

Share has no bulk affordance (single-item only, matching `onManagePermissions`'s single optional `path`); Unshare/RemoveAccess are batch-capable everywhere, matching legacy's group-by-file/folder batching. There is **no** `onShareFiles`/`onShare` prop and **no** built-in share-dialog surface in the installed ui-kit — `onManagePermissions` only signals "the user wants to manage permissions for this path"; the app owns the entire share UI. No `ShareModal`/`ShareDialog` component exists anywhere in current `apps/chat/src` (confirmed by repo-wide search) — the legacy share dialog lived in a different, conversation/prompt-sharing-oriented component tree that isn't reusable as-is for this button-driven `onManagePermissions(path)` contract.

## Goals / Non-Goals

**Goals:**
- `POST /api/v1/files/share`, `POST /api/v1/files/revoke-access`, `POST /api/v1/files/discard-shared` — thin proxies to Core `shareResource`/`revokeSharedResources`/`discardSharedResources`.
- `FilesService.listSharedByMe(bucket)` — the `with: 'others'` counterpart to the existing `listSharedFiles`, feeding `sharedByMePaths`.
- `useDialFileManager.onManagePermissions` opens a new `ShareFileModal`; `onUnshareFiles`/`onRemoveFilesAccess` call the BFF directly.
- Bulk `Remove access` visible only when every selected path is in `sharedByMePaths` (mirrors legacy `allSelectedItemsShared` guard).
- Define `DialFileManagerActionProfile.Full` as the profile that exposes Share/Unshare/Remove access (this change) plus Info and upload-archive (the two follow-up changes).

**Non-Goals:**
- Email-type invitations (`invitationType: 'EMAIL'`, `maxAcceptedUsers`) — MVP ships `LINK` only. Core supports `EMAIL` but it requires an email-delivery integration this change does not add; tracked as an explicit open question below.
- A permission-management UI showing "who currently has access" (list of existing grantees, ability to change/revoke an individual grantee's permission) — Core's `revokeSharedResources` revokes **all** access for a resource, it does not support per-grantee revocation, so there is nothing to build a per-user list against without additional Core support. Out of scope; revoke is all-or-nothing, matching Core.
- Folder-capable share/unshare beyond what Core's `url`-based resource addressing already provides for free — no special-cased folder UX is added; a folder's `url` is shared/revoked/discarded exactly like a file's.
- Switching `DialFileManagerPage` to `actionProfile=Full` — deferred until Info (metadata) and upload-archive also ship, so `Full` is only adopted once its entire action set works.
- A host-owned confirmation dialog before Unshare/Remove access (see D5).
- An invitation-accept flow (see D12) — this change creates and displays the invitation link; it does not build a page/route for a recipient to open that link and accept the share.

## Decisions

### D1 — Three endpoints, one per Core sharing operation, no collapsing

**Decision**: `POST /api/v1/files/share`, `POST /api/v1/files/revoke-access`, `POST /api/v1/files/discard-shared`, each a thin proxy to its own Core SDK operation and its own request schema.

**Rationale**: Core itself models these as three distinct operations with three distinct request schemas (`ShareResourcesRequest` needs `permissions`+`invitationType`; `RevokeResourcesRequest` needs `permissions`-shaped `SharedResource[]`; `ResourceLinkCollection` needs only `url`). Collapsing revoke and discard into one ambiguous "unshare" endpoint (considered and rejected) would force the BFF to either guess which Core operation to call from context it doesn't reliably have, or accept a discriminator field that duplicates what the two separate ui-kit actions (`Unshare` vs `RemoveAccess`) already tell the frontend unambiguously. Matches the existing per-verb endpoint convention (`/copy`, `/move`, `/delete`, `/rename`, `/download-archive`).

**Alternative considered**: a single `POST /api/v1/files/unshare` with a `direction: 'discard' | 'revoke'` field — rejected for the reason above, and because it would need to accept the union of both request shapes, making validation weaker (e.g., accepting a `permissions` field that discard silently ignores).

### D2 — Batch HTTP semantics: 200 with per-item results for share/revoke; discard mirrors Core's bodyless success

**Decision**:
- `/share`: request is a batch (`items: ShareItemDto[]`, one per resource), but Core's `shareResource` returns **one** `InvitationLink` for the whole call (it issues a single invitation covering all listed resources, matching Core's own multi-resource invitation model). Response: `{ invitationLink: string }`, endpoint-level 200 only on full success; a Core-side failure is surfaced as a typed HTTP exception (400/403/404/502/503), not a per-item result — there is no partial-success concept for a single invitation-link creation call.
- `/revoke-access`, `/discard-shared`: request is a batch (`items: string[]` of API paths), Core has **no** batch-partial-failure response for these two operations either (`revokeSharedResources`/`discardSharedResources` both return an empty 200 body or an error — confirmed from the SDK response schema, no per-resource result array). The BFF therefore issues one Core call per batch (Core accepts an array of `SharedResource`/`ResourceLink` per request already), and reports per-item results by catching failures **per Core call attempt**, not per array element inside it — if Core's single batched call fails, every item in that call is marked failed with the same error string; there is no way to know which individual resource inside a multi-resource Core call failed, because Core's response carries no per-resource detail.

This differs from `/copy`/`/move`/`/delete`/`/rename`, which loop per-item on the BFF side and therefore can report true per-item success/failure. Sharing operations do not loop — the whole batch is one Core call — so per-item granularity is **not available** here. Document this explicitly in the response DTO's field docs so frontend/QA don't expect item-level partial failure that Core cannot provide.

**Rationale**: matching Core's actual capability rather than inventing false per-item granularity. Verified: none of `shareResource`/`revokeSharedResources`/`discardSharedResources`'s response schemas contain a results/status array — only `InvitationLink` (share) or an empty body (revoke/discard).

**Alternative considered**: loop one Core call per resource (like copy/move) to get true per-item results — rejected because it would multiply invitation links (one per resource instead of one covering all of them, changing the sharing semantics: a single link that grants access to N resources vs. N separate links) and would multiply Core calls for revoke/discard for no benefit, since Core already accepts arrays natively for those two.

### D3 — `sharedByMePaths` sourced from a new `with: 'others'` Core query, not from `ListFilesItemDto`

**Decision**: Add `FilesService.listSharedByMe(bucket): Promise<string[]>` calling `dialClient.client.getSharedResources({ body: { resourceTypes: ['FILE'], with: 'others', includeUserInfo: false } })`, reusing the exact pattern of the existing `listSharedFiles` (`with: 'me'`). Expose it as `GET /api/v1/files/shared-by-me` (mirrors the existing `GET /api/v1/files/shared` route shape and response DTO — reusing `ListFilesResponseDto`/`ListFilesItemDto`, no new response DTO needed). `useDialFileManager` calls it once per `my_files` tab load (alongside the existing shared-with-me fetch pattern) and reduces the response to a `Set<string>` of API paths for `sharedByMePaths`.

**Rationale**: Option 1 from the proposal brief (extend `ListFilesItemDto` with `isShared`/`sharedWithMe`/`sharedWith`) would require `FilesService.listFiles`'s normal listing path to make an *additional* Core call per listing (Core's plain file-listing endpoint does not return share-ownership flags — confirmed: `ListFilesItemDto`'s current fields come from Core's listing response, which has no share fields) — i.e., Option 1 doesn't actually avoid an extra Core round-trip, it just hides it inside the existing listing path instead of a separate endpoint, at the cost of coupling ordinary (non-shared-related) listing performance to share-metadata availability. Option 2 (separate query, this decision) keeps `listFiles`/`ListFilesItemDto` completely unchanged and isolates the extra Core call to exactly the surface that needs it (the `my_files` tab's action-matrix computation), matching how `sharedWithMeIds` already works for the Shared tab today.

**Path normalisation**: Core's `getSharedResources` returns items with a Core `url` (`files/{bucket}/{path}`); the same normalisation `listSharedFiles`/`ListFilesResponseDto` already performs (via `normalize-file-item.ts`, `apps/chat-api/src/files/normalize-file-item.ts`) is reused unchanged — no new normalisation code, just a new query parameterization of the same service/DTO pipeline.

**Cache invalidation**: `useDialFileManager` treats `sharedByMePaths` like the existing per-folder listing cache — invalidated and re-fetched whenever `retryCounter` increments for the `my_files` root, which already happens after `onManagePermissions`'s modal closes on success, `onUnshareFiles`, and `onRemoveFilesAccess` resolve (see D6). No separate cache key or TTL is introduced; it rides the existing hook-local (not global/shared) cache.

**Alternative considered**: derive `sharedByMePaths` purely client-side from `permissions` already present on `ListFilesItemDto` (a file with a `SHARE`-capable permission implies it could be shared) — rejected because `permissions` describes what the *current user* can do to the file (their own access level), not whether the file *has been* shared with someone else; a file the user owns and has never shared also carries the same permission set, so this would produce false positives.

### D4 — `ShareFileModal`: single permission choice, LINK invitation only, copy-to-clipboard

**Decision**: New component `apps/chat/src/components/DialFileManagerModal/ShareFileModal.tsx`, opened by `useDialFileManager` when `onManagePermissions(path)` fires. UI: the file/folder name (resolved from `path` against the currently-loaded `items`), a permission choice (`Read` / `Read & Write` — mapped to `ResourceAccessType[]` `['READ']` / `['READ','WRITE']`), and a "Create link" action that calls the new `shareFiles` server-api wrapper with `invitationType: 'LINK'` (hardcoded — no UI control for `EMAIL` in this change, see Non-Goals). On success, the modal shows the returned `invitationLink` in a read-only field with a copy-to-clipboard button (reusing an existing ui-kit input/button primitive, not a new copy-to-clipboard implementation). No "current sharees" list is shown (Non-Goals).

**Rationale**: this is the smallest UI that (a) matches what Core actually returns (a link, not a live share-with-list), (b) matches the legacy UX shape (`ShareByLinkResponseModel.invitationLink`, shown for the owner to copy/send themselves — legacy also had no live user list in the link-based flow), and (c) requires no new dependency (no email-sending integration).

**Alternative considered**: `invitationType: 'EMAIL'` with a recipient email field — rejected for this change because it requires the BFF or Core to actually deliver an email, which is undocumented/unconfirmed behavior for this deployment and materially expands scope; tracked as an Open Question.

### D5 — No confirmation dialog before Unshare / Remove access

**Decision**: `onUnshareFiles`/`onRemoveFilesAccess` call their respective BFF endpoints immediately when the ui-kit action fires — no new host-owned confirmation modal is introduced, even though legacy's `handleOpenUnshareFilesDialog`/`handleOpenRemoveFilesAccessDialog` opened a confirmation dialog before dispatching (confirmed on `origin/development`).

**Rationale**: unlike Delete (which has a dedicated `deleteConfirmationOptions` ui-kit prop specifically because deleting is irreversible data loss), Unshare/Remove access are reversible from the owner's side — the owner can always re-share via `ShareFileModal`, and a recipient who discards a shared-with-me item can be re-invited. The installed ui-kit has no confirmation-popup option for these two actions (unlike delete), so building one would mean introducing a new host-owned confirmation component solely for this change, adding UI surface not requested by `openspec/config.yaml`'s scope-discipline rule for a case with a lower risk profile than delete. If product feedback after shipping asks for a confirmation step, it is a small, isolated follow-up (a `ConfirmationPopup` wrapper around the existing calls), not a re-architecture.

**Alternative considered**: build a lightweight host-owned confirmation modal mirroring legacy's UX exactly — rejected for this change per the rationale above; flagged as a candidate fast-follow if requested.

### D6 — Cache invalidation and hook state

**Decision**: `useDialFileManager` adds `isSharing`/`isUnsharing`/`isRemovingAccess` boolean state (one per action, not a single shared "operation in progress" flag, matching the existing `isCopying`/`isMoving`/`isDeleting`/`isRenaming` pattern rather than introducing a new unified-loading concept). On success of any of the three actions, the hook increments `retryCounter` for the affected tab (`my_files` for share/remove-access, `shared` for discard) so `sharedByMePaths`/`sharedWithMeIds` and the listing refresh together — identical invalidation shape to `onDeleteFiles`.

**Notifications**: failure surfaces via `onNotification(NotificationVariant.Error, ...)` for all three actions (share failure, unshare failure, remove-access failure — three distinct i18n-keyed messages). Share success shows no toast (the modal itself displays the link, which is the success confirmation). Unshare/Remove access success shows no toast either (the item disappearing from the now-refreshed listing is the confirmation), matching `onDeleteFiles`'s silent-success-relies-on-visible-list-change convention used elsewhere in this hook family — this diverges from `onDeleteFiles`, which *does* show a success toast; for consistency within this change, Unshare/Remove access follow the more common "toast only on failure" pattern already used by `onCopyFiles`/`onMoveToFiles`, since removing a shared item from view is a comparably lower-stakes, immediately-visible state change.

### D7 — `DialFileManagerActionProfile.Full` defined; standalone page stays on `Browse` for now

**Decision**: `Full` is defined as the profile that additionally exposes `Share`/`Unshare`/`RemoveAccess` (this change) and, once their respective changes land, `Info` and upload-archive. `isCopyMoveDuplicateAllowed` in `useDialFileManager` is unaffected (Copy/Move/Duplicate availability already doesn't distinguish `Browse` from `Full`, per `file-manager-tabs`'s existing spec). A new, separate gate function (`isShareActionsAllowed(actionProfile)`) governs Share/Unshare/RemoveAccess visibility: `true` for `Full`, `false` for `Browse` and `Attach`. `DialFileManagerPage` is **not** switched to `Full` in this change — it stays on `Browse` until the metadata and upload-archive follow-ups also ship, at which point a final task (tracked as an explicit follow-up, not part of this change's tasks) flips the standalone page.

**Rationale**: switching the live standalone page's profile before every `Full`-gated action has a working handler would silently expose broken/no-op menu entries (Info, upload-archive) to real users. Keeping the profile switch as the very last step across all three #7504 changes avoids a half-wired production surface.

### D8 — NestJS conventions

All backend implementation follows `apps/chat-api/AGENTS.md` (URI versioning, thin controllers, `Logger` + `ConfigService`, validated DTOs with allowlist `@Matches`/`@IsValidFilePath`, typed HTTP exceptions) and the `api-design` skill's contract checklist.

### D9 — `sharedByMePaths`/`sharedWithMeIds` use ui-kit's virtual `DialFile.path`, not DIAL Core resource paths

**Decision**: `useDialFileManager` populates `sharedByMePaths` and `sharedWithMeIds` with the same virtual path format as `DialFile.path` (e.g. `/My files/reports/q1.pdf`), not the DIAL Core resource path (`files/{bucket}/reports/q1.pdf`) the BFF returns in `ListFilesItemDto.path`.

**Rationale**: confirmed directly against the installed `@epam/ai-dial-ui-kit` compiled output (`0.12.0-dev.25`, and the latest published `0.12.0-dev.26` — identical) that row/tree/bulk gating for `RemoveAccess` and `Unshare` compares these sets against `y.path` (`DialFile.path`, the virtual UI path), e.g. `u?.has(y.path)` / `d?.includes(y.path)`. An initial implementation populated both sets with the Core resource path instead, which never matches — Remove access and Unshare silently never appeared in any menu, for any item, on any tab. Fixed via `buildSharedItemVirtualPath` (`apps/chat/src/hooks/files/useDialFileManager.ts`), which strips the `files/{bucket}/` prefix and rebuilds the path under the current `rootLabel`, decoding each segment the same way `buildFromCache` does.

**Verification note for future ui-kit upgrades**: this identifier-space requirement is undocumented in the ui-kit's prop reference (`sharedByMePaths` is described only as "enables UI indicators"); it was discovered by reading the compiled bundle, not the docs. Re-verify against the bundle (not just the changelog) if `@epam/ai-dial-ui-kit` is upgraded and Remove access/Unshare stop appearing.

### D10 — Known ui-kit limitation: `ManagePermissions` (Share) never appears on files, only folders

**Decision**: ship as-is; do not attempt an app-side workaround.

**Finding**: the installed `@epam/ai-dial-ui-kit` (`0.12.0-dev.25`, confirmed unchanged in the latest published `0.12.0-dev.26`) hard-gates the `ManagePermissions` grid/tree menu item on `y.nodeType === Re.FOLDER` in both the grid and tree row-action builders, with no prop to relax this. Manual testing (temporarily flipping `DialFileManagerPage` to `actionProfile: Full`) confirmed: Share appears on folders, never on files, regardless of `actionLabels`, item `SHARE` permission, or any other app-supplied prop.

**Impact**: `specs/file-manager-sharing/spec.md`'s "files and folders" wording for the Share action is only fully realized for folders in the currently installed ui-kit version. The BFF `/share` endpoint, `shareFiles` server-api wrapper, `onManagePermissions`/`onCreateShareLink` hook wiring, and `ShareFileModal` are all file/folder-agnostic and work correctly for either — the restriction is isolated entirely to the ui-kit's row-menu visibility, one layer above this change's code.

**Rationale for not working around it**: there is no supported ui-kit prop or extension point to add a menu entry for the `ITEM` node type; a workaround would mean bypassing the ui-kit's action-menu system entirely (e.g., a custom column/overlay), which is a much larger surface change than this openspec change's scope and would fight the ui-kit's own component model instead of waiting for an upstream fix.

**Follow-up**: file/track an upstream ui-kit issue to lift the `nodeType === FOLDER` restriction on `ManagePermissions`. Once fixed, Share-on-files starts working with no changes needed on the `apps/chat`/`apps/chat-api` side of this feature.

### D11 — Known ui-kit inconsistency: `Unshare` shows in the bulk toolbar but not always in the row/tree context menu for the same item

**Decision**: ship as-is; do not attempt an app-side workaround.

**Finding**: manual testing on the Shared tab (a root-level shared folder, `actionProfile: Full`, after D9's `sharedByMePaths`/`sharedWithMeIds` path-format fix) showed the bulk-actions-toolbar `Unshare` button enabled (i.e. `sharedWithMeIds` correctly includes the selected item's path), while the same item's row/tree context menu omitted `Unshare` entirely. Traced both code paths in the installed `@epam/ai-dial-ui-kit`: `UseGridContextMenuProps`/`UseBulkActionsProps` (`use-grid-context-menu.d.ts`/`use-bulk-actions.d.ts`) both declare `sharedWithMeIds?: string[]`/`sharedByMePaths?: Set<string>` as plain parameters threaded from the same top-level `DialFileManagerProps.sharedWithMeIds`/`sharedByMePaths` this change already wires correctly (confirmed — there is no separate `gridOptions.sharedWithMeIds`/`treeOptions.sharedWithMeIds` field being missed). Both hooks receive the identical array/set reference for the identical item, yet gate visibility differently: the toolbar always renders the button and only toggles a `disabled` flag from `sharedWithMeIds`, while the row/tree menu conditionally omits the entry outright from `sharedWithMeIds.includes(y.path)`. Given identical inputs, this discrepancy could not be reproduced from the `apps/chat` side or explained by anything this change controls.

**Impact**: on the Shared tab, a user may see `Unshare` become active in the bulk toolbar for a selection but not find the equivalent single-item action in that row's own context menu. The bulk-toolbar path remains a fully working `Unshare` entry point.

**Rationale for not working around it**: both hooks are internal to the ui-kit's `DialFileManager`/`FileManagerProvider` implementation with no exposed prop to force row-menu recomputation or override its gating; reproducing/patching the row-menu's action list from `apps/chat` would mean re-implementing the ui-kit's own internal menu-building logic, well outside this change's scope.

**Follow-up**: file/track alongside D10's upstream ui-kit issue — this is a related but distinct inconsistency (D10 is a hard node-type restriction with no known cause for the gap; D11 is two internal hooks disagreeing given identical inputs, worth a live-browser repro with `@epam/ai-dial-ui-kit` source maps to pin down before filing).

### D12 — Known gap: no invitation-accept flow exists in this app; `ShareFileModal` displays Core's raw (relative, unopenable) `invitationLink`

**Decision**: ship as-is; `ShareFileModal` displays exactly what `FilesService.shareFiles`/Core's `shareResource` returns (e.g. `/v1/invitations/{hash}`). Do not attempt to construct an absolute URL as part of this change.

**Finding**: manually testing against a local DIAL Core showed the returned `invitationLink` is a path relative to Core itself (`/v1/invitations/{hash}`), not an absolute, openable URL. Tracing the legacy (`origin/development`) sharing flow confirms this is expected of Core's raw response — legacy never displayed Core's `invitationLink` value directly. Instead (`apps/chat/src/components/Chat/ShareModal.tsx`, `apps/chat/src/store/share/share.epics.ts`, `origin/development`):
1. The frontend extracted only the trailing `invitationId` segment from Core's `invitationLink` (`response.invitationLink.split('/').slice(-1)?.[0]`).
2. It built its own shareable URL on **the chat app's own domain**, not Core's: `constructPath(window.location.origin, 'share', invitationId)` → `https://chat.example.com/share/{invitationId}`.
3. Opening that URL hit a dedicated Next.js page/API route (`apps/chat/src/pages/api/share/accept.ts`) that itself called Core's `${DIAL_API_HOST}/v1/invitations/{id}?accept=true` to complete acceptance.

**Impact — this is a functional gap, not just a cosmetic one**: confirmed by repo-wide search that the current `apps/chat` (React Router SPA) + `apps/chat-api` (NestJS BFF) has **no** `/share/*` route, page, or accept-invitation BFF endpoint at all — this entire piece of the legacy sharing feature was not carried over during the migration to the new architecture. Consequently:
- Prepending a domain to Core's raw path (e.g. `${window.location.origin}${invitationLink}`) would produce a URL that still 404s or hits Core directly with no recipient-facing page behind it — it would not actually fix anything, only make the link *look* well-formed.
- The real fix requires new scope this change does not include: a frontend route + page component to receive `invitationId` from the URL, and a new BFF endpoint proxying Core's accept-invitation call (`POST` to Core's `/v1/invitations/{id}?accept=true`, analogous in shape to this change's other proxied Core operations) — plus deciding the UX for an unauthenticated recipient (login-then-accept redirect), duplicate-accept handling, and error states (expired/invalid invitation).

**Rationale for not building it now**: this is materially larger scope than "share/unshare/remove access" (a new page, a new route, a new BFF endpoint, and an auth-redirect UX decision) — it is its own feature, not a bug fix, and does not belong bundled into this change per `openspec/config.yaml`'s task-slicing rules (same reasoning already applied to splitting out the metadata and upload-archive follow-ups).

**Follow-up**: scope a dedicated OpenSpec change for the invitation-accept flow (frontend route/page + BFF endpoint) before `ShareFileModal`'s link is useful to real recipients. Until then, `Share` creates a Core-side invitation that is real and valid, but the copy-to-clipboard link this change exposes has no accept surface to send it to.

## Risks / Trade-offs

**No per-item granularity for share/revoke/discard (D2)** → if a batch of 5 resources is passed to `/revoke-access` and Core rejects the call, the frontend cannot tell the user which of the 5 failed, only that the batch failed. Mitigation: keep batches originating from a single bulk-toolbar selection (already how the ui-kit bulk actions work — one call per user action), and log the full path list server-side (not in the client-visible error) for support diagnosis.

**One invitation link covers N resources (D2/D4)** → sharing multiple files/folders in one `ShareFileModal` submission produces a single link granting access to all of them together; a recipient cannot be given a link to only a subset later without a second share action. Mitigation: this matches Core's actual invitation model (an invitation is fundamentally a set of resources + a permission level), so no workaround exists without inventing a coarser client-side batching scheme in front of Core.

**No revoke-single-grantee capability (Non-Goals)** → an owner cannot revoke just one of several people they shared a resource with; `revokeSharedResources` revokes for everyone. Mitigation: none — this is a Core platform limitation, not a BFF/frontend design gap; documented as an explicit Non-Goal so it isn't mistaken for missing frontend work.

**`sharedByMePaths` staleness between the two Core calls in D3** → the `my_files` listing and the `listSharedByMe` query are two separate Core round-trips; a share created a moment ago in another tab/session may not yet appear in `sharedByMePaths` until the next `retryCounter` bump. Mitigation: acceptable staleness window matching how `sharedWithMeIds` already behaves today (also a separate query, also refreshed only on tab load / explicit retry).

**`ManagePermissions` (Share) is folder-only in the installed ui-kit (D10)** → users cannot open the Share dialog for a single file via the row/tree menu at all in the currently installed `@epam/ai-dial-ui-kit` version; only folders expose it. Mitigation: none available from `apps/chat`/`apps/chat-api` — tracked as an upstream ui-kit follow-up (D10). The BFF/hook/modal implementation already supports files, so no rework is needed once the ui-kit restriction is lifted.

**`Unshare` row/tree menu vs. bulk toolbar disagree given identical inputs (D11)** → on the Shared tab a user may see `Unshare` enabled in the bulk toolbar for an item whose own row/tree context menu omits the same action, despite both reading the identical `sharedWithMeIds` prop. Mitigation: none available from `apps/chat` — the bulk toolbar remains a working `Unshare` entry point in the meantime; tracked as an upstream ui-kit follow-up (D11).

**No invitation-accept flow exists yet (D12)** → the invitation link `ShareFileModal` displays is Core's raw, relative, unopenable path (`/v1/invitations/{hash}`); the current `apps/chat`/`apps/chat-api` has no route or endpoint for a recipient to open that link and accept the share (confirmed absent — this piece of legacy's sharing feature was not migrated). Mitigation: none within this change's scope; the Core-side invitation itself is created correctly and is valid, but nothing in this app can currently consume it. Tracked as a dedicated follow-up OpenSpec change (D12), not bundled here.

## Migration Plan

1. Add `ShareItemDto`/`ShareFilesDto`/`ShareFilesResponseDto`, `RevokeAccessDto`/`RevokeAccessResponseDto`, `DiscardSharedDto`/`DiscardSharedResponseDto` (`apps/chat-api/src/files/dto/`).
2. Add `FilesService.shareFiles`, `revokeAccess`, `discardShared`, `listSharedByMe`, each calling the corresponding `dialClient.client.*` method, with typed-exception error mapping and structured start/end logging (batchSize, success/fail) matching `copyFiles`/`moveFiles`.
3. Add `POST /api/v1/files/share`, `POST /api/v1/files/revoke-access`, `POST /api/v1/files/discard-shared`, `GET /api/v1/files/shared-by-me` routes to `FilesController`.
4. Run `npm run openapi`; add `shareFiles`/`revokeAccess`/`discardShared`/`listSharedByMe` wrappers to `apps/chat/src/server-api/files.api.ts`.
5. Extend `useDialFileManager`: `sharedByMePaths` state (fetched with `my_files` tab loads), `onManagePermissions`, `onUnshareFiles`, `onRemoveFilesAccess`, `isSharing`/`isUnsharing`/`isRemovingAccess`.
6. Add `ShareFileModal` component; wire into `DialFileManagerShell` (rendered when `onManagePermissions` has an active `path`).
7. Extend `DialFileManagerShell`'s `actionLabels` computation: `ManagePermissions`/`Unshare`/`RemoveAccess` gated by `isShareActionsAllowed(actionProfile)`; bulk `RemoveAccess` additionally gated by "every selected path is in `sharedByMePaths`" (mirroring legacy `allSelectedItemsShared`).
8. Add i18n keys (`en.json` + `DialFileManagerI18nKeys` enum) for: action labels (Share/Unshare/Remove access), `ShareFileModal` strings (title, permission labels, create-link button, copied-to-clipboard confirmation), and error notifications for all three actions.
9. Update `file-manager-tabs` capability spec: add Share/Unshare/Remove access rows to the action-label table; document `DialFileManagerActionProfile.Full`.

**Rollback**: remove the four new controller routes and revert the hook/shell/component changes. No DB or storage migration; any invitation links already created via `/share` remain valid after rollback (Core-side state, not reverted — matches the rollback posture of every prior file-manager change in this series, which only adds a transport and never reverts already-mutated Core state).

## Open Questions

- **`EMAIL` invitation type**: does this DIAL deployment have email delivery wired up for `invitationType: 'EMAIL'`, and if so, is there a product ask to expose it? Deferred to a future change; needs a product/infra answer before scoping.
- **Folder share UX**: Core addresses a folder the same way as a file (`url`), so `/share`/`/revoke-access`/`/discard-shared` work unmodified for folders — but should `ShareFileModal`'s copy (e.g. "Share this folder" vs "Share this file") differ by `nodeType`? Left as a small frontend-only polish item for implementation to decide against the actual ui-kit `DialFile.nodeType` value at hand.
- **`shareCredentials`/`author`/`sharedBy` fields on `SharedResource`**: present in the Core schema but not used by this design (share request only sets `url`+`permissions`; revoke request only needs `url` since revoking doesn't require re-specifying permissions — confirmed `RevokeResourcesRequest.resources: SharedResource[]` accepts the same shape but the BFF only ever populates `url`). Revisit if Core rejects a revoke call without permissions populated — not verifiable without a live Core deployment; flag for the first supertest/integration run against a real environment.
